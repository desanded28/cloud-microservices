"""
User Service - Handles user registration, authentication, and profile management.
Uses SQLite for persistence and JWT for stateless authentication.
"""

import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from jose import JWTError, jwt
import bcrypt

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# obviously don't ship the default — this is just for local dev
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
DB_PATH = os.getenv("USER_DB_PATH", "users.db")

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # WAL mode = better concurrent read performance
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            full_name TEXT DEFAULT '',
            role TEXT DEFAULT 'member',
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
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
    title="User Service",
    description="Manages users, authentication, and authorization for the Task Management platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    full_name: str = ""

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role: str | None = None

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str
    updated_at: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60

# ---------------------------------------------------------------------------
# Auth utilities
# ---------------------------------------------------------------------------
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "healthy", "service": "user-service"}


@app.post("/users/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate):
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            (user.username, user.email),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username or email already taken")

        user_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        hashed = hash_password(user.password)

        conn.execute(
            """INSERT INTO users (id, username, email, hashed_password, full_name, role, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'member', 1, ?, ?)""",
            (user_id, user.username, user.email, hashed, user.full_name, now, now),
        )
        conn.commit()

        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@app.post("/users/login", response_model=Token)
def login(creds: UserLogin):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (creds.username,)).fetchone()
        # same error for bad user vs bad password — don't leak which one was wrong
        if not row or not verify_password(creds.password, row["hashed_password"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        if not row["is_active"]:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        token = create_access_token({"sub": row["id"], "username": row["username"], "role": row["role"]})
        return {"access_token": token, "token_type": "bearer", "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60}
    finally:
        conn.close()


@app.get("/users", response_model=list[UserOut])
def list_users(payload: dict = Depends(verify_token)):
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.get("/users/me", response_model=UserOut)
def get_current_user(payload: dict = Depends(verify_token)):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(row)
    finally:
        conn.close()


@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: str, payload: dict = Depends(verify_token)):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(row)
    finally:
        conn.close()


@app.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, updates: UserUpdate, payload: dict = Depends(verify_token)):
    # users can edit themselves, admins can edit anyone
    if payload["sub"] != user_id and payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.utcnow().isoformat()
        fields = {k: v for k, v in updates.model_dump().items() if v is not None}
        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        fields["updated_at"] = now
        # build SET clause dynamically so we only touch fields that were sent
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [user_id]
        conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
        conn.commit()

        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, payload: dict = Depends(verify_token)):
    if payload["sub"] != user_id and payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db()
    try:
        result = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
    finally:
        conn.close()


@app.get("/users/verify/token")
def verify_token_endpoint(payload: dict = Depends(verify_token)):
    """Called internally by other services to validate a JWT — not meant for end users."""
    return {"valid": True, "user_id": payload["sub"], "username": payload["username"], "role": payload.get("role", "member")}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))
