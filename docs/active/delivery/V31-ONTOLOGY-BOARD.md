# v3.1 Ontology + 数字员工 + SuperAI 任务板

> 起草：2026-08-06 · 关联：蓝图 v0.4 / ADR-0021 / ADR-0040 / ADR-0041
>
> 状态：**v3.1 子计划 20/20 Batch Accepted · 364/364 tests pass · M1+M2+M3 全部收口 · v4 RUNTIME 5/5 Batch Accepted · WFE P0 模板落地**
>
> 总览：M1（8 周 / 6 Batch）+ M2（10 周 / 6 Batch）+ M3（12 周 / 8 Batch）= **20 Batch / 38 周 ≈ 9 个月**到 GA-Ready。
> 后续：v4 RUNTIME（5 Batch / 19 周 合并提速收口）+ BUSINESS-SLICES P0 模板（ADR-0024 wfe 收口；剩余 16 域按 P0/P1/P2 接力）。

## 1. M1 — 地基（8 周 / 6 Batch 并行）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 | 依赖 |
|---|---|---|---|---|---|---|---|
| **MP-ONT-KERNEL-01** | ✅ Accepted | ☑ | ☑ | ☑ (111) | — | `evidence/MP-ONT-KERNEL-01-ACCEPTANCE.md` | — |
| **MP-ONT-MODEL-02** | ✅ Accepted | ☑ | ☑ | ☑ (4) | — | （含于 M1-ACCEPTANCE） | KERNEL-01 |
| **MP-SANDBOX-01** | ✅ Accepted | ☑ | ☑ | ☑ (12) | L1 | （含于 M1-ACCEPTANCE） | — |
| **MP-SESSION-01** | ✅ Accepted | ☑ | ☑ | ☑ (15) | — | （含于 M1-ACCEPTANCE） | — |
| **MP-AIP-GATEWAY-01** | ✅ Accepted | ☑ | ☑ | ☑ (15) | — | （含于 M1-ACCEPTANCE） | KERNEL-01 / SANDBOX-01 |
| **MP-AGENT-ORCH-01** | ✅ Accepted | ☑ | ☑ | ☑ (15) | — | （含于 M1-ACCEPTANCE） | KERNEL-01 / SESSION-01 / AIP-GATEWAY-01 |
| **M1 收口** | ✅ **Accepted** | — | — | **174/174** | — | `evidence/M1-ACCEPTANCE.md` | — |

**M1 退出标准**：
- 12 基元 API 签名冻结（ADR-0021 Accepted）
- Function Sandbox 6 条硬要求各 ≥1 集成测试
- Session Sandbox 7 条硬要求各 ≥1 集成测试
- AIP Gateway 强制 ActionType 路由（裸 SQL 0 通过）
- Orchestrator 状态机强校验 HITL

## 2. M2 — 提得对（10 周 / 6 Batch）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 | 依赖 |
|---|---|---|---|---|---|---|---|
| **MP-ONT-ACTION-03** | ✅ Accepted | ☑ | ☑ | ☑ (14) | — | （含于 M2-ACCEPTANCE） | KERNEL-01 / SANDBOX-01 |
| **MP-ONT-OBJECTSET-04** | ✅ Accepted | ☑ | ☑ | ☑ (31) | — | （含于 M2-ACCEPTANCE） | KERNEL-01 / MODEL-02 |
| **MP-ONT-MANAGER-05** | ✅ Accepted | ☑ | ☑ | ☑ (17) | — | （含于 M2-ACCEPTANCE） | KERNEL-01 / SANDBOX-01 |
| **MP-AGENT-ONT-01** | ✅ Accepted | ☑ | ☑ | ☑ (11) | — | （含于 M2-ACCEPTANCE） | KERNEL-01 / MANAGER-05 |
| **MP-AGENT-SEC-01** | ✅ Accepted | ☑ | ☑ | ☑ (11) | — | （含于 M2-ACCEPTANCE） | SESSION-01 / AIP-GATEWAY-01 |
| **MP-RAG-ONT-01** | ✅ Accepted | ☑ | ☑ | ☑ (9) | — | （含于 M2-ACCEPTANCE） | KERNEL-01 / MODEL-02 |
| **M2 收口** | ✅ **Accepted** | — | — | **93/93** | — | `evidence/M2-ACCEPTANCE.md` | — |

