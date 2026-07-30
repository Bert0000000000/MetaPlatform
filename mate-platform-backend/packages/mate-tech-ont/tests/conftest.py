from __future__ import annotations

"""Conftest for mate-tech-ont."""


# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _sys
from pathlib import Path as _Path

_MONOREPO = _Path(__file__).resolve().parents[3]
for _sub in (
    "mate-tech-ont",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _p = str(_MONOREPO / "packages" / _sub / "src")
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys
from pathlib import Path as _bsl_Path

import pytest

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-ont",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)

# BUSINESS-SLICES: ensure cross-package paths work without `pip install -e .`
import sys as _bsl_sys
from pathlib import Path as _bsl_Path

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-ont",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
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
