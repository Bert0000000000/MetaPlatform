# DeerFlow 深度调研 Agent · Code Mode 拆分 prompt(7 PR)· 2026-08-02

> 版本:v1.0 · 2026-08-02
> 配套:`2026-08-02-deerflow-deep-research-agent-spec.md` v1.0(完整规范)
> 状态:**Active**(code 模式立即可执行)

---

## 总览:7 PR 拆分 + 推荐并行

| PR | 内容 | 工作量 | 并行? |
|---|---|---:|---|
| **PR-1** | 新建 `mate-tech-deep-research` 包(5 步合规)| 1 周 | 🔴 **必须先做** |
| **PR-2** | 单元测试 + 5 步 checklist 完整 | 0.5 周 | 🔴 依赖 PR-1 |
| **PR-3** | `mate-app-a2a` 自动注册 DeerFlow agent | 0.5 周 | 🟢 可与 PR-2 并行 |
| **PR-4** | `mate-app-copilot` 智能路由 | 1 周 | 🟡 依赖 PR-3(需 agent card)|
| **PR-5** | DeerFlow Engine docker-compose + `research` profile | 0.5 天 | 🟢 可与 PR-1 并行 |
| **PR-6** | e2e smoke + 端到端测试 | 0.5 周 | 🔴 依赖 PR-1 / 3 / 4 / 5 |
| **PR-7** | ACCEPTANCE 文档 + 13 硬规则验收 | 0.5 周 | 🔴 依赖 PR-6 |

**总时长**(并行优化):~3 周(串行需 4 周)

---

## PR-1:新建 `mate-tech-deep-research` 包(5 步合规)🔴 必须先做

```text
你是 Mate Platform 的 code 模式执行者,任务是 **PR-1: 新建 mate-tech-deep-research 包(5 步合规)**。
今天 2026-08-02。

## 必读规范

`docs/active/specs/2026-08-02-deerflow-deep-research-agent-spec.md` v1.0(完整)
  - §5 实施步骤 1-4(包结构 + DeerFlowClient + A2AAdapter + main.py)
  - §4.2 5 步 checklist
  - §4.3 13 硬规则对齐

## 任务目标

新建 `packages/mate-tech-deep-research/` Python 包:
- 5 步合规(install_auth + require_tenant + outbox + BearerAuth + 跨租户 tests)
- A2A 协议适配(endpoint 暴露)
- httpx 客户端 for DeerFlow Engine
- OpenAPI 契约 `deep-research.yaml`
- 7 类测试 ≥ 30 cases

## 修改文件清单

```
packages/mate-tech-deep-research/
  pyproject.toml                                    [新建]
  src/mate_tech_deep_research/
    __init__.py                                      [新建]
    main.py                                          [新建] install_auth + app + healthz
    api/
      __init__.py                                    [新建]
      router.py                                      [新建] A2A /api/v1/a2a/agent/deep-research/invoke
      schemas.py                                     [新建] ResearchRequest / ResearchResponse / Source / ErrorResponse
    deerflow/
      __init__.py                                    [新建]
      client.py                                      [新建] DeerFlowClient(httpx + BearerAuth)
    events/
      __init__.py                                    [新建]
      publisher.py                                   [新建] publish_research_completed(emit outbox event)
    schemas.py                                       [新建] 全 Pydantic models
  tests/
    __init__.py                                      [新建]
    test_deerflow_client.py                          [新建] ≥ 8 cases
    test_a2a_protocol.py                             [新建] ≥ 5 cases
    test_tenant_integration.py                       [新建] ≥ 3 cases(5 步合规)
    test_error_handling.py                           [新建] ≥ 5 cases
    test_outbox_event.py                             [新建] ≥ 2 cases
    test_openapi_contract.py                         [新建] ≥ 2 cases
    test_cors_and_security.py                        [新建] ≥ 5 cases

contracts/openapi/services/deep-research.yaml       [新建] 完整 OpenAPI spec
```

## 关键代码(完整实现,见规范 §5)

### packages/mate-tech-deep-research/pyproject.toml
```toml
[project]
name = "mate-tech-deep-research"
version = "0.1.0"
dependencies = [
    "fastapi>=0.115",
    "httpx>=0.27",
    "structlog>=24.1",
    "mate-platform",
    "mate-clients",
]
[tool.uv.workspace.members]  # 加入 workspace
```

### src/mate_tech_deep_research/main.py
```python
from __future__ import annotations
from fastapi import FastAPI
from mate_platform.auth import install_auth
from .api.router import router