**M2 退出标准**：
- ActionType / Function / Interface 端点全部入 `ont.yaml`
- ObjectSet 编译器覆盖 80% 业务查询
- OntologyManager Branch / Proposal / Impact / Revert 闭环
- 7 类 Agent 中 2 个（Ontology / Security）落地
- RAG-Ontology 0 训练，召回率 ≥85%

## 3. M3 — 员工干活（12 周 / 8 Batch）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 | 依赖 |
|---|---|---|---|---|---|---|---|
| **MP-AGENT-WF-01** | ✅ Accepted | ☑ | ☑ | ☑ (11) | — | （含于 M3-ACCEPTANCE） | AGENT-ORCH-01 / MODEL-02 |
| **MP-AGENT-APP-01** | ✅ Accepted | ☑ | ☑ | ☑ (11) | — | （含于 M3-ACCEPTANCE） | AGENT-ORCH-01 / MODEL-02 |
| **MP-AGENT-DATA-01** | ✅ Accepted | ☑ | ☑ | ☑ (10) | — | （含于 M3-ACCEPTANCE） | AGENT-ORCH-01 / MANAGER-05 |
| **MP-AGENT-OBS-01** | ✅ Accepted | ☑ | ☑ | ☑ (12) | — | （含于 M3-ACCEPTANCE） | AGENT-ORCH-01 |
| **MP-AGENT-KB-01** | ✅ Accepted | ☑ | ☑ | ☑ (9) | — | （含于 M3-ACCEPTANCE） | AGENT-ORCH-01 / RAG-ONT-01 |
| **MP-AGENT-EXT-01** | ✅ Accepted | ☑ | ☑ | ☑ (12) | L3 强制 | （含于 M3-ACCEPTANCE） | SANDBOX-02 / AGENT-ORCH-01 |
| **MP-SANDBOX-02** | ✅ Accepted | ☑ | ☑ | ☑ (11) | K8s Job | （含于 M3-ACCEPTANCE） | SANDBOX-01 |
| **MP-SUPER-COPILOT-01** | ✅ Accepted | ☑ | ☑ | ☑ (21) | — | （含于 M3-ACCEPTANCE） | AGENT-ORCH-01 / SESSION-01 / 全部 Agent |
| **M3 收口** | ✅ **Accepted** | — | — | **97/97** | — | `evidence/M3-ACCEPTANCE.md` | — |

**M3 退出标准**：
- 7 类 Agent 全部落地
- SuperAI 编排平面跨 7 类 Agent 跑通 e2e
- Marketplace 第三方 Agent 强制 L3 沙箱
- 13 硬规则全部对位 + 251+ tests pass + 全量 GA CI 绿

## 4. 依赖图

```
M1:
KERNEL-01 ─┬─→ MODEL-02
           ├─→ SANDBOX-01 ─┐
           ├─→ SESSION-01 ─┤
           └─→ AIP-GATEWAY-01 → AGENT-ORCH-01
                            ↑
                  SANDBOX-01/SESSION-01 也供 AGENT-ORCH-01

M2:
KERNEL-01 / MODEL-02 / SANDBOX-01 → ACTION-03
KERNEL-01 / MODEL-02 → OBJECTSET-04
KERNEL-01 / SANDBOX-01 → MANAGER-05
全部 M1 + MANAGER-05 → AGENT-ONT-01
SESSION-01 / AIP-GATEWAY-01 → AGENT-SEC-01
KERNEL-01 / MODEL-02 → RAG-ONT-01

M3:
AGENT-ORCH-01 / MODEL-02 → AGENT-WF-01
AGENT-ORCH-01 / MODEL-02 → AGENT-APP-01
AGENT-ORCH-01 / MANAGER-05 → AGENT-DATA-01
AGENT-ORCH-01 → AGENT-OBS-01
AGENT-ORCH-01 / RAG-ONT-01 → AGENT-KB-01
SANDBOX-02 / AGENT-ORCH-01 → AGENT-EXT-01
SANDBOX-01 → SANDBOX-02
全部 M2 + 全部 Agent + SESSION-01 → SUPER-COPILOT-01
```

## 5. 13 硬规则收口映射

