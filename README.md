# Cloud Microservices

A task management platform built with a microservices architecture. Four separate services communicate through a central API gateway, all containerised with Docker.

## Architecture

```
Client → API Gateway (:8000)
              ├── User Service (:8001)       - registration, auth, JWT tokens
              ├── Task Service (:8002)       - CRUD, assignment, status tracking
              └── Notification Service (:8003) - event-driven alerts, webhooks
```

Each service runs in its own container with its own database. The gateway handles routing, rate limiting, and auth validation.

## Stack

- **Backend:** Python, FastAPI, Pydantic
- **Auth:** JWT (issued by user service, validated at gateway)
- **Infra:** Docker, docker-compose
- **Communication:** REST between services, internal event queue for notifications

## Running it

```bash
docker-compose up --build
```

Gateway is at `http://localhost:8000`. All service endpoints are proxied through it.

## What I learned

This was my first time splitting an app into separate services instead of building a monolith. The main takeaway was that service boundaries matter more than I expected — getting the API contracts right between services upfront saved a lot of debugging later. Also learned how to handle auth in a distributed setup where the gateway validates tokens but individual services still need user context.
