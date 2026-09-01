# MVP 03 Ontology Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从受授权的对话和材料生成带来源的本体候选，通过数字员工协作、去重、SHACL、影响分析和职责分离评审，发布可回滚的签名本体版本。

**Architecture:** 对话与材料共用一个 SemanticExtractionResult，不建立两个识别运行时。PostgreSQL 保持本体定义和发布状态权威，Jena 为每个 OntologyPackage Digest 建不可变 Named Graph；A2A 只承担 SubRun 委托，Employee Runtime 仍是任务、预算、Lease 和状态权威。

**Tech Stack:** Python 3.12、Pydantic 2、FastAPI、PostgreSQL、Apache Jena Fuseki/TDB2、SHACL、A2A 条件启用、Temporal、OCI/ORAS/Cosign、React/Vite、Cytoscape.js。

**Spec:** `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md`

## Global Constraints

- 模型、宿主和数字员工只能提交候选，不能直接写权威本体或切换 Jena `current`。
- 对话和材料使用同一 Candidate Schema，并记录来源 Digest、页码/消息、字符跨度、模型回执和授权水位。
- 每次 A2A 委托创建 SubRun，必须限制父 Run、权限、预算、深度和截止时间；禁止扩权与循环。
- 提取者、评审者和发布者职责分离；SHACL、breaking-change 检查和签名是发布强制门。
- 一个 OntologyPackage Digest 对应一个不可变 Named Graph；既有 Run 继续使用固定 Digest。
- 失败发布不能改变 PostgreSQL `active_version` 或 Jena `current` 别名。

---

## File Structure

- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/proposal_contracts.py`: 共享抽取、候选、冲突和发布契约。
- `mate-platform-backend/packages/mate-app-ontology-factory/`: 输入、委托、提案、校验和发布应用服务。
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/`: 复用 PostgreSQL 权威并增加版本发布接口。
- `mate-platform-backend/packages/mate-clients/src/mate_clients/jena.py`: Jena 投影适配器。
- `metaplatform-frontend/apps/web/src/pages/ontology/OntologyFactoryPage.tsx`: 候选证据、冲突、图差异和审批页面。

### Task 1: 定义统一语义抽取与本体提案契约

**Files:**
- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/proposal_contracts.py`
- Modify: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/__init__.py`
- Test: `mate-platform-backend/packages/mate-kernel/tests/test_ontology_proposal_contracts.py`

**Interfaces:**
- Consumes: MVP1 `RunContext`, Artifact Digest and ModelReceipt reference.
- Produces: `SourceAnchor`, `EntityCandidate`, `RelationCandidate`, `ConstraintCandidate`, `ActionCandidate`, `SemanticExtractionResult`, `OntologyProposal`, `ValidationReport`.

- [ ] **Step 1: Write failing provenance and identity tests**

```python
def test_relation_candidate_requires_two_anchored_entities() -> None:
    with pytest.raises(ValidationError):
        RelationCandidate(rid="supplies", source="supplier-a", target="", anchors=[])

def test_dialogue_and_document_share_the_same_result_type() -> None:
    dialogue = SemanticExtractionResult(source_kind="dialogue", source_digest="a" * 64, candidates=[])
    document = SemanticExtractionResult(source_kind="document", source_digest="b" * 64, candidates=[])
    assert dialogue.__class__ is document.__class__ is SemanticExtractionResult
```

