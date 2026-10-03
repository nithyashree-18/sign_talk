import csv
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(HERE, "data", "landmarks.csv")
shutil.copy(path, os.path.join(HERE, "data", "landmarks_backup.csv"))   # safety copy

with open(path, newline="") as f:
    rows = list(csv.reader(f))
header, body = rows[0], [r for r in rows[1:] if r]
kept = [r for r in body if r[0] != "none"]

with open(path, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(header)
    w.writerows(kept)
print(f"Removed {len(body) - len(kept)} 'none' rows. Kept {len(kept)}. Backup saved.")