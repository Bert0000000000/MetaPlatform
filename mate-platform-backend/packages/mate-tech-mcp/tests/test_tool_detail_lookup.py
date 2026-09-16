"""GET /api/v1/mcp/tools/{name} 详情端点回归钉。

背景（2026-09-16）：该端点曾直接 500（``AttributeError: 'McpTool' object
has no attribute 'category'``）—— 响应体是从 ``McpTool`` dataclass 上不存在的
属性拼的；而且 ``get_tool_by_name`` 只查租户**动态**目录，``GET /tools``
列表的主体（``MCPServer`` 启动期注册的静态 ARK 工具）根本不在目录里，
所以修掉 AttributeError 之后仍会 404。

这里钉住三件事：

1. 静态注册表工具 → 200，且补齐 id/code/version/toolType/beanClass 等 CRUD 字段
2. 未知名字 → 404
3. 动态注册工具（``register_tool``）→ 200，且与静态分支 key 集合完全一致
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

REPO = Path(__file__).resolve().parents[3]
for _sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-mcp"):
    _p = str(REPO / "packages" / _sub / "src")
    if _p not in sys.path:
        sys.path.insert(0, _p)

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from mate_platform.tenancy import AuthMethod

# 注意：``mate_tech_mcp.*`` 的一切 import 都放在 fixture / 测试体内按需做。
# 同会话的 ``test_mcp_http_endpoints.py`` 会 evict 整个 ``mate_tech_mcp``
# 包再重新 import；模块顶层 import 会因此绑到被丢弃的旧模块实例上，写进旧
# store 而 handler 读新 store（表现为 404）。延后 import 始终取当前实例。

#: 前端 ``fromBackendTool`` 依赖的 key 集合（两个来源必须一致）。
DETAIL_KEYS = {
    "id",
    "name",
    "code",
    "category",
    "version",
    "description",
    "inputSchema",
    "outputSchema",
    "toolType",
    "endpoint",
    "beanClass",
    "enabled",
}

#: 名字刻意不在 ``_seed_tools`` 目录里（kb_search / ontology_query /
#: rate_limit），保证测试走的是注册表回退分支，而不是目录命中。
STATIC_TOOL_NAME = "search_skill"


class _StaticTool:
    """静态注册表工具（``MCPServer.register_tool`` 形态）。

    只有 name/description/category/input_schema —— 没有 version /
    output_schema / tool_type / bean_class，正是线上静态条目的样子。
    """

    name = STATIC_TOOL_NAME
    description = "按能力检索 skillhub 的静态工具"
    category = "知识检索"
    input_schema = {
        "type": "object",
        "properties": {"query": {"type": "string", "description": "检索查询"}},
        "required": ["query"],
    }


@pytest.fixture
def client() -> TestClient:
    """extras router + 假租户中间件 + 绑定了静态工具的 MCPServer。"""
    from mate_tech_mcp.api.extras_routes import router as extras_router
    from mate_tech_mcp.repositories import reset_store
    from mate_tech_mcp.server import create_server

    reset_store()

    async def _fake_ctx(request: Request, call_next):
        request.state.ctx = SimpleNamespace(
            auth_method=AuthMethod.USER,
            tenant_id="tenant-acme",
        )
        return await call_next(request)

    app = FastAPI(title="mate-tech-mcp-tool-detail-test")
    app.state.mcp_server = create_server("test-tool-detail")
    app.state.mcp_server.register_tool(_StaticTool())
    app.middleware("http")(_fake_ctx)
    app.include_router(extras_router)

    yield TestClient(app)

    from mate_tech_mcp.repositories import reset_store as _reset

    _reset()


def test_static_registry_tool_detail_returns_200(client: TestClient) -> None:
    """静态工具（不在租户目录里）走注册表回退，补齐字段后 200。"""
    r = client.get(f"/api/v1/mcp/tools/{STATIC_TOOL_NAME}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == DETAIL_KEYS, body
    assert body["id"] == STATIC_TOOL_NAME
    assert body["name"] == STATIC_TOOL_NAME
    assert body["code"] == STATIC_TOOL_NAME
    assert body["category"] == "知识检索"
    assert body["description"] == "按能力检索 skillhub 的静态工具"
    assert body["version"] == "1"
    assert body["toolType"] == "MCP"
    assert body["beanClass"] == ""
    assert body["outputSchema"] == ""
    assert body["enabled"] is True
    # 关键契约：静态条目的 inputSchema 是 JSON Schema 对象，不是字符串。
    assert isinstance(body["inputSchema"], dict)
    assert body["inputSchema"]["type"] == "object"
    assert "query" in body["inputSchema"]["properties"]


def test_unknown_tool_detail_returns_404(client: TestClient) -> None:
    """两个来源都没有 → 404（不是 500）。"""
    r = client.get("/api/v1/mcp/tools/definitely_not_a_tool")
    assert r.status_code == 404, r.text


def test_dynamic_registered_tool_detail_returns_200(client: TestClient) -> None:
    """动态注册工具命中租户目录，key 集合与静态分支一致。"""
    from mate_tech_mcp.repositories import register_tool

    register_tool(
        "tenant-acme",
        "hr_tool",
        description="HR capability",
        input_schema={"type": "object", "properties": {"q": {"type": "string"}}},
        endpoint="http://hr-worker:9000",
    )

    r = client.get("/api/v1/mcp/tools/hr_tool")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == DETAIL_KEYS, body
    assert body["id"] == "hr_tool"
    assert body["name"] == "hr_tool"
    assert body["code"] == "hr_tool"
    assert body["endpoint"] == "http://hr-worker:9000"
    assert body["category"] == ""
    assert body["version"] == "1"
    assert body["toolType"] == "MCP"
    assert body["beanClass"] == ""
    assert body["enabled"] is True
    assert isinstance(body["inputSchema"], dict)


def test_seeded_catalog_tool_detail_returns_200(client: TestClient) -> None:
    """kb_search 是租户种子目录项 —— 修复前这里直接 AttributeError → 500。"""
    r = client.get("/api/v1/mcp/tools/kb_search")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == DETAIL_KEYS, body
    assert body["name"] == "kb_search"
    assert body["version"] == "1"
    assert body["toolType"] == "MCP"
