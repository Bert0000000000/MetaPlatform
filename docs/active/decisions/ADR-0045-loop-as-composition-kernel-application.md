# ADR-0045 · Loop 作为 Composition Kernel 应用

> 状态：**Proposed** · 2026-08-20
> 决策者：MetaPlatform Architecture Council
> 上游：ADR-0042（composition kernel）· ADR-0043（all-in-one 集成核心升格）
> 取代：ADR-0044（loop rollout · 旧三段线性框架）
> 关联：cordiverse/paper《A Programming Paradigm for Spatiotemporal Composability》§3.3 / §4 / §6.1–3

---

## 1. 背景

ADR-0044 把 loop 设计为「PRD → Code → Acceptance」三段线性流程，由 GitHub PR 当交接棒。这个描述在 v3.0 GA 之前够用，但与 ADR-0043 升格后的 composition kernel 语义**直接冲突**：

1. **PRD / Code / Acceptance 是流程术语，不是运行时原语**。loop 应该由可逆、可挂载、可反应、可中断的语义单元组成，不是文档流。
2. **「完成 = merge 到 main」是粗粒度断言**，与 composition kernel 的 ≃ 等价语义不匹配（一个 BATCH 接受后 coeffect store 是否回到 ∅？）。
3. **回滚路径缺失**：v2.0 没有显式撤销原语；CI 红了只能「修或重发」，违反论文 §6.1 撤回 / 补偿。
4. **跨 BATCH 复用机制缺失**：每个 BATCH 是孤岛；v2.0 没有"上一 BATCH 的能力 → 下一 BATCH 的能力"的拓扑。
5. **ADR-0043 四大面向 Batch 各自为政**：MP-EMP-EVOLVE / MP-MKT-INSTALL / MP-ACTION-CONFIRM / MP-INTEGRATION-HUB 没有共同运行时；loop 本身应该是它们的第一应用。

## 2. 决策

把 **loop 升格为 composition kernel 的第一应用层**：

### 2.1 Loop = fiber 编排

| Loop 概念 | Kernel 原语 |
|---|---|
| 一个 BATCH | **Fiber**（PENDING → LOADING → ACTIVE\|FAILED → UNLOADING → PENDING \| DISPOSED） |
| BATCH 状态字段（PR / CI / board） | **Coeffect bindings**（`batch:{id}:pr_url`、`batch:{id}:ci_status`、`batch:{id}:board_status`） |
| 一个 phase | **Component**（name, inject, provide, apply） |
| 跨 phase 依赖 | inject 声明 + reactive coeffect |
| 撤回一个 BATCH | **Effect disposer**（LIFO 逆操作链：close PR → revert commit → remove board row） |
| 13 硬规则 | **不变量**（kernel I1–I4 + 项目级 I5–I17） |
| GitHub workflow | **Coeffect change 触发器**（PR open → notify dependent phases） |
| 4 大面向 Batch | **OS 子系统 fiber**（loop 是 runtime，4 面向是 fibers） |

### 2.2 4 大面向作为 Loop OS 子系统

ADR-0043 提出的四大面向 Batch 是 composition kernel 在平台层的「第一应用」：

| 面向 | Batch | Loop 角色 |
|---|---|---|
| A 数字员工自进化 | MP-EMP-EVOLVE-01 | **Phase Execution Fiber Provider**（session 内热挂载/卸载 phase 实现） |
| B Marketplace 第三方 | MP-MKT-INSTALL-01 | **Capability Source Provider**（install 可插拔 phase capability） |
| C AI proposal 回滚 | MP-ACTION-CONFIRM-01 | **Rollback Effect Provider**（withdraw / compensate 原语库） |
| D 跨服务能力拓扑 | MP-INTEGRATION-HUB-01 | **Loop Runtime Context Bus**（platform-level Context 承载所有 loop fiber） |

**Loop 自己 = 面向 D 的实例化**：loop 不另起一层运行时，直接挂在面向 D 的 Context bus 上。

### 2.3 Loop Component 三件套

loop 由三个核心 Component 组成（每个都是 fiber）：

