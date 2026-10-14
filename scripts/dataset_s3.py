"""Back up the hand-landmark training data (ml/data/*.csv, *.npy) to the private S3 bucket.

    python scripts/dataset_s3.py list                       dated snapshots in the bucket
    python scripts/dataset_s3.py push --dry-run             show what would be uploaded
    python scripts/dataset_s3.py push                       upload today's snapshot to datasets/landmarks/YYYY-MM-DD/
    python scripts/dataset_s3.py pull                       download the newest snapshot into ml/data/ (skips files you already have)
    python scripts/dataset_s3.py pull --date 2026-10-14     download a particular snapshot
    python scripts/dataset_s3.py pull --force               download and replace your local files

Only landmark numbers are uploaded, never video or pictures of faces.
Each snapshot has a manifest.json (name, size, SHA-256 of every file); pull checks every file against it.
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import date, datetime, timezone

from models_s3 import BUCKET, ROOT, aws, client, fail, mb

DATA_DIR = os.path.join(ROOT, "ml", "data")
BASE = "datasets/landmarks/"
KINDS = (".csv", ".npy")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def local_files():
    names = sorted(n for n in os.listdir(DATA_DIR) if n.lower().endswith(KINDS))
    return [(n, os.path.join(DATA_DIR, n)) for n in names if os.path.isfile(os.path.join(DATA_DIR, n))]


def snapshots(s3, errors):
    """Dates that have a manifest.json (a snapshot only counts once its manifest is uploaded)."""
    found = []
    try:
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix=BASE):
            for o in page.get("Contents", []):
                if o["Key"].endswith("/manifest.json"):
                    found.append(o["Key"][len(BASE):].split("/")[0])
    except errors as e:
        fail(e)
    return sorted(found)


def read_manifest(s3, errors, day):
    try:
        body = s3.get_object(Bucket=BUCKET, Key=f"{BASE}{day}/manifest.json")["Body"].read()
    except errors as e:
        fail(e)
    return json.loads(body)


def cmd_list(_):
    errors = aws()[1]
    s3 = client()
    days = snapshots(s3, errors)
    if not days:
        print(f"No dataset snapshots under s3://{BUCKET}/{BASE} yet.")
    for day in days:
        m = read_manifest(s3, errors, day)
        total = sum(f["size"] for f in m["files"])
        print(f"{day}   {len(m['files'])} files   {mb(total):>10}   " + ", ".join(f["name"] for f in m["files"]))


def cmd_push(args):
    files = local_files()
    if not files:
        sys.exit(f"No .csv or .npy files in {DATA_DIR}")
    day = date.today().isoformat()
    pre = f"{BASE}{day}/"
    manifest = {
        "created_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "files": [{"name": n, "size": os.path.getsize(p), "sha256": sha256(p)} for n, p in files],
    }
    if args.dry_run:
        for f in manifest["files"]:
            print(f"would upload  {f['name']:<24} {mb(f['size']):>10}  sha256 {f['sha256'][:12]}...  ->  s3://{BUCKET}/{pre}")
        print(f"would upload  manifest.json  ->  s3://{BUCKET}/{pre}manifest.json")
        return
    errors = aws()[1]
    s3 = client()
    if day in snapshots(s3, errors) and not args.force:
        sys.exit(f"A snapshot for {day} already exists. Use --force to replace it.")
    for n, p in files:
        try:
            s3.upload_file(p, BUCKET, pre + n)  # private by default; no ACL is set
        except errors as e:
            fail(e)
        print(f"uploaded  {n:<24} {mb(os.path.getsize(p)):>10}")
    try:  # manifest last, so a half-finished push never looks like a snapshot
        s3.put_object(Bucket=BUCKET, Key=pre + "manifest.json",
                      Body=json.dumps(manifest, indent=2).encode(), ContentType="application/json")
    except errors as e:
        fail(e)
    print(f"uploaded  manifest.json  ->  s3://{BUCKET}/{pre}")


def cmd_pull(args):
    errors = aws()[1]
    s3 = client()
    days = snapshots(s3, errors)
    if not days:
        sys.exit("No dataset snapshots in the bucket yet. Run push first.")
    day = args.date or days[-1]
    if day not in days:
        sys.exit(f"No snapshot for {day}. Available: {', '.join(days)}")
    os.makedirs(DATA_DIR, exist_ok=True)
    bad = 0
    for f in read_manifest(s3, errors, day)["files"]:
        dest = os.path.join(DATA_DIR, f["name"])
        if os.path.exists(dest) and not args.force:
            same = sha256(dest) == f["sha256"]
            print(f"keep      {f['name']} ({'identical to backup' if same else 'differs from backup; use --force to replace'})")
            continue
        try:
            s3.download_file(BUCKET, f"{BASE}{day}/{f['name']}", dest + ".part")
        except errors as e:
            if os.path.exists(dest + ".part"):
                os.remove(dest + ".part")
            fail(e)
        if sha256(dest + ".part") != f["sha256"]:
            os.remove(dest + ".part")
            print(f"FAILED    {f['name']} (checksum does not match the manifest; local file left untouched)")
            bad += 1
            continue
        os.replace(dest + ".part", dest)
        print(f"verified  {f['name']:<24} {mb(f['size']):>10}  <-  {day}")
    if bad:
        sys.exit(f"{bad} file(s) failed the checksum.")


def main():
    p = argparse.ArgumentParser(description="Back up Sign Talk landmark data to S3")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    push = sub.add_parser("push")
    push.add_argument("--dry-run", action="store_true")
    push.add_argument("--force", action="store_true", help="replace today's snapshot")
    push.set_defaults(fn=cmd_push)
    pull = sub.add_parser("pull")
    pull.add_argument("--date", help="YYYY-MM-DD (default: newest)")
    pull.add_argument("--force", action="store_true")
    pull.set_defaults(fn=cmd_pull)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
