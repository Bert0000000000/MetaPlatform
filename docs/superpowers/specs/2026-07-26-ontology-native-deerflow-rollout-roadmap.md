# Ontology-Native DeerFlow：全 8 阶段落地录像（串行）

> 版本：v1.0 · 2026-07-26
> 模式：全 8 阶段串行实施（用户确认）
> 配套：
> - 设计基线：`docs/superpowers/specs/2026-07-26-ontology-native-deerflow-integration-and-migration-plan.md`
> - 录像骨架：`docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md`（本文档）
> - 仓库基线：`D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform`

## 0. 当前落地现状（盘点）

| 域 | 现状 | 缺口 |
|---|---|---|
| 后端基础设施 | docker-compose 只含 Postgres/Redis/Nacos(v2.4.3-slim) | 缺 Milvus/MinIO/Loki/Kafka/RabbitMQ；Nacos 未升级 3.0 |
| IAM | TECH-IAM 189 文件，骨架齐全 | 缺对象级 / 字段级 / 关系级 / Action 级权限；缺 PermissionSnapshot |
| LLMGW | README 标注 Python + FastAPI（与全 Java 约束冲突） | 必须重写为 Java + SAA + OpenAI-compat |
| MSG | 53 文件 | 缺 Ontology Event Topic / Outbox / 租户路由 |
| ONT | 10 Controller（Concept/Entity/Attribute/Relation/Graph/Version/Discovery） | 缺 Object API / Metric Schema / Action Schema / Draft/Commit/Validator / Event |
| RAG | README 骨架，48 文件 | 缺 Milvus 适配 / 文档切片 / 引用回溯 / Ontology Filter |
| AGENT | 139 文件（Agent/Conversation/Plan/Check/Memory/Collab/Eval） | 缺 Sandbox / Sub-Agent / Skills / Scheduled / DeerFlow Adapter |
| ACTION | 80 文件 | 缺 simulateAction / proposeAction / ActionGuard |
| OBS | 107 文件，已实现日志 P0 | 缺 RunEvent / Claim / Evidence 标准化 |
| KB | 22 文件，仅 chunk_reviews + version_diffs | 缺 KB/Document/Chunk/Vector/Binding 全链路 |
| MCP | 228 文件 | 缺 Ontology 工具集 |
| WFE | 148 文件 | 缺 Temporal 适配 / Agent 等待节点 |
| 前端 | portal/dw/apphub/dashboard/superai/mcphub/arch | ontstudio 0 文件；缺 InteractionContext Provider / Claim/Evidence 组件 |

## 1. 全局节奏

| Phase | 周数 | 关键交付物 |
|---|---|---|
| P0 基础底座 | 9 | Nacos 3.0 / IAM / LLMGW Java / MSG Event |
| P1 Ontology 全能力 | 10 | Object/Metric/Action/Event/Version + Context Service + Draft/Validator/Commit |
| P2 RAG 知识库闭环 | 10 | KB/RAG 全链路 + Ontology Filter |
| P3 DeerFlow 接入 | 9 | Adapter + Middleware + Sub-Agent + Sandbox + Skills/Schedule/MCP/Artifact |
| P4 SuperAI 入口 | 6 | InteractionContext + Claim/Evidence 组件 + Object Copilot MVP + Fast/Deep 路由 |
| P5 Action 治理 | 7 | Action Schema + Guard + Proposal + Temporal/WFE + 受控 MVP |
| P6 Authoring 流水线 | 7 | Extraction 联通 + 候选事实 UI + Commit/Version/Diff/Rollback |
| P7 事件驱动与记忆 | 7 | Event Trigger + 合同到期 MVP + 四层记忆 |
| P8 治理与原生吸收 | 11 | 原生 Runtime 吸收 + 可观测/合规 + 灰度/国产化/文档 |

**总时长：约 76 周（按串行；可并行优化为 ~50 周）**

---

## 2. Phase 0：基础底座（9 周）

