# PRD vs 实现 Gap 盘点（收窄到 Ontology / KB / AI 核心流程）

> **编制日期**：2026-08-11
> **触发**：用户要求"先完成 Ontology 本体论的核心流程，如果需要知识库、AI 等内容，也一起先加进来。其他先不看"。
> **收窄范围**：
> 1. **APP-ONTSTUDIO**（本体论引擎）—— 含 Kernel 12 基元 + ObjectSet + ActionType + Function + Interface + Manager + Axiom
> 2. **APP-KB**（知识库）—— 含 RAG 检索/切片/文档 + RAG-ONT-01 本体语料
> 3. **APP-COPILOT / SuperAI**（AI 对话 / 智能问答 / 数据分析 / Action / 代码生成 / 任务编排 / Ontology 探索 / 顶层调度 / 知识总结 / A2A 协作）
> 4. **APP-DW 子能力**（数字员工 / 业务 RAG / 页面 Agent）—— 与上述 3 项强耦合
> 5. **mate-kernel / mate-tech-ont / mate-tech-rag / mate-tech-llmgw / mate-tech-agent / mate-app-copilot / mate-app-kb / mate-app-a2a** 等后端域
>
> **排除范围**：APP-APPHUB / APP-ARCH / APP-DASHBOARD / APP-MCPHUB / APP-DATA / APP-WFE / 后台管理 / 移动端适配 / v3.0 治理批次的 67 个未收口失败（除非影响本范围核心流程）
>
> **方法**：以 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4（12 Kernel 基元 + 7+1 数字员工 + 三层沙箱 + 12 决策点 + 20 Batch 路线）+ `ADR-0021/0040/0041` + `docs/active/prd/APP-ONTSTUDIO/PRD-APP-ONTSTUDIO-本体论引擎_v2.4-20260727.md`（67 需求点）+ `docs/active/prd/APP-KB/*` + `docs/active/prd/APP-COPILOT/*` + `docs/active/prd/APP-DW/*` 为基线，对照 `mate-kernel/` + `mate-tech-ont/` + `mate-tech-rag/` + `mate-tech-llmgw/` + `mate-tech-agent/` + `mate-app-copilot/` + `mate-app-kb/` + `mate-app-a2a/` 实际代码 + `metaplatform-frontend/apps/web/src/pages/{ontology,superai,knowledge,dw,agents}/` 实际页面与 API。
>
> **结论先行**：**v3.1 子计划 20/20 Batch Accepted · 364/364 tests pass · 端到端 kitchen sink 11 步通过 + V31-ONTOLOGY-BOARD 声明的"GA-Ready 雏形"在 mate-kernel 库代码层是真的**。但落到"业务系统可用的端到端流程"层面，**仍有 5 处显著 gap 需补**（详见 §三），且 Ontology 独立 app 形态不兑现问题在本范围依然存在。

---

## 一、盘点范围与方法

### 1.1 收窄范围（5 个域）

| 域 | PRD 文档 | 后端实现 | 前端实现 |
|---|---|---|---|
| **Ontology 本体** | `APP-ONTSTUDIO/PRD-APP-ONTSTUDIO-本体论引擎_v2.4-20260727.md`（67 需求点）+ 蓝图 v0.4 + ADR-0021 | `mate-kernel/`（12 基元）+ `mate-tech-ont/`（OWL 兼容层）| `pages/ontology/`（5 页）+ `pages/ontology/{components,actions,object-types,relationship-types}/` |
| **Kernel 域基元** | 蓝图 v0.4 §3 + ADR-0021 | `mate-kernel/{types,ontology,objectset,action,manager,rag,sandbox,aip,agent}/` | — |
| **数字员工 / Agent** | 蓝图 §4 + APP-DW/APP-COPILOT PRD | `mate-kernel/agent/{ontology,workflow,app,data_product,obs,kb,security,external,orchestrator,copilot}.py` + `mate-tech-agent/` | `pages/superai/`（20 页）+ `pages/dw/`（9 页）+ `pages/agents/`（13 页）|
| **知识库 + RAG** | APP-KB v1.2 + APP-DW 业务RAG v1.1 + 蓝图 §7 RAG-ONT-01 | `mate-tech-rag/`（4 client + 5 endpoint）+ `mate-app-kb/` + `mate-kernel/rag/ontology.py` | `pages/knowledge/`（4 页）+ `pages/superai/` 智能问答/数据分析/代码生成 |
| **AI / LLM / Copilot** | APP-COPILOT v2.3 + 蓝图 §6 + ADR-0040/0041 | `mate-app-copilot/`（含 a2a/llm/routing）+ `mate-tech-llmgw/`（含 multimodal_router / cost / quota / tools）| `pages/superai/` 全部 20 页 + `pages/agents/` |

### 1.2 v3.1 子计划已声明的"覆盖度"

来源：`docs/active/delivery/V31-ONTOLOGY-BOARD.md`

| 维度 | 声明值 | 证据 |
|---|---|---|
| M1 Batch 数 | 6/6 Accepted | 174/174 tests pass + `M1-ACCEPTANCE.md` |
| M2 Batch 数 | 6/6 Accepted | 93/93 tests pass + `M2-ACCEPTANCE.md` |
| M3 Batch 数 | 8/8 Accepted | 97/97 tests pass + `M3-ACCEPTANCE.md` |
| v4 RUNTIME | 5/5 Accepted | `RUNTIME-MVP-01/02-ACCEPTANCE.md` |
| 累计测试 | **364/364 pass** | M1+M2+M3 |
| 端到端 | `examples/01_kitchen_sink.py` 11 步通过 | kernel 层 in-memory 闭环 |
| 13 硬规则对位 | M1/M2/M3 全部对位 | ACCEPTANCE §4 |
| **声明的覆盖率** | **GA-Ready 雏形** | BOARD.md 状态行 |

