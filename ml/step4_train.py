import csv
import os

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "landmarks.csv")

labels, rows = [], []
with open(CSV_PATH, newline="") as f:
    reader = csv.reader(f)
    next(reader)                                   # skip header
    for r in reader:
        if r:
            labels.append(r[0])
            rows.append([float(v) for v in r[1:]])

y = np.array(labels)
X = np.array(rows).reshape(len(rows), 21, 3)[:, :, :2].reshape(len(rows), 42)   # x, y only

classes = sorted(set(y))
print("Samples per label:")
for c in classes:
    print(f"  {c:6s} {(y == c).sum()}")

# 5 chronological blocks per label
block = np.zeros(len(y), dtype=int)
for c in classes:
    idx = np.where(y == c)[0]
    block[idx] = (np.arange(len(idx)) * 5) // len(idx)

true_all, pred_all = [], []
for b in range(5):
    tr, te = block != b, block == b
    m =RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")
    m.fit(X[tr], y[tr])
    true_all += list(y[te])
    pred_all += list(m.predict(X[te]))
true_all, pred_all = np.array(true_all), np.array(pred_all)

print("\nHonest test (each block predicted by a model that never saw it)")
print(f"Overall accuracy: {(true_all == pred_all).mean():.3f}\n")

print("Recall per sign:")
for c in classes:
    print(f"  {c:6s} {(pred_all[true_all == c] == c).mean():.2f}")

print("\nConfusion matrix (rows = true sign, columns = predicted):")
print("        " + " ".join(f"{c:>6s}" for c in classes))
for t in classes:
    counts = [int(((true_all == t) & (pred_all == p)).sum()) for p in classes]
    print(f"{t:>6s}  " + " ".join(f"{n:6d}" for n in counts))

final = RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")
final.fit(X, y)
joblib.dump(final, os.path.join(HERE, "model.joblib"))
print("\nSaved ml/model.joblib")