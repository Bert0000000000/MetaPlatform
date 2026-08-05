# AI 助手启动 Prompt 模板（批次 K3 · APPHUB-RUNTIME-01 后端硬化 4 件）

> 版本：v1.0 · 2026-08-02
> 用途：**接力 K2.1**——把 K2.1 留下的 4 件后端硬化彻底闭环
> 出处：K2.1 evidence 闭环后，K3 推进硬规则 3 / 4 / 9 真正达标
> 状态：**本批次待启动**——K3 是 APPHUB-RUNTIME-01 批次的最后一个接力
> 前置：K1 4 + K2 5 + `8e69f1eb` + K2.1 3 共 13 commit 已合并到 main

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 全栈工程师，正在为本仓库执行
"批次 K3 · APPHUB-RUNTIME-01 后端硬化 4 件"。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
当前分支：main（K1 4 + K2 5 + 8e69f1eb + K2.1 3 共 13 commit 已合并）
接力对象：K2 / K2.1 留 4 件后端硬化（SQL 持久化 / OTel / 租户双轨 / executor 真实化）
目标：把 §13 硬规则 3 / 4 / 9 真正闭环，让 APPHUB-RUNTIME-01 满足生产可用性。

## 上下文速览（先读这一段）

APPHUB-RUNTIME-01 至今 13 commit，已覆盖：
- K1 4 commit：契约 + runtime + shortlink + 前端骨架
- K2 5 commit：契约字段 + openapi 聚合 + ACCEPTANCE + 阶段 D 收尾
- 8e69f1eb：PROGRAM-BOARD 治理收口
- K2.1 3 commit：6 处硬证据补齐（强类型 schema / required-tenant / 409/422 / 模板页面 / QR Code / tsc 日志）

但**仅前端 + 契约层面 production-ready**，后端 4 件仍未达标：
- K3-1  SQL 持久化：短链仅 in-memory，重启即丢
- K3-2  OTel 接入：4 个关键路径 0 span
- K3-3  租户双轨：`_runtime_tenant_id` 保留 X-Tenant-Id 头回退（prod 风险）
- K3-4  executor 真实化：4 个 action 仍 mock（提交表单 / 触发流程 / 调用 API / 导航）

这 4 件对应 §13 硬规则 3（tenant 守门）/ 4（ACL Client）/ 9（trace）。
K3 是 APPHUB-RUNTIME-01 批次的最后一关。

## 必须读完的文档（按顺序）

1. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md
   — K1 prompt（建立契约基线）
2. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-02.md
   — K2 prompt（治理收口清单）
3. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-03.md
   — K2.1 prompt（6 处硬证据补齐）
4. docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md
   — 当前 ACCEPTANCE 文档（K2.1 已闭环）
5. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — §13 硬规则 1-13（K3 触发 3 / 4 / 9）
6. docs/active/decisions/ADR-0014-tech-services.md
   — 17 域 5 步接入法（contract → failing tests → feature → infrastructure → acceptance）
7. mate-platform-backend/packages/mate-app-hub/
   — 当前 5 ORM + 16 endpoint + runtime/ + shortlink/ 状态
8. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md
   — 本文档本身

## 你的任务（按 §13 硬规则 3 / 4 / 9 顺序 4 件）

### 阶段 K3-1 — SQL 持久化（硬规则 3）

短链当前仅 `InMemoryShortlinkStore`（进程内 dict），重启进程 / 节点宕机即丢。
SQL 持久化是生产可用底线。

#### K3-1-1 ApphubShortlinkORM SQLAlchemy 模型

在 `packages/mate-app-hub/src/mate_app_hub/repositories/sql_models.py`
新增 ORM：

```python
from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID

class ApphubShortlinkORM(Base):
    __tablename__ = "apphub_shortlinks"

    id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    app_id = Column(String(128), nullable=False)
    code = Column(String(16), nullable=False)
    role = Column(String(64), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("ix_apphub_shortlinks_tenant_code", "tenant_id", "code", unique=True),
        Index("ix_apphub_shortlinks_tenant_app", "tenant_id", "app_id"),
    )
```

#### K3-1-2 Alembic migration

在 `packages/mate-app-hub/migrations/versions/` 新增（仓内目前无 migrations 目录，需先创建）：

```bash
mkdir -p packages/mate-app-hub/migrations/versions
```

创建 `0014_apphub_shortlinks.py`（接 K1 阶段 A 的 Alembic 0013）：

