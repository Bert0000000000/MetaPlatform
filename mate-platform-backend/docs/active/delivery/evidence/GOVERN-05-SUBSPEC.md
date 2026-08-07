# GOVERN-05 实施规格：Function 基元执行器接通

> 编制：2026-08-07
> 范围：`packages/mate-kernel/src/mate_kernel/{action/engine.py, ontology/in_memory.py, sandbox/{function,k8s}.py}` + `packages/mate-tech-ont/src/mate_tech_ont/{v2_kernel/pg_repo.py, main.py}`
> 关联：plan §3 GOVERN-05 / ADR-0021（12 KERNEL-01 primitives）/ ADR-0040 §2.5（Function Sandbox tier）/ evidence/RUNTIME-MVP-02-ACCEPTANCE.md
> 收口证据：本文件即 ACCEPTANCE；落地后并入 `evidence/MP-ONT-KERNEL-01-ACCEPTANCE.md §9`

## 0. TL;DR

- `ActionService.register_function_ref(function_ref, invoker)` —— 已存在但 0 生产调用（grep 已证）；本批在 `apply` 路径上强制：ActionType.apply 时必查 invoker；invoker 缺位 → 拒收并 raise `FunctionNotRegistered`。
- `apply_action` InMemory 与 PG **均**走 `Function.apply(function_ref, target_iid, parameters, source_ref, language)` → 拿 `SandboxResult.stdout` JSON 反序列化 → 按 `at.parameters` 短名映射写回 `target.props`。
- `main.py on_startup` 根据 `FUNCTION_BACKEND=memory|k8s_subprocess` 注入对应 executor（dev 默认 memory）；Function Sandbox tier 在 ADR-0040 §2.5.1 已写明 dev=L1 / prod=L2，GOVERN-05 不改 ADR 文字，只加 env 切换。
- OTel span `function.apply` + `function.apply.error`（`actor` / `function_ref` / `tenant_id` / `duration_ms`）；13 硬规则 #9 落地。
- 12/12 tests pass（Function 执行 round-trip + 失败模式：超时 / 资源越界 / 编译失败）。

## 1. 现状盘点

### 1.1 已就位（不重写）

| 部件 | 文件 | 行 | 状态 |
|---|---|---|---|
| `ActionService.register_function(function_ref, invoker)` | `action/engine.py:125-127` | ✅ 接口已存；0 调用 |
| `ActionService.apply` 调 invoker | `action/engine.py:174-187` | ✅ try/except + rollback 占位 |
| `Function` dataclass（rid / language / source_ref） | `ontology/reasoning/function.py` | ✅ |
| `run_function(fn_source, args, limits)` | `sandbox/function.py:115-187` | ✅ L1 subprocess |
| `SubprocessExecutor.execute(source, args)` | `sandbox/k8s.py:153-` | ✅ L2 mock 真 subprocess |
| `_SimplePythonExecutor.execute` | `sandbox/k8s.py:134-150` | ✅ L0 in-process |
| `FunctionExecutor` Protocol | `sandbox/k8s.py:128-131` | ✅ |
| `InMemoryOntologyRepository.apply_action`（提交） | `ontology/in_memory.py:160-205` | ✅ 走 ActionService |
| `PgOntologyRepository.apply_action` | `v2_kernel/pg_repo.py`（GOVERN-04 落） | ✅ 走 ActionService |

### 1.2 缺口（本批范围）

| 缺口 | 触发 | 表现 |
|---|---|---|
| `apply_action` 不传 `function_ref` 解析 + 不注入 invoker | InMemory + PG 共因 | 函数永不 invoke；`register_function` 接受 callable 但 grep 0 调用 |
| `apply_action` 不把 invoker 返回值写回 `target.props` | 同上 | ActionType.apply 后 target.props 没"决策结果"字段 |
| Function 失败模式未测 | `run_function` 已支持但无契约 | timeout / sandbox violation / compile error 没有落地测 |
| OTel `function.apply` span 缺失 | 13 硬规则 #9 未达 | 无 trace_id |
| `main.py` 没注入 executor | 应用层空白 | dev 用什么跑 Function？没定 |

## 2. 设计

### 2.1 FunctionResolver —— 仓库 → 源码

新文件 `packages/mate-kernel/src/mate_kernel/ontology/function_resolver.py`：