app = FastAPI(title="mate-tech-deep-research")
install_auth(app)
app.include_router(router)

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
```

### src/mate_tech_deep_research/api/router.py
```python
from fastapi import APIRouter, Request, HTTPException
from mate_platform.auth import require_tenant
from mate_platform.messaging import Event, OutboxWriter
from ..deerflow.client import DeerFlowClient, DeerFlowUnavailableError
from ..schemas import ResearchRequest, ResearchResponse

router = APIRouter()

@router.post("/api/v1/a2a/agent/deep-research/invoke")
async def invoke_deep_research(request: Request, body: dict) -> dict:
    ctx = request.state.ctx
    require_tenant(ctx)
    
    capability_id = body.get("capability_id")
    input_data = body.get("input", {})
    
    if capability_id == "web-research":
        req = ResearchRequest(
            query=input_data["query"],
            depth=input_data.get("depth", "deep"),
            max_sources=input_data.get("max_sources", 10),
            output_format=input_data.get("output_format", "markdown"),
        )
        client = _get_client()
        try:
            result = await client.research(req)
        except DeerFlowUnavailableError as exc:
            raise HTTPException(status_code=503, detail={
                "code": "E_DEERFLOW_UNAVAILABLE",
                "message": str(exc),
            })
        
        outbox: OutboxWriter = request.app.state.outbox_writer
        outbox.append(Event.create(
            type="deep.research.completed",
            tenant_id=ctx.tenant_id,
            aggregate_id=f"research-{ctx.tenant_id}",
            payload={
                "query": req.query,
                "depth": req.depth,
                "report_size": len(result.report),
                "sources_count": len(result.sources),
                "duration_ms": result.duration_ms,
            },
            trace_id=ctx.trace_id,
        ))
        
        return {
            "capability_id": capability_id,
            "report": result.report,
            "sources": [s.dict() for s in result.sources],
            "duration_ms": result.duration_ms,
        }
    else:
        raise HTTPException(status_code=400, detail=f"unknown capability: {capability_id}")

_client: DeerFlowClient | None = None
def _get_client() -> DeerFlowClient:
    global _client
    if _client is None:
        _client = DeerFlowClient()
    return _client
```

### src/mate_tech_deep_research/deerflow/client.py
```python
import os, httpx, structlog
from ..api.schemas import ResearchRequest, ResearchResponse, Source
from datetime import datetime

logger = structlog.get_logger(__name__)


class DeerFlowClient:
    DEFAULT_URL = "http://deerflow-engine:8001"
    DEFAULT_TIMEOUT = 300.0

    def __init__(self, base_url=None, api_key=None, timeout=DEFAULT_TIMEOUT):
        self.base_url = (base_url or os.environ.get("DEERFLOW_URL", self.DEFAULT_URL)).rstrip("/")
        self.api_key = api_key or os.environ.get("DEERFLOW_API_KEY", "")
        self.timeout = timeout
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        self._available = False

    async def check(self) -> bool:
        try:
            r = await self._client.get("/healthz", timeout=5.0)
            self._available = r.status_code == 200
            return self._available
        except Exception:
            self._available = False
            return False

    async def research(self, request: ResearchRequest) -> ResearchResponse:
        if not self._available:
            await self.check()
            if not self._available:
                raise DeerFlowUnavailableError("DeerFlow Engine unavailable")

        resp = await self._client.post("/api/research", json={
            "query": request.query,
            "depth": request.depth,
            "max_sources": request.max_sources,
            "output_format": request.output_format,
        })
        resp.raise_for_status()
        data = resp.json()
        return ResearchResponse(
            report=data["report"],
            sources=[Source(**s) for s in data["sources"]],
            duration_ms=data["duration_ms"],
        )

    async def close(self):
        await self._client.aclose()


class DeerFlowUnavailableError(Exception):
    pass
```

### contracts/openapi/services/deep-research.yaml
```yaml
openapi: 3.1.0
info:
  title: Deep Research Agent API
  version: 1.0.0