### P0.1 基础设施治理（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P0.1.1 | Nacos 3.0.2+ POC 完成（按 `docs/NACOS-3.0-POC-CHECKLIST.md`） | `docker-compose.yml` 替换 v2.4.3-slim → v3.0.2；`NACOS-3.0-POC-CHECKLIST.md` 全部勾选 | Nacos 控制台可访问，v3 API 全部 200 |
| P0.1.2 | docker-compose 增加 Milvus 2.5（standalone + MinIO 内部依赖）+ minio 服务（独立 bucket）+ loki + kafka + rabbitmq + redis-stack | `docker-compose.yml` | `docker compose up -d` 全部健康，端口 9000/3100/9092/5672/15672 可达 |
| P0.1.3 | Postgres 多库脚本：`metaplatform` / `metaplatform_kb` / `metaplatform_obs` / `metaplatform_ont` / `metaplatform_agent` / `metaplatform_action` | `infra/init-multiple-databases.sh` 或 `init-databases.sql` | 6 个库自动创建，字符集 `en_US.UTF-8` |
| P0.1.4 | 统一 `.env` 模板：所有新服务端口/账号/密钥集中在根 `.env.example` | `.env.example`、`docker-compose.yml` | `make env-check` 通过 |
| P0.1.5 | 健康检查脚本：`scripts/health-check.sh` 验证所有中间件 | `scripts/health-check.sh` | 一键输出 PASS/FAIL |

### P0.2 IAM 全栈 + 字段级权限（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P0.2.1 | PermissionSnapshot 数据模型（V1 migration）+ Repository | `TECH-IAM/src/main/resources/db/migration/V1__init_permission_snapshots.sql`；`PermissionSnapshotEntity/Repository/Service` | 可创建/读取/失效快照 |
| P0.2.2 | FieldPermissionResolver（字段级）+ ObjectPermissionResolver（对象级）+ RelationPermissionResolver（关系级） | `TECH-IAM/src/main/java/com/metaplatform/iam/permission/*` | 单测覆盖 4 种权限组合 |
| P0.2.3 | JWT 解析器扩展：注入 PermissionSnapshotId 到 MDC + request attribute | `JwtAuthFilter` 改造；`X-Permission-Snapshot` Header | 任意调用链可拿到快照 ID |
| P0.2.4 | IAM 公共 SDK：`iam-common-starter`（Maven 模块）提供 `@RequirePermission` 注解 + AOP | `TECH-IAM/iam-common-starter/` | 被 `TECH-ONT`、`TECH-ACTION` 引用 |

### P0.3 LLMGW Java 重写（3 周，与 P0.2 并行）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P0.3.1 | 新建 Java 模块 `TECH-LLMGW`（删除 Python 文件） | `TECH-LLMGW/pom.xml`、`TECH-LLMGW/src/main/java/com/metaplatform/llmgw/LlmGatewayApplication.java` | `mvn spring-boot:run` 启动成功 |
| P0.3.2 | OpenAI 兼容接口：`/v1/models` `/v1/chat/completions` `/v1/embeddings` | `OpenAiController.java`、`ChatService.java`、`EmbeddingService.java` | DeerFlow Adapter 用 `base_url=https://llmgw/v1` 调通 |
| P0.3.3 | 多模型路由：DASH_SCOPE / OPENAI / ANTHROPIC / LOCAL_VLLM | `ModelRouter.java`、`DashScopeAdapter.java`、`OpenAiAdapter.java` | 配置切换生效 |
| P0.3.4 | 限流 + 熔断（Resilience4j）+ Token 配额 + 成本核算 | `RateLimiterConfig.java`、`TokenLedgerService.java` | 压测 100 QPS 触发限流 |
| P0.3.5 | Prompt/Response 审计（写 `TECH-OBS` + 自身 DB） | `AuditLogger.java` | 全量 LLM 调用可追溯 |

### P0.4 TECH-MSG 完整化 + Ontology Event（2 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P0.4.1 | Kafka 客户端封装：`OutboxPublisher`（Outbox 模式）+ `EventEnvelope` Schema | `TECH-MSG/src/main/java/com/metaplatform/msg/outbox/*` | 事务内写入 outbox，独立进程发布到 Kafka |
| P0.4.2 | Ontology Event Topic 注册：`ontology.concept.updated` `ontology.entity.changed` `ontology.action.executed` `ontology.commit.published` `document.uploaded` | `TECH-MSG/src/main/resources/application.yml`（topics 列表） | Kafka 启动后自动创建 |
| P0.4.3 | 消费者 SDK：`@EventTopicListener` 注解 + 自动注册 | `TECH-MSG/msg-consumer-starter/` | `TECH-AGENT` 引用，订阅 `document.uploaded` 成功 |

---

## 3. Phase 1：Ontology 全能力（10 周）

