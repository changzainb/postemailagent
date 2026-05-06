#!/usr/bin/env python3
from collections import Counter, defaultdict
from dataclasses import dataclass
from email import policy
from email.header import decode_header, make_header
from email.parser import BytesParser
from html import unescape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CASES_DIR = ROOT / "cases"
OUTPUT = ROOT / "extracted-rules.md"
PRODUCT_OUTPUT = ROOT / "applied-products.md"

PRODUCT_LINE_RE = re.compile(r"【申请产品\d*】[:：]\s*(?:产品名称/折扣/返佣[:：])?\s*(.+)")
CUSTOMER_RE = re.compile(r"(?:客户公司全称|代客公司全称|客户名称|以下是)(?:[:：]|是)?\s*([^，,\n]+?(?:公司|工作室|中心|个体工商户))")
VALID_RE = re.compile(r"【申请有效期】[:：]\s*(.+)")
REASON_RE = re.compile(r"【申请理由】[:：]([\s\S]+?)(?:\n\s*(?:--|From:|发件人|Original Message)|\Z)")
DISCOUNT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*折")
COMMISSION_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%\s*返佣")

SENSITIVE_HEADER_PREFIXES = (
    "From:", "To:", "Cc:", "Bcc:", "Message-ID:", "X-", "Received:", "Return-Path:",
)

CATEGORY_KEYWORDS = [
    ("AIGC / 媒资 / 云点播", ["AIGC", "媒资", "云点播", "生图", "生视频", "模型"]),
    ("实时音视频 / 直播", ["TRTC", "实时音视频", "直播", "音视频", "混流"]),
    ("云服务器 / 数据库", ["云服务器", "CVM", "cvm", "数据库", "MySQL", "mysql"]),
    ("边缘加速 / CDN / EO", ["边缘加速", "EO", "CDN", "内容分发"]),
    ("对象存储 / COS", ["对象存储", "COS"]),
    ("消息队列", ["消息队列", "CKafka", "RocketMQ"]),
    ("安全 / 审核", ["天御", "审核", "安全"]),
]

@dataclass
class ProductRecord:
    file_name: str
    customer: str
    subject: str
    category: str
    product_name: str
    raw_line: str
    discounts: tuple
    commissions: tuple
    no_commission: bool
    valid_period: str
    has_reason: bool


def decode_mime(value):
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def strip_html(text):
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return unescape(text)


def get_body(msg):
    parts = []
    if msg.is_multipart():
        preferred = []
        fallback = []
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = (part.get_content_disposition() or "").lower()
            if disposition == "attachment":
                continue
            try:
                content = part.get_content()
            except Exception:
                payload = part.get_payload(decode=True) or b""
                content = payload.decode(part.get_content_charset() or "utf-8", "ignore")
            if content_type == "text/plain":
                preferred.append(content)
            elif content_type == "text/html":
                fallback.append(strip_html(content))
        parts = preferred or fallback
    else:
        try:
            content = msg.get_content()
        except Exception:
            payload = msg.get_payload(decode=True) or b""
            content = payload.decode(msg.get_content_charset() or "utf-8", "ignore")
        parts = [strip_html(content) if msg.get_content_type() == "text/html" else content]

    text = "\n".join(parts)
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\u3000", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def guess_category(text):
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword.lower() in text.lower() for keyword in keywords):
            return category
    return "其他 / 待归类"


def clean_product_name(line):
    normalized = re.sub(r"\s+", " ", unescape(line)).strip(" ；;")
    name = re.split(r"[:：](?=\s*(?:\d|无返佣|[0-9.]+折))", normalized, maxsplit=1)[0]
    name = re.split(r"/(?:\d|无返佣|[0-9.]+折)", name, maxsplit=1)[0]
    return name.strip(" ；;/") or normalized[:80]


def normalize_discount(value):
    number = float(value)
    if number > 10:
        number = number / 10
    if number.is_integer():
        return f"{int(number)}折"
    return f"{number:g}折"


def strip_effective_discount_text(line):
    markers = [
        "折扣+返佣",
        "折扣 + 返佣",
        "综合折扣",
        "相当于",
        "相当刊例价",
        "刊例价",
    ]
    cut_index = len(line)
    for marker in markers:
        index = line.find(marker)
        if index != -1:
            cut_index = min(cut_index, index)
    return line[:cut_index]


