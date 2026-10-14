"""Share the trained model files through the private S3 bucket.

    python scripts/models_s3.py list              what is in the bucket
    python scripts/models_s3.py push --dry-run    show what would be uploaded
    python scripts/models_s3.py push              upload ml/model.joblib and ml/model_letters.joblib
    python scripts/models_s3.py pull              download them into ml/ (skips files you already have)
    python scripts/models_s3.py pull --force      download and replace your local files
    python scripts/models_s3.py versions          every stored copy of each model (needs bucket versioning on)
    python scripts/models_s3.py restore-version model.joblib 2    roll back to copy #2 from the versions list

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


def model_versions(s3, errors, name):
    """Every stored copy of one model, newest first. Needs versioning switched on for the bucket."""
    key = prefix() + name
    try:
        resp = s3.list_object_versions(Bucket=BUCKET, Prefix=key)
    except errors as e:
        fail(e)
    found = [v for v in resp.get("Versions", []) if v["Key"] == key]
    return sorted(found, key=lambda v: v["LastModified"], reverse=True)


def cmd_versions(_):
    errors = aws()[1]
    s3 = client()
    for name in FILES:
        print(f"\n{name}")
        found = model_versions(s3, errors, name)
        if not found:
            print("  nothing stored yet")
        for i, v in enumerate(found, 1):
            tag = "current" if v["IsLatest"] else "old"
            print(f"  #{i}  {tag:<8} {v['LastModified'].astimezone():%Y-%m-%d %H:%M}  {mb(v['Size']):>10}  id {v['VersionId']}")


def cmd_restore_version(args):
    errors = aws()[1]
    s3 = client()
    found = model_versions(s3, errors, args.name)
    pick = [v for i, v in enumerate(found, 1) if args.version in (str(i), v["VersionId"])]
    if not pick:
        sys.exit(f"No version '{args.version}' of {args.name}. Run: python scripts/models_s3.py versions")
    v = pick[0]
    key = prefix() + args.name
    if not v["IsLatest"]:
        try:  # copying an old version on top makes it current again; nothing is deleted
            s3.copy_object(Bucket=BUCKET, Key=key, CopySource={"Bucket": BUCKET, "Key": key, "VersionId": v["VersionId"]})
        except errors as e:
            fail(e)
        print(f"made current  {args.name} from {v['LastModified'].astimezone():%Y-%m-%d %H:%M}  (the replaced one stays as an old version)")
    dest = os.path.join(ML_DIR, args.name)
    try:
        s3.download_file(BUCKET, key, dest + ".part", ExtraArgs={"VersionId": v["VersionId"]})
    except errors as e:
        if os.path.exists(dest + ".part"):
            os.remove(dest + ".part")
        fail(e)
    os.replace(dest + ".part", dest)
    print(f"downloaded    {args.name}  ({mb(os.path.getsize(dest))})  ->  ml/   Restart the backend to load it.")


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
    sub.add_parser("versions").set_defaults(fn=cmd_versions)
    rv = sub.add_parser("restore-version")
    rv.add_argument("name", choices=FILES)
    rv.add_argument("version", help="number from 'versions' (#2 -> 2) or the full version id")
    rv.set_defaults(fn=cmd_restore_version)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()