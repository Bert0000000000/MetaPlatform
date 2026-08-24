# ADR-0061: Temporal 作为业务 Workflow 引擎（PlanRunner 退化为 LLM-friendly DSL 翻译层）

> **状态**: Accepted · **日期**: 2026-08-21 · **决策人**: MatePlatform Architecture Council
> **签字**: `__/__________` （落档于 ADR-REVIEW；纸质档填写位）
> **上游**:
> - 蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §3.3 M40（"Workflow Path C 引擎（自研 + Edge Function + Temporal）"原本设想）
> - MP-AGENT-WF-01（M3 已 Accepted）+ SAL-05 P1（2026-08-17 Accepted）+ SAL-05 P2（Plan 1 在 Sprint 1）
> - 路径 A/B/C 三选项对比（V1.0-RELEASE-PLAN §Temporal 引入分析）
> **配套**: V1.0-RELEASE-PLAN.md §2.3 Sprint 1A + ADR-0044（proposal 状态机）+ ADR-0045（workflow ↔ 本体联动）

## 1. 背景

当前 Workflow 编排由自研 `PlanRunner`（mate-tech-orchestrator，5 种 StepKind：PROPOSE / APPLY_ACTION / EVALUATE_OBJECTSET / RUN_FUNCTION / CALL_AGENT）承担，SAL-05 P1 已落地 HITL 合一（review approve = proposal confirm + apply 一次完成）。

自研 PlanRunner 在以下方面不足：
- **持久化弱**：plan 仍 in-memory（SAL-05 P2 才补）；崩溃恢复靠手动
- **长任务**：1 周+ 审批等待无 wait_condition；多级超时升级要自建
- **Activity retry / heartbeat**：无；worker 健康靠外层 OTel 推
- **Workflow version**：无；plan schema 变更无灰度
- **Signal**：HITL Hub ↔ workflow 双向通知要自建
- **SRE 工具**：自研 `/plans/{id}/graph` 简陋；Temporal UI 是工业级

蓝图 v0.4 §3.3 M40 原本就设想 **"Path C 自研 + Temporal"** 的双层架构（自研编排平面 + Temporal 长任务骨架），但实施时未落地 Temporal。SAL-05 P1 落地后 PlanRunner 已能跑通业务工作流，但上述短板在「v1.0 准生产 + 长审批 + 灰度」目标下成为瓶颈。

## 2. 决策

**路径 C：核心替换 —— Temporal 作为业务 Workflow 引擎；PlanRunner 退化为 LLM-friendly DSL 翻译层。**

### 2.1 架构分工

| 层 | 角色 | 实现 |
|---|---|---|
| **LLM 友好 DSL** | PlanRunner 翻译层 | `plan JSON`（PlanStepRequest / PlanSpec）→ Temporal Workflow Definition（`@workflow.defn`） |
| **业务 Workflow 引擎** | Temporal Worker | `process_plan` workflow + 5 种 Activity（propose / confirm / apply / objectset_query / run_function / call_agent） |
| **持久化** | Temporal history | 自动序列化 / replay |
| **长任务** | Temporal wait_condition | 1 周+ 内置；超时升级靠 Activity heartbeat + workflow version |
| **HITL 信号** | Temporal signal | `ReviewSignal(proposal_id, decision, token)`；HITL Hub 收到用户决策后发 signal |
| **Activity retry** | Temporal retry policy | 内置 backoff + 指数退避 |
| **可视化（SRE）** | Temporal UI | 工业级 workflow 调试 / 历史回放 |
| **可视化（业务）** | 保留自研 `/plans/{id}/graph` | 翻译层从 Temporal describe + history 推导节点状态 |
| **LLM 编排平面** | 保留 PlanRunner DSL | AgentLoop 生成 plan JSON → 翻译层产 workflow → worker 执行 |
| **SuperAI / Copilot** | 不变 | LLM 仍通过 DSL 表达意图，不直接接触 Temporal API |

### 2.2 HITL 重设计

当前 SAL-05 P1 的 "review approve = confirm + apply 一次完成" 语义保留，但实现层改为：

1. **workflow 收到 review approve signal** → 调用 `confirm_proposal` Activity → 成功后立即调用 `apply_action` Activity（同一 workflow 内连续）
2. **HITL Hub 收到 reject signal** → 调用 `reject_proposal` Activity + workflow `continue_as_new` 收口
3. **plan 中显式标记"合并步"**：proposal.confirm_then_apply 作为一个复合 Activity，内部调用 confirm + apply，保证原子性 + 可观测性
4. **未确认 proposal 永不落库** 强约束保留（Activity 内 confirmation_id 校验）

### 2.3 双轨期（Sprint 1A）

- PlanRunner 不删除，作为 DSL 翻译层 + 兼容入口
- Temporal Worker 并行上线，部分 plan 走 Temporal
- 双 plan 持久化：Temporal history + plan 镜像表（仅查询用）
- 切换开关：`WORKFLOW_ENGINE=temporal|legacy`（env），按 plan_id 灰度
- 监控：plan 成功率 / latency / Activity 失败率 双轨对比

### 2.4 迁移期

