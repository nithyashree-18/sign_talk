"""Share the trained model files through the private S3 bucket.

    python scripts/models_s3.py list              what is in the bucket
    python scripts/models_s3.py push --dry-run    show what would be uploaded
    python scripts/models_s3.py push              upload ml/model.joblib and ml/model_letters.joblib
    python scripts/models_s3.py pull              download them into ml/ (skips files you already have)
    python scripts/models_s3.py pull --force      download and replace your local files

Uses the AWS login already set up on this computer (aws configure). No keys are stored in this file.
Models only load on the scikit-learn version that trained them, so the version is part of the S3 folder name.
"""
import argparse
import os
import sys
from importlib.metadata import PackageNotFoundError, version

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(ROOT, "ml")
FILES = ["model.joblib", "model_letters.joblib"]
BUCKET = os.environ.get("SIGNTALK_BUCKET", "signtalk-nithya-2026")
REGION = "ap-southeast-2"  # the only region this account may use


def sklearn_version():
    try:
        return version("scikit-learn")
    except PackageNotFoundError:
        sys.exit("scikit-learn is not installed here. Activate the venv first (venv\\Scripts\\activate).")


def prefix():
    return f"models/sklearn-{sklearn_version()}/"


def aws():
    """Import boto3 only when it is needed, with a clear message if it is missing."""
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError:
        sys.exit("boto3 is missing. Run: pip install boto3")
    return boto3, (BotoCoreError, ClientError)


def client():
    boto3, _ = aws()
    return boto3.Session(region_name=REGION).client("s3")


def mb(n):
    return f"{n / 1024 / 1024:.2f} MB"


def fail(err):
    """Show the exact AWS error and stop. Never retry or work around it."""
    print("\nAWS refused this request. Stopping. Exact message:\n")
    print(err)
    sys.exit(1)


def cmd_list(_):
    errors = aws()[1]
    try:
        resp = client().list_objects_v2(Bucket=BUCKET, Prefix="models/")
    except errors as e:
        fail(e)
    items = resp.get("Contents", [])
    if not items:
        print(f"Nothing under s3://{BUCKET}/models/ yet.")
    for o in items:
        print(f"{o['Key']:<60} {mb(o['Size']):>10}  {o['LastModified']:%Y-%m-%d %H:%M}")


def cmd_push(args):
    pre = prefix()
    todo = [(f, os.path.join(ML_DIR, f)) for f in FILES if os.path.exists(os.path.join(ML_DIR, f))]
    missing = [f for f in FILES if not os.path.exists(os.path.join(ML_DIR, f))]
    for f in missing:
        print(f"skip   {f} (not found in ml/; train it first)")
    if not todo:
        sys.exit("No model files to upload.")
    errors = ()
    s3 = None
    if not args.dry_run:
        errors = aws()[1]
        s3 = client()
    for name, path in todo:
        target = f"s3://{BUCKET}/{pre}{name}"
        if args.dry_run:
            print(f"would upload  {path}  ({mb(os.path.getsize(path))})  ->  {target}")
            continue
        try:
            s3.upload_file(path, BUCKET, pre + name)  # private by default; no ACL is set
        except errors as e:
            fail(e)
        print(f"uploaded  {name}  ({mb(os.path.getsize(path))})  ->  {target}")


def cmd_pull(args):
    pre = prefix()
    errors = aws()[1]
    s3 = client()
    for name in FILES:
        dest = os.path.join(ML_DIR, name)
        if os.path.exists(dest) and not args.force:
            print(f"keep      {name} (already in ml/; use --force to replace)")
            continue
        try:
            s3.download_file(BUCKET, pre + name, dest + ".part")
        except errors as e:
            if os.path.exists(dest + ".part"):
                os.remove(dest + ".part")
            fail(e)
        os.replace(dest + ".part", dest)
        print(f"downloaded  {name}  ({mb(os.path.getsize(dest))})  <-  s3://{BUCKET}/{pre}{name}")


def main():
    p = argparse.ArgumentParser(description="Share Sign Talk model files through S3")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    push = sub.add_parser("push")
    push.add_argument("--dry-run", action="store_true")
    push.set_defaults(fn=cmd_push)
    pull = sub.add_parser("pull")
    pull.add_argument("--force", action="store_true")
    pull.set_defaults(fn=cmd_pull)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()