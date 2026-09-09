# MVP 04 Ontology Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 持续接收知识切片和数据 Schema 变化，生成可去重、可回归、可审批、可发布或回滚的本体运维闭环，并完成启用组件的恢复和旧路径退役证明。

**Architecture:** NATS JetStream 只传递带因果信息的领域事件，PostgreSQL Run Ledger 和本体库仍是状态权威。漂移检测形成候选，影响分析和金标回归决定是否可进入人工审批；Temporal 承载长时评审/发布/回滚，MemoryCore 只通过受治理 Adapter 保存已审核经验。

**Tech Stack:** Python 3.12、PostgreSQL、NATS JetStream、CloudEvents、Temporal、RAGFlow、Jena、Trino/Iceberg/Polaris 条件启用、MemoryCore、OpenTelemetry/OpenInference、React/Vite、Cytoscape.js。

**Spec:** `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md`

## Global Constraints

- 自动检测只能创建 `DriftProposal`，不能自动审批或发布本体。
- 每个事件携带 tenant、event ID、run/subrun、causation、correlation、Schema version 和权限水位。
- 事件重复、乱序、重放和毒消息不得产生重复提案或重复发布。
- 质量下降、证据不足、影响范围未知、授权过期或旧 Lease 均失败关闭。
- 回滚必须同时处理 PostgreSQL 权威版本、Jena alias、缓存、下游通知和运行引用；既有 Run 不切换 Digest。
- MemoryCore 只保存审核后的 L0-L3 经验，不拥有员工、团队、任务、技能、ACL、Wiki、CodeGraph 或知识权威。
- MemoryCore 不是 MVP4 本体运维业务验收的权威，但首发记忆中心是独立承诺 Feature：MVP4 可先完成本体检测、审批、发布和回滚，PI-5 与 platform-ga 仍必须完成受治理记忆、删除传播、恢复和当前 Gate，不能以 NOT_IN_RUNTIME 绕过。
- 旧 Kafka、MinIO、网关或存储只在消费者、数据校验、恢复和回滚证据齐备后退役。

---

## File Structure

- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/operations_contracts.py`: 事件、漂移、影响、回归和回滚契约。
- `mate-platform-backend/packages/mate-app-ontology-ops/`: 事件消费、漂移、回归、工作流和运维 API。
- `mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/`: NATS、Inbox、Outbox、DLQ 和重放基础。
- `mate-platform-backend/packages/mate-clients/src/mate_clients/memory_core.py`: 受治理 Memory Adapter 客户端。
- `metaplatform-frontend/apps/web/src/pages/ontology/OntologyOperationsPage.tsx`: 漂移、影响、回归、发布和恢复面板。

### Task 1: 定义运维事件、漂移和回归契约

**Files:**
- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/operations_contracts.py`
- Modify: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/__init__.py`
- Test: `mate-platform-backend/packages/mate-kernel/tests/test_ontology_operations_contracts.py`

**Interfaces:**
- Consumes: MVP1 Run/Artifact and MVP3 OntologyProposal/OntologyReleaseReceipt.
- Produces: `KnowledgeSliceChanged`, `DataSchemaChanged`, `DriftProposal`, `ImpactReport`, `RegressionReport`, `RollbackPlan`.

- [ ] **Step 1: Write failing event provenance tests**

```python
def test_schema_event_requires_causation_and_permission_watermark() -> None:
    with pytest.raises(ValidationError):
        DataSchemaChanged(
            event_id=uuid4(), tenant_id="t1", data_product="orders",
            schema_digest="a" * 64, causation_id=None, permission_watermark=None,
        )

def test_drift_proposal_cannot_be_publishable_without_regression() -> None:
    proposal = DriftProposal(base_digest=BASE, evidence=[event_ref()], regression_report_digest=None)
    assert proposal.publishable is False
```

- [ ] **Step 2: Run the kernel tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_ontology_operations_contracts.py -q`

Expected: FAIL before the module exists.

- [ ] **Step 3: Implement immutable operations contracts**

Use CloudEvents-compatible envelope fields, explicit source watermark and event Schema version. `DriftProposal` references evidence and base ontology Digest; `ImpactReport` enumerates affected objects/actions/mappings/runs; `RegressionReport` contains gold suite Digest, metric values, thresholds and pass/fail; `RollbackPlan` binds the release to restore and the target prior Digest.