- [ ] **Step 2: Run tests and verify the shared contract is absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_ontology_proposal_contracts.py -q`

Expected: FAIL with missing module/types.

- [ ] **Step 3: Implement immutable candidate and proposal types**

Every candidate has stable candidate ID, candidate kind, normalized label/RID, confidence, source anchors, model receipt, proposed operation and conflict status. `OntologyProposal` contains base ontology Digest, candidate Digests, proposer principal and lifecycle `draft → validated → in_review → approved → published|rejected`; direct `draft → published` validation fails.

- [ ] **Step 4: Run kernel proposal tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_ontology_proposal_contracts.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the shared proposal contract**

```bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/proposal_contracts.py mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/__init__.py mate-platform-backend/packages/mate-kernel/tests/test_ontology_proposal_contracts.py
git commit -m "feat(ontology): define evidence-backed proposal contracts"
```

### Task 2: 建立统一对话/材料输入与候选提取服务

**Files:**
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/pyproject.toml`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/__init__.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/api.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/main.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/input_service.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/extraction_service.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/Dockerfile`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/source/dialogue_service.py`
- Create: `mate-platform-backend/alembic/versions/20260901_0018_ontology_factory.py`
- Create: `mate-platform-backend/contracts/openapi/services/ontology-factory.yaml`
- Modify: `mate-platform-backend/contracts/openapi/manifest.yaml`
- Modify: `mate-platform-backend/pyproject.toml`
- Modify: `mate-platform-backend/uv.lock`
- Modify: `mate-platform-backend/services/api-gateway/src/mate_api_gateway/main.py`
- Create: `infra/helm/charts/ontology-factory/Chart.yaml`
- Create: `infra/helm/charts/ontology-factory/values.yaml`
- Create: `infra/helm/charts/ontology-factory/templates/deployment.yaml`
- Create: `infra/helm/charts/ontology-factory/templates/service.yaml`
- Create: `infra/helm/charts/ontology-factory/templates/networkpolicy.yaml`
- Test: `mate-platform-backend/packages/mate-app-ontology-factory/tests/test_extraction_service.py`
- Test: `mate-platform-backend/packages/mate-app-ontology-factory/tests/test_source_authority_postgres.py`
- Test: `mate-platform-backend/contracts/tests/test_ontology_factory_runtime.py`

**Interfaces:**
- Consumes: Task 1 contracts, shared MVP2 `GovernedSourceDocument`/RAG snapshots, and server-authorized `DialogueSourceSnapshot` Digests.
- Produces: `extract_from_dialogue(run, snapshot_digest) -> SemanticExtractionResult`; `extract_from_document(run, source_document_digest) -> SemanticExtractionResult`; runnable `mate_app_ontology_factory.main:app`; source/candidate/proposal/approval/release-ledger tables under migration `0018`; HTTP lifecycle `/api/v1/ontology-factory/sources/dialogues`, `/sources/documents`, `/extractions`, `/proposals`, `/proposals/{id}/validate`, `/proposals/{id}/approval`, `/proposals/{id}/publish` and `/releases/{id}`.

- [ ] **Step 1: Write source-deletion and unsupported-candidate tests**

```python
async def test_candidate_without_known_anchor_is_rejected(service):
    model = fake_model(entity_candidate(anchor_id="unknown"), receipt())
    result = await service.extract_from_dialogue(run(), messages(), model=model)
    assert result.accepted == []
    assert result.rejected[0].reason == "SOURCE_ANCHOR_NOT_FOUND"

async def test_revoked_source_marks_candidates_withdrawn(service):
    result = await service.extract_from_document(run(), material())
    await service.revoke_source(material().digest)
    assert all(c.status == "withdrawn" for c in await service.by_source(material().digest))

async def test_host_text_is_not_a_dialogue_authority(service):
    with pytest.raises(UnknownDialogueSnapshot):
        await service.extract_from_dialogue(run(), {"host_text": "customer means payer"})
```

- [ ] **Step 2: Run package and OpenAPI tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-factory/tests/test_extraction_service.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: FAIL before package/contract creation.

- [ ] **Step 3: Implement one extraction pipeline with two input adapters**

`DialogueSourceService` resolves server-side authorized messages, stores the minimum immutable message Digests/speaker/time/character spans, ACL, retention and withdrawal state, and returns a `DialogueSourceSnapshot` Digest. Host-submitted text is untrusted and cannot be used until it matches an authorized server snapshot. General material is referenced through shared `GovernedSourceDocument`, never through `ContractVersion`. Normalize both source types to `SourceAnchor`; call the service Model Gateway with ontology base Digest and constrained output schema; reject model source IDs absent from the input snapshot; run deterministic RID normalization and persist a candidate Artifact. Do not persist chat text inside the ontology proposal when a Digest/span reference is sufficient.