| 硬规则 | M1 | M2 | M3 |
|---|---|---|---|
| ① OpenAPI 先行 | KERNEL/MODEL | ACTION/OBJECTSET/MANAGER | Agent/SuperAI |
| ③ 没有 tenant 不访问 repo | KERNEL/SESSION/SANDBOX | AGENT-SEC | 全 Agent |
| ④ 外部系统没有 ACL Client | SANDBOX/SESSION | AGENT-ONT | AGENT-EXT |
| ⑤ Production profile 禁 fallback | KERNEL | — | SUPER-COPILOT |
| ⑥ 静态检查 ruff+pyright | 全 Batch | 全 Batch | 全 Batch |
| ⑦ 跳过测试不标 Accepted | 全 Batch | 全 Batch | 全 Batch |
| ⑧ K8s readiness + 回滚 | SANDBOX-01 | — | SANDBOX-02 |
| ⑨ 审计/指标/trace | SESSION-01/SANDBOX-01 | AGENT-SEC | AGENT-OBS |
| ⑩ 验收证据 | 全 Batch | 全 Batch | 全 Batch |
| ⑪ helm-docs 同步 | SANDBOX-01 | — | SANDBOX-02 |
| ⑫ Secret 不进 git | SESSION-01 | — | SANDBOX-02 |
| ⑬ NetworkPolicy default-deny | SANDBOX-01 | — | SANDBOX-02 |

## 6. v4 runtime 路线（2026-08-06 全部收口）

> **v4 状态**：**5/5 Batch Accepted**（2026-08-06 RUNTIME-MVP-01 + RUNTIME-MVP-02 合并提速两次收口）。
> ADR-0022（RUNTIME-HTTP-01 + RUNTIME-PG-03 合并）+ ADR-0023（OPT + K8S + IAM + MKT 合并）。

| Batch | 范围 | 周 | 状态 | 证据 |
|---|---|---|---|---|
| **RUNTIME-HTTP-01** | FastAPI runtime：7 endpoint（v2 operationId） | 4 | ✅ Accepted 2026-08-06 | `evidence/RUNTIME-MVP-01-ACCEPTANCE.md` |
| **RUNTIME-K8S-02** | Function Sandbox 默认 backend = subprocess（K8sJob 接入留后续） | 4 | ✅ Accepted 2026-08-06 | `evidence/RUNTIME-MVP-02-ACCEPTANCE.md` |
| **RUNTIME-PG-03** | PgOntologyRepository（psycopg2 sync + asyncio.to_thread） | 4 | ✅ Accepted 2026-08-06 | `evidence/RUNTIME-MVP-01-ACCEPTANCE.md` |
| **IAM-COPILOT-04** | dev profile ManagerContext 入口（真鉴权留 v4 后续） | 3 | ✅ Accepted 2026-08-06 | `evidence/RUNTIME-MVP-02-ACCEPTANCE.md` |
| **MARKETPLACE-05** | 第三方 sandbox 占位 `backend="microvm"`（Firecracker 真接入留后续） | 4 | ✅ Accepted 2026-08-06 | `evidence/RUNTIME-MVP-02-ACCEPTANCE.md` |
| **合计** | 5 Batch / 19 周 | — | **全部 Accepted** | ADR-0022 / ADR-0023 |

**RUNTIME-MVP-02 关键增量**：

- **RUNTIME-OPT**：ObjectSet 真在 PG 上跑（`SQLCompiler` 把 `CompiledFilter` → 参数化 SQL WHERE；`FilterCompiler.FIELD` 接受完整 rid `ont.<tenant>.prop.<slug>.v<n>`）
- **RUNTIME-K8S-02**：`SubprocessExecutor` 真子进程（`subprocess.run` + `RLIMIT_AS` 内存限 + timeout）；win32 `import resource` 守卫
- **IAM-COPILOT-04**：dev profile `LEGACY_LOGIN_COMPAT=1` 走 ManagerContext；AGENT-EXT-01 super-copilot 可用
- **MARKETPLACE-05**：`K8sSandboxRunner(backend="microvm")` API 占位（具体 MicroVM runtime 留 v4 后续）

**测试**：kernel + tech-ont 511/514 pass（3 pre-existing failure 经 `git stash` 验证不在本 Batch）；PG e2e 5/5 pass；`RUNTIME-MVP-02-ACCEPTANCE.md` 收口。

## 6.5 v3.1 增补：组合内核（2026-08-17 收口）

> cordis 范式引入评估（`.tmp-research/cordis/cordis-analysis.html`）A 案：**引原理不引组件**。
> ADR-0042 决策 + 四条形式化不变量（I1 恢复 / I2 保序 / I3 环活性 / I4 惰性）作为验收断言。

