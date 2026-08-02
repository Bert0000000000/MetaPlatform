# DeerFlow 深度调研 Agent 集成规范(v3.2 W2 子规范)

> 版本:v1.0 · 2026-08-02
> 关联:`2026-08-01-roadmap-v3.2.md` v1.0 阶段 2(W2 + W3)
> 关联:`2026-07-31-prd-a2a-protocol.md` v1.0 (A2A 协议规范)
> 关联:`2026-07-30-per-app-integration-checklist.md` v1.0 (5 步接入)
> 关联:`ADR-0014-tech-services-integration.md`(集成模式)
> 关联:`PROGRAM-BOARD.md` v3.1 增量 sub-batch
> 状态:**Active**(本规范作为 v3.2 W2 子规范的 part 1)
> 修订人:需求层(TRAE)

---

## 1. 背景与动机

### 1.1 背景

Mate Platform 当前 LLM 编排层(`mate-tech-llmgw` + `mate-tech-agent`)已落地 LangGraph 与裸 httpx 直连 4 个 LLM provider,**擅长**:
- 单轮问答 / 多轮对话
- 简单工具调用(function calling)
- 流式输出

**不擅长**:
- **深度调研**:多源 web 搜索 + 文档对比 + 报告生成
- **长任务**:30s ~ 5 分钟的任务(SSE 已限 30s)
- **多 Agent 协作**:planner / researcher / writer 协同

### 1.2 动机

**DeerFlow**(`bytedance/deer-flow`,MIT 协议)是字节开源的"深度调研"多 Agent 框架,天然适合:
- 多 Agent 协作(planner / researcher / writer)
- Web search + document scraping
- 报告生成(Markdown / JSON)
- 信息源引用(sources)

**且**:DeerFlow 早期在 Mate Platform v0.x 阶段有集成,2026-07-26 烟测 evidence(`acceptance/REPORT.md` line 14-15: `selectedRuntime=DEERFLOW`),但 7/29 切到 LangGraph 后 DeerFlow 已从代码移除(3 个 archive branch)。

**重构机会**:不删除 DeerFlow 概念,改为 **A2A agent 模式** —— 把 DeerFlow 重新引入,作为后端深度调研引擎,通过 A2A 协议**外置**而非内置。

### 1.3 目标

| 维度 | 目标 |
|---|---|
| 能力 | Mate Platform 支持深度调研(LLM-only 做不到) |
| 架构 | DeerFlow 作为外部 A2A agent,不影响 copilot 路由 |
| 实现 | 3 周内完成 5 步接入 + 真实可调 |
| 合规 | 符合 ADR-0014 5 步 + §13 硬规则 |
| 验证 | 端到端 smoke 跑通一个真实调研任务 |

---

## 2. 范围

### 2.1 In Scope

- 新建 `packages/mate-tech-deep-research/` Python 包
- A2A 协议适配(endpoint 暴露)
- DeerFlow Engine 部署(docker-compose service)
- `mate-app-a2a` 自动注册 DeerFlow agent
- `mate-app-copilot` 智能路由(简单任务 / 深度调研)
- 5 步接入 + §13 硬规则合规
- 测试 + 验收证据 `P3-W2-DEEPLFOW-ACCEPTANCE.md`

### 2.2 Out of Scope

- DeerFlow Engine 本身源码(用官方镜像)
- 多语言报告(只输出英文 + 中文)
- 实时流式输出调研过程(SSE 已有,DeerFlow 同步响应)
- 私有知识库集成(只支持 web 搜索)

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  用户在 SuperAI Console(copilot)                              │
│  "帮我调研下 LLM 在金融行业的应用"                            │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/v1/copilot/chat
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Mate Platform copilot (mate-app-copilot)                │
│  - 智能判断: 简单任务 / 深度调研                                │
│  - 简单任务: 走 llmgw 直接调 LLM(单次 chat)                  │
│  - 深度调研: 走 A2A delegate 到 deep-research                │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/v1/a2a/delegate
                     │   body: {
                     │     agent_id: "deep-research",
                     │     capability_id: "web-research",
                     │     input: {
                     │       query: "调研 LLM 在金融行业的应用",
                     │       depth: "deep",
                     │       max_sources: 10
                     │     }
                     │   }
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Mate Platform A2A 路由 (mate-app-a2a)                    │
│  - 查 agent-cards/search 找到 "deep-research"                │
│  - 匹配能力 "web-research"                                   │
│  - 委托到 agent.endpoint                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ POST http://mate-tech-deep-research:8200/api/v1/a2a/agent/deep-research/invoke
                     │ BearerAuth(Bearer token from a2a service identity)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  mate-tech-deep-research(Mate Platform 内部包)               │
