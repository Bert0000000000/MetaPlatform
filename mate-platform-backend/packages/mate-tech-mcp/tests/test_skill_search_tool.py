"""skill search/read MCP 工具测试。"""
from __future__ import annotations

import httpx
import pytest
import respx

from mate_tech_mcp.tools.skill_search import ReadSkillTool, SearchSkillTool

APPHUB = "http://apphub-test:8301"


def test_search_skill_lists_matches() -> None:
    with respx.mock:
        respx.get(f"{APPHUB}/api/v1/marketplace/skills").mock(
            return_value=httpx.Response(
                200,
                json={
                    "items": [
                        {"id": "s1", "name": "platform-ui-components", "description": "组件清单", "version": "v1", "installs": 1},
                        {"id": "s2", "name": "kb-extractor", "description": "KB 提取", "version": "v2"},
                    ]
                },
            )
        )
        tool = SearchSkillTool(base_url=APPHUB)
        result = __import__("asyncio").run(
            tool(query="platform-ui-components", tenant_id="tenant-acme")
        )
    assert result["total"] == 2
    assert result["hits"][0]["name"] == "platform-ui-components"


def test_read_skill_returns_content() -> None:
    with respx.mock:
        respx.get(f"{APPHUB}/api/v1/marketplace/skills/s1/download").mock(
            return_value=httpx.Response(
                200,
                json={"id": "s1", "name": "platform-ui-components", "content": "# 平台组件\n\n## PlatformButton"},
            )
        )
        tool = ReadSkillTool(base_url=APPHUB)
        result = __import__("asyncio").run(tool(skill_id="s1", tenant_id="tenant-acme"))
    assert "PlatformButton" in result["content"]


def test_search_skill_unreachable() -> None:
    with respx.mock:
        respx.get(f"{APPHUB}/api/v1/marketplace/skills").mock(
            side_effect=httpx.ConnectError("conn refused")
        )
        tool = SearchSkillTool(base_url=APPHUB)
        result = __import__("asyncio").run(tool(query="x"))
    assert result["hits"] == []
    assert "error" in result
