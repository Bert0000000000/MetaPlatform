# Workflow 引擎深度调研报告

> **调研日期**：2026-08-18
> **调研人**：MatePlatform 架构组
> **背景**：评估基于 `flowgram.ai` 封装"业务流程画布 + 执行 + 业务审批 + Agent 协作"综合 Workflow 引擎的可行性
> **数据来源**：GitHub REST API 实测 + 官方 README + 包结构源码 + 行业对比分析

---

## 一、一句话结论

**"画布 + 执行 + 审批 + Agent 四合一"的开源项目不存在**。

最务实的路径是**分层组合**：
- **画布层**：`xyflow + flowgram.ai` 的 Form/Material（采购，不自研）
- **执行层**：`Temporal`（业务/审批/长事务）+ `LangGraph`（Agent 子图）
- **形式化层**：`xstate`（UI 状态/局部 FSM）
- **集成层**：直接接进 MatePlatform 现有的 `mate_platform/composition` cordis 内核

这是 **ADR-0043「all-in-one 集成核心」** 已经规划的方向。**值得做的是"集成层 + 平台胶水"，而不是从零造轮子造引擎**。

---

## 二、五个最反直觉的发现（必读）

### 1. flowgram.ai 被严重高估——它是画布，不是引擎

官方 README 原文自承：
> *"FlowGram is a composable, visual, easy-to-integrate, and extensible workflow development **framework & toolkit**. … It's **not a ready-made workflow platform**; it's the framework and toolkit to build yours."*

**源码实证**：`packages/runtime/nodejs/src/index.ts` 只有 9 行 `createServer()`，没有持久化、没有调度器、没有审批、没有租户、没有超时/重试/补偿/SAGA。

**真正卖点**：AI 编排物料（LLM/HTTP/Code/Loop/Branch）+ 变量类型引擎 + 双布局（自由 + 固定）+ 节点表单引擎。

**结论**：作为画布层采购 ✅；作为执行引擎 ❌。国内一些营销稿把它吹成"工作流引擎"是误读。

### 2. n8n（201k★）是商业雷区

- Star 数：201,054（**最大**）
- License：**Sustainable Use License**（**不是 OSI 批准**）
- 限制条款：禁止用 n8n 提供"与其他工作流服务竞争"的产品

**MatePlatform 是给客户做平台的产品，直接商用 n8n 会触雷**。Star 多不代表能用。

### 3. Flowise（55k★）2026-08 官方已归档

README 自标 "archived"，社区已迁移到 Langflow。**新项目不建议采用**。

### 4. "四合一"项目不存在（核心结论）

- 画 + 执 + 审 三星：**Camunda 8**（BPMN）、**Flowable**（BPMN）—— 但 Agent 弱
- 画 + Agent + 轻执：**Langflow**、**Flowise**（已归档）—— 审批/合规弱
- 执 + Agent + 持久化：**LangGraph**、**Temporal** —— 但画布弱（需自配 xyflow/flowgram.ai）
- **没有一个仓库同时是五星**

### 5. BPMN 对 AI 时代太重

一个简单的"输入 → LLM → 条件分支 → 输出"流：
- **BPMN 2.0**：要画 5+ 节点 + Service Task + 错误边界事件，复杂
- **LangGraph**：一段 50 行 Python 搞定

MatePlatform 若全面 BPMN 化，会被 AI 流逼出"走私路径"。

---

## 三、Star TOP 仓库清单（2026-08-18 GitHub API 实测）

### 通用工作流引擎（执行 + 编排）