- [ ] **Step 4: Run contract tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_ontology_operations_contracts.py -q`

Expected: PASS.

- [ ] **Step 5: Commit operations contracts**

```bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/operations_contracts.py mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/__init__.py mate-platform-backend/packages/mate-kernel/tests/test_ontology_operations_contracts.py
git commit -m "feat(ontology): define operations and drift contracts"
```

### Task 2: 建立 NATS Outbox/Inbox、去重、DLQ 和安全重放

**Files:**
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/nats.py`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/inbox.py`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/replay.py`
- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/outbox.py`
- Create: `mate-platform-backend/alembic/versions/20260901_0019_ontology_operations.py`
- Create: `mate-platform-backend/alembic/versions/20260901_0020_event_inbox_dlq.py`
- Create: `mate-platform-backend/tests/migrations/test_mvp_migration_chain.py`
- Modify: `mate-platform-backend/packages/mate-platform/pyproject.toml`
- Modify: `mate-platform-backend/uv.lock`
- Create: `infra/helm/charts/nats/Chart.yaml`
- Create: `infra/helm/charts/nats/Chart.lock`
- Create: `infra/helm/charts/nats/values.yaml`
- Create: `infra/helm/charts/nats/templates/accounts-config.yaml`
- Create: `infra/helm/charts/nats/templates/streams-config.yaml`
- Create: `infra/compose/test-nats.yml`
- Create: `scripts/test-nats.ps1`
- Test: `mate-platform-backend/packages/mate-platform/tests/test_nats_delivery.py`
- Test: `mate-platform-backend/packages/mate-platform/tests/test_safe_replay.py`

**Interfaces:**
- Consumes: CloudEvents from Task 1 and Run Ledger authorization/Lease checks.
- Produces: `publish_outbox(batch_size: int) -> PublishBatchResult`; `consume_once(event, handler) -> ConsumeResult`; `replay_dlq(event_id, expected_policy_watermark) -> ConsumeResult`.

- [ ] **Step 1: Write duplicate, poison and stale-policy tests**

```python
async def test_duplicate_event_calls_handler_once(inbox, event, handler):
    await inbox.consume_once(event, handler)
    await inbox.consume_once(event, handler)
    handler.assert_awaited_once()

async def test_dlq_replay_rechecks_policy(inbox, stale_event):
    result = await inbox.replay_dlq(stale_event.id, expected_policy_watermark=9)
    assert result.error_code == "POLICY_WATERMARK_STALE"
```

- [ ] **Step 2: Run messaging tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_nats_delivery.py mate-platform-backend/packages/mate-platform/tests/test_safe_replay.py -q`

Expected: FAIL because NATS/Inbox/replay modules are missing.

- [ ] **Step 3: Implement at-least-once transport with exactly-once business effect**

Pin `nats-py` in package/root locks. Migration constants are exact: `0019_ontology_operations.down_revision = "0018_ontology_factory"` and `0020_event_inbox_dlq.down_revision = "0019_ontology_operations"`. Migration `0019` creates DriftProposal, durable `analysis_jobs`, ImpactReport, RegressionReport and rollback ledgers with RLS/backfill/downgrade; memory review/revocation tables belong exclusively to revision 0025 and the action-data-knowledge-memory plan. `0020` creates Outbox/Inbox/DLQ/replay-attempt tables plus event/idempotency uniqueness. `test_mvp_migration_chain.py` requires one Alembic head and executes `0015_merge_migration_heads → 0020_event_inbox_dlq → 0015_merge_migration_heads → 0020_event_inbox_dlq` against seeded legacy order/evidence data, then proves backfill, RLS, foreign keys and uniqueness constraints survived. Publish transaction Outbox rows to tenant-scoped JetStream subjects. Insert event ID into Inbox in the same transaction as handler state changes. Classify retryable, permanent and poison failures; route poison/permanent events to DLQ with redacted diagnostic metadata. Replay reacquires authorization, checks Run state, policy watermark and idempotency instead of bypassing the original handler.

The NATS account config gives each producer/consumer a distinct service principal and subject ACL: RAG may publish only `tenant.*.knowledge.slice.changed`, data service only `tenant.*.data.schema.changed`, ops consumers may consume their tenant streams, and replay may publish only the replay subject. JetStream config pins retention, maximum age/bytes/message size, duplicate window, consumer ack policy/backoff/max-deliver and DLQ stream. Each event carries the authenticated producer principal and a server-verified signature; body tenant is never an authorization fact.

- [ ] **Step 4: Run tests against a pinned NATS deployment**

Run: `pwsh -File scripts/test-nats.ps1 run-all`

Expected: the runner starts locked NATS and PostgreSQL in uniquely named projects, sets both URLs in the same process, applies Alembic from `mate-platform-backend`, runs delivery, safe-replay and full migration-chain tests with JUnit output, rejects any skipped required-live test, and removes both environments in `finally`. PASS covers duplicate, reorder, consumer crash, poison message, replay and migration round-trip.

