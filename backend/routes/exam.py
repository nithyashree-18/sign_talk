import json
import random
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import recognizer
from db import get_db

router = APIRouter(prefix="/api/exam", tags=["exam"])

EXAM_TITLE = "ISL Numbers: Practical Exam"
SECONDS_PER_QUESTION = 15
# Signs the recogniser handles reliably today. Add "three" and "seven" back
# once their accuracy improves.
EXAM_LABELS = ["zero", "one", "two", "four", "five", "eight"]


def ensure_table():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS practical_attempts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT NOT NULL,
            exam_title   TEXT NOT NULL,
            score        INTEGER NOT NULL,
            total        INTEGER NOT NULL,
            submitted_at TEXT NOT NULL,
            details      TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


ensure_table()


@router.get("")
def get_exam():
    rec = recognizer.get_recognizer()
    if rec is None:
        raise HTTPException(
            status_code=503,
            detail="Model not found. Train it first: python ml/step4_train.py",
        )
    known = set(rec.classes)

    conn = get_db()
    rows = conn.execute("SELECT label, name FROM signs").fetchall()
    conn.close()
    names = {r["label"]: r["name"] for r in rows}

    questions = [
        {"label": l, "name": names[l], "prompt": f"Show the sign for {names[l]}"}
        for l in EXAM_LABELS
        if l in known and l in names
    ]
    random.shuffle(questions)
    return {
        "title": EXAM_TITLE,
        "seconds_per_question": SECONDS_PER_QUESTION,
        "questions": questions,
    }


class Answer(BaseModel):
    label: str
    passed: bool
    seconds: float


class Submission(BaseModel):
    student_name: str
    answers: list[Answer]


@router.post("/submit")
def submit(sub: Submission):
    name = sub.student_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Student name is required")
    if not sub.answers or len(sub.answers) > 50:
        raise HTTPException(status_code=400, detail="Invalid number of answers")

    score = sum(1 for a in sub.answers if a.passed)
    total = len(sub.answers)
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO practical_attempts "
        "(student_name, exam_title, score, total, submitted_at, details) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            name,
            EXAM_TITLE,
            score,
            total,
            datetime.now().isoformat(timespec="seconds"),
            json.dumps([a.model_dump() for a in sub.answers]),
        ),
    )
    conn.commit()
    attempt_id = cur.lastrowid
    conn.close()
    return {"id": attempt_id, "score": score, "total": total}


@router.get("/{attempt_id}")
def get_attempt(attempt_id: int):
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