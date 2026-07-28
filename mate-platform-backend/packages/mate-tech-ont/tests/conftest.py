"""Conftest for mate-tech-ont."""
from __future__ import annotations

import pytest

from mate_tech_ont.instances.store import store as instance_store
from mate_tech_ont.security.tenant import TenantContext


@pytest.fixture(autouse=True)
def _reset_stores() -> None:
    instance_store._instances.clear()
    instance_store._relations.clear()


@pytest.fixture
def acme_ctx() -> TenantContext:
    return TenantContext(tenant_id="acme", user_id="alice", roles=("editor",))


@pytest.fixture
def bob_ctx() -> TenantContext:
    return TenantContext(tenant_id="bob", user_id="bob", roles=("editor",))