- [ ] **Step 5: Commit the event reliability layer**

```bash
git add mate-platform-backend/packages/mate-platform/src/mate_platform/messaging mate-platform-backend/alembic/versions/20260901_0019_ontology_operations.py mate-platform-backend/alembic/versions/20260901_0020_event_inbox_dlq.py mate-platform-backend/tests/migrations/test_mvp_migration_chain.py mate-platform-backend/packages/mate-platform/pyproject.toml mate-platform-backend/uv.lock infra/helm/charts/nats infra/compose/test-nats.yml scripts/test-nats.ps1 mate-platform-backend/packages/mate-platform/tests/test_nats_delivery.py mate-platform-backend/packages/mate-platform/tests/test_safe_replay.py
git commit -m "feat(events): add nats inbox outbox and safe replay"
```

### Task 3: 从知识切片和 Schema 事件形成去重漂移提案

**Files:**
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/pyproject.toml`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/__init__.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/api.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/main.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/drift_service.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/event_handlers.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/consumer_main.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/Dockerfile`
- Create: `mate-platform-backend/packages/mate-tech-rag/src/mate_tech_rag/events/slice_changed.py`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/events/schema_changed.py`
- Modify: `mate-platform-backend/packages/mate-tech-rag/src/mate_tech_rag/api/app.py`
- Modify: `mate-platform-backend/packages/mate-tech-rag/src/mate_tech_rag/api/document_registry.py`
- Modify: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/app.py`
- Modify: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/sql_store.py`
- Modify: `mate-platform-backend/packages/mate-tech-rag/pyproject.toml`
- Modify: `mate-platform-backend/packages/mate-tech-data/pyproject.toml`
- Create: `mate-platform-backend/contracts/openapi/services/ontology-ops.yaml`
- Modify: `mate-platform-backend/contracts/openapi/manifest.yaml`
- Modify: `mate-platform-backend/pyproject.toml`
- Modify: `mate-platform-backend/uv.lock`
- Modify: `mate-platform-backend/services/api-gateway/src/mate_api_gateway/main.py`
- Create: `infra/helm/charts/ontology-ops/Chart.yaml`
- Create: `infra/helm/charts/ontology-ops/values.yaml`
- Create: `infra/helm/charts/ontology-ops/templates/deployment.yaml`
- Create: `infra/helm/charts/ontology-ops/templates/consumer-deployment.yaml`
- Create: `infra/helm/charts/ontology-ops/templates/service.yaml`
- Create: `infra/helm/charts/ontology-ops/templates/networkpolicy.yaml`
- Test: `mate-platform-backend/packages/mate-app-ontology-ops/tests/test_drift_service.py`
- Test: `mate-platform-backend/packages/mate-tech-rag/tests/test_slice_changed_outbox.py`
- Test: `mate-platform-backend/packages/mate-tech-data/tests/test_schema_changed_outbox.py`
- Test: `mate-platform-backend/packages/mate-app-ontology-ops/tests/test_consumer_process.py`
- Test: `mate-platform-backend/contracts/tests/test_ontology_ops_runtime.py`

**Interfaces:**
- Consumes: Task 1 events, RAGFlow slice snapshots, data product schemas and MVP3 proposal service.
- Produces: RAG slice and data-schema transactional Outbox producers; `handle_knowledge_change(event) -> DriftProposal`; `handle_schema_change(event) -> DriftProposal`; uniqueness key `(tenant_id, base_digest, source_digest, detector_version)`; runnable HTTP `mate_app_ontology_ops.main:app` and JetStream consumer `mate_app_ontology_ops.consumer_main`; lifecycle routes `/api/v1/ontology-operations/drift-proposals`, `/drift-proposals/{id}`, `/drift-proposals/{id}/impact`, `/drift-proposals/{id}/regression`, `/drift-proposals/{id}/approval`, `/drift-proposals/{id}/publish` and `/releases/{id}/rollback`.

- [ ] **Step 1: Write no-change, duplicate and evidence-loss tests**

```python
async def test_duplicate_events_return_same_proposal(service):
    first = await service.handle_schema_change(schema_event())
    second = await service.handle_schema_change(schema_event())
    assert first.proposal_id == second.proposal_id

async def test_missing_source_snapshot_abstains(service):
    result = await service.handle_knowledge_change(event_for_deleted_slice())
    assert result.status == "evidence_unavailable"
    assert result.publishable is False
