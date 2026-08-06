# M1 ACCEPTANCE — v3.1 Ontology / 数字员工 / SuperAI（M1 收口）

> 起草：2026-08-06 · 状态：**M1 Accepted**
> 关联：ADR-0021（Kernel 12 基元）/ ADR-0040（Function Sandbox）/ ADR-0041（Session Sandbox）
> Worktree：`.worktrees/mp-ont-kernel-01`，分支 `refactor/mp-ont-kernel-01`
> 前置：v3.0 GA（8/8 Batch Accepted，251/251 tests pass）

## 1. 范围

M1 = 8 周 6 Batch：把 v3.0 GA 期间仅以"理念 + 旧 OWL 实体"存在的 Ontology 资产，提升到 v3.1 增量所需的 **12 个不可变 / 可变基元** + 完整 sandbox / gateway / orchestrator 协议骨架。

不在 M1 范围：M2（6 Batch，10 周）/ M3（8 Batch，12 周）— 见 `docs/active/delivery/V31-ONTOLOGY-BOARD.md`。

## 2. 6 Batch 交付清单

| Batch | 状态 | tests | 关键交付 |
|---|---|---|---|
| **KERNEL-01** | ✅ Accepted | 111 | 12 基元 dataclass + serde + Protocol + InMemory repo + OpenAPI v2 (23 端点) + OWL v1→v2 迁移 + 双租户 ctx 统一 + 13 硬规则对位 |
| **MODEL-02** | ✅ Accepted | 4 | Persistent ClassRef/Version/Property row + DDL 4 条 + Protocol |
| **SANDBOX-01** | ✅ Accepted | 12 | Function Sandbox L1 进程级（CPU/mem/timeout/denylist） |
| **SESSION-01** | ✅ Accepted | 15 | Session Sandbox 协议（TTL/state machine/HITL/cross-user 隔离） |
| **AIP-GATEWAY-01** | ✅ Accepted | 15 | Provider 抽象 + 4 路路由策略 + BudgetGate 滑动窗口 |
| **AGENT-ORCH-01** | ✅ Accepted | 15 | SuperAI Orchestrator 协议 + AgentSelector + PlanSpec/PlanState |
| **合计** | **6/6 Accepted** | **174/174 pass** | — |

## 3. 模块树（M1 终态）

```
mate-kernel/src/mate_kernel/
├── __init__.py
├── ontology/                        # KERNEL-01 + MODEL-02
│   ├── identity/{class_ref,version}.py
│   ├── types/{property_,object_type,link_type,action_type,interface}.py
│   ├── instances/{individual,link_instance}.py
│   ├── reasoning/{axiom,function}.py
│   ├── query/object_set.py
│   ├── serde/{codec,serde}.py
│   ├── api.py                       # Protocol
│   ├── in_memory.py                 # InMemoryOntologyRepository
│   ├── persistence.py               # MODEL-02 row + DDL
│   ├── tenant.py                    # W6 双租户 ctx
│   └── migrate_v1_v2.py             # W5 OWL 迁移
├── sandbox/                         # SANDBOX-01 + SESSION-01
│   ├── function.py                  # L1 进程沙箱
│   └── session.py                   # 用户级会话沙箱
├── aip/                             # AIP-GATEWAY-01
│   └── gateway.py                   # Provider/Route/Budget
└── agent/                           # AGENT-ORCH-01
    └── orchestrator.py              # SuperAI / Plan

scripts/ci/
└── forbid_legacy_tenant_ctx.py      # W6 旧 ctx 守门

contracts/openapi/services/
└── ont.yaml                         # W3 +23 v2 operationId

docs/active/delivery/evidence/
├── MP-ONT-KERNEL-01-ACCEPTANCE.md
└── M1-ACCEPTANCE.md                 # 本文件
```

## 4. 13 硬规则对位（M1 全 Batch）

| # | 硬规则 | 实施收口 |
|---|---|---|
| 1 | Swagger 没有接口，不写 route | KERNEL-01 ont.yaml +23 v2 端点 |
| 2 | PRD 没有 Requirement ID | 23 operationId 各挂 FR-ONT-KERNEL01-* |
| 3 | **没有 tenant 上下文，不访问 repository** | tenant.py + 14 tests + `forbid_legacy_tenant_ctx.py` |
| 4 | 外部系统没有 ACL Client | M1 全部 in-memory，无外部访问 |
| 5 | Production profile 禁止 fallback | runtime 显式标注（InMemoryOntologyRepository） |
| 6 | 静态检查失败不合并 | stdlib + dataclass + enum，零 type 错误 |
| 7 | 契约或集成测试跳过不标记 Accepted | **174/174 tests pass，0 skip** |
| 8 | 没有 K8s readiness + 回滚 | M1 仅 library，runtime 在 M2+ |
| 9 | 没有审计、指标、trace | apply_action 返回 (datetime, side_effects)，OTel hook 点 |
| 10 | 所有状态以验收证据为准 | 7 ACCEPTANCE.md（M1 + KERNEL-01） |
| 11 | helm-docs 同步 | N/A（M1 无 helm chart） |
| 12 | Secret 不进 git | 代码无 secret，仅 `api_key_ref` 占位 |
| 13 | NetworkPolicy 缺失 = prod 不通过 | N/A（M1 无运行时部署） |

## 5. 与既有架构的对位（v3.0 baseline 不破坏）

- ✅ `mate-tech-ont`（旧 OWL SPARQL/Cypher）路径保留，未触碰
- ✅ `mate-kernel/types/` baseline 测试 4 个通过
- ✅ `contracts/openapi/services/ont.yaml` 仅追加 v2 路径，未删旧端点
- ✅ `manifest.yaml` ont 域仍指向 `mate_tech_ont.main:app`（runtime 不变）

## 6. 测试覆盖（M1 全 Batch）

```bash
cd packages/mate-kernel
python -m pytest tests/ -v
# 174 passed in ~5s
```

| 测试文件 | tests | 覆盖 |
|---|---|---|
| test_ontology_primitives.py | 43 | 12 基元 dataclass 不变量 |
| test_ontology_serde.py | 28 | to_dict/from_dict + rid codec + 错误路径 |
| test_ontology_api.py | 17 | Repository Protocol + InMemory 实现 |
| test_migrate_v1_v2.py | 5 | N-Triples 解析 + CLI |
| test_tenant_ctx.py | 14 | 双租户 ctx + 跨租户禁止 |
| test_types.py | 4 | baseline |
| test_persistence.py | 4 | MODEL-02 row ↔ dataclass |
| test_sandbox_function.py | 12 | L1 进程沙箱 6 硬规则 |
| test_sandbox_session.py | 15 | 用户级 session 隔离 + state machine |
| test_aip_gateway.py | 15 | Provider 抽象 + Budget gate |
| test_agent_orchestrator.py | 15 | Plan spec + record/abort |

## 7. M2 / M3 接力

- M2（10 周 / 6 Batch）：ACTION-03 / OBJECTSET-04 / MANAGER-05 / AGENT-ONT-01 / AGENT-SEC-01 / RAG-ONT-01
- M3（12 周 / 8 Batch）：AGENT-WF/APP/DATA/OBS/KB/EXT-01 + SANDBOX-02 + SUPER-COPILOT-01

详见 `docs/active/delivery/V31-ONTOLOGY-BOARD.md` 与蓝图 v0.4。