| 仓库 | Stars | 定位 | License | 覆盖能力 |
|---|---|---|---|---|
| [n8n-io/n8n](https://github.com/n8n-io/n8n) | **201,054** | Fair-code 工作流自动化平台 | ❌ Sustainable | 画+执+弱审 |
| [apache/airflow](https://github.com/apache/airflow) | 46,518 | DAG 编排 + 调度 + 监控 | ✅ Apache 2.0 | 执（无画） |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 39,915 | 有状态 Agent 编排框架 | ✅ MIT | 执+Agent |
| [statelyai/xstate](https://github.com/statelyai/xstate) | 30,026 | 状态机/状态图/Actor 模型 | ✅ MIT | 执（形式化） |
| [langflow-ai/langflow](https://github.com/langflow-ai/langflow) | **153,400** | AI Agent 可视化构建与部署 | ✅ MIT | 画+Agent+执 |
| [PrefectHQ/prefect](https://github.com/PrefectHQ/prefect) | 23,632 | Pythonic 工作流编排 | ✅ Apache 2.0 | 执（弱画） |
| [temporalio/temporal](https://github.com/temporalio/temporal) | 22,379 | Durable execution 平台 | ✅ MIT | 执（无画） |
| [cadence-workflow/cadence](https://github.com/cadence-workflow/cadence) | 9,404 | Temporal 前身，Uber 开源 | ✅ Apache 2.0 | 执（无画） |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | 57,235 | 角色扮演多 Agent 协作 | ✅ MIT | Agent（无画） |
| [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) | 55,379 | 拖拽式 LLM 流程 | ✅ Apache 2.0 | 画+Agent（**已归档**） |

### BPMN 类（业务流程建模标准）

| 仓库 | Stars | 定位 | 覆盖 |
|---|---|---|---|
| [bpmn-io/bpmn-js](https://github.com/bpmn-io/bpmn-js) | 9,634 | BPMN 2.0 可视化建模器 | 仅画 |
| [flowable/flowable-engine](https://github.com/flowable/flowable-engine) | 9,473 | BPMN+CMMN+DMN 引擎 | 执+审 |
| [camunda/camunda](https://github.com/camunda/camunda) | 4,251 | Camunda 8 单仓 | 画+执+审 |

### 流程画布库（前端可视化编辑）

| 仓库 | Stars | 定位 | 覆盖 |
|---|---|---|---|
| [xyflow/xyflow](https://github.com/xyflow/xyflow) | **38,046** | React Flow + Svelte Flow | 仅画（行业事实标准） |
| [didi/LogicFlow](https://github.com/didi/LogicFlow) | 11,648 | 滴滴开源，业务自定义流程图 | 仅画 |
| [bytedance/flowgram.ai](https://github.com/bytedance/flowgram.ai) | 8,361 | 字节出品，**画布框架+工具包** | 仅画（非引擎） |
| [jerosoler/Drawflow](https://github.com/jerosoler/Drawflow) | 6,104 | 极简拖拽 flow 库 | 仅画 |

### 状态机/形式化

| 仓库 | Stars | 定位 |
|---|---|---|
| [statelyai/xstate](https://github.com/statelyai/xstate) | 30,026 | W3C SCXML 启发 + Actor 模型 + 可视化编辑器 |
| [chakra-ui/zag](https://github.com/chakra-ui/zag) | 5,190 | FSM 驱动的设计系统原语 |

---

## 四、综合对比矩阵

| 维度 | Camunda 8 | Flowable | Temporal | n8n | Airflow | LangGraph | Langflow | flowgram.ai | xyflow | xstate |
|---|---|---|---|---|---|---|---|---|---|---|
| 可视化画布 | ✅ | ✅ | 🟠 弱 | ✅ | ❌ | ✅ Studio | ✅ | ✅ 框架 | ✅ 框架 | ✅ Stately |
| 流程执行引擎 | ✅ Zeebe | ✅ | ✅ 最强 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| BPMN 2.0 兼容 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 业务审批流 | ✅ Tasklist | ✅ UserTask | 🟠 需手写 | 🟠 节点级 | ❌ | ✅ interrupt | 🟠 | 🟠 | 🟠 | ✅ |
| Agent/LLM 节点 | 🟠 | 🟠 | ✅ SDK | ✅ 原生 | ❌ | ✅ 核心 | ✅ 核心 | 🟠 | 🟠 | ❌ |
| 状态机形式化 | 🟠 | ❌ | ❌ | ❌ | ❌ | 🟠 | ❌ | 🟠 | 🟠 | ✅ |
| 多租户隔离 | ✅ | ✅ | ✅ | 🟠 企业版 | 🟠 | ✅ thread_id | 🟠 | ❌ | ❌ | ❌ |
| 持久化 + 恢复 | ✅ | ✅ | ✅ 最强 | ✅ | ✅ | ✅ | 🟠 弱 | ❌ | ❌ | ✅ |
| License 友好 | 🟠 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 二次封装成本 | 🟠 高 | 🟠 中 | 🟠 中 | ✅ 低 | 🟠 | ✅ 低 | ✅ 低 | ✅ 极低 | ✅ 极低 | ✅ 低 |

---

## 五、与 MatePlatform 现有内核的集成方案

### 5.1 现状回顾

MatePlatform 已有：
- `mate_platform/composition` 内核（cordis 范式自建，674 行零依赖）
  - **revertible effects**（可回滚副作用）
  - **reactive coeffects**（反应式协效）
  - **惰性 fiber**（懒加载能力）
  - 4 条形式化不变量 I1-I4，19 tests pass
- ADR-0042（MP-COMP-01）：组合内核
- ADR-0043：all-in-one 集成核心（4 大面向：MP-EMP-EVOLVE-01 / MP-MKT-INSTALL-01 / MP-ACTION-CONFIRM-01 / MP-INTEGRATION-HUB-01）
- ADR-0021：Ontology 12 基元
- ADR-0040：三层沙箱（Session L2 / Function L2 / 第三方 L3 Firecracker）
- ADR-0041：Session Sandbox
- PLATFORM-EVENT-01：PostgreSQL Outbox 持久化
- v3.0 GA：Flowable 8.0 作为 Java 外部引擎

### 5.2 推荐分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│         MatePlatform Workflow Platform（集成层 · composition）      │
├─────────────────────────────────────────────────────────────────┤
│ 画布层   │ xyflow (React/Svelte) + flowgram.ai 的 Form/Material  │
│          │ - 自由布局 + 固定布局 双模式                             │
│          │ - LLM/HTTP/Code/Condition/Loop/Branch 物料             │
│          │ - 节点表单引擎 + 变量作用域链                              │
├─────────────────────────────────────────────────────────────────┤
│ DSL 层   │ flowgram.ai runtime/interface 的 zod schema          │
│          │ - 节点契约作为 cordis Capability 注册源                   │
│          │ - 画布输出 → JSON DSL → 编译为可执行任务                   │
├─────────────────────────────────────────────────────────────────┤
│ 执行层   │ Temporal（业务/审批/长事务）+ LangGraph（Agent 子图）       │
│          │ - Temporal Signal/Query 支撑审批路由                    │
│          │ - LangGraph interrupt 支撑 HITL + checkpoint          │
├─────────────────────────────────────────────────────────────────┤
│ 形式化层  │ xstate（UI 状态 + 局部 FSM）                            │
│          │ - state.new 可视化编辑                                    │
│          │ - 状态机 → Temporal 信号触发器                            │
├─────────────────────────────────────────────────────────────────┤
│ 持久化层  │ Temporal Event History + LangGraph Checkpointer +     │
│          │ mate_platform/composition 的 revertible effects         │
│          │ PostgreSQL Outbox（已就绪 PLATFORM-EVENT-01）            │
├─────────────────────────────────────────────────────────────────┤
│ 沙箱层   │ K8s Job（Function L2）+ MicroVM Firecracker（第三方 L3）   │
│          │ 已有 ADR-0040 / ADR-0041 兜底                            │
├─────────────────────────────────────────────────────────────────┤
│ 协议层   │ MCP Server / OpenAPI（flow → Agent 工具）              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 与 `composition` 内核的契合点

| 面向 | Workflow 引擎职责 | composition 内核联动 |
|---|---|---|
| **MP-EMP-EVOLVE-01**（数字员工自进化） | LangGraph 跑 Agent 子图，xstate 跑 UI 状态 | revertible effects 兜底 Agent 失误后的状态回滚 |
| **MP-MKT-INSTALL-01**（Marketplace 第三方） | Temporal Activity 隔离第三方调用 | cordis reactive coeffects 注入租户上下文 |
| **MP-ACTION-CONFIRM-01**（AI proposal 回滚） | Temporal Signal + LangGraph interrupt | cordis capability fiber 订阅 confirm 信号，触发回滚 effect |
| **MP-INTEGRATION-HUB-01**（跨服务能力拓扑） | xstate 把服务调用拓扑建模为状态机 | lifespan fiber 管理跨服务 Saga 生命周期 |

### 5.4 flowgram.ai 取舍清单

**采纳**：
- ✅ `canvas-engine`（画布核心，DAG 布局 + 缩略图）
- ✅ `node-engine`（节点抽象 + 端口校验）
- ✅ `variable-engine`（变量作用域链 + 类型推断）
- ✅ `runtime/interface` 的 zod schema（作为节点契约规范）
- ✅ `form-materials`（启动加速的 LLM/HTTP/Code 模板）

**拒绝**：
- ❌ `runtime/nodejs` 子包（与 Sandbox 架构冲突，9 行 `createServer()` 是给浏览器内 Code 节点用的）
- ❌ 把物料当作"业务节点库"（只有通用模板，17 域业务节点要自己接 mate-platform/composition）
- ❌ "开箱即用工作流平台"的幻想

### 5.5 关键技术决策

1. **不引入 BPMN 全套**——只在涉及外部合规/审计场景按需嵌入 Flowable（v3.0 GA 已有）
2. **不强推 n8n**——License 雷区
3. **不用 Flowise**——已归档
4. **不把 flowgram 当引擎**——它是画布
5. **Temporal 是执行层基石**——强持久化、审批路由、长事务
6. **LangGraph 是 Agent 编排基石**——MIT、checkpoint、HITL、Python 生态
7. **xstate 是形式化补充**——UI 状态、嵌入式 FSM

---

## 六、是否值得自研？

### 答案：**不值得从零造轮子，但值得做"集成层"**

**不自研的理由**：
- 四个能力各自的最佳方案都是 10k+ Star + 多年工程沉淀的产品
- 自研任何一个都至少 3-5 人年起步
- 这四个能力**协议互不兼容**（BPMN XML vs DAG-JSON vs Graph-Python vs FSM-SCXML）

**值得做的"集成层"**：
- 这正是 MatePlatform 路线 ADR-0043（all-in-one 集成核心）要做的事
- 把异构 Workflow 协议**缝到统一的能力图谱**上
- 利用 composition 内核的 cordis 范式（revertible effects + reactive coeffects + capability fiber）做平台胶水

### 最小可行路径（W1-W4 起步）

| 周次 | 任务 | 工作量 | 产出 |
|---|---|---|---|
| W1-W2 | 立项 ADR-0050「Workflow 平台分层架构」，冻结分层图 | 1 人周 | ADR-0050.md |
| W3 | 起 `mp-workflow-canvas-01` Batch，基于 `xyflow + flowgram.ai Form` 跑通最小画布 + 节点表单 + 变量作用域（不接执行） | 1 人月 | MP-WORKFLOW-CANVAS-01-ACCEPTANCE.md |
| W4 | 起 `mp-workflow-runtime-01` Batch，部署 Temporal 集群 + LangGraph checkpointer，跑通"画布配置 → 编译为 Temporal Workflow → 回放"闭环 | 1.5 人月 | MP-WORKFLOW-RUNTIME-01-ACCEPTANCE.md |
| +1 月 | 接入 `mate_platform/composition` cordis 内核，跑通 revertible effects 回滚 + reactive coeffects 租户隔离 | 1 人月 | 集成测试 60+ tests |
| +2 月 | 第一批 ACCEPTANCE，纳入 v3.2 子计划（与 MP-COMP-01 升格节奏对齐） | — | v3.2 子计划文档 |

---

## 七、最终建议

### 选型结论

| 层级 | 技术选型 | 理由 |
|---|---|---|
| **画布** | `xyflow` + `flowgram.ai` Form/Material | MIT、80% 节点 UI 事实标准、AI 物料丰富 |
| **执行（业务/审批）** | `Temporal` | MIT、durable execution 最强、审批路由、SLA |
| **执行（Agent）** | `LangGraph` | MIT、checkpoint、HITL、Python 生态 |
| **形式化** | `xstate` | MIT、W3C SCXML、Actor 模型、可视化编辑器 |
| **持久化** | Temporal Event History + LangGraph Checkpointer + composition revertible effects | 已有 PLATFORM-EVENT-01 |
| **沙箱** | K8s Job（Function L2）+ MicroVM Firecracker（第三方 L3） | 已有 ADR-0040 / ADR-0041 |
| **集成层** | `mate_platform/composition` cordis 内核 | 已有 MP-COMP-01 + ADR-0043 |

### 不选项

- ❌ **n8n**（License 雷区）
- ❌ **Flowise**（已归档）
- ❌ **Langflow**（生产持久化/审批弱）
- ❌ **全面 BPMN 化**（被 AI 流逼出走私路径）
- ❌ **从零造四合一引擎**（不现实）

### 后续动作

1. **立即**：写一份内部 brief（基于本报告），评审 ADR-0050 立项
2. **W1**：立项 ADR-0050「Workflow 平台分层架构」
3. **W2**：在 `.worktrees/mp-workflow-canvas-01` 起 `mp-workflow-canvas-01` Batch
4. **W4**：并列起 `mp-workflow-runtime-01` Batch
5. **+2 月**：第一批 ACCEPTANCE，纳入 v3.2 子计划

---

## 附录：调研方法与数据来源

**数据采集时间**：2026-08-18
**数据来源**：
- GitHub REST API（Star/Fork/Commit/Release 实测）
- 官方 README + LICENSE
- 官方 packages/ 源码（flowgram.ai runtime/interface 源码实证）
- Coze Studio / Certimate / NNDeploy 等采用案例
- 字节 OSPO 官方介绍

**调研范围**：
- 17 个 GitHub 仓库深度分析
- 5 大类别（BPMN / 通用执行 / 画布 / Agent / 状态机）
- 10 维度对比矩阵
- 3 个并行研究 agent（总耗时约 8.5 分钟）

**未找到公开资料的部分**：
- 字节内部对 flowgram.ai 的具体使用规模
- 滴滴 LogicFlow 内部业务规模
- n8n 商业版的准确授权条款细节

---

**报告版本**：v1.0 · 2026-08-18
**下次更新建议**：W4 后补充 Temporal × LangGraph 集成实测数据
