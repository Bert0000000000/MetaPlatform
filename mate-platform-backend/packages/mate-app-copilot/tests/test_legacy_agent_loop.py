"""C-3 / `MP-LEGACY-SUNSET-01` 的判据：旧 Agent loop 有 Legacy 标记，**只有它有**。

"只剩一条 Agent 主线"这件事有两个方向都要钉住：

* 旧的（`chat/agent/stream`）**带**弃用标记且指向继任者；
* 保留的那条（`chat/completions/stream`，平台计划明写的"轻量直接问答"）**不带**——
  否则"只退旧的、留新的"就成了一句无法证伪的话。

标记本身用**标准头**（RFC 9745 `Deprecation` / RFC 8594 `Sunset` / RFC 8288 `Link`）
外加一个 `X-Sunset-Version`（本项目按发布版本排退役节奏，见
`docs/active/delivery/evidence/MP-LEGACY-SUNSET-01-AGENT-LOOP.md` §3）。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

_AGENT_STREAM = "/api/v1/copilot/chat/agent/stream"
_COMPLETIONS_STREAM = "/api/v1/copilot/chat/completions/stream"


def test_legacy_agent_loop_advertises_its_retirement(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    response = client.post(
        _AGENT_STREAM,
        json={"messages": [{"role": "user", "content": "帮我处理对账单"}]},
        headers=auth_headers_acme,
    )
    assert response.status_code == 200, response.text

    # 响应头是在**流的第一个字节之前**就定下的，所以这里读得到——
    # 迁移方不必等下完整个 SSE 才知道这条要退。
    assert response.headers["Deprecation"] == "true"
    assert response.headers["Sunset"].startswith("Thu, 31 Dec 2026")
    assert 'rel="successor-version"' in response.headers["Link"]
    assert "/api/v1/agent-team/runs" in response.headers["Link"]
    assert response.headers["X-Sunset-Version"] == "2.2"
    assert response.headers["X-Migrated-To"] == "/api/v1/agent-team/runs"


def test_the_retained_lightweight_chat_is_not_marked_legacy(
    client: TestClient, auth_headers_acme: dict[str, str]
) -> None:
    """保留的那条不能带弃用标记。

    平台计划 S1 工作项 3：「旧 Copilot Stream **仅保留轻量直接问答**」。如果这条也
    被打上 Legacy，那"收敛成一条"就变成了"两条都要退"——与决策不符，而且会让
    迁移方以为无处可去。
    """
    response = client.post(
        _COMPLETIONS_STREAM,
        json={"messages": [{"role": "user", "content": "你好"}], "model": "doubao-pro-32k"},
        headers=auth_headers_acme,
    )
    assert response.status_code == 200, response.text
    assert "Deprecation" not in response.headers
    assert "X-Sunset-Version" not in response.headers