```

- [ ] **Step 2: Run service and OpenAPI tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-ops/tests/test_drift_service.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: FAIL before app/contract creation.

- [ ] **Step 3: Implement deterministic correlation and candidate generation**

Modify the actual commit points, not only helper modules. In RAG, move governed document/slice activation into the PostgreSQL-backed `document_registry` transaction invoked by `api/app.py`; that transaction records the immutable slice snapshot/tombstone and `KnowledgeSliceChanged` Outbox row together. In Data, add governed data-product schema version activation to `repositories/sql_store.py` and call it from the authenticated `api/app.py` route; activation and `DataSchemaChanged` Outbox are one transaction. A transaction rollback leaves neither activation nor event. Producers authenticate with their Task 2 principals and never publish directly from request code. Load the exact source snapshot and base ontology Digest; compare normalized concepts, fields, constraints and mappings; suppress no-change events; group semantically identical events by uniqueness key and evidence Digests. Model-assisted interpretation produces candidates with ModelReceipt but cannot set `publishable`. Persist DriftProposal as an Artifact linked to the MaintenanceRun.

Make both process types startable. `api.py` registers the full lifecycle route skeleton; Task 3 implements list/read drift routes and unfinished impact/regression/approval/publish/rollback routes fail as documented `503 CAPABILITY_NOT_READY` until Tasks 4-5 replace them. OpenAPI `runtimeModule=mate_app_ontology_ops.main:app`, root Python path/import/lock updates, API-gateway service/route entry, non-root Docker image, health/readiness and Helm NetworkPolicy are mandatory. `consumer_main.py` is a separate Helm Deployment using a durable pull consumer, explicit tenant-scoped subject, bounded concurrency and a PostgreSQL advisory leader lock; it drains Inbox idempotently and resumes backlog after process death. The runtime test boots ASGI, compares every OpenAPI route/method/status, and proves both real producers drive one proposal through NATS while killing/restarting the consumer produces no duplicate.

- [ ] **Step 4: Run drift gold cases and event-storm test**

Run: `pwsh -File scripts/test-nats.ps1 run-drift`

Expected: PASS for known drift, no change, duplicate events and deleted evidence. The 10,000-event storm completes with zero duplicate proposals/lost events, process RSS growth `<= 128 MiB`, peak consumer backlog `<= 2,000`, p95 handler latency `<= 250 ms` after warm-up and backlog returning to zero within 60 seconds on the locked CI runner; record runner CPU/RAM and throughput with the result.

Expected: `run-drift` adds transaction rollback, consumer kill/restart and ASGI/OpenAPI/gateway tests to the same exception-safe NATS/PostgreSQL lifecycle; any skipped live case fails.

- [ ] **Step 5: Commit drift proposal generation**

```bash
git add mate-platform-backend/packages/mate-app-ontology-ops mate-platform-backend/packages/mate-tech-rag/src/mate_tech_rag/events/slice_changed.py mate-platform-backend/packages/mate-tech-rag/src/mate_tech_rag/api/app.py mate-platform-backend/packages/mate-tech-rag/src/mate_tech_rag/api/document_registry.py mate-platform-backend/packages/mate-tech-rag/pyproject.toml mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/events/schema_changed.py mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/app.py mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/sql_store.py mate-platform-backend/packages/mate-tech-data/pyproject.toml mate-platform-backend/contracts/openapi/services/ontology-ops.yaml mate-platform-backend/contracts/openapi/manifest.yaml mate-platform-backend/pyproject.toml mate-platform-backend/uv.lock mate-platform-backend/services/api-gateway/src/mate_api_gateway/main.py infra/helm/charts/ontology-ops mate-platform-backend/packages/mate-tech-rag/tests/test_slice_changed_outbox.py mate-platform-backend/packages/mate-tech-data/tests/test_schema_changed_outbox.py mate-platform-backend/contracts/tests/test_ontology_ops_runtime.py
git commit -m "feat(ontology): derive deduplicated drift proposals"
```

### Task 4: 实现影响分析、金标回归和发布判定

**Files:**
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/impact.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/regression.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/analysis_job_repository.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/analysis_worker_main.py`
- Modify: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/api.py`
- Modify: `infra/helm/charts/ontology-ops/values.yaml`
- Create: `infra/helm/charts/ontology-ops/templates/analysis-worker-deployment.yaml`
- Create: `infra/compose/test-ontology-analysis.yml`
- Create: `scripts/test-ontology-analysis.ps1`
- Create: `acceptance/goldens/ontology-operations/manifest.yaml`
- Create: `acceptance/goldens/ontology-operations/cases.json`
- Test: `mate-platform-backend/packages/mate-app-ontology-ops/tests/test_impact.py`
- Test: `mate-platform-backend/packages/mate-app-ontology-ops/tests/test_regression.py`
- Test: `mate-platform-backend/packages/mate-app-ontology-ops/tests/test_analysis_worker.py`

**Interfaces:**
- Consumes: DriftProposal, PostgreSQL ontology mappings, Jena version graph and governed data product metadata; Trino only when cross-source impact requires it.
- Produces: `analyze_impact(proposal) -> ImpactReport`; `run_regression(proposal, suite_digest) -> RegressionReport`.

- [ ] **Step 1: Define numeric gates in the gold manifest**

Set entity precision threshold `0.92`, relation precision `0.88`, existing-query pass rate `1.00`, protected-action contract pass rate `1.00`, unsupported publication count `0`, and maximum approved query latency regression `0.15`. Any metric below its threshold sets `publishable=false`.

- [ ] **Step 2: Write unknown-impact and regression-failure tests**

```python
def test_unknown_consumer_blocks_publication(impact_service):
    report = impact_service.analyze(proposal_touching_unregistered_mapping())
    assert report.complete is False
    assert report.publishable is False

