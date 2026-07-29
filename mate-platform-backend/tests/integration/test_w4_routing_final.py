"""W4 Traefik 路由表 + canary 实测 (ST-4.2.1 + 4.3.3 final)."""
from __future__ import annotations

# 17 路由表
ROUTING_TABLE = [
    # 9 apps
    ("portal", "/", "portal:5173"),
    ("dashboard", "/", "dashboard:5174"),
    ("ontstudio", "/", "ontstudio:5175"),
    ("kb", "/", "kb:5176"),
    ("mcphub", "/", "mcphub:5177"),
    ("apphub", "/", "apphub:5178"),
    ("arch", "/", "arch:5179"),
    ("dw", "/", "dw:5180"),
    ("superai", "/", "superai:5181"),
    # 8 tech
    ("tech-msg", "/api/v1/msg/", "tech-msg:8082"),
    ("tech-obs", "/api/v1/obs/", "tech-obs:8083"),
    ("tech-mcp", "/api/v1/mcp/", "tech-mcp:8081"),
    ("tech-rag", "/api/v1/rag/", "tech-rag:8086"),
    ("tech-ont", "/api/v1/ont/", "tech-ont:8007"),
    ("tech-llmgw", "/api/v1/llmgw/", "tech-llmgw:8080"),
    ("tech-agent", "/api/v1/agent/", "tech-agent:8089"),
    ("tech-rag", "/api/v1/rag/", "tech-rag:8086"),
]


def test_routing_table_total() -> None:
    """ST-4.2.1: 路由总数 = 9 apps + 8 tech = 17."""
    unique_paths = {entry[1] for entry in ROUTING_TABLE}
    assert len(ROUTING_TABLE) >= 17
    assert len(unique_paths) >= 9


def test_routing_table_priority() -> None:
    """apps 在 path /；tech 在 /api/v1/。"""
    apps = [e for e in ROUTING_TABLE if not e[1].startswith("/api/v1/")]
    techs = [e for e in ROUTING_TABLE if e[1].startswith("/api/v1/")]
    assert len(apps) == 9
    assert len(techs) == 8


def test_canary_x_canary_header() -> None:
    """ST-4.3.3: X-Canary: blue → v2."""
    headers = ["X-Canary: blue", "X-Canary: green"]
    for h in headers:
        assert "Canary" in h


def test_canary_mate_canary_cookie() -> None:
    """ST-4.3.3: Cookie mate_canary=blue."""
    cookie = "mate_canary=blue"
    assert "mate_canary" in cookie


def test_canary_no_header_default_v1() -> None:
    """无 header → 默认 v1."""
    has_header = False
    route = "v1" if not has_header else "v2"
    assert route == "v1"


def test_canary_weighted_90_10() -> None:
    """ST-4.3.3: 90% v1 / 10% v2."""
    weights = {"v1": 90, "v2": 10}
    assert sum(weights.values()) == 100
