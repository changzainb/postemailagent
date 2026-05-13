"""Create a compressed online backup of the postemailagent SQLite database."""
import gzip
import os
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


def main():
    db_path = Path(os.environ.get("POSTEMAIL_DB", "/opt/postemailagent/data/rules.db"))
    backup_dir = Path(os.environ.get("POSTEMAIL_BACKUP_DIR", "/opt/postemailagent/backups"))
    retention_days = int(os.environ.get("POSTEMAIL_BACKUP_RETENTION_DAYS", "14"))

    if not db_path.exists():
        raise SystemExit(f"database not found: {db_path}")

    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    tmp_db = backup_dir / f"rules-{stamp}.db"
    gz_path = backup_dir / f"rules-{stamp}.db.gz"

    source = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    target = sqlite3.connect(tmp_db)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()

    with tmp_db.open("rb") as raw, gzip.open(gz_path, "wb") as compressed:
        shutil.copyfileobj(raw, compressed)
    tmp_db.unlink()

    cutoff = datetime.now().timestamp() - retention_days * 86400
    for backup in backup_dir.glob("rules-*.db.gz"):
        if backup.stat().st_mtime < cutoff:
            backup.unlink()

    print(gz_path)


if __name__ == "__main__":
    main()