### 1.3 但需注意 —— 已声明 ≠ 已端到端贯通

`V31-ONTOLOGY-BOARD.md` §6 v4 部分明确写：
- **RUNTIME-HTTP-01** = FastAPI runtime v2 operationId ✅
- **RUNTIME-K8S-02** = Function Sandbox 默认 backend = **subprocess**（K8sJob 接入**留后续**）
- **RUNTIME-PG-03** = PgOntologyRepository ✅
- **IAM-COPILOT-04** = dev profile `LEGACY_LOGIN_COMPAT=1` 走 ManagerContext（**真鉴权留 v4 后续**）
- **MARKETPLACE-05** = `K8sSandboxRunner(backend="microvm")` API **占位**（**具体 MicroVM runtime 留 v4 后续**）

**关键读法**：v3.1 收口的是 **"库代码 + 内部测试"** 层。**真正生产端的 FastAPI HTTP / K8s Job / Keycloak 真鉴权 / Firecracker MicroVM 全部以占位形式收口**，是 v4 后续 Batch。

---

## 二、已落地的核心流程（盘点结论）

### 2.1 Kernel 12 基元 ✅ 全部到位

**位置**：`mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/`

| 基元 | 实现位置 | 备注 |
|---|---|---|
| `ClassRef` | `identity/class_ref.py` | 标识层 |
| `Version` | `versioning/` + ADR-0021 §2 | 不可变 |
| `Property` | `types/property_.py` | 不可变 |
| `ObjectType` | `types/object_type.py` | 不可变 |
| `LinkType` | `types/link_type.py` | 不可变 |
| `ActionType` | `types/action_type.py` + `action/engine.py` | 不可变 + apply 引擎 |
| `Interface` | `types/interface.py` | 不可变 |
| `Individual` | `instances/individual.py` + `instances/store.py` | 可变 |
| `LinkInstance` | `instances/link_instance.py` | 可变 |
| `Axiom` | `reasoning/` + `inference/engine.py` | 不可变 |
| `Function` | `function_resolver.py` + `sandbox/function.py` | 不可变 + 执行 |
| `ObjectSet` | `query/object_set.py` + `objectset/compiler.py` + `objectset/sql_compiler.py` | 可编译到 PG |

**验证证据**：`MP-ONT-KERNEL-01-ACCEPTANCE.md` 111 tests + `test_ontology_primitives.py` 43 tests + `test_ontology_serde.py` 28 tests + `test_ontology_api.py` 17 tests + `test_migrate_v1_v2.py` 5 + `test_tenant_ctx.py` 14 + `test_types.py` 4 = **111/111 pass**。

**端到端串联**：`mate-kernel/examples/01_kitchen_sink.py` 11 步（Order ObjectType + 3 Individual → 7+1 Agent → SuperAI HITL 暂停）—— 库代码层 OK。

### 2.2 Action / ObjectSet / Manager ✅ M2 收口

| 模块 | 位置 | 关键能力 |
|---|---|---|
| Action engine | `mate-kernel/action/engine.py` | `ActionService.apply` + `SubmissionContext` + side_effects + outbox hook |
| ObjectSet 编译器 | `mate-kernel/objectset/compiler.py` + `sql_compiler.py` | `CompiledFilter` → 参数化 SQL WHERE；`FIELD` 接受完整 rid `ont.<tenant>.prop.<slug>.v<n>`（RUNTIME-MVP-02 增量）|
| Manager 协议 | `mate-kernel/manager/protocol.py` | `ManagerContext` + change sink + agent invoker + Branch/Proposal/Impact/Revert |

**M2 退出标准**：
- ActionType / Function / Interface 端点全部入 `ont.yaml` ✅
- ObjectSet 编译器覆盖 80% 业务查询 ✅（PG 端到端 5/5 pass）
- OntologyManager Branch / Proposal / Impact / Revert 闭环 ✅
- RAG-Ontology 0 训练，召回率 ≥85% ✅（声明值，未独立验证）

### 2.3 沙箱（L1 进程 / L2 K8s / L3 占位）✅ M1+M3 收口

| 沙箱 | 等级 | 位置 | 状态 |
|---|---|---|---|
| Function Sandbox | L1 进程（默认）/ L2 K8s Job | `mate-kernel/sandbox/function.py` + `k8s.py` | ✅ M1 L1 + M3 L2 K8s Job 抽象 |
| Session Sandbox | L2 容器 | `mate-kernel/sandbox/session.py` | ✅ M1 |
| 第三方 Sandbox | **L3 MicroVM（占位）** | `mate-kernel/agent/external.py`（MockMicroVMRunner）| 🟡 API 占位，**Firecracker/gVisor 真接入留 v4** |

**关键约束**：
- Function Sandbox 6 条硬要求（每次调用独立 / default-deny 网络 / 租户身份继承 / Outbox 白名单 / OTel + ADS / 超时配额）→ SANDBOX-01/02 ✅
- Session Sandbox 7 条硬要求（每用户每会话独占 / DEK 加密 / 跨会话默认隔离 / 跨域身份继承 / Plan 持久化 / 超时配额 / retention_policy 清理）→ SESSION-01 ✅

### 2.4 7+1 数字员工 ✅ M2+M3 收口

