import numpy as np

TIPS = [4, 8, 12, 16, 20]
MCPS = [2, 5, 9, 13, 17]


def extract_features(hand_landmarks):
    """Turn 21 MediaPipe landmarks into 63 position- and size-independent numbers."""
    pts = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark])  # shape (21, 3)

    pts = pts - pts[0]                      # wrist (landmark 0) becomes the origin

    # hand size = distance from wrist to middle-finger knuckle (landmark 9)
    size = np.linalg.norm(pts[9])
    if size == 0:
        return None
    pts = pts / size

    return pts.flatten()                    # 21 points x 3 values = 63 numbers


def xy_only(f):
    """Drop the noisy z values: 63 numbers -> 42 numbers (x, y of 21 points)."""
    return np.asarray(f).reshape(21, 3)[:, :2].flatten()


def _angle(a, b, c):
    """Bend at point b between a-b and c-b, scaled to 0..1 (2D)."""
    v1, v2 = a - b, c - b
    n = np.linalg.norm(v1) * np.linalg.norm(v2)
    if n == 0:
        return 0.0
    return float(np.arccos(np.clip(np.dot(v1, v2) / n, -1.0, 1.0)) / np.pi)


def extended_features(f):
    """42 x,y numbers + fingertip distances + finger bend angles = 72 numbers."""
    p = np.asarray(f).reshape(21, 3)[:, :2]
    feats = list(p.flatten())

    # distances between every pair of fingertips (10)
    for i in range(5):
        for j in range(i + 1, 5):
            feats.append(np.linalg.norm(p[TIPS[i]] - p[TIPS[j]]))

    # each fingertip to the wrist and to its own knuckle (10)
    for t, m in zip(TIPS, MCPS):
        feats.append(np.linalg.norm(p[t] - p[0]))
        feats.append(np.linalg.norm(p[t] - p[m]))

    # bend at two joints of each of the 4 fingers, and 2 joints of the thumb (10)
    for base in (5, 9, 13, 17):
        feats.append(_angle(p[base], p[base + 1], p[base + 2]))
        feats.append(_angle(p[base + 1], p[base + 2], p[base + 3]))
    feats.append(_angle(p[1], p[2], p[3]))
    feats.append(_angle(p[2], p[3], p[4]))

    return np.array(feats)