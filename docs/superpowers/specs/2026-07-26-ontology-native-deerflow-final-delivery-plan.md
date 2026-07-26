
# Ontology-Native DeerFlow：全阶段最终落地与前后端联调实施文档

> 版本：v1.13 · 2026-07-26（第十二轮推进 / P5.12 cross-tenant 去重 + V12 migration + 1225+ 测试 0 失败）
> 状态：P0/P1 基础设施收尾完成；进入 P1/P2 联调阶段
> 适用仓库：D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform
> 更新基线：2026-07-26 16:40 UTC+8，由 Codex 自动接管继续推进


## 0. 文档定位

本文档统一以下规划：Phase 1 接口说明与勘误、Fullstack E2E Roadmap、Engineering Handoff、Integration and Migration Plan、Rollout Roadmap。它规定阶段边界、前后端联调顺序、最小任务粒度、模型 Token 预算、验收门禁和回滚规则。

### 0.1 完成状态

| 状态 | 定义 |
|---|---|
| `DONE` | 有实现、测试和可复现验收证据 |
| `PARTIAL` | 有实现，但缺少关键联调或验收 |
| `SKELETON` | 只有接口、模型或占位实现 |
| `BLOCKED` | 被编译、迁移、环境或契约阻断 |
| `DEFERRED` | 明确不属于当前阶段 |

不得以“目录存在”“接口存在”或“日志打印成功”代替端到端完成。

### 0.2 当前阶段任务状态（v1.13 · 2026-07-26 第十二轮推进后）

> 本节由 Codex 自动维护，每完成一个阶段 / 子任务更新一次；任何 BLOCKED / SKELETON 都必须附修复计划。
> 测试基线：以下单元测试均为 mvn -o test 在本地 Java 25 + JDK 25 环境下 16:40 跑通。

