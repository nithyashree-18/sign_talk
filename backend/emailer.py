"""Optional: email a student their certificate after they pass. Off unless EMAIL_BACKEND=ses.

    EMAIL_BACKEND=none   (default) do nothing
    EMAIL_BACKEND=ses    send through Amazon SES in ap-southeast-2
    EMAIL_FROM=...       the verified sender address (required for ses)
    SIGNTALK_PUBLIC_URL  optional, e.g. http://192.168.1.20:8000, to add a download link to the email

SES starts in sandbox mode: both sender and receiver must be verified addresses, 200 emails a day.
Sending runs in the background and never raises, so a failed email can never break the exam or certificate.
"""
import os
import threading
from email.message import EmailMessage

from certificate_pdf import make_certificate_pdf
from db import get_db

EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "none")   # "none" or "ses"
REGION = "ap-southeast-2"


def notify_certificate(cert_id):
    if EMAIL_BACKEND != "ses":
        return
    threading.Thread(target=_send, args=(cert_id,), daemon=True).start()


def _recipient(conn, student_name):
    """The student's email from the users table, only if exactly one student has that name."""
    try:
        rows = conn.execute(
            "SELECT email FROM users WHERE lower(name) = lower(?) AND role != 'examiner'", (student_name.strip(),)
        ).fetchall()
    except Exception:
        return None
    return rows[0]["email"] if len(rows) == 1 else None


def _send(cert_id):
    try:
        conn = get_db()
        c = conn.execute("SELECT * FROM certificates WHERE cert_id = ?", (cert_id,)).fetchone()
        to = _recipient(conn, c["student_name"]) if c else None
        conn.close()
        sender = os.environ.get("EMAIL_FROM")
        if not c or not to or not sender:
            print(f"[email] skipped {cert_id}: " + ("no EMAIL_FROM set" if not sender else "no single matching student email"))
            return

        msg = EmailMessage()
        msg["Subject"] = f"Your Sign Talk certificate: {c['exam_title']}"
        msg["From"] = sender
        msg["To"] = to
        body = (
            f"Hi {c['student_name']},\n\n"
            f"Congratulations on passing {c['exam_title']} with {c['score']}/{c['total']}.\n"
            f"Your certificate is attached. Certificate ID: {c['cert_id']}\n"
        )
        base = os.environ.get("SIGNTALK_PUBLIC_URL", "").rstrip("/")
        if base:
            body += f"Download it again: {base}/api/certificates/{c['attempt_id']}/pdf\n"
        msg.set_content(body + "\nSign Talk")
        pdf = make_certificate_pdf(c["student_name"], c["exam_title"], c["score"], c["total"], c["issued_on"], c["cert_id"])
        msg.add_attachment(pdf, maintype="application", subtype="pdf", filename=f"{c['cert_id']}.pdf")

        import boto3  # only needed when SES is switched on

        boto3.Session(region_name=REGION).client("sesv2").send_email(
            FromEmailAddress=sender, Destination={"ToAddresses": [to]}, Content={"Raw": {"Data": msg.as_bytes()}}
        )
        print(f"[email] sent certificate {cert_id}")
    except Exception as e:  # e.g. recipient not verified in sandbox; shown as-is, never retried
        print(f"[email] could not send {cert_id}: {e}")
