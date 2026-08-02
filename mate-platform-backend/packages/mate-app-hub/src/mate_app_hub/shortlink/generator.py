"""Short-code generator (APPHUB-RUNTIME-01 phase C).

Uses a base62 alphabet that excludes visually ambiguous characters
(0 / O / 1 / I / l) so generated codes are safe to read off-screen
and type by hand.

Codes are generated with :mod:`secrets` so they remain collision-
resistant under the same security posture as other token-like
identifiers in the platform (even though short codes themselves are
public URL aliases, not secrets).
"""
from __future__ import annotations

import secrets

# base62 alphabet (避开 0/O/1/I/l)
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz"


def generate_code(length: int = 8) -> str:
    """Generate a random base62 short code."""
    return "".join(secrets.choice(ALPHABET) for _ in range(length))
