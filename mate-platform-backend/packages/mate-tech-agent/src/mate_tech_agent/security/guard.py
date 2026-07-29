"""Input guard: prompt injection + PII detection (TC-5.7.11).

Two checks:
1. Prompt injection: detect known jailbreak patterns
2. PII: detect phone/email/SSN patterns

Returns GuardResult with is_safe (bool), threats (list[str]), redacted_input (str).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# Common prompt injection patterns
_INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?previous\s+instructions",
    r"(?i)disregard\s+(all\s+)?prior",
    r"(?i)forget\s+(all\s+)?above",
    r"(?i)you\s+are\s+now\s+(a|an)\s+",
    r"(?i)act\s+as\s+(a|an)\s+",
    r"(?i)system\s*prompt\s*[:=]",
    r"(?i)reveal\s+(your|the)\s+(system|hidden)",
    r"(?i)jailbreak",
    r"(?i)bypass\s+(the\s+)?safety",
    r"(?i)pretend\s+(you|to\s+be)",
]

# PII patterns (basic US/global)
_PII_PATTERNS = {
    "phone": re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "email": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
}


@dataclass
class GuardResult:
    is_safe: bool
    threats: list[str] = field(default_factory=list)
    redacted_input: str = ""
    pii_found: dict[str, int] = field(default_factory=dict)

    def __bool__(self) -> bool:
        return self.is_safe


def guard_input(text: str) -> GuardResult:
    """Check user input for prompt injection and PII.

    Returns GuardResult with safety flag, threat list, and PII-redacted text.
    """
    threats: list[str] = []

    # 1. Prompt injection detection
    for pat in _INJECTION_PATTERNS:
        if re.search(pat, text):
            threats.append(f"prompt_injection:{pat[:40]}...")
            break

    # 2. PII detection + redaction
    pii_found: dict[str, int] = {}
    redacted = text
    for kind, pat in _PII_PATTERNS.items():
        matches = pat.findall(redacted)
        if matches:
            pii_found[kind] = len(matches)
            redacted = pat.sub(f"[REDACTED_{kind.upper()}]", redacted)

    is_safe = len(threats) == 0
    return GuardResult(
        is_safe=is_safe,
        threats=threats,
        redacted_input=redacted,
        pii_found=pii_found,
    )
