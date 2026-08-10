"""GOVERN-10 — top-level pytest conftest for cross-package singleton isolation.

mate-tech-ont exposes 3 module-level singletons that are mutated by
tests in OTHER packages too (mate-app-hub etc. via cross-package
imports). When pytest collects multiple packages under
``testpaths = ["packages"]``, package-local conftest autouse fixtures
only reset the package's own tests — they don't reach into another
package's tests' state.

This session-level fixture clears the 3 known singletons before each
test regardless of which package the test lives in.
"""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _reset_ont_singletons_cross_package() -> None:
    try:
        from mate_tech_ont.instances.store import store as _inst
        _inst.reset()
    except (ImportError, AttributeError):
        pass
    try:
        from mate_tech_ont.versioning.store import version_store as _ver
        _ver.reset()
    except (ImportError, AttributeError):
        pass
    try:
        from mate_tech_ont.federation import _executor as _fed
        _fed.reset()
    except (ImportError, AttributeError):
        pass