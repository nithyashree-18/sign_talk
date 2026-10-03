import os
from collections import Counter, deque

import cv2
import joblib
import mediapipe as mp
from features import extract_features, xy_only

HERE = os.path.dirname(os.path.abspath(__file__))
model = joblib.load(os.path.join(HERE, "model.joblib"))
print("Classes:", list(model.classes_))

THRESHOLD = 0.75   # below this confidence, we say "uncertain" instead of guessing
WINDOW = 7         # majority vote over the last 7 frames to reduce flicker
recent = deque(maxlen=WINDOW)

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
cap = cv2.VideoCapture(0)

with mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.7,
                    min_tracking_confidence=0.5) as hands:
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.flip(frame, 1)
        result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        if result.multi_hand_landmarks:
            hand = result.multi_hand_landmarks[0]
            mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)
            f = extract_features(hand)
            if f is not None:
                probs = model.predict_proba([xy_only(f)])[0]
                best = probs.argmax()
                conf = probs[best]
                label = model.classes_[best] if conf >= THRESHOLD else "uncertain"
                recent.append(label)

                shown, _ = Counter(recent).most_common(1)[0]
                color = {"one": (0, 200, 0), "uncertain": (160, 160, 160)}.get(shown, (0, 165, 255))
                cv2.putText(frame, f"Predicted: {shown}", (10, 35),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
                cv2.putText(frame, f"Confidence (this frame): {conf * 100:.0f}%", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        else:
            recent.clear()
            cv2.putText(frame, "No hand detected", (10, 35),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        cv2.imshow("Sign Talk - Step 5: Live", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

cap.release()
cv2.destroyAllWindows()
