# Workflow 引擎统一架构（Mirror + Builder）

> **2026-08-18 用户关键补充**：MetaPlatform 平台本身有"快速搭建应用"的场景，因此 Workflow 引擎必须**同时**支持：
>
> **场景 A（Mirror Mode）**：业务系统已存在 → Workflow 镜像 + 合规检测
> **场景 B（Builder Mode）**：用户用 MetaPlatform 直接搭建应用 → Workflow 自己执行
>
> 两个场景**共享** DSL、UI、持久化层，但**runtime 语义不同**。

---

## 1. 两种模式的核心差异

| 维度 | Mirror Mode（场景 A） | Builder Mode（场景 B） |
|---|---|---|
| **驱动力** | 业务系统驱动 | Workflow 驱动 |
| **节点执行** | 业务系统跑完 → Kafka 通知 → Workflow 镜像 | Workflow 调 Activity 自己执行 |
| **业务节点** | 镜像（混合：观察 / 订阅 / 偶尔调 API） | 真正执行（自定义 Activity / Python 函数） |
| **审批节点** | Flowable 独立 → Kafka 回调 → Workflow 镜像 | Flowable 独立 → Kafka 回调（流程推进）|
| **Agent 节点** | Agent 独立 loop → 事件回流 | Workflow 跑 loop（in-loop HITL）|
| **Conformance** | 设计 vs 实际 = 主要价值 | 仍然适用（防止自定义 Activity 跑偏）|
| **快速搭建** | N/A | **核心能力**（低代码 + 流程 + Form）|

---

## 2. 共享层 + 模式层 + 横切层

```
┌─────────────────────────────────────────────────────────────┐
│              MatePlatform Workflow Engine                    │
├─────────────────────────────────────────────────────────────┤
│              共享层 (Shared Layer)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ DSL      │  │ UI 画布  │  │ 持久化    │  │ 调度框架 │   │
│  │ pydantic │  │ xyflow   │  │ PG Event │  │ composition│ │
│  │          │  │ +flowgram│  │ Store    │  │ cordis    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│              模式层 (Mode Layer) — 二选一                     │
│  ┌──────────────────────┐    ┌──────────────────────┐       │
│  │  Mirror Mode         │    │  Builder Mode        │       │
│  │  (镜像 + 合规检测)    │    │  (快速搭建应用)       │       │
│  │                      │    │                      │       │
│  │ - Event Ingest       │    │ - Activity 执行器    │       │
│  │ - State Mirror       │    │ - Form 引擎          │       │
│  │ - Conformance Check  │    │ - 自定义 UI 渲染      │       │
│  │ - 偏差告警            │    │ - Workflow 自执行    │       │
│  └──────────────────────┘    └──────────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│              横切层 (Cross-Cutting)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 多租户    │  │ 权限/审计 │  │ 可观测     │  │ Agent    │   │
│  │ Tenant   │  │ Audit    │  │ OTel     │  │ HITL loop│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 节点类型 → 模式对位

| 节点类型 | Mirror Mode | Builder Mode |
|---|---|---|
| **业务状态节点** | 镜像（观察业务系统事件）| 自执行（调自定义 Activity）|
| **审批节点** | Flowable 独立 → 镜像 | Flowable 独立 → 流程推进 |
| **Agent 节点** | Agent loop 独立 → 镜像 | Workflow 跑 in-loop HITL |
| **Form 节点** | 显示外部业务系统的状态 | 自定义表单收集用户输入 |
| **Timer 节点** | 镜像外部系统的定时事件 | 自执行延时 |
| **Conformance 节点** | 检查是否符合设计流程 | 检查自定义 Activity 是否跑偏 |

---

## 4. 数据流（统一视角）

### Mirror Mode 数据流

```
业务系统 (ERP/CRM)  ─事件→  Kafka  ─订阅→  Event Ingest
                                              ↓
                                        State Mirror
                                              ↓
                                        Conformance Check
                                              ↓
                                        MetaPlatform Dashboard
                                              ↓
                                        偏差告警 / 审计报告
