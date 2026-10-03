import csv
import os
import sys

import cv2
import mediapipe as mp
from features import extract_features

if len(sys.argv) != 2:
    print("Usage: python ml/step3_collect.py <label>")
    sys.exit(1)
label = sys.argv[1]

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CSV_PATH = os.path.join(DATA_DIR, "landmarks.csv")
os.makedirs(DATA_DIR, exist_ok=True)

# create the file with a header if it doesn't exist yet
if not os.path.exists(CSV_PATH):
    with open(CSV_PATH, "w", newline="") as f:
        csv.writer(f).writerow(["label"] + [f"f{i}" for i in range(63)])

# count existing rows for this label
existing = 0
with open(CSV_PATH, newline="") as f:
    for row in csv.reader(f):
        if row and row[0] == label:
            existing += 1

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
cap = cv2.VideoCapture(0)

recording = False
session = 0
frame_count = 0
SAVE_EVERY = 3   # save 1 sample every 3 frames, so samples are not near-identical

out = open(CSV_PATH, "a", newline="")
writer = csv.writer(out)

with mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.7,
                    min_tracking_confidence=0.5) as hands:
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.flip(frame, 1)
        result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        frame_count += 1

        if result.multi_hand_landmarks:
            hand = result.multi_hand_landmarks[0]
            mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)

            if recording and frame_count % SAVE_EVERY == 0:
                f = extract_features(hand)
                if f is not None:
                    writer.writerow([label] + [round(float(v), 5) for v in f])
                    out.flush()
                    session += 1

        status = "RECORDING" if recording else "PAUSED (press SPACE)"
        color = (0, 0, 255) if recording else (0, 200, 200)
        cv2.putText(frame, f"Label: {label}   {status}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        cv2.putText(frame, f"This session: {session}   Total for label: {existing + session}",
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        cv2.imshow("Sign Talk - Step 3: Collect", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key == 32:               # SPACE toggles recording
            recording = not recording

out.close()
cap.release()
cv2.destroyAllWindows()
print(f"Saved {session} new samples for '{label}'.")