Migration `0018_ontology_factory` declares `revision = "0018_ontology_factory"` and `down_revision = "0017_contract_review"`; it creates dialogue snapshots/anchors, extraction results/candidates, proposals/approvals, ontology release ledger and source-remediation links with tenant RLS, immutable source/version constraints, indexes, backfill and bounded downgrade. The pooling test proves `SET LOCAL` tenant context is cleared between borrowers. `api.py` registers every lifecycle route listed above from this task; unfinished validate/approve/publish handlers fail explicitly as documented `503 CAPABILITY_NOT_READY` until Tasks 4-5 replace them. `create_app()` exposes health/readiness, OpenAPI `runtimeModule` is `mate_app_ontology_factory.main:app`, and API gateway/Helm assets make the service bootable. The runtime test compares all ASGI routes/methods/statuses with OpenAPI and performs a routed health call.

- [ ] **Step 4: Run extraction, cross-tenant and prompt-injection tests**

Run: `pwsh -File scripts/test-mvp-postgres.ps1 -Suite ontology-factory`

Expected: PASS with zero skipped required-live tests for dialogue, PDF/DOCX material, source revocation, duplicate input, injected instructions, RLS pool reuse and ASGI/OpenAPI/gateway consistency; cleanup occurs in `finally`.

- [ ] **Step 5: Commit unified semantic extraction**

```bash
git add mate-platform-backend/packages/mate-app-ontology-factory mate-platform-backend/packages/mate-platform/src/mate_platform/source/dialogue_service.py mate-platform-backend/alembic/versions/20260901_0018_ontology_factory.py mate-platform-backend/contracts/openapi/services/ontology-factory.yaml mate-platform-backend/contracts/openapi/manifest.yaml mate-platform-backend/pyproject.toml mate-platform-backend/uv.lock mate-platform-backend/services/api-gateway/src/mate_api_gateway/main.py infra/helm/charts/ontology-factory mate-platform-backend/contracts/tests/test_ontology_factory_runtime.py
git commit -m "feat(ontology): extract shared candidates from dialogue and material"
```

### Task 3: 实现受限 A2A SubRun 委托

**Files:**
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/delegation.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/service.py`
- Modify: `mate-platform-backend/packages/mate-clients/src/mate_clients/a2a/messages.py`
- Create: `mate-platform-backend/tests/interop/a2a-reference-server.yml`
- Create: `mate-platform-backend/tests/interop/test_a2a_reference_live.py`
- Create: `scripts/test-a2a-interop.ps1`
- Test: `mate-platform-backend/packages/mate-app-ontology-factory/tests/test_delegation.py`
- Test: `mate-platform-backend/tests/security/test_a2a_delegation.py`

**Interfaces:**
- Consumes: parent Run/Lease, A2A capability client and employee assignment/policy.
- Produces: `delegate(parent_run, employee_id, objective, budget, deadline) -> SubRun`; `complete_subrun(subrun_id, result_digest) -> EmployeeRun`.

- [ ] **Step 1: Write cycle, budget and privilege-attenuation tests**

```python
@pytest.mark.parametrize("request,error", [
    (cycle_request("extractor", "reviewer", "extractor"), "DELEGATION_CYCLE"),
    (budget_request(parent=100, child=101), "BUDGET_EXCEEDED"),
    (scope_request(parent={"read"}, child={"read", "publish"}), "SCOPE_ESCALATION"),
])
async def test_invalid_delegation_never_calls_gateway(request, error, service, gateway):
    assert (await service.delegate(request)).error_code == error
    gateway.send.assert_not_awaited()