### P1.1 Ontology 现状补齐（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P1.1.1 | Concept 增强：属性、类型、唯一性约束、版本化 | `TECH-ONT/.../concept/Concept.java`、`V2__concept_constraints.sql` | 单测：约束冲突被拒 |
| P1.1.2 | Object API：`createObject / getObject / queryObjects / getTimeline` | `ObjectController.java`、`ObjectService.java` | Postman 调通 |
| P1.1.3 | Metric Schema：`defineMetric / queryMetric / explainMetric` | `MetricController.java`、`MetricEntity.java` | 注册 `customer.revenue_12m` 公式 SQL 可执行 |
| P1.1.4 | Action Schema：`defineAction / listActions`（参数 + 权限 + 审批策略） | `ActionController.java`、`ActionEntity.java` | 注册 `CreateFollowUpTask` 可查询 |
| P1.1.5 | Ontology Version + Diff API（V2~V4 migration） | `OntologyVersionController.java`（已存在需扩展）、`OntologyCommitEntity.java` | `GET /ont/versions/diff?from=v1&to=v2` 返回结构化 diff |

### P1.2 Ontology Context Service + Permission Snapshot（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P1.2.1 | `OntologyContextEnvelope` DTO（不可变） + JSON Schema | `envelope/` 包 | Schema 校验通过 |
| P1.2.2 | `OntologyContextController`：POST `/ont/context/build` | `OntologyContextController.java`、`ContextBuilderService.java` | 入参 `{conceptCode, objectId, viewState}` 返回完整 Envelope，过期 5 分钟 |
| P1.2.3 | PermissionSnapshot 集成：把 IAM 快照 ID 注入 Envelope | `PermissionSnapshotResolver.java` | 字段 `bankAccount` 在快照 deny 列表时被脱敏 |
| P1.2.4 | Envelope 签名（HS256）+ TTL + 失效策略 | `EnvelopeSigner.java` | 篡改 Envelope 后被 Agent 拒绝 |

### P1.3 Ontology Draft / Validator / Commit Service（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P1.3.1 | `OntologyDraftEntity`、`CandidateFactEntity` + migration V5 | V5 SQL + Entities | 可存草稿 |
| P1.3.2 | `OntologyValidator`：Schema / 规则 / 冲突 / 影响范围 | `OntologyValidatorService.java` | 故意制造冲突返回报告 |
| P1.3.3 | `OntologyCommitService`：proposeDraft / approve / publish / rollback / diff | `OntologyCommitController.java` | 全链路 Postman 调通 |
| P1.3.4 | Ontology Event 发布：Commit 完成后发 `ontology.commit.published` | `OntologyEventPublisher.java` | Kafka 收到事件 |
| P1.3.5 | 审计落 `TECH-OBS` + 入库 `ontology_commits` 表 | `OntologyCommitAuditEntity` | 任意 Commit 可追溯 |

---

## 4. Phase 2：RAG 知识库闭环（10 周）

### P2.1 APP-KB 数据模型 + 文档/切片/向量化（5 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P2.1.1 | 数据模型 V2：kb_knowledge_bases / kb_documents / kb_chunks / kb_chunk_vectors / kb_kb_bindings / kb_retrieval_configs | V2 SQL + Entities | Flyway migrate 成功 |
| P2.1.2 | KnowledgeBase CRUD + 版本 + 回滚 | `KnowledgeBaseController`（已有需扩展） | 走完 create → snapshot → rollback |
| P2.1.3 | 文档上传 + MinIO 存储 + 解析（docx/pdf/txt） | `DocumentsController`、`DocumentIngestionService` | 上传 docx 落到 MinIO |
| P2.1.4 | 切片策略模板（按段落 / 标题 / Token）+ Chunker SPI | `ChunkStrategyService.java` | 不同策略产出切片可对比 |
| P2.1.5 | Embedding + 写入 Milvus（统一 collection `kb_chunks_v1`） | `EmbeddingService.java`、`MilvusWriter.java` | chunks 落入 Milvus，recall@10 ≥ 0.8 |
| P2.1.6 | ChunkReview 流（已有，需补前端） | `ChunkReviewController`（已有）+ 前端页面 | UI 审核通过 |

