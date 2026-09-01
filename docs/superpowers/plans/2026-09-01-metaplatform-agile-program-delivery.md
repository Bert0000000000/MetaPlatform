# MetaPlatform 完整敏捷交付实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 以 2 周 Sprint、3 Sprint 一个 PI 的敏捷节奏，交付 MetaPlatform 首发范围内全部 15 个模块、四个业务 MVP、混合部署和 platform-ga 上线证据。

**Architecture:** 本计划是程序级执行编排。它以 Requirements Traceability Matrix 锁定首发范围，以既有 MVP1–MVP4 和生产 Gate 计划提供工程细节，以六组新增产品实施计划补齐模块覆盖；每个 Sprint 交付一个垂直 Feature，每个 PI 完成跨模块集成验收。platform-ga 是唯一正式上线判定，燃尽图和局部测试均不能替代它。

**Tech Stack:** Python 3.12、FastAPI、Pydantic 2、PostgreSQL/Alembic、React/Vite、Playwright、Supabase Auth、Keycloak、OpenFGA、OPA、MCP、A2A、LangGraph 或兼容开源编排引擎、Temporal、NATS、RAGFlow、Jena、MemoryCore、OpenTelemetry、Prometheus、Alertmanager、OpenSearch、Helm、Flux、Kubernetes/RKE2。

**Spec:** docs/superpowers/specs/2026-09-01-metaplatform-agile-delivery-operating-model.md; docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md; docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md

## Global Constraints

- 首发范围固定为产品主规格的 15 个一级模块最小闭环；任何不启用能力必须在 Requirements Traceability Matrix 中记录为 NOT_IN_RUNTIME 并获得受控例外签字。
- 一个 Sprint 为 2 周，一个 PI 为连续 3 个 Sprint；完成日期由实际团队容量决定，不用故事点替代验收。
- Story 只有在唯一 Requirement、权威对象、租户/权限、失败降级、自动化测试、真实 E2E 和回退方式明确后才能进入 Sprint。
- Feature Done 同时要求实现、测试、审计、真实 E2E、所需 Gate、可观测和回退；受控能力与生产能力必须分开报告。
- Employee Runtime 是 Session、WorkItem、Run、Lease、Checkpoint 的唯一状态权威；宿主、智能编排和 Temporal 不得替代它。
- AI 本体演化、智能编排和动态员工只能生成候选或受约束计划；本体发布、权限扩张和副作用仍由确定性策略、审批、Run/Lease 和领域服务控制。
- 每个生产 schema 只由受签名、最小权限的 Alembic Job 变更；生产代码路径禁止 create_all() 和 InMemoryOutboxWriter。
- PASSED、FAILED、NOT_EXERCISED 是 Gate 唯一状态；mock、单机测试、健康检查或文档评审不能标记 PASSED。
- 任何 production-profile 中启用的组件均须具有当前镜像/配置 Digest、SBOM、签名、许可证、负责人、RPO/RTO、回退和 PASSED Gate。
- 云端生产和连接型私有部署使用同一 TenantRuntime Package；完全断网 Cell 只有在对应 Gate 通过后进入首发。

---

## Program File Structure

- acceptance/release/v1/requirements.schema.json: 15 模块 Requirement Schema。
- acceptance/release/v1/requirements.yaml: Release Outcome、Epic、Feature、Story、验收和签字追踪矩阵。
- acceptance/release/v1/sprint-board.yaml: PI/Sprint 承诺、依赖、风险和完成证据。
- acceptance/release/v1/production-profile.yaml: 首发启用组件、Gate、Digest 和回退权威。
- acceptance/release/v1/platform-ga.yaml: 最终 GA 聚合证据。
- scripts/verify-release-traceability.py: 验证范围与 Feature/证据闭合。
- scripts/verify-sprint-board.py: 验证 Story 进入/关闭规则、PI 依赖和 Done 证据。
- scripts/test-production-release-promotion.ps1: 真实预生产推广、观察和回退 runner。
- docs/superpowers/plans/2026-09-01-metaplatform-control-plane-v1.md: 个人、组织身份权限、租户配置。
- docs/superpowers/plans/2026-09-01-metaplatform-runtime-employee-host-v1.md: Runtime、员工、宿主与降级投影。
- docs/superpowers/plans/2026-09-01-metaplatform-artifact-application-output-v1.md: Artifact、审批、应用与输出模板。
- docs/superpowers/plans/2026-09-01-metaplatform-ontology-skill-mcp-v1.md: 本体、Skill/Capability、MCP Catalog。
- docs/superpowers/plans/2026-09-01-metaplatform-action-data-knowledge-memory-v1.md: Action、智能编排、Workflow、数据、知识与记忆。
- docs/superpowers/plans/2026-09-01-metaplatform-tenant-deployment-operations-v1.md: 环境、部署、运营、审计、质量与降级体验。
- docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md: 迁移权威、旧 IAM 退出、N/N-1 和灾备。
- docs/superpowers/plans/2026-09-01-metaplatform-ga-release-and-cutover.md: 生产推广、灰度、观察、回退和签字。
- docs/superpowers/plans/2026-09-01-mvp-01-order-insight-action.md through 2026-09-01-mvp-04-ontology-operations.md: 四条业务 MVP 的工程级任务。
- docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md: 组件 Gate、锁定工具链和 live runner。

