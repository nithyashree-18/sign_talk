import os
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "signtalk.db")

app = FastAPI(title="Sign Talk API")

# allow the React dev server (Vite) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/api/signs")
def list_signs(category: str | None = None):
    conn = get_db()
    if category:
        rows = conn.execute(
            "SELECT * FROM signs WHERE category = ? ORDER BY id", (category,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM signs ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/signs/{sign_id}")
def get_sign(sign_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM signs WHERE id = ?", (sign_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Sign not found")
    return dict(row)