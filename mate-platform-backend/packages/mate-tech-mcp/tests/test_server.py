"""MCP server tests."""
from __future__ import annotations

import pytest

from mate_tech_mcp.server import MCPServer, create_server


def test_create_server_default() -> None:
    """ST-5.3.1.2: 默认名称创建."""
    s = create_server()
    assert s.name == "mate-tech-mcp"


def test_create_server_custom_name() -> None:
    s = create_server(name="custom")
    assert s.name == "custom"


def test_register_tool(mcp_server: MCPServer) -> None:
    """ST-5.3.2: 工具注册."""

    class FakeTool:
        name = "fake"
        description = "test"
        input_schema = {}
        def handler():
            return "ok"

    mcp_server.register_tool(FakeTool())
    assert len(mcp_server._tools) == 1


def test_register_resource(mcp_server: MCPServer) -> None:
    class FakeResource:
        uri = "test://x"
        name = "test"

    mcp_server.register_resource(FakeResource())
    assert len(mcp_server._resources) == 1


def test_register_prompt(mcp_server: MCPServer) -> None:
    class FakePrompt:
        name = "summarize"
        description = "summarize text"

    mcp_server.register_prompt(FakePrompt())
    assert len(mcp_server._prompts) == 1


@pytest.mark.asyncio
async def test_list_tools(mcp_server: MCPServer) -> None:
    class FakeTool:
        name = "foo"
        description = "test foo"
        input_schema = {"type": "object"}

    mcp_server.register_tool(FakeTool())
    tools = await mcp_server.list_tools()
    assert len(tools) == 1
    assert tools[0]["name"] == "foo"


@pytest.mark.asyncio
async def test_call_tool(mcp_server: MCPServer) -> None:
    class FakeTool:
        name = "add"
        description = ""
        input_schema = {}
        def handler(self, b):
            return self + b

    mcp_server.register_tool(FakeTool())
    result = await mcp_server.call_tool("add", {"a": 2, "b": 3})
    assert result == 5


@pytest.mark.asyncio
async def test_call_tool_unknown_raises(mcp_server: MCPServer) -> None:
    with pytest.raises(KeyError, match="not found"):
        await mcp_server.call_tool("missing", {})