```python
"""add apphub_shortlinks table

Revision ID: 0014_apphub_shortlinks
Revises: 0013_apphub_apps_columns
Create Date: 2026-08-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

def upgrade():
    op.create_table(
        "apphub_shortlinks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", String(64), nullable=False),
        sa.Column("app_id", String(128), nullable=False),
        sa.Column("code", String(16), nullable=False),
        sa.Column("role", String(64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_apphub_shortlinks_tenant_code", "apphub_shortlinks", ["tenant_id", "code"], unique=True)
    op.create_index("ix_apphub_shortlinks_tenant_app", "apphub_shortlinks", ["tenant_id", "app_id"])

def downgrade():
    op.drop_index("ix_apphub_shortlinks_tenant_app", "apphub_shortlinks")
    op.drop_index("ix_apphub_shortlinks_tenant_code", "apphub_shortlinks")
    op.drop_table("apphub_shortlinks")
```

#### K3-1-3 ShortlinkStoreSQL 实现

在 `packages/mate-app-hub/src/mate_app_hub/shortlink/repository.py` 新增
（与 `InMemoryShortlinkStore` 同接口）：

```python
class ShortlinkStoreSQL:
    def __init__(self, session: Session):
        self._session = session

    def put(self, entry: ShortlinkEntry) -> None:
        orm = ApphubShortlinkORM(...)
        self._session.add(orm)
        self._session.commit()

    def get_by_code(self, tenant_id: str, code: str) -> ShortlinkEntry | None:
        orm = self._session.query(ApphubShortlinkORM).filter_by(
            tenant_id=tenant_id, code=code
        ).first()
        return self._to_entry(orm) if orm else None

    def list(self, tenant_id: str) -> list[ShortlinkEntry]:
        return [self._to_entry(o) for o in
                self._session.query(ApphubShortlinkORM).filter_by(tenant_id=tenant_id).all()]

    def delete(self, tenant_id: str, code: str) -> None:
        self._session.query(ApphubShortlinkORM).filter_by(
            tenant_id=tenant_id, code=code
        ).delete()
        self._session.commit()

    def exists(self, tenant_id: str, code: str) -> bool:
        return self._session.query(ApphubShortlinkORM).filter_by(
            tenant_id=tenant_id, code=code
        ).first() is not None

    def reset(self) -> None:
        self._session.query(ApphubShortlinkORM).delete()
        self._session.commit()

    @staticmethod
    def _to_entry(orm: ApphubShortlinkORM) -> ShortlinkEntry:
        return ShortlinkEntry(
            id=str(orm.id),
            tenant_id=orm.tenant_id,
            app_id=orm.app_id,
            code=orm.code,
            role=orm.role,
            expires_at=orm.expires_at.isoformat() if orm.expires_at else None,
            created_at=orm.created_at.isoformat(),
        )
```

#### K3-1-4 sql_store.py 适配器 + factory

在 `repositories/sql_store.py` 新增 `ShortlinkStoreSQL` factory：

```python
def get_sql_shortlink_store() -> ShortlinkStoreSQL:
    from sqlalchemy.orm import Session
    engine = get_engine()  # 仓内现有 engine factory
    return ShortlinkStoreSQL(Session(bind=engine))
```

#### K3-1-5 create_shortlink 透传 expires_at

修改 `shortlink/service.py` `create_shortlink` 函数签名：

```python
def create_shortlink(
    store: InMemoryShortlinkStore | ShortlinkStoreSQL,
    tenant_id: str,
    app_id: str,
    role: str | None = None,
    expires_at: datetime | None = None,  # 新增
) -> ShortlinkEntry:
    ...
```

并在 `api/app.py` 的 POST /shortlinks endpoint 增加 requestBody 字段：

```python
class CreateShortlinkRequest(BaseModel):
    app_id: str
    role: str | None = None
    expires_at: datetime | None = None  # 新增
```

#### K3-1-6 SQL 集成测试

新增 `tests/test_apphub_shortlink_sql_01.py`：

```python
@pytest.fixture
def sql_store():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return ShortlinkStoreSQL(sessionmaker(bind=engine)())

def test_create_and_resolve(sql_store):
    entry = create_shortlink(sql_store, "tenant-a", "app-1", role="editor")
    assert sql_store.get_by_code("tenant-a", entry.code) is not None

def test_tenant_isolation(sql_store):
    create_shortlink(sql_store, "tenant-a", "app-1")
    with pytest.raises(ShortlinkNotFound):
        resolve_shortlink(sql_store, "tenant-b", entry.code)

def test_expires_at_filter(sql_store):
    past = datetime.now() - timedelta(hours=1)
    entry = create_shortlink(sql_store, "tenant-a", "app-1", expires_at=past)
    with pytest.raises(ShortlinkExpired):
        resolve_shortlink(sql_store, "tenant-a", entry.code)
```