def extract_records():
    records = []
    files = sorted(CASES_DIR.glob("*.eml"))
    for path in files:
        try:
            msg = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
        except Exception:
            continue
        subject = decode_mime(msg.get("subject", ""))
        body = get_body(msg)
        customer_match = CUSTOMER_RE.search(body) or CUSTOMER_RE.search(subject)
        customer = customer_match.group(1).strip() if customer_match else ""
        valid_match = VALID_RE.search(body)
        reason_match = REASON_RE.search(body)
        valid_period = valid_match.group(1).strip() if valid_match else ""
        for match in PRODUCT_LINE_RE.finditer(body):
            raw_line = re.sub(r"\s+", " ", unescape(match.group(1))).strip()
            if not raw_line:
                continue
            primary_pricing_text = strip_effective_discount_text(raw_line)
            discounts = tuple(dict.fromkeys(normalize_discount(value) for value in DISCOUNT_RE.findall(primary_pricing_text)))
            commissions = tuple(dict.fromkeys(COMMISSION_RE.findall(raw_line)))
            no_commission = "无返佣" in raw_line
            product_name = clean_product_name(raw_line)
            category = guess_category(" ".join([subject, product_name, raw_line]))
            records.append(ProductRecord(
                file_name=path.name,
                customer=customer,
                subject=subject,
                category=category,
                product_name=product_name,
                raw_line=raw_line,
                discounts=discounts,
                commissions=commissions,
                no_commission=no_commission,
                valid_period=valid_period,
                has_reason=bool(reason_match),
            ))
    return records, files


def most_common_or_dash(counter, limit=5):
    if not counter:
        return "-"
    return "；".join(f"{value}({count})" for value, count in counter.most_common(limit))


def md_escape(value):
    return str(value).replace("|", "\\|").strip()


def build_markdown(records, files):
    by_category = defaultdict(list)
    by_product = defaultdict(list)
    for record in records:
        by_category[record.category].append(record)
        by_product[record.product_name].append(record)

    lines = []
    lines.append("# 历史邮件提取规则（待确认）")
    lines.append("")
    lines.append("这份文件由 `scripts/extract_cases.py` 从 `cases/*.eml` 生成，只抽正文里的业务字段，不采集邮件头、邮箱、收件人和发件人。")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append(f"- 邮件文件数：{len(files)}")
    lines.append(f"- 抽到产品行的邮件数：{len(set(record.file_name for record in records))}")
    lines.append(f"- 产品行总数：{len(records)}")
    lines.append(f"- 唯一产品名数量：{len(by_product)}")
    lines.append("")
    lines.append("## 按场景汇总")
    lines.append("")
    lines.append("| 场景 | 产品行数 | 高频折扣 | 高频返佣 | 说明 |")
    lines.append("| --- | ---: | --- | --- | --- |")
    for category, category_records in sorted(by_category.items(), key=lambda item: (-len(item[1]), item[0])):
        discount_counter = Counter(discount for record in category_records for discount in record.discounts)
        commission_counter = Counter()
        for record in category_records:
            if record.no_commission:
                commission_counter["无返佣"] += 1
            for commission in record.commissions:
                commission_counter[f"{commission}%返佣"] += 1
        note = "待确认后写入页面规则库"
        lines.append(f"| {category} | {len(category_records)} | {most_common_or_dash(discount_counter, 4)} | {most_common_or_dash(commission_counter, 4)} | {note} |")
    lines.append("")
    lines.append("## 高频产品候选")
    lines.append("")
    lines.append("| 次数 | 场景 | 产品 | 折扣候选 | 返佣候选 | 状态 |")
    lines.append("| ---: | --- | --- | --- | --- | --- |")
    for product_name, product_records in sorted(by_product.items(), key=lambda item: (-len(item[1]), item[0]))[:80]:
        category_counter = Counter(record.category for record in product_records)
        discount_counter = Counter(discount for record in product_records for discount in record.discounts)
        commission_counter = Counter()
        for record in product_records:
            if record.no_commission:
                commission_counter["无返佣"] += 1
            for commission in record.commissions:
                commission_counter[f"{commission}%返佣"] += 1
        lines.append(
            f"| {len(product_records)} | {category_counter.most_common(1)[0][0]} | {product_name} | "
            f"{most_common_or_dash(discount_counter, 5)} | {most_common_or_dash(commission_counter, 5)} | 待确认 |"
        )
    lines.append("")
    lines.append("## 需要人工确认的问题")
    lines.append("")
    lines.append("- 有些邮件是回复/转发，正文里没有标准 `【申请产品】` 行，当前不会强行抽取。")
    lines.append("- 同一客户有多个最新版、补充、二次修改邮件，后续应以你确认的最终版本为准。")
    lines.append("- 折扣和返佣先作为历史候选值，不代表一定正确；确认后再进入页面默认规则。")
    lines.append("- 部分产品行包含“一口价”或“折扣+返佣后相当于刊例价”，需要单独确认页面里是否按折扣、返佣还是一口价展示。")
    lines.append("- 原始 `.eml` 内含邮件头和邮箱信息，生成规则时只使用正文业务字段。")
    lines.append("")
    lines.append("## 下一步建议")
    lines.append("")
    lines.append("1. 先确认上方高频产品里哪些可以进入规则库。")
    lines.append("2. 对每个产品确认：默认折扣、突破折扣、最低提醒阈值、返佣上限、是否允许返佣。")
    lines.append("3. 我再把确认后的规则写入 `app.js`，形成行业自动匹配。")
    lines.append("")
    return "\n".join(lines)


