# Cloud Microservices — Task Management API

A production-style microservices architecture built with **FastAPI**, **SQLite**, and **Docker**.
Designed to demonstrate distributed systems knowledge for cloud engineering roles at
**CGI, Confluent, Cisco, and SAP**.

---

## Architecture Overview

```
┌─────────────┐
│   Client     │
└──────┬──────┘
       │ HTTP
┌──────▼──────┐
│  API Gateway │  :8000   — routing, rate limiting, CORS, health aggregation
└──┬───┬───┬──┘
   │   │   │
   │   │   └──────────────────────┐
   │   │                          │
┌──▼───┴──┐  ┌──────────┐  ┌─────▼────────────┐
│ User Svc │  │ Task Svc │  │ Notification Svc │
│  :8001   │  │  :8002   │  │     :8003        │
│ SQLite   │  │ SQLite   │  │  In-memory queue  │
└──────────┘  └──────────┘  │  + Webhooks       │
                            └──────────────────┘
```

### Service Responsibilities

| Service | Port | Database | Purpose |
|---|---|---|---|
| **API Gateway** | 8000 | — | Routes requests, rate limiting, CORS, health checks |
| **User Service** | 8001 | SQLite | User CRUD, registration, JWT authentication |
| **Task Service** | 8002 | SQLite | Task CRUD, filtering, assignment, status workflow |
| **Notification Service** | 8003 | In-memory | Event queue, webhook registration and delivery |

---

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
# Build and start all services
docker-compose up --build

# Verify everything is running
curl http://localhost:8000/health
```

### Option 2: Run locally

```bash
# Install dependencies
pip install -r requirements.txt

# Start each service in a separate terminal
cd services/user-service && python main.py          # Terminal 1
cd services/task-service && python main.py          # Terminal 2
cd services/notification-service && python main.py  # Terminal 3
cd gateway && python main.py                        # Terminal 4
```

---

## API Usage Examples

### 1. Register a user

```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "email": "alice@example.com", "password": "secret123", "full_name": "Alice Johnson"}'
```

### 2. Log in (get JWT)

```bash
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "secret123"}'
```

Save the `access_token` from the response.

### 3. Create a task

```bash
export TOKEN="<your-access-token>"

curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Deploy to Kubernetes", "description": "Set up K8s manifests", "priority": "high", "tags": ["devops", "k8s"]}'
```

### 4. List tasks with filters

```bash
curl "http://localhost:8000/api/tasks?status=todo&priority=high" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Update task status

```bash
curl -X PUT http://localhost:8000/api/tasks/<task-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "in_progress"}'
```

### 6. Register a webhook

```bash
curl -X POST http://localhost:8000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/webhook", "events": ["task_assigned", "task_status_changed"]}'
```

### 7. View notifications

```bash
curl http://localhost:8000/api/notifications?limit=10
```

### 8. Health check (all services)

```bash
curl http://localhost:8000/health
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **FastAPI** | Async-native, automatic OpenAPI docs, type safety via Pydantic |
| **SQLite** | Zero-config persistence, ideal for demos; swap to PostgreSQL in prod |
| **JWT auth** | Stateless tokens validated across services, no shared session store |
| **In-memory notifications** | Simulates a message queue (Kafka/RabbitMQ) without infra overhead |
| **API Gateway pattern** | Single entry point, centralized rate limiting and CORS |
| **Multi-stage Docker** | Smaller images (~120MB vs ~900MB), security best practices |
| **Service-to-service REST** | Simple inter-service communication; replaceable with gRPC |

---

## Relevance to Target Companies

- **CGI**: Enterprise microservices, containerized deployments, REST API design
- **Confluent**: Event-driven architecture, notification queue (mirrors Kafka patterns)
- **Cisco**: API gateway pattern, service mesh concepts, health monitoring
- **SAP**: Multi-service backends, task/workflow management, cloud-native architecture

---

## Project Structure

```
cloud-microservices/
├── gateway/
│   └── main.py              # API Gateway — routing, rate limiting, health
├── services/
│   ├── user-service/
│   │   └── main.py          # User registration, auth, JWT
│   ├── task-service/
│   │   └── main.py          # Task CRUD, filtering, assignments
│   └── notification-service/
│       └── main.py          # Event queue, webhook delivery
├── docker-compose.yml        # Orchestrate all 4 services
├── Dockerfile                # Multi-stage build (shared)
├── requirements.txt          # Shared Python dependencies
└── SETUP.md                  # This file
```

---

## Extending the Project

- Add **PostgreSQL** via `databases` + `asyncpg` for production persistence
- Add **Redis** for caching and rate limiting across gateway instances
- Add **Prometheus metrics** endpoint (`/metrics`) per service
- Add **OpenTelemetry** tracing for distributed request tracking
- Replace notification queue with **Apache Kafka** (relevant for Confluent)
- Add **Kubernetes manifests** (`deployment.yaml`, `service.yaml`, `ingress.yaml`)
- Add **CI/CD pipeline** with GitHub Actions
