import cv2
import mediapipe as mp

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)  # 0 = default webcam

with mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5,
) as hands:
    while True:
        ok, frame = cap.read()
        if not ok:
            print("Could not read from webcam")
            break

        frame = cv2.flip(frame, 1)                    # mirror view
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # MediaPipe needs RGB
        result = hands.process(rgb)

        if result.multi_hand_landmarks:
            for hand in result.multi_hand_landmarks:
                mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)
            cv2.putText(frame, "Hand detected", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        else:
            cv2.putText(frame, "No hand", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        cv2.imshow("Sign Talk - Step 1", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):         # press q to quit
            break

cap.release()
cv2.destroyAllWindows()