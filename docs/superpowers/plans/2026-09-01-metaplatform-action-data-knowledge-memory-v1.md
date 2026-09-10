# MetaPlatform Action、数据知识与记忆 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Use checkbox state in the Sprint Board; do not mark a Feature Done from this document alone.

**Goal:** 完成 Action 与工作流中心、数据与知识中心、记忆中心的首发全生命周期与全部交付接口，使自然语言任务能够形成受约束计划，查询可追溯数据和知识，在人工确认后可靠执行，并在跨宿主切换时使用受治理记忆。

**Architecture:** Action、Data/Knowledge、Memory 是三个独立 bounded context。Action 领域持有 ActionVersion、OrchestrationPlan 与 WorkflowExecution 契约；数据知识领域持有数据产品、文档、索引、图谱投影、查询执行与证据；记忆领域持有候选、审核、晋升、冲突、撤销和删除传播。LangGraph 仅在适配器后生成智能编排计划，Temporal 仅处理持久等待、重试、补偿和定时，Employee Runtime 仍是 Run/Lease 权威。RAGFlow 和 MemoryCore 是可替换开源实现，不复制平台 ACL、来源和治理事实。

**Tech Stack:** Python 3.12、FastAPI、Pydantic 2、PostgreSQL/Alembic、OpenFGA/OPA、LangGraph Adapter、Temporal、NATS JetStream、RAGFlow、Trino、Jena Projection、MemoryCore Adapter、OpenTelemetry、React/Vite、Playwright。

**Spec:** docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md; docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md; docs/superpowers/plans/2026-09-01-mvp-01-order-insight-action.md; docs/superpowers/plans/2026-09-01-mvp-02-contract-review.md; docs/superpowers/plans/2026-09-01-mvp-04-ontology-operations.md

## Global Constraints

- 每个对象、生命周期操作和对外 Surface 必须在 requirements.yaml 与 interface-registry.yaml 有唯一记录；模块级汇总不能替代对象级证据。
- 智能编排只产生 OrchestrationPlan 和 SubRun 请求；不得直接写业务数据、批准 Action、持有 Lease 或冒充 WorkflowExecution。
- Temporal 只持有 WorkflowExecution；短、确定性、无持久等待的步骤不强制进入 Temporal。
- RAGFlow 负责解析、切片、索引和召回实现；平台持有 KnowledgeBase ACL、GovernedSourceDocument、来源跨度、索引快照和使用证据。
- MemoryCore 负责记忆存取实现；平台持有策略、候选、审核、晋升、冲突、撤销、删除墓碑和审计权威。首发记忆功能不得以 NOT_IN_RUNTIME 绕过。
- 查询路径只读；任何业务副作用必须通过固定 ActionVersion、Approval、Lease、幂等台账和 Receipt。
- 所有数据库变更仅由 Alembic migration 执行；表、RLS、索引、约束、Outbox 必须同一版本交付。
- 对象创建、读取、变更、退役、发布、执行、重放、删除和恢复都必须具备租户隔离、双主体授权、关联 ID 和追加式审计。
- 只有真实依赖 Gate PASSED、接口消费者契约通过、业务 E2E 与回退演练齐备后，相关 Feature 才能 Done。

---

## Delivery Object Matrix

| Context                   | 必须交付的管理对象                                                                                                                                                                                 | 首发生命周期                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Action                    | ActionDefinition、ActionVersion、OntologyActionBinding、ActionImplementationBinding、ActionRiskPolicy、Pre/PostCondition、CompensationDefinition                                                   | 创建/复制、查询/Diff、修改草稿、评测、发布、撤销、回滚、归档             |
| Intelligent orchestration | IntelligentOrchestrationDefinition/Version、OrchestrationPlan                                                                                                                                      | 创建/版本化、查询路径与依据、重规划、约束、取消、终止、归档              |
| Workflow                  | WorkflowDefinition/Version、WorkflowNode/Edge、Trigger/Schedule、WorkflowExecution、ActivityLedger/Inbox                                                                                           | 设计、校验、发布、触发、暂停/恢复/取消、信号、重试、补偿、封存           |
| Data                      | DataSourceDefinition、DataConnection、DataAsset/Dataset、DataProduct、Field/SemanticMapping                                                                                                        | 注册、发现、授权查询、Schema 快照、更新治理元数据、轮换、停用、废弃      |
| Pipeline/quality          | PipelineDefinition/Version、PipelineRun、DataQualityRule/Result                                                                                                                                    | 设计、校验、发布、调度、暂停/恢复/取消、重跑/回填、阻断、归档            |
| Knowledge                 | KnowledgeBase、GovernedSourceDocument、KnowledgeChunk、IndexSnapshot                                                                                                                               | 创建、上传/同步、解析、查询、重解析/重索引、来源撤回、删除传播、归档     |
| Graph/query/lineage       | KnowledgeGraphProjection、FederatedQueryTemplate、QueryExecution/Evidence、Lineage/ImpactView                                                                                                      | 构建、查询、重建/切换、执行、订阅变更、影响分析、导出证据、回收          |
| Memory                    | MemoryPolicy、MemoryCandidate、MemoryReview、MemoryItem、MemoryCollection/Scope、MemoryRetrievalRecord、MemoryConflict、MemoryCorrection/Revocation、MemoryDeletionRequest、MemorySnapshot/Restore | 创建、查询、审核、晋升、检索、反馈、冲突解决、撤销、删除传播、快照、恢复 |

