import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "signtalk.db")
PUBLIC = os.path.join(os.path.dirname(HERE), "frontend", "public")

NUMBER_WORDS = ["zero", "one", "two", "three", "four",
                "five", "six", "seven", "eight", "nine"]

# (key, display name, meaning). Each needs frontend/public/videos/<key>.mp4
# Check every word in the ISLRTC dictionary first, and edit this list to match.
WORDS = [
    ("hello", "Hello", "A greeting"),
    ("thank_you", "Thank you", "Expressing thanks"),
    ("please", "Please", "A polite request"),
    ("sorry", "Sorry", "Expressing apology"),
    ("yes", "Yes", "Agreement"),
    ("no", "No", "Disagreement"),
    ("help", "Help", "Asking for help"),
    ("water", "Water", "Drinking water"),
    ("food", "Food", "Something to eat"),
    ("good", "Good", "Something positive"),
    ("friend", "Friend", "A person you like"),
    ("family", "Family", "Your relatives"),
]

conn = sqlite3.connect(DB_PATH)
conn.execute("DROP TABLE IF EXISTS signs")
conn.execute("""
    CREATE TABLE signs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        label     TEXT UNIQUE NOT NULL,   -- matches the ML class name
        name      TEXT NOT NULL,
        category  TEXT NOT NULL,
        meaning   TEXT NOT NULL,
        image_url TEXT,
        video_url TEXT
    )
""")

SQL = ("INSERT INTO signs (label, name, category, meaning, image_url, video_url) "
       "VALUES (?, ?, ?, ?, ?, ?)")

for digit, word in enumerate(NUMBER_WORDS):
    conn.execute(SQL, (word, f"{word.capitalize()} ({digit})", "Numbers",
                       f"The number {digit}", f"/signs/{word}.png", None))

for ch in "abcdefghijklmnopqrstuvwxyz":
    conn.execute(SQL, (f"letter_{ch}", f"Letter {ch.upper()}", "Alphabets",
                       f"The letter {ch.upper()}", f"/signs/letters/{ch}.png", None))

added, missing = 0, []
for key, name, meaning in WORDS:
    if os.path.exists(os.path.join(PUBLIC, "videos", f"{key}.mp4")):
        conn.execute(SQL, (f"word_{key}", name, "Daily Words", meaning,
                           None, f"/videos/{key}.mp4"))
        added += 1
    else:
        missing.append(key)

conn.commit()
conn.close()
print(f"Seeded 10 numbers, 26 letters, {added} words.")
if missing:
    print("Words skipped (no video file yet):", ", ".join(missing))