paths:
  /api/v1/a2a/agent/deep-research/invoke:
    post:
      operationId: deepResearchInvokeDeepResearch
      summary: Delegate a deep research task to DeerFlow
      tags: [deep-research]
      x-mate-owner: ai-protocols
      x-mate-permission: deep-research.invoke
      x-mate-requirements: [FR-DEEP-RESEARCH-INVOKE]
      x-mate-implementation-status: implemented
      security:
        - bearerAuth: []
          tenantHeader: []
          oidcScopes: [platform.write]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DeepResearchInvokeRequest'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeepResearchInvokeResponse'
        '503':
          description: DeerFlow Engine unavailable
components:
  securitySchemes:
    bearerAuth: {type: http, scheme: bearer}
    tenantHeader: {type: apiKey, in: header, name: X-Tenant-Id}
  schemas:
    DeepResearchInvokeRequest:
      type: object
      properties:
        capability_id: {type: string, enum: [web-research]}
        input:
          type: object
          properties:
            query: {type: string}
            depth: {type: string, enum: [shallow, medium, deep], default: deep}
            max_sources: {type: integer, default: 10}
            output_format: {type: string, enum: [markdown, json], default: markdown}
    DeepResearchInvokeResponse:
      type: object
      properties:
        report: {type: string}
        sources:
          type: array
          items: {$ref: '#/components/schemas/Source'}
        duration_ms: {type: integer}
    Source:
      type: object
      properties:
        url: {type: string}
        title: {type: string}
        snippet: {type: string}
        reliability: {type: string, enum: [high, medium, low]}
        fetched_at: {type: string, format: date-time}
```

## ADR-0014 5 步 checklist

- [ ] 步骤 1:`install_auth(app)` 在 `main.py` 第一行
- [ ] 步骤 2:`invoke_deep_research` 第一行 `require_tenant(ctx)`
- [ ] 步骤 3:`outbox.append(Event.create(...))` 同事务
- [ ] 步骤 4:DeerFlow Engine 出向调用用 `BearerAuth`(已在 client.py)
- [ ] 步骤 5:`tests/test_tenant_integration.py` ≥ 3 cross-tenant negative
- [ ] 步骤 6:`deep-research.yaml` security: 三段式

## 验收

```bash
cd mate-platform-backend/packages/mate-tech-deep-research
pytest tests/ -v
# 期望 ≥ 30 passed,0 failed

cd ../..
python -c "from mate_tech_deep_research.main import app; print('OK')"
# 期望:OK

# OpenAPI 契约
redocly bundle contracts/openapi/services/deep-research.yaml
# 期望:0 errors
```

## 提交与 PR

```
commit: feat(deep-research): P3-W2 PR-1 新建 mate-tech-deep-research 包(5 步合规)

PR 描述:
  - 关联规范: docs/active/specs/2026-08-02-deerflow-deep-research-agent-spec.md v1.0
  - 关联 ADR: ADR-0014(5 步接入模式)
  - 关联 PRD: PRD-APP-COPILOT_v2.3 §3.x(深度调研)
  - 新增: packages/mate-tech-deep-research/ 全套
  - 测试: ≥ 30 cases pass
  - OpenAPI: deep-research.yaml
```

## 风险

- httpx timeout 5 分钟可能占用 worker 线程 — 用 `anyio.to_thread.run_sync` 或 `asyncio.wait_for` 保护
- DeerFlow Engine 未启动时所有请求 503 — 在 README 明确说明需要先起 Engine
```

---

## PR-2:单元测试 + 5 步 checklist 完整 🔴 依赖 PR-1

```text
你是 Mate Platform 的 code 模式执行者,任务是 **PR-2: 单元测试 + 5 步 checklist 完整**。
今天 2026-08-02。

## 任务目标

为 PR-1 新建的 `mate-tech-deep-research` 包补充完整单元测试,覆盖 5 步合规的每一项。

## 修改文件清单

```
packages/mate-tech-deep-research/tests/
  test_install_auth.py                    [新建] ≥ 2 cases(install_auth 在第一行)
  test_require_tenant.py                  [新建] ≥ 5 cases(缺 tenant / 跨租户 / 正常)
  test_outbox_event.py                    [新建] ≥ 3 cases(Event.create + outbox.append)
  test_bearer_auth.py                     [新建] ≥ 3 cases(DeerFlow Engine auth)
  test_tenant_integration.py              [新建] ≥ 5 cases(跨租户 isolation)
  test_security_headers.py                [新建] ≥ 3 cases(security: 三段式)
  test_error_handling.py                  [新建] ≥ 5 cases(E_DEERFLOW_UNAVAILABLE 等)
  test_openapi_contract.py                [新建] ≥ 2 cases(spec 与 route 一致)
  test_healthz.py                         [新建] ≥ 2 cases
  test_smoke_e2e.py                       [新建] ≥ 5 cases(httpx mock DeerFlow)