│  (NEW PACKAGE)                                              │
│  - HTTP server exposing A2A protocol                        │
│  - 内部: httpx → DeerFlow Engine                            │
│  - install_auth + require_tenant + outbox + BearerAuth      │
│  - 5 步合规                                                  │
└────────────────────┬────────────────────────────────────────┘
                     │ POST http://deerflow-engine:8001/api/research
                     │ Authorization: Bearer (DEERFLOW_API_KEY)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  DeerFlow Engine(外部 Python 服务,官方镜像)                │
│  - bytedance/deer-flow:latest                               │
│  - 3 Agent 协作: planner / researcher / writer              │
│  - Web search: Tavily / Bing / 自带                         │
│  - Document scraping + cite extraction                      │
│  - 输出: Markdown report + JSON sources                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 关键模块

| 模块 | 文件 | 职责 |
|---|---|---|
| `A2AAdapter` | `packages/mate-tech-deep-research/src/mate_tech_deep_research/adapter.py` | HTTP server exposing A2A protocol |
| `DeerFlowClient` | `packages/mate-tech-deep-research/src/mate_tech_deep_research/deerflow_client.py` | httpx client for DeerFlow Engine |
| `ResearchAgent` | `packages/mate-tech-deep-research/src/mate_tech_deep_research/agent.py` | 业务层封装 + 错误处理 + outbox event |
| `Router` | `packages/mate-tech-deep-research/src/mate_tech_deep_research/api/router.py` | A2A endpoint 路由 |
| `Registration` | `packages/mate-app-a2a/src/mate_app_a2a/bootstrap/agent_registration.py` | `deep-research` agent 自动注册 |
| `CopilotRouter` | `packages/mate-app-copilot/src/mate_app_copilot/api/router.py` | 智能判断任务复杂度 |

### 3.3 数据模型

#### 3.3.1 A2A Task(委托)

```yaml
A2ATask:
  id: string
  source_agent_id: "deep-research"  # 被委托能力所属 agent
  capability_id: "web-research"
  status: pending | running | completed | failed
  input:
    query: string
    depth: shallow | medium | deep
    max_sources: integer
    output_format: markdown | json
  output:
    report: string  # Markdown
    sources: list[Source]
    duration_ms: integer
  trace_id: string
  tenant_id: string
  user_id: string
  created_at: datetime
  completed_at: datetime
```

#### 3.3.2 Source

```yaml
Source:
  url: string
  title: string
  snippet: string
  reliability: high | medium | low
  fetched_at: datetime
```

#### 3.3.3 Agent Card

```yaml
AgentCard:
  id: "deep-research"
  name: "深度调研 Agent"
  description: "多 Agent 协作研究,支持网页搜索 / 文档分析 / 报告生成"
  endpoint: "http://mate-tech-deep-research:8200/api/v1/a2a/agent/deep-research/invoke"
  auth_type: bearer
  capabilities:
    - id: web-research
      description: Web 搜索 + 多源调研
      input_schema:
        query: string
        depth: shallow | medium | deep
        max_sources: integer
      output_schema:
        report: string (markdown)
        sources: array of Source
        duration_ms: integer
    - id: report-summarize
      description: 长文档摘要
      input_schema:
        document: string
        max_length: integer
      output_schema:
        summary: string
```

---

## 4. 必读规范

### 4.1 关联文档

- **`ADR-0014-tech-services-integration.md`** — 5 步接入模式
- **`2026-07-30-per-app-integration-checklist.md`** v1.0 — 5 步 checklist
- **`2026-07-31-prd-a2a-protocol.md`** v1.0 — A2A 协议完整规范
- **`production-readiness-design.md §13`** — 13 硬规则
- **`2026-08-02-llm-techstack-deviation.md`** — 裸 httpx 已成主流选择

### 4.2 5 步 checklist

按 `per-app-integration-checklist.md` v1.0 §8:

- [ ] **步骤 1**:`install_auth(app)` 在 `main.py` 第一行
- [ ] **步骤 2**:每个 handler 第一行 `require_tenant(ctx)`
- [ ] **步骤 3**:写 handler 用 `outbox.append(Event.create(...))` 同事务
- [ ] **步骤 4**:出向调用 DeerFlow Engine 用 `BearerAuth` + `OutgoingAuthMiddleware`
- [ ] **步骤 5**:`tests/test_tenant_integration.py` ≥ 3 cross-tenant negative
- [ ] **步骤 6**:OpenAPI `security:` 段已升级三段式

