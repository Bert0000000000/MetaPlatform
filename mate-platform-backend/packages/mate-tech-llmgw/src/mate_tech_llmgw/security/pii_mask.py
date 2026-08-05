"""PII 自动脱敏 (ST-5.5.11.1).

敏感字段(手机号、身份证、邮箱)送 LLM 前自动打码。
"""
from __future__ import annotations

import re

import structlog

logger = structlog.get_logger(__name__)

# 常见 PII 模式
#
# We deliberately avoid \b in the patterns because PII values
# commonly appear adjacent to CJK characters (e.g. "我的手机是
# 13800138000"), and \b in Python's re module is an ASCII
# word-boundary: a CJK character is itself a \w so \b never fires
# at the transition. Instead we use lookarounds anchored on the
# non-digit / non-letter boundary so we match the phone number
# regardless of which script flanks it.
PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "phone_cn": re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    "id_card_cn": re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)"),
    "email": re.compile(r"(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![A-Za-z0-9])"),
    "credit_card": re.compile(r"(?<!\d)(?:\d[ -]*?){13,19}(?!\d)"),
    "ip_v4": re.compile(r"(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)"),
}

# 默认打码替换
DEFAULT_MASK = "***"


def mask_pii(
    text: str,
    *,
    patterns: dict[str, re.Pattern[str]] | None = None,
    mask: str = DEFAULT_MASK,
) -> str:
    """对文本中的 PII 自动打码.

    Args:
        text: 输入文本
        patterns: 自定义 PII pattern;不传则用默认 5 种
        mask: 替换字符串

    Returns:
        打码后的文本 + 命中统计在 logger
    """
    pii_patterns = patterns or PII_PATTERNS
    masked = text
    hits = {}
    for name, pat in pii_patterns.items():
        new_masked, n = pat.subn(mask, masked)
        if n > 0:
            hits[name] = n
            masked = new_masked

    if hits:
        logger.info("pii.masked", hits=hits)
    return masked


def has_pii(text: str, patterns: dict[str, re.Pattern[str]] | None = None) -> bool:
    """快速检查是否含 PII."""
    pii_patterns = patterns or PII_PATTERNS
    return any(pat.search(text) for pat in pii_patterns.values())