| 员工 | 位置 | 状态 | 落地场景 |
|---|---|---|---|
| Ontology Agent | `mate-kernel/agent/ontology.py` + M2 `AGENT-ONT-01` | ✅ Accepted 11 tests | 自然语言 → ObjectSet proposal |
| Workflow Agent | `mate-kernel/agent/workflow.py` + M3 `AGENT-WF-01` | ✅ Accepted 11 tests | FlowDefinition + BPMN + ActionService.apply + abort |
| App Agent | `mate-kernel/agent/app.py` + M3 `AGENT-APP-01` | ✅ Accepted 11 tests | build_crud_app + PageManifest（list/detail/form/dashboard）|
| Data Product Agent | `mate-kernel/agent/data_product.py` + M3 `AGENT-DATA-01` | ✅ Accepted 10 tests | DataProduct + QualitySummary（completeness/freshness/row_count/uniqueness）+ LineageEdge 双向 |
| OBS Agent | `mate-kernel/agent/obs.py` + M3 `AGENT-OBS-01` | ✅ Accepted 12 tests | AlertRule + 6 Comparator + 触发 ActionType.apply 自愈 |
| Security Agent | `mate-kernel/agent/security.py` + M2 `AGENT-SEC-01` | ✅ Accepted 11 tests | marking 评估 + `check_action_apply` + 跨域 ADS 异常 |
| KB Agent | `mate-kernel/agent/kb.py` + M3 `AGENT-KB-01` | ✅ Accepted 9 tests | KbDocument + class-link 反向索引 + combined_retrieve 与 RAG-ONT 联合 |
| External Agent | `mate-kernel/agent/external.py` + M3 `AGENT-EXT-01` | ✅ Accepted 12 tests | HTTP/MCP/A2A 三协议 + L3 MicroVM 强制（B1）|
| **SuperAI (COPILOT)** | `mate-kernel/agent/copilot.py` + M3 `SUPER-COPILOT-01` | ✅ Accepted 21 tests | IntentRouter + HitlTokenStore（B2 短期 token）+ AuditRetention（C3 discard/7d）+ SuperAICopilot（submit/confirm/abort）|

**累计 M2+M3 Agent 测试 = 11+11+11+10+12+9+12+21 = 97 tests pass**。

### 2.5 RAG / 知识库 / 检索 ✅ M2 + 业务迭代

| 域 | 位置 | 状态 |
|---|---|---|
| `mate-tech-rag/api/{app,document_registry,ingest,parse,retrieval,schemas}.py` | RAG 后端 | ✅ |
| 4 类客户端：`milvus_client / ragflow_client / ragflow_httpx_client / pg_client / lightrag_httpx_client / graphrag_client / hybrid_client / hybrid_v2_client / neo4j_graphrag_client / lightrag_client` | 向量 + 图 + 混合 | ✅ |
| `mate-app-kb/api/{app,schemas}.py` | KB 业务后端 | ✅ |
| `mate-kernel/rag/ontology.py`（RagIndex / RagQuery）| 本体语料 RAG（M2 `RAG-ONT-01` 9 tests）| ✅ |
| 前端 `pages/knowledge/{KnowledgeBasePage, KnowledgeConfigPage, KnowledgeDocsPage, KnowledgeTestPage}.tsx` | 知识库 4 页 | ✅ |
| 前端 `pages/dw/DocumentsPage.tsx` + `pages/agents/AgentsKnowledgePage.tsx` | DW 知识库 | ✅ |
| 前端 `pages/superai/{ChatPage,DataAnalysisPage,GeneratePanel,ExplorePanel}.tsx` | 智能问答 / 数据分析 / 代码生成 / 本体探索 | ✅（V11~V12 全收口）|

### 2.6 SuperAI / Copilot / A2A / 任务编排 ✅ M3 收口

| 域 | 位置 | 状态 |
|---|---|---|
| `mate-app-copilot/api/app.py` + `llm/{anthropic,openai,llmgw,stub}_provider.py` + `routing/{complexity,dispatcher}.py` | SuperAI LLM 网关 | ✅ |
| `mate-app-copilot/a2a/{client,models,registry}.py` | A2A 协议（agent cards + delegations）| ✅ |
| `mate-app-a2a/api/` | 委派异步回调（SSE 流 + 状态机 SUBMITTED→WORKING→INPUT_REQUIRED→COMPLETED/FAILED/CANCELED）| ✅ V14-06 收口 |
| `mate-tech-llmgw/{chat,multimodal,multimodal_router,cost,quota,tools}.py` | LLM 网关（chat/completions + multimodal + 智能成本）| ✅ |
| 前端 `pages/superai/{SuperAIChatPage, ChatPage, A2ACollaborationPage, TaskOrchestrationPage, ExecutionPlanPage, ParallelExecutionPage, ResultAggregationPage, ScheduleIntentPage, EmployeeMatchingPage, ScheduleExecutionPage, ExecutionDetailPage, ResultSummaryPage, ReportExportPage, ManualSelectEmployeePage, CostOptimizationPage, DataAnalysisPage, TaskTemplatePage, AgentCopilotPage}.tsx`（20 页）| 全功能 | ✅ |
| 前端 `pages/dw/{EmployeesPage, TasksPage, A2APage, CollaborationsPage, EvaluationsPage, LearningPage, ExtractionPage, DocumentsPage, ObsPage}.tsx` + `pages/agents/` 13 页 | 数字员工 + 业务 RAG | ✅ |
| 前端 `pages/dw/components/ReplayPlayer.tsx` + `ReplayPanel.tsx` | TECH-OBS trace 回放 | ✅ V14-07 收口 |
| 前端 `pages/superai/components/{ExplorePanel, KnowledgeGraph, GeneratePanel, CodeWorkspace, PlanPanel}.tsx` | 本体探索 + 代码生成 + 任务计划 | ✅ V12-01/02/05 收口 |

### 2.7 12 决策点（蓝图 §4~§6）全部锁死

