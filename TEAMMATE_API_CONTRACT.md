# Sign Talk: agreed API for exam-side features (items 7, 8, 9)

Owner: teammate (backend/routes/auth.py, examiner.py, exam_mgmt.py and her pages).
The student-side pages (mine) call these endpoints. Until they exist the pages just hide the section.
Rule for every endpoint: the backend checks the caller's role. Hiding a button in React is not security.

Shared key everywhere: sign `label` (e.g. `one`, `letter_a`, `word_hello`).

## 7. Student: leaderboard and exam history
| Method | Path | Who | Returns |
|---|---|---|---|
| GET | /api/exams/history | student (own rows only) | `[{attempt_id, exam_title, kind, score, total, passed, taken_at}]` |
| GET | /api/leaderboard?exam_id= | any logged-in student | `[{rank, name, best_score, exams_taken}]`, top 20 + the caller's own row |

Leaderboard shows first names only, no emails.

## 8. Examiner: class results, weak signs, assignments
| Method | Path | Who | Returns / body |
|---|---|---|---|
| GET | /api/examiner/results?exam_id= | examiner | one row per student: `{student, score, total, passed, taken_at}` plus class average and pass rate |
| GET | /api/examiner/students/{id}/weak-signs | examiner | `[{label, correct, attempts}]` sorted by lowest accuracy |
| GET | /api/examiner/class/weak-signs | examiner | same, summed over the class |
| POST | /api/examiner/assign | examiner | `{exam_id, student_ids: [], due_date}` |
| GET | /api/exams/assigned | student | exams assigned to the caller, with due date and status |

Needs one new table, or one new column set, to record each question result:
`exam_answers(attempt_id, label, correct, confidence)`. My exam code (`routes/exam.py`) already knows the
label and result of every question, so I will write these rows from there. Tell me the table name you prefer.

## 9. Certificate after a passed exam (Lambda + S3)
Flow:
1. Student passes (score >= pass mark). Frontend calls `POST /api/certificates/{attempt_id}`.
2. Backend checks the attempt belongs to the caller and is passed, then invokes a Lambda function
   (`boto3.client("lambda").invoke`) with `{name, exam_title, score, total, date, certificate_id}`.
3. Lambda draws a PDF, writes it to a private S3 bucket at `certificates/{certificate_id}.pdf`,
   returns the key.
4. `GET /api/certificates/{attempt_id}` returns a presigned S3 URL that expires in 10 minutes.
5. Certificate has a short `certificate_id`; `GET /api/certificates/verify/{certificate_id}` returns
   `{valid, name, exam_title, date}` so anyone can check it.

Local fallback so the demo never depends on the network: env var `CERT_BACKEND=local` makes the same endpoint
build the PDF in-process (reportlab) and serve it from a local folder. `CERT_BACKEND=lambda` uses AWS.

## Security fixes to agree on
- Replace plain SHA-256 password hashing with PBKDF2 (`hashlib.pbkdf2_hmac`, 200k+ iterations, random salt). No new package.
- Login should return a signed session token that the backend checks on every examiner endpoint.
