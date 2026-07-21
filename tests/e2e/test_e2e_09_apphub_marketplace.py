"""链路9：APPHUB 模板市场 E2E 测试（V11-11）。

覆盖业务流程：
  浏览模板 → 查看详情 → 安装 → 评分 → 评论

依赖服务：TECH-WFE（Java，Mock FastAPI）
对应 V11-08 已实现端点（apphub templates）。

由于 TECH-WFE 是 Java 服务，无法在 Python pytest 中直接启动。
本测试通过 Mock FastAPI app 模拟 Java 服务的响应，验证：
- 链路定义完整（请求顺序、路径、参数契约）
- trace_id 在请求头中传递，并在响应中回传
- 业务字段契约对齐（id / name / installs / rating / comments 等）
"""

from __future__ import annotations

APPHUB_BASE = "/api/v1/apphub"


async def test_e2e_09_apphub_marketplace_full_flow(
    wfe_client,
    mock_call_log,
    tenant_headers: dict[str, str],
    trace_id: str,
):
    """端到端：浏览模板→查看详情→安装→评分评论→查看评论。

    验证点：
    - 浏览模板返回列表，每条含 id / name / category / rating
    - 详情包含 config / tags / summary
    - 安装返回 installId / appId / status=INSTALLED
    - 评论返回 id / rating / content
    - 全链路 traceId 回传一致
    - Mock 调用顺序符合业务链路定义
    """

    # 1. 浏览模板（不带过滤条件）
    list_resp = await wfe_client.get(
        f"{APPHUB_BASE}/templates", headers=tenant_headers
    )
    assert list_resp.status_code == 200, list_resp.text
    templates = list_resp.json()["data"]
    assert list_resp.json()["traceId"] == trace_id
    assert len(templates) >= 2
    first = templates[0]
    assert "id" in first
    assert "name" in first
    assert "category" in first
    assert "installs" in first
    assert "rating" in first
    template_id = first["id"]

    # 2. 浏览模板（带 keyword 过滤）
    kw_resp = await wfe_client.get(
        f"{APPHUB_BASE}/templates",
        params={"keyword": "客服"},
        headers=tenant_headers,
    )
    assert kw_resp.status_code == 200
    assert kw_resp.json()["traceId"] == trace_id

    # 3. 浏览模板（带 category 过滤）
    cat_resp = await wfe_client.get(
        f"{APPHUB_BASE}/templates",
        params={"category": "service"},
        headers=tenant_headers,
    )
    assert cat_resp.status_code == 200

    # 4. 查看模板详情
    detail_resp = await wfe_client.get(
        f"{APPHUB_BASE}/templates/{template_id}", headers=tenant_headers
    )
    assert detail_resp.status_code == 200, detail_resp.text
    detail = detail_resp.json()["data"]
    assert detail["id"] == template_id
    assert "config" in detail
    assert "tags" in detail
    assert "summary" in detail
    assert detail_resp.json()["traceId"] == trace_id

    # 5. 安装模板
    install_resp = await wfe_client.post(
        f"{APPHUB_BASE}/templates/{template_id}/install",
        headers=tenant_headers,
    )
    assert install_resp.status_code == 200, install_resp.text
    install_data = install_resp.json()["data"]
    assert "installId" in install_data
    assert install_data["templateId"] == template_id
    assert "appId" in install_data
    assert install_data["status"] == "INSTALLED"
    assert "installedAt" in install_data
    assert install_resp.json()["traceId"] == trace_id

    # 6. 提交评分 + 评论
    comment_resp = await wfe_client.post(
        f"{APPHUB_BASE}/templates/{template_id}/comments",
        json={
            "userId": "user-e2e-09",
            "rating": 5,
            "content": "E2E 测试：模板非常实用，安装便捷。",
        },
        headers=tenant_headers,
    )
    assert comment_resp.status_code == 200, comment_resp.text
    comment = comment_resp.json()["data"]
    assert "id" in comment
    assert comment["templateId"] == template_id
    assert comment["rating"] == 5
    assert "E2E 测试" in comment["content"]
    assert comment_resp.json()["traceId"] == trace_id

    # 7. 查看评论列表
    list_cmt_resp = await wfe_client.get(
        f"{APPHUB_BASE}/templates/{template_id}/comments",
        params={"page": 1, "size": 20},
        headers=tenant_headers,
    )
    assert list_cmt_resp.status_code == 200, list_cmt_resp.text
    comments = list_cmt_resp.json()["data"]
    assert len(comments) >= 1
    assert comments[0]["templateId"] == template_id
    assert list_cmt_resp.json()["traceId"] == trace_id

    # 8. 验证 Mock 调用顺序符合业务链路定义
    expected_paths = [
        f"{APPHUB_BASE}/templates",                              # GET 列表
        f"{APPHUB_BASE}/templates?keyword=客服",                 # GET keyword 过滤
        f"{APPHUB_BASE}/templates?category=service",             # GET category 过滤
        f"{APPHUB_BASE}/templates/{template_id}",                # GET 详情
        f"{APPHUB_BASE}/templates/{template_id}/install",        # POST 安装
        f"{APPHUB_BASE}/templates/{template_id}/comments",       # POST 评论
        f"{APPHUB_BASE}/templates/{template_id}/comments",       # GET 评论列表
    ]
    # Mock call_log 记录的是 path（不含 query string），所以需要调整断言
    expected_paths_no_query = [
        f"{APPHUB_BASE}/templates",
        f"{APPHUB_BASE}/templates",
        f"{APPHUB_BASE}/templates",
        f"{APPHUB_BASE}/templates/{template_id}",
        f"{APPHUB_BASE}/templates/{template_id}/install",
        f"{APPHUB_BASE}/templates/{template_id}/comments",
        f"{APPHUB_BASE}/templates/{template_id}/comments",
    ]
    assert mock_call_log.paths == expected_paths_no_query, (
        f"调用顺序不符: 期望 {expected_paths_no_query}, 实际 {mock_call_log.paths}"
    )

    # 9. 验证每次调用都携带了 trace_id header
    for call in mock_call_log.calls:
        assert call.headers.get("X-Trace-Id") == trace_id
        assert call.headers.get("X-Tenant-Id") == "tenant-e2e"


async def test_e2e_09_apphub_marketplace_template_not_found(
    wfe_client,
    tenant_headers: dict[str, str],
):
    """查看不存在的模板（Mock 总是返回固定数据，验证端点可达）。"""
    resp = await wfe_client.get(
        f"{APPHUB_BASE}/templates/tpl-nonexistent",
        headers=tenant_headers,
    )
    # Mock 不区分 id，统一返回详情
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == "tpl-nonexistent"
