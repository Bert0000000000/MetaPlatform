# AI 助手启动 Prompt 模板（K3-4 子批次 · executor 真实化）

> 版本：v1.0 · 2026-08-02
> 用途：K3 拆分第 4 份 — **K3-4 executor 真实化（mock → mate_clients）**
> 前置：K3-1 SQL + K3-2 OTel + K3-3 租户 全部已合并
> 接力父：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`

---

## �� 启动 Prompt（可直接复制使用）

```text
你是一名 Mate Platform 后端工程师，正在执行 K3 子批次 **K3-4 executor 真实化**。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
接力：K3-1 SQL + K3-2 OTel + K3-3 租户 全部已合并
目标：把 executor 4 个 action 从 mock 改为真接入 mate_clients，满足 §13 硬规则 4

## 背景

K1-B 阶段（53c5c71b）executor.py 自承：
> All action handlers are mock implementations; the real integrations (wfe for trigger_flow,
> API gateway for call_api) land in subsequent phases.

K3-4 任务：把 4 个 action（submit_form / trigger_flow / call_api / navigate）从 mock 改为真接入：
- `submit_form` → `mate_clients.forms.FormsClient.submit(...)`
- `trigger_flow` → `mate_clients.wfe.FlowableClient.start_process(...)`
- `call_api` → `mate_clients.api_gateway.APIGatewayClient.invoke(...)`
- `navigate` → 仅更新 ActionResult，保留轻客户端

并移除 pyproject.toml 中的裸 httpx 依赖（仅被 mock 间接使用）。

## 必读文档

1. docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md
   — K3 大剧本（仅 K3-4 阶段，约 100 行）
2. 现存 src/mate_app_hub/runtime/executor.py（约 52 行，目前 4 个 if action.action_type == ... 分支）
3. 现存 src/mate_app_hub/clients.py（AsyncApphubClient P2-W3 stub）
4. 现存 packages/mate-clients/（若存在）：
   - mate_clients/wfe/FlowableClient
   - mate_clients/api_gateway/APIGatewayClient
   - mate_clients/forms/FormsClient
5. 现存 pyproject.toml L23（含 httpx>=0.28.0 dev-deps）

## 你的任务（5 项）

### 1. mate_clients 依赖

在 `pyproject.toml` 加依赖：

```toml
[project.dependencies]
mate-clients = {path = "../../mate-clients", develop = true}
```

**前提**：仓内 `packages/mate-clients/` 必须存在且实现 3 个 client。
若不存在，先用 `Glob packages/mate-clients/` 确认，
若仍未实现，先建 stub：

```python
# packages/mate-clients/src/mate_clients/wfe/__init__.py
class FlowableClient:
    def __init__(self, base_url: str = "http://localhost:8081"):
        self.base_url = base_url
    async def start_process(self, process_key, business_key, variables, tenant_id) -> dict:
        # stub：返回模拟 processInstanceId
        return {"processInstanceId": f"proc-{business_key}-{hash((process_key, tenant_id)) % 10000}"}

# 同理 api_gateway / forms
```

### 2. RealExecutor 类

在 `runtime/executor.py` 追加 `RealExecutor` 类（保留原 mock 分支作为 `MockExecutor`）：

