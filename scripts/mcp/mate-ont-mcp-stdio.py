#!/usr/bin/env python3
"""mate-ont-mcp-stdio -- stdio <-> streamable-http MCP 桥接脚本.

背景
----
Mate Platform 本体引擎 MCP 服务只暴露 streamable-http 端点::

    http://localhost:8100/api/v1/mcp/protocol/mcp   (需 Authorization: Bearer <JWT>)

部分 MCP 客户端(旧版 Codex CLI、部分 IDE 插件/内部工具)只支持 stdio
transport。本脚本在本地起一个 stdio MCP server, 把 tools/resources/prompts
请求实时透传到远程 streamable-http 端点, 供这类客户端接入。

依赖: Python 3.10+ 与官方 MCP SDK::

    pip install "mcp>=1.2"

用法
----
1. 准备环境变量(token 由平台 IAM 登录颁发)::

    # Git Bash / Linux / macOS
    export MATE_MCP_URL="http://localhost:8100/api/v1/mcp/protocol/mcp"
    export MATE_MCP_TOKEN="<accessToken>"

    # PowerShell
    $env:MATE_MCP_URL="http://localhost:8100/api/v1/mcp/protocol/mcp"
    $env:MATE_MCP_TOKEN="<accessToken>"

   token 获取::

    curl -s http://localhost:8100/api/v1/iam/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"admin123"}' | jq -r .accessToken

2. 直接运行(自测, 会挂住等待 stdin 上的 MCP 协议消息, 属正常)::

    python scripts/mcp/mate-ont-mcp-stdio.py

3. 注册到只支持 stdio 的客户端, 例如旧版 Codex ~/.codex/config.toml::

    [mcp_servers.mate-ontology]
    command = "python"
    args = ["D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/scripts/mcp/mate-ont-mcp-stdio.py"]
    env = { MATE_MCP_URL = "http://localhost:8100/api/v1/mcp/protocol/mcp", MATE_MCP_TOKEN = "<accessToken>" }

环境变量
--------
- MATE_MCP_URL: 远端 streamable-http 端点(默认 http://localhost:8100/api/v1/mcp/protocol/mcp)
- MATE_MCP_TOKEN: Bearer JWT; 未设置时仅打告警继续连接(网关大概率 401)
- MATE_MCP_LOG_LEVEL: stderr 日志级别(默认 INFO)

行为说明
--------
- 启动即连接远端并完成 MCP initialize 握手; 本地 stdio server 的
  list_tools / call_tool / list_resources / list_resource_templates /
  list_prompts / get_prompt / read_resource 全部透传远端结果对象。
- 不缓存工具列表, list/call 实时转发; 远端工具变更不会主动推送
  list_changed 通知到本地客户端, 客户端重新 list 即可看到新工具。
- 日志只写 stderr; stdout 专用于 MCP 协议帧, 不可被污染。
- HITL 门禁在远端服务侧: ont_confirm/reject/execute_proposal 对 agent
  调用会被远端拒绝, 桥不做任何绕过。
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

from mcp import types
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.server import Server
from mcp.server.stdio import stdio_server

DEFAULT_URL = "http://localhost:8100/api/v1/mcp/protocol/mcp"

logging.basicConfig(
    stream=sys.stderr,
    level=os.getenv("MATE_MCP_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("mate-ont-mcp-stdio")


def _remote_url() -> str:
    return os.getenv("MATE_MCP_URL", DEFAULT_URL).rstrip("/")


def _headers() -> dict[str, str]:
    token = os.getenv("MATE_MCP_TOKEN", "").strip()
    if not token:
        logger.warning("MATE_MCP_TOKEN 未设置, 远端网关大概率返回 401; 若端点无需鉴权可忽略")
        return {}
    return {"Authorization": f"Bearer {token}"}


def _build_proxy(remote: ClientSession) -> Server:
    """构造本地 stdio Server: 各 handler 原样透传远端结果对象."""

    server = Server("mate-ont-mcp-stdio")

    @server.list_tools()
    async def _list_tools() -> types.ListToolsResult:
        return await remote.list_tools()

    @server.call_tool()
    async def _call_tool(name: str, arguments: dict[str, object] | None) -> types.CallToolResult:
        logger.info("call_tool -> %s", name)
        return await remote.call_tool(name, dict(arguments or {}))

    @server.list_resources()
    async def _list_resources() -> types.ListResourcesResult:
        return await remote.list_resources()

    @server.read_resource()
    async def _read_resource(uri: types.AnyUrl) -> types.ReadResourceResult:
        return await remote.read_resource(uri)

    @server.list_resource_templates()
    async def _list_resource_templates() -> types.ListResourceTemplatesResult:
        return await remote.list_resource_templates()

    @server.list_prompts()
    async def _list_prompts() -> types.ListPromptsResult:
        return await remote.list_prompts()

    @server.get_prompt()
    async def _get_prompt(name: str, arguments: dict[str, str] | None) -> types.GetPromptResult:
        return await remote.get_prompt(name, arguments)

    return server


async def run() -> None:
    url = _remote_url()
    logger.info("桥接启动: stdio -> %s", url)
    async with streamablehttp_client(url, headers=_headers(), timeout=30) as (
        read_stream,
        write_stream,
        _get_session_id,
    ):
        async with ClientSession(read_stream, write_stream) as remote:
            init = await remote.initialize()
            logger.info(
                "远端就绪: %s %s (protocol %s)",
                init.serverInfo.name,
                init.serverInfo.version,
                init.protocolVersion,
            )
            proxy = _build_proxy(remote)
            async with stdio_server() as (stdio_read, stdio_write):
                await proxy.run(
                    stdio_read,
                    stdio_write,
                    proxy.create_initialization_options(),
                )


def main() -> int:
    try:
        asyncio.run(run())
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception:
        logger.exception("桥接进程异常退出")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
