# MetaPlatform 本体、技能与 MCP 中心 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 交付受治理的本体、Skill/Capability 与 MCP Catalog 首发闭环，使 AI 可从受权数据提出候选和维护建议，管理员可审查、发布和回滚；数字员工只能发现并在双主体授权后调用兼容的 MCP 能力。

**Architecture:** 本体中心拥有概念、属性、Link、Action、公理、约束、Proposal、QualityAssessment、Package 和 Release Ledger；AI、RAG、数据产品和编排只提供有来源的候选，不能直接发布。Skill/Capability 中心拥有 SkillVersion、评测、发布、撤销和员工绑定；MCP 中心拥有 Server、Tool、Resource、Prompt、AuthProfile、Route、SchemaSnapshot 和 ConsumerBinding。三者均不拥有 Run/Lease、审批消费或业务副作用。

**Tech Stack:** Python 3.12、FastAPI、Pydantic 2、PostgreSQL、Alembic、Apache Jena、SHACL、OpenFGA、OPA、MCP、A2A、NATS CloudEvents、LiteLLM、React/Vite、Playwright、OpenTelemetry。

**Spec:** docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md; docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md; docs/superpowers/plans/2026-09-01-mvp-03-ontology-factory.md; docs/superpowers/plans/2026-09-01-mvp-04-ontology-operations.md; docs/superpowers/plans/2026-09-01-metaplatform-agile-program-delivery.md.

## Global Constraints

- 本体中心是 Concept、Property、Link、Action、Axiom、Constraint、OntologyProposal、OntologyQualityAssessment、OntologyPackage 和 Release Ledger 的唯一发布权威；Jena 是可重建投影，不是事实源。
- MVP3 is the primary implementation and migration owner for SemanticExtractionResult、OntologyProposal/Review/Approval、OntologyPackage、Release Ledger、Jena projection and their REST/events. This plan consumes those MVP3 contracts; revision 0024 adds quality/evolution extensions plus Skill/MCP facts and must not recreate the 0018 tables, paths or topics.
- Proposal 只能经历 draft → validated → in_review → approved → published|rejected；发布需要固定基础 Digest、来源锚点、SHACL、影响分析、质量阈值、策略决策和人工审批。缺失来源、冲突、重复 RID 或破坏性影响必须阻止发布。
- AI 自动构建/演化只从受治理 Document、KnowledgeChunk、DataProduct Schema/lineage 产生 SemanticExtractionResult、OntologyProposal 或 MaintenanceProposal；模型收据和确定性检查必须保留，数据变化绝不能自动改变生产本体。
- Skill 生命周期为 draft → evaluated → published → deprecated|revoked → archived；MCP Server/Schema/Route 为 draft → validated → published → deprecated|revoked → archived；发布或被引用对象只能版本化、撤销或归档。
- 可执行 SkillPackage 在沙箱 Gate 通过前保持 NOT_SUPPORTED，不能因清单、签名或演示成功进入生产。
- MCP Catalog 发现、列工具或读取 Resource/Prompt 描述均不授予调用、凭据、安装或副作用权限；调用必须通过 Tenant、Human、Employee、Run/Lease、OpenFGA、OPA、用途和审批的双主体授权。
- A2A 只用于受约束 Agent/SubRun 委托，必须携带 parent_run_id、预算、最大深度、TTL、policy Digest 与 capability allowlist；它不能创建第二个 Run 权威或越过审批、Action、Temporal 边界。
- REST/MCP/A2A/Event/UI 共用服务层命令；所有写入带 correlation_id、actor、tenant、policy Digest、追加审计和事务 Outbox。跨租户、无效 Schema、过期 AuthProfile、兼容性断裂、低证据候选和越权工具调用 fail closed，并投影 CapabilityAvailabilityProjection。
- 生产 schema 由签名、最小权限 Alembic Job 变更；事件消费者使用 Inbox 去重和兼容 schema version。

