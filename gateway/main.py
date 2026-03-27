"""
API Gateway - Central entry point that proxies requests to downstream microservices.
Handles routing, request forwarding, health aggregation, and basic rate limiting.
"""

import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Service registry
# ---------------------------------------------------------------------------
SERVICES = {
    "users": os.getenv("USER_SERVICE_URL", "http://localhost:8001"),
    "tasks": os.getenv("TASK_SERVICE_URL", "http://localhost:8002"),
    "notifications": os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:8003"),
}

# Route prefix -> (service_key, upstream_prefix)
ROUTE_MAP = {
    "/api/users": ("users", "/users"),
    "/api/tasks": ("tasks", "/tasks"),
    "/api/notifications": ("notifications", "/notifications"),
    "/api/webhooks": ("notifications", "/webhooks"),
}

# ---------------------------------------------------------------------------
# Simple in-memory rate limiter
# ---------------------------------------------------------------------------
RATE_LIMIT = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
request_counts: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(client_ip: str):
    now = time.time()
    window = now - 60
    timestamps = request_counts[client_ip]
    # Prune old entries
    request_counts[client_ip] = [t for t in timestamps if t > window]
    if len(request_counts[client_ip]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    request_counts[client_ip].append(now)

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title="Task Management API Gateway",
    description="Unified gateway for User, Task, and Notification microservices.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Health & discovery
# ---------------------------------------------------------------------------
@app.get("/health")
async def gateway_health():
    results = {}
    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in SERVICES.items():
            try:
                resp = await client.get(f"{url}/health")
                results[name] = resp.json() if resp.status_code == 200 else {"status": "unhealthy"}
            except Exception:
                results[name] = {"status": "unreachable"}
    all_healthy = all(r.get("status") == "healthy" for r in results.values())
    return {"gateway": "healthy", "services": results, "all_healthy": all_healthy}


@app.get("/services")
def list_services():
    return {name: {"url": url} for name, url in SERVICES.items()}

# ---------------------------------------------------------------------------
# Generic proxy
# ---------------------------------------------------------------------------
async def proxy_request(request: Request, service_key: str, upstream_path: str) -> Response:
    base_url = SERVICES.get(service_key)
    if not base_url:
        raise HTTPException(status_code=502, detail=f"Unknown service: {service_key}")

    url = f"{base_url}{upstream_path}"
    headers = dict(request.headers)
    headers.pop("host", None)

    body = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
                params=dict(request.query_params),
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail=f"Service '{service_key}' is unavailable")

    excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    response_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded_headers}

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=response_headers,
        media_type=resp.headers.get("content-type"),
    )

# ---------------------------------------------------------------------------
# Catch-all route that maps /api/* to the appropriate service
# ---------------------------------------------------------------------------
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def route_request(request: Request, path: str):
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)

    full_path = f"/api/{path}"

    # Find the matching route prefix
    for prefix, (service_key, upstream_prefix) in sorted(ROUTE_MAP.items(), key=lambda x: -len(x[0])):
        if full_path.startswith(prefix):
            remainder = full_path[len(prefix):]
            upstream_path = f"{upstream_prefix}{remainder}"
            return await proxy_request(request, service_key, upstream_path)

    raise HTTPException(status_code=404, detail="No matching service route")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