def build_product_catalog(records, files):
    by_product = defaultdict(list)
    for record in records:
        by_product[record.product_name].append(record)

    product_rows = []
    for product_name, product_records in by_product.items():
        category_counter = Counter(record.category for record in product_records)
        discount_counter = Counter(discount for record in product_records for discount in record.discounts)
        commission_counter = Counter()
        for record in product_records:
            if record.no_commission:
                commission_counter["无返佣"] += 1
            for commission in record.commissions:
                commission_counter[f"{commission}%返佣"] += 1
        product_rows.append({
            "category": category_counter.most_common(1)[0][0],
            "product_name": product_name,
            "count": len(product_records),
            "discounts": most_common_or_dash(discount_counter, 5),
            "commissions": most_common_or_dash(commission_counter, 5),
        })

    lines = []
    lines.append("# 历史申请产品清单")
    lines.append("")
    lines.append("这份清单只整理历史邮件里申请过的产品，底价、常规申请折扣、突破折扣和返佣上限后续等商务确认后再补。")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append(f"- 邮件文件数：{len(files)}")
    lines.append(f"- 抽到产品行的邮件数：{len(set(record.file_name for record in records))}")
    lines.append(f"- 产品行总数：{len(records)}")
    lines.append(f"- 唯一产品数量：{len(product_rows)}")
    lines.append("")
    lines.append("## 产品清单")
    lines.append("")
    lines.append("| 序号 | 场景 | 申请过的产品 | 出现次数 | 历史折扣候选 | 历史返佣候选 | 商务确认 |")
    lines.append("| ---: | --- | --- | ---: | --- | --- | --- |")

    sorted_rows = sorted(product_rows, key=lambda row: (row["category"], -row["count"], row["product_name"]))
    for index, row in enumerate(sorted_rows, start=1):
        lines.append(
            f"| {index} | {md_escape(row['category'])} | {md_escape(row['product_name'])} | "
            f"{row['count']} | {md_escape(row['discounts'])} | {md_escape(row['commissions'])} | 待确认 |"
        )

    lines.append("")
    lines.append("## 使用方式")
    lines.append("")
    lines.append("- 先用这张表和商务确认每个产品是否还在用、底价是多少、一般申请什么折扣和返佣。")
    lines.append("- 历史折扣候选只作为查问线索，不直接当规则。")
    lines.append("- 确认后再写入页面规则库，生成默认折扣、突破折扣、返佣上限和提醒阈值。")
    lines.append("")
    return "\n".join(lines)


def main():
    records, files = extract_records()
    OUTPUT.write_text(build_markdown(records, files), encoding="utf-8")
    PRODUCT_OUTPUT.write_text(build_product_catalog(records, files), encoding="utf-8")
    print(f"wrote {OUTPUT}")
    print(f"wrote {PRODUCT_OUTPUT}")
    print(f"files={len(files)} records={len(records)} emails_with_products={len(set(record.file_name for record in records))}")


if __name__ == "__main__":
    main()