### P2.2 TECH-RAG Milvus 适配 + Ontology Filter（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P2.2.1 | Milvus 客户端（基于 Milvus Java SDK 2.5） | `MilvusClientConfig.java`、`MilvusAdapter.java` | 连通性 OK |
| P2.2.2 | 混合检索：BM25 + 向量召回 + RRF 重排 | `HybridSearchService.java` | 公开测试集 NDCG@10 ≥ 0.7 |
| P2.2.3 | Ontology Filter：按 Concept / Object / 字段约束检索范围 | `OntologyFilterTranslator.java` | 入参 `concept=Customer` 仅召回 Customer 知识 |
| P2.2.4 | Evidence 返回结构：`Evidence { ref, fragment, ts, type }` | `Evidence.java` | 所有 Top-K 命中带 Evidence |
| P2.2.5 | RAG 服务 API：`POST /rag/search`、`POST /rag/embed`、`POST /rag/retrieve` | `RagController.java` | 鉴权 + 限流生效 |

### P2.3 检索测试 UI + 引用回溯 + KB → Ontology 抽取入口（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P2.3.1 | `app/kb` 检索测试页（React + AntD） | `metaplatform-frontend/apps/kb/src/pages/SearchTestPage.tsx` | 输入 → Top-K + Evidence |
| P2.3.2 | 文档详情页：切片、向量化状态、引用 | `metaplatform-frontend/apps/kb/src/pages/DocumentDetailPage.tsx` | 点击 Evidence 跳转 |
| P2.3.3 | Ontology 抽取 Tab（stub）：显示“待接入 Extraction Agent” | `OnboardingExtractionTab.tsx` | 提示文案正确 |

---

## 5. Phase 3：DeerFlow 接入（9 周）

### P3.1 DeerFlow Adapter + Ontology Middleware（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P3.1.1 | `DeerFlowAdapter`：封装 Gateway API（create run / SSE / cancel / artifact） | `TECH-AGENT/.../deerflow/DeerFlowAdapter.java` | 单测：API 调通 |
| P3.1.2 | `OnboardingContextMiddleware`：从 `OntologyContextService` 注入 Envelope | `TECH-AGENT/.../middleware/OnboardingContextMiddleware.java` | Thread 启动前 Envelope 已就绪 |
| P3.1.3 | `OnboardingGroundingMiddleware`：自然语言 → Concept/Metric/Action 候选 | `OnboardingGroundingMiddleware.java` | 30 个示例 NL 输入 90% 正确 |
| P3.1.4 | `OnboardingPermissionMiddleware`：每 Tool Call 前重新校验 | `OnboardingPermissionMiddleware.java` | 篡改 Envelope 后被拒绝 |
| P3.1.5 | `OnboardingEvidenceMiddleware`：每个 Claim 强制绑定 Evidence | `OnboardingEvidenceMiddleware.java` | 缺证据 Claim 被拦截 |
| P3.1.6 | RunEvent 上报 → `TECH-OBS` | `RunEventPublisher.java` | 所有 Run 事件可查 |

### P3.2 Sub-Agent + Workspace + Sandbox（5 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P3.2.1 | Sub-Agent 上下文裁剪：仅下发 `objective + inputSchema + scopes + budget` | `SubAgentContextBuilder.java` | 父子上下文隔离 |
| P3.2.2 | Thread Workspace：PVC + MinIO 落盘 | `WorkspaceProvisioner.java` | 任务结束文件落到 MinIO |
| P3.2.3 | K8s Sandbox Provider：每 Thread 一个 Pod | `K8sSandboxProvider.java` | Pod 启动 < 10s |
| P3.2.4 | Sandbox 安全策略：非 root / 只读 rootfs / NetworkPolicy / 出网白名单 | `SandboxSecurityPolicy.java` | 渗透测试通过 |
| P3.2.5 | Sandbox 资源限制：CPU/Mem/Disk/Time + 清理 | `ResourceQuota.java` | 超限自动 kill |

### P3.3 Skills / Scheduled Run / MCP / Artifact（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P3.3.1 | Skill Registry：定义/加载/版本 | `SkillRegistry.java` | Skill `web_research` 可注入 |
| P3.3.2 | Scheduled Run：Kafka 调度 + `once / cron / interval` | `ScheduledAgentService.java` | 创建 cron 任务可触发 |
| P3.3.3 | MCP 注册 Ontology Tools（21 个）到 DeerFlow | `OnboardingMcpServer.java` | DeerFlow 可发现 ontology.* |
| P3.3.4 | Artifact：报告落到 MinIO + 元数据入 `agent_artifacts` 表 | `ArtifactService.java` | UI 可见可下载 |