## Required Interface Surfaces

| Surface            | 首发接口                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST/OpenAPI       | /actions、/orchestration-definitions、/orchestration-plans、/workflows、/workflow-executions、/data-sources、/data-connections、/data-assets、/data-products、/pipelines、/pipeline-runs、/quality-rules、/knowledge-bases、/documents、/indexes、/knowledge-graphs、/federated-queries、/lineage、/memory/\* |
| MCP                | discover_data_products、query_data_product、search_knowledge、get_evidence、propose_action_plan、get_action_status、search_memory；MCP 只暴露已授权投影，不承担发布与审批                                                                                                                                     |
| Events             | ActionVersionReleased、WorkflowExecutionChanged、DataSchemaChanged、PipelineRunChanged、KnowledgeSnapshotReleased、SourceWithdrawn、MemoryCandidateCreated、MemoryRevoked、MemoryDeletionCompleted，均使用 CloudEvents/AsyncAPI                                                                               |
| UI                 | Action 库、工作流设计/运行、数据目录/连接/管道/质量、知识库/文档/索引/图谱/联邦查询、记忆策略/候选审核/冲突/删除/恢复                                                                                                                                                                                         |
| Consumer contracts | Employee Runtime、Ontology、Application、Artifact、MCP Gateway、四宿主 Connector、运营中心；每个消费者固定 Schema/version/Digest                                                                                                                                                                              |

### Task 1: Freeze contracts, authority and migrations

**Files:**

- Create: docs/adr/2026-09-01-intelligent-orchestration-engine.md
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/action/contracts.py
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/data_knowledge/contracts.py
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/memory/contracts.py
- Create: mate-platform-backend/packages/mate-kernel/tests/test_action_data_memory_contracts.py
- Create: mate-platform-backend/alembic/versions/20260901_0025_action_data_knowledge_memory_v1.py (revision = 0025_action_data_knowledge_memory_v1; down_revision = 0024_ontology_skill_mcp)
- Create: mate-platform-backend/tests/migrations/test_0025_action_data_knowledge_memory_v1.py
- Modify: acceptance/release/v1/requirements.yaml
- Modify: acceptance/release/v1/interface-registry.yaml
- Modify: acceptance/release/v1/ownership-matrix.yaml

**Interfaces:**

- Produces immutable identifiers and state machines for every object in the Delivery Object Matrix.
- Consumes TenantId, HumanUserId, EmployeeVersionDigest, RunId, LeaseId, ArtifactDigest, OntologyReleaseDigest and PolicyDigest.
- Event envelopes require event_id, tenant_id, subject, correlation_id, causation_id, schema_version, object_id, object_version and occurred_at.

- [ ] Write failing contract tests for valid transitions, immutable released versions, tenant-qualified identifiers, evidence provenance and stable error codes.
- [ ] Write failing migration tests for all tables, foreign keys, unique/idempotency constraints, RLS policies, append-only ledgers, deletion tombstones and transactional Outbox.
- [ ] Implement Pydantic contracts and the 0025 expand migration without runtime DDL or default cross-tenant access.
- [ ] Populate object × operation × surface Requirement and InterfaceRecord rows; assign one DRI and approver per database, API, event and UI boundary.
- [ ] Run: pytest mate-platform-backend/packages/mate-kernel/tests/test_action_data_memory_contracts.py mate-platform-backend/tests/migrations/test_0025_action_data_knowledge_memory_v1.py -q
- [ ] Commit: git commit -m "feat(kernel): define action data knowledge memory contracts"

