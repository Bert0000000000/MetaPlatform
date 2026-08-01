"""DATA-D0-D8 D7 e2e tests — unified PII detection + redaction.

Verifies:
  - CN phone, ID card, email, credit_card detected + masked
  - Irreversible mode replaces with mask token
  - Reversible mode preserves kind label
  - dict payload redaction with field-level metadata
  - No PII passes through unchanged
  - Per-tenant policy controls enabled kinds
  - Alembic 0011 schema valid
"""
from __future__ import annotations

import pytest

from mate_platform.security import (
    ALL_KINDS,
    PIIEngine,
    PIIPolicy,
    has_pii,
    mask_pii,
)


class TestDetection:
    def test_detect_cn_phone(self) -> None:
        engine = PIIEngine()
        matches = engine.detect("我的手机是13800138000请联系")
        kinds = {m.kind for m in matches}
        assert "phone_cn" in kinds

    def test_detect_id_card(self) -> None:
        engine = PIIEngine()
        matches = engine.detect("身份证110101199003078888")
        kinds = {m.kind for m in matches}
        assert "id_card_cn" in kinds

    def test_detect_email(self) -> None:
        engine = PIIEngine()
        matches = engine.detect("发到user@example.com")
        kinds = {m.kind for m in matches}
        assert "email" in kinds

    def test_detect_multiple_kinds(self) -> None:
        engine = PIIEngine()
        text = "手机13800138000 邮箱a@b.com 身份证110101199003078888"
        matches = engine.detect(text)
        kinds = {m.kind for m in matches}
        assert "phone_cn" in kinds
        assert "email" in kinds
        assert "id_card_cn" in kinds

    def test_no_pii_returns_empty(self) -> None:
        engine = PIIEngine()
        assert engine.detect("普通文本无敏感信息") == []


class TestMasking:
    def test_mask_replaces_with_token(self) -> None:
        engine = PIIEngine(PIIPolicy(mask_token="***"))
        result = engine.apply("手机13800138000")
        assert "13800138000" not in result.redacted
        assert "***" in result.redacted
        assert result.has_pii

    def test_mask_preserves_non_pii_text(self) -> None:
        engine = PIIEngine()
        result = engine.apply("Hello world 你好世界")
        assert result.redacted == "Hello world 你好世界"
        assert not result.has_pii

    def test_reversible_mode_adds_kind_label(self) -> None:
        engine = PIIEngine(
            PIIPolicy(reversible=True, mask_token="[REDACTED]")
        )
        result = engine.apply("手机13800138000邮箱a@b.com")
        assert "13800138000" not in result.redacted
        assert "a@b.com" not in result.redacted
        # Reversible mode preserves kind label in the token
        assert "PHONE_CN" in result.redacted
        assert "EMAIL" in result.redacted

    def test_module_level_mask_pii_compat(self) -> None:
        """mask_pii() is compatible with llmgw's mask_pii."""
        masked = mask_pii("手机13800138000")
        assert "13800138000" not in masked

    def test_module_level_has_pii(self) -> None:
        assert has_pii("13800138000") is True
        assert has_pii("user@example.com") is True
        assert has_pii("hello") is False


class TestPolicyControl:
    def test_disabled_kind_not_detected(self) -> None:
        # Only phone_cn enabled; email should pass through
        engine = PIIEngine(
            PIIPolicy(enabled_kinds=("phone_cn",), mask_token="***")
        )
        result = engine.apply("手机13800138000邮箱a@b.com")
        assert "13800138000" not in result.redacted
        assert "a@b.com" in result.redacted  # not masked

    def test_custom_mask_token(self) -> None:
        engine = PIIEngine(PIIPolicy(mask_token="[HIDDEN]"))
        result = engine.apply("手机13800138000")
        assert "[HIDDEN]" in result.redacted

    def test_all_kinds_registered(self) -> None:
        assert "phone_cn" in ALL_KINDS
        assert "id_card_cn" in ALL_KINDS
        assert "email" in ALL_KINDS
        assert "ssn" in ALL_KINDS
        assert "ip_v4" in ALL_KINDS
        assert len(ALL_KINDS) >= 6


class TestDictRedaction:
    def test_apply_dict_redacts_string_fields(self) -> None:
        engine = PIIEngine(PIIPolicy(mask_token="***"))
        payload = {
            "name": "张三",
            "phone": "我的手机是13800138000",
            "email": "user@example.com",
            "age": 30,
        }
        out, matches = engine.apply_dict(payload)
        assert "13800138000" not in out["phone"]
        assert "user@example.com" not in out["email"]
        assert out["age"] == 30  # non-string untouched
        # Matches carry field names
        fields = {m.field for m in matches}
        assert "phone" in fields
        assert "email" in fields

    def test_apply_dict_scoped_fields(self) -> None:
        engine = PIIEngine(PIIPolicy(mask_token="***"))
        payload = {"a": "13800138000", "b": "user@example.com"}
        out, matches = engine.apply_dict(payload, fields=["a"])
        assert "13800138000" not in out["a"]
        assert "user@example.com" in out["b"]  # field b not scoped


class TestAlembic0011Schema:
    def test_migration_module_valid(self) -> None:
        import importlib.util
        from pathlib import Path

        migration_path = (
            Path(__file__).resolve().parents[3]
            / "alembic"
            / "versions"
            / "20260801_0011_pii_policy.py"
        )
        assert migration_path.is_file(), "alembic 0011 file missing"
        spec = importlib.util.spec_from_file_location("m0011", migration_path)
        assert spec is not None and spec.loader is not None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert mod.revision == "0011_pii_policy"
        assert mod.down_revision == "0010_retention"
        assert callable(mod.upgrade)
        assert callable(mod.downgrade)
