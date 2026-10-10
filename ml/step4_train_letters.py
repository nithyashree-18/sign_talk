import csv
import os
from collections import Counter

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "letters.csv")
MODEL_PATH = os.path.join(HERE, "model_letters.joblib")

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
short = lambda c: c.replace("letter_", "")

print("Samples per label:")
for i in range(0, len(classes), 9):
    print("  " + "  ".join(f"{short(c)}:{(y == c).sum()}" for c in classes[i:i + 9]))


def new_model():
    return RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")


# Honest test: train on two passes, test on the pass the model never saw.
# Rows recorded manually (session 0) are always used for training only.
passes = sorted(set(s[s > 0]))
if len(passes) >= 2:
    group = s.copy()
    group[s == 0] = -1
    print(f"\nHonest test: leave one pass out (passes {passes})")
else:
    group = np.full(len(y), -1)
    for c in classes:
        idx = np.where(y == c)[0]
        group[idx] = (np.arange(len(idx)) * 5) // len(idx)
    print("\nHonest test: 5 chronological blocks (fewer than 2 passes found)")

true_all, pred_all = [], []
for g in sorted(set(group[group >= 0])):
    tr, te = group != g, group == g
    m = new_model().fit(X[tr], y[tr])
    true_all += list(y[te])
    pred_all += list(m.predict(X[te]))
true_all, pred_all = np.array(true_all), np.array(pred_all)

print(f"Overall accuracy: {(true_all == pred_all).mean():.3f}\n")
print("Recall per letter (weak ones marked):")
line = []
for c in classes:
    mask = true_all == c
    r = (pred_all[mask] == c).mean() if mask.any() else float("nan")
    line.append(f"{short(c):>5s} {r:.2f}{' <--' if r < 0.80 else '    '}")
    if len(line) == 3:
        print("  " + "   ".join(line))
        line = []
if line:
    print("  " + "   ".join(line))

print("\nMost common mix-ups (true -> predicted : count):")
pairs = Counter((t, p) for t, p in zip(true_all, pred_all) if t != p)
for (t, p), count in pairs.most_common(12):
    print(f"  {short(t):>5s} -> {short(p):<5s} {count}")

final = new_model().fit(X, y)
joblib.dump({"model": final, "mode": "two_hand"}, MODEL_PATH)
print("\nSaved ml/model_letters.joblib")