### Task 2: Deliver Action library and deterministic execution boundary

**Files:**

- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/action/domain.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/action/repository.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/action/service.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/actions.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_action_lifecycle.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_action_execution_fencing.py
- Modify: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/main.py
- Create: metaplatform-frontend/apps/web/src/api/actionCenter.ts
- Create: metaplatform-frontend/apps/web/src/pages/action/ActionLibraryPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/action/ActionVersionPage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/action-library.spec.ts

**Interfaces:**

- REST: ActionDefinition CRUD; ActionVersion draft/evaluate/release/revoke/rollback; binding/risk/condition/compensation CRUD; dry-run/execute/status.
- MCP: propose_action_plan and get_action_status return Artifact/Run references, never an untracked side effect.
- Events: ActionVersionReleased, ActionExecutionRequested, ActionExecutionCompleted, ActionExecutionFailed.

- [ ] Write failing API and PostgreSQL concurrency tests for draft-only updates, release immutability, ontology binding impact, risk policy, one-use approval, stale Lease, dual-subject authorization and idempotent effect.
- [ ] Implement repositories and services; execute only fixed ActionVersion Digest and re-read current preconditions immediately before the side effect.
- [ ] Implement UI list/detail/version/Diff/risk/binding/test/release/revoke/rollback flows with denial and degraded-state views.
- [ ] Prove retry, concurrent confirm and stale callback yield one ActivityLedger entry and one Receipt; prove irreversible actions cannot claim compensation.
- [ ] Run backend tests and: pnpm --dir metaplatform-frontend/apps/web exec playwright test tests/e2e/action-library.spec.ts
- [ ] Commit: git commit -m "feat(action): deliver governed action lifecycle"

### Task 3: Deliver intelligent orchestration and Temporal workflow

**Files:**

- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/intelligent/adapter.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/intelligent/langgraph_adapter.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/intelligent/service.py
- Create: mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/domain/workflow.py
- Create: mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/api/workflows.py
- Create: mate-platform-backend/packages/mate-app-wfe/tests/test_intelligent_orchestration_boundary.py
- Create: mate-platform-backend/packages/mate-app-wfe/tests/test_temporal_replay_safety.py
- Create: metaplatform-frontend/apps/web/src/pages/workflow/WorkflowDesignerPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/workflow/WorkflowExecutionPage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/intelligent-workflow.spec.ts

**Interfaces:**

- REST: orchestration definition/version CRUD/release; plan create/read/replan/constrain/cancel; workflow definition/version CRUD/release; trigger/schedule CRUD/pause; execution start/read/signal/pause/resume/cancel.
- A2A: OrchestrationPlan delegates only through Employee Runtime SubRun creation and returns task/artifact references.
- Temporal: activities receive RunId, LeaseToken, ApprovalId, ActionVersionDigest and IdempotencyKey; they must reauthorize before effects.

- [ ] Write failing tests proving LangGraph state cannot mutate Run/Lease/Approval/WorkflowExecution authority and that cycles, budget/depth/TTL overflow or unapproved capabilities fail closed.
- [ ] Implement the adapter selected by the ADR and persist plan versions, rationale receipts, budget and SubRun edges.
- [ ] Implement Temporal only for durable wait/retry/compensation/schedule/approval and keep deterministic short paths in Runtime.
- [ ] Prove Temporal replay, signal duplication, cancellation and worker restart cannot repeat a protected side effect.
- [ ] Run unit, contract and Playwright tests; execute the PI-3 Temporal restore/replay Gate.
- [ ] Commit: git commit -m "feat(orchestration): separate intelligent plans from durable workflows"

### Task 4: Deliver data products, pipelines and governed query execution

**Files:**

- Create: mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/catalog/domain.py
- Create: mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/catalog/service.py
- Create: mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/catalog.py
- Create: mate-platform-backend/packages/mate-tech-etl/src/mate_tech_etl/api/pipelines.py
- Create: mate-platform-backend/packages/mate-tech-analytics/src/mate_tech_analytics/api/federated_queries.py
- Create: mate-platform-backend/packages/mate-tech-data/tests/test_data_product_lifecycle.py
- Create: mate-platform-backend/packages/mate-tech-etl/tests/test_pipeline_lifecycle.py
- Create: mate-platform-backend/packages/mate-tech-analytics/tests/test_federated_query_evidence.py
- Create: metaplatform-frontend/apps/web/src/pages/data/DataCatalogPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/data/PipelinePage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/data/FederatedQueryPage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/data-product-query.spec.ts