---

## 6. Phase 4：SuperAI 统一入口（6 周）

### P4.1 InteractionContext Provider + 公共组件（2 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P4.1.1 | `InteractionContextProvider`：捕获当前 `appCode/pageCode/subject` | `metaplatform-frontend/packages/shared/src/interaction/InteractionContextProvider.tsx` | 任意页面 `useInteractionContext()` |
| P4.1.2 | `ClaimRenderer`：Fact/Inference/Recommendation 三类 | `packages/shared/src/renderers/ClaimRenderer.tsx` | 三类视觉区分 |
| P4.1.3 | `EvidenceRenderer`：引用点击跳转 | `EvidenceRenderer.tsx` | 点击可跳到 Object/Document |
| P4.1.4 | `ArtifactViewer`：报告/图表预览 | `ArtifactViewer.tsx` | 下载与预览可用 |

### P4.2 客户详情 Object Copilot MVP（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P4.2.1 | 客户详情页接入 SuperAI 抽屉 | `metaplatform-frontend/apps/dw/src/components/CustomerCopilotDrawer.tsx` | 抽屉可打开 |
| P4.2.2 | 调用 `/agent/run/stream` SSE | `useAgentStream.ts` | 流式渲染 |
| P4.2.3 | 返回 Claim + Evidence + 建议（不执行 Action） | 后端 Envelope 校验 | 无权限字段不可见 |
| P4.2.4 | 准确率评估：30 个客户场景问题 | `tests/eval/customer-copilot-30.json` | 普通 RAG vs Ontology-Native 对比报告 |

### P4.3 跨域深度分析 + Fast/Deep 路由（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P4.3.1 | `OnboardingGroundingMiddleware` 跨对象识别 | 复用 P3.1.3 | 概念/Metric 命中 ≥ 90% |
| P4.3.2 | 路由策略：`Fast Query` vs `Deep Task` | `RuntimeRouter.java` | P95 < 1.5s / < 30s |
| P4.3.3 | Sub-Agent 拆分：销售 / 客户 / 服务 | `SubAgentRouter.java` | 三 Agent 并行收敛 |

---

## 7. Phase 5：Action 治理（7 周）

### P5.1 Ontology Action Schema 化 + ActionGuard（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P5.1.1 | Action Schema 元数据扩展（参数 Schema、风险等级、审批模板） | `OnboardingAction.java`（Schema 元数据） | 注册 Action 含完整元数据 |
| P5.1.2 | `TECH-ACTION` 扩展：`proposeAction / simulateAction` | `ActionProposalController.java`、`SimulationService.java` | simulate 预测影响 |
| P5.1.3 | `OnboardingActionGuardMiddleware`：权限 / 风险 / 审批分级 | `OnboardingActionGuardMiddleware.java` | 高风险进入审批 |
| P5.1.4 | ActionPolicy YAML：注册默认风险模板 | `TECH-ACTION/src/main/resources/action-policies.yaml` | 加载生效 |

### P5.2 Action Proposal + 审批 + Temporal/WFE（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P5.2.1 | Temporal Worker（轻量）：接入 `io.temporal:temporal-spring-boot-starter` | `TECH-WFE/.../temporal/TemporalWorker.java` | 高风险 Action 走 Workflow |
| P5.2.2 | 审批任务进入 WFE 工作流（IAM 审批人解析） | `ApprovalWorkflow.java` | 待办可在 `APP-DW` 看到 |
| P5.2.3 | 审批通过后回到 `TECH-ACTION` 幂等执行 | `ActionExecutor.java` | 重复请求去重 |
| P5.2.4 | Ontology Event：`ontology.action.executed` 发布 | `ActionEventPublisher.java` | Kafka 收到 |

### P5.3 受控 Action MVP（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P5.3.1 | 风险客户分析 → 创建跟进任务 + 申请优惠 | `RiskCustomerActionScenario.java` | 一句话触发 |
| P5.3.2 | 客户经理待办 UI（已有 APP-DW 待办页需扩展） | `MyApprovalsPage.tsx` | 通过/拒绝可用 |

---

## 8. Phase 6：Ontology Authoring 流水线（7 周）