### 4.3 13 硬规则对齐

| # | 硬规则 | 适配 |
|---|---|---|
| 3 | tenant 上下文不访问 repository | ✅ `require_tenant(ctx)` |
| 4 | 外部系统 ACL Client | ✅ `BearerAuth` + `OutgoingAuthMiddleware` |
| 9 | 审计、指标、trace | ✅ outbox event `deep.research.completed` + OTel trace |
| 5 | Production profile 禁止 fallback | ✅ DeerFlow 引擎不可用时,**显式 503**(不回 InMemory stub) |
| 13 | NetworkPolicy | ✅ Helm chart 含 default-deny + allow(`dev-server:8200` → `deerflow-engine:8001`)|

---

## 5. 实施步骤

### 步骤 1:新建 `packages/mate-tech-deep-research/` 包

```bash
mkdir -p packages/mate-tech-deep-research/{src,tests}
mkdir -p packages/mate-tech-deep-research/src/mate_tech_deep_research/{api,deerflow,events}

# pyproject.toml
cat > packages/mate-tech-deep-research/pyproject.toml <<'EOF'
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
EOF
```

### 步骤 2:DeerFlow Client

```python
# packages/mate-tech-deep-research/src/mate_tech_deep_research/deerflow/client.py
from __future__ import annotations
import os
import httpx
import structlog
from ..api.schemas import ResearchRequest, ResearchResponse

logger = structlog.get_logger(__name__)


class DeerFlowClient:
    """httpx client for DeferFlow Engine (bytedance/deer-flow)."""

    DEFAULT_URL = "http://deerflow-engine:8001"
    DEFAULT_TIMEOUT = 300.0  # 5 minutes for deep research

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
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
        """Probe DeerFlow engine health."""
        try:
            r = await self._client.get("/healthz", timeout=5.0)
            self._available = r.status_code == 200
            return self._available
        except Exception as exc:
            logger.warning("DeerFlow unavailable: %s", exc)
            self._available = False
            return False

    async def research(self, request: ResearchRequest) -> ResearchResponse:
        """Submit research task to DeerFlow Engine."""
        if not self._available:
            await self.check()
            if not self._available:
                raise DeerFlowUnavailableError(
                    "DeerFlow Engine unavailable, refusing request"
                )

        try:
            resp = await self._client.post(
                "/api/research",
                json={
                    "query": request.query,
                    "depth": request.depth,
                    "max_sources": request.max_sources,
                    "output_format": request.output_format,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return ResearchResponse(
                report=data["report"],
                sources=[
                    Source(
                        url=s["url"],
                        title=s["title"],
                        snippet=s["snippet"],
                        reliability=s.get("reliability", "medium"),
                        fetched_at=datetime.fromisoformat(s["fetched_at"]),
                    )
                    for s in data["sources"]
                ],
                duration_ms=data["duration_ms"],
            )
        except httpx.HTTPError as exc:
            raise DeerFlowUnavailableError(f"DeerFlow request failed: {exc}")

    async def close(self) -> None:
        await self._client.aclose()


class DeerFlowUnavailableError(Exception):
    pass
```

### 步骤 3:A2A Adapter(API)

```python
# packages/mate-tech-deep-research/src/mate_tech_deep_research/api/router.py
from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from mate_platform.auth import require_tenant
from mate_platform.messaging import Event, OutboxWriter
from ..deerflow.client import DeerFlowClient, DeerFlowUnavailableError
from ..events import publish_research_completed
from ..schemas import ResearchRequest, ResearchResponse

router = APIRouter()


@router.post("/api/v1/a2a/agent/deep-research/invoke")
async def invoke_deep_research(request: Request, body: dict) -> dict:
    """A2A endpoint for deep research delegation.
    
    Body:
        capability_id: "web-research" | "report-summarize"
        input: { query, depth, max_sources, output_format }
    """
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
        
        # emit outbox event
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
    
    elif capability_id == "report-summarize":
        # ... similar for summarize
        raise HTTPException(status_code=501, detail="report-summarize not yet implemented")
    else:
        raise HTTPException(status_code=400, detail=f"unknown capability: {capability_id}")


_client: DeerFlowClient | None = None
def _get_client() -> DeerFlowClient:
    global _client
    if _client is None:
        _client = DeerFlowClient()
    return _client
```

### 步骤 4:main.py

```python
# packages/mate-tech-deep-research/src/mate_tech_deep_research/main.py
from __future__ import annotations
from fastapi import FastAPI
from mate_platform.auth import install_auth
from mate_clients.security import BearerAuth
from .api.router import router

app = FastAPI(title="mate-tech-deep-research")
install_auth(app)
app.include_router(router)


@app.get("/healthz")
async def healthz():
    """K8s liveness probe."""
    return {"status": "ok"}
```

