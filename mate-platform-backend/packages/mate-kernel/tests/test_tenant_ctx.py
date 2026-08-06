"""KERNEL-01 双租户上下文测试（13 硬规则 #3）。"""

from __future__ import annotations

import pytest

from mate_kernel.ontology.tenant import (
    CrossTenantAccessError,
    MissingTenantContextError,
    TenantContext,
    assert_same_tenant,
    clear_tenant,
    current_tenant,
    require_tenant,
    set_tenant,
)


def _ctx(tenant: str = "acme", user: str = "alice") -> TenantContext:
    return TenantContext(tenant_id=tenant, user_id=user, scopes=("platform.read",))


class TestTenantContext:
    def test_create(self) -> None:
        c = _ctx()
        assert c.tenant_id == "acme"
        assert c.is_cross_tenant_admin is False

    def test_rejects_empty_tenant(self) -> None:
        with pytest.raises(ValueError, match="tenant_id required"):
            TenantContext(tenant_id="", user_id="alice")

    def test_rejects_empty_user(self) -> None:
        with pytest.raises(ValueError, match="user_id required"):
            TenantContext(tenant_id="acme", user_id="")

    def test_rejects_bad_tenant_chars(self) -> None:
        with pytest.raises(ValueError, match="must match"):
            TenantContext(tenant_id="Acme.Corp", user_id="alice")

    def test_immutable(self) -> None:
        c = _ctx()
        with pytest.raises(Exception):
            c.tenant_id = "evil"  # type: ignore[misc]


class TestContextVar:
    def test_default_none(self) -> None:
        clear_tenant()
        assert current_tenant() is None

    def test_set_and_get(self) -> None:
        c = _ctx()
        token = set_tenant(c)
        try:
            assert current_tenant() is c
        finally:
            clear_tenant()

    def test_clear(self) -> None:
        set_tenant(_ctx())
        clear_tenant()
        assert current_tenant() is None


class TestRequireTenant:
    def test_require_raises_when_missing(self) -> None:
        clear_tenant()
        with pytest.raises(MissingTenantContextError, match="tenant context is required"):
            require_tenant()

    def test_require_returns_when_set(self) -> None:
        c = _ctx()
        set_tenant(c)
        try:
            assert require_tenant() is c
        finally:
            clear_tenant()


class TestAssertSameTenant:
    def test_same_tenant_ok(self) -> None:
        c = _ctx("acme")
        assert_same_tenant("acme", c)  # 不抛

    def test_cross_tenant_forbidden(self) -> None:
        c = _ctx("acme")
        with pytest.raises(CrossTenantAccessError, match="cross-tenant"):
            assert_same_tenant("evil", c)

    def test_cross_tenant_admin_allowed(self) -> None:
        c = TenantContext(
            tenant_id="acme",
            user_id="admin",
            is_cross_tenant_admin=True,
        )
        assert_same_tenant("evil", c)  # 不抛


class TestRepositoryIntegration:
    def test_individual_tenant_must_match(self) -> None:
        """Repository 写入 / 读取必须携带 ctx；跨租户访问禁止（13 硬规则 #3）。"""
        from datetime import datetime, timezone
        from mate_kernel.ontology import (
            ClassRef,
            InMemoryOntologyRepository,
            Individual,
        )

        repo = InMemoryOntologyRepository()
        acme_ctx = _ctx("acme")
        set_tenant(acme_ctx)
        try:
            ind = Individual(
                rid="ont.acme.ind.order.1",
                class_rid=ClassRef("ont.acme.obj.order"),
                props=(),
                primary_key="1",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                tenant_id="acme",
                marking=(),
            )
            repo.create_individual(ind)
            assert_same_tenant(ind.tenant_id, acme_ctx)  # OK
        finally:
            clear_tenant()

        # cross-tenant access
        evil_ctx = _ctx("evil")
        set_tenant(evil_ctx)
        try:
            with pytest.raises(CrossTenantAccessError):
                assert_same_tenant("acme", evil_ctx)
        finally:
            clear_tenant()