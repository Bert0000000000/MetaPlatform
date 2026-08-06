"""Tests for mate_platform.tenancy.metrics (ADR-0018 §2.1 cross_tenant_attempt).

Verifies the Prometheus counter is exposed and is incremented on each
``require_tenant`` / ``require_any_tenant`` failure path.
"""
from __future__ import annotations

import pytest


@pytest.fixture
def counter():
    from mate_platform.tenancy.metrics import cross_tenant_attempt

    c = cross_tenant_attempt()
    if c is None:  # pragma: no cover - depends on prometheus_client
        pytest.skip("prometheus_client not installed")
    return c


def _ctx(*, auth_method, tenant_id="t1", user_id="u1"):
    from mate_platform.tenancy.context import AuthMethod, RequestContext

    return RequestContext(
        request_id="r1",
        trace_id="tr1",
        tenant_id=tenant_id,
        user_id=user_id,
        roles=frozenset(),
        permissions=frozenset(),
        scopes=frozenset(),
        auth_method=auth_method,
    )


def test_cross_tenant_attempt_counter_exists(counter) -> None:
    """Counter is registered under the documented name."""
    assert "cross_tenant_attempt" in counter._name  # type: ignore[attr-defined]


def test_require_tenant_anonymous_increments_counter(counter) -> None:
    """Anonymous caller triggers anonymous reason."""
    from mate_platform.tenancy.context import AuthMethod
    from mate_platform.tenancy.guards import (
        TenantAccessError,
        require_tenant,
    )

    before = counter.labels(reason="anonymous", tenant_id="anonymous")._value.get()  # type: ignore[attr-defined]
    ctx = _ctx(auth_method=AuthMethod.ANONYMOUS)
    with pytest.raises(TenantAccessError):
        require_tenant(ctx)
    after = counter.labels(reason="anonymous", tenant_id="anonymous")._value.get()  # type: ignore[attr-defined]
    assert after == before + 1


def test_require_tenant_missing_tenant_increments_counter(counter) -> None:
    """service 身份但 tenant_id 缺失触发 missing 计数."""
    from mate_platform.tenancy.context import AuthMethod
    from mate_platform.tenancy.guards import (
        TenantAccessError,
        require_tenant,
    )

    before = counter.labels(reason="missing", tenant_id="anonymous")._value.get()  # type: ignore[attr-defined]
    ctx = _ctx(auth_method=AuthMethod.SERVICE, tenant_id="")
    with pytest.raises(TenantAccessError):
        require_tenant(ctx)
    after = counter.labels(reason="missing", tenant_id="anonymous")._value.get()  # type: ignore[attr-defined]
    assert after == before + 1


def test_require_any_tenant_multi_tenant_increments_counter(counter) -> None:
    """多租户 fan-out 触发 multi_tenant_fanout 计数."""
    from mate_platform.tenancy.context import AuthMethod
    from mate_platform.tenancy.guards import (
        TenantAccessError,
        require_any_tenant,
    )

    a = _ctx(auth_method=AuthMethod.SERVICE, tenant_id="t1")
    b = _ctx(auth_method=AuthMethod.SERVICE, tenant_id="t2")
    label = counter.labels(  # type: ignore[attr-defined]
        reason="multi_tenant_fanout", tenant_id="t1,t2"
    )._value.get()
    with pytest.raises(TenantAccessError):
        require_any_tenant([a, b])
    assert (
        counter.labels(  # type: ignore[attr-defined]
            reason="multi_tenant_fanout", tenant_id="t1,t2"
        )._value.get()
        == label + 1
    )