### 步骤 5:在 `mate-app-a2a` 自动注册 DeerFlow agent

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
```

```python
# mate-app-a2a/src/mate_app_a2a/main.py
from fastapi import FastAPI
from mate_platform.auth import install_auth
from .bootstrap.agent_registration import register_deerflow_at_startup

app = FastAPI(title="mate-app-a2a")
install_auth(app)
register_deerflow_at_startup()  # Auto-register DeerFlow at startup
```

### 步骤 6:在 `mate-app-copilot` 智能路由

```python
# packages/mate-app-copilot/src/mate_app_copilot/api/router.py
import httpx
import re

DEEP_RESEARCH_KEYWORDS = re.compile(
    r"(调研|研究|分析|对比|综述|行业|market|industry|research|analysis)", re.IGNORECASE
)

def is_deep_research_query(query: str) -> bool:
    """Heuristic: long query + research keywords → deep research."""
    if len(query) < 30:
        return False
    return bool(DEEP_RESEARCH_KEYWORDS.search(query))


@router.post("/api/v1/copilot/chat")
async def chat(request: Request, body: dict):
    ctx = request.state.ctx
    require_tenant(ctx)
    
    query = body["query"]
    
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
            )
        return resp.json()
    else:
        # 简单任务: 走 llmgw
        # ... existing llmgw call
        pass
```

### 步骤 7:DeerFlow Engine 部署(`docker-compose.yml`)

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
    networks: [agent-net]
```

新增 PROFILES `research` profile:

```yaml
# 在 docker-compose.yml 末尾加 profiles
profiles:
  - research
# 实际服务中:deerflow-engine 的 profiles: ["research", "ai"]
```

### 步骤 8:ADR-0014 5 步合规测试

```python
# packages/mate-tech-deep-research/tests/test_tenant_integration.py
import pytest
from fastapi.testclient import TestClient
from mate_tech_deep_research.main import app

client = TestClient(app)


def test_no_tenant_header_returns_400():
    r = client.post("/api/v1/a2a/agent/deep-research/invoke", json={
        "capability_id": "web-research",
        "input": {"query": "test"},
    })
    assert r.status_code == 400
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_deerflow_unavailable_returns_503():
    r = client.post("/api/v1/a2a/agent/deep-research/invoke", json={
        "capability_id": "web-research",
        "input": {"query": "test research about AI"},
    }, headers={"X-Tenant-Id": "tenant-a"})
    # DeerFlow not running → 503
    assert r.status_code == 503
    assert r.json()["code"] == "E_DEERFLOW_UNAVAILABLE"


def test_cross_tenant_isolation():
    # ... cross-tenant negative test
    pass
```

### 步骤 9:OpenAPI 契约

`contracts/openapi/services/deep-research.yaml`(新建):

```yaml
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
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
```

---

## 6. 关键业务规则

### 6.1 任务复杂度判断

| 维度 | 判断逻辑 |
|---|---|
| 简单任务(走 llmgw) | 长度 < 30 字符 / 无研究关键词 |
| 深度调研(走 A2A → DeerFlow) | 长度 ≥ 30 + 含研究关键词(调研/分析/对比/行业 等) |
| 流式对话(走 llmgw) | 用户显式开启 SSE |

### 6.2 安全与权限

- **认证**:All `/api/v1/*` 走 Keycloak JWT(`install_auth`)
- **租户**:Every request 强制 `require_tenant(ctx)`,否则 400
- **速率限制**:DeerFlow Engine `10 调用/分钟/tenant`
- **预算**:DeerFlow `max cost $0.50/查询` + 配额桶(对接 `mate-tech-llmgw/quota`)

### 6.3 错误处理

| 错误 | 状态码 | 说明 |
|---|---|---|
| `E_TENANT_REQUIRED` | 400 | 缺 tenant 上下文 |
| `E_DEERFLOW_UNAVAILABLE` | 503 | DeerFlow Engine 不可达(显式 503,不回 InMemory)|
| `E_DEERFLOW_TIMEOUT` | 504 | 5 分钟超时 |
| `E_INVALID_CAPABILITY` | 400 | 未知 capability_id |
| `E_AUTH_FAILED` | 401 | DeerFlow 拒绝 BearerAuth |

### 6.4 性能指标

| 指标 | 目标 |
|---|---|
| 单次深度调研 P50 | < 30s(深度) |
| 单次深度调研 P95 | < 3min(深度) |
| 单次深度调研 P99 | < 5min(深度) |
| A2A adapter 启动延迟 | < 2s |
| 并发任务(单 tenant) | ≤ 5 |

