"""Short-code generator (APPHUB-RUNTIME-01 phase C).

Uses a base62 alphabet that excludes visually ambiguous characters
(0 / O / 1 / I / l) so generated codes are safe to read off-screen
and type by hand.
"""
from __future__ import annotations

import random
import string

# base62 alphabet (避开 0/O/1/I/l)
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz"


def generate_code(length: int = 8) -> str:
    """Generate a random base62 short code."""
    return "".join(random.choices(ALPHABET, k=length))
