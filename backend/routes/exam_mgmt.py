import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_db
from routes.auth import current_user

router = APIRouter(prefix="/api/exam-mgmt", tags=["exam-mgmt"])


def ensure_table():
    conn = get_db()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            seconds_per_question INTEGER NOT NULL,
            labels TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    conn.commit()
    conn.close()


ensure_table()


def require_examiner(user=Depends(current_user)):
    if user["role"] != "examiner":
        raise HTTPException(status_code=403, detail="Examiner access only")
    return user


class ExamIn(BaseModel):
    title: str
    seconds_per_question: int = 15
    labels: list[str]


@router.get("")
def list_exams(user=Depends(current_user)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM exams ORDER BY id DESC").fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["labels"] = json.loads(d["labels"])
        out.append(d)
    return out


@router.post("")
def create_exam(data: ExamIn, user=Depends(require_examiner)):
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if not data.labels:
        raise HTTPException(status_code=400, detail="Pick at least one sign")
    if not 5 <= data.seconds_per_question <= 120:
        raise HTTPException(status_code=400, detail="Seconds per question must be 5 to 120")
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO exams (title, seconds_per_question, labels, created_by, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (
            data.title.strip(),
            data.seconds_per_question,
            json.dumps(data.labels),
            user["id"],
            datetime.now().isoformat(timespec="seconds"),
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"id": new_id}


@router.delete("/{exam_id}")
def delete_exam(exam_id: int, user=Depends(require_examiner)):
    conn = get_db()
    conn.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
    conn.commit()
    conn.close()
    return {"ok": True}