```
PRDComponent
  inject: program_board_pending
  provide: prd_doc_path, prd_checklist_path, acceptance_skeleton_path
  apply: ctx.set('prd_doc_path', ...) + ctx.set('prd_checklist_path', ...) + ...

CodeComponent
  inject: prd_doc_path, github_workflow_token
  provide: code_branch, code_commits, ci_run_id
  apply: ctx.set('code_branch', ...) + ctx.set('code_commits', ...) + ...

AcceptanceComponent
  inject: code_commits, ci_run_id, prd_doc_path
  provide: review_report, gate_decision
  apply: ctx.set('review_report', ...) + ctx.set('gate_decision', ...) + ...
```

**I2 保序**：AcceptanceComponent 不会在 CodeComponent ACTIVE 之前 ACTIVE（inject 依赖未满足 → fiber 留在 PENDING）。

**I3 环活性**：三个 Component 无 inject 环（PRD→Code→Acceptance 是 DAG），循环报告 `[]`。

### 2.4 BATCH 生命周期 = Fiber 状态机

```
PENDING       ← BATCH 被登记到 PROGRAM-BOARD 但未启
LOADING       ← PRD fiber ACTIVE，开始写文档
ACTIVE        ← 三 phase 全 ACTIVE，CI 跑通，等 merge
FAILED        ← 任一 phase 抛错（gate 红 / lint 红 / 引用丢失）
UNLOADING     ← 回滚发起（CI 红 → revert commit → close PR）
PENDING       ← 撤回回到待处理状态（I1 恢复）
DISPOSED      ← merge 成功 → 永久退场
```

### 2.5 Coeffect Keys（loop 的「可观测状态」）

| Key | Owner | Notify 谁 |
|---|---|---|
| `program_board_pending` | root | PRDComponent |
| `prd_doc_path` | PRDComponent | CodeComponent |
| `prd_checklist_path` | PRDComponent | AcceptanceComponent（提前写 reviewer 引用） |
| `acceptance_skeleton_path` | PRDComponent | AcceptanceComponent |
| `code_branch` | CodeComponent | AcceptanceComponent |
| `code_commits` | CodeComponent | AcceptanceComponent |
| `ci_run_id` | CodeComponent（set on push） | AcceptanceComponent |
| `review_report` | AcceptanceComponent | —（终态） |
| `gate_decision` | AcceptanceComponent | PROGRAM-BOARD 监听 |

**循环效应**：每个 `set` 触发 `_notify`，下游 fiber 重新计算 target；target 变了就 load/unload；CI 状态变化自动级联到 Acceptance。

### 2.6 Effect Disposers（撤回链 LIFO）

每个 phase 的 `apply` 收集 LIFO disposers：

PRDComponent disposers:
- `git branch -D cowork/<BATCH>-prd`（如未 merge）
- `rm <prd_doc_path>`（如未 push）
- `PROGRAM-BOARD remove row`

CodeComponent disposers:
- `gh pr close <N>`
- `git revert <commit_sha>`（已 push 未 merge）
- `git reset --hard <last_good>`（未 push）

AcceptanceComponent disposers:
- （终态，disposers 为空；merge 后无法回退到 ACCEPTED 之前，除非 `git revert` merge commit）

### 2.7 不变量（I1–I4 + 项目级）

| ID | 不变量 | 适用 |
|---|---|---|
| **I1** | load → unload 后 coeffect store ≅ 初始态 | BATCH 撤回后 PROGRAM-BOARD 该行消失 |
| **I2** | provider UNLOADING 时 dependents 先达终态 | AcceptanceComponent 不在 CodeComponent 之前 UNLOADING |
| **I3** | inject 环上 fiber 永不 ACTIVE | 三个 Component DAG，cycle_detect == [] |
| **I4** | 转换中 target 翻转链式反向 | CI 红触发 CodeComponent UNLOADING，PR close 触发 PRDComponent UNLOADING |
| **I5** | PR merge 前 BATCH 不可达 ACTIVE | AcceptanceComponent.inject 缺 ci_run_id = PENDING |
| **I6** | AC-* 必须被 ≥1 个 test 引用 | program_board_pending.set 时校验 |
| **I7** | ga-001~013 必须有 ✅/⬜/N/A 三态之一 | acceptance_skeleton_path.set 时校验 |
| **I8** | ADR 引用必现 | PRD doc 必含 ADR-NNNN |
| **I9-I17** | 13 硬规则其余 9 条 | ga-acceptance.yml 兜底 |

### 2.8 Capability Discovery（dispatch overlay）

每个 BATCH 启动时：

