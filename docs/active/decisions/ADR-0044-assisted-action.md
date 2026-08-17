# ADR-0044: Assisted Action 端到端（Proposal 状态机 + HITL 统一 · MP-SAL-04）

> 状态：**Accepted v1.0** · 日期：2026-08-17 · 决策人：MetaPlatform Architecture Council（SAL-04 会话）
> 上游：ADR-0043 / spec `2026-08-17-semantic-layer-ai-landing-plan.md` v0.3 §4.2 SAL-04 + G4 审计（五断点）
> 关联：ADR-0013（outbox）/ ADR-0021（ActionType 唯一写入口）/ B3 决策（每次 ≥1 HITL）

## 1. 背景（G4 审计五断点）

ActionProposal 模型在但无状态机（`apply()` 从不校验 proposal）；`side_effect_emitter` 是可选 hook 而 pg_repo 调用不传（不写 outbox）；tech-ont 无 propose/confirm 端点（apply 直达落库）；orchestrator plan review 与 ActionProposal 两套 HITL 互不相通；copilot 无「AI 提议→确认→落库」链路。

## 2. 决策

### 2.1 Proposal 状态机（内核，写路径唯一 HITL 规范）

```
pending → confirmed → applied
   ↘ rejected（终态）
```

- `ActionProposal` 增 `status`（StrEnum）+ `expected_diff`（预期 diff）+ `confirmed_by/confirmed_at`。
- `ActionService.confirm_proposal / reject_proposal`（仅 pending 可转换）。
- **`apply(proposal_id=...)` 强制校验**：proposal 存在、action_rid 匹配、status==confirmed，否则 `ProposalNotConfirmed` —— **未确认 proposal 永不落库**（北极星 negative）。apply 成功后 → applied。
- `proposal_id=None` 保留为 legacy 直达路径（内部/迁移场景），文档明示生产写路径必须走 proposal。

### 2.2 持久化（tech-ont）

`ont_proposal` 表（proposal_id PK / tenant / action_rid / target_iid / parameters JSONB / impact_summary / expected_diff JSONB / status / confirmed_by / created_at / confirmed_at / applied_at）。`PgOntologyRepository.propose_action / get_proposal / list_proposals / confirm_proposal / reject_proposal`；状态转换经 ActionService（内存镜像 + PG 行双写，repo 为事实源）。

### 2.3 Outbox 写回接线

repo 级 `set_outbox_writer(writer)`，writer 协议 `__call__(event_type, tenant_id, payload) -> event_id | None`；`apply_action` 构造 emitter 传给 engine（每 side_effect 一事件，事件 id 回填 `ApplyOutcome.side_effect_events`）。dev 未注入 → None → 行为不变（回退硬门槛）。

### 2.4 REST（tech-ont v2）

`POST /v2/action-types/{rid}/propose` → pending proposal；`GET /v2/proposals/{id}`；`POST /v2/proposals/{id}/confirm`（记录 confirmed_by）；`POST /v2/proposals/{id}/reject`。`/apply` 不变（provenance.proposal_id 现在被真正校验）。

### 2.5 copilot 消费侧（AI 提议，人确认）

- LLM 工具 **`propose_action`**（action_rid/parameters/target_iid/impact_summary/expected_diff）加入 ontology 工具面——**AI 只能 propose**。
- **confirm/reject 不是 LLM 工具**（HITL 边界：确认只能由用户发起），也不做 copilot 代理层——用户确认**直调 tech-ont 规范端点**（`/v2/proposals/{id}/confirm|reject`，前端/编排 adapter 均用同一端点），链路单一化。

### 2.6 orchestrator HITL 统一（v1 边界，显式出范围部分）

**写路径的 canonical HITL = ActionProposal 状态机**（本 ADR）。orchestrator plan review 仍是编排面 HITL（dispatch 类步骤）；对 action 类步骤，review approve 应路由到 proposal confirm+apply——v1 落 **adapter 约定**（orchestrator worker 侧调用 tech-ont propose/confirm/apply REST），fiber 级联动（ADR-0042）不在本批。此为诚实的范围声明，非遗漏。

### 2.7 审计四段留痕

① proposal 创建（ont_proposal 行）→ ② 确认（confirmed_by/at）→ ③ apply（ApplyOutcome audit）→ ④ 外部同步（outbox 事件 id 回填 side_effect_events）。

## 3. 验收（北极星写腿）

e2e：AI（模拟 FC）propose_action → proposal pending → 用户 confirm → apply 落库 → outbox 事件存在。Negative：未确认直调 apply → `ProposalNotConfirmed`，数据零变化；rejected proposal 不可 apply。四段留痕断言。

## 4. 出范围

proposal 过期/乐观锁（spec §5.3 冲突策略 → 后续 ADR）/ orchestrator fiber 联动 / Workshop 级 staging UI diff 渲染。