**Interfaces:**

- REST: full lifecycle for DataSourceDefinition, DataConnection, DataAsset, DataProduct, SemanticMapping, PipelineDefinition/Run, QualityRule/Result, FederatedQueryTemplate, QueryExecution/Evidence and Lineage/ImpactView.
- MCP: discover_data_products and query_data_product require purpose, allowed fields, data watermark, plan Digest and evidence receipt.
- Events: DataSchemaChanged, DataProductReleased, PipelineRunChanged, DataQualityFailed and LineageChanged.

- [ ] Write failing tests for secret references, source least privilege, field/purpose authorization, schema versioning, pipeline idempotency, partial success, quality blocking, read-only Trino plans and evidence Digest.
- [ ] Implement catalog/connection/product APIs, pipeline lifecycle and federated query planning/execution; never expose arbitrary underlying tables to an employee.
- [ ] Implement UI CRUD, schema/Diff, health, quality trend, run control, cost plan, evidence export and impact views.
- [ ] Prove DataConnection, DataAsset, PipelineDefinition/Run, KnowledgeGraph and FederatedQuery execution are individually registered in OpenAPI and Interface Registry with consumer contract tests.
- [ ] Run targeted backend suites, Playwright E2E and LiteLLM/object/data-interface production Gates.
- [ ] Commit: git commit -m "feat(data): deliver governed products pipelines and federated queries"

### Task 5: Deliver RAGFlow knowledge and graph projection

**Files:**

- Create: mate-platform-backend/packages/mate-app-kb/src/mate_app_kb/governance/domain.py
- Create: mate-platform-backend/packages/mate-app-kb/src/mate_app_kb/governance/ragflow_adapter.py
- Create: mate-platform-backend/packages/mate-app-kb/src/mate_app_kb/api/governed_knowledge.py
- Create: mate-platform-backend/packages/mate-app-kb/tests/test_governed_document_lifecycle.py
- Create: mate-platform-backend/packages/mate-app-kb/tests/test_ragflow_evidence_contract.py
- Create: mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/projection/knowledge_graph.py
- Create: mate-platform-backend/packages/mate-tech-ont/tests/test_knowledge_graph_projection.py
- Create: metaplatform-frontend/apps/web/src/pages/knowledge/KnowledgeGraphPage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/governed-knowledge.spec.ts

**Interfaces:**

- REST: KnowledgeBase CRUD; document upload/sync/version/parse/delete/freeze; chunk/index snapshot read/rebuild/promote; graph projection build/read/switch/retire.
- MCP: search_knowledge and get_evidence return source spans, document/index/model Digests and ACL watermark.
- Events: GovernedDocumentVersioned, KnowledgeSnapshotReleased, SourceWithdrawn and KnowledgeGraphProjectionChanged.

- [ ] Write failing tests for malicious file, prompt injection, cross-tenant object key, whole-document fallback, mock-success, source span, deletion propagation and graph authority separation.
- [ ] Implement RAGFlow adapter behind platform contracts; persist authoritative ACL, source, parser, embedding, snapshot and retrieval evidence in PostgreSQL/Object storage metadata.
- [ ] Implement rebuild and blue/green snapshot switch; ensure KnowledgeGraphProjection is reconstructable and never owns OntologyDefinition or source business facts.
- [ ] Run contract-review gold set, source withdrawal, index rebuild and rollback E2E; pass RAGFlow and Jena projection Gates for current Digests.
- [ ] Commit: git commit -m "feat(knowledge): deliver governed rag and graph evidence"

### Task 6: Deliver governed MemoryCore lifecycle

**Files:**

- Create: mate-platform-backend/packages/mate-tech-agent/src/mate_tech_agent/memory/domain.py
- Create: mate-platform-backend/packages/mate-tech-agent/src/mate_tech_agent/memory/repository.py
- Create: mate-platform-backend/packages/mate-tech-agent/src/mate_tech_agent/memory/memorycore_adapter.py
- Create: mate-platform-backend/packages/mate-tech-agent/src/mate_tech_agent/api/memory.py
- Create: mate-platform-backend/packages/mate-tech-agent/tests/test_memory_lifecycle.py
- Create: mate-platform-backend/packages/mate-tech-agent/tests/test_memory_scope_and_deletion.py
- Create: metaplatform-frontend/apps/web/src/pages/memory/MemoryPolicyPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/memory/MemoryReviewPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/memory/MemoryOperationsPage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/governed-memory.spec.ts