```python
from dataclasses import dataclass
import asyncio

from mate_clients.wfe import FlowableClient
from mate_clients.api_gateway import APIGatewayClient
from mate_clients.forms import FormsClient
from .telemetry import get_tracer


class RealExecutor:
    """真实执行的 executor，4 个 action 接 mate_clients。"""

    def __init__(
        self,
        wfe: FlowableClient,
        gateway: APIGatewayClient,
        forms: FormsClient,
    ):
        self._wfe = wfe
        self._gateway = gateway
        self._forms = forms

    async def submit_form(self, ctx, action, payload):
        """submit_form action → FormsClient.submit"""
        with get_tracer().start_as_current_span("apphub.runtime.submit_form") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.form_id", action.target)
            span.set_attribute("apphub.tenant_id", ctx.tenant_id)
            result = await self._forms.submit(
                app_id=ctx.app_id,
                form_id=action.target,
                payload=payload,
                tenant_id=ctx.tenant_id,
            )
            return ActionResult(success=True, data=result)

    async def trigger_flow(self, ctx, action, payload):
        """trigger_flow action → FlowableClient.start_process"""
        with get_tracer().start_as_current_span("apphub.runtime.trigger_flow") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.process_key", action.target)
            span.set_attribute("apphub.tenant_id", ctx.tenant_id)
            result = await self._wfe.start_process(
                process_key=action.target,
                business_key=ctx.app_id,
                variables=payload,
                tenant_id=ctx.tenant_id,
            )
            return ActionResult(success=True, data=result)

    async def call_api(self, ctx, action, payload):
        """call_api action → APIGatewayClient.invoke"""
        with get_tracer().start_as_current_span("apphub.runtime.call_api") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.api_id", action.target)
            span.set_attribute("apphub.tenant_id", ctx.tenant_id)
            result = await self._gateway.invoke(
                api_id=action.target,
                payload=payload,
                tenant_id=ctx.tenant_id,
            )
            return ActionResult(success=True, data=result)

    async def navigate(self, ctx, action, payload):
        """navigate action → 仅返回跳转目标"""
        with get_tracer().start_as_current_span("apphub.runtime.navigate") as span:
            span.set_attribute("apphub.app_id", ctx.app_id)
            span.set_attribute("apphub.target", action.target)
            return ActionResult(success=True, data={"navigate": action.target})
```

### 3. 切换 executor 工厂

修改 `runtime/executor.py` 顶部，使其根据配置选择 RealExecutor / MockExecutor：

```python
import os

def get_executor() -> "RealExecutor | MockExecutor":
    if os.getenv("APPHUB_EXECUTOR_MODE", "real") == "real":
        return RealExecutor(
            wfe=FlowableClient(base_url=os.getenv("WFE_BASE_URL", "http://localhost:8081")),
            gateway=APIGatewayClient(base_url=os.getenv("API_GATEWAY_BASE_URL", "http://localhost:8080")),
            forms=FormsClient(base_url=os.getenv("FORMS_BASE_URL", "http://localhost:8080")),
        )
    return MockExecutor()
```

并在 `api/app.py` 的 `execute_action` endpoint 内调用 `get_executor().<action_type>(...)` 替代原 mock 调用。

### 4. 移除 httpx 依赖

在 `pyproject.toml` L23 删除：

```toml
"httpx>=0.28.0",
```

**前提**：先 grep 仓内实际 httpx 用法（除 mock 间接使用外无其他）：

```bash
grep -rn "httpx" packages/mate-app-hub/
# 期望输出：仅在 mock client 内的 httpx.AsyncClient / httpx.Client 引用
```

若有其他真用 httpx 的代码，保留依赖但用 `from . import httpx` 形式断言 mock 路径。

### 5. 集成测试

新增 `tests/test_apphub_executor_integration_01.py`：

