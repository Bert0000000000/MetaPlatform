"""Unit tests for scripts/ci/forbid_external_secret_plain.py (G2 rule 12)."""
from __future__ import annotations

import tempfile
from pathlib import Path

from forbid_external_secret_plain import (  # type: ignore[import-not-found]
    check_file,
    check_line,
)


def test_detects_inline_password() -> None:
    assert check_line("password: supersecret") == "password"


def test_detects_inline_apikey() -> None:
    assert check_line("apiKey: sk-live-1234567890") == "apiKey"


def test_allows_existing_secret_name() -> None:
    # The reference form is the sanctioned pattern.
    assert check_line("existingSecretName: keycloak-db") is None
    assert check_line("existingSecretKey: password") is None
    assert check_line("secretName: postgresql-credentials") is None


def test_allows_empty_value() -> None:
    assert check_line("password:") is None
    assert check_line('password: ""') is None
    assert check_line("password: null") is None


def test_allows_env_var_reference() -> None:
    assert check_line("password: ${DB_PASSWORD}") is None
    assert check_line("password: {{ .Values.db.password }}") is None
    # angle-bracket placeholder (used in SealedSecret template comments)
    assert check_line('password: "<your-strong-password>"') is None


def test_templates_dir_not_scanned() -> None:
    # SealedSecret encryptedData blobs live under templates/ and must
    # not be treated as inline plaintext secrets.
    with tempfile.TemporaryDirectory() as d:
        f = (
            Path(d)
            / "infra"
            / "helm"
            / "charts"
            / "pg"
            / "templates"
            / "sealedsecret.yaml"
        )
        f.parent.mkdir(parents=True)
        f.write_text(
            "spec:\n  encryptedData:\n    password: AgBhAAAA\n",
            encoding="utf-8",
        )
        assert check_file(f) == []
