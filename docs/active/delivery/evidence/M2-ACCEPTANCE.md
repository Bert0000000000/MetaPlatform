# M2 ACCEPTANCE — v3.1 Ontology / 数字员工 / SuperAI（M2 收口）

> 起草：2026-08-06 · 状态：**M2 Accepted**
> 关联：ADR-0021（Kernel 12 基元）/ ADR-0040-0041（沙箱）
> Worktree：`.worktrees/mp-ont-kernel-01`，分支 `refactor/mp-ont-kernel-01`
> 前置：M1 Accepted（174/174 tests pass）→ 本次 +93 → **267/267 tests pass**

## 1. 范围

M2 = 10 周 6 Batch：把 M1 的协议骨架升级为可执行的查询 / 决策 / 检索单元，串联起
KERNEL-01 的写入入口与数字员工之间的桥梁。

不在 M2 范围：M3（8 Batch / 12 周）—— AGENT-WF/APP/DATA/OBS/KB/EXT-01 + SANDBOX-02 + SUPER-COPILOT-01。

## 2. 6 Batch 交付清单

| Batch | 状态 | tests | 关键交付 |
|---|---|---|---|
| **ACTION-03** | ✅ Accepted | 14 | ActionType.apply 协议（submission_criteria / side_effects / 审计 / rollback hook / register_function） |
| **OBJECTSET-04** | ✅ Accepted | 31 | ObjectSet DSL 编译器（== / > / < / >= / startswith / contains / AND / OR / NOT / 括号 / 优先级） + InMemory executor + SQL 占位 |
| **MANAGER-05** | ✅ Accepted | 17 | Manager 协议（缓存 ClassRef/Version / 变更追踪 ChangeSink / 租户断言 / drain） |
| **AGENT-ONT-01** | ✅ Accepted | 11 | Ontology 数字员工（自然语言 → ObjectSet + 解释生成 + Manager 追踪） |
| **AGENT-SEC-01** | ✅ Accepted | 11 | Security 数字员工（跨租户 deny / Marking 校验 / 决策审计 R-TENANT-001 / R-MARK-001 / R-ALLOW-000） |
| **RAG-ONT-01** | ✅ Accepted | 9 | RAG-on-Ontology（按 Property 类型分权重索引 + ObjectSet 过滤 + token overlap 检索） |
| **合计** | **6/6 Accepted** | **93/93 pass** | — |

累计 M1 + M2 = **267/267 tests pass**。

## 3. 模块树（M2 终态）

```
mate-kernel/src/mate_kernel/
├── action/                         # ACTION-03
│   └── engine.py                   # ActionService / RuleEvaluator / apply/propose
├── objectset/                      # OBJECTSET-04
│   └── compiler.py                 # FilterCompiler / FilterEvaluator / Executor
├── manager/                        # MANAGER-05
│   └── protocol.py                 # Manager / ManagerContext / ChangeSink
├── agent/                          # AGENT-ONT-01 / AGENT-SEC-01
│   ├── orchestrator.py             # M1: SuperAI
│   ├── ontology.py                 # M2: 自然语言→ObjectSet
│   └── security.py                 # M2: 决策 / Marking / 跨租户
├── rag/                            # RAG-ONT-01
│   └── ontology.py                 # RagIndex / RagRetriever
└── （M1 所有模块保留）
    ├── ontology/{identity,types,instances,reasoning,query,serde,api,in_memory,persistence,tenant,migrate_v1_v2}.py
    ├── sandbox/{function,session}.py
    ├── aip/gateway.py
    └── ...
```

## 4. 13 硬规则对位（M2 全 Batch）

| # | 硬规则 | 实施收口 |
|---|---|---|
| 1 | Swagger 没有接口，不写 route | M2 仅 library（M3 runtime 阶段补 OpenAPI） |
| 2 | PRD 没有 Requirement ID | 内部 API operationId 各挂 FR-ONT-M2-*（库内不暴露 HTTP） |
| 3 | **没有 tenant 上下文，不访问 repository** | MANAGER-05 assert_same_tenant + 17 tests |
| 4 | 外部系统没有 ACL Client | M2 全部 in-memory，无外部访问 |
| 5 | Production profile 禁止 fallback | runtime 显式标注（NullChangeSink / InMemoryRagIndex） |
| 6 | 静态检查失败不合并 | stdlib + dataclass + enum，零 type 错误 |
| 7 | **契约或集成测试跳过不标记 Accepted** | **267/267 tests pass，0 skip** |
| 8 | 没有 K8s readiness + 回滚 | M2 仅 library |
| 9 | 没有审计、指标、trace | MANAGER-05 ChangeSink + AGENT-SEC-01 SecurityDecision.decided_at |
| 10 | 所有状态以验收证据为准 | 本 ACCEPTANCE.md + M1 ACCEPTANCE.md + KERNEL-01 ACCEPTANCE.md |
| 11 | helm-docs 同步 | N/A（M2 无 helm chart） |
| 12 | Secret 不进 git | 代码无 secret |
| 13 | NetworkPolicy 缺失 = prod 不通过 | N/A（M2 仅 library） |

## 5. 串联验证（M1 → M2 数据流）

```
[user] → Manager(user, tenant, session)
       → OntologyAgent.handle(query)
            → SimpleQueryPlanner.plan → ObjectSet
            → Manager.track(SNAPSHOT_VERSION)
       → SecurityAgent.decide(tenant, marking)
       → ActionService.apply(submission_criteria, function_ref, ...)
            → Function ref 注册 → 业务函数
            → ApplyOutcome（audit_id / side_effects）
       → RagRetriever.retrieve(ObjectSet, text)  // 上下文注入
```

## 6. 测试覆盖（M2 全 Batch）

```bash
cd packages/mate-kernel
python -m pytest tests/ -v
# 267 passed in ~4s
```

| 测试文件 | tests | 覆盖 |
|---|---|---|
| test_action_engine.py | 14 | RuleEvaluator + ActionService.apply/propose/rollback/audit |
| test_objectset_compiler.py | 31 | FilterCompiler DSL + FilterEvaluator + InMemory executor + SQL 占位 |
| test_manager_protocol.py | 17 | Manager 缓存/追踪/租户断言/drain/limit |
| test_agent_ontology.py | 11 | 自然语言→ObjectSet + 解释 + 经理追踪 |
| test_agent_security.py | 11 | 跨租户 + Marking + 审计 + check_action_apply 封装 |
| test_rag_ontology.py | 9 | 索引 / 类型权重 / ObjectSet 过滤 / token overlap / top_k |

## 7. M3 接力

- M3（12 周 / 8 Batch）：AGENT-WF-01 / AGENT-APP-01 / AGENT-DATA-01 / AGENT-OBS-01
  / AGENT-KB-01 / AGENT-EXT-01 / SANDBOX-02 / SUPER-COPILOT-01

详见 `docs/active/delivery/V31-ONTOLOGY-BOARD.md` 与蓝图 v0.4。
