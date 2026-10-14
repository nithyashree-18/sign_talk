import base64
import os
import sys
import threading

import cv2
import joblib
import mediapipe as mp
import numpy as np

# reuse the exact feature code from the ml folder
ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")
sys.path.insert(0, ML_DIR)
from features import extended_features, extract_features, xy_only  # noqa: E402
from features_two import two_hand_features  # noqa: E402

PATHS = {
    "numbers": os.path.join(ML_DIR, "model.joblib"),
    "letters": os.path.join(ML_DIR, "model_letters.joblib"),
}
KINDS = list(PATHS)


def landmark_points(found):
    """21 (x, y) points per hand, as 0..1 fractions of the image, for drawing the skeleton."""
    return [
        [[round(float(p.x), 4), round(float(p.y), 4)] for p in hand.landmark] for hand in found
    ]


class Recognizer:
    def __init__(self, kind):
        self.kind = kind
        bundle = joblib.load(PATHS[kind])
        if isinstance(bundle, dict):                 # model + feature mode
            self.model, self.mode = bundle["model"], bundle.get("mode", "xy")
        else:                                        # old format: plain classifier
            self.model, self.mode = bundle, "xy"

        # same MediaPipe settings as the matching recording script
        if kind == "letters":
            self.hands = mp.solutions.hands.Hands(
                max_num_hands=2, min_detection_confidence=0.6, min_tracking_confidence=0.5
            )
        else:
            self.hands = mp.solutions.hands.Hands(
                max_num_hands=1, min_detection_confidence=0.7, min_tracking_confidence=0.5
            )
        self.lock = threading.Lock()   # MediaPipe is not thread-safe

    @property
    def classes(self):
        return [str(c) for c in self.model.classes_]

    def predict(self, data_url):
        raw = base64.b64decode(data_url.split(",", 1)[-1])
        frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode the image")

        # The browser already mirrors the frame (same as our recordings),
        # so we must NOT flip it again here.
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        with self.lock:
            result = self.hands.process(rgb)

        found = list(result.multi_hand_landmarks or [])
        nothing = {
            "hand_detected": False, "hands": 0, "label": None, "confidence": 0.0, "landmarks": [],
        }
        if not found:
            return nothing
        points = landmark_points(found)

        if self.kind == "letters":
            vec = two_hand_features(found)
        else:
            feats = extract_features(found[0])
            if feats is None:
                return nothing
            vec = extended_features(feats) if self.mode == "extended" else xy_only(feats)
        if vec is None:
            return {**nothing, "landmarks": points}

        probs = self.model.predict_proba([vec])[0]
        best = int(probs.argmax())
        return {
            "hand_detected": True,
            "hands": len(found),
            "label": str(self.model.classes_[best]),
            "confidence": float(probs[best]),
            "landmarks": points,
        }


_state = {}            # kind -> (recognizer, file modified time)
_load_lock = threading.Lock()


def get_recognizer(kind="numbers"):
    """Load a model on first use, and reload it whenever its file changes."""
    path = PATHS.get(kind)
    if path is None or not os.path.exists(path):
        return None
    mtime = os.path.getmtime(path)
    with _load_lock:
        current = _state.get(kind)
        if current is None or current[1] != mtime:
            if current is not None:
                current[0].hands.close()
            _state[kind] = (Recognizer(kind), mtime)
        return _state[kind][0]
