import numpy as np

from features import extended_features, extract_features

TIPS = [4, 8, 12, 16, 20]
PER_HAND = 72                      # extended_features() length for one hand
REL = 25 + 3 + 5 + 5               # relations between the two hands
TOTAL = PER_HAND * 2 + REL + 1     # 183 numbers, the last one is the "two hands" flag


def two_hand_features(hands):
    """hands: a list of 1 or 2 MediaPipe hands. Returns 183 numbers, or None."""
    if not hands:
        return None
    # the hand on the left of the image is always first, so we do not depend
    # on MediaPipe's left/right label (it flips on a mirrored image)
    hands = sorted(hands[:2], key=lambda h: h.landmark[0].x)

    blocks, raws, sizes = [], [], []
    for h in hands:
        f = extract_features(h)
        if f is None:
            return None
        blocks.append(extended_features(f))
        raw = np.array([[lm.x, lm.y] for lm in h.landmark])
        raws.append(raw)
        sizes.append(np.linalg.norm(raw[9] - raw[0]))

    if len(hands) == 2:
        a, b = raws
        s = (sizes[0] + sizes[1]) / 2
        if s == 0:
            return None
        rel = []
        for i in TIPS:                                  # every fingertip of A to every fingertip of B
            for j in TIPS:
                rel.append(np.linalg.norm(a[i] - b[j]) / s)
        d = (b[0] - a[0]) / s                           # where hand B is, relative to hand A
        rel += [d[0], d[1], np.linalg.norm(d)]
        for i in TIPS:                                  # A's fingertips to B's wrist
            rel.append(np.linalg.norm(a[i] - b[0]) / s)
        for j in TIPS:                                  # B's fingertips to A's wrist
            rel.append(np.linalg.norm(b[j] - a[0]) / s)
        second, flag = blocks[1], 1.0
    else:
        rel, second, flag = [0.0] * REL, np.zeros(PER_HAND), 0.0

    return np.concatenate([blocks[0], second, rel, [flag]])