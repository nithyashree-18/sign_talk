import numpy as np

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
