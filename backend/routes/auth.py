import hashlib
import secrets

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from db import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


def init_tables():
    conn = get_db()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('student', 'examiner'))
        )"""
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL)"
    )
    conn.commit()
    conn.close()


init_tables()


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), 200_000
    ).hex()


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


@router.get("/ping")
def ping():
    return {"ok": True}


@router.post("/register")
def register(data: RegisterIn):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    email = data.email.strip().lower()
    salt = secrets.token_hex(16)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (name, email, salt, password_hash, role) VALUES (?, ?, ?, ?, 'student')",
            (data.name.strip(), email, salt, hash_password(data.password, salt)),
        )
        conn.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="Email already registered")
    finally:
        conn.close()
    return {"ok": True}


@router.post("/login")
def login(data: LoginIn):
    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ?", (data.email.strip().lower(),)
    ).fetchone()
    if user is None or hash_password(data.password, user["salt"]) != user["password_hash"]:
        conn.close()
        raise HTTPException(status_code=401, detail="Wrong email or password")
    token = secrets.token_hex(24)
    conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user["id"]))
    conn.commit()
    conn.close()
    return {"token": token, "name": user["name"], "role": user["role"]}


def current_user(authorization: str | None = Header(default=None)):
    """Use in other routes: user = Depends(current_user)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not logged in")
    token = authorization[7:]
    conn = get_db()
    row = conn.execute(
        "SELECT u.id, u.name, u.email, u.role FROM sessions s "
        "JOIN users u ON u.id = s.user_id WHERE s.token = ?",
        (token,),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid session")
    return dict(row)


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    return current_user(authorization)