要求 ≥ 12 个测试用例，0 skip。

### 阶段 K3-2 — OTel 接入（硬规则 9）

4 个关键路径当前 0 span，违反硬规则 9（"没有审计/指标/trace"）。

#### K3-2-1 tracer 初始化

在 `packages/mate-app-hub/src/mate_app_hub/` 新增 `telemetry.py`：

```python
from opentelemetry import trace

_tracer = None

def get_tracer() -> trace.Tracer:
    global _tracer
    if _tracer is None:
        _tracer = trace.get_tracer("mate-app-hub", "1.0.0")
    return _tracer
```

#### K3-2-2 4 个关键路径加 span

**`runtime/loader.py`**：
```python
from .telemetry import get_tracer

def load_app_runtime(tenant_id, app_id, version="latest"):
    with get_tracer().start_as_current_span("apphub.runtime.load") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.app_id", app_id)
        span.set_attribute("apphub.version", version)
        # 现有逻辑
```

**`runtime/executor.py`**：
```python
async def execute_action(ctx, action, payload):
    with get_tracer().start_as_current_span("apphub.runtime.execute") as span:
        span.set_attribute("apphub.action_type", action.type)
        span.set_attribute("apphub.tenant_id", ctx.tenant_id)
        span.set_attribute("apphub.app_id", ctx.app_id)
        # handler 分支
```

**`shortlink/resolver.py`**：
```python
def resolve(store, tenant_id, code):
    with get_tracer().start_as_current_span("apphub.shortlink.resolve") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.shortlink_code", code)
        # 解析逻辑
```

**`shortlink/service.py` `create_shortlink`**：
```python
def create_shortlink(*args, **kwargs):
    with get_tracer().start_as_current_span("apphub.shortlink.create") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.app_id", app_id)
        # 创建逻辑
```

#### K3-2-3 OTel 单测

新增 `tests/test_apphub_otel_01.py`：

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

@pytest.fixture
def span_exporter():
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    yield exporter
    provider.shutdown()

def test_load_app_runtime_emits_span(span_exporter):
    load_app_runtime("tenant-a", "app-1")
    spans = span_exporter.get_finished_spans()
    assert any(s.name == "apphub.runtime.load" for s in spans)
```

要求 ≥ 4 个测试用例（每个关键路径 1 个）。

### 阶段 K3-3 — 租户双轨清理（硬规则 3 + 5）

#### K3-3-1 删除 `_runtime_tenant_id`

修改 `packages/mate-app-hub/src/mate_app_hub/api/app.py`：

```python
# 删除整个 _runtime_tenant_id 函数（L128-147）
# 6 个 runtime / shortlink / publish 端点改用 _tenant_id(request)
```

#### K3-3-2 6 个 endpoint 切换

| 端点 | 行号（约） | 改前 | 改后 |
|---|---|---|---|
| `GET /apps/{app_id}/runtime` | 514 | `_runtime_tenant_id` | `_tenant_id(request)` |
| `POST /apps/{app_id}/runtime/execute` | 531 | `_runtime_tenant_id` | `_tenant_id(request)` |
| `POST /apps/{app_id}/publish` | 554 | `_runtime_tenant_id` | `_tenant_id(request)` |
| `GET /shortlinks/{code}` | 578 | `_runtime_tenant_id` | `_tenant_id(request)` |
| `POST /shortlinks` | 589 | `_runtime_tenant_id` | `_tenant_id(request)` |
| `GET /shortlinks` | 608 | `_runtime_tenant_id` | `_tenant_id(request)` |

#### K3-3-3 negative 测试

在 `tests/test_apphub_runtime_01.py` 增加 5 个 negative case：

```python
def test_get_runtime_without_ctx_returns_400(client):
    """无 ctx → 401/403（不是 200）"""
    response = client.get("/api/v1/apphub/apps/app-1/runtime")
    assert response.status_code in (401, 403)

def test_post_publish_without_ctx_returns_400(client):
    response = client.post("/api/v1/apphub/apps/app-1/publish")
    assert response.status_code in (401, 403)