```

## 验收

```bash
cd mate-platform-backend/packages/mate-tech-deep-research
pytest tests/ -v --cov=mate_tech_deep_research
# 期望:coverage ≥ 85% + ≥ 35 passed,0 failed
```

## 提交与 PR

```
commit: test(deep-research): PR-2 完整 5 步 checklist 测试
```

---

## PR-3:`mate-app-a2a` 自动注册 DeerFlow agent 🟢 可与 PR-2 并行

```text
你是 Mate Platform 的 code 模式执行者,任务是 **PR-3: mate-app-a2a 自动注册 DeerFlow agent**。
今天 2026-08-02。

## 必读规范

- `docs/active/specs/2026-08-02-deerflow-deep-research-agent-spec.md` v1.0 §5 步骤 5
- `ADR-0014-tech-services-integration.md`

## 任务目标

在 `mate-app-a2a` 启动时自动注册 `deep-research` agent(避免手工配置)。

## 修改文件清单

```
packages/mate-app-a2a/src/mate_app_a2a/
  bootstrap/
    __init__.py                           [新建]
    agent_registration.py                 [新建] register_deerflow_at_startup()
  main.py                                  [改] startup 钩子调用 register_deerflow_at_startup()
  tests/
    test_agent_registration.py            [新建] ≥ 5 cases(注册成功 / 失败 / 重复)
```

## 关键代码

```python
# packages/mate-app-a2a/src/mate_app_a2a/bootstrap/agent_registration.py
from __future__ import annotations
import os
from ..stores.agents import register_agent


def register_deerflow_at_startup():
    """Auto-register DeerFlow as an A2A agent at startup."""
    base_url = os.environ.get(
        "DEERFLOW_RESEARCH_URL",
        "http://mate-tech-deep-research:8200/api/v1/a2a/agent/deep-research/invoke"
    )
    register_agent({
        "id": "deep-research",
        "name": "深度调研 Agent",
        "description": "多 Agent 协作研究,支持网页搜索 / 文档分析 / 报告生成",
        "endpoint": base_url,
        "auth_type": "bearer",
        "capabilities": [
            {
                "id": "web-research",
                "description": "Web 搜索 + 多源调研",
                "input_schema": {
                    "query": "string",
                    "depth": "shallow|medium|deep",
                    "max_sources": "integer",
                },
                "output_schema": {
                    "report": "string (markdown)",
                    "sources": "array of {url, title, snippet}",
                },
            },
        ],
    })


def register_deerflow_at_startup_if_enabled():
    """Only register if DEERFLOW_RESEARCH_ENABLED=true (default true)."""
    if os.environ.get("DEERFLOW_RESEARCH_ENABLED", "true").lower() == "true":
        register_deerflow_at_startup()
```

```python
# packages/mate-app-a2a/src/mate_app_a2a/main.py
from fastapi import FastAPI
from mate_platform.auth import install_auth
from .bootstrap.agent_registration import register_deerflow_at_startup_if_enabled

app = FastAPI(title="mate-app-a2a")
install_auth(app)
register_deerflow_at_startup_if_enabled()
```

## 验收

```bash
cd mate-platform-backend/packages/mate-app-a2a
pytest tests/ -v
# 期望 ≥ 5 cases(原 a2a + 新 agent_registration)
```

## 提交与 PR

```
commit: feat(a2a): PR-3 启动时自动注册 DeerFlow deep-research agent
```
```

---

## PR-4:`mate-app-copilot` 智能路由 🟡 依赖 PR-3

```text
你是 Mate Platform 的 code 模式执行者,任务是 **PR-4: mate-app-copilot 智能路由**。
今天 2026-08-02。

## 必读规范

- `docs/active/specs/2026-08-02-deerflow-deep-research-agent-spec.md` v1.0 §5 步骤 6

## 任务目标

在 `mate-app-copilot` 添加任务复杂度判断:简单任务走 llmgw,深度调研走 A2A → DeerFlow。

## 修改文件清单

