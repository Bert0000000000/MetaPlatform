"""策略矩阵端点测试（权限策略 tab 崩溃修复的回归钉）。

背景：GET /iam/policies/matrix 曾是返回 ``{"items":[],"total":0}`` 的空桩，
形状与前端 PolicyMatrix（{type, action, columns, rows}）不符，导致
/ki/mcp/permissions 整页崩溃并连带壳层白屏。这里钉住：

- matrix 按策略存储真实聚合（行=主体、列=工具、格=效果），空库返回空矩阵
- type=user-tool / app-tool 的主体过滤与 action 过滤
- GET /iam/policies/matrix/export 输出 CSV（UTF-8 BOM）；xlsx 返回 400
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

REPO = Path(__file__).resolve().parents[3]
for _sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-mcp"):
    _p = str(REPO / "mate-tech-mcp" / ".." / _sub / "src")
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from mate_platform.tenancy import AuthMethod

from mate_tech_mcp import management_repo as repo
from mate_tech_mcp.api.management_routes import router as mgmt_router


def _make_client(tenant_id: str = "tenant-acme") -> TestClient:
    """management router + 直写 request.state.ctx 的假租户中间件。"""

    async def _fake_ctx(request: Request, call_next):
        request.state.ctx = SimpleNamespace(
            auth_method=AuthMethod.USER, tenant_id=tenant_id
        )
        return await call_next(request)

    app = FastAPI()
    app.middleware("http")(_fake_ctx)
    app.include_router(mgmt_router)
    return TestClient(app)


def _seed_policy(tid: str, *, subject_type: str, subject_id: str, tool: str, effect: str = "ALLOW", action: str = "invoke") -> None:
    repo.put_policy(
        tid,
        repo.Policy(
            id=f"pol-{subject_type}-{subject_id}-{tool}",
            tenant_id=tid,
            name=f"{subject_id} -> {tool}",
            subject_type=subject_type,
            subject_id=subject_id,
            resource_type="tool",
            resource_ids=(tool,),
            action=action,
            effect=effect,
            enabled=True,
        ),
    )


class TestPolicyMatrix:
    def test_empty_store_returns_well_formed_empty_matrix(self):
        with _make_client() as c:
            r = c.get("/api/v1/mcp/iam/policies/matrix", params={"type": "user-tool"})
        assert r.status_code == 200
        body = r.json()
        # 形状契约：前端 PolicyMatrix 必有 columns/rows（曾经的空桩就是栽在这里）
        assert body["type"] == "user-tool"
        assert body["columns"] == []
        assert body["rows"] == []

    def test_aggregates_rows_columns_cells(self):
        tid = "tenant-acme"
        _seed_policy(tid, subject_type="USER", subject_id="u-1", tool="tool-a")
        _seed_policy(tid, subject_type="USER", subject_id="u-1", tool="tool-b", effect="DENY")
        _seed_policy(tid, subject_type="USER", subject_id="u-2", tool="tool-a")
        try:
            with _make_client(tid) as c:
                r = c.get(
                    "/api/v1/mcp/iam/policies/matrix",
                    params={"type": "user-tool", "action": "invoke"},
                )
            body = r.json()
            assert [c_["toolId"] for c_ in body["columns"]] == ["tool-a", "tool-b"]
            rows = {row["subject"]["subjectId"]: row["cells"] for row in body["rows"]}
            assert rows["u-1"] == {"tool-a": "allow", "tool-b": "deny"}
            assert rows["u-2"] == {"tool-a": "allow"}
        finally:
            repo.delete_policy(tid, "pol-USER-u-1-tool-a")
            repo.delete_policy(tid, "pol-USER-u-1-tool-b")
            repo.delete_policy(tid, "pol-USER-u-2-tool-a")

    def test_user_tool_excludes_non_user_subjects(self):
        tid = "tenant-acme"
        _seed_policy(tid, subject_type="AGENT", subject_id="ag-1", tool="tool-a")
        try:
            with _make_client(tid) as c:
                r = c.get("/api/v1/mcp/iam/policies/matrix", params={"type": "user-tool"})
            body = r.json()
            assert body["rows"] == []
            r2 = c.get("/api/v1/mcp/iam/policies/matrix", params={"type": "app-tool"})
            body2 = r2.json()
            assert [row["subject"]["subjectId"] for row in body2["rows"]] == ["ag-1"]
        finally:
            repo.delete_policy(tid, "pol-AGENT-ag-1-tool-a")

    def test_action_filter(self):
        tid = "tenant-acme"
        _seed_policy(tid, subject_type="USER", subject_id="u-9", tool="tool-x", action="read")
        try:
            with _make_client(tid) as c:
                r = c.get(
                    "/api/v1/mcp/iam/policies/matrix",
                    params={"type": "user-tool", "action": "invoke"},
                )
                assert r.json()["rows"] == []
                r2 = c.get(
                    "/api/v1/mcp/iam/policies/matrix",
                    params={"type": "user-tool", "action": "read"},
                )
                assert [row["subject"]["subjectId"] for row in r2.json()["rows"]] == ["u-9"]
        finally:
            repo.delete_policy(tid, "pol-USER-u-9-tool-x")


class TestPolicyMatrixExport:
    def test_csv_export_has_bom_and_header(self):
        tid = "tenant-acme"
        _seed_policy(tid, subject_type="USER", subject_id="u-1", tool="tool-a")
        try:
            with _make_client(tid) as c:
                r = c.get(
                    "/api/v1/mcp/iam/policies/matrix/export",
                    params={"type": "user-tool", "format": "csv"},
                )
            assert r.status_code == 200
            assert r.headers["content-type"].startswith("text/csv")
            assert r.content.startswith(b"\xef\xbb\xbf")  # UTF-8 BOM
            text = r.content.decode("utf-8-sig")
            assert text.splitlines()[0] == "主体类型,主体 ID,tool-a"
            assert "USER,u-1,allow" in text
        finally:
            repo.delete_policy(tid, "pol-USER-u-1-tool-a")

    def test_xlsx_returns_400_with_message(self):
        with _make_client() as c:
            r = c.get(
                "/api/v1/mcp/iam/policies/matrix/export",
                params={"type": "user-tool", "format": "xlsx"},
            )
        assert r.status_code == 400
        assert "csv" in r.json()["detail"]["message"]
