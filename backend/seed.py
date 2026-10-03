import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "signtalk.db")
NUMBERS_VIDEO = "https://youtu.be/sVT6S-xJcbQ"   # ISLRTC numbers video (from the poster)

number_words = ["zero", "one", "two", "three", "four",
                "five", "six", "seven", "eight", "nine"]

conn = sqlite3.connect(DB_PATH)
conn.execute("DROP TABLE IF EXISTS signs")
conn.execute("""
    CREATE TABLE signs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        label     TEXT UNIQUE NOT NULL,   -- matches the ML class name (e.g. 'one')
        name      TEXT NOT NULL,
        category  TEXT NOT NULL,
        meaning   TEXT NOT NULL,
        image_url TEXT,
        video_url TEXT
    )
""")

for digit, word in enumerate(number_words):
    conn.execute(
        "INSERT INTO signs (label, name, category, meaning, image_url, video_url) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (word, f"{word.capitalize()} ({digit})", "Numbers",
         f"The number {digit}", f"/signs/{word}.png", NUMBERS_VIDEO),
    )

conn.commit()
conn.close()
print("Created signs table with", len(number_words), "signs.")