# 类似 3 个
```

并删除 `api/app.py` 中所有依赖 `X-Tenant-Id` 头回退的代码。

### 阶段 K3-4 — executor 真实化（硬规则 4）

4 个 action 当前全 mock（K1 B 阶段 53c5c71b 注释自承）。
真实化让 executor 真正可执行生产流程。

#### K3-4-1 接入 mate_clients

在 `packages/mate-app-hub/pyproject.toml` 加依赖：

```toml
dependencies = [
    ...
    "mate-clients @ file://../../mate-clients",
]
```

#### K3-4-2 4 个 action 真实化

**`runtime/executor.py`**：

```python
from mate_clients.wfe import FlowableClient
from mate_clients.api_gateway import APIGatewayClient
from mate_clients.forms import FormsClient

class RealExecutor:
    def __init__(self, wfe: FlowableClient, gateway: APIGatewayClient, forms: FormsClient):
        self._wfe = wfe
        self._gateway = gateway
        self._forms = forms

    async def submit_form(self, ctx, action, payload):
        with get_tracer().start_as_current_span("apphub.runtime.submit_form") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            return await self._forms.submit(
                app_id=ctx.app_id,
                form_id=action.target,
                payload=payload,
                tenant_id=ctx.tenant_id,
            )

    async def trigger_flow(self, ctx, action, payload):
        with get_tracer().start_as_current_span("apphub.runtime.trigger_flow") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            return await self._wfe.start_process(
                process_key=action.target,
                business_key=ctx.app_id,
                variables=payload,
                tenant_id=ctx.tenant_id,
            )

    async def call_api(self, ctx, action, payload):
        with get_tracer().start_as_current_span("apphub.runtime.call_api") as span:
            span.set_attribute("apphub.api_id", action.target)
            return await self._gateway.invoke(
                api_id=action.target,
                payload=payload,
                tenant_id=ctx.tenant_id,
            )

    async def navigate(self, ctx, action, payload):
        return ActionResult(success=True, data={"navigate": action.target})
```

#### K3-4-3 移除 mock

删除 `runtime/executor.py` 中的 `MOCK = True` 兼容分支，硬切到 RealExecutor。

#### K3-4-4 移除裸 httpx 依赖

若 `pyproject.toml` 中 `httpx>=0.28.0` 仅被 runtime/executor 间接使用，
真实化后不再需要，从 dev-dependencies 移除：

```toml
# 删除
httpx>=0.28.0
```

#### K3-4-5 集成测试

新增 `tests/test_apphub_executor_integration_01.py`：

```python
@pytest.fixture
def real_executor():
    return RealExecutor(
        wfe=FlowableClient(base_url="http://localhost:8081"),  # 假设本地 Flowable
        gateway=APIGatewayClient(base_url="http://localhost:8080"),
        forms=FormsClient(base_url="http://localhost:8080"),
    )

@pytest.mark.asyncio
async def test_trigger_flow_creates_process_instance(real_executor):
    ctx = RuntimeContext(app_id="app-1", tenant_id="tenant-a", version="latest", modules=[])
    action = RuntimeAction(type="trigger_flow", target="process.approval")
    result = await real_executor.trigger_flow(ctx, action, {"amount": 1000})
    assert result.success is True
    assert "processInstanceId" in result.data
