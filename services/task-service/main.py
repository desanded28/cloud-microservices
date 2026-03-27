"""
Task Service - Manages tasks, assignments, and status tracking.
Communicates with User Service for validation and Notification Service for alerts.
Uses SQLite for persistence.
"""

import os
import sqlite3
import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from enum import Enum

import httpx
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8001")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:8003")
DB_PATH = os.getenv("TASK_DB_PATH", "tasks.db")

security = HTTPBearer()

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            assignee_id TEXT,
            creator_id TEXT NOT NULL,
            due_date TEXT,
            tags TEXT DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id);
    """)
    conn.commit()
    conn.close()

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Task Service",
    description="Task CRUD, assignment, and workflow management.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Enums & Models
# ---------------------------------------------------------------------------
class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    CANCELLED = "cancelled"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: str | None = None
    due_date: str | None = None
    tags: list[str] = []

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: str | None = None
    due_date: str | None = None
    tags: list[str] | None = None

class TaskOut(BaseModel):
    id: str
    title: str
    description: str
    status: str
    priority: str
    assignee_id: str | None
    creator_id: str
    due_date: str | None
    tags: list[str]
    created_at: str
    updated_at: str


def row_to_task(row: sqlite3.Row) -> dict:
    """Convert a DB row to a dict with tags parsed from JSON string to list."""
    import json
    d = dict(row)
    if isinstance(d.get("tags"), str):
        try:
            d["tags"] = json.loads(d["tags"])
        except (json.JSONDecodeError, TypeError):
            d["tags"] = []
    return d

# ---------------------------------------------------------------------------
# Auth helper – validates JWT via User Service
# ---------------------------------------------------------------------------
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    # we don't verify JWTs ourselves — the user service is the source of truth
    token = credentials.credentials
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(
                f"{USER_SERVICE_URL}/users/verify/token",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            return resp.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="User service unavailable")


async def send_notification(event: str, payload: dict):
    """Fire-and-forget notification to the notification service."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{NOTIFICATION_SERVICE_URL}/notifications",
                json={"event": event, **payload},
            )
    except Exception:
        pass  # notifications failing shouldn't block the main request

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "healthy", "service": "task-service"}


@app.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(task: TaskCreate, user: dict = Depends(verify_token)):
    conn = get_db()
    try:
        task_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        import json
        tags_json = json.dumps(task.tags)

        conn.execute(
            """INSERT INTO tasks (id, title, description, status, priority, assignee_id, creator_id, due_date, tags, created_at, updated_at)
               VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)""",
            (task_id, task.title, task.description, task.priority.value,
             task.assignee_id, user["user_id"], task.due_date, tags_json, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        result = row_to_task(row)

        # Notify if assigned
        if task.assignee_id:
            await send_notification("task_assigned", {
                "task_id": task_id,
                "assignee_id": task.assignee_id,
                "title": task.title,
            })

        return result
    finally:
        conn.close()


@app.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    assignee_id: str | None = None,
    creator_id: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(verify_token),
):
    conn = get_db()
    try:
        # WHERE 1=1 so we can just keep appending AND clauses
        query = "SELECT * FROM tasks WHERE 1=1"
        params: list = []

        if status:
            query += " AND status = ?"
            params.append(status.value)
        if priority:
            query += " AND priority = ?"
            params.append(priority.value)
        if assignee_id:
            query += " AND assignee_id = ?"
            params.append(assignee_id)
        if creator_id:
            query += " AND creator_id = ?"
            params.append(creator_id)

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(query, params).fetchall()
        return [row_to_task(r) for r in rows]
    finally:
        conn.close()


@app.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: str, user: dict = Depends(verify_token)):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        return row_to_task(row)
    finally:
        conn.close()


@app.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, updates: TaskUpdate, user: dict = Depends(verify_token)):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")

        old_task = dict(row)
        now = datetime.utcnow().isoformat()
        fields: dict = {}

        for k, v in updates.model_dump().items():
            if v is not None:
                if k == "tags":
                    import json
                    fields[k] = json.dumps(v)  # tags stored as JSON string in sqlite
                elif hasattr(v, "value"):
                    fields[k] = v.value  # enum -> its string value
                else:
                    fields[k] = v

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        fields["updated_at"] = now
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [task_id]
        conn.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", values)
        conn.commit()

        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        result = row_to_task(row)

        # Notify on status change
        if updates.status and updates.status.value != old_task["status"]:
            await send_notification("task_status_changed", {
                "task_id": task_id,
                "old_status": old_task["status"],
                "new_status": updates.status.value,
                "assignee_id": result.get("assignee_id"),
            })

        # Notify on reassignment
        if updates.assignee_id and updates.assignee_id != old_task.get("assignee_id"):
            await send_notification("task_assigned", {
                "task_id": task_id,
                "assignee_id": updates.assignee_id,
                "title": result["title"],
            })

        return result
    finally:
        conn.close()


class StatusUpdate(BaseModel):
    status: TaskStatus


@app.put("/tasks/{task_id}/status", response_model=TaskOut)
async def update_task_status(task_id: str, body: StatusUpdate, user: dict = Depends(verify_token)):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")

        old_status = row["status"]  # grab before we overwrite
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
            (body.status.value, now, task_id),
        )
        conn.commit()

        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        result = row_to_task(row)

        if body.status.value != old_status:
            await send_notification("task_status_changed", {
                "task_id": task_id,
                "old_status": old_status,
                "new_status": body.status.value,
                "assignee_id": result.get("assignee_id"),
            })

        return result
    finally:
        conn.close()


@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, user: dict = Depends(verify_token)):
    conn = get_db()
    try:
        result = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    finally:
        conn.close()


@app.get("/tasks/stats/summary")
def task_stats(user: dict = Depends(verify_token)):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
        ).fetchall()
        stats = {r["status"]: r["count"] for r in rows}
        total = sum(stats.values())
        return {"total": total, "by_status": stats}
    finally:
        conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8002")))
