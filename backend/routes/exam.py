import json
import random
import secrets
import threading
import time
from datetime import datetime

import cv2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import recognizer
from db import get_db

router = APIRouter(prefix="/api/exam", tags=["exam"])

# Letters left out of the exam for now: n and r (weak recall in testing).
# Add them back once the letters model is improved.
LETTER_POOL = [f"letter_{c}" for c in "abcdefghijklmopqstuvwxyz"]

EXAMS = {
    "numbers": {
        "title": "ISL Numbers: Practical Exam",
        "model": "numbers",
        # Add "three" and "seven" back once their accuracy improves.
        "pool": ["zero", "one", "two", "four", "five", "eight"],
        "count": 6,          # questions per attempt
        "seconds": 15,       # time for each question
        "pass_conf": 0.6,    # minimum confidence for a frame to count as correct
        "streak": 3,         # correct frames in a row needed to pass a question
        "train": "python ml/step4_train.py",
    },
    "letters": {
        "title": "ISL Alphabet: Practical Exam",
        "model": "letters",
        "pool": LETTER_POOL,
        "count": 8,
        "seconds": 20,
        "pass_conf": 0.7,
        "streak": 4,
        "train": "python ml/step4_train_letters.py",
    },
}

MIN_FRAME_GAP = 0.15     # frames arriving faster than this are not counted
SESSION_TTL = 3600       # seconds before an unfinished exam session is forgotten

_sessions = {}           # session id -> exam state, kept only in memory
_lock = threading.Lock()


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


def _get_cfg(kind):
    cfg = EXAMS.get(kind)
    if cfg is None:
        raise HTTPException(status_code=400, detail=f"Unknown exam '{kind}'")
    return cfg


def _build_questions(cfg):
    rec = recognizer.get_recognizer(cfg["model"])
    if rec is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model not found. Train it first: {cfg['train']}",
        )
    known = set(rec.classes)

    conn = get_db()
    rows = conn.execute("SELECT label, name FROM signs").fetchall()
    conn.close()
    names = {r["label"]: r["name"] for r in rows}

    pool = [l for l in cfg["pool"] if l in known and l in names]
    chosen = random.sample(pool, min(cfg["count"], len(pool)))
    return [
        {"label": l, "name": names[l], "prompt": f"Show the sign for {names[l]}"}
        for l in chosen
    ]


def _get_session(sid):
    s = _sessions.get(sid)
    if s is None:
        raise HTTPException(
            status_code=404, detail="Exam session not found. Please start again."
        )
    return s


def _question_view(s):
    q = s["questions"][s["index"]]
    return {
        "index": s["index"],
        "total": len(s["questions"]),
        "name": q["name"],
        "prompt": q["prompt"],
        "seconds_left": s["cfg"]["seconds"],
    }


def _state(s, now):
    cfg = s["cfg"]
    left = max(0.0, cfg["seconds"] - (now - s["q_start"]))
    return {
        "hand_detected": s["last_hand"],
        "progress": min(1.0, s["streak"] / cfg["streak"]),
        "status": s["status"] if s["resolved"] else "running",
        "seconds_left": round(left, 1),
    }


def _resolve(s, passed, now):
    q = s["questions"][s["index"]]
    seconds = min(s["cfg"]["seconds"], max(0.0, now - s["q_start"]))
    s["answers"].append(
        {"label": q["label"], "name": q["name"], "passed": passed, "seconds": round(seconds, 1)}
    )
    s["resolved"] = True
    s["status"] = "passed" if passed else "missed"


def _finish(s):
    title = s["cfg"]["title"]
    score = sum(1 for a in s["answers"] if a["passed"])
    total = len(s["answers"])
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO practical_attempts "
        "(student_name, exam_title, score, total, submitted_at, details) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            s["student_name"],
            title,
            score,
            total,
            datetime.now().isoformat(timespec="seconds"),
            json.dumps(s["answers"]),
        ),
    )
    conn.commit()
    attempt_id = cur.lastrowid
    conn.close()
    s["finished"] = True
    s["result"] = {
        "id": attempt_id,
        "title": title,
        "student_name": s["student_name"],
        "score": score,
        "total": total,
        "answers": [
            {"name": a["name"], "passed": a["passed"], "seconds": a["seconds"]}
            for a in s["answers"]
        ],
    }
    return s["result"]