```

要求 ≥ 4 个集成测试（每个 action 1 个，跑通真实客户端连接）。

## 13 条硬规则（本批次触发的）

- **§13 第 3 条**：K3-1（SQL 持久化）+ K3-3（租户双轨清理）
- **§13 第 4 条**：K3-4（executor 走 `mate_clients` 而非裸 httpx；同步移除 httpx 依赖）
- **§13 第 5 条**：K3-3（同一守门规则，移除 X-Tenant-Id 头回退）
- **§13 第 9 条**：K3-2（4 个关键路径 OTel span）
- **§13 第 10 条**：阶段 D-1 ACCEPTANCE.md 同步更新

## 启动方式

1. 切到 K2.1 接力 worktree：
   `git fetch && git worktree add .worktrees/apphub-runtime-04 -b codex/apphub-runtime-04 main`
2. 先跑 K2.1 evidence 闭环基线：
   `cd mate-platform-backend/packages/mate-app-hub && pytest -q -m "not integration"`
3. 按 K3-1 → K3-2 → K3-3 → K3-4 顺序推进
4. 每完成一个 K3-N 阶段 commit 一次，4 commit 总计
5. 每 commit 前必跑：
   - `pytest packages/mate-app-hub/tests/ -q` 0 failed
   - `ruff check packages/mate-app-hub/`
   - `pyright packages/mate-app-hub/`
   - `python scripts/ci/forbid_skip_tests.py packages/mate-app-hub/`
   - `python scripts/ci/forbid_bare_httpx.py packages/mate-app-hub/`
   - `python scripts/ci/require_evidence.py`（拼写已修）
6. 全部 4 commit 完成后，PR 描述必须包含：
   - K1 4 + K2 5 + 8e69f1eb + K2.1 3 + K3 4 共 17 commit 清单
   - 4 项 K3 修复 0/1 矩阵
   - SQL 集成测试 ≥ 12 命中
   - OTel 单测 ≥ 4 命中
   - 5 个 negative tenant 测试覆盖
   - executor 集成测试 ≥ 4 命中
   - httpx 移除前后 pyproject.toml diff

## 已知陷阱

1. **alembic 目录不存在**：K1 阶段 A 声明 Alembic 0013 但仓内无 migrations/ 目录
   K3-1-2 必须先 `mkdir -p packages/mate-app-hub/migrations/versions`
2. **`_tenant_id(request)` 抛 401 而非 400**：早期版本 400 但 ADR-0011 升级后是 401
   K3-3-3 negative 测试预期 401/403，不是 400
3. **OTel 测试需要 SDK**：仓内是否已装 `opentelemetry-sdk` 需先 `Read pyproject.toml`
   若无，加 `opentelemetry-sdk` + `opentelemetry-api` 到 dev-dependencies
4. **mate_clients 是 monorepo path 依赖**：必须确认 `packages/mate-clients` 已存在可用
   若无，K3-4 需先建 stub：from mate_clients import FlowableClient 优先
5. **executor 集成测试需外部服务**：Flowable / API Gateway / Forms 都需本地或 mock
   若无本地实例，用 `monkeypatch` 替 client 内的 transport，保留真实 ActionResult 行为
6. **ACCEPTANCE.md 13 门禁矩阵更新**：K2.1 已写 8 ✅ / 2 �� / 3 N/A
   K3 完成后，�� 项（4 / 9）应转为 ✅，ACCEPTANCE.md 改写

## 验收清单（Acceptance Evidence）

提交 PR 前必须产出：

- [ ] K3-1：ApphubShortlinkORM SQL 模型已注册（`repositories/sql_models.py`）
- [ ] K3-1：alembic migration `0014_apphub_shortlinks.py` 已创建（`up` + `down`）
- [ ] K3-1：ShortlinkStoreSQL 与 InMemoryShortlinkStore 同接口实现
- [ ] K3-1：sql_store.py factory + `create_shortlink(..., expires_at=)` 透传
- [ ] K3-1：test_apphub_shortlink_sql_01.py ≥ 12 tests pass
- [ ] K3-2：telemetry.py 含 `get_tracer()` 工厂
- [ ] K3-2：4 个关键路径（load / execute / resolve / create_shortlink）均含 start_as_current_span
- [ ] K3-2：test_apphub_otel_01.py ≥ 4 tests pass
- [ ] K3-3：`_runtime_tenant_id` 已删除（grep 0 命中）
- [ ] K3-3：6 个 runtime / shortlink / publish 端点改用 `_tenant_id(request)`
- [ ] K3-3：5 个 negative tenant 测试 add（无 ctx → 401/403）
- [ ] K3-4：RealExecutor 4 个 action 接 mate_clients.wfe / api_gateway / forms
- [ ] K3-4：mock 实现 0 残留（grep "MOCK" 0 命中）
- [ ] K3-4：pyproject.toml httpx 依赖移除（若不再使用）
- [ ] K3-4：test_apphub_executor_integration_01.py ≥ 4 tests pass
- [ ] ACCEPTANCE.md 13 门禁矩阵更新：原 2 ��（硬规则 4 / 9）转为 ✅
- [ ] 4 个 Conventional Commit 风格 commit
```

## 关联文档

- 批次 K1 prompt：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime.md`
- 批次 K2 prompt：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-02.md`
- 批次 K2.1 prompt：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-03.md`
- K2.1 ACCEPTANCE：`docs/active/delivery/evidence/APPHUB-RUNTIME-01-ACCEPTANCE.md`
- 13 硬规则：§13 production-readiness
- ADR-0014 tech-services

## 元说明

- **本批次解决**：K3-1 / K3-2 / K3-3 / K3-4 共 4 件后端硬化
- **本批次是 APPHUB-RUNTIME-01 收官批次**：完成后 K1 + K2 + K2.1 + K3 共 17 commit 闭环
- **估时**：K3-1 SQL 4h / K3-2 OTel 2h / K3-3 租户 1h / K3