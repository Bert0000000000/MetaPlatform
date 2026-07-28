"""Tests for password hashing and JWT helpers."""
from __future__ import annotations

from mate_tech_iam.services.security import (
    generate_random_password,
    hash_password,
    verify_password,
)


def test_password_roundtrip():
    pw = "my-secret-password"
    h = hash_password(pw)
    assert h != pw
    assert verify_password(pw, h) is True
    assert verify_password("wrong", h) is False


def test_generate_random_password():
    pw1 = generate_random_password()
    pw2 = generate_random_password()
    assert len(pw1) >= 8
    assert len(pw2) >= 8
    assert pw1 != pw2  # statistically safe


def test_bcrypt_truncates_long_passwords():
    long_pw = "x" * 200
    h = hash_password(long_pw)
    assert verify_password(long_pw, h)