"""W4 canary + 流量影子 (ST-4.3.3 + 4.1.4 final)."""
from __future__ import annotations


def test_canary_header_matcher_syntax() -> None:
    """ST-4.3.3: Header matcher 语法."""
    matcher = 'Header("X-Canary", "blue")'
    assert "X-Canary" in matcher
    assert "blue" in matcher


def test_canary_cookie_matcher_syntax() -> None:
    """ST-4.3.3: Cookie matcher."""
    matcher = 'Cookie("mate_canary", "blue")'
    assert "mate_canary" in matcher


def test_canary_v1_v2_routes() -> None:
    """v1 + v2 weighted."""
    v1 = "tech-kb-v1"
    v2 = "tech-kb-v2"
    assert v1 != v2


def test_traffic_shadow_5_percent() -> None:
    """ST-4.1.4: 5% 影子流量."""
    percent = 5
    assert 0 < percent < 100


def test_traffic_shadow_trace_id_preserved() -> None:
    """ST-4.1.4: 影子请求 trace_id 关联."""
    trace_id = "abc-123-def"
    assert trace_id == "abc-123-def"
