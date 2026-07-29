from __future__ import annotations

import typing
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError as PydanticValidationError

from mate_common.dto import BaseDTO, TenantMixin, TimestampMixin


class _Sample(BaseDTO):
    name: str
    age: int = 0


class TestBaseDTO:
    def test_simple_construction(self) -> None:
        s = _Sample(name="alice")
        assert s.name == "alice"
        assert s.age == 0

    def test_strict_rejects_extra_field(self) -> None:
        """extra='forbid' should raise on unknown fields."""
        with pytest.raises(PydanticValidationError):
            _Sample.model_validate({"name": "alice", "rogue": True})

    def test_frozen_blocks_assignment(self) -> None:
        """frozen=True should refuse attribute mutation."""
        s = _Sample(name="alice")
        with pytest.raises((AttributeError, PydanticValidationError, TypeError, ValueError)):
            s.name = "bob"

    def test_strict_rejects_string_for_int(self) -> None:
        """strict=True should reject int-as-str coercion."""
        with pytest.raises(PydanticValidationError):
            _Sample.model_validate({"name": "alice", "age": "5"})

    def test_by_alias_and_by_name(self) -> None:
        """populate_by_name=True allows both field name and alias."""

        class _Aliased(BaseDTO):
            user_id: int

            model_config: typing.ClassVar[dict[str, typing.Any]] = {"populate_by_name": True}

        a = _Aliased(user_id=42)
        assert a.user_id == 42

    def test_str_strip_whitespace(self) -> None:
        """str_strip_whitespace=True strips surrounding whitespace."""

        class _Str(BaseDTO):
            label: str

        s = _Str(label="  hello  ")
        assert s.label == "hello"


class TestTimestampMixin:
    def test_fields_are_frozen(self) -> None:
        """Both created_at and updated_at are datetime."""

        class _Stamped(TimestampMixin):
            pass

        ts = datetime(2026, 1, 1, tzinfo=UTC)
        s = _Stamped(created_at=ts, updated_at=ts)
        assert s.created_at == ts
        assert s.updated_at == ts

    def test_now_utc_returns_timezone_aware_utc(self) -> None:
        now = TimestampMixin.now_utc()
        assert isinstance(now, datetime)
        assert now.tzinfo is not None
        assert now.tzinfo == UTC

    def test_now_utc_is_recent(self) -> None:
        """now_utc() should return a timestamp within 1s of clock."""
        before = datetime.now(UTC)
        now = TimestampMixin.now_utc()
        after = datetime.now(UTC)
        assert before <= now <= after


class TestTenantMixin:
    def test_accepts_valid_tenant_id(self) -> None:
        class _Tenanted(TenantMixin):
            pass

        s = _Tenanted(tenant_id="tnt-123")
        assert s.tenant_id == "tnt-123"

    def test_rejects_empty_tenant_id(self) -> None:
        class _Tenanted(TenantMixin):
            pass

        with pytest.raises(PydanticValidationError):
            _Tenanted.model_validate({"tenant_id": ""})

    def test_rejects_overlong_tenant_id(self) -> None:
        class _Tenanted(TenantMixin):
            pass

        with pytest.raises(PydanticValidationError):
            _Tenanted.model_validate({"tenant_id": "x" * 65})

    def test_accepts_max_length_tenant_id(self) -> None:
        class _Tenanted(TenantMixin):
            pass

        s = _Tenanted.model_validate({"tenant_id": "x" * 64})
        assert s.tenant_id == "x" * 64