```
packages/mate-app-copilot/src/mate_app_copilot/
  routing/
    __init__.py                            [新建]
    complexity.py                          [新建] is_deep_research_query(query)
    dispatcher.py                          [新建] dispatch(query, ctx) → llmgw OR a2a
  api/
    router.py                              [改] 用 dispatcher 替代直接 llmgw
  tests/
    test_complexity.py                     [新建] ≥ 8 cases(关键词 / 长度 / 边界)
    test_dispatcher.py                     [新建] ≥ 5 cases(路由 / 错误 / fallback)
    test_copilot_integration.py            [新建] ≥ 5 cases(e2e copilot → dispatcher)
```

## 关键代码

```python
# packages/mate-app-copilot/src/mate_app_copilot/routing/complexity.py
import re

DEEP_RESEARCH_KEYWORDS = re.compile(
    r"(调研|研究|分析|对比|综述|行业|market|industry|research|analysis|深度)",
    re.IGNORECASE
)


def is_deep_research_query(query: str) -> bool:
    """Long query + research keywords → deep research."""
    if len(query) < 30:
        return False
    return bool(DEEP_RESEARCH_KEYWORDS.search(query))
```

```python
# packages/mate-app-copilot/src/mate_app_copilot/routing/dispatcher.py
import httpx
from mate_platform.auth import require_tenant
from .complexity import is_deep_research_query


async def dispatch(query: str, llmgw_client, ctx) -> dict:
    """Dispatch query to llmgw or DeerFlow via A2A based on complexity."""
    require_tenant(ctx)
    
    if is_deep_research_query(query):
        # 深度调研: delegate to DeerFlow via A2A
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "http://mate-app-a2a:8009/api/v1/a2a/delegate",
                headers={"Authorization": f"Bearer {ctx.token}"},
                json={
                    "agent_id": "deep-research",
                    "capability_id": "web-research",
                    "input": {
                        "query": query,
                        "depth": "deep",
                        "max_sources": 10,
                    },
                },
                timeout=300.0,
            )
        return resp.json()
    else:
        # 简单任务: 走 llmgw
        return await llmgw_client.chat(query)
```

## 验收

```bash
cd mate-platform-backend/packages/mate-app-copilot
pytest tests/ -v
# 期望 ≥ 30 cases(原 copilot + 新 routing)
```

## 提交与 PR

```
commit: feat(copilot): PR-4 智能路由(简单走 llmgw / 深度调研走 A2A → DeerFlow)
```
```

---

## PR-5:DeerFlow Engine docker-compose + `research` profile 🟢 可与 PR-1 并行

```text
你是 Mate Platform 的 code 模式执行者,任务是 **PR-5: DeerFlow Engine docker-compose + research profile**。
今天 2026-08-02。

## 任务目标

把 DeerFlow Engine 作为外部 Docker 服务接入 `docker-compose.yml`,新增 `research` profile。

## 修改文件清单

```
docker-compose.yml                         [改] 新增 deerflow-engine service + research profile
infra/helm/charts/deerflow-engine/        [新建] K8s Helm chart(deerflow-engine 镜像)
  Chart.yaml
  values.yaml
  deployment.yaml
  service.yaml
  README.md

scripts/dev-server.py                     [改] 增加 research profile 启动逻辑(可选)
.env.example                              [改] 加 DEERFLOW_URL / DEERFLOW_API_KEY / TAVILY_API_KEY
PROFILES.md                               [改] 加 research profile 文档
```

## 关键 docker-compose 配置

```yaml
services:
  deerflow-engine:
    image: bytedance/deer-flow:latest
    container_name: mate-deerflow-engine
    ports: ["8001:8001"]
    environment:
      - LLM_API_KEY=${OPENAI_API_KEY}
      - LLM_BASE_URL=${OPENAI_BASE_URL:-https://api.openai.com/v1}
      - LLM_MODEL=${OPENAI_CHAT_MODEL:-gpt-4o}
      - SEARCH_API_KEY=${TAVILY_API_KEY}
      - SEARCH_PROVIDER=tavily
    volumes:
      - deerflow-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
    profiles: [research, ai]
    networks: [agent-net]
```

## 验收

```bash
docker compose --profile research config --services
# 期望:列出 deerflow-engine

docker compose --profile research up -d
docker ps | grep deerflow
# 期望:1 个 mate-deerflow-engine 容器

curl http://localhost:8001/healthz
# 期望:{"status":"ok"}
```

## 提交与 PR

