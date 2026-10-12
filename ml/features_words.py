import numpy as np

STEPS = 10                    # frames kept per clip after resampling
SLOT = 46                     # numbers per hand: flag + 42 shape values + wrist x, y + size
FRAME_DIM = SLOT * 2          # two hand slots per frame
SUMMARY = 8                   # summary numbers per hand slot
CLIP_DIM = STEPS * FRAME_DIM + SUMMARY * 2   # 936 numbers per clip


def _hand_block(h):
    """46 numbers for one hand: present flag, 42 shape values, wrist x, wrist y, hand size."""
    pts = np.array([[lm.x, lm.y] for lm in h.landmark])
    size = float(np.linalg.norm(pts[9] - pts[0]))
    if size < 1e-6:
        return None
    shape = ((pts - pts[0]) / size).flatten()
    return np.concatenate([[1.0], shape, [pts[0][0], pts[0][1], size]])


def frame_vector(result):
    """92 numbers describing one webcam frame, from a MediaPipe Hands result."""
    vec = np.zeros(FRAME_DIM)
    hands = list(result.multi_hand_landmarks or [])
    if not hands:
        return vec
    labels = []
    if result.multi_handedness:
        labels = [c.classification[0].label for c in result.multi_handedness]

    items = []
    for i, h in enumerate(hands[:2]):
        block = _hand_block(h)
        if block is not None:
            items.append((labels[i] if i < len(labels) else "", block))

    if len(items) == 1:
        slot = 1 if items[0][0] == "Right" else 0
        vec[slot * SLOT:(slot + 1) * SLOT] = items[0][1]
    elif len(items) == 2:
        if items[0][0] == items[1][0]:                 # same label twice: order by wrist x
            items.sort(key=lambda it: it[1][43])
        else:
            items.sort(key=lambda it: 0 if it[0] == "Left" else 1)
        vec[0:SLOT] = items[0][1]
        vec[SLOT:2 * SLOT] = items[1][1]
    return vec


def clip_features(frames):
    """A list of 92-number frame vectors in time order -> one fixed-length vector, or None."""
    F = np.asarray(frames, dtype=float)
    if len(F) < 6:
        return None
    seen = (F[:, 0] + F[:, SLOT]) > 0
    if seen.mean() < 0.3:
        return None                                    # hands in view for under a third of the clip

    idx = np.linspace(0, len(F) - 1, STEPS).round().astype(int)
    parts = [F[idx].flatten()]
    for s in range(2):
        b = F[:, s * SLOT:(s + 1) * SLOT]
        on = b[:, 0] > 0
        if on.sum() >= 2:
            wx, wy, size = b[on, 43], b[on, 44], b[on, 45]
            path = np.sum(np.hypot(np.diff(wx), np.diff(wy))) / max(size.mean(), 1e-6)
            finger_motion = np.abs(np.diff(b[on, 1:43], axis=0)).mean()
            summary = [on.mean(), path, wx[-1] - wx[0], wy[-1] - wy[0],
                       wx.std(), wy.std(), size.mean(), finger_motion]
        else:
            summary = [on.mean(), 0, 0, 0, 0, 0, 0, 0]
        parts.append(np.array(summary, dtype=float))
    return np.concatenate(parts)