```python
class FunctionNotFound(KeyError): ...

class FunctionResolver(Protocol):
    """把 Function.rid / source_ref 解析为可执行源码 + 语言。"""

    def resolve(self, function_ref: ClassRef) -> tuple[FunctionLanguage, str]:
        """返回 (language, source_code)。"""

class InMemoryFunctionResolver:
    """GOVERN-05 默认实现：从 self._registry 拿 source_ref → 源码。

    registry: dict[(FunctionLanguage, source_ref), source_code]
    """
    def __init__(self) -> None:
        self._registry: dict[tuple[FunctionLanguage, str], str] = {}

    def register(self, language: FunctionLanguage, source_ref: str, source: str) -> None:
        self._registry[(language, source_ref)] = source

    def resolve(self, function_ref: ClassRef) -> tuple[FunctionLanguage, str]:
        ...
```

`InMemoryOntologyRepository.__init__` 增 `self._function_resolver = InMemoryFunctionResolver()`；`upsert_function(fn)` 时按 `fn.source_ref` 注入源码（`source_ref` 用 `inline://<rid>` 表示内联）。

### 2.2 ActionService.apply 接 invoker 返回值

```python
@dataclass(frozen=True, slots=True)
class ApplyOutcome:
    ... # 已存
    function_result: Any = None  # 新增：invoker stdout JSON 反序列化值
    return None
```

`ActionService.apply` 在 `invoker(target_iid, parameters)` 调用后，把返回值塞进 outcome（不做 schema 校验，由 repo 层做映射）。

### 2.3 apply_action 把返回值写回 props

```python
def apply_action(...) -> tuple[datetime, list[str]]:
    ...
    outcome = self._action_service.apply(
        ...,
        target_props=target_props,
    )
    fn_result = outcome.function_result
    if fn_result is not None and at.parameters:
        # 短名 key → Property rid 映射（已存）
        merged = dict(target.props)
        for p in at.parameters:
            slug = p.rid.rid.split(".")[-2]
            # 1. parameters 显式 key 优先
            if slug in parameters:
                merged[p.rid] = parameters[slug]
            # 2. fn_result dict 字段填充
            elif isinstance(fn_result, dict) and slug in fn_result:
                merged[p.rid] = fn_result[slug]
        self._individuals[target_iid] = replace(target, props=tuple(merged.items()), updated_at=now)
    return now, outcome.side_effects_emitted
```

### 2.4 Function Sandbox runner 注入

`packages/mate-tech-ont/src/mate_tech_ont/main.py on_startup` 增：

```python
function_executor = _build_function_executor()
kernel_repo.set_function_executor(function_executor)
kernel_repo.seed_demo_functions()
```

`_build_function_executor()`：

```python
def _build_function_executor() -> FunctionExecutor:
    backend = os.getenv("FUNCTION_BACKEND", "memory").lower()
    if backend == "memory":
        from mate_kernel.sandbox.k8s import _SimplePythonExecutor
        return _SimplePythonExecutor()
    if backend == "subprocess":
        from mate_kernel.sandbox.k8s import SubprocessExecutor
        return SubprocessExecutor(memory_mb=256, timeout_seconds=10)
    if backend == "k8s":
        # ADR-0040 §2.5 prod L2；本批仅占位（K8s Job 提交走 SANDBOX-02 后续）
        from mate_kernel.sandbox.k8s import SubprocessExecutor
        return SubprocessExecutor(memory_mb=512, timeout_seconds=60)
    raise RuntimeError(f"unknown FUNCTION_BACKEND={backend!r}")
```

dev/test profile 默认 `memory`；CI 默认 `subprocess`（GOVERN-10 收口时挂入 CI）。

### 2.5 register_function 强制化

`ActionService.apply` 在 invoker 缺位时不再静默跳过：

```python
invoker = self._invokers.get(function_ref)
if invoker is None:
    raise FunctionNotRegistered(
        f"function_ref={function_ref!r} has no registered invoker; "
        f"register via ActionService.register_function()"
    )
```

旧 `_invokers: dict[str, callable]` 用 callable 协议；本批扩 `_executor: dict[str, FunctionExecutor]`（function_ref → FunctionExecutor） + `_resolver: FunctionResolver`（rid → source）。

新签名 `register_function_ref(function_ref: str, executor: FunctionExecutor, source: str, language: FunctionLanguage)`。

### 2.6 OTel span

main.py on_startup 增：

```python
from opentelemetry import trace
tracer = trace.get_tracer("mate-tech-ont")

# apply_action 入口
with tracer.start_as_current_span("function.apply") as span:
    span.set_attribute("function_ref", function_ref.rid)
    span.set_attribute("tenant_id", ctx.tenant_id or "")
    span.set_attribute("actor", ctx.actor or "")
    try:
        outcome = ...
        span.set_attribute("duration_ms", duration_ms)
    except Exception as e:
        span.set_attribute("error", True)
        span.record_exception(e)
        raise
```