```

- [ ] **Step 2: Run delegation tests and verify failures**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-factory/tests/test_delegation.py mate-platform-backend/tests/security/test_a2a_delegation.py -q`

Expected: FAIL before delegation service exists.

- [ ] **Step 3: Implement Employee Runtime-owned delegation**

Create the SubRun in Run Ledger before calling A2A; persist parent chain, depth, budget, deadline, attenuated scopes and approval inheritance. Reject cycles and stale parent Lease. Extend the existing `A2AMessagesClient` with the bounded SubRun envelope instead of adding a parallel client. The remote task carries only the SubRun token and cannot change parent state. If LiteLLM A2A has not passed the locked-version compatibility gate, use the same interface with an in-process service worker for the controlled MVP and mark A2A production status closed.

- [ ] **Step 4: Run unit and live A2A protocol compatibility tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-factory/tests/test_delegation.py mate-platform-backend/tests/security/test_a2a_delegation.py -q`

Expected: PASS; duplicate completion produces one result and one parent transition.

Run: `pwsh -File scripts/test-a2a-interop.ps1 run-all`

Expected: the exception-safe runner exports its reference endpoint in-process, proves the locked reference agent accepts a task, exposes poll/stream status, returns one Artifact Digest and rejects an over-budget/cyclic SubRun, then tears down in `finally`. If this separate live suite is not executed, A2A remains `NOT_EXERCISED`.

- [ ] **Step 5: Commit constrained delegation**

```bash
git add mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/delegation.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/service.py mate-platform-backend/packages/mate-clients/src/mate_clients/a2a/messages.py mate-platform-backend/tests/interop/a2a-reference-server.yml mate-platform-backend/tests/interop/test_a2a_reference_live.py scripts/test-a2a-interop.ps1 mate-platform-backend/packages/mate-app-ontology-factory/tests/test_delegation.py mate-platform-backend/tests/security/test_a2a_delegation.py
git commit -m "feat(ontology): add bounded a2a subrun delegation"
```

### Task 4: 建立候选去重、冲突、SHACL 和影响分析

**Files:**
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/proposal_service.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/validation.py`
- Modify: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/api.py`
- Modify: `mate-platform-backend/packages/mate-app-ontology-factory/pyproject.toml`
- Modify: `mate-platform-backend/uv.lock`
- Modify: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/tests/fixtures/shapes.ttl`
- Test: `mate-platform-backend/packages/mate-app-ontology-factory/tests/test_proposal_validation.py`

**Interfaces:**
- Consumes: SemanticExtractionResult(s), base ontology snapshot and governed data-product mappings.
- Produces: `merge_candidates(base_digest, results) -> OntologyProposal`; `validate_proposal(proposal) -> ValidationReport`.

- [ ] **Step 1: Write duplicate RID and breaking-change tests**

```python
def test_duplicate_rid_with_different_meaning_is_conflict(service):
    proposal = service.merge(base(), [entity("customer", meaning="buyer"), entity("customer", meaning="payer")])
    assert proposal.conflicts[0].code == "RID_SEMANTIC_CONFLICT"

def test_breaking_change_requires_explicit_migration(validation):
    report = validation.validate(remove_required_property("order.total"))
    assert report.publishable is False
    assert "MIGRATION_REQUIRED" in report.codes
```

- [ ] **Step 2: Run validation tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-factory/tests/test_proposal_validation.py -q`

Expected: FAIL before services exist.

- [ ] **Step 3: Implement deterministic merge and mandatory validation stages**

Resolve exact identity by stable RID and aliases, retain semantic conflicts for review, calculate affected actions/mappings/rules/data products, validate existing kernel rules, and run a precisely locked `pyshacl` dependency against the candidate RDF graph and `shapes.ttl`; regenerate `uv.lock` and record the pySHACL/RDFLib versions in ValidationReport. Require a migration reference for breaking changes. ValidationReport records validator versions, input Digest, findings and `publishable`. Replace the Task 2 placeholder validate route with the typed service call and return `200` with a Digest-bound ValidationReport or documented `409` for base-version/semantic conflict.

- [ ] **Step 4: Run proposal, existing ontology and gold-schema tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-factory/tests/test_proposal_validation.py mate-platform-backend/packages/mate-tech-ont/tests -q`

