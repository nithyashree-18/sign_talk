"""Exam history, leaderboard, class results, assignments and certificates.
Reads the existing practical_attempts table. Adds two small tables of its own."""
import json
import os
import secrets
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

from certificate_pdf import make_certificate_pdf
from db import get_db
from routes.exam import EXAMS

router = APIRouter(prefix="/api", tags=["results"])

PASS_MARK = 0.6                                   # 60% of the questions
CERT_BACKEND = os.environ.get("CERT_BACKEND", "local")   # "local" or "lambda"


def _init():
    conn = get_db()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_kind TEXT NOT NULL,
            student_name TEXT NOT NULL,     -- a name, or '*' for the whole class
            due_date TEXT,
            created_at TEXT NOT NULL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS certificates (
            cert_id TEXT PRIMARY KEY,
            attempt_id INTEGER UNIQUE NOT NULL,
            student_name TEXT NOT NULL,
            exam_title TEXT NOT NULL,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            issued_on TEXT NOT NULL
        )"""
    )
    conn.commit()
    conn.close()


_init()


def require_examiner():
    """TODO: lock the examiner endpoints. Needs the login token check from routes/auth.py.
    Until it is wired in, anyone who can reach the backend can call them."""
    return True


def _passed(score, total):
    return total > 0 and score / total >= PASS_MARK


def _title(kind):
    cfg = EXAMS.get(kind)
    if cfg is None:
        raise HTTPException(status_code=400, detail=f"Unknown exam '{kind}'")
    return cfg["title"]


def _student_names(conn):
    names = set()
    try:
        rows = conn.execute("SELECT name FROM users WHERE role != 'examiner'").fetchall()
        names |= {r["name"] for r in rows if r["name"]}
    except Exception:
        pass  # her users table may use other column names; attempts still give us names
    names |= {r["student_name"] for r in conn.execute("SELECT DISTINCT student_name FROM practical_attempts")}
    return sorted(names, key=str.lower)


def _weak(rows, limit=None):
    per = {}
    for r in rows:
        for a in json.loads(r["details"]):
            p = per.setdefault(a["label"], {"label": a["label"], "name": a["name"], "attempts": 0, "correct": 0})
            p["attempts"] += 1
            p["correct"] += 1 if a["passed"] else 0
    out = [dict(p, accuracy=p["correct"] / p["attempts"]) for p in per.values() if p["correct"] < p["attempts"]]
    out.sort(key=lambda p: (p["accuracy"], -p["attempts"]))
    return out[:limit] if limit else out


# ---------------------------------------------------------------- student side
@router.get("/me/history")
def history(student: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT a.*, c.cert_id FROM practical_attempts a "
        "LEFT JOIN certificates c ON c.attempt_id = a.id "
        "WHERE lower(a.student_name) = lower(?) ORDER BY a.id DESC",
        (student.strip(),),
    ).fetchall()
    conn.close()
    return [
        {
            "attempt_id": r["id"],
            "exam_title": r["exam_title"],
            "score": r["score"],
            "total": r["total"],
            "passed": _passed(r["score"], r["total"]),
            "submitted_at": r["submitted_at"],
            "cert_id": r["cert_id"],
        }
        for r in rows
    ]


@router.get("/leaderboard")
def leaderboard(exam_title: str = ""):
    conn = get_db()
    q = "SELECT student_name, score, total FROM practical_attempts WHERE total > 0"
    args = []
    if exam_title:
        q += " AND exam_title = ?"
        args.append(exam_title)
    rows = conn.execute(q, args).fetchall()
    conn.close()
    best = {}
    for r in rows:
        key = r["student_name"].strip().lower()
        pct = r["score"] / r["total"]
        b = best.setdefault(key, {"name": r["student_name"].strip().split(" ")[0], "best": 0.0, "taken": 0})
        b["best"] = max(b["best"], pct)
        b["taken"] += 1
    ranked = sorted(best.values(), key=lambda b: (-b["best"], b["taken"]))
    return [
        {"rank": i + 1, "name": b["name"], "best_percent": round(b["best"] * 100), "exams_taken": b["taken"]}
        for i, b in enumerate(ranked[:20])
    ]


@router.get("/exam-titles")
def exam_titles():
    return [{"kind": k, "title": c["title"]} for k, c in EXAMS.items()]


@router.get("/assignments/mine")
def my_assignments(student: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM assignments WHERE student_name = '*' OR lower(student_name) = lower(?) ORDER BY id DESC",
        (student.strip(),),
    ).fetchall()
    out = []
    for r in rows:
        done = conn.execute(
            "SELECT 1 FROM practical_attempts WHERE lower(student_name) = lower(?) AND exam_title = ? "
            "AND submitted_at >= ? LIMIT 1",
            (student.strip(), _title(r["exam_kind"]), r["created_at"]),
        ).fetchone()
        out.append(
            {
                "id": r["id"],
                "exam_kind": r["exam_kind"],
                "exam_title": _title(r["exam_kind"]),
                "due_date": r["due_date"],
                "done": bool(done),
            }
        )
    conn.close()
    return out


# ---------------------------------------------------------------- examiner side
@router.get("/class/overview")
def class_overview(_=Depends(require_examiner)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM practical_attempts ORDER BY id DESC").fetchall()
    students = _student_names(conn)
    conn.close()

    results = [
        {
            "attempt_id": r["id"],
            "student": r["student_name"],
            "exam_title": r["exam_title"],
            "score": r["score"],
            "total": r["total"],
            "percent": round(100 * r["score"] / r["total"]) if r["total"] else 0,
            "passed": _passed(r["score"], r["total"]),
            "submitted_at": r["submitted_at"],
        }
        for r in rows
    ]
    per_student = []
    for name in students:
        mine = [r for r in rows if r["student_name"].lower() == name.lower()]
        per_student.append(
            {
                "student": name,
                "attempts": len(mine),
                "best_percent": max((round(100 * r["score"] / r["total"]) for r in mine if r["total"]), default=None),
                "last": mine[0]["submitted_at"] if mine else None,
                "weak": _weak(mine, 3),
            }
        )
    return {
        "stats": {
            "attempts": len(results),
            "students": len(students),
            "average_percent": round(sum(r["percent"] for r in results) / len(results)) if results else None,
            "pass_rate": round(100 * sum(1 for r in results if r["passed"]) / len(results)) if results else None,
        },
        "results": results,
        "students": per_student,
        "class_weak": _weak(rows, 8),
        "pass_mark_percent": round(PASS_MARK * 100),
    }


class AssignBody(BaseModel):
    exam_kind: str
    student_name: str = "*"
    due_date: str | None = None


@router.get("/assignments")
def list_assignments(_=Depends(require_examiner)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM assignments ORDER BY id DESC").fetchall()
    students = _student_names(conn)
    out = []
    for r in rows:
        targets = students if r["student_name"] == "*" else [r["student_name"]]
        done = 0
        for s in targets:
            if conn.execute(
                "SELECT 1 FROM practical_attempts WHERE lower(student_name) = lower(?) AND exam_title = ? "
                "AND submitted_at >= ? LIMIT 1",
                (s, _title(r["exam_kind"]), r["created_at"]),
            ).fetchone():
                done += 1
        out.append(
            {
                "id": r["id"],
                "exam_title": _title(r["exam_kind"]),
                "student": "Whole class" if r["student_name"] == "*" else r["student_name"],
                "due_date": r["due_date"],
                "done": done,
                "of": len(targets),
            }
        )
    conn.close()
    return out


@router.post("/assignments")
def assign(body: AssignBody, _=Depends(require_examiner)):
    _title(body.exam_kind)
    if body.due_date:
        try:
            date.fromisoformat(body.due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Due date must look like 2026-10-31")
    conn = get_db()
    conn.execute(
        "INSERT INTO assignments (exam_kind, student_name, due_date, created_at) VALUES (?, ?, ?, ?)",
        (body.exam_kind, body.student_name.strip() or "*", body.due_date, datetime.now().isoformat(timespec="seconds")),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/assignments/{assignment_id}")
def unassign(assignment_id: int, _=Depends(require_examiner)):
    conn = get_db()
    conn.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------------------------------------------------------------- certificates
def _cert_for(conn, attempt_id):
    return conn.execute("SELECT * FROM certificates WHERE attempt_id = ?", (attempt_id,)).fetchone()


@router.post("/certificates/{attempt_id}")
def issue_certificate(attempt_id: int):
    conn = get_db()
    existing = _cert_for(conn, attempt_id)
    if existing:
        conn.close()
        return {"cert_id": existing["cert_id"]}
    a = conn.execute("SELECT * FROM practical_attempts WHERE id = ?", (attempt_id,)).fetchone()
    if a is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Attempt not found")
    if not _passed(a["score"], a["total"]):
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"A certificate needs at least {round(PASS_MARK * 100)}% correct.",
        )
    cert_id = "ST-" + secrets.token_hex(4).upper()
    conn.execute(
        "INSERT INTO certificates (cert_id, attempt_id, student_name, exam_title, score, total, issued_on) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (cert_id, attempt_id, a["student_name"], a["exam_title"], a["score"], a["total"], date.today().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"cert_id": cert_id}


@router.get("/certificates/{attempt_id}/pdf")
def certificate_pdf(attempt_id: int):
    conn = get_db()
    c = _cert_for(conn, attempt_id)
    conn.close()
    if c is None:
        raise HTTPException(status_code=404, detail="No certificate for this attempt yet")
    payload = dict(c)

    if CERT_BACKEND == "lambda":
        import boto3  # only needed when the AWS backend is switched on

        fn = os.environ["CERT_LAMBDA_NAME"]
        bucket = os.environ["CERT_BUCKET"]
        lam = boto3.client("lambda")
        res = lam.invoke(FunctionName=fn, Payload=json.dumps(payload).encode())
        key = json.loads(json.loads(res["Payload"].read())["body"])["key"]
        url = boto3.client("s3").generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=600
        )
        return RedirectResponse(url)

    pdf = make_certificate_pdf(
        payload["student_name"], payload["exam_title"], payload["score"], payload["total"],
        payload["issued_on"], payload["cert_id"],
    )
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{payload["cert_id"]}.pdf"'},
    )


@router.get("/certificates/verify/{cert_id}")
def verify(cert_id: str):
    conn = get_db()
    c = conn.execute("SELECT * FROM certificates WHERE cert_id = ?", (cert_id.strip().upper(),)).fetchone()
    conn.close()
    if c is None:
        return {"valid": False}
    return {"valid": True, "name": c["student_name"], "exam_title": c["exam_title"],
            "score": c["score"], "total": c["total"], "issued_on": c["issued_on"]}
