import re
import unicodedata
from difflib import SequenceMatcher

NOISE_TOKENS = ["全版本", "（全版本）", "(全版本)"]


def normalize_name(name: str) -> str:
    if not name:
        return ""
    text = unicodedata.normalize("NFKC", name)
    for token in NOISE_TOKENS:
        text = text.replace(token, "")
    text = text.replace("（", "(").replace("）", ")")
    text = re.sub(r"\s+", "", text)
    text = text.strip(" -—_/、,，:：;；")
    return text.lower()


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def token_set(name: str) -> set:
    norm = normalize_name(name)
    return set(re.split(r"[-_/()（）·]+", norm))


def jaccard(a: str, b: str) -> float:
    sa, sb = token_set(a), token_set(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)