## First-Release Coverage Matrix

| 模块 | 主 PI | 首发 Feature 闭环 |
|---|---|---|
| 个人中心 | PI-1 | UserProfile、Preference、Consent、UserContextProjection |
| 任务与运行中心 | PI-1 | Session、WorkItem、Run、Lease、CapabilityAvailabilityProjection |
| 产物与审批中心 | PI-1/PI-2 | Artifact、Evidence、Approval、Receipt、Schema 和表示 |
| 应用中心 | PI-2 | Application Manifest、模板包、OutputProfile、安装/升级/回滚 |
| 数字员工中心 | PI-1/PI-4 | 标准员工版本/分配；动态组装员工与回收 |
| 本体中心 | PI-4/PI-5 | 本体工厂、自动演化、质量评估、运维发布/回滚 |
| 技能与能力中心 | PI-2 | Capability、SkillVersion、评测、Release、员工绑定 |
| MCP 服务中心 | PI-2 | Catalog、SchemaSnapshot、AuthProfile、Route、ConsumerBinding |
| Action 与工作流中心 | PI-3 | Action/Workflow、智能编排、Temporal 可靠边界 |
| 数据与知识中心 | PI-3 | DataProduct、质量、RAG、图谱、血缘、联邦查询 |
| 记忆中心 | PI-5 | Candidate、Review、Promotion、Conflict、Revocation、Deletion |
| 组织、身份与权限中心 | PI-1 | Organization、DynamicRole、Policy、SoD、AccessReview |
| 租户与配置中心 | PI-1 | Tenant、ConfigRelease、Quota、FeatureFlag、Notification |
| 宿主、环境与部署中心 | PI-2/PI-6 | Connector、Host Contract、TenantRuntime、混合部署 |
| 运营、审计与质量中心 | PI-5/PI-6 | SLO、Alert、Incident、Evaluation、Backup、RestoreDrill、GA |

### Task 1: PI-0 Sprint Board、范围追踪与 Gate 基础

**Files:**
- Create: acceptance/release/v1/requirements.schema.json
- Create: acceptance/release/v1/requirements.yaml
- Create: acceptance/release/v1/sprint-board.schema.json
- Create: acceptance/release/v1/sprint-board.yaml
- Create: scripts/verify-release-traceability.py
- Create: scripts/verify-sprint-board.py
- Create: mate-platform-backend/tests/architecture/test_release_traceability.py
- Create: mate-platform-backend/tests/architecture/test_sprint_board.py
- Modify: acceptance/gates/component-matrix.yaml
- Modify: .github/workflows/ga-acceptance.yml

**Interfaces:**
- Produces: Requirement { id, module, release_status, primary_plan, feature_id, gate_ids, e2e_evidence, recovery_evidence, owner, approver }.
- Produces: SprintCommitment { pi_id, sprint_id, feature_id, story_id, requirement_ids, dependencies, done_evidence, status }.
- Consumes: product module identifiers, MVP acceptance evidence and registered Gate IDs.

- [ ] **Sprint 0.1: Freeze Release Outcome and Stories**
  - Write failing tests that reject an enabled Requirement without a primary plan, E2E path, recovery evidence, owner or approver.
  - Populate one Requirement row for each of the 15 modules in the coverage matrix, with Release Outcome, Epic, Feature and initial Story IDs.
  - Verify every Story has one Requirement and every Requirement has one primary plan.
  - Commit: git commit -m "docs(agile): create release requirement backlog"

