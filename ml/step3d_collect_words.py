import csv
import os
import sys
import time

import cv2
import mediapipe as mp

from features_words import CLIP_DIM, clip_features, frame_vector

CLIP_SECONDS = 2.0     # length of one clip
SAMPLE_FPS = 10        # frames kept per second (20 per clip)
READY_SECONDS = 1.5    # pause before each clip
CLIPS_PER_PASS = 15    # clips per word in one pass
PASSES = 3

PASS_TIPS = {
    1: "Pass 1: normal distance, copy the video as closely as you can",
    2: "Pass 2: a little closer or farther, vary your speed slightly",
    3: "Pass 3: shift left or right in the frame, slightly different angle",
}

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "clips.csv")
WORDS_CSV = os.path.join(os.path.dirname(HERE), "backend", "words.csv")
os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

args = sys.argv[1:]
start_pass = 1
if "--pass" in args:
    i = args.index("--pass")
    start_pass = int(args[i + 1])
    del args[i:i + 2]

names = {}
if os.path.exists(WORDS_CSV):
    with open(WORDS_CSV, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            key = (row.get("key") or "").strip()
            if key:
                names[key] = (row.get("name") or key).strip()

if not args:
    print("Usage: python ml/step3d_collect_words.py <word key> [<word key> ...] [--pass N]")
    print("Available keys:", ", ".join(names) if names else "(backend/words.csv not found)")
    sys.exit(1)
unknown = [k for k in args if k not in names]
if unknown:
    print("Not in backend/words.csv:", ", ".join(unknown))
    print("Available keys:", ", ".join(names))
    sys.exit(1)

ITEMS = [f"word_{k}" for k in args] + ["none"]


def title(label):
    return "NONE" if label == "none" else names[label[len("word_"):]].upper()


if not os.path.exists(CSV_PATH):
    with open(CSV_PATH, "w", newline="") as fh:
        csv.writer(fh).writerow(["label", "session"] + [f"f{i}" for i in range(CLIP_DIM)])

totals = {}
with open(CSV_PATH, newline="") as fh:
    for row in csv.reader(fh):
        if row and row[0] != "label":
            totals[row[0]] = totals.get(row[0], 0) + 1


def put(frame, text, y, color=(255, 255, 255), scale=0.6):
    cv2.putText(frame, text, (10, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 2)


mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
cap = cv2.VideoCapture(0)
out = open(CSV_PATH, "a", newline="")
writer = csv.writer(out)

pass_no, item_i, clip_n = start_pass, 0, 0
state, t_state, last_sample = "menu", 0.0, 0.0
buf, notice = [], ""

with mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.6,
                    min_tracking_confidence=0.5) as hands:
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.flip(frame, 1)
        result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        for h in result.multi_hand_landmarks or []:
            mp_draw.draw_landmarks(frame, h, mp_hands.HAND_CONNECTIONS)
        now = time.time()
        label = ITEMS[item_i]

        if state == "menu":
            if pass_no > PASSES:
                put(frame, "All passes done. Press ESC to finish.", 30, (0, 220, 0))
            else:
                put(frame, f"Pass {pass_no}/{PASSES} - press ENTER to start", 30, (0, 220, 220))
                put(frame, PASS_TIPS.get(pass_no, ""), 58, (200, 200, 200), 0.5)

        elif state == "wait":
            put(frame, f"Next: {title(label)}   (pass {pass_no}/{PASSES})", 30, (0, 220, 220))
            if label == "none":
                put(frame, "NONE = hands resting, relaxed, or any movement that is NOT one of your words",
                    58, (200, 200, 200), 0.5)
            else:
                put(frame, "Watch its video on the Learn page, then press ENTER when ready",
                    58, (200, 200, 200), 0.5)

        elif state == "ready":
            put(frame, f"{title(label)}  clip {clip_n + 1}/{CLIPS_PER_PASS}: get ready...",
                30, (0, 200, 255))
            if notice:
                put(frame, notice, 58, (0, 140, 255), 0.5)
            if now - t_state >= READY_SECONDS:
                state, t_state, last_sample, buf, notice = "record", now, 0.0, [], ""

        elif state == "record":
            elapsed = now - t_state
            if now - last_sample >= 1.0 / SAMPLE_FPS:
                buf.append(frame_vector(result))
                last_sample = now
            put(frame, f"RECORDING {title(label)}  clip {clip_n + 1}/{CLIPS_PER_PASS}", 30, (0, 0, 255))
            cv2.rectangle(frame, (10, 45), (10 + int(300 * min(1.0, elapsed / CLIP_SECONDS)), 55),
                          (0, 0, 255), -1)
            if elapsed >= CLIP_SECONDS:
                feats = clip_features(buf)
                if feats is None:
                    notice = "Hands were not in view - repeating this clip"
                    state, t_state = "ready", now
                else:
                    writer.writerow([label, pass_no] + [round(float(v), 4) for v in feats])
                    out.flush()
                    totals[label] = totals.get(label, 0) + 1
                    clip_n += 1
                    if clip_n >= CLIPS_PER_PASS:
                        clip_n = 0
                        item_i += 1
                        if item_i >= len(ITEMS):
                            item_i, pass_no, state = 0, pass_no + 1, "menu"
                        else:
                            state = "wait"
                    else:
                        state, t_state = "ready", now

        summary = "  ".join(f"{k.replace('word_', '')}:{v}" for k, v in sorted(totals.items()))
        put(frame, summary, frame.shape[0] - 15, (255, 255, 255), 0.5)

        cv2.imshow("Sign Talk - Word clips", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == 27:                                   # ESC
            break
        if key == 13:                                   # ENTER
            if state == "menu" and pass_no <= PASSES:
                state = "wait"
            elif state == "wait":
                state, t_state, notice = "ready", time.time(), ""
        elif key == 8 and state in ("ready", "record"):  # BACKSPACE: stop and wait
            state = "wait"

out.close()
cap.release()
cv2.destroyAllWindows()
print("Clips per label:", totals)