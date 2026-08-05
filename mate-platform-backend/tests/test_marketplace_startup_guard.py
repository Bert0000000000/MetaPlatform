"""marketplace startup guard tests。

production profile 下必须 SaaS 可达;dev/test 跳过。
"""
from __future__ import annotations

import pytest


@pytest.fixture
def production(monkeypatch):
    monkeypatch.setenv("MATE_PROFILE", "production")


def test_startup_fails_when_saas_unreachable(monkeypatch, production):
    from mate_platform.marketplace import startup_guard

    monkeypatch.setattr(startup_guard, "_probe_saas", lambda url: False)

    with pytest.raises(RuntimeError, match="SaaS unreachable"):
        startup_guard.assert_saas_reachable_or_exit(
            "https://market.example"
        )


def test_startup_ok_when_saas_reachable(monkeypatch, production):
    from mate_platform.marketplace import startup_guard

    monkeypatch.setattr(startup_guard, "_probe_saas", lambda url: True)
    # 不应抛
    startup_guard.assert_saas_reachable_or_exit("https://market.example")


def test_probe_saas_returns_false_on_exception(monkeypatch):
    """网络异常 → probe 返回 False。"""
    from mate_platform.marketplace import startup_guard

    def boom(url):
        raise ConnectionError("refused")

    monkeypatch.setattr(startup_guard.httpx, "get", boom)
    assert startup_guard._probe_saas("https://market.example") is False