- [ ] **Sprint 0.2: Enforce PI/Sprint dependency rules**
  - Write failing tests that reject a Story with a missing authority boundary, Gate dependency, rollback or real-E2E reference.
  - Populate SprintCommitment rows for PI-0 through PI-6 and record each feature dependency.
  - Make the verifier reject a Story that closes before its prerequisites or a PI whose committed Features lack Done evidence.
  - Commit: git commit -m "test(agile): enforce sprint commitment evidence"

- [ ] **Sprint 0.3: Establish Gate and profile baseline**
  - Execute Production Convergence Task 1 to create Gate schemas, locked toolchain and the live runner.
  - Create production-profile skeleton rows for every planned production component, each with status NOT_EXERCISED.
  - Run CI validation; record no component as production ready.
  - Commit: git commit -m "test(platform): establish agile gate baseline"

**PI-0 Exit:** all 15 modules are represented; every Feature has a primary implementation plan; no Story without DoR enters PI-1; all Gates remain honestly NOT_EXERCISED.

### Task 2: PI-1 Control Plane, Runtime and MVP1

**Files:**
- Create: docs/superpowers/plans/2026-09-01-metaplatform-control-plane-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-runtime-employee-host-v1.md
- Modify: docs/superpowers/plans/2026-09-01-mvp-01-order-insight-action.md
- Modify: acceptance/release/v1/sprint-board.yaml
- Modify: acceptance/release/v1/requirements.yaml

**Interfaces:**
- Consumes: Requirement and SprintCommitment from PI-0.
- Produces: UserContextProjection, DynamicRole, Tenant ConfigRelease, RunContext, LeaseToken, ArtifactEnvelope, ApprovalRecord, ExecutionReceipt and CapabilityAvailabilityProjection.

- [ ] **Sprint 1.1: Control-plane identity and tenant slice**
  - Execute the control-plane plan for UserProfile, Preference, Consent, Organization, DynamicRole, Policy, Tenant, ConfigRelease, Quota and FeatureFlag.
  - Prove tenant isolation, SoD rejection and that preferences never elevate authorization.
  - Show Bootstrap returns UserContextProjection for one permitted user and rejects cross-tenant lookup.
  - Commit the completed Feature with its API, UI, audit and E2E evidence.

- [ ] **Sprint 1.2: Runtime and immutable artifact slice**
  - Execute MVP1 Tasks 1–5 and the runtime/employee/host plan for EmployeeDefinition, Version, Assignment, BusinessSession, WorkItem, Run, Lease, Artifact, ActionPlan, Approval and Receipt.
  - Run conformance vectors for Digest, state transition, one-use approval, Lease fencing and stable errors.
  - Remove production runtime DDL from every PI-1 production path through the migration-safety plan.
  - Commit the completed Feature with PostgreSQL concurrency and rollback evidence.

- [ ] **Sprint 1.3: Real order action and visible degradation**
  - Execute MVP1 Tasks 6–8 using real approved order data, not test-created acceptance fixtures.
  - Prove an employee creates a report and ActionPlan; one human confirmation performs one reversible follow_up_payment and creates one Receipt.
  - Induce identity, data and action dependency failures and prove READ_ONLY, ACTIONS_PAUSED and WAITING_RECOVERY are correctly exposed through CapabilityAvailabilityProjection.
  - Commit the completed Feature and update Requirement evidence.

**PI-1 Exit:** MVP1 business and architecture signoff; no duplicate side effects under concurrent confirm, retry or stale Lease; control-plane and runtime requirements are Done.

### Task 3: PI-2 Application, Skill, MCP and Host Control Planes

**Files:**
- Create: docs/superpowers/plans/2026-09-01-metaplatform-artifact-application-output-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-ontology-skill-mcp-v1.md
- Modify: docs/superpowers/plans/2026-09-01-metaplatform-runtime-employee-host-v1.md
- Modify: acceptance/release/v1/sprint-board.yaml

**Interfaces:**
- Consumes: immutable Artifact and Employee releases from PI-1.
- Produces: ArtifactSchema, TemplateVersion, OutputProfile, ApplicationVersion, ApplicationPackage, Capability, SkillVersion, MCPServer, ToolSchemaSnapshot, AuthProfile, Route and HostCapabilityContract.

- [ ] **Sprint 2.1: Artifact-to-application output slice**
  - Deliver ArtifactSchema compatibility checks, Markdown/HTML TemplateVersion, OutputProfile and immutable ArtifactRepresentation.
  - Deliver ApplicationVersion Manifest binding fixed Employee, Ontology, Skill, MCP, Action, Data and Role dependency Digests.
  - Prove template/theme/preference changes create new representation without changing Artifact Digest.
  - Commit the completed Feature with install, upgrade and rollback E2E.