### 6.5 审计与可观测

- **outbox event**:`deep.research.completed` 含 query / depth / report_size / sources_count / duration_ms
- **OpenTelemetry trace**:DeerFlow Engine 全链路接入
- **audit log**:每个 A2A delegate 写 audit_log(谁 / 何时 / 什么 query)
- **rate limit**:每 tenant 10 调用/分钟,超限 429

---

## 7. 验收

### 7.1 单元测试

```bash
cd mate-platform-backend/packages/mate-tech-deep-research
pytest tests/ -v
# 期望 ≥ 30 passed,0 failed
```

测试矩阵:
| 类别 | cases |
|---|---:|
| 5 步合规 | 5 |
| 跨租户 negative | 3 |
| A2A 协议 | 5 |
| DeerFlow client (httpx mock) | 8 |
| 错误处理 | 5 |
| outbox event | 2 |
| OpenAPI 契约 | 2 |
| **总计** | **30** |

### 7.2 端到端 Smoke

```python
# tests/e2e/test_deerflow_e2e.py
import httpx

def test_deerflow_e2e_smoke():
    """End-to-end smoke from copilot to DeerFlow."""
    # 1. 启动 copilot,发深度调研
    r = httpx.post(
        "http://localhost:8004/api/v1/copilot/chat",
        headers={"Authorization": "Bearer $JWT"},
        json={
            "query": "调研 LLM 在金融行业的应用场景,深度分析 5 个真实案例",
        },
    )
    assert r.status_code == 200
    data = r.json()
    
    # 2. 验证返回 (来自 A2A → DeerFlow)
    assert "report" in data
    assert "sources" in data
    assert len(data["sources"]) > 0
    assert data["duration_ms"] < 300_000  # 5 min
    
    # 3. 验证 report 是 Markdown
    assert data["report"].startswith("# ") or "##" in data["report"]
    
    # 4. 验证 sources 包含 URL
    for source in data["sources"]:
        assert "url" in source
        assert source["url"].startswith("http")
```

### 7.3 13 硬规则验收

| # | 硬规则 | 证据 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ `deep-research.yaml` + spec 已就绪 |
| 3 | tenant 上下文不访问 repository | ✅ `require_tenant(ctx)` |
| 4 | 外部系统 ACL Client | ✅ `BearerAuth` + `OutgoingAuthMiddleware` |
| 5 | Production profile 禁止 fallback | ✅ 显式 503,无 InMemory 兜底 |
| 9 | 审计、指标、trace | ✅ outbox event + OTel + audit log |
| 13 | NetworkPolicy | ✅ Helm 含 default-deny + allow |

### 7.4 验收证据

新建:`docs/active/delivery/evidence/P3-W2-DEERFLOW-DEEP-RESEARCH-ACCEPTANCE.md`

包含:
- 范围 / 改动清单
- 测试结果(30 unit + 5 e2e + 13 硬规则)
- end-to-end 截图(copilot chat → A2A delegate → DeerFlow → report)
- 关联 ADR / 规范 / commit

---

## 8. 工作量估算

| 子任务 | 工作量 | 累计 |
|---|---:|---:|
| 新建 `mate-tech-deep-research` 包 + 5 步合规 | 1 周 | 1 周 |
| DeerFlow Engine 部署 + docker-compose integration | 0.5 天 | 1.5 周 |
| `mate-app-a2a` 自动注册 DeerFlow agent | 1-2 天 | 1.5-2 周 |
| `mate-app-copilot` 智能路由 | 1 周 | 2.5-3 周 |
| 测试 + 验收证据 | 1 周 | 3.5-4 周 |
| **总计** | **3.5-4 周 / 5-7 PR** | |

---

## 9. 关联文档

- `2026-08-01-roadmap-v3.2.md` v1.0 阶段 2 — v3.2 W2 路线
- `2026-07-31-prd-a2a-protocol.md` v1.0 — A2A 协议完整规范
- `2026-07-30-per-app-integration-checklist.md` v1.0 — 5 步 checklist
- `ADR-0014-tech-services-integration.md` — 集成模式
- `PRD-APP-COPILOT_v2.3-20260727.md` — copilot 业务方需求
- `acceptance/REPORT.md` line 14-15 — 2026-07-26 DeerFlow 烟测历史(参考)

---

## 10. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-02 | v1.0 初版(deerflow-deep-research 集成规范 / 3 部分:adapter + copilot + docker-compose) | 需求层(TRAE) |