### P6.1 Document Ingestion → Extraction Agent 联通（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P6.1.1 | `APP-KB` 上传完成后发 `document.uploaded` 事件 | `DocumentEventPublisher.java` | Kafka 收到 |
| P6.1.2 | `TECH-AGENT` 订阅事件并启动 Extraction Run | `DocumentExtractionTrigger.java` | 30s 内出现 CandidateFact |
| P6.1.3 | 4 个内置 Sub-Agent：合同 / 联系人 / 风险 / 时间线 | `ExtractionAgent.java` | 4 类 Sub-Agent 并行 |
| P6.1.4 | CandidateFact 输出：concept/object/property/value/evidence/confidence | `CandidateFactEntity.java` | 入库可查 |

### P6.2 Candidate Fact UI + 冲突展示 + 草稿审批（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P6.2.1 | Ontology 抽取 Tab：三列（当前 / 候选 / 操作） | `OnboardingDraftTab.tsx` | 三列布局 |
| P6.2.2 | 冲突高亮（红/黄/绿）+ 人工合并 | `ConflictBadge.tsx`、`MergeDialog.tsx` | 可合并 |
| P6.2.3 | 草稿审批页面：Reviewer 评论 + 通过/拒绝 | `DraftApprovalPage.tsx` | 审批链路完整 |

### P6.3 Commit Service + Version diff + 回滚（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P6.3.1 | 接入 P1.3 Commit Service | 复用 | Commit 成功 |
| P6.3.2 | Diff 视图：新增/修改/删除 | `VersionDiffView.tsx` | 视觉清晰 |
| P6.3.3 | 一键回滚 | `RollbackButton.tsx` | 回退到指定版本 |

---

## 9. Phase 7：事件驱动与记忆（7 周）

### P7.1 Ontology Event Trigger + 调度框架（3 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P7.1.1 | Trigger 数据模型 + 配置 UI | `TriggerEntity.java`、`TriggerConfigPage.tsx` | 可配置 event+规则 |
| P7.1.2 | Trigger Engine 消费 Event → 创建 AgentRun | `TriggerEngine.java` | 事件到达 30s 内启动 |
| P7.1.3 | 并发与预算控制 | `TriggerBudgetGuard.java` | 防止触发风暴 |

### P7.2 合同到期预警 MVP（2 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P7.2.1 | `Contract.expiring` 事件 + 提前 45 天触发 | `ContractExpiringTrigger.java` | UI 显示 Agent 分析 |
| P7.2.2 | 续约风险评估 → 创建任务 → 通知 | 复用 P5.3 | 端到端跑通 |

### P7.3 企业长期记忆（5 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P7.3.1 | Working / Episodic / Semantic / Org 四层数据模型 | V* SQL + Entities | Flyway 通过 |
| P7.3.2 | 记忆提取（每次 Run 结束异步抽取） | `MemoryExtractionService.java` | 不阻塞 Run |
| P7.3.3 | PII 检测 + 租户隔离 + 用户可删除 | `MemoryPolicyService.java` | 合规检查通过 |
| P7.3.4 | Candidate Fact 回写（受 P6 治理） | 复用 P1.3 | 误写率 < 1% |
| P7.3.5 | 记忆检索 API：`POST /memory/search` 带 Evidence | `MemoryController.java` | 返回引用 |

---

## 10. Phase 8：治理与原生吸收（11 周）

### P8.1 DeerFlow 优秀模式吸收为 Java + SAA 原生 Runtime（9 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P8.1.1 | Middleware Chain Java 接口：`AgentMiddleware` + `AgentMiddlewareChain` | `TECH-AGENT/.../runtime/Middleware*.java` | 5 个原生 Middleware |
| P8.1.2 | Sub-Agent 隔离抽象 | `SubAgentExecutor.java` | 替换 DeerFlow 同等能力 |
| P8.1.3 | Skill Registry 原生化 | `SkillRegistryService.java` | 兼容 YAML/JSON |
| P8.1.4 | Scheduled Agent Run | `ScheduledAgentService.java` | 不依赖 DeerFlow Scheduler |
| P8.1.5 | Sandbox SPI（K8s + 本地） | `SandboxProvider.java` 接口 + 2 实现 | 可插拔 |
| P8.1.6 | DeerFlow 降级为可选高级研究执行器 | 配置开关 | 默认走原生 Runtime |