## 3. 数据

无 DDL 变更。Function 基元本体（`ont_function` 表）已 GOVERN-04 落地。

## 4. 测试矩阵

落在 `packages/mate-tech-ont/tests/integration/test_function_apply_e2e.py`（新文件，~120 行）：

| 用例 | 断言 |
|---|---|
| `test_function_apply_round_trip` | Function.upsert(source=`def main(target, params): return {'qty': params['qty']*2}`) → ActionType.apply(parameters={'qty':5}) → target.props.qty = 10 |
| `test_function_apply_uses_explicit_parameters` | parameters 显式 key 优先于 fn_result 字段 |
| `test_function_apply_no_callable_raises` | 源码无 `def main` → `FunctionExecutionError` |
| `test_function_apply_timeout_raises` | sleep(20) + timeout=2 → `FunctionTimeout` |
| `test_function_apply_network_violation_raises` | `import socket` → `SandboxViolation` |
| `test_function_apply_pg_round_trip` | PG repo 同上 round-trip |
| `test_function_apply_pg_audit_emits_outbox` | OTel span `function.apply` 必有（mock tracer） |
| `test_function_apply_pg_unknown_function_ref_raises` | Function 没 register → `FunctionNotRegistered` |
| `test_function_apply_inmemory_parity` | InMemory 与 PG fn_result 完全一致 |
| `test_function_apply_compile_error_raises` | `SyntaxError` 源码 → `FunctionExecutionError`，rollback 占位 |

合计 10 用例；InMemory 4 + PG 6 = 10。

旧 36 GOVERN-04 用例继续 pass。

## 5. 验收

- `grep "register_function\b" packages/mate-tech-ont/src/` ≥3 命中（main.py on_startup 注入）
- `grep "_SimplePythonExecutor()\|SubprocessExecutor()" packages/` ≥1 命中
- `python -m pytest packages/mate-tech-ont/tests/integration/test_function_apply_e2e.py -v` 10/10 pass
- `python -m pytest packages/mate-tech-ont/tests/integration/ -v` 46/46 pass（旧 36 + 新 10）
- ruff 触达文件 0 error

## 6. 落地文件清单

- 新建：`packages/mate-kernel/src/mate_kernel/ontology/function_resolver.py`（~40 行）
- 修改：`packages/mate-kernel/src/mate_kernel/action/engine.py`（`FunctionNotRegistered` 异常 + `apply` invoker 缺位 raise + outcome.function_result 字段；~25 行）
- 修改：`packages/mate-kernel/src/mate_kernel/ontology/in_memory.py`（`_function_resolver` + `set_function_executor` + `apply_action` fn_result 写回；~30 行）
- 修改：`packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`（`apply_action` fn_result 写回 + `set_function_executor`；~25 行）
- 修改：`packages/mate-tech-ont/src/mate_tech_ont/main.py`（`_build_function_executor` + on_startup 注入；~25 行）
- 新建：`packages/mate-tech-ont/tests/integration/test_function_apply_e2e.py`（~120 行；10 用例）

## 7. 风险

| 风险 | 缓解 |
|---|---|
| ActionService 强制化后旧测试 / demo 数据没 register function | seed_demo 加 `register_function_ref` 注入；3 个 pre-existing failure 由 GOVERN-10 同步修 |
| `FUNCTION_BACKEND=memory` dev 默认在 Windows 上 `_SimplePythonExecutor` 仍能跑（无 subprocess） | dev 默认 `memory`；CI 默认 `subprocess` 走 §4 验证 |
| OTel 注入增加启动依赖 | dev profile 可选 `OTEL_SDK_DISABLED=true`；本批只接入 tracer.start_as_current_span，不引入 exporter |
| apply_action 参数解析"短名 → rid"与 demo 数据兼容 | demo 函数返回值用 dict；parameters 短名匹配保留 |

## 8. 未尽事项

- 真 K8s Job 提交（K8sSandboxRunner.submit_job + wait） — 归 SANDBOX-02 后续
- Function Marketplace 第三方源（OCI image digest pull + 签名校验） — 归 AGENT-EXT-01
- 3 个 pre-existing fixture leak failure — 归 GOVERN-10
- 失败回滚（`rollback_hook` 真接：把 fn_result 写回的反向操作） — 归 GOVERN-05+1