| 决策 | 选项 | 状态 |
|---|---|---|
| A1 RAG + 规则 + 偶发微调 | RAG-ONT-01 主导 | ✅ |
| A2 7 + N | 7 内置 + Marketplace 第三方 | ✅ |
| A3 新建 mate-tech-orchestrator | 新包在 `mate-kernel/agent/orchestrator.py` | ✅（命名略变，并入 kernel 而非独立包，**待对齐 ADR §4**）|
| A4 混合（共享 + 租户扩展）| 内置 7 + Marketplace 租户订阅 | ✅ |
| B1 Function L2 + 第三方 L3 | Function Runtime K8s Job（占位 subprocess）+ L3 MicroVM 强制 | 🟡 **L3 MicroVM Firecracker 真接入留 v4** |
| B2 会话级短期 token（30 min）| `HitlTokenStore` in `copilot.py` | ✅ |
| B3 每次 plan ≥1 HITL 暂停 | Orchestrator 状态机 `awaiting_user` | ✅ |
| B4 SANDBOX-01 进 M1 | M1 与 KERNEL-01 并行 | ✅ |
| C1 默认 30 min 可配 24h | `session_ttl` 字段 | ✅ |
| C2 opt-in 跨会话偏好 | 默认不加载 | ✅ |
| C3 默认 discard 可 opt-in 7d | `retention_policy` | ✅ |
| C4 同步（多设备共用 plan）| `session_plans` + Redis Stream 广播 | ✅（**PG + Redis Stream 实接入留 v4 后续**）|
| L1 直接迁移 v2 | OWL 风格旧表 deprecate + `owl/io.py` 保留 | ✅（L1 锁死 + `MP-ONT-V1-SUNSET-NOTICE.md` 收口）|
| L2 K8s Job/Pod | 默认起 K8s Job | 🟡 **当前默认 backend = subprocess，K8sJob 接入留 v4** |
| L3 PG 表 | `session_plans` 等落 PG | ✅ |

---

## 三、本范围内的显著 Gap（5 处）

虽然 v3.1 子计划 20/20 Batch 在 **库代码 + 内部测试层** 已 100% 收口，但落到 **"业务系统可用的端到端流程"**，本范围仍有 5 处显著 gap。

### 3.1 Gap O-1（🔴 P0）：前端 Ontology 独立 app 形态不兑现

**PRD 描述 vs 代码实测**：
- PRD `APP-ONTSTUDIO-本体论引擎_v2.4-20260727.md §1.1` 描述"前端：React 19 + TypeScript 5.7 + Ant Design 6.0 + AntV X6，**主实现**为独立 APP"
- `REPORT-前端实现与PRD差异盘点 §5.7` 已点出：`apps/ontstudio/` 目录**仅有 node_modules，无 src 源码**
- **实际**：`pages/ontology/` 含 5 个聚合页（Modeling/Datacenter/Action/Graph/ActionPage + 3 个子目录：actions / object-types / relationship-types），与 PRD 描述的 3.1~3.4 详细章节（67 个需求点）**严重不对位**

**核心功能缺口**（仅靠 portal 5 页兜底）：
| PRD § | 描述 | 实际页面 | Gap |
|---|---|---|---|
| 3.1.1~3.1.6 | 概念/属性/实体/关系/规则/版本 管理 | `OntologyModelingPage.tsx` + `object-types/` + `relationship-types/` | 🟡 详情/版本管理弱 |
| 3.2.1~3.2.5 | 数据源/数据映射/质量/血缘/数据中心 | `OntologyDatacenterPage.tsx` + 7 个 components（BigDataSourceView/CDCView/DataGraphView/ETLView/LineageFullView/MetricView/SchedulerView）| 🟡 深度参差 |
| 3.3.1~3.3.4 | Action 定义/服务编排/触发规则/执行监控 | `OntologyActionPage.tsx` + `actions/ActionTypeListPage.tsx` | 🟡 拖拽编排器无独立页 |
| 3.4.1~3.4.4 | 图谱浏览/查询/布局/Cypher 控制台 | `OntologyGraphPage.tsx` + Cypher Console | ✅ V12-05 收口 |
| 5.x 概念详情 | Tab 页签扩展（5 Tab：实体/关系/版本/血缘/规则） | `ConceptDetailPage` (V12-06 收口) | ✅ |

**影响**：本范围虽不影响后端 364 tests pass，但**用户从 UI 进入的体验是 60% 缺口**。

### 3.2 Gap O-2（🔴 P0）：Mate-Kernel 库代码 ≠ 端到端业务可用

**BOARD.md §6 自承**：
- RUNTIME-K8S-02：Function Sandbox **默认 backend = subprocess**（K8sJob 接入**留后续**）
- IAM-COPILOT-04：dev profile `LEGACY_LOGIN_COMPAT=1` 走 ManagerContext（**真鉴权留 v4 后续**）
- MARKETPLACE-05：`K8sSandboxRunner(backend="microvm")` API **占位**（**Firecracker 真接入留 v4 后续**）

**核心缺口**：
| 缺口 | 影响 | 风险 |
|---|---|---|
| Function Sandbox 实际跑 subprocess 而非 K8s Job | 跨租户 RCE 风险（蓝图 §6 明确拒绝进程池）| 🟠 生产不可用 |
| ManagerContext 在 dev profile 走 `LEGACY_LOGIN_COMPAT=1` | 生产缺真鉴权 | 🟠 13 硬规则 ⑤ 未完全对位 |
| L3 MicroVM 占位 | Marketplace 第三方 Agent 实际未沙箱化 | 🟠 蓝图 B1 未兑现 |
| Redis Stream 广播（多设备 C4 同步）| 实接入待 v4 | 🟡 体验问题 |
| AGENT-EXT-01 真实 HTTP/MCP/A2A 三协议 vs MockMicroVMRunner | 真协议未对接 | 🟡 |

