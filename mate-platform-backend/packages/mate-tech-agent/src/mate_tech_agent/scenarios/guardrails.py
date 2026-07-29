"""安全护栏 (ST-5.7.11).

输入检查（prompt injection）+ 输出检查（PII）。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class GuardrailResult:
    """护栏检查结果."""

    passed: bool
    reason: str = ""
    sanitized: str = ""


# 常见 prompt injection 模式
_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(previous|all|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+", re.IGNORECASE),
    re.compile(r"forget\s+(everything|all)", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"<\|.*?\|>", re.IGNORECASE),  # 特殊 token
    re.compile(r"###\s*instruction", re.IGNORECASE),
]

# PII 模式
_PII_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("phone_cn", re.compile(r"\b1[3-9]\d{9}\b")),
    ("id_card_cn", re.compile(r"\b\d{17}[\dXx]\b")),
    ("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
]


def check_input(text: str) -> GuardrailResult:
    """检查用户输入是否含 prompt injection."""
    for pat in _INJECTION_PATTERNS:
        if pat.search(text):
            logger.warning("guardrail.input.injection_detected", pattern=pat.pattern)
            return GuardrailResult(passed=False, reason="prompt_injection_detected")
    return GuardrailResult(passed=True, sanitized=text)


def check_output(text: str) -> GuardrailResult:
    """检查输出是否含 PII，含则脱敏."""
    sanitized = text
    has_pii = False
    for name, pat in _PII_PATTERNS:
        new_text, n = pat.subn(f"[REDACTED_{name.upper()}]", sanitized)
        if n > 0:
            sanitized = new_text
            has_pii = True
    if has_pii:
        logger.warning("guardrail.output.pii_redacted")
    return GuardrailResult(passed=True, sanitized=sanitized)