Expected: PASS without weakening existing ontology invariants.

- [ ] **Step 5: Commit ontology validation**

```bash
git add mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/proposal_service.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/validation.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/api.py mate-platform-backend/packages/mate-app-ontology-factory/pyproject.toml mate-platform-backend/uv.lock mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py mate-platform-backend/packages/mate-app-ontology-factory/tests
git commit -m "feat(ontology): validate and deconflict proposals"
```

### Task 5: 通过 Release Ledger 发布签名 OntologyPackage 并收敛 Jena 投影

**Files:**
- Create: `mate-platform-backend/packages/mate-clients/src/mate_clients/jena.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/package.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/approval_service.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/publish_workflow.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/release_repository.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/reconciler.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/reconciler_main.py`
- Modify: `mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/api.py`
- Modify: `infra/helm/charts/ontology-factory/values.yaml`
- Create: `infra/helm/charts/ontology-factory/templates/reconciler-deployment.yaml`
- Create: `infra/compose/test-jena-oci.yml`
- Create: `scripts/test-jena-oci.ps1`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/tests/test_publish_workflow.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/tests/test_reconciler_process.py`
- Create: `mate-platform-backend/tests/integration/test_jena_version_projection.py`

**Interfaces:**
- Consumes: validated proposal, ValidationReport, Run/Lease/current dual-principal authorization, OCI/ORAS/Cosign client, PostgreSQL Ontology Release Ledger authority and Jena client.
- Produces: `approve_proposal(run_context, proposal_digest, validation_digest, approver) -> ApprovalRecord`; `publish(run_context, lease_token, auth_context, proposal_digest, approval_digest) -> OntologyReleaseReceipt`; immutable graph URI `urn:metaplatform:ontology:{digest}` and a repairable Jena `current` projection.

- [ ] **Step 1: Write publication atomicity tests**

```python
async def test_failed_projection_never_activates_version(workflow, jena, pg):
    jena.load_graph.side_effect = ProjectionFailed()
    with pytest.raises(ProjectionFailed):
        await workflow.publish(approved_proposal())
    assert await pg.active_digest() == BASE_DIGEST
    assert await jena.current_digest() == BASE_DIGEST

async def test_existing_run_keeps_old_graph(workflow, runtime):
    old_run = await runtime.start(ontology_digest=BASE_DIGEST)
    await workflow.publish(approved_proposal())
    assert (await runtime.get(old_run.id)).ontology_digest == BASE_DIGEST

@pytest.mark.parametrize("crash_at", ["after_stage", "after_oci", "after_graph", "after_activate", "after_outbox"])
async def test_reconciler_converges_each_release_boundary(crash_at, workflow, reconciler):
    await workflow.publish(approved_proposal(), crash_at=crash_at)
    await reconciler.run_once()
    assert await release_invariants_hold()
```

- [ ] **Step 2: Run workflow/integration tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-factory/tests/test_publish_workflow.py mate-platform-backend/tests/integration/test_jena_version_projection.py -q`

Expected: FAIL before package/workflow/Jena client implementation.

- [ ] **Step 3: Implement package, signature and two-phase publication**

Replace the Task 2 approval/publish placeholders. `POST /proposals/{id}/approval` requires a separate authorized human, binds proposal and ValidationReport Digests, and returns an immutable ApprovalRecord; it cannot accept a client-created approval body. `POST /proposals/{id}/publish` accepts only the Approval Digest and idempotency key and returns `202` plus a release resource; `GET /releases/{id}` reports ledger state. Before every transition, revalidate publisher role separation, current policy/revocation/assignment watermarks, single-use Approval and Lease fencing. Serialize canonical ontology, shapes, mappings, validation report and SBOM; push by Digest and verify Cosign policy. Persist `STAGED → VALIDATED → ACTIVATING → ACTIVE | FAILED` in PostgreSQL. Load and query-check the immutable Jena graph and treat its `current` alias as a repairable projection; PostgreSQL active Digest is the only release authority used to start new Runs. Emit notifications only through the transactional Outbox.