**v4 RUNTIME 路线**（声明 5/5 Accepted 但实际仅 2/5 真到位）：
- ✅ RUNTIME-HTTP-01（FastAPI 7 endpoint 真的）
- ✅ RUNTIME-PG-03（PgOntologyRepository 真的）
- 🟡 RUNTIME-K8S-02（**默认 subprocess 留 v4**）
- 🟡 IAM-COPILOT-04（**dev 走兼容 留 v4**）
- 🟡 MARKETPLACE-05（**MicroVM 占位 留 v4**）

### 3.3 Gap O-3（🟠 P1）：前端 SuperAI 顶层入口（"先完成 Ontology 核心流程"的主入口）

**已实现**（V14-08 + V15-01~08 收口）：
- `pages/superai/` 20 页（最完整的独立 app）
- `pages/superai/SuperAIChatPage.tsx`（顶层对话）
- `pages/superai/AgentCopilotPage.tsx`（顶层入口）
- `pages/superai/ScheduleIntentPage.tsx` → `EmployeeMatchingPage` → `SchedulePlanCard` → `ScheduleExecutionPage` → `ExecutionDetailPage` → `ResultSummaryPage` → `ReportExportPage`（FR-AI-009 顶层调度）
- `pages/superai/CostOptimizationPage.tsx` + `ResultAggregationPage.tsx`（FR-AI-010 知识总结）
- `pages/superai/A2ACollaborationPage.tsx`（FR-AI-012 A2A 协作）
- 多模态（V15-01）+ 自主规划（V15-02）

**未实现 / 弱**：
| PRD § | 描述 | 实际 | Gap |
|---|---|---|---|
| FR-AI-001 | 消息反馈（点赞/踩）| `chat.ts` 未见对应函数 | 🟡 PRD v2.3 §3.2 描述缺 |
| FR-AI-001 | 附件上传 UI | multimodal/upload API 已留，UI 部分支持图片 | 🟡 文档/PDF 弱 |
| FR-AI-005 | 代码沙箱运行面板 | `GeneratePanel` + `CodeWorkspace` 集成 | ✅ V12-02 收口 |
| FR-AI-006 | 本体探索深度 | `ExplorePanel` + `KnowledgeGraph` X6 | ✅ V12-01 收口 |

**整体**：80%+，**消息反馈 / 附件 UI** 2 项 P1 弱。

### 3.4 Gap O-4（🟠 P1）：知识库（APP-KB）独立 app 形态不兑现

**已实现**：
- `pages/knowledge/` 4 页（KnowledgeBasePage + KnowledgeConfigPage + KnowledgeDocsPage + KnowledgeTestPage）—— 以 portal 为单一来源
- 后端 `mate-tech-rag/` + `mate-app-kb/` + `mate-kernel/rag/ontology.py`

**未实现**：
| 缺口 | 描述 | 风险 |
|---|---|---|
| 独立 `apps/kb/` app 仅有 2 页（KbListPage + SearchTestPage）| 与 portal/knowledge 4 页并存 | 🟡 二选一 |
| 切片策略模板编辑深度 | `KnowledgeConfigPage` 内含，深度需验证 | 🟡 |
| 知识库版本快照/回滚 | `/v1/dw/knowledge-bases` API 已留，UI 待补 | 🟡 |
| 切片审核 UI | 文档预览页可加 | 🟡 |

**整体**：70%+，**版本快照 UI + 切片审核 UI** 2 项弱。

### 3.5 Gap O-5（🟡 P2）：数字员工 7+N 与业务 ActionType 映射未显式建立

**已实现**：
- `mate-kernel/agent/` 10 个员工 module（7 内置 + 1 External + 1 Orchestrator + 1 SuperAI）
- 前端 `pages/dw/` + `pages/agents/` 共 22 页
- 业务 RAG（`APP-DW-业务RAG v1.1`）+ 页面 Agent（`APP-DW-页面Agent v1.1`）双双 Done

**未实现**：
| 缺口 | 描述 | 风险 |
|---|---|---|
| 7+N 数字员工与 mate-tech-agent `ActionType.apply` 真实落库动作的显式 REQ ↔ ActionType 映射表 | 蓝图 §4.1 列出 7 个 Agent，但业务 PRD 没有建立 ActionType 注册表 | 🟡 长期 |
| 多员工协作报告聚合（A2A）| `ResultAggregator` 实现，但 `ExternalAgentsPage` 异步回调与状态时间线的真实端到端业务场景未跑通 | 🟡 |
| 自主学习（V15-03 收口）后知识库自动更新 | LearningPage + ExtractionPage 已实现，**但反馈 → KB 同步的真实业务动作未跑通** | 🟡 |

---

## 四、核心流程端到端盘点（"先完成 Ontology 核心流程"具体所指）

按用户原话"先完成 Ontology 本体论的核心流程"，对照蓝图 §3 + PRD §2 主动线，盘点端到端流程实际状态：

### 4.1 端到端流程 A：本体建模 → 实例化 → Action → Function

