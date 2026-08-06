# v3.1 Ontology + 数字员工 + SuperAI 任务板

> 起草：2026-08-06 · 关联：蓝图 v0.4 / ADR-0021 / ADR-0040 / ADR-0041
>
> 总览：M1（8 周 / 6 Batch）+ M2（10 周 / 6 Batch）+ M3（12 周 / 8 Batch）= **20 Batch / 38 周 ≈ 9 个月**到 GA-Ready。

## 1. M1 — 地基（8 周 / 6 Batch 并行）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 | 依赖 |
|---|---|---|---|---|---|---|---|
| **MP-ONT-KERNEL-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-ONT-KERNEL-01-ACCEPTANCE.md` | — |
| **MP-ONT-MODEL-02** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-ONT-MODEL-02-ACCEPTANCE.md` | KERNEL-01 |
| **MP-SANDBOX-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-SANDBOX-01-ACCEPTANCE.md` | — |
| **MP-SESSION-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-SESSION-01-ACCEPTANCE.md` | — |
| **MP-AIP-GATEWAY-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AIP-GATEWAY-01-ACCEPTANCE.md` | KERNEL-01 / SANDBOX-01 |
| **MP-AGENT-ORCH-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-ORCH-01-ACCEPTANCE.md` | KERNEL-01 / SESSION-01 / AIP-GATEWAY-01 |

**M1 退出标准**：
- 12 基元 API 签名冻结（ADR-0021 Accepted）
- Function Sandbox 6 条硬要求各 ≥1 集成测试
- Session Sandbox 7 条硬要求各 ≥1 集成测试
- AIP Gateway 强制 ActionType 路由（裸 SQL 0 通过）
- Orchestrator 状态机强校验 HITL

## 2. M2 — 提得对（10 周 / 6 Batch）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 | 依赖 |
|---|---|---|---|---|---|---|---|
| **MP-ONT-ACTION-03** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-ONT-ACTION-03-ACCEPTANCE.md` | KERNEL-01 / SANDBOX-01 |
| **MP-ONT-OBJECTSET-04** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-ONT-OBJECTSET-04-ACCEPTANCE.md` | KERNEL-01 / MODEL-02 |
| **MP-ONT-MANAGER-05** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-ONT-MANAGER-05-ACCEPTANCE.md` | KERNEL-01 / SANDBOX-01 |
| **MP-AGENT-ONT-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-ONT-01-ACCEPTANCE.md` | KERNEL-01 / MODEL-02 / MANAGER-05 / AGENT-ORCH-01 / AIP-GATEWAY-01 |
| **MP-AGENT-SEC-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-SEC-01-ACCEPTANCE.md` | SESSION-01 / AIP-GATEWAY-01 |
| **MP-RAG-ONT-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-RAG-ONT-01-ACCEPTANCE.md` | KERNEL-01 / MODEL-02 |

**M2 退出标准**：
- ActionType / Function / Interface 端点全部入 `ont.yaml`
- ObjectSet 编译器覆盖 80% 业务查询
- OntologyManager Branch / Proposal / Impact / Revert 闭环
- 7 类 Agent 中 2 个（Ontology / Security）落地
- RAG-Ontology 0 训练，召回率 ≥85%

## 3. M3 — 员工干活（12 周 / 8 Batch）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 | 依赖 |
|---|---|---|---|---|---|---|---|
| **MP-AGENT-WF-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-WF-01-ACCEPTANCE.md` | AGENT-ORCH-01 / MODEL-02 |
| **MP-AGENT-APP-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-APP-01-ACCEPTANCE.md` | AGENT-ORCH-01 / MODEL-02 |
| **MP-AGENT-DATA-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-DATA-01-ACCEPTANCE.md` | AGENT-ORCH-01 / MANAGER-05 |
| **MP-AGENT-OBS-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-OBS-01-ACCEPTANCE.md` | AGENT-ORCH-01 |
| **MP-AGENT-KB-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-KB-01-ACCEPTANCE.md` | AGENT-ORCH-01 / RAG-ONT-01 |
| **MP-AGENT-EXT-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-AGENT-EXT-01-ACCEPTANCE.md` | SANDBOX-02 / AGENT-ORCH-01 |
| **MP-SANDBOX-02** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-SANDBOX-02-ACCEPTANCE.md` | SANDBOX-01 |
| **MP-SUPER-COPILOT-01** | Pending | ☐ | ☐ | ☐ | ☐ | `evidence/MP-SUPER-COPILOT-01-ACCEPTANCE.md` | AGENT-ORCH-01 / SESSION-01 / 全部 Agent |

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

## 6. 关联文档

- 蓝图：`docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4
- ADR-0021：`docs/active/decisions/ADR-0021-kernel-12-primitives.md`
- ADR-0040：`docs/active/decisions/ADR-0040-sandbox-architecture.md`
- ADR-0041：`docs/active/decisions/ADR-0041-session-sandbox.md`
- 决策纪要：`docs/active/decisions/PENDING-DECISIONS.md`
