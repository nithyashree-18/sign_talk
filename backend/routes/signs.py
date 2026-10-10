from fastapi import APIRouter, HTTPException

from db import get_db

router = APIRouter(prefix="/api/signs", tags=["signs"])


@router.get("")
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


@router.get("/{sign_id}")
def get_sign(sign_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM signs WHERE id = ?", (sign_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Sign not found")
    return dict(row)