def test_one_protected_query_failure_blocks_publication(regression):
    report = regression.run(suite_with_one_failure())
    assert report.protected_action_contract_pass_rate < 1.0
    assert report.publishable is False
```

- [ ] **Step 3: Implement impact graph and repeatable regression runner**

Resolve affected ontology objects, mappings, MCP capabilities, policy rules, data products and active Run Digests. Use Jena for versioned graph queries and direct governed metadata APIs; invoke Trino only for read-only cross-source samples with recorded logical/physical query Digests and source watermarks. Regression runs in an isolated dataset and stores per-case evidence. Replace the Task 3 impact/regression placeholder routes: both insert-or-return a durable `analysis_jobs` row and return `202` plus its resource; uniqueness is `(tenant_id, proposal_digest, analysis_kind, input_digest)`, so retries cannot create another job. The job freezes proposal/base/source/policy Digests and exposes `PENDING | RUNNING | SUCCEEDED | FAILED` plus attempt/error/result Digest; changed proposal/base returns documented `409`.

`analysis_worker_main.py` is a separate Helm process. It claims jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`, CAS state version, owner/lease expiry and heartbeat; after a crash another worker may reclaim only after expiry. Result Artifact insertion and terminal `SUCCEEDED` transition are one transaction, while retries keep the same job/idempotency identity. Startup scans expired RUNNING jobs. `test_analysis_worker.py` kills the worker after claim and after Artifact insert, restarts it and proves autonomous recovery with one ImpactReport/RegressionReport and no lost job.

- [ ] **Step 4: Run impact/regression suites twice for determinism**

Run: `pwsh -File scripts/test-ontology-analysis.ps1 run-all`

Expected: the exception-safe runner starts PostgreSQL plus locked Jena and read-only Trino fixtures, applies migrations, starts the real analysis worker, runs impact/regression determinism and process-kill/restart cases with zero required-live skips, and tears down in `finally`. Two runs over the same Digests produce identical metric values/report Digest and one durable job result.

- [ ] **Step 5: Commit impact and regression gates**

```bash
git add mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/impact.py mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/regression.py mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/analysis_job_repository.py mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/analysis_worker_main.py mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/api.py infra/helm/charts/ontology-ops/values.yaml infra/helm/charts/ontology-ops/templates/analysis-worker-deployment.yaml infra/compose/test-ontology-analysis.yml scripts/test-ontology-analysis.ps1 mate-platform-backend/packages/mate-app-ontology-ops/tests acceptance/goldens/ontology-operations
git commit -m "feat(ontology): gate drift with impact and regression"
```

### Task 5: 编排人工审批、发布和全链路回滚