1. `ctx.detect_cycles()` → 确认三 Component 无环
2. `ctx.use(PRDComponent)` → 启动 PRD fiber
3. PRD fiber 写完 → set coeffect → notify Code fiber
4. `ctx.use(CodeComponent)` → 启动 Code fiber
5. Code fiber push → set ci_run_id → notify Acceptance fiber
6. `ctx.use(AcceptanceComponent)` → 启动 Acceptance fiber
7. Acceptance fiber 留 review → set gate_decision → 终止循环
8. `ctx.dispose()` → 全部退场

**目标视图 (Def 46)**：AcceptanceComponent 的 target 是 `{prd_doc_path: <id>, code_commits: <id>, ci_run_id: <id>}`；任一 binding 缺失 → target = None → fiber 留 PENDING。

## 3. 跟既有决策的关系

| 决策 | 关系 |
|---|---|
| ADR-0042（composition kernel） | 本 ADR 是其第一应用；不动内核 API；新增 `mate_platform/loop/` 子包消费内核 |
| ADR-0043（all-in-one 集成核心） | 本 ADR 是面向 D 的实例化；其他三个面向（EMP / MKT / ACTION）后续各自挂入 |
| ADR-0044（loop rollout 旧版） | **本 ADR 取代**：v2.0 prompt / v1.0 三份 prompt 全部标 OBSOLETE |
| 13 硬规则 | 不变；改用 I1–I17 不变量表达；ga-acceptance.yml 不动 |
| 自建原则 v0.4 | 不引入外部 agent 框架；loop 是自建 composition kernel 的应用 |

## 4. 跟 13 硬规则对位

| 硬规则 | 承担 |
|---|---|
| ① Swagger 没有接口不写 route | loop 自身无 HTTP API；MP-LOOP-01 不引入新端点 |
| ⑥ 静态检查失败不合并 | `mate_platform/loop/` 零依赖 + pyright-strict + ruff 干净 |
| ⑦ 跳过测试不标记 Accepted | I1–I4 验收测试全绿；loop fiber lifecycle 必须有 test |
| ⑨ 没有审计/指标/trace | fiber dispose 产生 lifecycle 事件 → 接 OTel |
| ⑩ 状态以验收证据为准 | `evidence/MP-LOOP-01-ACCEPTANCE.md` + loop invariant test |

## 5. 验收

- **MP-LOOP-01 BATCH 收口**：
  - `mate_platform/loop/` 子包落地（PRD / Code / Acceptance 三 Component + Coeffeffect Key 注册表）
  - I1–I4 + I5–I9 不变量测试全绿（≥13 tests）
  - `evidence/MP-LOOP-01-ACCEPTANCE.md` 13 门禁逐项 ✅
  - GA-ACCEPTANCE.yml 零回归
- **v3.0 loop prompt 落地**：`docs/active/specs/2026-08-20-ai-launch-prompt-loop-v3.md`
- **v2.0 prompt 标 OBSOLETE**（保留作历史）
- **PROGRAM-BOARD** 追加 MP-LOOP-01 行

## 6. 影响

- 新增 `mate_platform/loop/` 子包（~150–250 行零 I/O，依赖 `composition`）
- 新增 `tests/loop/` （≥13 invariant tests）
- 治理：V31-ONTOLOGY-BOARD §6.5 增段接 MP-LOOP-01
- 后续：4 大面向 Batch 落地后，loop 通过 `ctx.use(component)` 热挂载/卸载 phase 实现

## 7. 替代方案与拒绝理由

- **保留 v2.0 三段线性框架**——被拒：违反 ADR-0043 升格决定；与 I1 恢复 / I4 惰性 / I2 保序均不对位
- **另起 loop 运行时（不挂 composition kernel）**——被拒：制造 68 套碎片化机制中的第 69 套（ADR-0043 §7 已拒同类）
- **把 loop 全部塞进论文级 kernel API**——被拒：loop 是 *应用* 不是 *内核*；混包违反 ADR-0021 / ADR-0042 的正交分层

## 8. 开放问题

1. loop fiber 跨进程协作（多个 AI 会话接力同一个 BATCH）—— 暂用 coeffect key 持久化到 PROGRAM-BOARD 落库
2. CI 触发 → coeffect notify 的延迟窗口（GitHub webhook ~30s）—— 接受窗口，不做实时
3. FAILED fiber 自动恢复策略——目前仅手动 reload；面向 D 高频场景下一版补 supervisor