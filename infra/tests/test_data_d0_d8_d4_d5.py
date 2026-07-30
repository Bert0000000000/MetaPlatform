"""DATA-D0-D8 D4 + D5 e2e tests."""
from __future__ import annotations

import sys
from pathlib import Path

# Path setup so the test can import mate_platform.auth.audit
# (D5 cross-tenant audit). Conftest alone isn't always picked up
# for new test files in the same dir, so do it here.
_AUTH_SRC = (
    Path(__file__).resolve().parents[2]
    / "mate-platform-backend" / "packages" / "mate-platform" / "src"
)
if str(_AUTH_SRC) not in sys.path:
    sys.path.insert(0, str(_AUTH_SRC))

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"


class TestDataD4LineageCatalogSync:
    def test_datahub_values_has_lineage_section(self) -> None:
        text = (CHARTS / "datahub" / "values.yaml").read_text(encoding="utf-8")
        assert "lineage:" in text
        assert "marquezUrl" in text

    def test_datahub_pulls_from_marquez(self) -> None:
        text = (CHARTS / "datahub" / "values.yaml").read_text(encoding="utf-8")
        assert "pullIntervalSeconds" in text
        assert "openlineageVersion" in text

    def test_datahub_lineage_per_tenant(self) -> None:
        text = (CHARTS / "datahub" / "values.yaml").read_text(encoding="utf-8")
        assert "partitionByCorpGroup: true" in text


class TestDataD5CrossTenantAuditModule:
    def test_audit_module_exists(self) -> None:
        path = (
            Path(__file__).resolve().parents[2]
            / "mate-platform-backend" / "packages" / "mate-platform" / "src" / "mate_platform" / "auth" / "audit.py"
        )
        assert path.is_file(), f"auth/audit.py missing at {path}"

    def test_audit_emits_no_op_in_tenant(self) -> None:
        from mate_platform.auth.audit import (
            InMemoryAuditSink, emit_cross_tenant_data_access,
        )
        sink = InMemoryAuditSink()
        emit_cross_tenant_data_access(
            actor_user_id="u1", actor_tenant_id="t1", target_tenant_id="t1",
            operation="READ", dataset="x", trace_id="t", sink=sink,
        )
        assert sink.all() == []

    def test_audit_emits_cross_tenant(self) -> None:
        from mate_platform.auth.audit import (
            InMemoryAuditSink, emit_cross_tenant_data_access,
        )
        sink = InMemoryAuditSink()
        emit_cross_tenant_data_access(
            actor_user_id="u1", actor_tenant_id="a", target_tenant_id="b",
            operation="READ", dataset="iam.user", trace_id="t1", sink=sink,
        )
        assert len(sink.all()) == 1

    def test_audit_has_trace_id(self) -> None:
        from mate_platform.auth.audit import (
            InMemoryAuditSink, emit_cross_tenant_data_access,
        )
        sink = InMemoryAuditSink()
        emit_cross_tenant_data_access(
            actor_user_id="u", actor_tenant_id="a", target_tenant_id="b",
            operation="READ", dataset="x", trace_id="trace-42", sink=sink,
        )
        assert sink.all()[0].trace_id == "trace-42"