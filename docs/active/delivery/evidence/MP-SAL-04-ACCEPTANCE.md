# MP-SAL-04 ACCEPTANCE — Assisted Action 端到端（写）

> **Batch**: MP-SAL-04（Semantic layer AI Landing · 04 · Assisted Action，对位差距 G4）
> **日期**: 2026-08-17 · **分支**: `refactor/mp-sal-01`
> **ADR**: `docs/active/decisions/ADR-0044-assisted-action.md`（Accepted v1.0）
> **Spec**: v0.3 §4.2 SAL-04；上游 SAL-01（工具面）/SAL-02（检索通道）已 Accepted

## 1. 交付范围（对照 G4 审计五断点）

| G4 断点 | 收口 | 状态 |
|---|---|---|
| ① proposal 无状态机、apply 从不校验 | `ProposalStatus`（pending→confirmed→applied / rejected 终态）+ `confirm/reject_proposal` + **`apply(proposal_id=...)` 强制校验**（存在/匹配/confirmed 三查，否则 `ProposalNotConfirmed`）；`expected_diff`（staging 语义）+ `confirmed_by/at` | ✅ |
| ② side_effect_emitter 可选未接 | repo 级 `set_outbox_writer(writer)`（协议 `__call__(event_type, tenant, payload) -> event_id`）；`apply_action` 构造 emitter，事件 id 回填 `ApplyOutcome.side_effect_events`；InMemory/PG 双侧；未注入 → 行为不变（回退硬门槛） | ✅ |
| ③ tech-ont 无 propose/confirm 端点 | `ont_proposal` 表 + repo `propose_action/get/list/confirm/reject`（PG 行 + 引擎镜像双写，跨进程 apply 前行回填）+ REST 4 端点 | ✅ |
| ④ 两套 HITL 不通 | **写路径 canonical HITL = ActionProposal 状态机**；orchestrator plan review 保留为编排面 HITL，action 类步骤经同一 tech-ont 端点确认（ADR-0044 §2.6 adapter 约定；fiber 级联动显式出范围） | ✅（约定层） |
| ⑤ copilot 无「提议→确认→落库」 | LLM 工具 **`propose_action`**（AI 只能提议，产出 pending + 预期 diff）；**confirm/reject 不是 LLM 工具**（边界断言进测试），用户直调 tech-ont 规范端点 | ✅ |

**审计四段留痕**：① ont_proposal 行（创建）→ ② confirmed_by/confirmed_at → ③ ApplyOutcome audit → ④ outbox 事件 id（side_effect_events）。

## 2. 契约（硬规则 1）

ont.yaml 32→**36 paths** / 57→**60 schemas**：`ontProposeV2ActionType` / `ontGetV2Proposal` / `ontConfirmV2Proposal` / `ontRejectV2Proposal` + `ProposalV2`/`ProposalCreateV2`/`ProposalConfirmV2`（status 枚举四态）。

## 3. 测试证据（硬规则 7）

| 套件 | 结果 | 新增 |
|---|---|---|
| mate-kernel | **465 passed**（SAL-02 后 455 + 10） | `test_proposal_state_machine.py` 9（状态转换/终态/双确认拒绝/apply 三查/legacy 旁路）+ `test_assisted_action_e2e.py` 3（**正路径四段** + **未确认永不落库数据零变化** + rejected 不可 apply） |
| mate-tech-ont | **179 passed / 8 skipped** | proposal repo 方法经既有套件回归（DDL 自愈 + api 模块导入） |
| mate-app-copilot | 相关 15 passed | propose_action 工具注册/执行 + **HITL 边界断言**（工具名永不含 confirm/reject） |

## 4. 静态检查（硬规则 6）

ruff：新增测试文件全净；改动文件零新增错误（唯一新引入 SIM105 已改 `contextlib.suppress`）。pyright：改动文件零新增错误（engine.py 既有 `callable` 注解模式 6 项为存量）。

## 5. 北极星验收（读+想+写闭环，程序目标 §4.0）

三批组合链路全部就位并有测试证据：
- **①自主发现**（01）：`list_classes`/`inspect_class`/`query_<slug>`（含 marking 可见性与执行期二次校验）
- **②带对象上下文推理**（02）：`search_objects` 卡片（rid 可追溯）注入 system prompt
- **③提议→人确认→落库**（04）：`propose_action`（AI）→ `/v2/proposals/{id}/confirm`（人）→ `apply(proposal_id)` → outbox
- **negative 双闸**（01+04）：缺 marking 工具不可见且直调被拒；未确认 proposal 永不落库

全栈 HTTP 级北极星 demo（前端界面 + live LLM）属 demo 环境步骤，后端能力链已由上述测试逐段证明。

## 6. 出范围（ADR-0044 §4）

proposal 过期/乐观锁 / orchestrator fiber 联动 / Workshop diff 渲染 UI。

## 7. 程序进度

**SAL-01 读 ✅ + SAL-02 想 ✅ + SAL-04 写 ✅ = 核心闭环（§4.0 程序目标）达成**；SAL-03（生产门：沙箱 K8s + copilot 真鉴权）为部署条件，随生产化收口。
