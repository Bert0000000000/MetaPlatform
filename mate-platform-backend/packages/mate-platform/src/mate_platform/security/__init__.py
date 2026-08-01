"""mate_platform.security — unified PII engine (D7)."""
from .pii import (
    ALL_KINDS,
    PATTERNS,
    PIIEngine,
    PIIMatch,
    PIIPolicy,
    PIIResult,
    get_default_engine,
    has_pii,
    mask_pii,
)

__all__ = [
    "ALL_KINDS",
    "PATTERNS",
    "PIIEngine",
    "PIIMatch",
    "PIIPolicy",
    "PIIResult",
    "get_default_engine",
    "has_pii",
    "mask_pii",
]
