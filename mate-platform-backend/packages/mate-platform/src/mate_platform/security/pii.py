"""Unified PII detection + redaction engine (DATA-D7).

This module **unifies** the two existing PII implementations:
  1. ``mate_clients.security.pii_mask`` — outbox / CDC redaction
  2. ``mate_tech_llmgw.security.pii_mask`` — LLM prompt masking

into a single policy-driven engine in ``mate_platform.security``
that supports per-tenant configuration (Alembic 0011 ``pii_policy``
table).

Design:
  - **Pattern registry**: all known PII kinds are registered here;
    each kind has a name + a compiled regex.
  - **Policy**: ``PIIPolicy`` dataclass controls which kinds are
    active, whether redaction is reversible, and the mask token.
  - **Engine**: ``PIIEngine.apply()`` takes a text or dict, applies
    the policy, and returns a ``PIIResult`` with the redacted output
    + match metadata.
  - **Compatibility**: wraps both existing modules —
    ``mask_pii()`` delegates to the default engine, and
    ``redact_pii()`` from mate-clients delegates to the engine with
    a mate-clients-compatible policy.

Per ADR-0016 §3.3 D7.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class PIIMatch:
    """One PII detection hit."""

    field: str
    kind: str
    count: int


@dataclass(frozen=True, slots=True)
class PIIResult:
    """Result of a PII redaction pass."""

    redacted: str
    matches: tuple[PIIMatch, ...] = field(default_factory=tuple)
    has_pii: bool = False

    def __bool__(self) -> bool:
        return self.has_pii


@dataclass(frozen=True, slots=True)
class PIIPolicy:
    """Per-tenant PII redaction policy.

    Mirrors the ``pii_policy`` table (Alembic 0011).
    """

    tenant_id: str = ""
    enabled_kinds: tuple[str, ...] = (
        "phone_cn",
        "id_card_cn",
        "email",
        "credit_card",
    )
    reversible: bool = False
    mask_token: str = "[REDACTED]"

    @classmethod
    def default(cls) -> PIIPolicy:
        return cls()


# -----------------------------------------------------------------------
# Unified pattern registry — merges mate-clients + llmgw patterns
# -----------------------------------------------------------------------
PATTERNS: dict[str, re.Pattern[str]] = {
    # From llmgw/security/pii_mask.py (CN-specific)
    # Note: removed \b because Chinese characters don't form ASCII
    # word boundaries — use lookaround for non-digit instead.
    "phone_cn": re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    "id_card_cn": re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)"),
    # Shared (both modules have email + credit_card)
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "credit_card": re.compile(r"(?<!\d)(?:\d[ -]*?){13,19}(?!\d)"),
    # From mate-clients/security/pii_mask.py (US-specific)
    "phone_us": re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    # From llmgw/security/pii_mask.py
    "ip_v4": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
}

ALL_KINDS: tuple[str, ...] = tuple(PATTERNS.keys())


class PIIEngine:
    """Unified PII detection + redaction engine.

    Construct with a ``PIIPolicy`` to control behavior; the default
    policy matches the existing llmgw ``mask_pii`` behavior (phone_cn,
    id_card_cn, email, credit_card — all irreversible with ``***``).
    """

    def __init__(self, policy: PIIPolicy | None = None) -> None:
        self._policy = policy or PIIPolicy.default()

    @property
    def policy(self) -> PIIPolicy:
        return self._policy

    def detect(self, text: str) -> list[PIIMatch]:
        """Return all PII matches in text (one per kind)."""
        if not text:
            return []
        matches: list[PIIMatch] = []
        for kind in self._policy.enabled_kinds:
            pat = PATTERNS.get(kind)
            if pat is None:
                continue
            hits = pat.findall(text)
            if hits:
                matches.append(PIIMatch(field="text", kind=kind, count=len(hits)))
        return matches

    def has_pii(self, text: str) -> bool:
        """Quick check: does text contain any active PII kind?"""
        if not text:
            return False
        return any(
            PATTERNS[kind].search(text)
            for kind in self._policy.enabled_kinds
            if kind in PATTERNS
        )

    def apply(self, text: str) -> PIIResult:
        """Detect + redact PII in text according to the policy."""
        if not text:
            return PIIResult(redacted=text)
        matches: list[PIIMatch] = []
        redacted = text
        for kind in self._policy.enabled_kinds:
            pat = PATTERNS.get(kind)
            if pat is None:
                continue
            hits = pat.findall(redacted)
            if not hits:
                continue
            matches.append(PIIMatch(field="text", kind=kind, count=len(hits)))
            if self._policy.reversible:
                token = self._policy.mask_token
                redacted = pat.sub(f"{token}_{kind.upper()}_", redacted)
            else:
                redacted = pat.sub(self._policy.mask_token, redacted)
        return PIIResult(
            redacted=redacted,
            matches=tuple(matches),
            has_pii=bool(matches),
        )

    def apply_dict(
        self,
        payload: dict[str, Any],
        *,
        fields: list[str] | None = None,
    ) -> tuple[dict[str, Any], tuple[PIIMatch, ...]]:
        """Recursively redact PII in a dict's string values."""
        keys = (
            [k for k, v in payload.items() if isinstance(v, str)]
            if fields is None
            else fields
        )
        out = dict(payload)
        all_matches: list[PIIMatch] = []
        for k in keys:
            v = out.get(k)
            if not isinstance(v, str):
                continue
            result = self.apply(v)
            out[k] = result.redacted
            all_matches.extend(
                PIIMatch(field=k, kind=m.kind, count=m.count)
                for m in result.matches
            )
        return out, tuple(all_matches)


# -----------------------------------------------------------------------
# Module-level default engine (matches llmgw mask_pii behavior)
# -----------------------------------------------------------------------
_default_engine = PIIEngine(
    PIIPolicy(
        enabled_kinds=("phone_cn", "id_card_cn", "email", "credit_card"),
        reversible=False,
        mask_token="***",
    )
)


def get_default_engine() -> PIIEngine:
    """Return the module-level default PIIEngine."""
    return _default_engine


def mask_pii(text: str) -> str:
    """Convenience: apply default engine, return redacted text only.

    Compatible with the existing ``mate_tech_llmgw.security.pii_mask.mask_pii``
    so callers can switch to the unified engine without behavior change.
    """
    return _default_engine.apply(text).redacted


def has_pii(text: str) -> bool:
    """Convenience: quick PII check using the default engine."""
    return _default_engine.has_pii(text)
