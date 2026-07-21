"""跨服务 E2E 测试共享 fixtures（V11-11）。

设计原则：
- Python 服务（TECH-DATA / TECH-AGENT）使用真实 ASGI TestClient + httpx.AsyncClient
  跑全链路，与各自 tests/conftest.py 同源（registry 全部使用内存实现）。
- Java 服务（TECH-RULE / TECH-WFE / TECH-EA）通过轻量 Mock FastAPI app 模拟
  响应，目的是验证链路定义、请求顺序、参数契约以及 trace_id 传播。Mock app
  会记录所有请求的 (method, path, body, headers) 以便测试断言。
- 所有 client 共享同一组 tenant_headers（X-Tenant-Id / X-Trace-Id），便于
  验证 trace_id 全链路传播。

包名冲突处理：
  TECH-DATA 与 TECH-AGENT 都使用 ``app`` 作为顶层包名，无法在同一个 Python
  进程中同时导入。本 conftest 通过 ``sys.modules`` 缓存清理 + app 对象缓存
  的方式隔离两个服务：每次构建 app 前清理 ``app.*`` 缓存并切换 sys.path，
  构建完成后缓存 FastAPI app 对象。后续请求处理通过 ``app.state.registry``
  获取 service，不依赖 sys.modules，因此两个 app 对象可以共存。
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

# --------------------------------------------------------------- 路径常量

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TECH_DATA_DIR = _REPO_ROOT / "TECH-DATA"
_TECH_AGENT_DIR = _REPO_ROOT / "TECH-AGENT"


# --------------------------------------------------------------- 服务隔离


def _switch_service(svc_dir: Path) -> None:
    """切换 sys.modules 中的 ``app`` 包到指定服务目录。

    清理所有 ``app`` 及 ``app.*`` 子模块缓存，确保下次 import 时从指定
    ``svc_dir`` 重新加载。同时把 ``svc_dir`` 放到 sys.path 最前。
    """
    # 清理所有 app.* 子模块缓存
    for mod_name in list(sys.modules.keys()):
        if mod_name == "app" or mod_name.startswith("app."):
            del sys.modules[mod_name]
    # 把 svc_dir 放在 sys.path 最前
    svc_str = str(svc_dir)
    if svc_str in sys.path:
        sys.path.remove(svc_str)
    sys.path.insert(0, svc_str)


# 模块加载时预先切换到 TECH-AGENT，导入 create_token 并缓存为模块级变量。
# 这样后续 tenant_headers fixture 不依赖 sys.modules 中的 app 包。
_switch_service(_TECH_AGENT_DIR)
from app.common.jwt_auth import create_token as _agent_create_token  # type: ignore  # noqa: E402


# --------------------------------------------------------------- 共享常量

TENANT_ID = "tenant-e2e"


@pytest.fixture
def trace_id() -> str:
    """每个测试用例使用独立的 trace_id，避免跨用例污染。"""
    return f"e2e-{uuid.uuid4().hex[:12]}"


@pytest.fixture
def tenant_headers(trace_id: str) -> dict[str, str]:
    """标准请求头：包含 tenant / trace / Authorization。"""
    claims = {
        "sub": "user-e2e",
        "username": "e2e-user",
        "tenantId": TENANT_ID,
        "roles": ["user"],
        "type": "access",
    }
    token = _agent_create_token(claims, expires_in_seconds=3600)
    return {
        "X-Tenant-Id": TENANT_ID,
        "X-Trace-Id": trace_id,
        "Authorization": f"Bearer {token}",
    }


@pytest.fixture
def auth_headers_no_trace() -> dict[str, str]:
    """仅包含 tenant / Authorization，不包含 X-Trace-Id。

    用于验证服务在缺失 trace_id 时自动生成 UUID v4 的行为。
    """
    claims = {
        "sub": "user-e2e",
        "username": "e2e-user",
        "tenantId": TENANT_ID,
        "roles": ["user"],
        "type": "access",
    }
    token = _agent_create_token(claims, expires_in_seconds=3600)
    return {
        "X-Tenant-Id": TENANT_ID,
        "Authorization": f"Bearer {token}",
    }


# --------------------------------------------------------------- app 缓存

_APP_CACHE: dict[str, FastAPI] = {}


def _build_data_app() -> FastAPI:
    """构建 TECH-DATA FastAPI app（使用内存 registry）。"""
    _switch_service(_TECH_DATA_DIR)
    from app.api.v1.router import router as v1_router  # type: ignore
    from app.common.middleware import (  # type: ignore
        install_exception_handlers,
        install_trace_id_middleware,
    )
    from app.deps import Registry  # type: ignore
    from app.models.repository import InMemoryDataSourceRepository  # type: ignore
    from app.services.connectors import (  # type: ignore
        MockConnectionTester,
        MockSchemaExplorer,
    )
    from app.services.datasource_service import DataSourceService  # type: ignore
    from app.services.schema_discovery_service import SchemaDiscoveryService  # type: ignore
    from app.etl.repository import InMemoryEtlTaskRepository  # type: ignore
    from app.etl.service import EtlTaskService  # type: ignore
    from app.dbt.repository import InMemoryDbtRepository  # type: ignore
    from app.dbt.service import DbtService  # type: ignore
    from app.lakehouse.repository import InMemoryLakehouseRepository  # type: ignore
    from app.lakehouse.service import LakehouseService  # type: ignore
    from app.warehouse.service import WarehouseService  # type: ignore
    from app.catalog.service import CatalogService  # type: ignore
    from app.deliverables.service import DeliverableService  # type: ignore
    from app.lineage.service import LineageService  # type: ignore
    from app.quality.service import QualityService  # type: ignore
    from app.monitoring.service import MonitoringService  # type: ignore
    from app.search.service import SearchService  # type: ignore

    repository = InMemoryDataSourceRepository()
    tester = MockConnectionTester()
    explorer = MockSchemaExplorer()
    ds_service = DataSourceService(repository, tester=tester)
    schema_service = SchemaDiscoveryService(ds_service, explorer=explorer)
    registry = Registry(
        repository=repository,
        tester=tester,
        explorer=explorer,
        datasource_service=ds_service,
        schema_discovery_service=schema_service,
        etl_service=EtlTaskService(InMemoryEtlTaskRepository()),
        dbt_service=DbtService(InMemoryDbtRepository()),
        lakehouse_service=LakehouseService(InMemoryLakehouseRepository()),
        warehouse_service=WarehouseService(),
        catalog_service=CatalogService(),
        quality_service=QualityService(),
        monitoring_service=MonitoringService(),
        deliverable_service=DeliverableService(),
        search_service=SearchService(DeliverableService()),
        lineage_service=LineageService(),
    )

    app = FastAPI(title="TECH-DATA-E2E")
    install_trace_id_middleware(app)
    install_exception_handlers(app)
    app.state.registry = registry
    app.include_router(v1_router)
    return app


def _build_agent_app() -> FastAPI:
    """构建 TECH-AGENT FastAPI app（使用内存 registry）。"""
    _switch_service(_TECH_AGENT_DIR)
    from app.agents.repository import InMemoryAgentRepository  # type: ignore
    from app.agents.service import AgentService  # type: ignore
    from app.api.v1.router import router as v1_router  # type: ignore
    from app.card.service import AgentCardService  # type: ignore
    from app.checkpoint.repository import InMemoryCheckpointRepository  # type: ignore
    from app.checkpoint.service import CheckpointService  # type: ignore
    from app.clients.action import ActionClient  # type: ignore
    from app.clients.llmgw import LLMGWClient  # type: ignore
    from app.clients.rag import RAGClient  # type: ignore
    from app.common.middleware import (  # type: ignore
        install_exception_handlers,
        install_trace_id_middleware,
    )
    from app.conversations.repository import InMemoryConversationRepository  # type: ignore
    from app.conversations.service import ConversationService  # type: ignore
    from app.deps import Registry, set_registry  # type: ignore
    from app.evaluation.service import EvaluationService  # type: ignore
    from app.events.outbox import OutboxService  # type: ignore
    from app.execution.engine import ExecutionEngine  # type: ignore
    from app.execution.service import ExecutionService  # type: ignore
    from app.memory.repository import InMemoryMemoryRepository  # type: ignore
    from app.memory.service import MemoryService  # type: ignore
    from app.steps.repository import InMemoryStepRepository  # type: ignore
    from app.steps.service import StepService  # type: ignore
    from app.tasks.repository import InMemoryTaskRepository  # type: ignore
    from app.tasks.service import TaskService  # type: ignore
    from app.tools.repository import InMemoryToolRepository  # type: ignore
    from app.tools.service import ToolService  # type: ignore

    repository = InMemoryAgentRepository()
    agent_service = AgentService(repository)
    llm_client = LLMGWClient(base_url="")
    action_client = ActionClient(base_url="")
    rag_client = RAGClient(base_url="")
    engine = ExecutionEngine(
        llm_client,
        rag_client=rag_client,
        action_client=action_client,
    )
    execution_service = ExecutionService(agent_service, engine)
    memory_repo = InMemoryMemoryRepository()
    memory_service = MemoryService(memory_repo)
    checkpoint_repo = InMemoryCheckpointRepository()
    checkpoint_service = CheckpointService(checkpoint_repo)
    outbox_service = OutboxService()
    task_repo = InMemoryTaskRepository()
    task_service = TaskService(task_repo)
    conversation_repo = InMemoryConversationRepository()
    conversation_service = ConversationService(
        conversation_repo, agent_service, execution_service
    )
    tool_repo = InMemoryToolRepository()
    tool_service = ToolService(tool_repo, action_client, rag_client)
    step_repo = InMemoryStepRepository()
    step_service = StepService(step_repo)
    card_service = AgentCardService(agent_service)
    evaluation_service = EvaluationService()

    reg = Registry(
        repository=repository,
        agent_service=agent_service,
        llm_client=llm_client,
        execution_engine=engine,
        execution_service=execution_service,
        action_client=action_client,
        rag_client=rag_client,
        memory_repository=memory_repo,
        memory_service=memory_service,
        checkpoint_repository=checkpoint_repo,
        checkpoint_service=checkpoint_service,
        outbox_service=outbox_service,
        task_repository=task_repo,
        task_service=task_service,
        conversation_repository=conversation_repo,
        conversation_service=conversation_service,
        tool_repository=tool_repo,
        tool_service=tool_service,
        step_repository=step_repo,
        step_service=step_service,
        card_service=card_service,
        evaluation_service=evaluation_service,
    )
    set_registry(reg)

    app = FastAPI(title="TECH-AGENT-E2E")
    install_trace_id_middleware(app)
    install_exception_handlers(app)
    app.state.registry = reg
    app.include_router(v1_router)
    return app


@pytest.fixture(autouse=True)
def _reset_app_state():
    """每个测试前重置缓存 app 的内存状态（autouse）。

    确保 _APP_CACHE 中缓存的 FastAPI app 不会因为上一个测试遗留的
    内存数据而影响下一个测试。对 TECH-DATA 手动清理 QualityService
    的内部状态（Registry.reset 不覆盖 quality_service），对 TECH-AGENT
    直接调用 Registry.reset()（已覆盖所有 in-memory repo + evaluation）。
    """
    if "data" in _APP_CACHE:
        reg = _APP_CACHE["data"].state.registry
        reg.reset()  # 清理 repository + 重新绑定 mock connectors
        # QualityService 有自己的内部状态，需要手动清理
        qs = reg.quality_service
        qs._rules.clear()
        qs._results.clear()
        qs._issues.clear()
        qs._last_run.clear()
        qs._jobs.clear()
    if "agent" in _APP_CACHE:
        _APP_CACHE["agent"].state.registry.reset()
    yield


@pytest.fixture
async def data_client() -> AsyncClient:
    """TECH-DATA 真实 ASGI client。"""
    if "data" not in _APP_CACHE:
        _APP_CACHE["data"] = _build_data_app()
    app = _APP_CACHE["data"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://data.test") as ac:
        yield ac


@pytest.fixture
async def agent_client() -> AsyncClient:
    """TECH-AGENT 真实 ASGI client。"""
    if "agent" not in _APP_CACHE:
        _APP_CACHE["agent"] = _build_agent_app()
    app = _APP_CACHE["agent"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://agent.test") as ac:
        yield ac


# --------------------------------------------------------------- Java 服务 Mock


class _CIDict(dict):
    """Case-insensitive dict for HTTP headers.

    存储时统一小写 key，查询时也小写化，避免 httpx 默认小写 header
    与测试中混合大小写断言（``X-Trace-Id`` vs ``x-trace-id``）冲突。
    """

    def __setitem__(self, key: str, value: Any) -> None:
        super().__setitem__(key.lower(), value)

    def __getitem__(self, key: str) -> Any:
        return super().__getitem__(key.lower())

    def get(self, key: str, default: Any = None) -> Any:
        return super().get(key.lower(), default)

    def __contains__(self, key: object) -> bool:
        if isinstance(key, str):
            return super().__contains__(key.lower())
        return super().__contains__(key)


class _MockCallRecord:
    """单次 Mock 调用记录。"""

    def __init__(
        self,
        method: str,
        path: str,
        body: Any | None,
        headers: dict[str, str],
    ) -> None:
        self.method = method
        self.path = path
        self.body = body
        # 仅保留与链路相关的 header，便于断言；使用 case-insensitive dict
        cid = _CIDict()
        for k, v in headers.items():
            if k.lower() in {"x-trace-id", "x-tenant-id", "authorization"}:
                cid[k] = v
        self.headers = cid


class _MockCallLog:
    """记录所有 Mock 调用，供测试断言。"""

    def __init__(self) -> None:
        self.calls: list[_MockCallRecord] = []

    def reset(self) -> None:
        self.calls.clear()

    def record(
        self,
        method: str,
        path: str,
        body: Any | None,
        headers: dict[str, str],
    ) -> None:
        self.calls.append(_MockCallRecord(method, path, body, headers))

    @property
    def paths(self) -> list[str]:
        return [c.path for c in self.calls]


@pytest.fixture
def mock_call_log() -> _MockCallLog:
    return _MockCallLog()


def _build_java_mock_app(
    name: str,
    call_log: _MockCallLog,
) -> FastAPI:
    """构建一个轻量 FastAPI app 模拟 Java 服务的响应。

    每个 Java 服务（TECH-RULE / TECH-WFE / TECH-EA）都会构建自己的 mock app。
    所有响应都是预设的固定数据，符合对应 Java controller 的契约。
    请求到达时会被记录到 call_log 中。
    """

    app = FastAPI(title=f"{name}-Mock")

    @app.middleware("http")
    async def _record(request: Request, call_next):
        # 读取 body 后必须重新放回 receive 队列
        body_bytes = await request.body()

        async def _receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        request._receive = _receive  # type: ignore

        # 解析 JSON body（如果可能）
        parsed_body: Any | None = None
        if body_bytes:
            try:
                import json
                parsed_body = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                parsed_body = body_bytes.decode("utf-8", errors="replace")

        # 在请求处理前记录，以便断言顺序
        call_log.record(
            method=request.method,
            path=request.url.path,
            body=parsed_body,
            headers=dict(request.headers),
        )
        response = await call_next(request)
        # 透传 trace_id
        trace_id = request.headers.get("X-Trace-Id")
        if trace_id and "x-trace-id" not in {k.lower() for k in response.headers.keys()}:
            response.headers["X-Trace-Id"] = trace_id
        return response

    _register_rule_routes(app)
    _register_wfe_routes(app)
    _register_ea_routes(app)
    return app


def _ok(data: Any, trace_id: str | None = None) -> dict[str, Any]:
    """符合 Java ApiResponse.success 契约的响应体。"""
    payload: dict[str, Any] = {"code": 0, "message": "OK", "data": data}
    if trace_id:
        payload["traceId"] = trace_id
    return payload


def _register_rule_routes(app: FastAPI) -> None:
    """TECH-RULE 决策表 Mock 路由。"""
    from fastapi import Request

    @app.post("/api/v1/rule/decision-tables")
    async def _create(request: Request):
        body = await request.json()
        return _ok({
            "id": "dt-mock-001",
            "name": body.get("name", "mock-table"),
            "hitPolicy": body.get("hitPolicy", "FIRST"),
            "columns": body.get("columns", []),
            "rows": [],
            "status": "DRAFT",
        }, request.headers.get("X-Trace-Id"))

    @app.get("/api/v1/rule/decision-tables")
    async def _list():
        return _ok({
            "items": [],
            "total": 0,
            "page": 1,
            "pageSize": 20,
        })

    @app.get("/api/v1/rule/decision-tables/{table_id}")
    async def _get(table_id: str, request: Request):
        return _ok({
            "id": table_id,
            "name": "mock-table",
            "hitPolicy": "FIRST",
            "columns": [
                {"id": "col-in-1", "name": "age", "type": "INPUT", "dataType": "number"},
                {"id": "col-out-1", "name": "level", "type": "OUTPUT", "dataType": "string"},
            ],
            "rows": [
                {
                    "id": "row-1",
                    "inputs": {"age": 30},
                    "outputs": {"level": "adult"},
                    "enabled": True,
                },
            ],
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/rule/decision-tables/{table_id}/rows")
    async def _add_row(table_id: str, request: Request):
        body = await request.json()
        return _ok({
            "id": "row-mock-001",
            "inputs": body.get("inputs", {}),
            "outputs": body.get("outputs", {}),
            "enabled": body.get("enabled", True),
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/rule/decision-tables/{table_id}/rows/batch")
    async def _batch_rows(table_id: str, request: Request):
        body = await request.json()
        rows = body.get("rows", [])
        return _ok([
            {
                "id": f"row-batch-{i}",
                "inputs": r.get("inputs", {}),
                "outputs": r.get("outputs", {}),
                "enabled": True,
            }
            for i, r in enumerate(rows)
        ], request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/rule/decision-tables/{table_id}/execute")
    async def _execute(table_id: str, request: Request):
        body = await request.json()
        input_data = body.get("inputData", {})
        # 简单匹配：如果 age==30 命中 row-1
        if input_data.get("age") == 30:
            matched = [{
                "id": "row-1",
                "inputs": {"age": 30},
                "outputs": {"level": "adult"},
                "enabled": True,
            }]
            outputs = [{"level": "adult"}]
        else:
            matched = []
            outputs = []
        return _ok({
            "matchedRows": matched,
            "outputs": outputs,
            "executionTimeMs": 3,
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/rule/decision-tables/{table_id}/test")
    async def _test(table_id: str, request: Request):
        body = await request.json()
        return _ok({
            "tableId": table_id,
            "inputData": body.get("inputData", {}),
            "matchedRows": [],
            "outputs": [],
            "executionTimeMs": 2,
            "success": True,
        }, request.headers.get("X-Trace-Id"))


def _register_wfe_routes(app: FastAPI) -> None:
    """TECH-WFE apphub Mock 路由。"""
    from fastapi import Request

    @app.get("/api/v1/apphub/apps/{app_id}/versions")
    async def _list_versions(app_id: str, request: Request):
        return _ok({
            "items": [
                {
                    "versionId": "v-mock-1",
                    "appId": app_id,
                    "version": "v1",
                    "snapshot": "{}",
                    "status": "PUBLISHED",
                },
                {
                    "versionId": "v-mock-2",
                    "appId": app_id,
                    "version": "v2",
                    "snapshot": "{}",
                    "status": "DRAFT",
                },
            ],
            "total": 2,
            "page": 1,
            "pageSize": 20,
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/apphub/apps/{app_id}/versions")
    async def _create_version(app_id: str, request: Request):
        body = await request.json()
        return _ok({
            "versionId": f"v-new-{app_id}",
            "appId": app_id,
            "version": body.get("version", "v-new"),
            "snapshot": body.get("snapshot", "{}"),
            "status": "DRAFT",
        }, request.headers.get("X-Trace-Id"))

    @app.get("/api/v1/apphub/versions/{version_id}")
    async def _get_version(version_id: str, request: Request):
        return _ok({
            "versionId": version_id,
            "appId": "app-mock-001",
            "version": "v1",
            "snapshot": "{}",
            "status": "PUBLISHED",
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/apphub/versions/{version_id}/rollback")
    async def _rollback(version_id: str, request: Request):
        return _ok({
            "versionId": f"v-rollback-from-{version_id}",
            "appId": "app-mock-001",
            "version": "v-rollback",
            "snapshot": "{}",
            "status": "ROLLBACK",
            "rolledBackAt": "2026-07-20T10:00:00Z",
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/apphub/versions/{version_id}/publish")
    async def _publish(version_id: str, request: Request):
        return _ok({
            "versionId": version_id,
            "appId": "app-mock-001",
            "version": "v1",
            "snapshot": "{}",
            "status": "PUBLISHED",
        }, request.headers.get("X-Trace-Id"))

    @app.delete("/api/v1/apphub/versions/{version_id}")
    async def _delete(version_id: str, request: Request):
        return _ok(None, request.headers.get("X-Trace-Id"))

    @app.get("/api/v1/apphub/templates")
    async def _list_templates(request: Request):
        return _ok([
            {
                "id": "tpl-mock-001",
                "name": "客服机器人模板",
                "category": "service",
                "summary": "面向客服场景的机器人模板",
                "installs": 120,
                "rating": 4.7,
                "tags": ["客服", "机器人"],
            },
            {
                "id": "tpl-mock-002",
                "name": "数据分析助手模板",
                "category": "analytics",
                "summary": "面向数据分析的助手模板",
                "installs": 88,
                "rating": 4.5,
                "tags": ["数据", "分析"],
            },
        ], request.headers.get("X-Trace-Id"))

    @app.get("/api/v1/apphub/templates/{template_id}")
    async def _get_template(template_id: str, request: Request):
        return _ok({
            "id": template_id,
            "name": "客服机器人模板",
            "category": "service",
            "summary": "面向客服场景的机器人模板",
            "installs": 120,
            "rating": 4.7,
            "tags": ["客服", "机器人"],
            "config": {"model": "doubao-pro", "tools": ["rag"]},
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/apphub/templates/{template_id}/install")
    async def _install_template(template_id: str, request: Request):
        return _ok({
            "installId": f"ins-{template_id}",
            "templateId": template_id,
            "appId": f"app-from-{template_id}",
            "status": "INSTALLED",
            "installedAt": "2026-07-20T10:00:00Z",
        }, request.headers.get("X-Trace-Id"))

    @app.post("/api/v1/apphub/templates/{template_id}/comments")
    async def _add_comment(template_id: str, request: Request):
        body = await request.json()
        return _ok({
            "id": "cmt-mock-001",
            "templateId": template_id,
            "userId": body.get("userId", "user-e2e"),
            "rating": body.get("rating", 5),
            "content": body.get("content", ""),
            "createdAt": "2026-07-20T10:00:00Z",
        }, request.headers.get("X-Trace-Id"))

    @app.get("/api/v1/apphub/templates/{template_id}/comments")
    async def _list_comments(template_id: str, request: Request):
        return _ok([
            {
                "id": "cmt-mock-001",
                "templateId": template_id,
                "userId": "user-e2e",
                "rating": 5,
                "content": "very good",
                "createdAt": "2026-07-20T10:00:00Z",
            }
        ], request.headers.get("X-Trace-Id"))


def _register_ea_routes(app: FastAPI) -> None:
    """TECH-EA mapping Mock 路由。"""
    from fastapi import Request

    @app.get("/api/v1/ea/capability-mappings")
    async def _list_mappings(request: Request):
        return _ok([
            {
                "id": "map-mock-001",
                "capabilityId": "cap-001",
                "conceptId": "concept-customer",
                "mappingType": "MANUAL",
                "status": "ACTIVE",
            }
        ], request.headers.get("X-Trace-Id"))

    @app.get("/api/v1/ea/capability-mappings/consistency")
    async def _consistency(request: Request):
        return _ok({
            "total": 1,
            "consistent": 1,
            "inconsistent": 0,
            "details": [],
        }, request.headers.get("X-Trace-Id"))


@pytest.fixture
async def rule_client(mock_call_log: _MockCallLog) -> AsyncClient:
    """TECH-RULE（Java）Mock client。"""
    app = _build_java_mock_app("TECH-RULE", mock_call_log)
    mock_call_log.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://rule.test") as ac:
        yield ac


@pytest.fixture
async def wfe_client(mock_call_log: _MockCallLog) -> AsyncClient:
    """TECH-WFE（Java）Mock client。"""
    app = _build_java_mock_app("TECH-WFE", mock_call_log)
    mock_call_log.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://wfe.test") as ac:
        yield ac


@pytest.fixture
async def ea_client(mock_call_log: _MockCallLog) -> AsyncClient:
    """TECH-EA（Java）Mock client。"""
    app = _build_java_mock_app("TECH-EA", mock_call_log)
    mock_call_log.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://ea.test") as ac:
        yield ac
