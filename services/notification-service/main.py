"""
Notification Service - In-memory notification queue with webhook support.
Stores notifications, supports webhook registration, and delivers events
to subscribers asynchronously.
"""

import os
import uuid
from datetime import datetime
from collections import deque
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_QUEUE_SIZE = int(os.getenv("MAX_QUEUE_SIZE", "10000"))

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------
notification_queue: deque = deque(maxlen=MAX_QUEUE_SIZE)
webhooks: dict[str, dict] = {}  # id -> webhook config

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title="Notification Service",
    description="Event-driven notification queue with webhook delivery.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class NotificationCreate(BaseModel):
    event: str = Field(..., description="Event type, e.g. task_assigned, task_status_changed")
    task_id: str | None = None
    assignee_id: str | None = None
    title: str | None = None
    old_status: str | None = None
    new_status: str | None = None
    message: str | None = None

class NotificationOut(BaseModel):
    id: str
    event: str
    data: dict
    delivered_to: list[str]
    created_at: str

class WebhookRegister(BaseModel):
    url: str = Field(..., description="URL to POST events to")
    events: list[str] = Field(default=["*"], description="Event types to subscribe to, or ['*'] for all")
    secret: str | None = Field(None, description="Shared secret for HMAC verification")

class WebhookOut(BaseModel):
    id: str
    url: str
    events: list[str]
    is_active: bool
    created_at: str

# ---------------------------------------------------------------------------
# Webhook delivery
# ---------------------------------------------------------------------------
async def deliver_to_webhooks(event: str, payload: dict) -> list[str]:
    """Attempt to deliver the notification to all matching webhooks."""
    delivered: list[str] = []
    for wh_id, wh in webhooks.items():
        if not wh["is_active"]:
            continue
        if "*" not in wh["events"] and event not in wh["events"]:
            continue
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                headers = {"X-Webhook-Event": event}
                if wh.get("secret"):
                    headers["X-Webhook-Secret"] = wh["secret"]
                resp = await client.post(wh["url"], json=payload, headers=headers)
                if resp.status_code < 400:
                    delivered.append(wh_id)
        except Exception:
            # Mark as failed but don't deactivate after a single failure
            pass
    return delivered

# ---------------------------------------------------------------------------
# Routes - Notifications
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "healthy", "service": "notification-service", "queue_size": len(notification_queue)}


@app.post("/notifications", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def create_notification(notif: NotificationCreate):
    notif_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Build payload from all provided fields
    data = {k: v for k, v in notif.model_dump().items() if v is not None and k != "event"}

    # Deliver to webhooks
    delivered = await deliver_to_webhooks(notif.event, {"event": notif.event, "data": data, "id": notif_id})

    record = {
        "id": notif_id,
        "event": notif.event,
        "data": data,
        "delivered_to": delivered,
        "created_at": now,
    }
    notification_queue.append(record)
    return record


@app.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    event: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    items = list(notification_queue)
    if event:
        items = [n for n in items if n["event"] == event]
    # Most recent first
    items = list(reversed(items))
    return items[offset : offset + limit]


@app.get("/notifications/{notif_id}", response_model=NotificationOut)
def get_notification(notif_id: str):
    for n in notification_queue:
        if n["id"] == notif_id:
            return n
    raise HTTPException(status_code=404, detail="Notification not found")


@app.delete("/notifications", status_code=status.HTTP_204_NO_CONTENT)
def clear_notifications():
    notification_queue.clear()

# ---------------------------------------------------------------------------
# Routes - Webhooks
# ---------------------------------------------------------------------------
@app.post("/webhooks", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
def register_webhook(wh: WebhookRegister):
    wh_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    record = {
        "id": wh_id,
        "url": wh.url,
        "events": wh.events,
        "secret": wh.secret,
        "is_active": True,
        "created_at": now,
    }
    webhooks[wh_id] = record
    return record


@app.get("/webhooks", response_model=list[WebhookOut])
def list_webhooks():
    return list(webhooks.values())


@app.delete("/webhooks/{wh_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(wh_id: str):
    if wh_id not in webhooks:
        raise HTTPException(status_code=404, detail="Webhook not found")
    del webhooks[wh_id]


@app.put("/webhooks/{wh_id}/toggle")
def toggle_webhook(wh_id: str):
    if wh_id not in webhooks:
        raise HTTPException(status_code=404, detail="Webhook not found")
    webhooks[wh_id]["is_active"] = not webhooks[wh_id]["is_active"]
    return {"id": wh_id, "is_active": webhooks[wh_id]["is_active"]}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
@app.get("/notifications/stats/summary")
def notification_stats():
    items = list(notification_queue)
    by_event: dict[str, int] = {}
    for n in items:
        by_event[n["event"]] = by_event.get(n["event"], 0) + 1
    return {
        "total": len(items),
        "by_event": by_event,
        "webhooks_registered": len(webhooks),
        "webhooks_active": sum(1 for w in webhooks.values() if w["is_active"]),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8003")))
