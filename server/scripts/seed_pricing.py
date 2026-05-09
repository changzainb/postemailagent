"""把 applied-products.md 里的历史最高频折扣/返佣回填进 pricing_rules.

规则：
- 历史折扣候选第一项 -> normal_discount
- 历史返佣候选第一项 -> normal_commission；若为"无返佣"，no_commission=1
- breakthrough_discount/commission 留空，由商务在后台手填
- 仅在 normal_discount 为空时才覆盖，已经手工调过的不动
"""
import re
import sqlite3
import sys
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
SERVER_DIR = THIS_DIR.parent
PROJECT_ROOT = SERVER_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from server.db import DB_PATH  # noqa: E402

ROW_RE = re.compile(
    r"^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|"
)
CAND_RE = re.compile(r"^([^()（）]+?)(?:\((\d+)\)|（(\d+)）)")


def first_candidate(text: str) -> str:
    text = text.strip()
    if not text or text == "-":
        return ""
    parts = re.split(r"[；;]", text)
    for p in parts:
        m = CAND_RE.match(p.strip())
        if m:
            return m.group(1).strip()
    return parts[0].strip()


def parse_md(md_path: Path):
    rows = []
    for line in md_path.read_text(encoding="utf-8").splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        name = m.group(2).strip()
        disc = first_candidate(m.group(3))
        comm = first_candidate(m.group(4))
        rows.append((name, disc, comm))
    return rows


def main():
    md_path = PROJECT_ROOT / "applied-products.md"
    rows = parse_md(md_path)
    print(f"parsed {len(rows)} product rows")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    updated = 0
    skipped = 0
    missing = 0
    try:
        for name, disc, comm in rows:
            prod = conn.execute("SELECT id FROM products WHERE name=?", (name,)).fetchone()
            if not prod:
                missing += 1
                continue
            rule = conn.execute(
                "SELECT normal_discount, normal_commission FROM pricing_rules WHERE product_id=?",
                (prod["id"],),
            ).fetchone()
            if rule and (rule["normal_discount"] or rule["normal_commission"]):
                skipped += 1
                continue
            no_comm = 1 if comm == "无返佣" else 0
            conn.execute(
                "UPDATE pricing_rules SET normal_discount=?, normal_commission=?, "
                "no_commission=?, remark=COALESCE(NULLIF(remark,''),'历史最高频回填'), "
                "updated_by='seed', updated_at=CURRENT_TIMESTAMP WHERE product_id=?",
                (disc, comm, no_comm, prod["id"]),
            )
            updated += 1
        conn.commit()
    finally:
        conn.close()
    print(f"updated={updated} skipped(existing)={skipped} missing={missing}")


if __name__ == "__main__":
    main()