**Interfaces:**

- REST: policy/collection CRUD; candidate create/read/update-before-review/reject/withdraw/submit; review approve/reject/transfer; item read/correct/revoke/expire; retrieval/feedback; conflict resolve; deletion request/propagation; snapshot/restore.
- MCP: search_memory returns only approved, in-scope, non-revoked Item Digests and reason codes.
- Events: MemoryCandidateCreated, MemoryPromoted, MemoryConflictDetected, MemoryRevoked and MemoryDeletionCompleted.

- [ ] Write failing tests proving candidates do not enter long-term retrieval, preference/knowledge/chat/Run state are not copied as memory, and scope intersection cannot elevate authorization.
- [ ] Implement platform governance plus MemoryCore adapter; fix every Run to the actual retrieved MemoryItem Digests.
- [ ] Implement conflict, correction, revocation, expiry, legal hold, deletion tombstone and propagation to indexes/caches/replicas/host projections.
- [ ] Implement UI review, source evidence, scope, conflict, deletion and restore surfaces with SoD and audit.
- [ ] Pass MemoryCore Gate and execute cross-host continuity, contamination, revocation, deletion and independent restore E2E.
- [ ] Commit: git commit -m "feat(memory): deliver governed cross-host memory"

### Task 7: Cross-context business validation and release evidence

**Files:**

- Create: mate-platform-backend/tests/e2e/test_order_query_plan_confirm_execute.py
- Create: mate-platform-backend/tests/e2e/test_contract_evidence_report.py
- Create: mate-platform-backend/tests/e2e/test_memory_cross_host_continuity.py
- Create: mate-platform-backend/tests/contract/test_action_data_memory_consumers.py
- Create: acceptance/release/v1/evidence/action-data-knowledge-memory.yaml
- Modify: acceptance/release/v1/requirements.yaml
- Modify: acceptance/release/v1/interface-registry.yaml
- Modify: acceptance/release/v1/sprint-board.yaml

**Interfaces:**

- Consumes fixed Employee, Ontology, Skill, MCP, Artifact and UserContext projections.
- Produces provider/consumer contract evidence, business E2E evidence, recovery evidence and release status for every enabled interface.

- [ ] Run the order scenario: query order through ontology mapping, produce evidence-backed report and ActionPlan, require employee confirmation, execute once and issue Receipt.
- [ ] Run the contract scenario: governed upload, RAG evidence, ontology/data constraint lookup and standard report; prove insufficient evidence and injection fail closed.
- [ ] Switch among validated hosts and prove Session/Run/Artifact/Memory continuity without moving authority into a host.
- [ ] Inject RAGFlow, Temporal, MemoryCore, NATS and data-source failures; prove READ_ONLY/ACTIONS_PAUSED/WAITING_RECOVERY, recovery notification and no duplicate effect.
- [ ] Execute provider/consumer contracts, backup/restore and rollback for current final-candidate Digests; update every InterfaceRecord to RELEASED only after its consumer tests pass.
- [ ] Run: pytest mate-platform-backend/tests/e2e mate-platform-backend/tests/contract/test_action_data_memory_consumers.py -q
- [ ] Commit: git commit -m "test(platform): validate action data knowledge memory release"

## Exit Criteria

- Delivery Object Matrix 中每个对象至少有创建、读取、允许变更、退役/撤销及其特殊业务命令的实现、权限、审计、API、UI 和自动化证据。
- DataConnection、DataAsset、PipelineDefinition/Run、KnowledgeGraphProjection、FederatedQueryTemplate/Execution/Evidence 均有真实 provider/consumer 契约和业务 E2E，不以 DataProduct 汇总行代替。
- Markdown/HTML/PDF/DOCX 报告所需的数据、知识、行动和记忆引用全部固定到来源/Schema/版本 Digest。
- LangGraph、Temporal、RAGFlow、Trino、NATS、Jena Projection 和 MemoryCore 的当前 production-profile Gate 均 PASSED。
- 所有启用 InterfaceRecord 为 RELEASED；四宿主消费者兼容测试、MVP1/MVP2/MVP4 相关场景、恢复与回退证据已绑定当前候选 Digest。
- 任一缺失接口、越权、无来源结论、重复副作用、未传播撤销/删除、过期 Gate 或未演练回退均为 NO-GO。
