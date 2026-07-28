"""Conftest for metaplatform-frontend."""
from __future__ import annotations

import pytest
from pathlib import Path
import json


@pytest.fixture
def app_ports() -> dict[str, int]:
    """9 apps 默认端口."""
    return {
        "portal": 5173,
        "dashboard": 5174,
        "ontstudio": 5175,
        "kb": 5176,
        "mcphub": 5177,
        "apphub": 5178,
        "arch": 5179,
        "dw": 5180,
        "superai": 5181,
    }


@pytest.fixture
def api_mode() -> str:
    """默认 API_MODE."""
    return "mock"


@pytest.fixture
def bff_base_url() -> str:
    return "http://localhost:3000"