```

### Builder Mode 数据流

```
用户设计 (xyflow 画布)
       ↓
   Workflow DSL (pydantic)
       ↓
   部署 → Workflow 实例启动
       ↓
   ┌─ 业务状态节点 → 自定义 Activity (Python 函数) ─┐
   ├─ 审批节点 → 调 Flowable REST → Kafka 回调 ────┤
   ├─ Agent 节点 → in-loop HITL ──────────────────┤
   └─ Timer 节点 → PG pg_cron ─────────────────────┘
       ↓
   Event Store (PG)
       ↓
   MetaPlatform Dashboard
```

---

## 5. 关键技术决策

### 决策 1：DSL 统一还是分裂？

**统一**（推荐）：Mirror 和 Builder 用同一套 DSL
- 节点类型相同（业务状态、审批、Agent、Form、Timer）
- 区别在 runtime 行为：镜像 vs 自执行
- 通过节点属性 `execution_mode: "mirror" | "builder"` 区分

### 决策 2：Workflow 实例的生命周期？

- Mirror Mode：实例生命周期 = 业务事件触发 + 业务完成
- Builder Mode：实例生命周期 = Workflow DSL 启动 + 完成 / 取消 / 超时

### 决策 3：Conformance Checking 适用范围

- Mirror Mode：设计流程 vs 实际业务事件流
- Builder Mode：设计流程 vs 自定义 Activity 执行路径
- 两者的算法**可以复用**（都是 token replay / alignment）

### 决策 4：Flowable 集成方式

- **统一**：Mirror 和 Builder 都用"Flowable 独立 + Kafka 回调"
- 不调 Flowable REST，避免耦合
- Flowable Plugin 把事件发到 Kafka，Workflow 引擎订阅

### 决策 5：Agent Loop 集成方式

- **混合**：
  - Mirror Mode：Agent 独立 loop → 事件回流到 Workflow（用 Kafka）
  - Builder Mode：Workflow 引擎跑 loop（in-line HITL，借鉴 LangGraph Interrupt）

---

## 6. 优先级重排

| 优先级 | 内容 | 阶段 |
|---|---|---|
| **P0** | 共享层：DSL + UI + 持久化 | M0-M1 |
| **P0** | Mirror Mode：Event Ingest + State Mirror + Conformance | M1-M2 |
| **P0** | Conformance 算法（PM4Py / 自研）| M1-M2 |
| **P1** | Builder Mode：基础 Activity + Form | M2-M3 |
| **P1** | 审批节点（Flowable + Kafka） | M2 |
| **P1** | Agent Loop（Mirror 模式）| M2 |
| **P2** | Builder Mode：高级 UI 渲染 + 复杂应用 | M3+ |
| **P2** | Agent Loop（Builder 模式 in-loop）| M3 |
| **P3** | BPMN 转化层 | v3.3+ |

---

## 7. 借鉴清单（按模式分层）

| 借鉴 | Mirror Mode | Builder Mode |
|---|---|---|
| **Temporal Event Sourcing** | P0（核心）| P0（核心）|
| **Process Mining (PM4Py)** | **P0（核心）** | P2（参考）|
| **LangGraph BSP / Interrupt** | P2（Agent 镜像）| P0（in-loop HITL）|
| **xstate FSM** | P2（局部状态机）| P1（Builder 内部状态）|
| **flowgram 变量/物料** | P1（DSL 复用）| P0（Builder 表单引擎）|
| **xyflow 画布** | P0（共享）| P0（共享）|

---

## 8. 关键挑战

1. **DSL 双模式语义**：同一套 DSL 必须能表达"镜像"和"执行"两种语义
2. **Conformance 算法实现**：从 PM4Py 借鉴还是自研？算法本身有 30 年研究，但企业级实现复杂度高
3. **Flowable 双向同步**：Flowable 是审批 source of truth，Workflow 是镜像；两者必须最终一致
4. **Builder Mode 的应用边界**：哪些场景适合在 MetaPlatform 搭建？哪些必须用传统开发？

---

**下一步**：等用户确认这个统一架构是否正确，然后重写 master-synthesis.md