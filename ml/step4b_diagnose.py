import os

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
df = pd.read_csv(os.path.join(HERE, "data", "landmarks.csv"))

all_cols = [c for c in df.columns if c != "label"]
xy_cols = [c for i, c in enumerate(all_cols) if i % 3 != 2]   # drop the z values

# split each label's recording into 5 chronological blocks (0..4)
df["block"] = 0
for label, g in df.groupby("label"):
    n = len(g)
    df.loc[g.index, "block"] = (np.arange(n) * 5) // n

# 1) random split: optimistic, because neighbouring frames look almost identical
tr, te = train_test_split(df, test_size=0.2, random_state=42, stratify=df["label"])
m = RandomForestClassifier(n_estimators=200, random_state=42).fit(tr[all_cols], tr["label"])
print(f"Random-split accuracy (optimistic): {m.score(te[all_cols], te['label']):.3f}\n")

# 2) leave-one-block-out: train on 4 blocks, test on the unseen 5th
def evaluate(cols, name):
    print(f"--- {name} ---")
    print("block  none_recall  one_recall")
    for b in range(5):
        train, test = df[df.block != b], df[df.block == b]
        model = RandomForestClassifier(n_estimators=200, random_state=42)
        model.fit(train[cols], train["label"])
        pred = model.predict(test[cols])
        rec = {}
        for label in ["none", "one"]:
            mask = (test["label"] == label).values
            rec[label] = (pred[mask] == label).mean()
        print(f"  {b}      {rec['none']:.2f}         {rec['one']:.2f}")
    print()

evaluate(all_cols, "x, y, z features (63)")
evaluate(xy_cols, "x, y features only (42)")