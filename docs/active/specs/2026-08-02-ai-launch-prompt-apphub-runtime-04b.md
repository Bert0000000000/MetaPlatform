# AI 助手启动 Prompt 模板（K3-2 子批次 · OTel 追踪接入）

> 版本：v1.0 · 2026-08-02
> 用途：K3 拆分第 2 份 — **K3-2 OTel 4 关键路径追踪**
> 前置：K3-1 SQL 持久化已合并（commit 引用 K3-1）
> 接力父：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 后端工程师，正在执行 K3 子批次 **K3-2 OTel 追踪接入**。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
接力：K3-1 SQL 持久化已合并
目标：4 关键路径加 OTel span，满足 §13 硬规则 9（没有审计/指标/trace）

## 必读文档

1. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md
   — K3 大剧本（仅 K3-2 阶段，约 100 行）
2. mate-platform-backend/packages/mate-app-hub/pyproject.toml
   — 检查是否已装 opentelemetry-api / opentelemetry-sdk
3. 现存代码 4 个关键路径：
   - src/mate_app_hub/runtime/loader.py
   - src/mate_app_hub/runtime/executor.py
   - src/mate_app_hub/shortlink/resolver.py
   - src/mate_app_hub/shortlink/service.py

## 你的任务（3 项）

### 1. telemetry.py get_tracer 工厂

新增 `src/mate_app_hub/telemetry.py`：

```python
from opentelemetry import trace

_tracer = None

def get_tracer() -> trace.Tracer:
    global _tracer
    if _tracer is None:
        _tracer = trace.get_tracer("mate-app-hub", "1.0.0")
    return _tracer
```

**前提**：pyproject.toml 必须有 `opentelemetry-api >= 1.20` 依赖。若无，加：

```toml
[project.dependencies]
opentelemetry-api = ">=1.20.0"
opentelemetry-sdk = {version = ">=1.20.0", optional = true}
opentelemetry-sdk-testing = {version = ">=1.20.0", optional = true}

[project.optional-dependencies]
test = ["opentelemetry-sdk", "opentelemetry-sdk-testing"]
```

注意：仅 dev 测试时需要 SDK + SDK-Testing，运行时仅需 API。

### 2. 4 关键路径加 span

每个文件都加：

```python
from .telemetry import get_tracer
```

然后包住主函数：

**runtime/loader.py:load_app_runtime**：
```python
def load_app_runtime(tenant_id, app_id, version="latest"):
    with get_tracer().start_as_current_span("apphub.runtime.load") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.app_id", app_id)
        span.set_attribute("apphub.version", version)
        # 现有逻辑
```

**runtime/executor.py:execute_action**：
```python
async def execute_action(ctx, action, payload):
    with get_tracer().start_as_current_span("apphub.runtime.execute") as span:
        span.set_attribute("apphub.action_type", action.action_type)
        span.set_attribute("apphub.tenant_id", ctx.tenant_id)
        span.set_attribute("apphub.app_id", ctx.app_id)
        # 现有逻辑
```

**shortlink/resolver.py:resolve**：
```python
def resolve(store, tenant_id, code):
    with get_tracer().start_as_current_span("apphub.shortlink.resolve") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.shortlink_code", code)
        # 现有逻辑
```

**shortlink/service.py:create_shortlink**：
```python
def create_shortlink(*args, **kwargs):
    with get_tracer().start_as_current_span("apphub.shortlink.create") as span:
        span.set_attribute("apphub.tenant_id", tenant_id)
        span.set_attribute("apphub.app_id", app_id)
        # 现有逻辑
```

### 3. OTel 单测

新增 `tests/test_apphub_otel_01.py`：

```python
import pytest
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
    from mate_app_hub.runtime.loader import load_app_runtime
    load_app_runtime("tenant-a", "app-1")
    spans = span_exporter.get_finished_spans()
    assert any(s.name == "apphub.runtime.load" for s in spans)

def test_execute_action_emits_span(span_exporter):
    import asyncio
    from mate_app_hub.runtime.executor import execute_action
    from mate_app_hub.runtime.schema import RuntimeContext, RuntimeAction
    ctx = RuntimeContext(app_id="app-1", tenant_id="tenant-a", version="latest", modules=[])
    action = RuntimeAction(action_type="submit_form", target="form-1")
    asyncio.run(execute_action(ctx, action, {}))
    assert any(s.name == "apphub.runtime.execute" for s in span_exporter.get_finished_spans())

def test_resolve_shortlink_emits_span(span_exporter):
    from mate_app_hub.shortlink.resolver import resolve
    from mate_app_hub.shortlink.repository import InMemoryShortlinkStore
    store = InMemoryShortlinkStore()
    store.put("tenant-a", "app-1", "ABC123")
    resolve(store, "tenant-a", "ABC123")
    assert any(s.name == "apphub.shortlink.resolve" for s in span_exporter.get_finished_spans())

def test_create_shortlink_emits_span(span_exporter):
    from mate_app_hub.shortlink.service import create_shortlink
    from mate_app_hub.shortlink.repository import InMemoryShortlinkStore
    store = InMemoryShortlinkStore()
    create_shortlink(store, "tenant-a", "app-1")
    assert any(s.name == "apphub.shortlink.create" for s in span_exporter.get_finished_spans())
```

要求 ≥ 4 个测试用例，0 skip。

## 13 条硬规则（本子批次触发的）

- **§13 第 9 条**：没有审计、指标、trace → 4 个关键路径必须含 span

## 启动方式

1. 切到 K3-2 接力 worktree：`git worktree add .worktrees/apphub-runtime-04b -b codex/apphub-runtime-04b main`
2. 跑基线：`cd mate-platform-backend/packages/mate-app-hub && pytest -q -m "not integration"`
3. 按 3 项顺序推进
4. 全部完成 commit 一次：`feat(apphub): K3-2 OTel 4 关键路径 span + telemetry.py + 4 tests`
5. commit 前必跑：
   - `pytest -q` 0 failed
   - `ruff check packages/mate-app-hub/`
   - `python scripts/ci/forbid_skip_tests.py packages/mate-app-hub/`

## 已知陷阱

1. **opentelemetry-sdk 仅 dev 依赖**——不要让 sdk 跑进生产镜像
   `pyproject.toml` 用 `[project.optional-dependencies]` 隔离
2. **InMemorySpanExporter 是测试专有**——`from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter`
   仅 `opentelemetry-sdk-testing` 提供
3. **Async 测试**——executor 是 async，需 `pytest-asyncio` 或 `asyncio.run()`
   看仓内既有 asyncio 模式
4. **tracer 名字**——固定 `mate-app-hub` 字符串，与 K3 prompt 一致

## 验收清单

- [ ] pyproject.toml 含 opentelemetry-api + 隔离的 sdk/testing
- [ ] src/mate_app_hub/telemetry.py 含 get_tracer()
- [ ] 4 关键路径（loader / executor / resolver / create_shortlink）各含 start_as_current_span
- [ ] tests/test_apphub_otel_01.py ≥ 4 tests pass
- [ ] 1 个 Conventional Commit
```

## 关联文档

- K3 大剧本：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`
- K3-1 SQL 持久化：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04a.md`
- 待续：K3-3 租户双轨 / K3-4 executor 真实化

## 元说明

- **本子批次解决**：K3-2 OTel 接入（第 9 条硬规则从 �� 转