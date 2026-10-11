import json

from fastapi import APIRouter, Depends, HTTPException

from db import get_db
from routes.auth import current_user

router = APIRouter(prefix="/api/examiner", tags=["examiner"])


def require_examiner(user=Depends(current_user)):
    if user["role"] != "examiner":
        raise HTTPException(status_code=403, detail="Examiner access only")
    return user


@router.get("/summary")
def summary(user=Depends(require_examiner)):
    conn = get_db()
    row = conn.execute(
        "SELECT COUNT(*) AS attempts, COUNT(DISTINCT student_name) AS students, "
        "AVG(score * 100.0 / total) AS avg_percent FROM practical_attempts"
    ).fetchone()
    conn.close()
    return {
        "attempts": row["attempts"],
        "students": row["students"],
        "avg_percent": round(row["avg_percent"] or 0, 1),
    }


@router.get("/attempts")
def attempts(user=Depends(require_examiner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, student_name, exam_title, score, total, submitted_at "
        "FROM practical_attempts ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return [
        {**dict(r), "percent": round(r["score"] * 100.0 / r["total"], 1)} for r in rows
    ]


@router.get("/attempts/{attempt_id}")
def attempt_detail(attempt_id: int, user=Depends(require_examiner)):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM practical_attempts WHERE id = ?", (attempt_id,)
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    out = dict(row)
    out["details"] = json.loads(out["details"])
    return out