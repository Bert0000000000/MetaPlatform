# M3 ACCEPTANCE — v3.1 Ontology / 数字员工 / SuperAI（M3 收口）

> 起草：2026-08-06 · 状态：**M3 Accepted**
> 关联：ADR-0021（Kernel 12 基元）/ ADR-0040-0041（沙箱）/ ADR-0021 + 决策 B1/B2/B3/C1/C2/C3
> Worktree：`.worktrees/mp-ont-kernel-01`，分支 `refactor/mp-ont-kernel-01`
> 前置：M1 + M2 Accepted（267/267 tests pass）→ 本次 +97 → **364/364 tests pass**

## 1. 范围

M3 = 12 周 8 Batch：把 7 内置数字员工 + 第三方适配层 + 沙箱升级 + SuperAI 编排平面收口，
形成 v3.1 Ontology / 数字员工 / SuperAI 子计划的 **GA-Ready 雏形**。

不在 M3 范围：v4 runtime（HTTP / K8s / PG / Keycloak 真集成）—— 见 `V31-ONTOLOGY-BOARD.md` v4 部分。

## 2. 8 Batch 交付清单

| Batch | 状态 | tests | 关键交付 |
|---|---|---|---|
| **AGENT-WF-01** | ✅ Accepted | 11 | Workflow 数字员工：FlowDefinition / NodeKind(START/ACTION/GATEWAY/WAIT_USER/END) + state machine + 调 ActionService.apply + Manager.track + abort |
| **AGENT-APP-01** | ✅ Accepted | 11 | App 数字员工：AppDefinition + PageManifest（list/detail/form/dashboard）+ Slot(FIELD/TABLE/LINK/ACTION_BUTTON/CHART) + build_crud_app 开箱即用 |
| **AGENT-DATA-01** | ✅ Accepted | 10 | Data Product 数字员工：DataProduct + QualitySummary（completeness/freshness/row_count/uniqueness）+ LineageEdge 双向 link + 质量告警 |
| **AGENT-OBS-01** | ✅ Accepted | 12 | OBS 数字员工：AlertRule + 6 Comparator + AlertEvent(firing/resolved) + 触发 ActionType.apply 自愈 + DashboardSpec |
| **AGENT-KB-01** | ✅ Accepted | 9 | KB 数字员工：KbDocument + class-link 反向索引 + combined_retrieve 与 RAG-ONT 联合 |
| **AGENT-EXT-01** | ✅ Accepted | 12 | External Agent：HTTP/MCP/A2A 三协议 + Capability 声明 + L3 MicroVM 强制（B1）+ MockMicroVMRunner + ExtInvocation |
| **SANDBOX-02** | ✅ Accepted | 11 | K8s Job Sandbox：ResourceLimits + NetworkPolicy（默认 deny-egress）+ JobPhase + SandboxResult + InMemoryK8sRunner |
| **SUPER-COPILOT-01** | ✅ Accepted | 21 | SuperAI 编排平面：IntentRouter（自然语言→AgentRole） + HitlTokenStore（B2 短期 token） + AuditRetention（C3 discard/7d） + SuperAICopilot（submit/confirm/abort） |
| **合计** | **8/8 Accepted** | **97/97 pass** | — |

累计 M1 + M2 + M3 = **364/364 tests pass**。

## 3. 模块树（M3 终态）

```
mate-kernel/src/mate_kernel/
├── agent/                              # M1+M2+M3 数字员工 + 编排
│   ├── orchestrator.py                 # M1: SuperAI Plan 解析
│   ├── ontology.py                     # M2: Ontology 员工
│   ├── security.py                     # M2: Security 员工
│   ├── workflow.py                     # M3: Workflow 员工（NEW）
│   ├── app.py                          # M3: App 员工（NEW）
│   ├── data_product.py                 # M3: Data Product 员工（NEW）
│   ├── obs.py                          # M3: OBS 员工（NEW）
│   ├── kb.py                           # M3: KB 员工（NEW）
│   ├── external.py                     # M3: 外部 Agent + L3 沙箱（NEW）
│   └── copilot.py                      # M3: SuperAI 编排平面（NEW）
├── sandbox/                            # M1+M3 沙箱
│   ├── function.py                     # M1: L1 进程沙箱
│   ├── session.py                      # M1: 会话沙箱
│   └── k8s.py                          # M3: K8s Job 沙箱（NEW）
├── action/                             # M2
├── objectset/                          # M2
├── manager/                            # M2
├── rag/                                # M2
├── ontology/                           # M1
└── aip/                                # M1
```

## 4. 13 硬规则对位（M3 全 Batch）