`reconciler_main.py` is the sole long-running projection repair entry point. The Helm reconciler Deployment runs it separately from HTTP, elects one active reconciler with a PostgreSQL advisory lock, scans nonterminal releases on startup and on a bounded interval, and idempotently converges OCI/Jena/ledger state at every crash boundary. Killing the process after each boundary and allowing Kubernetes to restart it must converge without a second release/notification; readiness stays false until the initial scan completes. Do not garbage-collect graphs referenced by active Runs.

When a governed document or dialogue snapshot is withdrawn, unpublished candidates are withdrawn immediately. If its Digest appears in an active release, keep the historical graph immutable, flag provenance risk and create exactly one source-remediation proposal linked to the affected release.

- [ ] **Step 4: Run publish, rollback and projection-rebuild tests**

`test-jena-oci.ps1 run-all` starts locked Jena and an isolated OCI Distribution Registry, seeds an ephemeral test trust root, writes only non-secret endpoints, runs publication/reconciler tests and removes only its named environment in `finally`. This local registry is sufficient for controlled MVP acceptance; production publication remains disabled until the independent Task 6 `registry-trust` production Gate passes.

Run: `pwsh -File scripts/test-jena-oci.ps1 run-all`

Expected: PASS for approval creation, publish, injected projection failure, alias rollback, full rebuild from OCI Digest, killed-reconciler restart and autonomous convergence with one release/notification. Any skipped live case fails the runner.

- [ ] **Step 5: Commit the signed publish path**

```bash
git add mate-platform-backend/packages/mate-clients/src/mate_clients/jena.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/package.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/approval_service.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/publish_workflow.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/release_repository.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/reconciler.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/reconciler_main.py mate-platform-backend/packages/mate-app-ontology-factory/src/mate_app_ontology_factory/api.py infra/helm/charts/ontology-factory/values.yaml infra/helm/charts/ontology-factory/templates/reconciler-deployment.yaml infra/compose/test-jena-oci.yml scripts/test-jena-oci.ps1 mate-platform-backend/packages/mate-app-ontology-factory/tests/test_publish_workflow.py mate-platform-backend/packages/mate-app-ontology-factory/tests/test_reconciler_process.py mate-platform-backend/tests/integration/test_jena_version_projection.py
git commit -m "feat(ontology): publish signed versioned projections"
```

### Task 6: 交付本体工厂工作台、金标和端到端验收

**Files:**
- Create: `metaplatform-frontend/apps/web/src/pages/ontology/OntologyFactoryPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/ontology/OntologyFactoryPage.test.tsx`
- Create: `metaplatform-frontend/apps/web/src/api/ontology/factory.ts`
- Create: `metaplatform-frontend/tests/e2e/ontology-factory.spec.ts`
- Modify: `metaplatform-frontend/apps/web/package.json`
- Modify: `metaplatform-frontend/pnpm-lock.yaml`
- Create: `infra/compose/e2e-mvp3-ontology-factory.yml`
- Create: `scripts/test-mvp3-e2e.ps1`
- Create: `acceptance/goldens/ontology-factory/evaluate.py`
- Create: `acceptance/goldens/ontology-factory/manifest.yaml`
- Create: `acceptance/goldens/ontology-factory/expected-proposal.json`
- Create: `acceptance/mvp-03-ontology-factory.md`
- Create: `mate-platform-backend/packages/mate-app-ontology-factory/tests/conformance.py`

**Interfaces:**
- Consumes: Tasks 2-5 APIs and shared Artifact Renderer.
- Produces: source-linked candidate list, Cytoscape diff, conflict/validation panels, reviewer approval and release receipt.