```
commit: chore(docker): PR-5 新增 deerflow-engine 服务 + research profile
```
```

---

## PR-6:e2e smoke + 端到端测试 🔴 依赖 PR-1/3/4/5

```text
你是 Mate Platform 的 code 模式执行者,任务是 **PR-6: e2e smoke + 端到端测试**。
今天 2026-08-02。

## 任务目标

写一个端到端测试,跑通"用户发深度调研请求 → copilot → A2A → DeerFlow → 报告"的完整链路。

## 修改文件清单

```
acceptance/scripts/e2e_deep_research.ps1     [新建] PowerShell e2e smoke
acceptance/scripts/test_deep_research.py    [新建] Python e2e test
acceptance/REPORT-DEEP-RESEARCH.md          [新建] 烟测 evidence
tests/integration/test_deep_research.py     [新建] pytest integration test
```

## 关键 e2e test

```python
# tests/integration/test_deep_research.py
import httpx
import pytest

DEERFLOW_MOCK_RESPONSE = {
    "report": "# 调研报告\n\n## 概述\nLLM 在金融行业...",
    "sources": [
        {"url": "https://example.com/1", "title": "Source 1", "snippet": "...", "reliability": "high", "fetched_at": "2026-08-02T00:00:00"},
        {"url": "https://example.com/2", "title": "Source 2", "snippet": "...", "reliability": "medium", "fetched_at": "2026-08-02T00:00:00"},
    ],
    "duration_ms": 25000,
}


@pytest.mark.asyncio
async def test_deep_research_e2e(monkeypatch):
    """End-to-end smoke from copilot to DeerFlow."""
    # 1. Mock DeerFlow Engine
    async def mock_research(*args, **kwargs):
        return DEERFLOW_MOCK_RESPONSE
    
    monkeypatch.setattr(
        "mate_tech_deep_research.deerflow.client.DeerFlowClient.research",
        mock_research
    )
    
    # 2. 用户发深度调研请求到 copilot
    r = httpx.post(
        "http://localhost:8004/api/v1/copilot/chat",
        headers={
            "Authorization": "Bearer $JWT",
            "X-Tenant-Id": "tenant-a",
        },
        json={"query": "调研 LLM 在金融行业的应用,深度分析 5 个真实案例"},
    )
    assert r.status_code == 200
    data = r.json()
    
    # 3. 验证返回(report + sources + duration_ms)
    assert "report" in data
    assert data["report"].startswith("# ")
    assert len(data["sources"]) >= 2
    assert data["duration_ms"] > 0
    assert data["duration_ms"] < 300_000  # 5 min
    
    # 4. 验证 sources 包含 URL
    for source in data["sources"]:
        assert "url" in source
        assert source["url"].startswith("http")


@pytest.mark.asyncio
async def test_simple_query_does_not_use_deerflow(monkeypatch):
    """Short simple query should NOT trigger DeerFlow."""
    deerflow_called = False
    async def mock_research(*args, **kwargs):
        nonlocal deerflow_called
        deerflow_called = True
        return {}
    monkeypatch.setattr(
        "mate_tech_deep_research.deerflow.client.DeerFlowClient.research",
        mock_research
    )
    
    r = httpx.post(
        "http://localhost:8004/api/v1/copilot/chat",
        headers={"Authorization": "Bearer $JWT", "X-Tenant-Id": "tenant-a"},
        json={"query": "你好"},  # 太短,不触发深度调研
    )
    assert r.status_code == 200
    assert not deerflow_called  # 没调 DeerFlow
```

## 验收

```bash
cd mate-platform-backend
pytest tests/integration/test_deep_research.py -v
# 期望 ≥ 5 cases passed

bash acceptance/scripts/e2e_deep_research.ps1
# 期望:Smoke 0 failed
```

## 提交与 PR

```
commit: test(deep-research): PR-6 e2e smoke + 端到端测试
```
```

---

## PR-7:ACCEPTANCE 文档 + 13 硬规则验收 🔴 依赖 PR-6

```text
你是 Mate Platform 的 code 模式执行者,任务是 **PR-7: ACCEPTANCE 文档 + 13 硬规则验收**。
今天 2026-08-02。

## 任务目标

完成 DeerFlow 集成全部 ACCEPTANCE 文档与 13 硬规则验收。

## 修改文件清单