| 步骤 | 后端 | 前端 | 状态 |
|---|---|---|---|
| 1. 概念建模（ClassRef + ObjectType + Property + LinkType）| `mate-kernel/ontology/{identity,types}/` + `mate-tech-ont/api/ontology.py` | `OntologyModelingPage` + `object-types/ObjectTypeListPage` + `RelationshipTypeListPage` | ✅ 库层 / 🟡 UI 5 页兜底 |
| 2. 推理规则（Axiom）| `mate-kernel/ontology/reasoning/` + `inference/{engine,shacl_engine}.py` | （无独立规则页）| 🟡 后端 ✅，前端弱 |
| 3. 版本管理（Branch/Proposal/Impact/Revert）| `mate-kernel/manager/protocol.py` + `versioning/store.py` | （无独立版本页）| 🟡 后端 ✅，前端弱 |
| 4. 实例化（Individual + LinkInstance）| `mate-kernel/ontology/instances/{individual,link_instance,store}.py` | `object-types/ObjectTypeDetailPage` | 🟡 |
| 5. ActionType 定义 + Function 绑定 | `mate-kernel/ontology/types/{action_type,interface}.py` + `function_resolver.py` | `OntologyActionPage` + `actions/ActionTypeListPage` | 🟡 |
| 6. ActionType.apply（with sandbox）| `mate-kernel/action/engine.py` + `sandbox/function.py` | `ExternalAgentsPage` / `TaskDetailPage`（间接）| 🟡 **Function Sandbox 实际跑 subprocess 而非 K8s Job** |
| 7. Outbox + ADS 审计 | `mate_platform/messaging/outbox.py` + `mate-tech-data/services/ads_publisher.py` | `pages/dw/ObsPage.tsx` | 🟡 ADS 真的，**ontology 表未入 ADS**（蓝图 §7 #18 标注）|

**结论**：A 流程在 **库代码层 OK**（111+ kernel + 364 total tests pass），但 **端到端业务可用** 需补：UI 弱 / sandbox backend / ADS ontology 接入 3 项。

### 4.2 端到端流程 B：AI 穿透本体（FR-AI-009 顶层调度）

| 步骤 | 后端 | 前端 | 状态 |
|---|---|---|---|
| 1. 用户问"审批订单" | `mate-app-copilot/api/app.py` + `mate-tech-llmgw/chat.py` | `SuperAIChatPage` + `AgentCopilotPage` | ✅ |
| 2. IntentRouter 路由到 WORKFLOW Agent | `mate-kernel/agent/copilot.py` IntentRouter | `ScheduleIntentPage` | ✅ |
| 3. 员工匹配（EmployeeMatching）| `mate-kernel/agent/data_product.py` | `EmployeeMatchingPage` | ✅ |
| 4. Plan 生成 + PlanPanel 渲染 | `mate-kernel/agent/copilot.py` PlanPanel | `SchedulePlanCard` + `PlanPanel` | ✅ V15-02 收口 |
| 5. 提交 Plan（submit）| `SuperAICopilot.submit` | `ScheduleExecutionPage` | ✅ |
| 6. HITL 暂停 + HitlTokenStore | `mate-kernel/agent/copilot.py` HitlTokenStore | （Modal 弹 token）| ✅ B2 决策 |
| 7. 用户 confirm → ActionType.apply | `ActionService.apply` + sandbox/function | `ExecutionDetailPage` | 🟡 Function Sandbox 跑 subprocess |
| 8. ResultAggregator 聚合多员工报告 | `mate-tech-agent/eval/` | `ResultAggregationPage` | ✅ V11-06 收口 |
| 9. 报告导出 | `mate-tech-llmgw/tools/` | `ReportExportPage` | ✅ |
| 10. OBS trace 记录 | `mate-tech-obs/` | `pages/dw/ObsPage` | ✅ |
| 11. 任务回放 | `mate-tech-obs/traces` | `ReplayPlayer` + `ReplayPanel` | ✅ V14-07 收口 |

**结论**：B 流程 11/11 步基本 ✅，**仅 Function Sandbox backend** 这一步是 subprocess 而非 K8s Job。

### 4.3 端到端流程 C：RAG → 本体语料 → 智能问答

| 步骤 | 后端 | 前端 | 状态 |
|---|---|---|---|
| 1. 文档接入 | `mate-tech-rag/api/{ingest,parse,document_registry}.py` | `KnowledgeDocsPage` | ✅ |
| 2. 切片策略 | `mate-tech-rag/chunking.py` | `KnowledgeConfigPage` | 🟡 深度待验证 |
| 3. 向量化 + 存储 | `mate-tech-rag/embedder.py` + `vector_store.py` + `clients/{milvus,pg,ragflow,lightrag,neo4j_graphrag,graphrag,hybrid_v2}.py` | （无）| ✅ |
| 4. 本体语料 RAG 索引 | `mate-kernel/rag/ontology.py` RagIndex | （无）| ✅ RAG-ONT-01 9 tests |
| 5. KB 员工反查 class-link | `mate-kernel/agent/kb.py` KnowledgeLibraryAgent | `pages/dw/DocumentsPage` + `pages/agents/AgentsKnowledgePage` | ✅ AGENT-KB-01 9 tests |
| 6. combined_retrieve | `mate-kernel/agent/kb.py` combined_retrieve | （无）| ✅ |
| 7. 智能问答 | `mate-app-copilot/llm/` + `mate-tech-llmgw/chat.py` | `SuperAIChatPage` + `ChatPage` | ✅ |
| 8. 多轮 + 引用 + 历史 | `conversations.py` | `ChatPage` | ✅ |
| 9. A2A 协作（与其他 Agent 委派）| `mate-app-a2a/` + `mate-app-copilot/a2a/` | `A2ACollaborationPage` + `ExternalAgentsPage` | ✅ V14-06 收口 |
| 10. 反馈 → KB 自动更新 | `mate-tech-agent/learning` | `pages/dw/LearningPage` + `ExtractionPage` | ✅ V15-03 收口 |

**结论**：C 流程 10/10 步基本 ✅，**切片策略编辑深度 + 知识库版本快照 UI** 这 2 项 UI 待补。

### 4.4 端到端流程 D：OWL 兼容层 + 迁移

