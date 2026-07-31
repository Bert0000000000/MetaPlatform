"""Password hashing helpers.

Uses bcrypt directly (passlib + bcrypt 4.x has API drift issues). Falls back to
PBKDF2-HMAC-SHA256 if bcrypt is not importable.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

try:  # pragma: no cover
    import bcrypt as _bcrypt

    def hash_password(plain: str) -> str:
        pw = plain.encode("utf-8")[:72]
        salt = _bcrypt.gensalt(rounds=12)
        return _bcrypt.hashpw(pw, salt).decode("utf-8")

    def verify_password(plain: str, hashed: str) -> bool:
        if not hashed:
            return False
        try:
            return _bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
        except Exception:
            return False

except ImportError:  # pragma: no cover
    _ALGO = "sha256"
    _ITERS = 200_000

    def hash_password(plain: str) -> str:
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac(_ALGO, plain.encode("utf-8"), salt.encode("utf-8"), _ITERS).hex()
        return "pbkdf2_" + _ALGO + "$" + str(_ITERS) + "$" + salt + "$" + digest

    def verify_password(plain: str, hashed: str) -> bool:
        try:
            scheme, iters_s, salt, digest = hashed.split("$", 3)
        except ValueError:
            return False
        if not scheme.startswith("pbkdf2_"):
            return False
        try:
            iters = int(iters_s)
        except ValueError:
            return False
        algo = scheme.split("_", 1)[1]
        candidate = hashlib.pbkdf2_hmac(algo, plain.encode("utf-8"), salt.encode("utf-8"), iters).hex()
        return hmac.compare_digest(candidate, digest)


def generate_random_password(length: int = 12) -> str:
    """Generate a URL-safe random password suitable for first-login or reset."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))
