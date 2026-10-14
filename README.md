# Sign Talk

Indian Sign Language learning, practice and practical-exam web app.
React + Vite frontend (`frontend/`), FastAPI + SQLite backend (`backend/`), and our own hand-sign
recognition model (MediaPipe hand landmarks + scikit-learn, in `ml/`).

## Run it (no internet or cloud account needed)

```powershell
# backend
venv\Scripts\activate
cd backend
uvicorn main:app --reload

# frontend (second window)
cd frontend
npm install
npm run dev
```

## Optional AWS

**The app runs fully offline. AWS is never required.** Every feature below is off by default.
It adds backup and durability around the app; it does not run the app.
Everything stays in one private S3 bucket (`signtalk-nithya-2026`, region `ap-southeast-2`, all public access blocked).
Scripts use the AWS login already set up on the computer (`aws configure`); no keys are stored in the repo.
They need `pip install boto3`, which is deliberately not in `requirements.txt`, because the app does not need it.

| Feature | How to use it | Why |
|---|---|---|
| Model sharing | `python scripts/models_s3.py push` / `pull` / `list` | Trained models are git-ignored; this moves them between machines. Stored under `models/sklearn-<version>/`, because a model only loads on the scikit-learn version that trained it. |
| Model rollback | `python scripts/models_s3.py versions`, then `restore-version model.joblib 2` | Bucket versioning keeps the previous model whenever a new one is pushed, so a bad retrain can be undone. |
| Dataset backup | `python scripts/dataset_s3.py push` / `pull` / `list` | Dated snapshots of the hand-landmark training data (`datasets/landmarks/YYYY-MM-DD/`). Only landmark numbers, never video or faces. A `manifest.json` holds the SHA-256 of every file; `pull` verifies each one. |
| Database backup | `python scripts/db_s3.py backup` / `list` / `restore` | Timestamped copies of `backend/signtalk.db` under `backups/db/`. Restore checks the copy's integrity and keeps the old database as `signtalk.db.before-restore`. |
| Certificate PDFs on Lambda | `CERT_BACKEND=lambda` (default `local`) | See [aws/README.md](aws/README.md). |
| Certificate email (Amazon SES) | `EMAIL_BACKEND=ses` and `EMAIL_FROM=<verified address>` (default `none`) | After a pass, emails the student their certificate PDF. Runs in the background; a failed email never affects the exam. Optional `SIGNTALK_PUBLIC_URL` adds a download link. |

### Keeping cost near zero

Lifecycle rules ([aws/lifecycle.json](aws/lifecycle.json)) clean up automatically:

- `certificates/` and `backups/db/`: deleted after 30 days.
- Every folder: old (replaced) versions deleted after 30 days; unfinished uploads removed after 7 days.
- Current files under `models/` and `datasets/` are never expired.

Total storage stays well under 100 MB.

### SES limits

The SES account is in sandbox mode: it can only send **to** verified addresses, up to 200 emails a day.
That is enough for a demo (register a student with the verified address). Emailing every student would need
SES production access, which we have not requested.

### Turning AWS features off again

```powershell
# remove lifecycle rules, stop keeping old versions
aws s3api delete-bucket-lifecycle --bucket signtalk-nithya-2026 --region ap-southeast-2
aws s3api put-bucket-versioning --bucket signtalk-nithya-2026 --versioning-configuration Status=Suspended --region ap-southeast-2
# remove the SES sender
aws sesv2 delete-email-identity --email-identity nithyashree.coding@gmail.com --region ap-southeast-2
```

For the app itself, just leave `CERT_BACKEND` and `EMAIL_BACKEND` unset.