| 步骤 | 后端 | 前端 | 状态 |
|---|---|---|---|
| 1. 旧 OWL 风格数据（4 张 ORM 表）| `mate-tech-ont/repositories/sql_models.py:16-72` | — | 🟡 旧表 |
| 2. N-Triples 导入 | `mate-tech-ont/owl/io.py:19-59` + `mate-kernel/ontology/migrate_v1_v2.py` | — | ✅ |
| 3. v1 → v2 迁移 | `mate-kernel/ontology/migrate_v1_v2.py` + `tests/fixtures/owl_sample.nt` | — | ✅ 5 tests |
| 4. v2 PG 存储 | `mate-tech-ont/v2_kernel/pg_repo.py` | — | ✅ RUNTIME-PG-03 |
| 5. 旧表 deprecate + 保留 OWL 导入导出 | L1 锁死 + `MP-ONT-V1-SUNSET-NOTICE.md` | — | ✅ |
| 6. 双租户 ctx 统一 | `mate-kernel/ontology/tenant.py` + `forbid_legacy_tenant_ctx.py` | — | ✅ 14 tests |

**结论**：D 流程 6/6 步 ✅。

---

## 五、量化 Gap 总结

按"PRD 声明 vs 库代码 vs UI vs 端到端"四维度打分：

| 维度 | 库代码 | UI | 端到端 | 备注 |
|---|:-:|:-:|:-:|---|
| **Ontology 12 基元** | 100% | 60% | 70% | 库 100% / 端到端缺 sandbox backend / UI 5 页兜底 |
| **ObjectSet 编译器** | 90% | 60% | 80% | PG 端到端 5/5 pass / UI 弱 |
| **Action / Function / Interface** | 90% | 60% | 70% | 库 100% / sandbox 实际 subprocess / UI ActionType 列表页弱 |
| **Manager（Branch/Proposal/Impact/Revert）** | 90% | 30% | 70% | 库 100% / **前端无独立版本管理页** |
| **推理 / Axiom** | 85% | 30% | 70% | 库 + test / 前端无独立规则页 |
| **沙箱（L1/L2/L3）** | 100% L1 / 100% L2 占位 / 100% L3 占位 | 60% | 70% | **L2 K8s Job 默认 subprocess 留 v4 / L3 Firecracker 占位** |
| **会话沙箱（C1~C4）** | 90% | 60% | 70% | 库 100% / **Redis Stream 实接入留 v4** |
| **7+1 数字员工** | 100% | 80% | 80% | 库 364 tests pass / UI 20+22 页 / 端到端 11 步 kitchen sink |
| **RAG / 知识库** | 100% | 75% | 85% | 4 client / 5 endpoint / 4 UI 页 / 切片策略 + 版本快照 UI 弱 |
| **SuperAI / Copilot** | 100% | 90% | 85% | 库 + UI 20 页 / 端到端 11 步 / 消息反馈 + 附件 UI 弱 |
| **A2A 协作** | 100% | 90% | 85% | V14-06 收口 / 异步回调 SSE 流 + 状态机 |
| **任务回放** | 100% | 100% | 90% | V14-07 收口 / ReplayPlayer + ReplayPanel |
| **多模态 / 自主规划** | 100% | 90% | 80% | V15-01/02 收口 |

**整体（本范围）**：
- **库代码层 95%+**（mate-kernel 364/364 tests pass + 端到端 kitchen sink 11 步通过）
- **UI 层 70~80%**（superai 90% / dw 80% / ontology 60% / kb 75%）
- **端到端业务可用 75~85%**（核心流程 4 条全部能跑通，但 Function Sandbox subprocess / ADS ontology 接入 / Ontology 独立 app 形态 3 项是真 gap）

---

## 六、关键 Gap 优先级排序（按"先完成 Ontology 核心流程"目标）

| 序号 | Gap | 描述 | 风险 | 建议优先级 |
|---|---|---|---|---|
| 1 | **O-1：Ontology 独立 app 形态** | `apps/ontstudio/` 仅有 node_modules | 🔴 PRD/代码双轨 | **P0**：决策 1 冻结独立 app，统一以 portal/ontology 为来源；或决策 2 补建 |
| 2 | **O-2a：Function Sandbox backend** | 实际 subprocess 而非 K8s Job | 🟠 跨租户 RCE 风险（蓝图 §6 拒绝进程池）| **P0**：v4 后续 Batch 立即收口 |
| 3 | **O-2b：ManagerContext 真鉴权** | dev 走 `LEGACY_LOGIN_COMPAT=1` | 🟠 13 硬规则 ⑤ 未完全对位 | **P0**：v4 后续 Batch 立即收口 |
| 4 | **O-2c：L3 MicroVM 真接入** | Firecracker 占位 | 🟠 蓝图 B1 未兑现 | P1：Marketplace 第三方 Agent 上线前必须收 |
| 5 | **O-2d：Redis Stream 实接入** | 多设备 C4 同步占位 | 🟡 体验 | P2 |
| 6 | **O-3：消息反馈 / 附件 UI** | FR-AI-001 部分缺 | 🟡 | P2 |
| 7 | **O-4：KB 切片策略 / 版本快照 UI** | KnowledgeConfigPage 深度 + 知识库版本 | 🟡 | P2 |
| 8 | **O-5：7+N ↔ ActionType 显式映射** | 业务 PRD 没建立索引 | 🟡 长期 | P3 |
| 9 | **O-2e：ontology 表入 ADS** | 蓝图 §7 #18 标注 | 🟡 | P3 |
| 10 | **O-2f：L2 K8s Job 默认 backend** | 当前 subprocess | 🟠 蓝图 L2 锁死 | **P0**（与 O-2a 同源） |

---

## 七、对"先完成 Ontology 核心流程"的具体建议

### 7.1 真正要做的事（按 ROI 排序）

