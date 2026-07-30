from typing import Final

_ALLOWED_PROFILES: Final[frozenset[str]] = frozenset({"test", "local-dev"})

def assert_fake_allowed(*, profile: str) -> None:
    """Refuse to load fake adapters in production profiles."""
    if profile not in _ALLOWED_PROFILES:
        raise RuntimeError(
            f"Fake ACL adapter forbidden in profile {profile!r}; use real implementation"
        )