**Files:**
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/workflow.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/approval_service.py`
- Modify: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/api.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/temporal_worker.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/worker_main.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/pyproject.toml`
- Modify: `mate-platform-backend/packages/mate-app-wfe/Dockerfile`
- Modify: `mate-platform-backend/uv.lock`
- Modify: `infra/helm/charts/ontology-ops/values.yaml`
- Create: `infra/helm/charts/ontology-ops/templates/temporal-worker.yaml`
- Create: `infra/compose/test-ontology-temporal.yml`
- Create: `scripts/test-ontology-temporal.ps1`
- Create: `mate-platform-backend/packages/mate-app-wfe/tests/test_ontology_operations_worker.py`
- Create: `mate-platform-backend/packages/mate-app-wfe/tests/fixtures/ontology-maintenance-history.json`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/tests/test_operations_workflow.py`
- Create: `mate-platform-backend/tests/integration/test_ontology_rollback.py`

**Interfaces:**
- Consumes: publishable DriftProposal, ImpactReport, RegressionReport, independent ApprovalRecord and MVP3 publication service.
- Produces: `OntologyMaintenanceWorkflow`; `publish_change(...) -> OntologyReleaseReceipt`; `rollback_release(plan, approval, lease) -> ExecutionReceipt`.

- [ ] **Step 1: Write approval-binding and partial-failure tests**

```python
async def test_approval_for_old_regression_cannot_publish(workflow):
    approval = approve(proposal_digest=PROPOSAL, regression_digest=OLD)
    with pytest.raises(DigestMismatch):
        await workflow.publish(proposal_with_regression(NEW), approval, lease())

async def test_rollback_restores_authority_alias_and_notification(workflow):
    receipt = await workflow.rollback(failed_release(), rollback_approval(), lease())
    assert receipt.postgres_active_digest == BASE
    assert receipt.jena_current_digest == BASE
    assert receipt.downstream_event_digest is not None
```

- [ ] **Step 2: Run workflow and rollback tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-ops/tests/test_operations_workflow.py mate-platform-backend/tests/integration/test_ontology_rollback.py -q`

Expected: FAIL before workflow implementation.

- [ ] **Step 3: Implement durable approval and compensating rollback**

Replace the Task 3 approval/publish/rollback placeholders. The approval endpoint creates an independent immutable ApprovalRecord bound to DriftProposal, ImpactReport, RegressionReport, active base and policy Digests; request bodies may not supply an ApprovalRecord. Publish and rollback accept only Approval Digest plus idempotency key and return `202` with workflow/release resources. Register `OntologyMaintenanceWorkflow` and its Activities in the existing `mate-app-wfe` composition root, on task queue `ontology-maintenance-v1`; do not start a second composition root. The WFE package declares the one-way ontology-ops workflow dependency, regenerates the root lock, and its existing worker image/Helm Deployment is extended for this queue. History stores only `authorization_grant_ref`, object Digests and non-sensitive state. Each Activity uses the worker service principal to obtain a short token, then rechecks authorizing user, employee assignment, current policy/revocation watermarks, Approval, Lease and active base version; tests cover all five becoming stale while the workflow waits. Publish calls the MVP3 Release Ledger saga and emits a versioned event through Outbox. Rollback is another authorized release transition toward the prior Digest: PostgreSQL remains authority, Jena alias/cache/notification are reconciled projections. It records an ExecutionReceipt only for this approved rollback side effect. Activity calls use the idempotency ledger and the frozen history fixture must replay under the new worker code.

- [ ] **Step 4: Run replay, cancellation, timeout and rollback injection tests**

Run: `pwsh -File scripts/test-ontology-temporal.ps1 run-all`

Expected: the runner starts a real locked Temporal test server, exports the endpoint and `ontology-maintenance-v1` queue, runs `test_operations_workflow.py`, `test_ontology_operations_worker.py`, frozen-history replay and rollback injection, rejects skipped live/replay tests, and tears down in `finally`. Duplicate signals produce one release or rollback.

- [ ] **Step 5: Commit operations workflow**

```bash
git add mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/workflow.py mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/approval_service.py mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/api.py mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/temporal_worker.py mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/worker_main.py mate-platform-backend/packages/mate-app-wfe/pyproject.toml mate-platform-backend/packages/mate-app-wfe/Dockerfile mate-platform-backend/uv.lock infra/helm/charts/ontology-ops/values.yaml infra/helm/charts/ontology-ops/templates/temporal-worker.yaml infra/compose/test-ontology-temporal.yml scripts/test-ontology-temporal.ps1 mate-platform-backend/packages/mate-app-wfe/tests/test_ontology_operations_worker.py mate-platform-backend/packages/mate-app-wfe/tests/fixtures/ontology-maintenance-history.json mate-platform-backend/packages/mate-app-ontology-ops/tests/test_operations_workflow.py mate-platform-backend/tests/integration/test_ontology_rollback.py
git commit -m "feat(ontology): orchestrate governed publish and rollback"
```

### Task 6: 对接受治理 MemoryCore 并验证记忆删除/污染撤销

