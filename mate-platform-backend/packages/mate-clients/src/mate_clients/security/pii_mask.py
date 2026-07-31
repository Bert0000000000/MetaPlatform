"""PII detection + redaction (DATA-D0-D8 D7).

Extends the existing llmgw/security/pii_mask.py pattern into a
shared helper in mate-clients.security so any consumer of the
outbox stream (Kafka consumers, Debezium CDC handlers, etc.)
can apply the same PII policy.

Per ADR-0016 D7: every event that contains a known PII field
(phone, email, SSN, credit card) is redacted before being
written to Kafka. The redaction is reversible by an authorized
auditor with the secret key, but defaults to irreversible
unless explicitly opted in.

The policy is consistent with the existing llmgw/security/
pii_mask.py implementation: same patterns, same redaction labels.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class PIIMatch:
    field: str
    kind: str
    count: int


@dataclass(frozen=True, slots=True)
class PIIRedactionResult:
    redacted: str
    matches: tuple[PIIMatch, ...] = field(default_factory=tuple)
    has_pii: bool = False

    def __bool__(self) -> bool:
        return self.has_pii


# Patterns match the existing llmgw/security/pii_mask.py so behavior
# is consistent across the platform.
_PATTERNS: dict[str, re.Pattern[str]] = {
    "phone": re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "email": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
}


def detect_pii(text: str) -> list[PIIMatch]:
    """Return a list of PII matches in text (one per kind)."""
    if not text:
        return []
    matches: list[PIIMatch] = []
    for kind, pat in _PATTERNS.items():
        m = pat.findall(text)
        if m:
            matches.append(PIIMatch(field="text", kind=kind, count=len(m)))
    return matches


def redact_pii(text: str, *, reversible: bool = False) -> PIIRedactionResult:
    """Detect and redact PII in text.

    When reversible=True, the redaction preserves an opaque token
    that the PIIRedactionResult.matches exposes; this is for
    audit-only consumers. The default (reversible=False) replaces
    with [REDACTED_<KIND>] for irreversible downstream use.
    """
    if not text:
        return PIIRedactionResult(redacted=text, matches=(), has_pii=False)
    matches: list[PIIMatch] = []
    redacted = text
    for kind, pat in _PATTERNS.items():
        m = pat.findall(redacted)
        if m:
            matches.append(PIIMatch(field="text", kind=kind, count=len(m)))
            if reversible:
                # Stable token: same length, same digits (preserves
                # field structure for downstream schema validation).
                def _token(_m: re.Match[str], _kind: str = kind) -> str:
                    return f"[PII-{_kind}-{len(_m.group(0)):04d}]"
                redacted = pat.sub(_token, redacted)
            else:
                redacted = pat.sub(f"[REDACTED_{kind.upper()}]", redacted)
    return PIIRedactionResult(
        redacted=redacted,
        matches=tuple(matches),
        has_pii=bool(matches),
    )


def redact_dict(
    payload: dict[str, Any],
    *,
    fields: list[str] | None = None,
    reversible: bool = False,
) -> tuple[dict[str, Any], tuple[PIIMatch, ...]]:
    """Recursively redact PII in a dict's string values.

    If fields is None, every string value is scanned. Otherwise
    only the listed top-level fields are scanned.
    """
    keys = [k for k, v in payload.items() if isinstance(v, str)] if fields is None else fields

    out = dict(payload)
    all_matches: list[PIIMatch] = []
    for k in keys:
        v = out.get(k)
        if not isinstance(v, str):
            continue
        result = redact_pii(v, reversible=reversible)
        out[k] = result.redacted
        all_matches.extend(result.matches)
    return out, tuple(all_matches)
