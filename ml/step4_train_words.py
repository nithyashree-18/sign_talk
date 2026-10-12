import csv
import os

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "clips.csv")
MODEL_PATH = os.path.join(HERE, "model_words.joblib")

labels, sessions, rows = [], [], []
with open(CSV_PATH, newline="") as fh:
    reader = csv.reader(fh)
    next(reader)
    for r in reader:
        if r:
            labels.append(r[0])
            sessions.append(int(r[1]))
            rows.append([float(v) for v in r[2:]])

y, s, X = np.array(labels), np.array(sessions), np.array(rows)
classes = sorted(set(y))
short = lambda c: c.replace("word_", "")
if len(classes) < 2:
    raise SystemExit("Need clips for at least one word and for 'none'.")

print("Clips per label:")
for c in classes:
    n = (y == c).sum()
    print(f"  {short(c):12s} {n}{'   <-- record more' if n < 30 else ''}")


def new_model():
    return RandomForestClassifier(n_estimators=300, random_state=42, class_weight="balanced")


passes = sorted(set(s))
if len(passes) >= 2:
    group = s.copy()
    print(f"\nHonest test: leave one pass out (passes {passes})")
else:
    group = np.zeros(len(y), dtype=int)
    for c in classes:
        idx = np.where(y == c)[0]
        group[idx] = (np.arange(len(idx)) * 5) // len(idx)
    print("\nHonest test: 5 chronological blocks (only one pass found)")

true_all, pred_all = [], []
for g in sorted(set(group)):
    tr, te = group != g, group == g
    m = new_model().fit(X[tr], y[tr])
    true_all += list(y[te])
    pred_all += list(m.predict(X[te]))
true_all, pred_all = np.array(true_all), np.array(pred_all)

print(f"Overall accuracy: {(true_all == pred_all).mean():.3f}\n")
print("Recall per word:")
for c in classes:
    mask = true_all == c
    r = (pred_all[mask] == c).mean()
    print(f"  {short(c):12s} {r:.2f}{'   <-- weak' if r < 0.80 else ''}")

print("\nConfusion matrix (rows = true, columns = predicted):")
print(" " * 14 + " ".join(f"{short(c)[:7]:>7s}" for c in classes))
for t in classes:
    counts = [int(((true_all == t) & (pred_all == p)).sum()) for p in classes]
    print(f"{short(t)[:12]:12s}  " + " ".join(f"{n:7d}" for n in counts))

final = new_model().fit(X, y)
joblib.dump({"model": final, "mode": "clip"}, MODEL_PATH)
print("\nSaved ml/model_words.joblib")