@router.get("")
def exam_info(kind: str = "numbers"):
    cfg = _get_cfg(kind)
    return {
        "kind": kind,
        "title": cfg["title"],
        "seconds_per_question": cfg["seconds"],
        "count": len(_build_questions(cfg)),
    }


class StartBody(BaseModel):
    student_name: str
    kind: str = "numbers"


@router.post("/start")
def start(body: StartBody):
    name = body.student_name.strip()
    if not name or len(name) > 80:
        raise HTTPException(status_code=400, detail="Please enter your name")
    cfg = _get_cfg(body.kind)
    questions = _build_questions(cfg)
    if not questions:
        raise HTTPException(status_code=400, detail="This exam has no questions yet")

    now = time.time()
    sid = secrets.token_urlsafe(16)
    with _lock:
        for k in [k for k, v in _sessions.items() if now - v["created"] > SESSION_TTL]:
            del _sessions[k]
        s = {
            "created": now,
            "cfg": cfg,
            "student_name": name,
            "questions": questions,
            "index": 0,
            "q_start": now,
            "streak": 0,
            "last_counted": 0.0,
            "last_hand": False,
            "resolved": False,
            "status": None,
            "answers": [],
            "finished": False,
            "result": None,
        }
        _sessions[sid] = s
        view = _question_view(s)

    return {
        "session_id": sid,
        "kind": body.kind,
        "title": cfg["title"],
        "seconds_per_question": cfg["seconds"],
        "question": view,
    }


class FrameBody(BaseModel):
    image: str   # a JPEG as a base64 data URL, sent by the browser


@router.post("/{sid}/frame")
def frame(sid: str, body: FrameBody):
    now = time.time()
    with _lock:
        s = _get_session(sid)
        cfg = s["cfg"]
        if s["finished"]:
            raise HTTPException(status_code=409, detail="This exam is already finished")
        if not s["resolved"] and now - s["q_start"] >= cfg["seconds"]:
            _resolve(s, False, now)
        if s["resolved"] or now - s["last_counted"] < MIN_FRAME_GAP:
            return _state(s, now)
        index = s["index"]
        target = s["questions"][index]["label"]

    # the slow part (MediaPipe + classifier) runs outside the lock
    rec = recognizer.get_recognizer(cfg["model"])
    if rec is None:
        raise HTTPException(status_code=503, detail="Model not found")
    try:
        pred = rec.predict(body.image)
    except (ValueError, cv2.error):
        raise HTTPException(status_code=400, detail="Could not read the image")

    now = time.time()
    with _lock:
        s = _get_session(sid)
        if s["finished"] or s["resolved"] or s["index"] != index:
            return _state(s, now)
        s["last_counted"] = now
        s["last_hand"] = bool(pred["hand_detected"])
        if now - s["q_start"] >= cfg["seconds"]:
            _resolve(s, False, now)
        else:
            correct = (
                pred["hand_detected"]
                and pred["label"] == target
                and pred["confidence"] >= cfg["pass_conf"]
            )
            s["streak"] = s["streak"] + 1 if correct else 0
            if s["streak"] >= cfg["streak"]:
                _resolve(s, True, now)
        return _state(s, now)


@router.post("/{sid}/next")
def next_question(sid: str):
    now = time.time()
    with _lock:
        s = _get_session(sid)
        if s["finished"]:
            return {"finished": True, "result": s["result"]}
        if not s["resolved"]:
            if now - s["q_start"] >= s["cfg"]["seconds"]:
                _resolve(s, False, now)
            else:
                raise HTTPException(status_code=409, detail="This question is still running")
        if s["index"] + 1 >= len(s["questions"]):
            return {"finished": True, "result": _finish(s)}
        s["index"] += 1
        s["q_start"] = now
        s["streak"] = 0
        s["last_counted"] = 0.0
        s["last_hand"] = False
        s["resolved"] = False
        s["status"] = None
        return {"finished": False, "question": _question_view(s)}


@router.get("/attempt/{attempt_id}")
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