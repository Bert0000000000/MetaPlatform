# PRD-APP-WFE 工作流引擎 详细规范

> 版本:v1.0 · 2026-07-31
> 配套:`PRD-APP-WFE-工作流引擎_v1.0-20260731.md`(总 PRD)+ `PRD-APP-WFE-工作流引擎-按钮操作手册_v1.0-20260731.md`
> 类型:**技术实现规范**(面向开发者)
> 状态:**Active**

---

## 1. 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 后端 | Python | 3.12 |
| Web 框架 | FastAPI | latest |
| BPMN 引擎 | Flowable | 8.0.0(`flowable/flowable-engine:8.0.0` docker 镜像已在 `docker-compose.yml`) |
| 持久化 | PostgreSQL | 16-alpine |
| BPMN XML 解析 | `lxml` | latest |
| 表达式引擎 | Flowable JUEL | 内置 |

---

## 2. 包结构(对照 mate-app-copilot)

```
packages/mate-app-wfe/
  pyproject.toml                          # 加入 workspace members
  src/mate_app_wfe/
    __init__.py
    main.py                                # FastAPI app + install_auth
    api/
      app.py                               # 5 步模式 + 路由
    bpmn/
      parser.py                            # Flowable BPMN parser 封装
      validator.py                         # 5 项校验
      dry_run.py                           # 内存模拟试运行
    repositories/
      in_memory.py                         # P2-W4 用 in-memory;后续接 PG
    clients.py                             # BearerAuth + OutgoingAuthMiddleware
  tests/
    test_wfe_dry_run.py                    # 试运行 happy-path
    test_wfe_validator.py                  # 校验 5 项
    test_tenant_integration.py             # 跨租户 negative(≥3)
```

---

## 3. 试运行实现(dry_run)

```python
# 简化示意(实际代码按 5 步 checklist)
from lxml import etree
from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import require_tenant
from mate_platform.messaging import Event, OutboxWriter

app = FastAPI(title="mate-app-wfe")
install_auth(app, extra_anonymous_paths={"/health"})

@app.post("/api/v1/wfe/flows/test")
async def test_flow(request: Request, body: TestFlowRequest):
    ctx = request.state.ctx
    require_tenant(ctx)

    # 1. 解析 BPMN
    try:
        bpmn_tree = etree.fromstring(body.bpmn_xml.encode())
    except etree.XMLSyntaxError as e:
        raise HTTPException(400, detail={
            "code": "E_FLOW_INVALID_XML",
            "message": str(e),
            "line": e.lineno
        })

    # 2. 校验 5 项
    errors = validate_bpmn(bpmn_tree)
    if errors:
        raise HTTPException(400, detail={
            "code": "E_FLOW_VALIDATION_FAILED",
            "errors": errors
        })

    # 3. dry-run(内存模拟,不触发副作用)
    result = dry_run_flow(bpmn_tree, body.mock_variables, ctx)

    # 4. emit outbox event
    outbox: OutboxWriter = request.app.state.outbox_writer
    outbox.append(Event.create(
        type="wfe.flow.tested",
        tenant_id=ctx.tenant_id,
        aggregate_id=body.flow_key,
        payload={"flow_key": body.flow_key, "result": "success"},
        trace_id=ctx.trace_id,
    ))

    return {
        "flow_key": body.flow_key,
        "executed_nodes": result.executed_nodes,
        "duration_ms": result.duration_ms,
        "side_effects_blocked": True  # 试运行模式标志
    }
```

---

## 4. 校验实现(5 项)

```python
def validate_bpmn(bpmn_tree) -> list[BPMNValidationError]:
    errors = []

    # 1. BPMN XML schema 合法性(lxml 自动)

    # 2. 开始 / 结束节点存在
    start_events = bpmn_tree.findall(".//{*}startEvent")
    end_events = bpmn_tree.findall(".//{*}endEvent")
    if not start_events:
        errors.append(BPMNValidationError("E_FLOW_NO_START_END", "缺少开始节点"))
    if not end_events:
        errors.append(BPMNValidationError("E_FLOW_NO_START_END", "缺少结束节点"))

    # 3. 节点 ID 唯一
    node_ids = []
    for elem in bpmn_tree.iter():
        node_id = elem.get("id")
        if node_id:
            if node_id in node_ids:
                errors.append(BPMNValidationError(
                    "E_FLOW_DUPLICATE_NODE_ID",
                    f"节点 ID 重复: {node_id}"
                ))
            node_ids.append(node_id)

    # 4. sequence flow 有源 / 目标
    for sf in bpmn_tree.findall(".//{*}sequenceFlow"):
        source = sf.get("sourceRef")
        target = sf.get("targetRef")
        if not source or not target:
            errors.append(BPMNValidationError(
                "E_FLOW_INVALID_SEQUENCE",
                f"sequenceFlow 缺 sourceRef / targetRef"
            ))

    # 5. 表达式合法性
    for elem in bpmn_tree.iter():
        for attr in ["conditionExpression", "decisionRef"]:
            val = elem.get(attr)
            if val and val.startswith("${") and val.endswith("}"):
                # JUEL 表达式语法校验(简化:括号匹配)
                expr = val[2:-1]
                if not is_valid_juel(expr):
                    errors.append(BPMNValidationError(
                        "E_FLOW_INVALID_EXPRESSION",
                        f"非法 JUEL 表达式: {val[:50]}"
                    ))

    return errors
```

---

## 5. dry_run 实现(内存模拟)