- [ ] **Step 1: Encode gold sources and expected proposal**

Include one dialogue snapshot and one governed material expressing overlapping entities/relations, one semantic conflict, one breaking change and one unsupported candidate. Manifest fixes source/model/ontology Digests and requires entity precision ≥ 0.90, relation precision ≥ 0.85, source-anchor precision = 1.00 and unsupported publication count = 0. `evaluate.py` validates source Digests/spans, calls the controlled service and calculates each metric rather than accepting a handwritten result.

- [ ] **Step 2: Write UI tests for source, conflict and role separation**

```tsx
it("prevents the extractor from approving its own proposal", () => {
  render(<OntologyFactoryPage proposal={proposalBy("employee:extractor")} viewer={"employee:extractor"} />);
  expect(screen.getByRole("button", { name: "批准发布" })).toBeDisabled();
  expect(screen.getByText("提取者不能批准自己的提案")).toBeVisible();
});
```

- [ ] **Step 3: Implement workbench and graph diff**

Add pinned Cytoscape.js and component-test dependencies to the web package/lockfile. Use Ant Design for touched controls and Cytoscape.js only for the ontology graph. Selecting a node/edge opens exact source spans and validation findings. Approval calls the server and binds proposal/validation Digests; the browser never constructs publish requests from editable model text.

Reuse the non-vacuous web Vitest configuration from MVP2 (`passWithNoTests: false`). Run the deliberately missing `__runner_must_not_match__.test.tsx` filter and require a non-zero exit before adding the page test.

- [ ] **Step 4: Run kernel, service, UI and E2E suites**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_ontology_proposal_contracts.py mate-platform-backend/packages/mate-app-ontology-factory/tests mate-platform-backend/tests/integration/test_jena_version_projection.py -q`

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/conformance/employee_runtime -q --runtime-adapter=mate_app_ontology_factory.tests.conformance`

Run: `mate-platform-backend/.venv/Scripts/python.exe acceptance/goldens/ontology-factory/evaluate.py`

Run: `pnpm --dir metaplatform-frontend --filter @mate/web typecheck`

Run: `pnpm --dir metaplatform-frontend --filter @mate/web test -- OntologyFactoryPage.test.tsx`

Run: `pwsh -File scripts/test-mvp3-e2e.ps1 run-all`

Expected: the runner starts pinned IAM, PostgreSQL, API Gateway, ontology factory/reconciler, MCP, Jena, isolated OCI Registry/Cosign trust, the governed source adapters and web app; applies migrations, waits for readiness, exports `E2E_GATEWAY_URL`, runs Playwright before teardown in `finally` and fails on skips. Extraction, independent approval, publish, injected failed publish and projection rollback/reconciliation produce immutable records.

- [ ] **Step 5: Record controlled and production status**

`acceptance/mvp-03-ontology-factory.md` records gold metrics, identities for extractor/reviewer/publisher, A2A mode and version, Jena/OCI/Cosign Digests, failure injections, Git SHA and closed production gates.

- [ ] **Step 6: Commit the ontology factory MVP**

```bash
git add mate-platform-backend/packages/mate-app-ontology-factory/tests/conformance.py metaplatform-frontend/apps/web/src/pages/ontology/OntologyFactoryPage.tsx metaplatform-frontend/apps/web/src/pages/ontology/OntologyFactoryPage.test.tsx metaplatform-frontend/apps/web/src/api/ontology/factory.ts metaplatform-frontend/apps/web/package.json metaplatform-frontend/pnpm-lock.yaml metaplatform-frontend/tests/e2e/ontology-factory.spec.ts infra/compose/e2e-mvp3-ontology-factory.yml scripts/test-mvp3-e2e.ps1 acceptance/goldens/ontology-factory acceptance/mvp-03-ontology-factory.md
git commit -m "feat(ontology): deliver governed ontology factory MVP"
```
