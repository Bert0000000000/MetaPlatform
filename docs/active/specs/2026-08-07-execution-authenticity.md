# 数字员工执行真实性验证设计（Execution Authenticity）

> 状态：**Draft v0.1** · 日期：2026-08-07 · 关联：ADR-0028（prompt 单一数据源）/ ADR-0029（DW tenant 命名空间）/ 蓝图 v0.4 §4.1（7+1 数字员工）
> 目的：定义数字员工执行时，如何通过 action 编排验证「这次执行是真实的、可追溯的」——回答"谁做的、用户确认过吗、真的执行了吗、副作用落地了吗、结果是什么"。

---

## 1. 问题

数字员工（未来接 LLM）声称"我执行了 ActionType X"。平台需要一套**执行真实性验证**机制，证明：

1. 是谁（actor / tenant / session）触发的
2. 用户是否确认过（HITL）
3. 是否真的执行了（不是 LLM 编造结果）
4. 副作用是否落地（outbox）
5. 执行结果是什么（function_result 是否来自真实执行）

---

## 2. 现状：action 编排已有的验证机制

`mate_kernel/action/engine.py:ActionService.apply` 已具备 4 层验证：

| 层 | 机制 | 验证什么 |
|---|---|---|
| 提交前 | `submission_criteria`（规则表达式） | 参数/target props 满足前置条件，不满足抛 `SubmissionCriteriaFailed` |
| 真实执行 | `FunctionExecutor.execute(source, args) → (rc, out, err)` | 真起进程/沙箱跑用户源码；rc≠0 抛 `FunctionExecutionError` |
| 失败回滚 | `rollback_hook` | 执行失败/超时 → 回滚，`rolled_back=True` |
| 来源绑定 | `SubmissionContext(actor/sandbox_id/hitl_token/tenant_id/correlation_id)` | 谁、在哪个沙箱、哪个 tenant、哪个会话 |

编排层另有：`HitlTokenStore`（B2 短期 token，copilot.confirm_step 校验后 consume）、`AuditRetention`（C3 审计）、outbox 事件。

---

## 3. 关键缺口：证据链断裂

对照 `copilot.py` / `workflow.py` / `obs.py` 调 apply 的调用点，验证链在 3 处断裂：

```
proposal (propose) ──┬──✗──► hitl_token 校验（copilot 层，没传给 apply）
                     ├──✗──► audit_id（apply 自增，无 proposal_id 关联）
                     └──✗──► outbox event_id（emit 但没挂 audit_id）
```

| # | 缺口 | 现状 | 后果 |
|---|---|---|---|
| 1 | `hitl_token` 没打通 | `workflow.py:184` 调 apply 时 `ctx.hitl_token=None` | 无法证明"这次 apply 对应哪次用户确认" |
| 2 | `proposal_id` 没进 `ApplyOutcome` | `propose()` 生成 proposal，`apply()` 不接收 proposal_id | 无法把执行追溯到具体 proposal |
| 3 | `outbox event_id` 没挂审计 | `side_effects_emitted: list[str]` 只记字符串 | 副作用事件无法回查 |

---

## 4. 设计：执行真实性验证闭环

目标证据链（一条线）：

```
proposal_id ─► hitl_token(校验+消费) ─► audit_id ─► outbox_event_id ─► function_result
    ▲                ▲                     ▲              ▲                 ▲
  将做什么        用户确认过           执行已发生        副作用已发出       真实执行结果
```

### 4.1 最小补法（3 处改动）

1. **`ActionProposal` 加 `proposal_id`**，`apply()` 新增 `proposal_id` 参数；`ApplyOutcome` 存 `proposal_id + hitl_token`
2. **`workflow.py` / `obs.py` 调 apply 时传 `ctx.hitl_token`**——copilot.confirm_step 已有 token，往下透传
3. **`side_effects` 升级**：从 `list[str]` 改为记录 `(event_type, event_id)`——outbox 写后回填 id，`ApplyOutcome.side_effects_emitted` 存事件 id

### 4.2 验证查询

给定一次 apply 的 `audit_id`，可回答 5 问：

| 问 | 证据 |
|---|---|
| 谁执行的 | `SubmissionContext.actor + tenant_id + correlation_id` |
| 用户确认过吗 | `ApplyOutcome.proposal_id + hitl_token`（校验 + 已消费） |
| 真的执行了吗 | `audit_id + FunctionExecutor 的 (rc, out, err)` |
| 副作用落地了吗 | `outbox event_id` 列表 |
| 结果是什么 | `function_result`（来自 executor，非 LLM 编造） |

### 4.3 与既有机制的边界

- 不新建实体表：证据链复用于 `ApplyOutcome` + `HitlTokenStore` + outbox，只补关联字段
- `AuditRetention`（C3 默认 discard / opt-in 7d）不变——验证只保证"执行可验证"，审计保留策略照旧
- `ActionType.apply` 仍是唯一写入口（蓝图原理 #3 + 13 硬规则）

---

## 5. 验收标准

1. `propose()` 返回带 `proposal_id` 的 proposal；`apply()` 接收 `proposal_id`，`ApplyOutcome` 可反查
2. workflow/obs 调 apply 时 `ctx.hitl_token` 非空（经 copilot.confirm_step 透传）
3. `side_effects_emitted` 含 outbox 事件 id，可按 id 回查
4. 单测：proposal → token 消费 → apply → audit，全链可追溯；无 token / 错 token 的 apply 被拒
5. 端到端：数字员工走 `ActionType.apply` 一次，能从 audit 反查所有 5 项证据

---

## 6. TD-6 补办项

- 上述 3 处改动落 `mate_kernel/action/engine.py`
- `workflow.py` / `obs.py` 调用点补 token 透传
- 新增 `test_action_authenticity.py` 覆盖证据链闭环
- 前端（可选）：员工执行历史展示 `audit_id → 证据 5 项`

---

## 7. 参考

- `mate_kernel/action/engine.py:ActionService`（apply/propose/ApplyOutcome）
- `mate_kernel/sandbox/k8s.py:FunctionExecutor`（真实执行）
- `mate_kernel/agent/copilot.py:SuperAICopilot / HitlTokenStore`（HITL）
- `mate_kernel/agent/workflow.py` / `agent/obs.py`（调 apply 的调用点）
- `docs/active/specs/2026-08-07-digital-employee-asset-inventory.md`（资产清单）