- [ ] **Sprint 2.2: Capability and MCP catalog slice**
  - Deliver Capability and SkillVersion lifecycle, evaluation, release and Employee binding.
  - Deliver MCP Server/Tool/Resource/Prompt Catalog, SchemaSnapshot, AuthProfile, Route and ConsumerBinding.
  - Prove Tool discovery does not grant permission, final calls use dual-subject authorization, and incompatible schemas fail closed.
  - Commit the completed Feature with compatibility and audit evidence.

- [ ] **Sprint 2.3: Connector and second-host continuation slice**
  - Deliver HostCapabilityContract, ConnectorInstance health/version lifecycle and two-host Run continuation.
  - Prove both hosts load only UserContextProjection, EmployeeProjection, CapabilityCatalog and CapabilityAvailabilityProjection.
  - Prove host switching does not alter BusinessSession, Run, Lease, Artifact or authorization authority.
  - Commit the completed Feature and add required host Gate evidence.

**PI-2 Exit:** a template package and assembled application are publishable/installable; a fixed employee can safely call a cataloged MCP capability from two validated hosts.

### Task 4: PI-3 Contract Knowledge, Data Products and Intelligent Orchestration

**Files:**
- Create: docs/superpowers/plans/2026-09-01-metaplatform-action-data-knowledge-memory-v1.md
- Modify: docs/superpowers/plans/2026-09-01-mvp-02-contract-review.md
- Modify: acceptance/release/v1/sprint-board.yaml

**Interfaces:**
- Consumes: application/MCP releases from PI-2.
- Produces: GovernedSourceDocument, KnowledgeChunk, DataProduct, DataQualityResult, QueryEvidence, ActionVersion, IntelligentOrchestrationDefinition, OrchestrationPlan and WorkflowExecution.

- [ ] **Sprint 3.1: Contract knowledge and data-product slice**
  - Execute MVP2 Tasks 1–4 for governed upload, parsing, RAGFlow retrieval, source spans, ModelReceipt and legal report generation.
  - Deliver DataSource, DataProduct, Field/SemanticMapping, quality rule, lineage and QueryEvidence minimum lifecycle.
  - Prove parser, cross-tenant object access, prompt injection, malformed document and insufficient evidence cases fail closed.
  - Commit the completed Feature with a de-identified contract gold set.

- [ ] **Sprint 3.2: Action and reliable workflow slice**
  - Deliver ActionVersion, risk policy, pre/post-condition, compensation, WorkflowDefinition, Trigger and WorkflowExecution.
  - Use Temporal only for durable waits, retries, compensation, schedules and approvals; short deterministic paths remain in Runtime.
  - Prove replay cannot repeat a protected side effect and every Activity rechecks Lease, Approval and authorization.
  - Commit the completed Feature with wait, cancellation and compensation E2E.

- [ ] **Sprint 3.3: Intelligent orchestration slice**
  - Deliver IntelligentOrchestrationDefinition and OrchestrationPlan using LangGraph or a compatible open-source engine.
  - Prove task decomposition, dynamic routing and SubRun delegation retain policy/budget/depth/TTL limits.
  - Prove any approval, wait, retry, compensation or external Action crosses into Runtime/Temporal with a recorded boundary Digest.
  - Commit the completed Feature and MVP2 signoff evidence.

**PI-3 Exit:** MVP2 is Done; intelligent orchestration is auditable and cannot become a second Run or execution authority.

### Task 5: PI-4 Ontology Factory, Dynamic Employees and AI Evolution

**Files:**
- Modify: docs/superpowers/plans/2026-09-01-mvp-03-ontology-factory.md
- Modify: docs/superpowers/plans/2026-09-01-metaplatform-runtime-employee-host-v1.md
- Modify: docs/superpowers/plans/2026-09-01-metaplatform-ontology-skill-mcp-v1.md
- Modify: acceptance/release/v1/sprint-board.yaml

**Interfaces:**
- Consumes: SemanticExtractionResult, SubRun, DataProduct and OrchestrationPlan from PI-3.
- Produces: OntologyProposal, OntologyQualityAssessment, OntologyPackage, EmployeeAssemblyPlan, EphemeralEmployeeInstance, AssemblyReceipt and OntologyEvolutionPipeline.