**Files:**
- Create: `mate-platform-backend/packages/mate-clients/src/mate_clients/memory_core.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/memory_adapter.py`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/tests/test_memory_adapter.py`
- Create: `mate-platform-backend/tests/security/test_memory_scope_isolation.py`
- Create: `infra/compose/test-memory-core-adapter.yml`
- Create: `scripts/test-memory-core-adapter.ps1`

**Interfaces:**
- Consumes: approved Artifact/ExecutionReceipt, authorization context and pinned MemoryCore L0-L3 HTTP API.
- Produces: `submit_candidate(candidate, auth) -> MemoryCandidate`; `promote(candidate_id, approval) -> MemoryRecordRef`; `revoke_by_source(source_digest) -> RevocationResult`.

**Gate status:** Execute this task after the first-release Memory Adapter implementation is selected and knowledge-memory-ontology has PASSED. It is not part of the narrow MVP4 ontology-operation signoff, but skipping it blocks PI-5 Exit and platform-ga.

- [ ] **Step 1: Write isolation, provenance and revocation tests**

```python
async def test_unapproved_candidate_is_not_recalled(adapter):
    candidate = await adapter.submit_candidate(experience(), auth())
    assert await adapter.recall(query="rollback lesson", auth=auth()) == []

async def test_source_revocation_removes_promoted_memory(adapter):
    record = await approved_memory(adapter, source_digest=SOURCE)
    await adapter.revoke_by_source(SOURCE)
    assert record not in await adapter.recall("lesson", auth=auth())
```

- [ ] **Step 2: Run Memory Adapter tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-ops/tests/test_memory_adapter.py mate-platform-backend/tests/security/test_memory_scope_isolation.py -q`

Expected: FAIL before clients/adapters exist.

- [ ] **Step 3: Implement the narrow L0-L3 adapter**

Pin the MemoryCore tag/commit in deployment values. Only a platform adapter service account and reverse proxy/API allowlist may reach its approved L0-L3 endpoints; Kubernetes NetworkPolicy blocks host and other service access. The adapter rejects direct host credentials, derives tenant/user/employee/team scopes from verified auth, writes provenance and retention metadata, and only promotes an approved candidate. Disable or exclude team-control, task, skill, ACL, Wiki, CodeGraph, knowledge and proxy modules. Call the Memory Center service, whose revision-0025 PostgreSQL review/revocation ledger owns retry and audit facts; MVP4 must not create a second ledger or duplicate memory content.

- [ ] **Step 4: Run live single-active, snapshot and restore tests**

Run: `pwsh -File scripts/test-memory-core-adapter.ps1 run-all`

Expected: the exception-safe runner starts the exact Gate-approved single-active MemoryCore/reverse-proxy profile, exports the endpoint only to the child tests, exercises tenant/user/employee/team isolation, conflict, retention expiry, source deletion, crash and snapshot restore, rejects skipped live cases and tears down in `finally`.

- [ ] **Step 5: Commit governed memory operations**

```bash
git add mate-platform-backend/packages/mate-clients/src/mate_clients/memory_core.py mate-platform-backend/packages/mate-app-ontology-ops/src/mate_app_ontology_ops/memory_adapter.py mate-platform-backend/packages/mate-app-ontology-ops/tests/test_memory_adapter.py mate-platform-backend/tests/security/test_memory_scope_isolation.py infra/compose/test-memory-core-adapter.yml scripts/test-memory-core-adapter.ps1
git commit -m "feat(memory): govern ontology operations experience"
```

### Task 7: 交付运维工作台、恢复矩阵与安全退役

**Files:**
- Create: `metaplatform-frontend/apps/web/src/pages/ontology/OntologyOperationsPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/ontology/OntologyOperationsPage.test.tsx`
- Create: `metaplatform-frontend/apps/web/src/api/ontology/operations.ts`
- Modify: `metaplatform-frontend/tests/e2e/ontology-operations.spec.ts`
- Create: `mate-platform-backend/tests/recovery/test_ontology_operations_recovery.py`
- Create: `infra/compose/test-ontology-operations.yml`
- Create: `scripts/test-ontology-operations-recovery.ps1`
- Create: `acceptance/inventory/legacy-runtime-consumers.yaml`
- Create: `acceptance/mvp-04-ontology-operations.md`
- Create: `mate-platform-backend/packages/mate-app-ontology-ops/tests/conformance.py`

**Interfaces:**
- Consumes: Tasks 2-6 APIs, workflow states and Artifact Renderer.
- Produces: drift/impact/regression/approval/release/rollback UI, recovery evidence and exact legacy retirement inventory.

- [ ] **Step 1: Inventory every legacy consumer before any retirement**

