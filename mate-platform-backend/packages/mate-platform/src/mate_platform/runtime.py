"""Runtime profile helpers shared by services.

Development and test environments may use deterministic local adapters, but
staging/production must never turn an unavailable dependency into a fake
success.  The profile is explicit so local acceptance remains unchanged.
"""
from __future__ import annotations

import os

_PRODUCTION_PROFILES = frozenset({"production", "prod", "staging"})


def runtime_profile() -> str:
    """Return the normalized deployment profile.

    ``development`` is intentionally the default for local acceptance. CI and
    deployed environments should set ``MATE_PROFILE`` explicitly.
    """
    return os.getenv("MATE_PROFILE", "development").strip().lower() or "development"


def is_production_profile() -> bool:
    """Whether the current process must fail closed on synthetic adapters."""
    return runtime_profile() in _PRODUCTION_PROFILES


def require_real_dependency(feature: str, configured: bool) -> None:
    """Reject a missing production dependency with an actionable error."""
    if is_production_profile() and not configured:
        raise RuntimeError(
            f"{feature} is required in {runtime_profile()} profile; "
            "synthetic fallback is disabled"
        )


def reject_production_fallback(feature: str) -> None:
    """Raise when a production request would otherwise use a fake result."""
    if is_production_profile():
        raise RuntimeError(
            f"{feature} unavailable in {runtime_profile()} profile; "
            "synthetic fallback is disabled"
        )
