"""Cross-tenant integration tests (ST-5.4.11)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.instances.store import store as instance_store
from mate_tech_ont.main import app
from mate_tech_ont.security.tenant import (
    DEFAULT_TENANT,
    TenantContext,
    assert_tenant_access,
    check_tenant_access,
)


@pytest.fixture(autouse=True)
def _reset_store() -> None:
    """每个测试前清空 instance store."""
    instance_store._instances.clear()
    instance_store._relations.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_check_tenant_access_same() -> None:
    ctx = TenantContext(tenant_id="acme", user_id="alice")
    assert check_tenant_access(ctx, "acme") is True


def test_check_tenant_access_cross_denied() -> None:
    ctx = TenantContext(tenant_id="acme", user_id="alice")
    assert check_tenant_access(ctx, "bob") is False


def test_default_tenant_universal_access() -> None:
    """默认 tenant 可访问所有资源."""
    assert check_tenant_access(DEFAULT_TENANT, "any-tenant") is True
    assert check_tenant_access(DEFAULT_TENANT, "tenant-a") is True


def test_assert_raises_on_cross_tenant() -> None:
    ctx = TenantContext(tenant_id="acme", user_id="alice")
    with pytest.raises(PermissionError, match="denied"):
        assert_tenant_access(ctx, "bob")


def test_instance_creation_within_tenant() -> None:
    """同租户下创建 + 读取实例.

    GOVERN-03: store APIs require an explicit tenant ctx; payload
    fields are no longer accepted as a fallback.
    """
    acme = TenantContext(tenant_id="acme", user_id="alice")
    instance_store.create_instance(acme, "Concept", {"name": "X"})
    instances = instance_store.list_instances(acme, "Concept")
    assert len(instances) == 1


def test_instance_deletion_cascades_relations() -> None:
    """删除实例级联删除关系."""
    acme = TenantContext(tenant_id="acme", user_id="alice")
    a = instance_store.create_instance(acme, "Concept", {})
    b = instance_store.create_instance(acme, "Object", {})
    instance_store.create_relation(acme, "type_of", a.id, b.id)
    assert len(instance_store.list_relations(acme)) == 1
    instance_store.delete_instance(acme, a.id)
    assert len(instance_store.list_relations(acme)) == 0


def test_relation_to_missing_src_raises(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """关系指向不存在的源实例 → 403 (GOVERN-03: 不可见 = 403).

    The previous behaviour returned 400 because the store raised a
    generic ValueError; the tenant-aware store now classifies
    ``src instance not visible to tenant`` as a tenant access violation
    (TenantAccessError → HTTP 403) which is the more accurate response
    for an authenticated caller that cannot see the referenced
    instance.
    """
    resp = client.post(
        "/api/v1/ont/instances",
        json={"class_id": "Concept", "properties": {}},
        headers=auth_headers,
    )
    real_id = resp.json()["id"]

    resp = client.post(
        "/api/v1/ont/instances/relations",
        json={"type": "type_of", "src_id": "missing", "dst_id": real_id, "properties": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 403
