"""PII 自动脱敏 (ST-5.5.11.1).

敏感字段(手机号、身份证、邮箱)送 LLM 前自动打码。
"""
from __future__ import annotations

import re

import structlog

logger = structlog.get_logger(__name__)

# 常见 PII 模式
PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "phone_cn": re.compile(r"\b1[3-9]\d{9}\b"),
    "id_card_cn": re.compile(r"\b\d{17}[\dXx]\b"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
    "ip_v4": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
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