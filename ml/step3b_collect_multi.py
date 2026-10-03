import csv
import os
import time

import cv2
import mediapipe as mp
from features import extract_features

NAMES = {ord(str(i)): w for i, w in enumerate(
    ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"])}
NAMES[ord("n")] = "none"

ROUND = 150        # samples per key press
COUNTDOWN = 3      # seconds to get your hand ready
SAVE_EVERY = 3     # save 1 sample every 3 frames

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "landmarks.csv")
os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
if not os.path.exists(CSV_PATH):
    with open(CSV_PATH, "w", newline="") as f:
        csv.writer(f).writerow(["label"] + [f"f{i}" for i in range(63)])

totals = {}
with open(CSV_PATH, newline="") as f:
    for row in csv.reader(f):
        if row and row[0] != "label":
            totals[row[0]] = totals.get(row[0], 0) + 1

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
cap = cv2.VideoCapture(0)
out = open(CSV_PATH, "a", newline="")
writer = csv.writer(out)

active = None      # label currently being recorded
started = 0.0
got = 0
frame_no = 0

with mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.7,
                    min_tracking_confidence=0.5) as hands:
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.flip(frame, 1)
        result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        frame_no += 1
        hand = result.multi_hand_landmarks[0] if result.multi_hand_landmarks else None
        if hand:
            mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)

        if active:
            wait = COUNTDOWN - (time.time() - started)
            if wait > 0:
                msg = f"'{active}' starts in {wait:.0f}..."
            else:
                msg = f"RECORDING '{active}': {got}/{ROUND}"
                if hand and frame_no % SAVE_EVERY == 0:
                    f = extract_features(hand)
                    if f is not None:
                        writer.writerow([active] + [round(float(v), 5) for v in f])
                        out.flush()
                        got += 1
                        totals[active] = totals.get(active, 0) + 1
                if got >= ROUND:
                    active = None
            cv2.putText(frame, msg, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        else:
            cv2.putText(frame, "Press 0-9 (number) or n (none). SPACE = cancel, q = quit",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 200, 200), 2)

        summary = "  ".join(f"{k}:{v}" for k, v in sorted(totals.items()))
        cv2.putText(frame, summary, (10, frame.shape[0] - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        cv2.imshow("Sign Talk - Multi collect", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key == 32:
            active = None
        elif key in NAMES and not active:
            active, started, got = NAMES[key], time.time(), 0

out.close()
cap.release()
cv2.destroyAllWindows()
print("Totals:", totals)