```python
import pytest
import asyncio

from mate_app_hub.runtime.executor import RealExecutor, MockExecutor
from mate_app_hub.runtime.schema import RuntimeContext, RuntimeAction
from mate_clients.wfe import FlowableClient
from mate_clients.api_gateway import APIGatewayClient
from mate_clients.forms import FormsClient


@pytest.fixture
def real_executor():
    return RealExecutor(
        wfe=FlowableClient(base_url="http://localhost:8081"),
        gateway=APIGatewayClient(base_url="http://localhost:8080"),
        forms=FormsClient(base_url="http://localhost:8080"),
    )


@pytest.fixture
def ctx():
    return RuntimeContext(
        app_id="app-1",
        tenant_id="tenant-a",
        version="latest",
        modules=[],
    )


@pytest.mark.asyncio
async def test_submit_form_returns_success(real_executor, ctx):
    action = RuntimeAction(action_type="submit_form", target="form-1")
    result = await real_executor.submit_form(ctx, action, {"name": "test"})
    assert result.success is True
    assert "form_submission_id" in result.data or "id" in result.data


@pytest.mark.asyncio
async def test_trigger_flow_returns_process_instance(real_executor, ctx):
    action = RuntimeAction(action_type="trigger_flow", target="process.approval")
    result = await real_executor.trigger_flow(ctx, action, {"amount": 1000})
    assert result.success is True
    assert "processInstanceId" in result.data


@pytest.mark.asyncio
async def test_call_api_returns_response(real_executor, ctx):
    action = RuntimeAction(action_type="call_api", target="api.echo")
    result = await real_executor.call_api(ctx, action, {"input": "hello"})
    assert result.success is True


@pytest.mark.asyncio
async def test_navigate_returns_target(real_executor, ctx):
    action = RuntimeAction(action_type="navigate", target="/dashboard")
    result = await real_executor.navigate(ctx, action, {})
    assert result.success is True
    assert result.data["navigate"] == "/dashboard"
```

要求 ≥ 4 个测试用例，0 skip。

## 13 条硬规则（本子批次触发的）

- **§13 第 4 条**：外部系统没有 ACL Client → 全部用 mate_clients，无裸 httpx

## 启动方式

1. 切到 K3-4 接力 worktree：`git worktree add .worktrees/apphub-runtime-04d -b codex/apphub-runtime-04d main`
2. 跑基线：`cd mate-platform-backend/packages/mate-app-hub && pytest -q -m "not integration"`
3. 按 5 项顺序推进
4. 全部完成 commit 一次：`feat(apphub): K3-4 executor 真实化 RealExecutor + mate_clients + 4 集成 tests`
5. commit 前必跑：
   - `pytest -q` 0 failed
   - `ruff check packages/mate-app-hub/`
   - `python scripts/ci/forbid_bare_httpx.py packages/mate-app-hub/` (0 命中)
   - `python scripts/ci/forbid_skip_tests.py packages/mate-app-hub/`

## 已知陷阱

1. **mate_clients 跨包依赖**——若 packages/mate-clients 不存在，需先建 stub
   用 Read 工具确认；K3 大剧本原文未强制要求，本子 prompt 显式要求
2. **pytest-asyncio 配置**——若仓内未配置 `@pytest.mark.asyncio`，
   看 conftest.py 是否自动模式；或用 `asyncio.run(...)` 替代
3. **API base URL 默认值**——本环境无 Flowable / Gateway / Forms 实例
   K3 集成测试走 stub 路径必须由 `mate_clients` 提供，
   若无，集成测试需 monkeypatch 替 client 内的 transport
4. **K3-3 与 K3-4 顺序**——K3-3 删 _runtime_tenant_id 后，K3-4 端点调用需用 _tenant_id
5. **APPHUB_EXECUTOR_MODE 环境变量**——默认 real；测试可临时改 mock 跳过外部依赖

## 验收清单

- [ ] pyproject.toml 加 mate-clients path dep
- [ ] runtime/executor.py 含 RealExecutor 类（4 个方法 + 4 个 span）
- [ ] get_executor() 工厂支持 real / mock 切换
- [ ] api/app.py execute_action 端点改用 get_executor()
- [ ] pyproject.toml httpx 移除（grep 仓内 0 业务引用）
- [ ] tests/test_apphub_executor_integration_01.py ≥ 4 tests pass
- [ ] 1 个 Conventional Commit
```

## 关联文档

- K3 大剧本：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04.md`
- K3-1 SQL：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04a.md`
- K3-2 OTel：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04b.md`
- K3-3 租户：`docs/active/specs/2026-08-02-ai-launch-prompt-apphub-runtime-04c.md`

## 元说明

- **本子批次解决**：K3-4 executor 真实化（§13 第 4 条 从 �� 转 ✅）
- **估时**：4 小时（含集成测试 + 跨包依赖）
- **关键诚实点**：K3-4 完成 → 13 门禁 10 ✅ / 0 ��