"""AGENT-SEC-01 Security 数字员工测试。"""

from __future__ import annotations

import pytest

from mate_kernel.agent.security import (
    Decision,
    MarkingRequirement,
    SecurityAgent,
    SecurityRequest,
    UserMarkings,
    check_action_apply,
)
from mate_kernel.manager.protocol import ManagerContext


def _ctx(tenant: str = "acme", user: str = "alice") -> ManagerContext:
    return ManagerContext(user_id=user, tenant_id=tenant, session_id="s-1")


def _req(
    tenant: str = "acme",
    target: str = "acme",
    markings: tuple[str, ...] = (),
    required: tuple[str, ...] = (),
) -> SecurityRequest:
    return SecurityRequest(
        requester=UserMarkings(user_id="alice", tenant_id=tenant, markings=markings),
        target_tenant=target,
        required=MarkingRequirement(required_markings=required),
        resource_rid="ont.acme.act.approve",
    )


class TestSecurityAgent:
    def _a(self) -> SecurityAgent:
        return SecurityAgent()

    def test_allow_same_tenant_no_marking(self) -> None:
        d = self._a().decide(_req())
        assert d.decision == Decision.ALLOW
        assert d.rule_id == "R-ALLOW-000"

    def test_allow_with_matching_marking(self) -> None:
        d = self._a().decide(_req(markings=("confidential",), required=("confidential",)))
        assert d.decision == Decision.ALLOW

    def test_allow_any_of_required_markings(self) -> None:
        # required = (A, B)，user 有 B → OK
        d = self._a().decide(_req(markings=("B",), required=("A", "B")))
        assert d.decision == Decision.ALLOW

    def test_deny_missing_marking(self) -> None:
        d = self._a().decide(_req(markings=("public",), required=("confidential",)))
        assert d.decision == Decision.DENY
        assert d.rule_id == "R-MARK-001"
        assert "missing marking" in d.reason

    def test_deny_cross_tenant(self) -> None:
        d = self._a().decide(_req(tenant="acme", target="evil"))
        assert d.decision == Decision.DENY
        assert d.rule_id == "R-TENANT-001"
        assert "cross-tenant" in d.reason

    def test_cross_tenant_takes_precedence(self) -> None:
        # 跨租户 + marking 都缺失 → tenant 规则先生效
        d = self._a().decide(
            _req(tenant="acme", target="evil", markings=(), required=("x",))
        )
        assert d.rule_id == "R-TENANT-001"

    def test_decision_records_audit(self) -> None:
        a = self._a()
        a.decide(_req())
        a.decide(_req(tenant="acme", target="evil"))
        audit = a.get_audit()
        assert len(audit) == 2
        assert audit[0].decision == Decision.ALLOW
        assert audit[1].decision == Decision.DENY


class TestCheckActionApply:
    def test_check_passes(self) -> None:
        a = SecurityAgent()
        d = check_action_apply(a, _ctx(), target_tenant="acme", target_rid="ont.acme.act.x")
        assert d.decision == Decision.ALLOW

    def test_check_blocks_cross_tenant(self) -> None:
        a = SecurityAgent()
        d = check_action_apply(a, _ctx(tenant="acme"), target_tenant="evil", target_rid="ont.acme.act.x")
        assert d.decision == Decision.DENY

    def test_check_with_markings(self) -> None:
        a = SecurityAgent()
        d = check_action_apply(
            a,
            _ctx(),
            target_tenant="acme",
            target_rid="ont.acme.act.x",
            required=MarkingRequirement(required_markings=("confidential",)),
            user_markings=("confidential",),
        )
        assert d.decision == Decision.ALLOW


class TestDecisionFrozen:
    def test_immutable(self) -> None:
        from datetime import datetime, timezone
        d = SecurityAgent().decide(_req())
        with pytest.raises(Exception):
            d.decision = Decision.DENY  # type: ignore[misc]
