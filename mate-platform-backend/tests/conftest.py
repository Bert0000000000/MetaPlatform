"""pytest fixtures shared across all tests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-tech-rag"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)

import pytest

try:
    import respx
except ImportError:
    respx = None


@pytest.fixture
def respx_mock():
    """respx mock fixture (skipped if respx not installed)."""
    if respx is None:
        pytest.skip("respx not installed")
    with respx.mock(assert_all_called=False) as mock:
        yield mock