- 第 1 周（Sprint 1A 启动）：Temporal 集群部署 + PlanRunner 翻译层骨架
- 第 2 周：Temporal Worker 5 Activity 落地 + DSL 翻译规则
- 第 3 周：HITL signal 重设计 + HITL Hub 发 signal 桥接
- 第 4 周：双轨灰度 + e2e 验证 + 切流

## 3. 影响

### 3.1 必影响

| 模块 | 变化 |
|---|---|
| `mate-tech-orchestrator/` | PlanRunner 改为 DSL 翻译层；新增 Temporal Worker；保留 5 Activity 适配 |
| `mate-tech-ont` | proposal 端点不变；新增 confirm_then_apply 复合端点 |
| `hitl-hub` | review approve 后发 Temporal signal 而非直接调 confirm+apply；reject 同理 |
| `infra/helm/charts/` | 新增 `temporal/` sub-chart（server + worker + web + DB schema）|
| `.github/workflows/` | 新增 temporal-ci.yml（lint workflow / activity / 测试）|
| `scripts/ci/` | 新增 `check_temporal_grammar.py`（workflow/activity 命名规范 + retry policy 检查）|
| 13 硬规则 | #8 K8s readiness + 回滚 → Temporal sub-chart 落地；#9 审计 → Temporal history 自带 |
| SAL-05 P2 通道②（outbox→流程自动启动）| 由 Temporal 接管（outbox event handler 调 Temporal client.start workflow）|
| Sprint 1 SAL-05 P2 任务 | 拆分：plan 持久化由 Temporal history 接管（出 Sprint 1A）；outbox→流程启动接入 Temporal client（Sprint 1A）|
| 蓝图 §3.3 M40 | 实施落地（原本就是自研 + Temporal 双层，现在 Temporal 接管）|

### 3.2 不影响

- SuperAI / Copilot / 7 类 Agent（LLM 仍走 DSL）
- 12 Ontology Kernel + ActionType.apply 写入口
- Function Sandbox（含 SAL-03 K8s Job 收口）
- 沙箱 / 数字员工 / Marketplace / 数据产品
- v6 整套方案（仍不采纳）

### 3.3 工作量

| 项 | 周 |
|---|---|
| Temporal 集群部署（helm sub-chart + DB schema + UI）| 1 |
| PlanRunner DSL 翻译层 + 5 Activity 落地 | 1.5 |
| HITL signal 重设计 + HITL Hub 发 signal | 0.5 |
| 双轨灰度 + 切流开关 | 0.5 |
| e2e 验证（北极星 + 长审批 + 灰度）| 0.5 |
| **合计** | **4 周**（Sprint 1A） |

## 4. 验收标准

- ✅ Temporal 集群 K8s 部署 + NetworkPolicy + readiness/liveness 通过 13 硬规则 #8
- ✅ PlanRunner DSL 翻译层测试 ≥ 30（覆盖 5 StepKind × 各种 plan shape）
- ✅ Temporal Worker 5 Activity 测试 ≥ 50（含 retry / heartbeat / timeout）
- ✅ HITL signal e2e：用户批准 → Temporal signal → confirm+apply 一次完成（latency ≤ 500ms）
- ✅ 长任务 demo：1 周审批等待 → Temporal wait_condition + Activity heartbeat
- ✅ 双轨对比报告：temporal vs legacy 成功率 / latency / Activity 失败率
- ✅ SAL-05 P1 / P2 验收文档同步更新
- ✅ 蓝图 §3.3 M40 标记实施

## 5. 替代方案与拒绝理由

- **路径 A：完全不引入 Temporal，自研收口** —— 被拒。蓝图 §3.3 M40 原本设想 Temporal；自建长任务 + retry + heartbeat + version 4-6 周工作量与 Temporal 学习曲线持平但成熟度差一个量级；SRE 工具强依赖 Temporal UI。
- **路径 B：渐进引入 —— Temporal 只承载长任务，PlanRunner 仍是编排平面** —— 被拒。双引擎长期共存增加边界维护成本；HITL 信号在两引擎间跳转会引入额外 round-trip；不如路径 C 一步到位。

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Temporal 学习曲线 | Sprint 1A 第 1 周团队 spike + 官方 tutorial；DBA + SRE 联合运维 |
| 持久化双轨期数据不一致 | plan 镜像表定时 reconcile；切流前冻结 plan schema |
| HITL signal 引入额外 round-trip | 复合 Activity 内部调 confirm + apply；signal payload 内联 proposal + payload |
| Temporal 集群单点 | HA 部署（3 节点 server + postgres + elasticsearch visibility）+ 备份 |
| Temporal 升级 breaking | 锁版本 + 升级窗口 + replay 测试 |
| workflow version 灰度 | Temporal 内置 versioning；切流按 plan_id 灰度 |

## 7. 关联

- 蓝图：`docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §3.3 M40
- ADR-0044：proposal 状态机（assisted action）
- ADR-0045：workflow ↔ 本体联动（channel ①③）
- V1.0-RELEASE-PLAN.md §2.3 Sprint 1A
- SAL-05 P1 ACCEPTANCE / SAL-05 P2 Sprint 1A 收口