- [ ] **Sprint 4.1: Ontology factory slice**
  - Execute MVP3 Tasks 1–5 for unified material/dialogue extraction, proposal deduplication, conflict, SHACL, impact analysis, Release Ledger and Jena projection.
  - Prove model output is always a candidate and a failed SHACL, missing provenance, duplicate RID or breaking impact cannot publish.
  - Commit the completed Feature with proposal-to-release and rollback evidence.

- [ ] **Sprint 4.2: Dynamic employee assembly slice**
  - Deliver EmployeeAssemblyPlan, EphemeralEmployeeInstance and AssemblyReceipt.
  - Bind only approved EmployeeVersion, Skill/Capability, Knowledge snapshot, model and policy Digests; use minimum intersection permissions.
  - Prove TTL expiry, Run completion and revocation remove the temporary instance without leaving role, assignment or credential residue.
  - Commit the completed Feature with cross-host continuation and revocation E2E.

- [ ] **Sprint 4.3: AI ontology evolution slice**
  - Deliver OntologyEvolutionPipeline subscriptions for governed documents, KnowledgeChunk, DataProduct Schema and lineage changes.
  - Deliver OntologyQualityAssessment for completeness, consistency, coverage, conflicts and impact; record model receipts and deterministic check results.
  - Prove a data change creates only a maintenance proposal; human review, SHACL and impact gates remain required to publish.
  - Commit the completed Feature and MVP3 signoff evidence.

**PI-4 Exit:** MVP3 is Done; AI-native ontology construction and dynamic employees are usable without bypassing authority, policy or human publication.

### Task 6: PI-5 Ontology Operations, Memory and Operational Experience

**Files:**
- Modify: docs/superpowers/plans/2026-09-01-mvp-04-ontology-operations.md
- Modify: docs/superpowers/plans/2026-09-01-metaplatform-action-data-knowledge-memory-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-tenant-deployment-operations-v1.md
- Modify: acceptance/release/v1/sprint-board.yaml

**Interfaces:**
- Consumes: OntologyPackage, EvolutionPipeline and Runtime events from PI-4.
- Produces: MaintenanceRun, DriftFinding, MemoryCandidate, MemoryItem, SLODefinition, AlertRule, Incident, RestoreDrill and recovery notifications.

- [ ] **Sprint 5.1: Event-driven ontology operations slice**
  - Execute MVP4 Tasks 1–5 for NATS Outbox/Inbox/DLQ, idempotent maintenance events, drift proposals, quality regression, approval, publish and recovery.
  - Prove duplicate events, event storms, DLQ replay and rejected releases preserve one proposal/one effect semantics.
  - Commit the completed Feature with maintenance E2E and Release Ledger rollback evidence.

- [ ] **Sprint 5.2: Governed memory slice**
  - Deliver MemoryPolicy, Candidate, Review, Promotion, Item, Conflict, Revocation, Deletion and Snapshot contracts through the selected Memory Adapter.
  - Prove unreviewed memory never influences a protected action; deletion and revocation propagate to indexes, replicas and host projections.
  - Complete MemoryCore Gate only if it is in production-profile; otherwise record NOT_IN_RUNTIME with approved scope.
  - Commit the completed Feature with cross-host continuity, contamination and deletion E2E.

- [ ] **Sprint 5.3: Operations and degradation-experience slice**
  - Deliver SLO, Alert Route, Incident, Evaluation, Budget, BackupPolicy, RestoreDrill, Runbook and On-call RACI product surfaces.
  - Expand CapabilityAvailabilityProjection to every selected failure domain and prove user-readable availability, pause, recovery and notification behavior.
  - Execute an independent tenant recovery drill and reconcile Run Ledger, Artifact/Object, identity, policy, event, workflow, audit and configuration facts.
  - Commit the completed Feature and MVP4 signoff evidence.

**PI-5 Exit:** MVP4 is Done; memory, operations and customer-visible degradation have complete lifecycle, audit and recovery evidence.

### Task 7: PI-6 Hybrid Deployment, Promotion and GA

**Files:**
- Create: docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md
- Modify: docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-ga-release-and-cutover.md
- Create: acceptance/release/v1/platform-ga.schema.json
- Create: acceptance/release/v1/platform-ga.yaml
- Create: scripts/test-production-release-promotion.ps1
- Modify: .github/workflows/ga-acceptance.yml
- Modify: acceptance/release/v1/sprint-board.yaml

