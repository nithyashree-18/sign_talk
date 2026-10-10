import csv
import os

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

from features import extended_features, xy_only

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "landmarks.csv")
MODEL_PATH = os.path.join(HERE, "model.joblib")

labels, rows = [], []
with open(CSV_PATH, newline="") as f:
    reader = csv.reader(f)
    next(reader)                                   # skip header
    for r in reader:
        if r:
            labels.append(r[0])
            rows.append([float(v) for v in r[1:]])

y = np.array(labels)
raw = np.array(rows)                               # (n, 63)
classes = sorted(set(y))

print("Samples per label:")
for c in classes:
    print(f"  {c:10s} {(y == c).sum()}")

FEATURES = {
    "xy": np.array([xy_only(r) for r in raw]),
    "extended": np.array([extended_features(r) for r in raw]),
}

# 5 chronological blocks per label
block = np.zeros(len(y), dtype=int)
for c in classes:
    idx = np.where(y == c)[0]
    block[idx] = (np.arange(len(idx)) * 5) // len(idx)


def new_model():
    return RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")


def honest_test(X):
    true_all, pred_all = [], []
    for b in range(5):
        tr, te = block != b, block == b
        m = new_model().fit(X[tr], y[tr])
        true_all += list(y[te])
        pred_all += list(m.predict(X[te]))
    return np.array(true_all), np.array(pred_all)


results = {name: honest_test(X) for name, X in FEATURES.items()}
acc = {name: (t == p).mean() for name, (t, p) in results.items()}

print("\nHonest test: each block predicted by a model that never saw it")
print(f"{'sign':10s} {'xy only':>8s} {'extended':>9s}")
for c in classes:
    row = []
    for name in ("xy", "extended"):
        t, p = results[name]
        row.append((p[t == c] == c).mean())
    print(f"{c:10s} {row[0]:8.2f} {row[1]:9.2f}")
print(f"{'OVERALL':10s} {acc['xy']:8.3f} {acc['extended']:9.3f}")

best = max(acc, key=acc.get)
print(f"\nUsing: {best}")

t, p = results[best]
print("\nConfusion matrix (rows = true sign, columns = predicted):")
print(" " * 10 + " ".join(f"{c[:5]:>5s}" for c in classes))
for tc in classes:
    counts = [int(((t == tc) & (p == pc)).sum()) for pc in classes]
    print(f"{tc:10s}" + " ".join(f"{n:5d}" for n in counts))

final = new_model().fit(FEATURES[best], y)
joblib.dump({"model": final, "mode": best}, MODEL_PATH)
print("\nSaved ml/model.joblib")