import csv
import os
import re
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "signtalk.db")
PUBLIC = os.path.join(os.path.dirname(HERE), "frontend", "public")
WORDS_CSV = os.path.join(HERE, "words.csv")

NUMBER_WORDS = ["zero", "one", "two", "three", "four",
                "five", "six", "seven", "eight", "nine"]

YT_ID = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/))([A-Za-z0-9_-]{11})"
)


def video_url_for(source):
    """A YouTube link becomes an embed URL. A file name becomes /videos/<file>."""
    source = source.strip()
    m = YT_ID.search(source)
    if m:
        return f"https://www.youtube-nocookie.com/embed/{m.group(1)}?rel=0"
    if source.lower().endswith(".mp4") and os.path.exists(os.path.join(PUBLIC, "videos", source)):
        return f"/videos/{source}"
    return None


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

added, empty, bad, seen = [], [], [], set()
if os.path.exists(WORDS_CSV):
    with open(WORDS_CSV, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            key = re.sub(r"[^a-z0-9_]", "", (row.get("key") or "").strip().lower().replace(" ", "_"))
            name = (row.get("name") or "").strip()
            meaning = (row.get("meaning") or "").strip() or name
            source = (row.get("source") or "").strip()
            if not key or not name or key in seen:
                continue
            seen.add(key)
            if not source:
                empty.append(key)
                continue
            url = video_url_for(source)
            if url is None:
                bad.append(key)
                continue
            conn.execute(SQL, (f"word_{key}", name, "Daily Words", meaning, None, url))
            added.append(key)
else:
    print("No words.csv found. Daily Words will be empty.")

conn.commit()
conn.close()
print(f"Seeded 10 numbers, 26 letters, {len(added)} words.")
if empty:
    print("Words waiting for a video link:", ", ".join(empty))
if bad:
    print("Could not use the source for:", ", ".join(bad),
          "(it must be a YouTube link, or an .mp4 file inside frontend/public/videos)")