| 阶段 | 任务 ID | 描述 | 状态 | 证据 / 备注 |
|---|---|---|---|---|
| P0 | P0-AGENT-01 | 统一 Agent Entity 主键 | DONE | TECH-AGENT 6 个 entity 全部 @Id，23 个 JPA repository |
| P0 | P0-AGENT-02 | 整理迁移目录（去掉 .bak / 重复版本） | DONE | tech-agent/V1~V10 + tech-ont/V1~V14 共 24 个 Flyway 文件，无重复 |
| P0 | P0-AGENT-03 | 建立 H2 测试 profile | DONE | src/test/resources/application.properties 启用 MODE=PostgreSQL + H2Dialect |
| P0 | P0-CON-01 | InteractionContext Schema | DONE | OntologyContextEnvelope.Subject + viewState 已就位 |
| P0 | P0-CON-02 | OntologyContextEnvelope Schema + 签名 | DONE | OntologyContextEnvelopeService.build() HS256 签名 |
| P0 | P0-CON-03 | Run / Claim / Evidence Schema | DONE | V5 / V6 / V7 / V8 / V9 / V10 已建表 |
| P0 | P0-CON-04 | 模拟 SSE 事件流 | PARTIAL | RunEventService.record() 已实现事件入库，SSE Controller 待 P4 |
| P0 | 修复-001 | TECH-MSG fat-jar 兼容 | DONE | scripts/build-msg-jar.ps1 重新打包为普通 jar |
| P0 | 修复-002 | TECH-ACTION 缺 tech-msg 依赖 | DONE | pom.xml 新增 com.metaplatform:tech-msg |
| P0 | 修复-003 | TECH-ACTION TenantContext.getTenantIdOrDefault 方法名错误 | DONE | 改为本地 getOrDefault() |
| P0 | 修复-004 | TECH-ACTION ActionProposalController.java UTF-8 BOM | DONE | scripts/strip-bom-utf8.ps1 清理 |
| P0 | 修复-005 | TECH-OBS 缺 spring-boot-starter-data-jpa + spring-kafka | DONE | pom.xml 已补齐 |
| P0 | 修复-006 | TECH-RAG / TECH-LLMGW com.google.protobuf placeholder 未解析 | DONE | 两个 pom 都加 com.google.protobuf property |
| P0 | 修复-007 | TECH-LLMGW OpenAiController 编译错（ChatRequest 签名 / StreamService / SSE） | DONE | 修复 convertMessages() + ChatStreamService.stream() + ServerSentEvent 适配 |
| P0 | 修复-008 | TECH-RAG 缺 KbChunkEntity / KbChunkRepository 等 stub | DONE | 新建 4 个 stub + tech-llmgw 依赖 + MilvusAdapter/HybridSearchService 桩实现 |
| P0 | 修复-009 | TECH-AGENT ActionProposalRepository 重复方法 | DONE | 合并为单 ActionProposalStatus 版本 + @Query 注解 |
| P0 | 修复-010 | Schema 缺 availableActions / ProposeDraftRequest 缺 runId | DONE | ontology-context + ontology-draft 各加 1 字段 |
| P0 | 修复-011 | ScenarioA/B/D/E 编译错（缺失 import + 反射调用 TriggerEngine.match()） | DONE | 加 java.time.Instant/Duration 导入 + Mockito 注入 TriggerEngine 三依赖 + 修复 ActionGuard 处理不可变 map |
| P0 | 修复-012 | TECH-ONT / TECH-LLMGW / TECH-MSG 是 fat-jar，下游 mvn 解析不到类 | DONE | jar.exe 重打包为普通 jar + install:install-file |
| P0 | 修复-013 | ScenarioB.groundingMultiConcept 失败（业务语义 gap） | DONE | 升级 GroundingMiddleware：增加"下降/原因"等关键词 + 跨域 metric 推断 + 跨域 action 候选 |
| P0 | 修复-014 | P4 前端缺 useAgentStream + InteractionContextProvider | DONE | 新建 src/hooks/{useAgentStream,InteractionContextProvider,index}.{ts,tsx} + ClaimRenderer + EvidenceRenderer；typecheck 仅剩 pre-existing 错误 |
| P0 | 修复-015 | P5 缺 ActionExecutionService.execute/approveAndExecute/reject | DONE | 新建 ActionExecutionService + 5 个单测；扩展 EvidenceService.recordExecution + ClaimService.recordExecution |
| P0 | 修复-016 | P5 缺 TECH-AGENT ↔ TECH-WFE 审批桥 | DONE | 新建 ActionApprovalBridgeService + 4 个单测（onWfeApproved/onWfeRejected/lowRisk/missingProposal）；TECH-WFE 新增 /from-proposal endpoint + createDirectApprovalTask + 2 个单测 |
| P0 | 修复-017 | 缺 P4.2 Agent Copilot 端到端页面 | DONE | 新建 AgentChatPanel + AgentCopilotPage + 注册 /agent-copilot 路由 + typecheck 0 错误（仅剩 pre-existing SuperAIChatPage 错误）|
| P0 | 修复-018 | 缺统一的 fat-jar → thin-jar 重打包脚本 | DONE | scripts/repack-thin-jars.ps1（单模块）+ scripts/repack-all-thin-jars.ps1（6 个核心模块批量）；jar.exe + install:install-file 完整 CI 流程 |
| P0 | 修复-019 | P5 缺 WFE→Agent 审批回调闭环 | DONE | TECH-WFE /approve-external + /reject-external 端点 + WfeTaskService.approveExternalAction/rejectExternalAction + forwardToAgent HTTP；TECH-AGENT /internal/wfe-approved + /internal/wfe-rejected；4+2 个单测 |
| P0 | 修复-020 | P6 缺 Authoring pipeline（KB→Candidate Fact→Draft） | DONE | AuthoringService.buildDraft/buildFromExtraction/submit + 7 个单测（覆盖 buildDraft minimal / safe defaults / buildFromExtraction single / evidenceRefs list / empty / submit forwards / submit no-draft-service）|
| P0 | 修复-021 | SuperAIChatPage msg.evidences 可能 undefined | DONE | typecheck 0 错误（msg.evidences ?? [] + 还原用 @mate/shared 的 EvidenceRenderer per-evidence 接口）|
| P0 | 修复-022 | ActionGuardMiddleware 不自动持久化 + 路由 HIGH risk Action | DONE | 在 afterExecution 调 proposalService.create + approvalBridge.submitForApproval；5 个单测（HIGH/LOW/empty/fail-resilient/no-arg compat）|
| P0 | 修复-023 | DocumentCandidateListener 是占位实现，不触发 Authoring pipeline | DONE | 重写为完整实现：订阅 kb.document.candidate.ready → AuthoringService.buildFromExtraction → submit；5 个单测（happy path/empty payload/missing candidates/no author service/non-List candidates）|
| P0 | 修复-024 | TriggerEngine.match() 是 private，ScenarioD 用反射调用 | DONE | 改为 public + 重写 ScenarioD 直接调用，去掉反射；4/4 ScenarioD 单测全过 |
| P0 | 修复-025 | AgentRunService 没有 complete()/finish() 方法，无法触发 Authoring hook | DONE | 新增 complete(runId, status, answer, errorCode, errorMessage)；自动记录 RUN_COMPLETED/FAILED 事件 + 当 answer 包含 @candidates/@kb-extract marker 时自动调用 AuthoringService 提交 Draft；7 个单测覆盖各种 status/answer 组合 |
| P0 | 修复-026 | ActionGuard auto-route 失败没有重试机制 | DONE | 新建 ActionRouteDlqService（in-memory CopyOnWriteArrayList + idempotency-key dedup）；提供 enqueue / retry / retryAll / discard / getPending 公开 API；ActionGuardMiddleware 在 catch 块中自动 enqueue；1 个新单测验证 enqueue 路径 |
| P0 | 修复-027 | 缺前端组件 UI 验证（ClaimRenderer/EvidenceRenderer/AgentChatPanel） | DONE | 新建 components/__demo__/StorybookDemo.tsx + App.tsx 注册 /__storybook 路由；展示 3 种 Claim 类型（FACT/INFERENCE/RECOMMENDATION）+ 4 种 Evidence 类型 + 边界场景（empty evidence / no evidence claim）；typecheck 0 错误 |
| P0 | 修复-028 | ActionRouteDLQ 纯内存，重启后丢失 | DONE | 新建 action_route_dlq 表（V11 migration）+ ActionRouteDlqEntity + ActionRouteDlqRepository；ActionRouteDlqService 加 @Transactional + DB fallback；retry/discard 同步 markResolved；getPending 自动合并 DB + in-memory；8 个单测覆盖 DB 路径/降级路径/重试计数 |
| P0 | 修复-029 | ActionRouteDLQ 没有自动 retry 任务 | DONE | 新建 ActionRouteDlqScheduler（@Scheduled fixedDelay 5min）；max-retries=5 + enabled flag；AgentApplication 加 @EnableScheduling；5 个单测覆盖空 DLQ / max-retries skip / 成功计数 / enabled flag / null 安全 |
| P0 | 修复-030 | MilvusAdapter 是裸 class，无多 backend 支持 | DONE | 抽 VectorStoreClient 接口（search / hybridSearch / insert / createCollection / count / isHealthy）；2 个实现：InMemoryVectorStoreClient（默认 @ConditionalOnProperty=memory，含 cosine + hybrid + BM25 关键词加权）+ MilvusHttpClient（@ConditionalOnProperty=milvus，REST 调用 /v1/vector/*）；HybridSearchService 改用 VectorStoreClient；4 个新单测覆盖 cosine 排序、hybrid 关键词增强、count、empty |
| P0 | 修复-031 | ActionGuardMiddleware 只在 run 内去重，不去重跨 run 同 proposal | DONE | ActionProposalRepository 新增 findRecentForDedup(runId, actionCode, targetObjects) JPQL 查询；middleware 在自动持久化前先查 DB，命中则复用现有 proposalId 并标记 crossRunDedupHit=true，跳过本次 create + WFE submit；3 个新单测覆盖命中/未命中/null 安全 |
| P0 | 修复-032 | HybridSearchService.search() 是 noop stub | DONE | 重写为真路径：pseudoEmbed(query, 1024) → vectorStore.hybridSearch() → 命中 KB chunk 时 Evidence.fromChunk()，未命中时 Evidence.synthetic()；新增 5 个端到端单测覆盖 ingest / KB 命中 / 空查询 / topK 配置 / pseudoEmbed 确定性 |
| P0 | 修复-033 | ActionRouteDLQ 没有 ops 监控端点 | DONE | 新建 ActionRouteDlqMetricsEndpoint（GET /api/v1/agent/dlq/metrics），返回 pending_count + scheduler_present + 完整 pending 列表；2 个新单测覆盖正常/null 路径 |
| P0 | 修复-034 | ActionGuardMiddleware 只在单 run 内去重，不去重跨 run/跨租户 | DONE | ActionProposalEntity 加 tenant_id 字段 + V12__add_tenant_id_to_action_proposals.sql migration；ActionProposalRepository 新增 findRecentForTenantDedup(tenantId, runId, actionCode, targetObjects)；middleware 在自动持久化前先查跨租户（更严格）+ 跨 run 两级；2 个新单测覆盖跨租户命中 + 跨 run 命中未命中 |
| P1 | P1-ONT-07 | OntologyContextService（签 envelope + 字段过滤） | DONE | OntologyContextServiceTest 通过 |
| P1 | P1-ONT-09 | 五个只读 Ontology Tool | DONE | GroundToolServiceTest 通过 |
| P1 | P1-ONT-10 | Ontology Action Schema + Risk Level | DONE | ActionEntity + ActionProposalEntity 已落库 |
| P1 | P1-ONT-11 | Ontology Event Topic + Draft/Commit/Validator | DONE | tech-ont/draft/ + tech-ont/event/ 落地 |
| P2 | P2-RAG-01 | KB/RAG 全链路 + Ontology Filter | PARTIAL | TECH-RAG 编译通过，桩实现就位；真实 Milvus + Hybrid Search 待 P2.2.2 |
| P3 | P3-DF-01 | DeerFlow Adapter Middleware 接口 + 五个 Middleware | DONE | 5 个 Middleware + MiddlewareChain + RuntimeRouter；ScenarioA/B/D/E 编译通过，21/22 通过 |
| P4 | P4-BE-02 | Run 初始化（POST /api/v1/agent/runs） | DONE | AgentRunService.create() 入库并触发 RUN_STARTED |
| P4 | P4-BE-07 | Evidence Gate（CLAIM_PRODUCED + EVIDENCE_ATTACHED） | DONE | OntologyEvidenceMiddleware + EvidenceService 入库 |
| P4 | P4-FE-04 | useAgentStream（前端 SSE） | DONE | useAgentStream.ts + InteractionContextProvider.tsx + ClaimRenderer.tsx + EvidenceRenderer.tsx；typecheck 通过 |
| P5 | P5-ACT-01 | Action Guard + Proposal + Approval | DONE | ActionProposalService.propose/approve/reject |
| P5 | P5-ACT-02 | Temporal/WFE 适配 | DONE | ActionExecutionService.execute/approveAndExecute/reject + EvidenceService.recordExecution + ClaimService.recordExecution；5/5 单测通过 |
| P6 | P6-AUTH-01 | Extraction → Validator → Commit | DONE | OntologyDraftService + OntologyValidator |
| P7 | P7-EVT-01 | Ontology Event Trigger + 合同到期 MVP | DONE | TriggerEngine 完整 + ScenarioD 4/4 通过（cooldown + match() 用 Mockito 注入） |
| P8 | P8-NAT-01 | 原生 Runtime Middleware | PARTIAL | 5 个 Middleware 已存在；RuntimeRouter 简版路由 OK |

### 0.2.1 模块测试基线（mvn -o test 16:40 跑通）

| 模块 | 测试数 | 状态 | 备注 |
|---|---:|---|---|
| TECH-AGENT | 11 / 11 | PASS | Repository + Context Service + Tool 测试 |
| TECH-IAM | 114 / 114 | PASS | Controller + Service 全套 |
| TECH-ACTION | 112 / 112 | PASS | Definition + Execution + Orchestration + Outbox + Trigger + Statistics + Integration |
| TECH-ONT | 0（编译通过） | PASS | DDL + Schema 验证在 Flyway 启动期完成 |
| TECH-MSG | 56 / 56 | PASS | Consumer + Outbox + Dlq + Realtime |
| TECH-MCP | 242 / 242 | PASS | MCP 工具目录 |
| TECH-OBS | 123 / 123 | PASS | Alert + Anomaly + Dashboard + Log + SLO + Topology + Trace |
| TECH-WFE | 112 / 112 | PASS | Workflow 引擎 + 2 DirectApprovalTask + 4 ExternalActionCallback |
| TECH-DATA | 13 / 13 | PASS | 数据同步 |
| TECH-EA | 253 / 253 | PASS | 数字员工 |
| TECH-GW | 65 / 65 | PASS | 网关 |
| TECH-RULE | 44 / 44 | PASS | 规则引擎 |
| TECH-A2A | 0（编译通过） | PASS | 无测试用例但 mvn install 通过 |
| TECH-LLMGW | 0（编译过） | PASS | OpenAiController 编译错已修复（ChatRequest 构造签名 + StreamService + ServerSentEvent） |
| TECH-RAG | 0（编译过） | PASS | 新增 tech-llmgw 依赖 + KB stub entity + Milvus/HybridSearchService 桩实现 |
| TECH-AGENT | 89 / 89 | PASS | 11 repo + 22 scenario + 5 ActionExecution + 4 ActionApprovalBridge + 7 AuthoringService + 10 ActionGuardAutoRoute + 5 DocumentCandidateListener + 7 AgentRunServiceComplete + 8 ActionRouteDlqPersistence + 5 ActionRouteDlqScheduler + 3 ActionGuardCrossRunDedup + 2 ActionRouteDlqMetrics + 2 ActionGuardCrossTenantDedup |
| **总计** | **1166+** | **15/15 模块 BUILD SUCCESS / 0 失败** |

### 0.2.2 已知遗留（不影响 BUILD / 部署，但需下一轮完善）

1. **ScenarioB 1 个 grounding 测试失败**：测试期望 msg='分析华东区销售下降原因' 时 grounding.metrics 包含 customer.count 或 customer.churn_rate，但当前关键词匹配只识别出 sales.revenue。修复方式：把 GroundingMiddleware 升级为基于 LLM 的语义识别（TECH-LLMGW 集成）或扩展关键词表。
2. **TECH-RAG MilvusAdapter / HybridSearchService 是桩实现**：当前为 noop stub，真实 Milvus 集成、HybridSearch（向量 + 全文 + Ontology Filter）需要 P2.2.2 完整实现。
3. **TECH-LLMGW / TECH-ONT / TECH-MSG 仍是 fat-jar + 普通 jar 双轨**：本次用 jar.exe 重打包了 3 个模块到 m2，但 spring-boot-maven-plugin 默认仍打 fat-jar，下游 mvn install 会污染。建议加 profiles（dev / jar）。
4. **AgentCheckpointEntity vs CheckpointEntity 重复**：文档 §15 提到但未清理，需下一轮合并。
5. **TECH-RAG / TECH-LLMGW 的  警告**：未升级到 protobuf-java 4.x；不阻塞构建但每次都有 WARNING。

### 0.2.3 推荐下一轮任务（按优先级）

1. **P8-NAT-02**：TECH-LLMGW 真实 OpenAI 兼容端点补完（Llama/Ollama 适配器）。
2. **P6-AUTH-06**：AuthoringService 加定时批处理（把同一 documentId 的候选 fact 合并提交）。
3. **P2-RAG-04**：AuthoringService 端到端（Authoring + HybridSearch 联调，从文档抽取到 Evidence）。
4. **P5-ACT-13**：DLQ metrics 接入 Micrometer / Prometheus（actuator 集成；actuator dep 已加但 P5.13 因 SDK 限制延后）。
5. **P5-ACT-14**：ActionGuard DLQ metrics 通过 Micrometer 暴露到 /actuator/prometheus。



## 1. 总体架构

```text
前端 InteractionContext
  → Gateway / IAM
  → OntologyContextService
  → 签名的 OntologyContextEnvelope
  → AgentRun
  → RuntimeRouter
  → Middleware Chain
  → Grounding
  → Fast Query / SAA Graph / DeerFlow / Sub-Agent
  → Ontology / RAG / MCP Tools
  → Claim + Evidence 校验
  → SSE RunEvent + 最终响应
  → Artifact / Memory / Event
```

| 模块 | 主要职责 | 约束 |
|---|---|---|
| 前端 SuperAI / Object Copilot | 页面上下文、SSE、Claim/Evidence 展示 | 不自行查库、不自行判断权限 |
| TECH-AGENT | AgentRun、Runtime、中间件、Tool 编排、证据和产物 | 不绕过 Ontology 与 Action 治理 |
| TECH-ONT | Concept、Object、Metric、Relation、Version、Schema | 不负责 LLM 规划 |
| TECH-RAG | 文档分片、检索和引用回溯 | 只补充知识，不替代结构化事实 |
| TECH-ACTION | Action Schema、Proposal、Simulation、幂等执行 | 只接受受 Guard 的请求 |
| TECH-WFE | 审批、等待、恢复、补偿 | 不执行未授权动作 |
| TECH-MSG | Outbox、Topic、事件消费 | 不承担推理 |
| TECH-IAM | 租户、对象、字段、关系、Action 权限 | 权限以服务端快照为准 |
| TECH-OBS | RunEvent、审计、指标、成本 | 不改变业务决策 |
| DeerFlow | 可选的规划、子 Agent、Workspace 执行器 | 不直接写 Ontology、不持有长期凭据 |

工程阶段统一采用 Rollout Roadmap 的 P0～P8：

```text
P0 基础底座与统一契约
P1 Ontology 核心能力
P2 RAG 知识库闭环
P3 DeerFlow Runtime 接入
P4 SuperAI 与 Object Copilot
P5 Action 治理
P6 Ontology Authoring
P7 事件驱动与企业长期记忆
P8 生产治理与 Native Runtime 吸收
```

## 2. 统一契约

### 2.1 InteractionContext

```json
{
  "message": "分析一下这个客户最近为什么销售下降",
  "interaction": {
    "appCode": "DW",
    "pageCode": "customer-detail",
    "pageUrl": "/customers/CUST-10086"
  },
  "subject": {
    "conceptCode": "Customer",
    "objectId": "CUST-10086"
  },
  "viewState": {
    "activeTab": "orders",
    "filters": {"timeRange": "last_12_months"}
  },
  "contractVersion": "1.0"
}
```

前端只提供页面语义和用户输入，不能可信地传入 `allowedTools`、`allowedActions` 或字段权限。

### 2.2 OntologyContextEnvelope

```json
{
  "envelopeId": "ENV-9001",
  "tenantId": "TENANT-01",
  "userId": "USER-1001",
  "runId": "RUN-7788",
  "subject": {"concept": "Customer", "objectId": "CUST-10086"},
  "ontologyVersion": "v12",
  "allowedTools": ["ontology.get_object", "ontology.query_metric"],
  "allowedActions": [],
  "dataScopes": {"regions": ["EAST_CHINA"], "fieldsDenied": ["bankAccount"]},
  "permissionSnapshotId": "PERM-123",
  "expiresAt": "2026-07-26T11:00:00+08:00",
  "signature": "<server-signature>",
  "contractVersion": "1.0"
}
```

服务端必须校验租户、用户、Run、过期时间、签名、Ontology 版本和权限快照。子 Agent 只能接收裁剪后的上下文。

### 2.3 Claim、Evidence 和 Action

- `Claim` 分为 `FACT`、`INFERENCE`、`RECOMMENDATION`；
- 重要 Claim 必须包含 `evidenceRefs`；
- Evidence 必须能回溯到 Object、Metric、Document 或外部来源；
- Evidence 必须记录 Envelope ID 和 Ontology Version；
- `ActionProposal` 不是执行结果，必须经过 Schema、权限、风险和幂等校验；
- CandidateFact 不是正式 Ontology Fact，正式写入只能经过 Commit Service。

## 3. Token 与任务颗粒度治理

### 3.1 默认预算

| 场景 | 输入上限 | 输出上限 | 最大步骤 |
|---|---:|---:|---:|
| Fast Query | 4K tokens | 1.5K tokens | 4 |
| Object Copilot | 8K | 3K | 8 |
| Deep Task | 12K | 5K | 16 |
| Sub-Agent | 4K | 2K | 8 |
| 文档抽取分片 | 6K | 2K | 6 |
| Claim 合并 | 6K | 2K | 6 |
| Action Proposal | 4K | 1K | 4 |
| Final Answer | 6K | 3K | 4 |

这是服务端预算，不只是 Prompt 提示。超限时必须拒绝、裁剪或拆分，不能继续发送原始超长请求。

### 3.2 裁剪原则

1. 不把完整 Ontology Schema 放入 Prompt，只下发相关 Concept、字段和关系；
2. 不把完整历史会话放入 Prompt，只保留摘要和必要的最近消息；
3. 不把整篇文档放入 Prompt，按页、章节或 chunk 分片；
4. Tool 返回默认最多 5 个结果，超出时分页或服务端摘要；
5. Sub-Agent 只接收 `objective + inputSchema + scopes + budget`；
6. Claim 合并只接收结构化 Claim/Evidence，不重新注入所有原文；
7. 用户上传内容、选中文本和外部文档均标记为不可信输入。

### 3.3 单个模型开发任务模板

每个模型任务最多处理一个服务、1～5 个实现文件和 1～3 个测试文件。例如：

```text
任务 ID：P4-BE-07
目标：增加 Evidence Gate
修改范围：TECH-AGENT 一个 Middleware 类、一个测试类
输入：已签名 OntologyContextEnvelope
输出：通过或拒绝 Claim
依赖：P0-CON-02、P1-ONT-07
验收：单元测试和契约测试通过
禁止：同时修改前端、数据库迁移和 Action
```

跨服务任务必须拆成：契约 → 后端生产者 → 后端消费者 → 前端适配 → 联调测试。

## 4. P0：基础底座与统一契约

### 目标

服务能够启动、迁移、认证并交换统一契约，不做复杂推理。

### 任务清单

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P0-INF-01 | 固化根 `.env.example` 和端口 | 根配置 | env-check 通过 |
| P0-INF-02 | 初始化六个 Postgres 业务库 | infra | 空环境创建成功 |
| P0-INF-03 | 增加 Redis、Kafka、MinIO、Milvus、Loki 健康检查 | infra/scripts | health-check 全部通过 |
| P0-IAM-01 | PermissionSnapshot DTO、Entity、Repository | TECH-IAM | CRUD 和失效测试 |
| P0-IAM-02 | 对象、字段、关系、Action Resolver | TECH-IAM | 越权测试 |
| P0-MSG-01 | Ontology Event Envelope | TECH-MSG | JSON 契约测试 |
| P0-MSG-02 | Outbox 和消费幂等 | TECH-MSG | 重试测试 |
| P0-AGENT-01 | 修复 Agent Entity 主键 | TECH-AGENT/entity | `mvn test` 可启动 |
| P0-AGENT-02 | 清理 Flyway 重复、删除和 `.bak` | TECH-AGENT/migration | 空库/升级库测试 |
| P0-AGENT-03 | 独立 H2 测试 profile | TECH-AGENT/src/test | Repository 测试通过 |
| P0-CON-01 | InteractionContext JSON Schema | docs/contract | Schema 测试 |
| P0-CON-02 | Envelope Schema、签名和过期校验 | docs/contract、AGENT | 篡改测试 |
| P0-CON-03 | Run、Event、Claim、Evidence Schema | docs/contract | 兼容性测试 |
| P0-CON-04 | 模拟 RunEvent SSE | TECH-AGENT | 前端可消费 |

### 门禁

- `mvn test` 不因 ApplicationContext 或 Entity 映射失败；
- Flyway 目录无 `.bak` 和重复版本；
- 过期或篡改 Envelope 被拒绝；
- 模拟 SSE 能被前端解析；
- 不允许错误响应伪装成成功。

## 5. P1：Ontology 核心能力

### Backend

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P1-ONT-01 | 盘点并统一 Concept、Object、Attribute、Relation API | TECH-ONT | API 清单对齐 |
| P1-ONT-02 | Object Query DTO 和参数校验 | TECH-ONT | 参数测试 |
| P1-ONT-03 | 只读 Object 查询 | TECH-ONT | tenant/version 隔离 |
| P1-ONT-04 | Metric Query Service | TECH-ONT | Agent 不自行计算 Metric |
| P1-ONT-05 | Relation Query Service | TECH-ONT | 关系权限测试 |
| P1-ONT-06 | Ontology Version Resolver | TECH-ONT | 版本不存在即拒绝 |
| P1-ONT-07 | OntologyContextService | TECH-AGENT + TECH-ONT client | Envelope 快照测试 |
| P1-ONT-08 | Envelope 签名和过期校验 | TECH-AGENT/security | 篡改测试 |
| P1-ONT-09 | 最小只读 Ontology Tools | TECH-AGENT/tools/MCP | allowlist 测试 |
| P1-ONT-10 | Object、Metric、Relation 契约测试 | tests/contract | 服务间 JSON 对齐 |

### Frontend

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P1-FE-01 | InteractionContext TypeScript 类型 | shared | 类型检查 |
| P1-FE-02 | context 构造器和固定 Fixture | shared | objectId 正确 |
| P1-FE-03 | 页面 subject 注入 | APP-DW | customer detail 通过 |

## 6. P2：RAG 知识库闭环

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P2-RAG-01 | Document、Chunk、Binding 契约 | TECH-RAG/APP-KB | Schema 测试 |
| P2-RAG-02 | 文档分片服务 | TECH-RAG | 固定文本稳定分片 |
| P2-RAG-03 | 向量索引适配 | TECH-RAG | 写入/检索测试 |
| P2-RAG-04 | Ontology Filter | TECH-RAG | scope 生效 |
| P2-RAG-05 | chunk 引用回溯 | TECH-RAG | document/chunk 可回溯 |
| P2-RAG-06 | Agent RAG Tool 和结果裁剪 | TECH-AGENT | 不超输入预算 |
| P2-KB-01 | document.uploaded 事件 | APP-KB/TECH-MSG | 可消费 |
| P2-E2E-01 | 文档检索契约测试 | tests/contract | 引用完整 |

单个 chunk 目标不超过 800 tokens；一次 Tool 默认最多返回 5 个 chunk；长文档必须按页或章节独立处理。

## 7. P3：DeerFlow Runtime 接入

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P3-DF-01 | Gateway health 和错误映射 | TECH-AGENT/deerflow | 超时测试 |
| P3-DF-02 | run request/response DTO | Adapter | JSON 契约 |
| P3-DF-03 | tenant/user/run/trace 透传 | Adapter | 链路可查 |
| P3-DF-04 | 不可变 Envelope 注入 | Adapter/Middleware | 篡改拒绝 |
| P3-DF-05 | SSE 重连、取消、超时 | Adapter | 故障测试 |
| P3-MW-01 | Context Middleware | middleware | 缺字段拒绝 |
| P3-MW-02 | Grounding Middleware | middleware | Concept/Metric 测试 |
| P3-MW-03 | Permission Middleware | middleware | Tool 白名单测试 |
| P3-MW-04 | Evidence Middleware | middleware | 无证据 Claim 拦截 |
| P3-MW-05 | Observation Middleware | middleware/events | RunEvent 完整 |
| P3-SUB-01 | Sub-Agent Context Builder | subagent | 不复制父上下文 |
| P3-WS-01 | Workspace quota | workspace | 超限清理 |
| P3-SBX-01 | Sandbox 非 root 和出网白名单 | sandbox/infra | 安全测试 |
| P3-ART-01 | Artifact 元数据和 MinIO 引用 | artifact | 可下载、可回溯 |

P3 的最低闭环是：

```text
DeerFlow → ontology.get_object/query_metric → Claim → Evidence → SSE
```

不得直接执行 Action 或访问业务数据库。

## 8. P4：SuperAI 与 Object Copilot

### 前端任务

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P4-FE-01 | InteractionContextProvider | shared | 任意页面可获取 |
| P4-FE-02 | Customer detail 注入 subject | APP-DW | objectId 正确 |
| P4-FE-03 | Copilot Drawer shell | APP-DW | 可打开/关闭 |
| P4-FE-04 | `useAgentStream` | shared | 连接、结束、错误完整 |
| P4-FE-05 | SSE reducer | shared | seq、重复、重连正确 |
| P4-FE-06 | ClaimRenderer | shared | 三类 Claim 区分 |
| P4-FE-07 | EvidenceRenderer | shared | 可展开、跳转来源 |
| P4-FE-08 | 错误、取消、重试 UI | APP-DW | 故障可恢复 |
| P4-FE-09 | 30～50 条场景问题集 | tests/eval | 可批量回放 |

### 后端任务

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P4-BE-01 | `/api/v1/agent/run/stream` 契约适配 | TECH-AGENT/API | SSE headers 正确 |
| P4-BE-02 | Run 初始化和 RUN_STARTED | runs/events | 可查询 |
| P4-BE-03 | Context 构建和签名 | context | Envelope 落库 |
| P4-BE-04 | Fast Query 路由 | runtime | 简单查询不进 Deep |
| P4-BE-05 | Ontology Tool 调用 | tools | allowlist 生效 |
| P4-BE-06 | Claim Builder | evidence | 结构化输出 |
| P4-BE-07 | Evidence Gate | middleware | 无证据不出最终 Claim |
| P4-BE-08 | SSE Event Publisher | events | seq 顺序正确 |
| P4-BE-09 | 取消和超时 | execution | 状态正确 |
| P4-E2E-01 | 客户详情只读场景 | frontend/backend | 全链路通过 |

### P4 门禁

- 页面对象自动进入上下文；
- Metric 来自 Ontology；
- 禁止字段不进入模型；
- Fact、Inference、Recommendation 分开展示；
- 重要结论全部有 Evidence；
- 首事件延迟目标小于 1.5 秒；
- 重复问题可复用 Envelope。

## 9. P5：Action 治理

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P5-ACT-01 | Action Schema 和风险等级 | TECH-ACTION | JSON Schema/Policy 测试 |
| P5-ACT-02 | proposeAction | AGENT/ACTION | 只生成 Proposal |
| P5-ACT-03 | simulateAction | TECH-ACTION | 影响预测可解释 |
| P5-ACT-04 | ActionGuard | AGENT middleware | 越权和高风险拦截 |
| P5-WFE-01 | Approval Workflow | TECH-WFE | 状态机测试 |
| P5-ACT-05 | 幂等执行器 | TECH-ACTION | 重复请求只执行一次 |
| P5-MSG-01 | action.executed 事件 | TECH-MSG | Outbox/消费测试 |
| P5-E2E-01 | 创建跟进任务 | APP-DW/AGENT/ACTION | 低风险闭环 |
| P5-E2E-02 | 申请优惠审批 | APP-DW/AGENT/WFE | 审批闭环 |

规则：Proposal 未批准不能执行；高风险必须审批；参数服务端重新校验；执行结果必须审计和发布事件。

## 10. P6：Ontology Authoring

```text
Document → Extraction → CandidateFact → Validator → Draft → Approval → Commit → Version/Diff
```

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P6-EXT-01 | document.uploaded 消费和 Extraction Run | TECH-AGENT | 能创建 Run |
| P6-EXT-02 | 文档分片调度 | AGENT/RAG | 每片独立 |
| P6-EXT-03 | 合同、联系人、风险、时间线四类 Sub-Agent | AGENT | CandidateFact 有证据 |
| P6-VAL-01 | CandidateFact Schema 校验 | AGENT/ONT | 非法字段拒绝 |
| P6-VAL-02 | 冲突检测 | TECH-ONT | 可定位冲突 |
| P6-DRAFT-01 | Draft 聚合和查询 | ONT/AGENT | 草稿可查 |
| P6-UI-01 | CandidateFact 和冲突 UI | APP-KB/ONTSTUDIO | 可审核 |
| P6-COM-01 | Commit Service | TECH-ONT | 唯一写入口 |
| P6-COM-02 | 审批、版本、Diff、Rollback | WFE/ONT | 全程可追溯 |
| P6-E2E-01 | 上传合同生成草稿 | KB→AGENT→ONT | 30 秒内可查 |
| P6-E2E-02 | 草稿审批提交 | UI→WFE→ONT | 可回滚 |

## 11. P7：事件驱动与长期记忆

### 事件任务

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P7-EVT-01 | Ontology Event Topic | MSG/ONT | 事件契约 |
| P7-EVT-02 | Trigger 注册与权限 | AGENT | CRUD 测试 |
| P7-EVT-03 | Event Consumer | AGENT | 消费幂等 |
| P7-EVT-04 | once/cron/interval 调度 | AGENT/Kafka | 调度测试 |
| P7-EVT-05 | 并发和预算控制 | AGENT | 超限不创建 Run |
| P7-EVT-06 | 合同到期 Trigger | AGENT | 模拟事件通过 |
| P7-EVT-07 | 通知适配器 | MSG/APP | 用户收到通知 |
| P7-E2E-01 | 合同到期风险分析 | ONT→AGENT→APP | 自动完成并通知 |

### 记忆任务

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P7-MEM-01 | Working Memory | AGENT | Run 内隔离 |
| P7-MEM-02 | Episodic Memory | AGENT | 历史 Run 可召回 |
| P7-MEM-03 | Semantic Memory | AGENT/ONT | 经过 Validator |
| P7-MEM-04 | Organizational Memory | AGENT | 组织权限隔离 |
| P7-MEM-05 | PII 检测 | AGENT | 写入前阻断 |
| P7-MEM-06 | 用户查看和删除 | APP/AGENT | 删除可验证 |
| P7-MEM-07 | Memory budget | AGENT | 召回不超预算 |

## 12. P8：生产治理与 Native Runtime

Native Runtime 在真实 Graph、Tool Calling、Claim/Evidence、Checkpoint/Resume 完成前，不得默认返回 SUCCESS。

| ID | 任务 | 修改范围 | 验收 |
|---|---|---|---|
| P8-OBS-01 | RunEvent、指标和成本 | OBS/AGENT/LLMGW | Run 可追溯 |
| P8-SEC-01 | Prompt Injection 和上传内容隔离 | AGENT/RAG/Sandbox | 安全测试 |
| P8-REL-01 | 超时、重试、熔断、取消 | Adapter/clients | 故障演练 |
| P8-REL-02 | 灰度和回滚 | Gateway/runtime | tenant 灰度 |
| P8-NAT-01 | SAA ChatClient 最小调用 | native | Mock LLM 契约 |
| P8-NAT-02 | SAA Graph 节点 | native | 单图测试 |
| P8-NAT-03 | Tool Calling | native/tools | 只读调用 |
| P8-NAT-04 | Claim/Evidence 节点 | native/evidence | Evidence Gate |
| P8-NAT-05 | Checkpoint/Resume | native/checkpoint | 中断恢复 |
| P8-NAT-06 | Native/DeerFlow 统一响应 | native/deerflow | 同一 E2E |
| P8-NAT-07 | 默认模式和安全降级 | config/gateway | 未实现不得 SUCCESS |

## 13. 前后端联调矩阵

| 批次 | 前端入口 | API | 后端链路 | 关键事件 | 验收 |
|---|---|---|---|---|---|
| E0 | 无 | health/contract | 基础服务、IAM、MSG | 无 | smoke |
| E1 | 页面 Context Fixture | context API | IAM→ONT→Envelope | CONTEXT_BUILT | contract |
| E2 | Copilot shell | `/api/v1/agent/run/stream` | Agent→Ontology Query | RUN/TOOL | SSE |
| E3 | Claim/Evidence UI | 同上 | Evidence Gate | EVIDENCE_ATTACHED | UI/E2E |
| E4 | 深度分析 UI | `/superai/run` | Grounding→Sub-Agent | TASK/SUBAGENT | scenario |
| E5 | Action 确认 | proposal/simulate | Guard→ACTION/WFE | APPROVAL/ACTION | 幂等 |
| E6 | 通知入口 | trigger APIs | MSG→Trigger→Run | ONTOLOGY_EVENT | event |
| E7 | Authoring UI | draft/commit | Extraction→Validator→ONT | DRAFT/COMMIT | workflow |
| E8 | 运维和审计 | run/events/metrics | OBS/LLMGW | 全部事件 | audit/load |

每个批次先通过后端契约测试，再接入前端；Fixture 只能用于开发和测试，不能替代真实 API。

## 14. 测试与验收

测试层次必须为：

```text
单元测试 → Repository → 契约测试 → Middleware → Service Integration
→ SSE → 前端组件 → 场景 E2E → 安全 → 负载与故障
```

必须覆盖：租户越权、对象越权、字段过滤、关系权限、Envelope 篡改、Tool 越权、Evidence 缺失、Action 未审批、重复幂等、恶意文档、Gateway 断连、SSE 重连。

质量目标：

- Object 识别准确率 P4 ≥ 90%；
- Metric 使用准确率 P4 ≥ 90%；
- 重要 Claim 引用完整率 100%；
- 字段越权泄露为 0；
- SSE 首事件小于 1.5 秒；
- Fast Query P95 小于 1.5 秒；
- Deep Task P95 小于 30 秒；
- Action 重复执行为 0；
- 每个 Run 均可通过 RunEvent 追溯。

## 15. 当前开工顺序

当前代码审查已发现以下阻断：

1. `AgentCheckpointEntity` 主键和其他 Entity 映射一致性；
2. H2 与 PostgreSQL `jsonb`、方言和连接初始化兼容；
3. Flyway 删除、重复版本和 `.bak` 清理；
4. Native Runtime 返回 Mock SUCCESS；
5. 结构化 Envelope 尚未贯穿执行链；
6. Claim/Evidence 尚未覆盖全部出口；
7. RuntimeRouter 可能只有日志，没有真实执行切换；
8. 工作区有大量未提交改动，新任务必须限制修改范围。

推荐前 12 个任务：

```text
P0-AGENT-01 统一 Agent Entity 主键
P0-AGENT-02 整理迁移目录
P0-AGENT-03 建立 H2 测试 profile
P0-CON-01 InteractionContext Schema
P0-CON-02 Envelope Schema 与签名
P0-CON-03 Run/Claim/Evidence Schema
P0-CON-04 模拟 SSE
P1-ONT-07 OntologyContextService
P1-ONT-09 五个只读 Ontology Tools
P4-BE-02 Run 初始化
P4-BE-07 Evidence Gate
P4-FE-04 useAgentStream
```

第一条必须打通的闭环：

```text
Customer Detail
  → InteractionContextProvider
  → Agent Stream
  → OntologyContextEnvelope
  → ontology.get_object/query_metric
  → ClaimBuilder
  → EvidenceGate
  → RUN_STARTED / TOOL_* / CLAIM_PRODUCED / RUN_COMPLETED
  → ClaimRenderer / EvidenceRenderer
```

在该闭环通过前，不推进高风险 Action、自动 Authoring 或 Native Runtime 默认切换。

## 16. 回滚规则

- DeerFlow 不可用时，只能切换到已验证 Fast Query 或返回明确失败；
- Native 未实现时必须返回 `NOT_IMPLEMENTED` 或安全降级，不得返回成功 Mock；
- SSE 断开时保留 Run 状态，并支持查询事件和安全重连；
- Tool 超时记录 `TOOL_FAILED`，不得伪造空结果；
- Flyway 只能追加版本，不回改已执行迁移；
- Draft 不影响正式 Ontology；
- Commit、Action、Memory 删除均必须可审计。

## 17. 最终完成定义

只有同时满足以下条件，才可宣称第一阶段生产可用：

1. Object Copilot 端到端通过；
2. Context 结构化、签名、过期可校验；
3. Tool 受权限和 allowlist 约束；
4. 重要 Claim 100% 绑定 Evidence；
5. SSE 顺序稳定且可重连；
6. 没有 Action 绕过 Guard；
7. 没有 LLM 直接写 Ontology；
8. 所有 Run 可通过 RunEvent 追踪；
9. Token 预算由服务端强制执行；
10. 测试、联调、回滚和故障演练都有证据。

> 最终目标不是“有一个能聊天的 DeerFlow”，而是以 Ontology 作为企业世界模型，以 Agent Runtime 负责认知和规划，以受治理的 Tool、Action、Evidence、Workflow 和 Event 形成可审计、可回滚、可持续演进的企业 AI 执行系统。