| # | 硬规则 | 实施收口 |
|---|---|---|
| 1 | Swagger 没有接口，不写 route | M3 仍 library（runtime 在 v4） |
| 2 | PRD 没有 Requirement ID | 内部 API 各挂 FR-ONT-M3-* |
| 3 | **没有 tenant 上下文，不访问 repository** | MANAGER-05 + AGENT-SEC-01 复用 |
| 4 | 外部系统没有 ACL Client | AGENT-EXT-01 强制 L3 MicroVM；SANDBOX-02 默认 deny-egress |
| 5 | Production profile 禁止 fallback | NullChangeSink / NullAgentInvoker / InMemoryK8sRunner 全部显式标注 |
| 6 | 静态检查失败不合并 | stdlib only，零 type 错误 |
| 7 | **契约或集成测试跳过不标记 Accepted** | **364/364 tests pass，0 skip** |
| 8 | 没有 K8s readiness + 回滚 | SANDBOX-02 提供 K8s Job 抽象 + JobPhase 状态机 |
| 9 | 没有审计、指标、trace | AuditRetention（C3 7d opt-in）+ SandboxResult.o11y_trace_id hook |
| 10 | 所有状态以验收证据为准 | 本 ACCEPTANCE.md + M1 + M2 + KERNEL-01 |
| 11 | helm-docs 同步 | N/A |
| 12 | Secret 不进 git | 代码无 secret；API key 仅占位（ref 形式） |
| 13 | NetworkPolicy 缺失 = prod 不通过 | SANDBOX-02 NetworkPolicy.egress_allow_cidrs 默认空 → deny-egress |

## 5. 7+1 数字员工全景（M3 终态）

```
                        ┌──────────────────┐
                        │   SuperAI (M3)   │  ← COPILOT 编排平面
                        │   copilot.py     │
                        └────────┬─────────┘
                                 │ IntentRouter
              ┌──────┬──────┬─────┴─────┬──────┬──────┬──────┐
              ▼      ▼      ▼           ▼      ▼      ▼      ▼
        ┌──────┐┌──────┐┌──────┐  ┌──────┐┌──────┐┌──────┐┌──────┐
        │ ONT  ││ WF   ││ APP  │  │ DATA ││ OBS  ││ SEC  ││ KB   │  M2+M3
        │ology ││      ││      │  │ Prod ││      ││      ││      │
        └──────┘└──────┘└──────┘  └──────┘└──────┘└──────┘└──────┘
                                                          +
                                              ┌──────────────────┐
                                              │ EXT Agent (M3)   │  ← Marketplace
                                              │ 强制 L3 MicroVM  │
                                              └──────────────────┘
```

7 内置 + N 第三方 全部由 AgentSelector 按 rid 前缀路由（`ont.*` / `wfe.*` / `app.*` / `data.*` / `obs.*` / `sec.*` / `kb.*`）。

## 6. 测试覆盖（M3 全 Batch）

```bash
cd packages/mate-kernel
python -m pytest tests/ -v
# 364 passed in ~4s
```

| 测试文件 | tests | 覆盖 |
|---|---|---|
| test_agent_workflow.py | 11 | FlowDefinition 校验 + 调度 ACTION + WAIT_USER 暂停 + abort + Manager.track |
| test_agent_app.py | 11 | AppDefinition/PageManifest/Slot + build_crud_app + action_button 提取 |
| test_agent_data.py | 10 | DataProduct 注册 / for_class 反向索引 / lineage 边 / quality_alerts 阈值 |
| test_agent_obs.py | 12 | AlertRule 注册 + 6 Comparator 评估 + resolve_all + 触发 ActionType.apply |
| test_agent_kb.py | 9 | KbDocument tokens + for_class 反向索引 + class-link 优先 + combined_retrieve |
| test_agent_external.py | 12 | L3 强制 + capability 声明 + SandboxRunner + invoke ok/fail/disabled |
| test_sandbox_k8s.py | 11 | ResourceLimits 校验 + NetworkPolicy 默认 deny + JobPhase + SandboxResult |
| test_copilot.py | 21 | IntentRouter 7+N 路由 + HitlToken 校验/过期/consume + AuditRetention + Copilot submit/confirm/abort |

## 7. v3.1 20 Batch 路线收尾

| 里程碑 | Batch 数 | 状态 |
|---|---|---|
| M1 (8 周 / 6 Batch) | KERNEL-01 / MODEL-02 / SANDBOX-01 / SESSION-01 / AIP-GATEWAY-01 / AGENT-ORCH-01 | **Accepted** |
| M2 (10 周 / 6 Batch) | ACTION-03 / OBJECTSET-04 / MANAGER-05 / AGENT-ONT-01 / AGENT-SEC-01 / RAG-ONT-01 | **Accepted** |
| M3 (12 周 / 8 Batch) | AGENT-WF/APP/DATA/OBS/KB/EXT-01 + SANDBOX-02 + SUPER-COPILOT-01 | **Accepted** |
| **合计** | **20 / 20 Batch Accepted** | **364 / 364 tests pass** |

## 8. v4 runtime 路线（仅规划）

不在 v3.1 收口范围；M3 后启：
- HTTP / OpenAPI v2 完整路由（基于 M1 ont.yaml +23 端点扩展）
- K8s 真集成（替换 InMemoryK8sRunner）
- PG 持久化（替换 InMemoryOntologyRepository）
- Keycloak 真接入（替换 _ctx 占位；复用 SEC-IAM-01）
- Marketplace 上架流程（CAPABILITY 签名 + vendor 注册）
- v0.5 任务：补抓 Palantir 官方 7 个核心页正文，替换"可证伪"行

详见 `docs/active/delivery/V31-ONTOLOGY-BOARD.md`。