---

## File Structure

- mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/center_contracts.py: 本体、候选、质量、发布、演化契约。
- mate-platform-backend/packages/mate-kernel/src/mate_kernel/capability/contracts.py: Capability/Skill 生命周期与评测契约。
- mate-platform-backend/packages/mate-kernel/src/mate_kernel/mcp_catalog/contracts.py: MCP Catalog、Schema、Route 和调用契约。
- mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center/: 本体 repository、质量、Jena projection、发布和演化 pipeline。
- mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities/: Skill/Capability 评测、绑定和撤销。
- mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/: Catalog、兼容、AuthProfile、Route、双主体授权和 A2A。
- mate-platform-backend/alembic/versions/20260901_0024_ontology_skill_mcp.py: revision 固定为 0024_ontology_skill_mcp，down_revision 固定为 0023_artifact_application_output，仅新增本体质量/演化扩展及 Skill/MCP 表。
- mate-platform-backend/contracts/openapi/services/ontology-skill-mcp.yaml and contracts/events/ontology-skill-mcp.v1.json: REST/Event 权威接口。
- metaplatform-frontend/apps/web/src/pages/ontology/ and metaplatform-frontend/apps/web/src/pages/mcp/: 提案、发布、Skill、Route 和兼容性工作台。

## Management Object Matrix

| 对象             | 生命周期操作                               | REST / MCP / A2A / Event / UI 合同                                                                                 |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| OntologyPackage  | 草拟、提案、评审、发布、弃用、回滚         | /ontology/proposals、/releases；ontology.get_projection；A2A 仅提交候选；ontology.package.published.v1；本体工厂页 |
| AI Evolution     | 受治理输入、抽取、质量、维护提案、人工发布 | /ontology/evolution-runs；ontology.get_quality；ontology.maintenance.proposed.v1；质量/影响面板                    |
| Capability/Skill | 创建、评测、发布、绑定、弃用、撤销、归档   | /capabilities、/skills；capability.list；skill.revoked.v1；技能页                                                  |
| MCP Catalog      | 注册、Schema 快照、验证、路由、绑定、撤销  | /mcp/servers、/routes；受权 MCP 调用；A2A allowlist；mcp.route.revoked.v1；MCP 中心页                              |

### Task 1: 固化本体、质量、Skill、MCP 与 A2A 生命周期契约

**Files:**

- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/center_contracts.py
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/capability/contracts.py
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/mcp_catalog/contracts.py
- Modify: mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/**init**.py
- Create: mate-platform-backend/packages/mate-kernel/tests/test_ontology_skill_mcp_contracts.py
- Create: mate-platform-backend/tests/conformance/ontology_skill_mcp/test_lifecycle_vectors.py

**Interfaces:**

- Consumes: MVP1 RunContext/Digest/ModelReceipt and MVP3 SemanticExtractionResult.
- Produces: OntologyTerm, OntologyProposal, OntologyQualityAssessment, OntologyPackage, Capability, SkillVersion, MCPServer, ToolSchemaSnapshot, AuthProfile, Route, ConsumerBinding, A2ADelegationEnvelope and validate_transition().

- [ ] **Step 1: Write failing authority, provenance and discovery tests**

```python
def test_ontology_publish_requires_human_approval_and_passing_quality():
    proposal = OntologyProposal(state="approved", quality_digest=None, approval_digest=None)
    with pytest.raises(ValueError, match="ONTOLOGY_RELEASE_EVIDENCE_REQUIRED"):
        proposal.to_package()

def test_catalog_discovery_is_not_a_tool_grant():
    binding = ConsumerBinding.discovered(consumer=EMPLOYEE, tool_id="order.inspect")
    assert binding.may_invoke is False
```

- [ ] **Step 2: Run contract tests and verify they fail**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_ontology_skill_mcp_contracts.py mate-platform-backend/tests/conformance/ontology_skill_mcp/test_lifecycle_vectors.py -q

Expected: FAIL because center contract modules are absent.

- [ ] **Step 3: Implement immutable terms, releases and transition validators**

```python
class OntologyTerm(BaseModel):
    kind: Literal["concept", "property", "link", "action", "axiom", "constraint"]
    rid: str
    definition: str
    source_anchor_digests: tuple[str, ...]

class A2ADelegationEnvelope(BaseModel):
    parent_run_id: UUID
    subrun_id: UUID
    policy_digest: str
    capability_allowlist: tuple[str, ...]
    max_depth: int = Field(ge=0, le=4)
    ttl_seconds: int = Field(gt=0, le=3600)
```

Require fixed Digests and published states for bindings. OntologyQualityAssessment contains completeness, consistency, coverage, conflict and impact plus deterministic-check Digests. MCP Server/Route rejects undefined Schema version; SkillVersion cannot publish without an evaluation report.

- [ ] **Step 4: Verify contracts and conformance vectors**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_ontology_skill_mcp_contracts.py mate-platform-backend/tests/conformance/ontology_skill_mcp -q

Expected: PASS; discovery remains non-authorizing and invalid publication transitions fail.

- [ ] **Step 5: Commit**

```bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology mate-platform-backend/packages/mate-kernel/src/mate_kernel/capability mate-platform-backend/packages/mate-kernel/src/mate_kernel/mcp_catalog mate-platform-backend/packages/mate-kernel/tests/test_ontology_skill_mcp_contracts.py mate-platform-backend/tests/conformance/ontology_skill_mcp
git commit -m "feat(ontology): define skill mcp lifecycle contracts"
```

### Task 2: 建立本体、Skill、MCP Catalog 的 Alembic 权威与租户授权

**Files:**

- Create: mate-platform-backend/alembic/versions/20260901_0024_ontology_skill_mcp.py
- Modify: mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/release_repository.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center/quality_repository.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities/repository.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/repository.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/authorization.py
- Create: mate-platform-backend/tests/migrations/test_ontology_skill_mcp_upgrade.py
- Create: mate-platform-backend/tests/security/test_ontology_skill_mcp_rls.py

**Interfaces:**

- Consumes: Task 1 contracts and tenant-scoped transaction context.
- Consumes the MVP3 proposal/review/package/Release Ledger repository and Jena projection.
- Produces OntologyQualityAssessment/evolution-subscription extensions, Skill lifecycle and Catalog repositories; authorize_tool_call(human, employee, run, route, arguments) -> AuthorizationDecision.

- [ ] **Step 1: Write failing RLS, immutable release and dual-subject tests**

```python
async def test_human_and_employee_must_both_be_authorized(authorizer):
    decision = await authorizer.authorize_tool_call(human=HUMAN, employee=REVOKED_EMPLOYEE, run=RUN, route=ROUTE, arguments={})
    assert decision.allowed is False
    assert decision.code == "EMPLOYEE_CAPABILITY_REVOKED"

async def test_cross_tenant_ontology_release_is_not_found(repo):
    release = await repo.publish(sample_approved_proposal("t1"))
    with pytest.raises(NotFound):
        await repo.get_package("t2", release.digest)
```

- [ ] **Step 2: Run PostgreSQL tests and verify they fail**

Run: pwsh -File scripts/test-mvp-postgres.ps1 -Suite ontology-skill-mcp

Expected: FAIL because migration and repositories are absent.

- [ ] **Step 3: Implement database facts, RLS, audit and Outbox**

Assert the MVP3 revision 0018 proposal/package/Release Ledger tables are present and owned by the MVP3 plan. Create only ontology_quality_assessments, ontology_evolution_subscriptions, ontology_evolution_runs, capabilities, skill_versions, skill_evaluations, employee_capability_bindings, mcp_servers, mcp_tool_schema_snapshots, mcp_auth_profiles, mcp_routes, mcp_consumer_bindings, mcp_compatibility_reports and their append-only audit/outbox tables. Link quality/evolution rows to immutable MVP3 proposal/package Digests. Enforce tenant RLS, Digest uniqueness, release immutability and revocation timestamps. Authorization checks human and employee relations, OPA purpose/risk, Run/Lease and Route Schema compatibility before resolving AuthProfile; raw credentials never enter MCP responses.

- [ ] **Step 4: Verify migration and security boundaries**

Run: pwsh -File scripts/test-mvp-postgres.ps1 -Suite ontology-skill-mcp; mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/migrations/test_ontology_skill_mcp_upgrade.py mate-platform-backend/tests/security/test_ontology_skill_mcp_rls.py -q

Expected: PASS; revoked employee, stale lease and cross-tenant reads fail before provider request.

- [ ] **Step 5: Commit**

```bash
git add mate-platform-backend/alembic/versions/20260901_0024_ontology_skill_mcp.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/release_repository.py mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog mate-platform-backend/tests/migrations/test_ontology_skill_mcp_upgrade.py mate-platform-backend/tests/security/test_ontology_skill_mcp_rls.py
git commit -m "feat(mcp): add governed catalog persistence"
```

### Task 3: 交付 AI 本体自动构建、演化、质量评估与人工发布

**Files:**

- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center/extraction.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center/evolution.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center/quality.py
- Modify: mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/publish_workflow.py
- Modify: mate-platform-backend/packages/mate-clients/src/mate_clients/jena.py
- Create: mate-platform-backend/packages/mate-platform/tests/test_ontology_evolution_pipeline.py
- Create: mate-platform-backend/tests/integration/test_ontology_shacl_release_rollback.py

**Interfaces:**

- Consumes: governed SourceAnchor, KnowledgeChunk, DataProduct SchemaChanged/lineage events, ModelReceipt and Task 2 repositories.
- Produces: propose_evolution() -> OntologyProposal and assess_quality() -> OntologyQualityAssessment; consumes MVP3 extract/publish/rollback commands rather than creating another ontology release service.

- [ ] **Step 1: Write failing candidate-only, SHACL and rollback tests**

```python
async def test_schema_change_creates_maintenance_proposal_not_release(pipeline):
    result = await pipeline.handle_schema_changed(governed_schema_event())
    assert result.state == "draft"
    assert await pipeline.release_count() == 0

async def test_failed_shacl_cannot_publish_and_rollback_restores_prior_digest(service):
    with pytest.raises(ReleaseBlocked, match="SHACL_VALIDATION_FAILED"):
        await service.publish_package(invalid_approved_proposal())
    assert (await service.rollback_package(CURRENT)).digest == PRIOR_DIGEST
```

- [ ] **Step 2: Run pipeline tests and verify they fail**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_ontology_evolution_pipeline.py mate-platform-backend/tests/integration/test_ontology_shacl_release_rollback.py -q

Expected: FAIL because extraction/evolution/release services do not exist.

- [ ] **Step 3: Implement provenance-bound extraction and deterministic publication**

Validate model output against Task 1 schema, persist ModelReceipt/source anchors, deduplicate normalized RID/candidate Digests, run deterministic SHACL/impact analysis and calculate quality metrics. Submit the candidate and assessment into the MVP3 proposal/review/publish workflow; that workflow remains the only service allowed to require independent review, sign OntologyPackage, append Release Ledger and project Jena. Projection failure leaves the prior package active and exposes ACTIONS_PAUSED. Rollback calls the MVP3 command that appends a ledger record referring to the prior package, never mutating history.

- [ ] **Step 4: Verify AI evolution, quality and restore behavior**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_ontology_evolution_pipeline.py mate-platform-backend/tests/integration/test_ontology_shacl_release_rollback.py -q

Expected: PASS; AI stays candidate-only and quality/SHACL/approval blocks unsafe release.

- [ ] **Step 5: Commit**

```bash
git add mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center mate-platform-backend/packages/mate-clients/src/mate_clients/jena.py mate-platform-backend/packages/mate-platform/tests/test_ontology_evolution_pipeline.py mate-platform-backend/tests/integration/test_ontology_shacl_release_rollback.py
git commit -m "feat(ontology): add governed ai evolution"
```

### Task 4: 实现 Skill/Capability 评测、发布、员工绑定与撤销

**Files:**

- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities/service.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities/evaluation.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities/bindings.py
- Create: mate-platform-backend/packages/mate-platform/tests/test_skill_capability_lifecycle.py
- Create: mate-platform-backend/tests/security/test_skill_revocation.py
- Create: mate-platform-backend/tests/integration/test_employee_capability_binding.py

**Interfaces:**

- Consumes: Task 1 SkillVersion/Capability contracts, published Employee release, policy decision and evaluation gold set.
- Produces: evaluate_skill() -> SkillEvaluation, publish_skill() -> SkillVersion, bind_employee_capability(), revoke_skill() and CapabilityProjection.

- [ ] **Step 1: Write failing evaluation and revocation tests**

```python
async def test_skill_cannot_bind_without_passing_evaluation(service):
    with pytest.raises(TransitionBlocked, match="SKILL_EVALUATION_REQUIRED"):
        await service.bind_employee_capability(employee=EMPLOYEE, skill=draft_skill())

async def test_revocation_removes_projection_and_blocks_future_tool_calls(service):
    binding = await service.bind_employee_capability(EMPLOYEE, published_skill())
    await service.revoke_skill(binding.skill_digest, actor=SECURITY_ADMIN)
    assert not (await service.capability_projection(EMPLOYEE)).contains(binding.capability_id)
```

- [ ] **Step 2: Run lifecycle tests and verify they fail**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_skill_capability_lifecycle.py mate-platform-backend/tests/security/test_skill_revocation.py mate-platform-backend/tests/integration/test_employee_capability_binding.py -q

Expected: FAIL because capability service is absent.

- [ ] **Step 3: Implement evaluated release and minimum-permission binding**

Record evaluation input/gold-set/model/runtime Digests and threshold results. Publish only passing immutable SkillVersions, bind only the intersection of employee assignment, tenant policy and capability scope, emit revocation through Outbox and atomically remove future grants. Keep executable packages NOT_SUPPORTED until the separate sandbox Gate PASSED.

- [ ] **Step 4: Verify Skill release and revocation propagation**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_skill_capability_lifecycle.py mate-platform-backend/tests/security/test_skill_revocation.py mate-platform-backend/tests/integration/test_employee_capability_binding.py -q

Expected: PASS; no untested or revoked Skill is visible to Employee.

- [ ] **Step 5: Commit**

```bash
git add mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities mate-platform-backend/packages/mate-platform/tests/test_skill_capability_lifecycle.py mate-platform-backend/tests/security/test_skill_revocation.py mate-platform-backend/tests/integration/test_employee_capability_binding.py
git commit -m "feat(skill): add evaluated capability lifecycle"
```

### Task 5: 实现 MCP Catalog、兼容性、双主体调用与受限 A2A 委托

**Files:**

- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/service.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/compatibility.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/a2a.py
- Create: mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/catalog.py
- Create: mate-platform-backend/packages/mate-tech-mcp/tests/test_catalog_authorization.py
- Create: mate-platform-backend/tests/security/test_mcp_dual_subject_authorization.py
- Create: mate-platform-backend/tests/integration/test_mcp_schema_compatibility.py
- Create: mate-platform-backend/tests/integration/test_a2a_delegation_limits.py

**Interfaces:**

- Consumes: Task 2 authorization, Task 4 CapabilityProjection, Runtime RunContext/Lease and published ToolSchemaSnapshot.
- Produces: register_server(), publish_route(), discover_catalog(), invoke_tool(), validate_schema_compatibility() and delegate_subrun().

- [ ] **Step 1: Write failing discover/authorize/compatibility/A2A tests**

```python
async def test_discovery_returns_metadata_but_call_requires_two_subjects(catalog):
    assert "order.inspect" in [tool.name for tool in await catalog.discover_catalog(READER)]
    denied = await catalog.invoke_tool("order.inspect", human=READER, employee=UNBOUND_EMPLOYEE, run=RUN, arguments={})
    assert denied.code == "DUAL_SUBJECT_DENIED"

def test_breaking_schema_snapshot_fails_closed():
    assert validate_schema_compatibility(old_schema(), removed_required_field_schema()).compatible is False

async def test_a2a_rejects_depth_and_capability_escape(delegator):
    with pytest.raises(DelegationDenied, match="A2A_LIMIT_EXCEEDED"):
        await delegator.delegate_subrun(parent=RUN, requested_capabilities=("admin.delete",), depth=5)
```

- [ ] **Step 2: Run catalog tests and verify they fail**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_catalog_authorization.py mate-platform-backend/tests/security/test_mcp_dual_subject_authorization.py mate-platform-backend/tests/integration/test_mcp_schema_compatibility.py mate-platform-backend/tests/integration/test_a2a_delegation_limits.py -q

Expected: FAIL because Catalog, compatibility and A2A services are absent.

- [ ] **Step 3: Implement the one authorized invocation path**

Discovery returns tenant-filtered metadata only. Invocation verifies Server/Route/Schema publication, compatibility, human and Employee relations, CapabilityProjection, Run/Lease, approval and OPA purpose/risk before resolving AuthProfile; raw credentials never cross MCP responses. A2A creates Runtime-approved SubRun requests with inherited budget/TTL/depth/allowlist and no side-effect authority. Incompatible Route publication is rejected and emits revocation Event.

- [ ] **Step 4: Verify authorization, compatibility and delegation boundaries**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_catalog_authorization.py mate-platform-backend/tests/security/test_mcp_dual_subject_authorization.py mate-platform-backend/tests/integration/test_mcp_schema_compatibility.py mate-platform-backend/tests/integration/test_a2a_delegation_limits.py -q

Expected: PASS; listing Tool never grants it, breaking schema fails closed and A2A cannot escape parent limits.

- [ ] **Step 5: Commit**

```bash
git add mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/catalog.py mate-platform-backend/packages/mate-tech-mcp/tests/test_catalog_authorization.py mate-platform-backend/tests/security/test_mcp_dual_subject_authorization.py mate-platform-backend/tests/integration/test_mcp_schema_compatibility.py mate-platform-backend/tests/integration/test_a2a_delegation_limits.py
git commit -m "feat(mcp): add dual-subject catalog"
```

### Task 6: 暴露 REST、Event、UI 与跨宿主 E2E/恢复证据

**Files:**

- Create: mate-platform-backend/contracts/openapi/services/ontology-skill-mcp.yaml
- Modify: mate-platform-backend/contracts/openapi/manifest.yaml
- Create: mate-platform-backend/contracts/events/ontology-skill-mcp.v1.json
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center/quality_api.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities/api.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/api.py
- Create: metaplatform-frontend/apps/web/src/pages/ontology/OntologyCenterPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/mcp/McpCatalogPage.tsx
- Create: mate-platform-backend/tests/e2e/test_ontology_skill_mcp_flow.py
- Create: metaplatform-frontend/apps/web/e2e/ontology-skill-mcp.spec.ts
- Create: scripts/test-ontology-skill-mcp-e2e.ps1
- Modify: acceptance/release/v1/requirements.yaml
- Modify: acceptance/release/v1/interface-registry.yaml

**Interfaces:**

- Consumes MVP3 REST /api/v1/ontology/proposals and /releases plus ontology.package.published.v1; produces /api/v1/ontology/evolution-runs, /quality-assessments, /capabilities, /skills, /mcp/servers, /routes, /compatibility; Events ontology.maintenance.proposed.v1, ontology.quality.assessed.v1, skill.revoked.v1, mcp.route.revoked.v1; management pages and release evidence.

- [ ] **Step 1: Write failing API/UI/E2E/recovery test**

```python
async def test_document_to_candidate_review_publish_skill_bound_mcp_call_and_restore(stack):
    proposal = await stack.submit_governed_document_for_extraction()
    assert proposal.state == "draft"
    package = await stack.human_review_shacl_publish(proposal.id)
    await stack.bind_passing_skill_to_employee(package.digest)
    result = await stack.invoke_cataloged_tool_as_authorized_dual_subject()
    assert result.is_error is False
    assert (await stack.restore_and_reconcile()).ontology_package_digest == package.digest
```

- [ ] **Step 2: Run E2E and verify it fails**

Run: pwsh -File scripts/test-ontology-skill-mcp-e2e.ps1

Expected: FAIL until API, Catalog, UI and live dependency paths exist.

- [ ] **Step 3: Implement transport adapters and isolated live runner**

API endpoints call Task 2–5 services with tenant/actor context. UI shows source anchors, quality/impact, Release diff, Skill evaluation, Route compatibility, authorization denial and CapabilityAvailabilityProjection; it has no direct Jena/provider/credential call. The runner uses an isolated tenant and approved de-identified material, invokes REST/MCP/A2A/browser paths, injects SHACL failure, revoked Skill and incompatible Route, restores independent target and reconciles Release Ledger/Audit/Capability facts.

- [ ] **Step 4: Verify E2E, failure and recovery behavior**

Run: pwsh -File scripts/test-ontology-skill-mcp-e2e.ps1; mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/e2e/test_ontology_skill_mcp_flow.py -q; pnpm --dir metaplatform-frontend exec playwright test apps/web/e2e/ontology-skill-mcp.spec.ts

Expected: PASS; AI only makes candidates, human-gated release recovers, revoked/unauthorized MCP never reaches provider.

- [ ] **Step 5: Commit**

```bash
git add mate-platform-backend/contracts/openapi/services/ontology-skill-mcp.yaml mate-platform-backend/contracts/openapi/manifest.yaml mate-platform-backend/contracts/events/ontology-skill-mcp.v1.json mate-platform-backend/packages/mate-platform/src/mate_platform/ontology_center/quality_api.py mate-platform-backend/packages/mate-platform/src/mate_platform/capabilities/api.py mate-platform-backend/packages/mate-platform/src/mate_platform/mcp_catalog/api.py metaplatform-frontend/apps/web/src/pages/ontology metaplatform-frontend/apps/web/src/pages/mcp mate-platform-backend/tests/e2e/test_ontology_skill_mcp_flow.py metaplatform-frontend/apps/web/e2e/ontology-skill-mcp.spec.ts scripts/test-ontology-skill-mcp-e2e.ps1 acceptance/release/v1/requirements.yaml acceptance/release/v1/interface-registry.yaml
git commit -m "test(ontology): prove governed ontology skill mcp flow"
```

## Self-Review

- Tasks 1–3 cover the six ontology object types, candidate/review/publish/rollback, AI automatic construction/evolution and quality.
- Task 4 covers Skill/Capability CRUD lifecycle, evaluation, Employee binding, revocation and executable-package restriction.
- Tasks 2, 5 and 6 cover MCP Catalog lifecycle, discovery-not-authorization, dual-subject policy, schema compatibility, bounded A2A, REST/MCP/A2A/Event/UI, failure/degradation, E2E and recovery.
- The plan leaves Runtime, human approval consumption, Action side effects and Temporal durability under their designated authorities.