| Batch | 范围 | 状态 | 证据 |
|---|---|---|---|
| **MP-COMP-01** | `mate-platform/composition` 内核（effect/coeffect/fiber，674 行零依赖）+ orchestrator 能力反应式运行时试点（lifespan + capability 端点 + dispatch overlay） | ✅ Accepted 2026-08-17 | `evidence/MP-COMP-01-ACCEPTANCE.md` |

**关键增量**：能力可用性 = coeffect（`capability:{tenant}:{name}`）；工具下线 → 依赖角色 fiber 反应式失活（效果全部逆回收）→ 回归自动复激活；裸 TestClient（无 lifespan）回退与旧行为逐字节一致。19 内核 tests + 9 试点 tests；pyright-strict / ruff 干净；mate-platform 287 全量回归零影响。

## 7. 关联文档

- 蓝图：`docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4
- ADR-0021：`docs/active/decisions/ADR-0021-kernel-12-primitives.md`
- ADR-0040：`docs/active/decisions/ADR-0040-sandbox-architecture.md`
- ADR-0041：`docs/active/decisions/ADR-0041-session-sandbox.md`
- 决策纪要：`docs/active/decisions/PENDING-DECISIONS.md`
- 验收证据：
  - `evidence/MP-ONT-KERNEL-01-ACCEPTANCE.md`
  - `evidence/M1-ACCEPTANCE.md`（174 tests）
  - `evidence/M2-ACCEPTANCE.md`（+93 = 267 tests）
  - `evidence/M3-ACCEPTANCE.md`（+97 = **364 tests**）
  - `evidence/RUNTIME-MVP-01-ACCEPTANCE.md`（RUNTIME-HTTP-01 + RUNTIME-PG-03 合并提速版，+7 e2e tests）
  - `evidence/RUNTIME-MVP-02-ACCEPTANCE.md`（RUNTIME-OPT + RUNTIME-K8S-02 + IAM-COPILOT-04 + MARKETPLACE-05 合并提速版，+21 tests）
- 端到端示例：
  - `packages/mate-kernel/examples/01_kitchen_sink.py`（kernel 闭环）
  - `examples/02_curl_walkthrough.sh`（v2 HTTP curl 验收）

## §SAL 语义层 AI 落地（2026-08-17 启动）

> 程序目标（spec `2026-08-17-semantic-layer-ai-landing-plan.md` v0.3 §4.0）：核心闭环 = **SAL-01 读 + SAL-02 想 + SAL-04 写**，SAL-03 生产门并行。北极星 demo：未付订单标记待复核全链路。

| Batch | 状态 | 交付 | 证据 |
|---|---|---|---|
| **MP-SAL-01 工具化基座（读）** | **Accepted 2026-08-17** | ADR-0043 九条定案落地：ObjectSetQuery IR（filter/aggregate/traverse/多键 sort，双后端同源）+ schema_gen（query_<slug> 每类型工具 + list/inspect）+ 虚拟注册表（/v2/agent-tools 零同步）+ markings 上抬一级（类型级标记 + 可见性 + 执行期二次校验）+ copilot/MCP 双消费接线 + ont.yaml 3 新端点 | `evidence/MP-SAL-01-ACCEPTANCE.md`（kernel 455 / ont 172 / orchestrator 47 / mcp 0 failed；ruff+pyright 新文件全净） |
| **MP-SAL-02 OAG 检索上下文（想）** | **Accepted 2026-08-17** | ont_object_embedding 属性级索引（index-on-write + reindex）+ search_objects（cosine→对象卡片带 rid）+ REST /v2/object-search + copilot search_objects 工具 + system prompt 卡片注入 | `evidence/MP-SAL-02-ACCEPTANCE.md`（kernel 455 / ont+kernel 634 合跑 / copilot 相关 39；ruff+pyright 全净） |
| MP-SAL-03 Function 沙箱生产化 | Pending（并行） | K8s Job 真接 + copilot 真鉴权收口 | — |
| **MP-SAL-04 Assisted Action 端到端（写）** | **Accepted 2026-08-17** | ADR-0044：ProposalStatus 状态机（pending→confirmed→applied/rejected，apply 三查未确认永不落库）+ ont_proposal 表 + REST propose/get/confirm/reject 4 端点 + outbox emitter 接线（事件 id 回填 outcome）+ copilot propose_action 工具（AI 只能提议，confirm 不是 LLM 工具） | `evidence/MP-SAL-04-ACCEPTANCE.md`（kernel 465 / ont 179 / copilot 相关 15） |
