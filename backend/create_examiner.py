import secrets
import sys

from db import get_db
from routes.auth import hash_password

if len(sys.argv) != 4:
    print('Usage: python create_examiner.py "Name" email password')
    sys.exit(1)

name, email, password = sys.argv[1], sys.argv[2].strip().lower(), sys.argv[3]
salt = secrets.token_hex(16)
conn = get_db()
try:
    conn.execute(
        "INSERT INTO users (name, email, salt, password_hash, role) VALUES (?, ?, ?, ?, 'examiner')",
        (name, email, salt, hash_password(password, salt)),
    )
    conn.commit()
    print("Examiner created:", email)
except Exception as e:
    print("Failed:", e)
finally:
    conn.close()
