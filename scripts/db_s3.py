"""Back up the SQLite database (backend/signtalk.db) to the private S3 bucket.

    python scripts/db_s3.py backup                                  upload a copy to backups/db/signtalk-YYYYMMDD-HHMMSS.db
    python scripts/db_s3.py list                                    backups in the bucket, newest last
    python scripts/db_s3.py restore                                 replace the local database with the newest backup
    python scripts/db_s3.py restore --name signtalk-20261014-170000.db   restore a particular backup

The copy is taken with SQLite's own backup feature, so it is safe while the backend is running.
Stop the backend before a restore. The current database is kept as signtalk.db.before-restore.
"""
import argparse
import os
import sqlite3
import sys
import tempfile
from datetime import datetime

from models_s3 import BUCKET, ROOT, aws, client, fail, mb

DB_PATH = os.path.join(ROOT, "backend", "signtalk.db")
PREFIX = "backups/db/"


def backups(s3, errors):
    try:
        items = []
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix=PREFIX):
            items += [o for o in page.get("Contents", []) if o["Key"].endswith(".db")]
    except errors as e:
        fail(e)
    return sorted(items, key=lambda o: o["Key"])  # names hold the time, so name order is time order


def cmd_list(_):
    errors = aws()[1]
    items = backups(client(), errors)
    if not items:
        print(f"No backups under s3://{BUCKET}/{PREFIX} yet.")
    for o in items:
        print(f"{o['Key'][len(PREFIX):]:<34} {mb(o['Size']):>10}  {o['LastModified'].astimezone():%Y-%m-%d %H:%M}")


def cmd_backup(_):
    if not os.path.exists(DB_PATH):
        sys.exit(f"No database at {DB_PATH}. Start the backend once to create it.")
    errors = aws()[1]
    s3 = client()
    name = f"signtalk-{datetime.now():%Y%m%d-%H%M%S}.db"
    tmp = os.path.join(tempfile.mkdtemp(), name)
    src, dst = sqlite3.connect(DB_PATH), sqlite3.connect(tmp)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    try:
        s3.upload_file(tmp, BUCKET, PREFIX + name)  # private by default; no ACL is set
    except errors as e:
        fail(e)
    finally:
        size = os.path.getsize(tmp)
        os.remove(tmp)
    print(f"uploaded  {name}  ({mb(size)})  ->  s3://{BUCKET}/{PREFIX}{name}")


def cmd_restore(args):
    errors = aws()[1]
    s3 = client()
    names = [o["Key"][len(PREFIX):] for o in backups(s3, errors)]
    if not names:
        sys.exit("No backups in the bucket yet. Run backup first.")
    name = args.name or names[-1]
    if name not in names:
        sys.exit(f"No backup called {name}. Run list to see the names.")
    part = DB_PATH + ".part"
    try:
        s3.download_file(BUCKET, PREFIX + name, part)
    except errors as e:
        if os.path.exists(part):
            os.remove(part)
        fail(e)
    conn = sqlite3.connect(part)
    ok = conn.execute("PRAGMA integrity_check").fetchone()[0]
    conn.close()
    if ok != "ok":
        os.remove(part)
        sys.exit(f"The downloaded backup failed SQLite's integrity check ({ok}). Local database left untouched.")
    if os.path.exists(DB_PATH):
        os.replace(DB_PATH, DB_PATH + ".before-restore")
        print("kept      old database as backend/signtalk.db.before-restore")
    os.replace(part, DB_PATH)
    print(f"restored  {name}  ({mb(os.path.getsize(DB_PATH))})  ->  backend/signtalk.db")


def main():
    p = argparse.ArgumentParser(description="Back up the Sign Talk database to S3")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("backup").set_defaults(fn=cmd_backup)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    restore = sub.add_parser("restore")
    restore.add_argument("--name", help="backup file name from list (default: newest)")
    restore.set_defaults(fn=cmd_restore)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