```python
def dry_run_flow(bpmn_tree, mock_variables, ctx) -> DryRunResult:
    """内存模拟,不写 Flowable engine 历史表,不触发外部副作用。"""
    start_time = time.monotonic()

    # 1. 找开始节点
    start = bpmn_tree.find(".//{*}startEvent")
    if start is None:
        raise ValueError("No start event")

    # 2. BFS 遍历所有可达节点
    executed_nodes = [start.get("id")]
    current_nodes = [start]
    visited = {start.get("id")}

    while current_nodes:
        next_nodes = []
        for node in current_nodes:
            outgoing = bpmn_tree.findall(
                f".//{{*}}sequenceFlow[@sourceRef='{node.get('id')}']"
            )
            for sf in outgoing:
                target_id = sf.get("targetRef")
                if target_id not in visited:
                    visited.add(target_id)
                    target = bpmn_tree.find(f".//*[@id='{target_id}']")
                    if target is not None:
                        executed_nodes.append(target_id)
                        next_nodes.append(target)
        current_nodes = next_nodes

    # 3. 不实际执行 userTask / serviceTask(只标记)
    duration_ms = int((time.monotonic() - start_time) * 1000)

    return DryRunResult(
        executed_nodes=executed_nodes,
        duration_ms=duration_ms,
    )
```

---

## 6. 5 步 checklist(每 PR 自检)

按 `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0:

- [ ] **步骤 1**:`install_auth(app)` 在 `create_app()` 第一行(`mate-app-wfe/api/app.py`)
- [ ] **步骤 2**:每个 handler 第一行 `require_tenant(ctx)`
- [ ] **步骤 3**:写 handler 用 `outbox.append(Event.create(...))` 同事务(试运行 + 校验都算写)
- [ ] **步骤 4**:出向调用用 `BearerAuth` + `OutgoingAuthMiddleware`(本批无出向,留空)
- [ ] **步骤 5**:`tests/test_tenant_integration.py` ≥ 3 cross-tenant negative
- [ ] **步骤 6**:OpenAPI `security:` 段已升级三段式(`contracts/openapi/services/wfe.yaml` 已有)
- [ ] `pytest mate-app-wfe/tests` 全绿
- [ ] `git log` 显示 commit 信息包含 ADR-0014 引用

---

## 7. 测试矩阵

| Suite | cases | 说明 |
|---|---:|---|
| `test_wfe_dry_run.py` | 8 | happy-path:简单流程 / 并行网关 / 嵌套子流程 / 表达式分支 |
| `test_wfe_validator.py` | 5 | 5 项校验各 1 case |
| `test_tenant_integration.py` | 5 | wrong tenant / missing scope / no tenant / 跨 tenant / admin 通道 |
| `test_flowable_integration.py` | 3 | 真实 Flowable engine 启动 + 校验(可选,需要 staging) |
| **总计** | **21** | ≥ 21 cases(满足 P2-W4 9 cases 门槛) |

---

## 8. 配置与运行时

### 8.1 环境变量

```bash
# Flowable engine 连接
WFE_FLOWABLE_REST_URL=http://flowable-engine:8080/flowable-rest
WFE_FLOWABLE_ADMIN_USER=admin
WFE_FLOWABLE_ADMIN_PASSWORD=${SECRET_FLOWABLE_ADMIN_PASSWORD}

# dry-run 限流
WFE_DRY_RUN_LIMIT_PER_HOUR=1000

# BPMN XML 大小限制
WFE_BPMN_MAX_BYTES=1048576  # 1MB
```

### 8.2 启动 profile

```yaml
# docker-compose.yml(在 PLATFORM-K8S-01 已配)
flowable-engine:
  image: flowable/flowable-engine:8.0.0
  ports: ["8081:8081"]
  environment:
    - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/flowable
    - FLOWABLE_COMMON_APP_ID=mate-platform-wfe
```

---

## 9. 监控与告警

- **metrics**:
  - `wfe_dry_run_total` (Counter)
  - `wfe_dry_run_duration_seconds` (Histogram)
  - `wfe_validation_failures_total{reason}` (Counter)
  - `wfe_flowable_engine_unavailable_total` (Counter)
- **alerts**:
  - dry-run P95 > 5s for 5min → warn
  - Flowable engine 不可用 → page oncall
- **audit**: 每次试运行 / 校验都写到 `mate_platform.audit.observability`

---

## 10. 与 mate-tech-msg / Outbox 集成

试运行是"写"操作,需 emit outbox event:

```python
outbox.append(Event.create(
    type="wfe.flow.tested",
    tenant_id=ctx.tenant_id,
    aggregate_id=flow_key,
    payload={
        "flow_key": flow_key,
        "executed_nodes": result.executed_nodes,
        "duration_ms": result.duration_ms,
    },
    trace_id=ctx.trace_id,
))
```

下游消费者(可选):
- analytics 服务:统计 dry-run 失败率
- audit 服务:写 `wfe.flow.tested` 到 Loki

---

## 11. 关联文档

- `PRD-APP-WFE-工作流引擎_v1.0-20260731.md` — 总 PRD
- `PRD-APP-WFE-工作流引擎-按钮操作手册_v1.0-20260731.md` — 用户操作
- `architecture-implementation.md` §1.2 + §3.2 — Flowable 集成
- `production-readiness-design.md` §13 — 硬规则
- `per-app-integration-checklist.md` — 5 步模式
- `contracts/openapi/services/wfe.yaml` — OpenAPI 契约源

---

## 12. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-31 | v1.0 初版(详细规范 + 5 步 checklist + 测试矩阵) | TRAE 补 PRD |