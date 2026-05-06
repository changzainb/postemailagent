"""创建/重置商务账号。"""
import argparse
import sqlite3
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = SERVER_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from werkzeug.security import generate_password_hash  # noqa: E402
from server.db import DB_PATH, init_db  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("username")
    parser.add_argument("password")
    parser.add_argument("--role", default="business", choices=["business", "admin"])
    args = parser.parse_args()

    init_db()
    conn = sqlite3.connect(DB_PATH)
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username=?", (args.username,)
        ).fetchone()
        password_hash = generate_password_hash(args.password, method='pbkdf2:sha256')
        if existing:
            conn.execute(
                "UPDATE users SET password_hash=?, role=? WHERE username=?",
                (password_hash, args.role, args.username),
            )
            print(f"updated {args.username}")
        else:
            conn.execute(
                "INSERT INTO users(username, password_hash, role) VALUES (?, ?, ?)",
                (args.username, password_hash, args.role),
            )
            print(f"created {args.username} role={args.role}")
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