### P8.2 全链路可观测 + 合规审计 + 多租户压测（4 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P8.2.1 | RunEvent / Claim / Evidence / ActionProposal / OntologyCommit 全量入仓 | `TECH-OBS` 扩展 | 任意 Run 端到端可还原 |
| P8.2.2 | 告警策略（错误率 / Token / 时延 / 触发失败） | `TECH-OBS/.../alerting/*` | 告警可达钉钉/企微 |
| P8.2.3 | 多租户压测：1000 并发 / 50 租户 | `tests/perf/multi-tenant.js` | 无 OOM/P99 ≤ 5s |

### P8.3 公测灰度 + 国产化适配 + 文档体系（2 周）

| # | 任务 | 文件 / 产物 | 验收 |
|---|---|---|---|
| P8.3.1 | 公测灰度：10% → 50% → 100% | `TECH-GW` 灰度策略 | 无 P0 事故 |
| P8.3.2 | 国产模型（豆包/通义/DeepSeek）+ 国产数据库 + 国产中间件 | 适配器 | 切换生效 |
| P8.3.3 | 文档体系：用户手册 / 运维手册 / 安全白皮书 | `docs/handbook/*` | 评审通过 |

---

## 11. 里程碑与决策点

| M | 周期 | 准入条件 | 决策点 |
|---|---|---|---|
| M0 | P0 结束 | LLMGW Java 重写完成 | 是否继续全 Java 路线 |
| M1 | P1 结束 | Ontology Draft/Commit 可用 | 是否进入 Authoring 流水线 |
| M2 | P2 结束 | KB+RAG 全链路可用 | 是否开放 DeerFlow Adapter 给业务 |
| M3 | P3 结束 | DeerFlow Sandbox 安全通过审计 | 是否启用 K8s 生产 Sandbox |
| M4 | P4 结束 | Object Copilot MVP 准确率达标 | 是否进入跨域分析 |
| M5 | P5 结束 | Action Guard + 审批通过渗透测试 | 是否允许生产环境执行 Action |
| M6 | P6 结束 | Candidate Fact 误写率 < 1% | 是否开放 Ontology 自动 Commit |
| M7 | P7 结束 | 合同到期预警稳定 | 是否全面开启事件驱动 |
| M8 | P8 结束 | 原生 Runtime 通过全量回放测试 | 是否全面替换 DeerFlow |

---

## 12. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Nacos 3.0 POC 未完成 | P0 卡死 | 优先验证 v3 API，必要时保留 v2.4.3 |
| LLMGW Java 重写工期不准 | P3 延期 | 砍适配器数量，先 DashScope + OpenAI |
| DeerFlow 升级破坏 Adapter | P3 反复 | 严格用 Sub-Agent/Hook 接口，少改核心 |
| K8s 集群不具备 | P3.2 卡死 | 本地用 kind/k3d，生产由运维提供 |
| Sandbox 安全审计不通过 | P5 延期 | NetworkPolicy / 资源限制先行 |
| Candidate Fact 误写率高 | P6 延期 | Phase 1 默认全部人工审批 |
| 长期记忆数据合规 | P7 风险 | PII 检测 + 租户隔离 + 用户可删除 |

---

## 13. 总时长估算

| 模式 | 周数 | 说明 |
|---|---|---|
| 串行（本文档） | ~76 周 | 用户已选定 |
| 3 线并行（后端/前端/AI 工程） | ~50 周 | 可压缩 |
| 仅 MVP（到 P4.2） | ~22 周 | 关键路径 |

---

## 14. 立即可执行的下一批 PR 清单（Phase 0 启动）

1. **PR P0.1.1**：`docker-compose.yml` Nacos 升级 v3.0.2 + 增加 Milvus/MinIO/Loki/Kafka/RabbitMQ 服务
2. **PR P0.1.3**：`infra/init-multiple-databases.sql` 多库脚本
3. **PR P0.1.5**：`scripts/health-check.sh` 一键健康检查
4. **PR P0.2.1**：`TECH-IAM` PermissionSnapshot V1 migration + Entity/Repository/Service
5. **PR P0.3.1**：`TECH-LLMGW` Java 模块初始化（删除 Python 文件、新建 pom.xml + Spring Boot 启动类）
6. **PR P0.3.2**：OpenAI 兼容接口 `/v1/models` `/v1/chat/completions` `/v1/embeddings`
7. **PR P0.4.1**：`TECH-MSG` OutboxPublisher + EventEnvelope
8. **PR P0.4.2**：Kafka Topic 注册（5 个 Ontology Event）