`legacy-runtime-consumers.yaml` lists Kafka topics/consumers, MinIO buckets/clients, old MCP/LLM gateway routes, Argo applications, StarRocks/Paimon uses and owning tests. Each entry records current endpoint, replacement endpoint, data watermark, compatibility bridge, rollback command and evidence SHA. An unowned consumer blocks retirement.

- [ ] **Step 2: Write UI and recovery tests**

```tsx
it("does not expose publish when impact is incomplete", () => {
  render(<OntologyOperationsPage proposal={proposal} impact={{ complete: false }} />);
  expect(screen.queryByRole("button", { name: "批准发布" })).not.toBeInTheDocument();
  expect(screen.getByText("影响范围未知，发布已阻断")).toBeVisible();
});
```

`test-ontology-operations-recovery.ps1 run-all` starts the locked IAM, PostgreSQL, Gateway, business services/workers, NATS, Temporal, RAG/Jena/SeaweedFS and web composition, applies migrations, waits for readiness and exports `E2E_GATEWAY_URL`. Trino is enabled only by a declared cross-source profile; if that profile reads Iceberg it must consume a PASSED `storage-catalog-backup` Gate and start the same Polaris plus guarded external-publication ingress and a real external-publisher fixture. Otherwise Trino/Polaris/publisher are absent and their cases are recorded `NOT_IN_RUNTIME`, not required for the base MVP exit. While the selected environment remains alive the runner records baseline Digests/backlog, runs backend recovery tests and Playwright, injects a scoped container pause/network deny/process kill for one dependency, waits for the expected fail-closed state, restores it and verifies reconciliation. Only after every test completes does `finally` tear down its uniquely named projects. The recovery test asserts the architecture fault-domain table for selected components: Run Ledger failure stops progress; RAG/Jena/selected Trino failures expose evidence-unavailable; optional Memory failure does not fabricate recall; NATS/Temporal recover without duplicate publication; SeaweedFS failure blocks object-dependent actions.

- [ ] **Step 3: Implement the operations workbench and redacted telemetry**

Use Ant Design for status/actions, Cytoscape.js for affected graph and shared Artifact Renderer for evidence. OTel defaults to no Prompt/Response bodies, performs field redaction and secret scanning, exports only allowlisted aggregate fields centrally, and correlates Run/event/workflow/release/rollback IDs.

- [ ] **Step 4: Run full business, failure and recovery acceptance**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-ontology-ops/tests mate-platform-backend/tests/recovery/test_ontology_operations_recovery.py -q`

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/conformance/employee_runtime -q --runtime-adapter=mate_app_ontology_ops.tests.conformance`

Run: `pwsh -File scripts/test-ontology-operations-recovery.ps1 run-all`

Run: `pnpm --dir metaplatform-frontend --filter @mate/web typecheck`

Run: `pnpm --dir metaplatform-frontend --filter @mate/web test -- OntologyOperationsPage.test.tsx`

Expected: the Vitest configuration has `passWithNoTests: false` and its missing-filter sentinel fails before the real test is added. All component, backend and in-stack Playwright cases pass for known drift, no-change, duplicate/storm, quality regression, approval timeout, publish, injected partial failure, rollback and recovery; skipped required-live cases fail.

- [ ] **Step 5: Retire only fully migrated legacy entries**

For each inventory entry, prove replacement reads/writes match at the recorded watermark, execute the documented rollback drill, disable the old route without deleting data, observe one release window, and then remove deployment configuration in a separate reviewed commit. Do not bulk-delete Kafka, MinIO, Argo, StarRocks or Paimon assets.

- [ ] **Step 6: Record final business and architecture acceptance**

`acceptance/mvp-04-ontology-operations.md` records Git SHA, gold metrics, dependency versions/Digests, event storm results, RPO/RTO measurements, backup/restore evidence, four-host capability matrix, Disconnected Cell status, license/SBOM results and every legacy component still active.

- [ ] **Step 7: Commit the operations MVP and evidence**

```bash
git add mate-platform-backend/packages/mate-app-ontology-ops/tests/conformance.py metaplatform-frontend/apps/web/src/pages/ontology/OntologyOperationsPage.tsx metaplatform-frontend/apps/web/src/pages/ontology/OntologyOperationsPage.test.tsx metaplatform-frontend/apps/web/src/api/ontology/operations.ts metaplatform-frontend/tests/e2e/ontology-operations.spec.ts mate-platform-backend/tests/recovery/test_ontology_operations_recovery.py infra/compose/test-ontology-operations.yml scripts/test-ontology-operations-recovery.ps1 acceptance/inventory/legacy-runtime-consumers.yaml acceptance/mvp-04-ontology-operations.md
git commit -m "feat(ontology): deliver continuous operations MVP"
```
