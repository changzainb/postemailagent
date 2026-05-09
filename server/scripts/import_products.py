"""初始化场景、导入 71 个历史产品、创建默认管理员。"""
import argparse
import json
import re
import sys
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
SERVER_DIR = THIS_DIR.parent
PROJECT_ROOT = SERVER_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from werkzeug.security import generate_password_hash  # noqa: E402

from server.db import init_db, DB_PATH  # noqa: E402
from server.normalize import normalize_name  # noqa: E402
import sqlite3  # noqa: E402

SCENARIOS = [
    ("aigc_media", "AIGC / 媒资 / 云点播", 1),
    ("trtc_live", "实时音视频 / 直播", 2),
    ("edge_cdn", "边缘加速 / CDN / EO", 3),
    ("cvm_db", "云服务器 / 数据库", 4),
    ("cos", "对象存储 / COS", 5),
    ("security", "安全 / 审核", 6),
    ("mq", "消息队列", 7),
    ("other", "其他 / 待归类", 99),
]

PRODUCT_TABLE_RE = re.compile(
    r"^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|"
    r"\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|"
)

CANDIDATE_RE = re.compile(r"([^；;]+?)\((\d+)\)")

CATEGORY_TO_KEY = {
    "AIGC / 媒资 / 云点播": "aigc_media",
    "实时音视频 / 直播": "trtc_live",
    "边缘加速 / CDN / EO": "edge_cdn",
    "云服务器 / 数据库": "cvm_db",
    "对象存储 / COS": "cos",
    "安全 / 审核": "security",
    "消息队列": "mq",
    "其他 / 待归类": "other",
}


def _top_candidate(cell: str) -> str:
    """从 '8折(3)；5折(2)' 这种候选里取频次最高的项（平居取在前的）。"""
    cell = (cell or "").strip()
    if not cell or cell == "-":
        return ""
    best_val = ""
    best_count = -1
    for m in CANDIDATE_RE.finditer(cell):
        val = m.group(1).strip()
        cnt = int(m.group(2))
        if cnt > best_count:
            best_val = val
            best_count = cnt
    return best_val


def parse_products(md_path: Path):
    products = []
    for line in md_path.read_text(encoding="utf-8").splitlines():
        match = PRODUCT_TABLE_RE.match(line)
        if not match:
            continue
        category = match.group(1).strip()
        name = match.group(2).strip()
        discount = _top_candidate(match.group(4))
        commission = _top_candidate(match.group(5))
        scenario_key = CATEGORY_TO_KEY.get(category, "other")
        products.append((scenario_key, name, discount, commission))
    return products


def upsert_scenarios(conn):
    for key, label, order in SCENARIOS:
        conn.execute(
            "INSERT OR IGNORE INTO scenarios(key, label, sort_order) VALUES (?, ?, ?)",
            (key, label, order),
        )


def upsert_products(conn, products):
    inserted = 0
    skipped = 0
    rules_filled = 0
    for scenario_key, name, discount, commission in products:
        scenario_row = conn.execute(
            "SELECT id FROM scenarios WHERE key=?", (scenario_key,)
        ).fetchone()
        if not scenario_row:
            continue
        no_commission = 1 if commission == "无返佣" else 0
        commission_text = "" if no_commission else commission
        existing = conn.execute("SELECT id FROM products WHERE name=?", (name,)).fetchone()
        if existing:
            skipped += 1
            product_id = existing["id"]
            # 对已存在产品：只给空值的字段回填历史，不覆盖人工维护
            rule = conn.execute(
                "SELECT id, normal_discount, normal_commission, no_commission "
                "FROM pricing_rules WHERE product_id=?",
                (product_id,),
            ).fetchone()
            if rule is None:
                conn.execute(
                    "INSERT INTO pricing_rules(product_id, normal_discount, normal_commission, no_commission) "
                    "VALUES (?, ?, ?, ?)",
                    (product_id, discount, commission_text, no_commission),
                )
                if discount or commission_text or no_commission:
                    rules_filled += 1
                continue
            updates = []
            params = []
            if discount and not (rule["normal_discount"] or "").strip():
                updates.append("normal_discount=?")
                params.append(discount)
            if commission_text and not (rule["normal_commission"] or "").strip():
                updates.append("normal_commission=?")
                params.append(commission_text)
            if no_commission and not rule["no_commission"] and not (rule["normal_commission"] or "").strip():
                updates.append("no_commission=?")
                params.append(1)
            if updates:
                params.append(rule["id"])
                conn.execute(
                    f"UPDATE pricing_rules SET {', '.join(updates)}, updated_by='history-import' WHERE id=?",
                    params,
                )
                rules_filled += 1
            continue
        cur = conn.execute(
            "INSERT INTO products(scenario_id, name, name_normalized, aliases, source) "
            "VALUES (?, ?, ?, '[]', 'history')",
            (scenario_row["id"], name, normalize_name(name)),
        )
        conn.execute(
            "INSERT INTO pricing_rules(product_id, normal_discount, normal_commission, no_commission, updated_by) "
            "VALUES (?, ?, ?, ?, 'history-import')",
            (cur.lastrowid, discount, commission_text, no_commission),
        )
        inserted += 1
    return inserted, skipped, rules_filled


def ensure_admin(conn, username, password):
    row = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
    if row:
        return False
    conn.execute(
        "INSERT INTO users(username, password_hash, role) VALUES (?, ?, 'admin')",
        (username, generate_password_hash(password, method='pbkdf2:sha256')),
    )
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--md", default=str(PROJECT_ROOT / "applied-products.md"))
    parser.add_argument("--admin-user", default="admin")
    parser.add_argument("--admin-password", default="admin123")
    args = parser.parse_args()

    init_db()
    md_path = Path(args.md)
    products = parse_products(md_path)
    print(f"parsed {len(products)} products from {md_path}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        upsert_scenarios(conn)
        inserted, skipped, rules_filled = upsert_products(conn, products)
        admin_created = ensure_admin(conn, args.admin_user, args.admin_password)
        conn.commit()
    finally:
        conn.close()

    print(f"products inserted={inserted} skipped(existing)={skipped} rules_backfilled={rules_filled}")
    print(f"admin created={admin_created} username={args.admin_user}")
    if admin_created:
        print(f"  initial password: {args.admin_password}  (尽快改密)")


if __name__ == "__main__":
    main()