**Interfaces:**
- Consumes: all Done Feature evidence, production-profile, component Gate DAG, SLO and recovery drill results.
- Produces: PlatformGA { release_id, profile_digest, requirement_matrix_digest, parent_gates, business_e2e, recovery_drill, promotion, rollback, signatures, status }.

- [ ] **Sprint 6.1: Migration, identity and production-profile convergence**
  - Deliver signed least-privilege migration Job, pre-snapshot, 0015 to 0020 regression, expand-contract compatibility, PITR and post-migration reconciliation.
  - Remove old IAM from runtime authorization routes, OpenAPI manifests and authority reads after the approved compatibility window.
  - Lock each enabled production component to exact image/config Digest, current Gate and declared RPO/RTO/rollback.
  - Commit the completed Feature with source scan, migration, identity and profile evidence.

- [ ] **Sprint 6.2: Hybrid deployment and disaster recovery**
  - Run required component Gates for cloud production and connected private TenantRuntime using the same Package.
  - Complete four-host Capability Contract; run disconnected-cell-hosts only when the first-release scope enables fully offline Cell.
  - Execute N/N-1 upgrade, rollback, cross-failure-domain restore and business reconciliation using production-equivalent targets.
  - Commit the completed Feature with signed recovery, compatibility and gate evidence.

- [ ] **Sprint 6.3: Production promotion and release decision**
  - Create platform-ga evidence requiring all first-release Requirements IMPLEMENTED, all enabled Gate parents PASSED, real business E2E, recovery drill, SLO observation and valid signatures.
  - Run de-identified pre-production replay, first-tenant/traffic-slice promotion, locked observation window and declared automatic/manual rollback.
  - Publish Release Readiness Report as GO only when platform-ga is PASSED; otherwise publish NO-GO with failed Requirement/Gate and an owned recovery Story.
  - Commit the release decision evidence.

**PI-6 Exit:** all first-release Requirements are Done and platform-ga is PASSED in the locked hybrid production profile. Any missing evidence, failed Gate, stale Digest, unrehearsed rollback or unsigned responsibility is NO-GO.

### Task 8: PI Review, Retro and Backlog Replanning

**Files:**
- Modify: acceptance/release/v1/sprint-board.yaml
- Modify: acceptance/release/v1/requirements.yaml
- Create: acceptance/release/v1/pi-review/PI-0.md through acceptance/release/v1/pi-review/PI-6.md
- Create: acceptance/release/v1/release-readiness-report.md

**Interfaces:**
- Consumes: SprintCommitment, Feature Done evidence, Gate evidence, risk register and stakeholder decisions.
- Produces: PIReview { pi_id, demo_evidence, committed_features, done_features, carryover, risks, retro_actions, next_pi_admission }.

- [ ] **Step 1: Hold every Sprint Review on real evidence**
  - Demonstrate the user-visible Feature, real/de-identified input, audit correlation, failure/denial case, degradation view and recovery/rollback behavior.
  - Reject mock-only demonstration as Done evidence.
  - Record Review links in the associated SprintCommitment rows.

- [ ] **Step 2: Close each PI only after integration verification**
  - Run all PI Feature tests plus their shared conformance, E2E and registered Gate dependencies.
  - Record carryover as a new Story with unmet Done criteria; never move it as a completed Feature.
  - Limit Retro to three owned improvements and attach them to the next Sprint.

- [ ] **Step 3: Publish final program decision**
  - Run release traceability, sprint board, production Gate and promotion validators.
  - Write Release Readiness Report with every Requirement, Feature, Gate, evidence Digest, owner and GO/NO-GO result.
  - Commit: git commit -m "docs(release): record agile first-release decision"

## Self-Review

- Scope coverage: the coverage matrix assigns every one of the 15 product modules to a primary PI and Feature; Tasks 1–7 provide every PI its execution and exit condition.
- Business coverage: Tasks 2, 4, 5 and 6 preserve MVP1–MVP4 as real business evidence rather than turning them into component demonstrations.
- AI-native coverage: PI-3 delivers intelligent orchestration; PI-4 delivers dynamic employees and ontology evolution; PI-5 delivers operational degradation and governed memory.
- Launch coverage: PI-6 adds migration/identity convergence, hybrid deployment, disaster recovery, promotion, rollback and platform-ga; Task 8 keeps all evidence current across iterations.
- Consistency: Requirement, SprintCommitment, Feature Done, production-profile and PlatformGA are defined once and consumed using the same state and evidence terms.