```
docs/active/delivery/evidence/
  P3-W2-DEERFLOW-DEEP-RESEARCH-ACCEPTANCE.md   [新建] 完整验收证据

PROGRAM-BOARD.md                             [改] v3.1 sub-batch 状态同步(DeerFlow 入列)
docs/active/specs/2026-08-01-roadmap-v3.2.md   [改] v3.2 W2 状态更新(DeerFlow 完成)
```

## P3-W2-DEERFLOW-DEEP-RESEARCH-ACCEPTANCE.md 模板

```markdown
# P3-W2 DeerFlow 深度调研 Agent 验收证据

> 验收日期: 2026-08-02
> 范围: P3-W2 DeerFlow + A2A 集成(7 PR)
> 结论: ✅ Accepted

## 1. 改动清单(7 PR)

| PR | 文件 | 关键能力 |
|---|---|---|
| PR-1 | packages/mate-tech-deep-research/(全)+ deep-research.yaml | 5 步合规 + A2A adapter + OpenAPI |
| PR-2 | tests/(≥ 35 cases) | 5 步合规完整覆盖 |
| PR-3 | packages/mate-app-a2a/bootstrap/ | DeerFlow agent 自动注册 |
| PR-4 | packages/mate-app-copilot/routing/ | 智能路由(simple vs deep research) |
| PR-5 | docker-compose.yml + infra/helm/ | DeerFlow Engine 服务 + research profile |
| PR-6 | tests/integration/ + acceptance/scripts/ | e2e smoke 端到端 |
| PR-7 | 本文档 | 13 硬规则验收 |

## 2. 测试结果

```
PR-1 + PR-2: ≥ 35 passed,0 failed
PR-3:        ≥ 5 passed,0 failed
PR-4:        ≥ 30 passed,0 failed
PR-5:        docker compose up -d OK + curl healthz OK
PR-6:        ≥ 5 e2e cases passed
```

## 3. 13 硬规则验收

| # | 硬规则 | 证据 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ deep-research.yaml 与 router.py 对齐 |
| 3 | tenant 上下文不访问 repository | ✅ require_tenant(ctx) |
| 4 | 外部系统 ACL Client | ✅ BearerAuth + OutgoingAuthMiddleware |
| 5 | Production profile 禁止 fallback | ✅ 显式 503,无 InMemory 兜底 |
| 9 | 审计、指标、trace | ✅ outbox event + OTel + audit log |
| 13 | NetworkPolicy | ✅ Helm 含 default-deny + allow |

## 4. 端到端 smoke

(贴 acceptance/REPORT-DEEP-RESEARCH.md 的核心数据)

## 5. 结论

✅ Accepted(完整 7 PR + 13 硬规则 + 35+ tests pass)
```

## 验收

```bash
# 1. 检查所有 7 PR 合入 main
git log --oneline | head -30

# 2. 检查所有 13 硬规则
grep -r "install_auth\|require_tenant\|outbox.append" packages/mate-tech-deep-research/

# 3. 检查所有测试
cd mate-platform-backend/packages/mate-tech-deep-research
pytest tests/ -v --cov=.
# 期望:coverage ≥ 85%

cd ..
pytest tests/integration/test_deep_research.py -v
# 期望 ≥ 5 cases
```

## 提交与 PR

```
commit: docs(deep-research): PR-7 P3-W2 ACCEPTANCE 文档 + 13 硬规则验收
```
```

---

## 调度时间线

```
Week 1:
  W1 Day 1-5: PR-1(必须先做)
  W1 Day 3-5: PR-5 可并行启动

Week 2:
  W2 Day 1-3: PR-2 + PR-3 并行
  W2 Day 3-5: PR-4(依赖 PR-3)

Week 3:
  W3 Day 1-3: PR-6(依赖 PR-1/3/4/5)
  W3 Day 3-5: PR-7(ACCEPTANCE)
```

---

## 关联文档

- `2026-08-02-deerflow-deep-research-agent-spec.md` v1.0 — 完整规范
- `2026-08-01-roadmap-v3.2.md` v1.0 — v3.2 W2 路线
- `2026-07-31-prd-a2a-protocol.md` v1.0 — A2A 协议
- `ADR-0014-tech-services-integration.md` — 5 步接入
- `2026-08-02-v3.2-parallel-prompts.md` — 4 worker W1-W4 通用调度

---

## 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-02 | v1.0 初版(7 PR 拆分 + 完整 prompt + 调度时间线) | 需求层(TRAE) |