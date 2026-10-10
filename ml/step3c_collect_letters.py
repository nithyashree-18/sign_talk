import csv
import os
import sys
import time

import cv2
import mediapipe as mp

from features_two import TOTAL, two_hand_features

LETTERS = "abcdefghijklmnopqrstuvwxyz"
# Letters signed with ONE hand. Check each in the ISLRTC video and edit this.
ONE_HAND = set("cilouv")

PASSES = 3
PER_LETTER = 100         # samples per letter per pass
PER_NONE = 150           # samples of "none" per pass
COUNTDOWN = 4            # seconds to get your hands ready
MAX_RECORD_SECONDS = 25  # skip an item if the right hands are never seen
SAVE_EVERY = 3           # keep 1 frame in 3

PASS_TIPS = {
    1: "Pass 1: normal distance, hands facing the camera",
    2: "Pass 2: a little closer or farther, tilt your wrists slightly",
    3: "Pass 3: move toward the left or right of the frame, slightly different angle",
}

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "letters.csv")
IMG_DIR = os.path.join(os.path.dirname(HERE), "frontend", "public", "signs", "letters")
os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

if not os.path.exists(CSV_PATH):
    with open(CSV_PATH, "w", newline="") as fh:
        csv.writer(fh).writerow(["label", "session"] + [f"f{i}" for i in range(TOTAL)])

totals = {}
with open(CSV_PATH, newline="") as fh:
    for row in csv.reader(fh):
        if row and row[0] != "label":
            totals[row[0]] = totals.get(row[0], 0) + 1

# your cropped letter pictures, shown as a reference while you record
refs = {}
for ch in LETTERS:
    img = cv2.imread(os.path.join(IMG_DIR, f"{ch}.png"))
    if img is not None:
        scale = min(190 / img.shape[0], 240 / img.shape[1])
        refs[ch] = cv2.resize(img, (int(img.shape[1] * scale), int(img.shape[0] * scale)))

ITEMS = [f"letter_{c}" for c in LETTERS] + ["none"]


def need(label):
    if label == "none":
        return "any hands"
    return "one hand" if label.replace("letter_", "") in ONE_HAND else "two hands"


def hands_ok(label, n):
    kind = need(label)
    if kind == "any hands":
        return n >= 1
    return n == 1 if kind == "one hand" else n == 2


def put(frame, text, y, color=(255, 255, 255), scale=0.6):
    cv2.putText(frame, text, (10, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 2)


def overlay(frame, img):
    h, w = img.shape[:2]
    H, W = frame.shape[:2]
    x0, y0 = W - w - 10, 50
    if x0 > 0 and y0 + h < H:
        frame[y0:y0 + h, x0:x0 + w] = img
        cv2.rectangle(frame, (x0, y0), (x0 + w, y0 + h), (255, 255, 255), 1)


next_pass = int(sys.argv[1]) if len(sys.argv) > 1 else 1
queue, current = [], None          # current = (label, session, item number)
t0, got, frame_no = 0.0, 0, 0
skipped = []

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
cap = cv2.VideoCapture(0)
out = open(CSV_PATH, "a", newline="")
writer = csv.writer(out)

with mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.6,
                    min_tracking_confidence=0.5) as hands:
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.flip(frame, 1)
        result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        frame_no += 1
        found = list(result.multi_hand_landmarks or [])
        n = len(found)
        for h in found:
            mp_draw.draw_landmarks(frame, h, mp_hands.HAND_CONNECTIONS)

        if current is None and queue:
            current = queue.pop(0)
            t0, got = time.time(), 0

        if current:
            label, session, idx = current
            target = PER_NONE if label == "none" else PER_LETTER
            elapsed = time.time() - t0
            name = "NONE" if label == "none" else label.replace("letter_", "").upper()
            where = f"Pass {session}/{PASSES}  " if session else "Re-record  "
            ch = label.replace("letter_", "")
            if ch in refs:
                overlay(frame, refs[ch])

            if elapsed < COUNTDOWN:
                put(frame, f"{where}{name}: get ready... {COUNTDOWN - elapsed:.0f}", 30, (0, 200, 255))
                if label == "none":
                    put(frame, "Show relaxed hands, fists, hands apart, random shapes", 86, (0, 200, 255), 0.5)
                else:
                    put(frame, f"Needs {need(label)}", 86, (0, 200, 255), 0.5)
            else:
                if hands_ok(label, n):
                    put(frame, f"RECORDING {name}   {got}/{target}", 30, (0, 0, 255))
                    if frame_no % SAVE_EVERY == 0:
                        vec = two_hand_features(found)
                        if vec is not None:
                            writer.writerow([label, session] + [round(float(v), 4) for v in vec])
                            out.flush()
                            got += 1
                            totals[label] = totals.get(label, 0) + 1
                else:
                    put(frame, f"{name}: need {need(label)} in view (seeing {n})", 30, (0, 140, 255))
                if got >= target:
                    current = None
                elif elapsed > COUNTDOWN + MAX_RECORD_SECONDS:
                    skipped.append(name)
                    current = None

            if session:
                put(frame, f"Item {idx}/{len(ITEMS)}", 58, (255, 255, 255), 0.5)
                put(frame, PASS_TIPS.get(session, "Vary distance, angle and position"),
                    frame.shape[0] - 15, (255, 255, 255), 0.5)
        else:
            if next_pass > PASSES:
                put(frame, "All passes done. Press ESC to finish.", 30, (0, 220, 0))
            elif next_pass > 1:
                put(frame, f"Pass {next_pass - 1} finished. Rest, then ENTER = pass {next_pass}", 30, (0, 220, 220))
            else:
                put(frame, f"ENTER = start pass 1 of {PASSES} (A to Z, then none)", 30, (0, 220, 220))
            put(frame, "a-z = re-record one letter | 0 = none | BACKSPACE = cancel | ESC = quit",
                58, (200, 200, 200), 0.5)

        cv2.imshow("Sign Talk - Letters", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == 27:                          # ESC
            break
        if key == 8:                           # BACKSPACE cancels everything
            queue.clear()
            current = None
        elif key == 32:                        # SPACE skips the current item
            current = None
        elif current is None and not queue:
            if key == 13 and next_pass <= PASSES:           # ENTER starts the next pass
                queue = [(lab, next_pass, i + 1) for i, lab in enumerate(ITEMS)]
                next_pass += 1
            elif key == 48:                                  # 0 = none (manual)
                current, t0, got = ("none", 0, 0), time.time(), 0
            elif 65 <= key <= 90 or 97 <= key <= 122:        # a-z = one letter (manual)
                current, t0, got = (f"letter_{chr(key).lower()}", 0, 0), time.time(), 0

out.close()
cap.release()
cv2.destroyAllWindows()

print("Samples per label:")
for lab in ITEMS:
    print(f"  {lab.replace('letter_', ''):6s} {totals.get(lab, 0)}")
if skipped:
    print("Skipped (the right number of hands was never seen):", ", ".join(skipped))