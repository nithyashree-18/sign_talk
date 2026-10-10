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

MODEL_PATH = os.path.join(ML_DIR, "model.joblib")


class Recognizer:
    def __init__(self):
        bundle = joblib.load(MODEL_PATH)
        if isinstance(bundle, dict):                 # new format: model + feature mode
            self.model, self.mode = bundle["model"], bundle["mode"]
        else:                                        # old format: plain model
            self.model, self.mode = bundle, "xy"
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

        # The browser already mirrors the frame (same as our training recordings),
        # so we must NOT flip it again here.
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        with self.lock:
            result = self.hands.process(rgb)

        if not result.multi_hand_landmarks:
            return {"hand_detected": False, "label": None, "confidence": 0.0}
        feats = extract_features(result.multi_hand_landmarks[0])
        if feats is None:
            return {"hand_detected": False, "label": None, "confidence": 0.0}

        vec = extended_features(feats) if self.mode == "extended" else xy_only(feats)
        probs = self.model.predict_proba([vec])[0]
        best = int(probs.argmax())
        return {
            "hand_detected": True,
            "label": str(self.model.classes_[best]),
            "confidence": float(probs[best]),
        }


_recognizer = None
_loaded_mtime = None
_load_lock = threading.Lock()


def get_recognizer():
    """Load the model on first use, and reload it whenever model.joblib changes."""
    global _recognizer, _loaded_mtime
    if not os.path.exists(MODEL_PATH):
        return None
    mtime = os.path.getmtime(MODEL_PATH)
    with _load_lock:
        if _recognizer is None or mtime != _loaded_mtime:
            if _recognizer is not None:
                _recognizer.hands.close()
            _recognizer = Recognizer()
            _loaded_mtime = mtime
    return _recognizer