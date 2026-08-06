"""MODEL-02 持久化 row ↔ KERNEL-01 dataclass 转换测试。"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from mate_kernel.ontology import ClassRef, Property, PropertyFormat, Version
from mate_kernel.ontology.persistence import (
    ClassRefRow,
    PropertyRow,
    VersionRow,
)


class TestClassRefRow:
    def test_from_to_roundtrip(self) -> None:
        cr = ClassRef("ont.acme.obj.order")
        row = ClassRefRow.from_class_ref(cr)
        assert row.tenant_id == "acme"
        assert row.kind == "obj"
        assert row.rest == "order"
        assert row.to_class_ref() == cr


class TestVersionRow:
    def _v(self) -> Version:
        return Version(
            rid="ont.acme.ver.cls-order.v1",
            class_ref=ClassRef("ont.acme.cls.order"),
            parent_rid=None,
            created_at=datetime(2026, 8, 6, tzinfo=timezone.utc),
            author="alice",
            change_set=("init",),
        )

    def test_from_to_roundtrip(self) -> None:
        v = self._v()
        row = VersionRow.from_version(v)
        assert row.rid == "ont.acme.ver.cls-order.v1"
        assert row.parent_rid is None
        assert row.to_version() == v


class TestPropertyRow:
    def test_roundtrip(self) -> None:
        p = Property(
            rid=ClassRef("ont.acme.prop.string.name"),
            type_id="string",
            nullable=False,
            primary_key=False,
            title="Name",
            format=PropertyFormat.STRING,
        )
        row = PropertyRow.from_property(p)
        assert row.format == "string"
        assert row.to_property() == p


class TestDDL:
    def test_ddl_statements_count(self) -> None:
        # 4 tables / indexes
        from mate_kernel.ontology.persistence import DDL_STATEMENTS
        assert len(DDL_STATEMENTS) == 4
        # 全部 idempotent
        for ddl in DDL_STATEMENTS:
            assert "CREATE" in ddl.upper()