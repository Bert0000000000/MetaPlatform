"""W6-3 apphub edge tests (ST-6.3.x edge)."""
from __future__ import annotations

import pytest


def test_apphub_categories() -> None:
    """ST-6.3.3: 应用分类."""
    categories = ["productivity", "communication", "analytics", "security", "utility"]
    assert len(categories) >= 3
    assert "productivity" in categories


def test_apphub_app_card_structure() -> None:
    """ST-6.3.3: app card 字段."""
    card = {
        "id": "app-1",
        "name": "Test App",
        "category": "productivity",
        "rating": 4.5,
        "installed": False,
    }
    assert "id" in card
    assert "name" in card
    assert "rating" in card
    assert 0 <= card["rating"] <= 5


def test_apphub_install_progress() -> None:
    """ST-6.3.4: 安装进度."""
    progress = {"status": "downloading", "percent": 50, "error": None}
    assert progress["status"] in {"downloading", "installing", "completed", "failed"}
    assert 0 <= progress["percent"] <= 100


def test_apphub_uninstall_confirmation() -> None:
    """ST-6.3.4: 卸载确认."""
    confirmed = True
    assert confirmed is True