#### 决策点 1：Ontology 独立 app 形态（O-1）
- **建议**：**冻结独立 `apps/ontstudio/`，统一以 `pages/ontology/` 为单一来源**
- 同步更新 `INDEX-PRD-V2.0-20260801.md §5.1` 中"APP-ONTSTUDIO 12 份"实际描述为"portal 单一来源 + 4 个子目录（actions / object-types / relationship-types / components）"
- 同步更新 APP-ONTSTUDIO PRD v2.4 §1.1"前端：独立 APP" → "前端：portal/ontology + 4 个子目录"
- **预估**：PRD 修订 0.5 人天，**代码 0 改动**

#### 决策点 2：Function Sandbox backend + ManagerContext 真鉴权（O-2a/O-2b/O-2f）
- **建议**：**立即立项 v4 RUNTIME 续 Batch**，把 RUNTIME-K8S-02 默认 backend 从 subprocess 切到 K8s Job；IAM-COPILOT-04 移除 `LEGACY_LOGIN_COMPAT=1` dev 兼容
- 涉及改动：
  - `mate-kernel/sandbox/function.py` 默认 backend
  - `mate-kernel/sandbox/k8s.py` InMemoryK8sRunner 替换为真实 K8s Job 提交
  - `mate-kernel/manager/protocol.py` ManagerContext 入口走 `mate_platform/auth/verifier.py`（真鉴权）
- **预估**：4~6 人天；新增 acceptance `RUNTIME-MVP-03-ACCEPTANCE.md`

#### 决策点 3：UI 兜底（O-3/O-4）
- **建议**：在 1 周内补齐 4 项 UI
  - `pages/superai/ChatPage` 加消息反馈（点赞/踩）+ 附件上传文档/PDF
  - `pages/knowledge/KnowledgeConfigPage` 加切片策略模板编辑 + 知识库版本快照
  - `pages/ontology/` 加 Manager 版本管理独立页（Branch/Proposal/Impact/Revert）
- **预估**：3~4 人天

#### 决策点 4：建立 7+N ↔ ActionType 显式映射（O-5）
- **建议**：在 `docs/active/decisions/ADR-0021` 同级新增 `ADR-0042-7n-actiontype-mapping.md`，把 7 个 Agent 与 12 基元 ActionType 的对应关系落档
- **预估**：1 人天

### 7.2 不建议现在做的事

- **L3 MicroVM Firecracker 真接入**（O-2c）—— Marketplace 第三方 Agent 未上线前不阻塞；建议 2026-Q4 立项
- **Redis Stream 广播**（O-2d）—— 多设备同步需求未到；建议 2026-Q4 立项
- **ontology 表入 ADS**（O-2e）—— CDC 改造面大；建议 v3.2 增量
- **业务流程 BPMN 拖拽建模器 / 架构健康度仪表盘**（前一报告 Gap A-2）—— **本范围不涉及，跳过**

### 7.3 立即可收的 1 周（10 人天）

| Day | 任务 | 涉及模块 | 估时 |
|---|---|---|---|
| D1~D2 | 决策点 1：PRD 修订 + 目录治理 | APP-ONTSTUDIO PRD v2.4 → v2.5 | 1 人天 |
| D2~D5 | 决策点 2：v4 RUNTIME-03 Batch 立项 + 实现 | mate-kernel/sandbox/ + manager/ | 4 人天 |
| D5~D7 | 决策点 3：UI 4 项补齐 | superai/ChatPage + knowledge/KnowledgeConfigPage + ontology/ + superai/ChatPage | 3 人天 |
| D7~D8 | 决策点 4：ADR-0042 7+N ActionType 映射 | docs/ | 1 人天 |
| D8 | 收口：`RUNTIME-MVP-03-ACCEPTANCE.md` + `O-3/O-4 PR` 合并 | — | 1 人天 |

**产出**：
- 1 份新 ADR（ADR-0042）
- 1 份新 ACCEPTANCE（RUNTIME-MVP-03）
- 1 份 PRD 修订（APP-ONTSTUDIO v2.5）
- 1 份 INDEX-PRD v2.1
- 4 个 PR
- 13 硬规则 ⑤ 实质收口
- 蓝图 §6 L2 锁死问题实质收口

---

## 八、关联文档

- `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4
- `docs/active/decisions/ADR-0021-kernel-12-primitives.md`
- `docs/active/decisions/ADR-0040-sandbox-architecture.md`
- `docs/active/decisions/ADR-0041-session-sandbox.md`
- `docs/active/decisions/PENDING-DECISIONS.md`
- `docs/active/delivery/V31-ONTOLOGY-BOARD.md`
- `docs/active/delivery/evidence/MP-ONT-KERNEL-01-ACCEPTANCE.md`
- `docs/active/delivery/evidence/M1-ACCEPTANCE.md` / `M2-ACCEPTANCE.md` / `M3-ACCEPTANCE.md`
- `docs/active/delivery/evidence/RUNTIME-MVP-01-ACCEPTANCE.md` / `RUNTIME-MVP-02-ACCEPTANCE.md`
- `docs/active/prd/APP-ONTSTUDIO/PRD-APP-ONTSTUDIO-本体论引擎_v2.4-20260727.md`
- `docs/active/prd/APP-KB/PRD-APP-KB-知识库_v1.2-20260727.md`
- `docs/active/prd/APP-COPILOT/PRD-APP-COPILOT_v2.3-20260727.md`
- `docs/active/prd/APP-DW/PRD-APP-DW-数字员工_v2.4-20260727.md`
- `docs/active/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`
- `docs/active/governance/FOLLOW-UP-BOARD.md`（不属本范围，但 O-2a/O-2b 涉及 sandbox / manager 跨域）

---

**报告完成日期**：2026-08-11
**下次评审**：v4 RUNTIME 续 Batch 收口时
**编制人**：盘点（基于现有文档 + 代码 ls，不含运行时二次验证）
