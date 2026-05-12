import os
import sqlite3
from pathlib import Path
from flask import g

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("POSTEMAIL_DB", ROOT / "data" / "rules.db"))
SCHEMA_PATH = ROOT / "schema.sql"


def get_db():
    if "db" not in g:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        columns = {row[1] for row in conn.execute("PRAGMA table_info(pricing_rules)").fetchall()}
        if "billing_modes" not in columns:
            conn.execute(
                "ALTER TABLE pricing_rules ADD COLUMN billing_modes TEXT DEFAULT '[\"prepaid\",\"postpaid\"]'"
            )
        if "price_type" not in columns:
            conn.execute("ALTER TABLE pricing_rules ADD COLUMN price_type TEXT DEFAULT 'discount'")
            conn.execute(
                "UPDATE pricing_rules SET price_type='fixed_price' "
                "WHERE product_id IN (SELECT id FROM products WHERE name LIKE '%一口价%')"
            )
        scenario_columns = {row[1] for row in conn.execute("PRAGMA table_info(scenarios)").fetchall()}
        if "label" in scenario_columns:
            conn.execute("CREATE INDEX IF NOT EXISTS idx_scenarios_label ON scenarios(label)")
        conn.commit()
    finally:
        conn.close()
