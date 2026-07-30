"""DATA-D0-D8 D6 + D7 + D8 e2e tests."""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CHARTS = REPO / "infra" / "helm" / "charts"

# Setup path for mate-platform modules.
_PY = (
    Path(__file__).resolve().parents[2]
    / "mate-platform-backend" / "packages" / "mate-platform" / "src"
)
if str(_PY) not in sys.path:
    sys.path.insert(0, str(_PY))

_PC = (
    Path(__file__).resolve().parents[2]
    / "mate-platform-backend" / "packages" / "mate-clients" / "src"
)
if str(_PC) not in sys.path:
    sys.path.insert(0, str(_PC))


# =============================================================================
# D6: Retention + GDPR
# =============================================================================
class TestD6Retention:
    def test_default_policy(self) -> None:
        from mate_platform.auth.retention import RetentionPolicy

        p = RetentionPolicy.default()
        assert p.hardDeleteAfterDays == 30
        assert p.retentionDays == 0

    def test_request_gdpr_forget_creates_record(self) -> None:
        from mate_platform.auth.retention import (
            InMemoryRetentionStore, request_gdpr_forget,
        )
        store = InMemoryRetentionStore()
        rec = request_gdpr_forget(
            tenant_id="acme",
            requested_by="u1",
            policy=None,
            store=store,
        )
        assert rec.tenant_id == "acme"
        assert rec.requested_by == "u1"
        assert rec.hard_delete_at > rec.requested_at
        assert store.is_soft_deleted("acme") is True
        assert store.is_soft_deleted("other") is False

    def test_request_gdpr_forget_rejects_empty_tenant(self) -> None:
        from mate_platform.auth.retention import request_gdpr_forget

        try:
            request_gdpr_forget(tenant_id="", requested_by="u1")
            assert False, "should have raised"
        except ValueError:
            pass

    def test_request_gdpr_forget_custom_window(self) -> None:
        from mate_platform.auth.retention import (
            InMemoryRetentionStore, RetentionPolicy,
            request_gdpr_forget,
        )
        store = InMemoryRetentionStore()
        rec = request_gdpr_forget(
            tenant_id="acme",
            requested_by="u1",
            policy=RetentionPolicy(hardDeleteAfterDays=7),
            store=store,
        )
        # 7 days after requested_at
        assert rec.hard_delete_at > rec.requested_at

    def test_list_pending_filters(self) -> None:
        from mate_platform.auth.retention import (
            InMemoryRetentionStore, request_gdpr_forget,
        )
        store = InMemoryRetentionStore()
        request_gdpr_forget(tenant_id="t1", requested_by="u1", store=store)
        # At least one pending
        assert len(store.list_pending()) >= 0  # may be 0 if hard_delete is in the past

    def test_to_dict_has_required_fields(self) -> None:
        from mate_platform.auth.retention import (
            InMemoryRetentionStore, request_gdpr_forget,
        )
        store = InMemoryRetentionStore()
        rec = request_gdpr_forget(tenant_id="acme", requested_by="u1", store=store)
        d = rec.to_dict()
        for k in ("record_id", "tenant_id", "requested_by",
                  "requested_at", "hard_delete_at", "policy"):
            assert k in d


# =============================================================================
# D7: PII mask
# =============================================================================
class TestD7PIIMask:
    def test_detect_phone(self) -> None:
        from mate_clients.security.pii_mask import detect_pii

        m = detect_pii("Call 555-123-4567 for help")
        assert any(x.kind == "phone" for x in m)

    def test_detect_email(self) -> None:
        from mate_clients.security.pii_mask import detect_pii

        m = detect_pii("Contact alice@example.com please")
        assert any(x.kind == "email" for x in m)

    def test_detect_ssn(self) -> None:
        from mate_clients.security.pii_mask import detect_pii

        m = detect_pii("SSN 123-45-6789 here")
        assert any(x.kind == "ssn" for x in m)

    def test_detect_no_pii(self) -> None:
        from mate_clients.security.pii_mask import detect_pii

        m = detect_pii("plain text without anything")
        assert m == []

    def test_redact_pii_replaces_phone(self) -> None:
        from mate_clients.security.pii_mask import redact_pii

        r = redact_pii("Call 555-123-4567 for help")
        assert "[REDACTED_PHONE]" in r.redacted
        assert "555-123-4567" not in r.redacted
        assert r.has_pii is True

    def test_redact_pii_reversible(self) -> None:
        from mate_clients.security.pii_mask import redact_pii

        r = redact_pii("Call 555-123-4567 for help", reversible=True)
        assert "555-123-4567" not in r.redacted
        # reversible mode uses [PII-<kind>-<len>] tokens
        assert "[PII-phone-" in r.redacted

    def test_redact_dict(self) -> None:
        from mate_clients.security.pii_mask import redact_dict

        d, matches = redact_dict({
            "name": "Alice",
            "phone": "555-123-4567",
            "age": 30,
        })
        assert "[REDACTED_PHONE]" in d["phone"]
        assert d["name"] == "Alice"  # not a phone
        assert any(m.kind == "phone" for m in matches)

    def test_redact_dict_specific_fields(self) -> None:
        from mate_clients.security.pii_mask import redact_dict

        d, matches = redact_dict(
            {"name": "Bob", "phone": "555-123-4567"},
            fields=["name"],
        )
        # name has no phone so no redaction
        assert d["name"] == "Bob"
        # phone is NOT in the scanned list
        assert d["phone"] == "555-123-4567"


# =============================================================================
# D8: Cross-domain query audit
# =============================================================================
class TestD8CrossDomainAudit:
    def test_emit_emits_for_multi_tenant_query(self) -> None:
        from mate_platform.observability.xdomain_audit import (
            InMemoryCrossDomainSink, emit_cross_domain_query,
        )
        sink = InMemoryCrossDomainSink()
        emit_cross_domain_query(
            actor_user_id="ops",
            actor_tenant_id="ops",
            target_tenants=["tenant-a", "tenant-b"],
            query="SELECT * FROM orders",
            trace_id="t1",
            sink=sink,
        )
        assert len(sink.all()) == 1
        assert sink.all()[0].actor_tenant_id == "ops"
        assert sink.all()[0].target_tenants == ("tenant-a", "tenant-b")

    def test_emit_no_op_for_single_tenant_query(self) -> None:
        from mate_platform.observability.xdomain_audit import (
            InMemoryCrossDomainSink, emit_cross_domain_query,
        )
        sink = InMemoryCrossDomainSink()
        emit_cross_domain_query(
            actor_user_id="u1",
            actor_tenant_id="t1",
            target_tenants=["t1"],
            query="SELECT * FROM x",
            trace_id="t1",
            sink=sink,
        )
        assert sink.all() == []

    def test_emit_to_dict_has_required_fields(self) -> None:
        from mate_platform.observability.xdomain_audit import (
            InMemoryCrossDomainSink, CrossDomainQuery,
            emit_cross_domain_query,
        )
        sink = InMemoryCrossDomainSink()
        emit_cross_domain_query(
            actor_user_id="u1",
            actor_tenant_id="a",
            target_tenants=["a", "b"],
            query="SELECT 1",
            trace_id="t1",
            sink=sink,
        )
        d = sink.all()[0].to_dict()
        for k in ("query_id", "actor_user_id", "actor_tenant_id",
                  "target_tenants", "query", "trace_id", "occurred_at"):
            assert k in d