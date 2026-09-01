# MVP 01 Order Insight and Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让一名数字员工从真实订单生成可追溯报告和独立 ActionPlan，并在人工确认后以 Lease fencing 和幂等约束执行一次可逆跟进动作。

**Architecture:** 复用现有订单领域仓储和页面，在 `mate-kernel` 固化平台契约，在订单服务内增加租户 Run Ledger、不可变 Artifact 对象链和副作用台账。MVP 首先支持一个稳定 MCP 入口；Supabase、LiteLLM、NATS、MemoryCore、Jena、Trino 等只有业务需要时才接入，生产替换门独立验收。

**Tech Stack:** Python 3.12、Pydantic 2、FastAPI、SQLAlchemy、Alembic、PostgreSQL、MCP、React/Vite、Playwright。

**Spec:** `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md`

## Global Constraints

- `Tenant Employee Runtime` 是 Session、WorkItem、Run 和 Lease 的唯一状态权威。
- 所有状态变更提交 `expected_state_version`；所有副作用提交 `run_id + lease_id + lease_epoch + idempotency_key`。
- `ReportArtifact`、`ActionPlan`、`ApprovalRecord` 和 `ExecutionReceipt` 各自不可变并以 SHA-256 Digest 互相引用。
- 业务对象授权在订单服务端完成；请求体中的 tenant、actor 或 employee 不能成为授权事实。
- MVP1 只执行可逆的 `follow_up_payment`，不执行扣款、取消、退款或外部通知。
- 生产路径不得调用 `create_all()`；schema 只由 Alembic 管理。
- 当前 Keycloak/JWT 保持兼容，Supabase Auth 切换不属于本计划的业务出口条件。

---

## File Structure

- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/employee/contracts.py`: Employee/Session/Run/Lease 的稳定 Pydantic 契约。
- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact/contracts.py`: 四类不可变 Artifact 契约和 Digest 计算。
- `mate-platform-backend/alembic/versions/20260901_0016_employee_runtime_order_artifacts.py`: Run Ledger、Artifact、订单历史表的唯一生产迁移。
- `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/repository.py`: CAS、Lease 和副作用台账。
- `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/artifacts.py`: EvidenceBundle 到权威对象链的映射。
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/employee_runtime.py`: `employee.bootstrap`、`employee.resume`、订单查询和确认元工具。
- `metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.tsx`: JSON/Markdown/HTML 统一查看器。
- `metaplatform-frontend/apps/web/src/pages/superai/OrderReviewPage.tsx`: 订单报告、ActionPlan、确认/拒绝和回执页面。

### Task 1: 固化 Employee Runtime 与不可变 Artifact 契约

**Files:**
- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/employee/__init__.py`
- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/employee/contracts.py`
- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact/__init__.py`
- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact/contracts.py`
- Modify: `mate-platform-backend/packages/mate-kernel/pyproject.toml`
- Modify: `mate-platform-backend/uv.lock`
- Create: `mate-platform-backend/tests/conformance/employee_runtime/test_digest_vectors.py`
- Create: `mate-platform-backend/tests/conformance/employee_runtime/test_runtime_claims.py`
- Create: `mate-platform-backend/tests/conformance/employee_runtime/test_approval_single_use.py`
- Create: `mate-platform-backend/tests/conformance/employee_runtime/test_lease_fencing.py`
- Create: `mate-platform-backend/tests/conformance/employee_runtime/test_error_contract.py`
- Create: `mate-platform-backend/tests/conformance/employee_runtime/vectors/artifact-digests.json`
- Create: `mate-platform-backend/tests/conformance/employee_runtime/vectors/errors.json`
- Test: `mate-platform-backend/packages/mate-kernel/tests/test_employee_runtime_contracts.py`
- Test: `mate-platform-backend/packages/mate-kernel/tests/test_artifact_contracts.py`

**Interfaces:**
- Produces: `RunContext`, `LeaseToken`, `ModelReceipt`, `ArtifactEnvelope`, `ReportArtifact`, `ActionPlan`, `ApprovalRecord`, `ExecutionReceipt` and `content_digest(object_type: str, schema_version: str, model: BaseModel) -> str`.
- Consumes: Pydantic 2 and UTC ISO-8601 timestamps.

- [ ] **Step 1: Write the failing contract tests**

```python
def test_lease_rejects_non_positive_epoch() -> None:
    with pytest.raises(ValidationError):
        LeaseToken(run_id=RUN, lease_id=LEASE, lease_epoch=0)

def test_approval_binds_plan_and_evidence_digests() -> None:
    approval = ApprovalRecord(
        approval_id=APPROVAL,
        action_plan_digest="a" * 64,
        parameters_digest="c" * 64,
        evidence_snapshot_digest="b" * 64,
        policy_version="order-v1",
        approver_subject="user:42",
        expires_at=frozen_clock.now() + timedelta(hours=24),
        allowed_uses=1,
    )
    assert approval.action_plan_digest != approval.evidence_snapshot_digest

def test_object_null_and_omitted_match_but_array_null_differs() -> None:
    assert digest({"note": None, "items": []}) == digest({"items": []})
    assert digest({"items": [None]}) != digest({"items": []})
```

- [ ] **Step 2: Run the tests and verify contract imports fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_employee_runtime_contracts.py mate-platform-backend/packages/mate-kernel/tests/test_artifact_contracts.py -q`

Expected: FAIL with `ModuleNotFoundError: mate_kernel.employee` or missing contract names.

- [ ] **Step 3: Implement the minimum immutable types and canonical digest**

```python
class LeaseToken(BaseModel):
    model_config = ConfigDict(frozen=True)
    run_id: UUID
    lease_id: UUID
    lease_epoch: int = Field(gt=0)

def content_digest(object_type: str, schema_version: str, model: BaseModel) -> str:
    normalized = omit_null_object_fields(
        model.model_dump(mode="json", exclude_none=False, by_alias=True)
    )
    canonical = rfc8785.dumps(normalized)
    domain = f"metaplatform:{object_type}:{schema_version}\0".encode("utf-8")
    return hashlib.sha256(domain + canonical).hexdigest()
```

Define `RunContext` with tenant, human, employee, authorizer, session, work item, run, policy/assignment/ontology versions and state version. `ModelReceipt` contains provider/model/version/policy/call ID/data-residency and input/output Digests. `ArtifactEnvelope` wraps object identity, typed payload reference, Run/ontology context, representations and integrity without embedding mutable approvals or receipts. Define each object with `schema_version="1.0"` and immutable references. Before RFC 8785, recursively delete null/None/undefined object properties, retain null array elements and normalize timestamps to UTC; explicit object null and omitted are therefore equivalent, while array null is not. Golden vectors fix key ordering, Unicode, numeric, UTC time, object null/omitted and array behavior and are consumed by Python here and TypeScript in Task 7. The conformance suite also fixes Runtime Token required claims, Run transitions, one-use Approval behavior, Lease fencing and stable public error codes; every later business package runs this same suite through an adapter fixture rather than copying its assertions.

- [ ] **Step 4: Run kernel tests and type checks**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_employee_runtime_contracts.py mate-platform-backend/packages/mate-kernel/tests/test_artifact_contracts.py mate-platform-backend/tests/conformance/employee_runtime -q`

Expected: PASS.

- [ ] **Step 5: Commit the stable contracts**

```bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/employee mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact mate-platform-backend/packages/mate-kernel/pyproject.toml mate-platform-backend/uv.lock mate-platform-backend/packages/mate-kernel/tests/test_employee_runtime_contracts.py mate-platform-backend/packages/mate-kernel/tests/test_artifact_contracts.py mate-platform-backend/tests/conformance/employee_runtime
git commit -m "feat(kernel): define employee runtime and artifact contracts"
```

### Task 2: 用 Alembic 建立订单、Run Ledger 与 Artifact Schema

**Files:**
- Create: `mate-platform-backend/alembic/versions/20260901_0016_employee_runtime_order_artifacts.py`
- Create: `mate-platform-backend/docker-compose.test-postgres.yml`
- Create: `scripts/test-mvp-postgres.ps1`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control/__init__.py`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control/repository.py`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control/service.py`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control/api.py`
- Create: `mate-platform-backend/packages/mate-platform/tests/test_employee_control_postgres.py`
- Create: `mate-platform-backend/packages/mate-tech-dw/src/mate_tech_dw/employee_control_projection.py`
- Create: `mate-platform-backend/packages/mate-tech-dw/tests/test_employee_control_projection.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/order_review.py`
- Create: `mate-platform-backend/tests/architecture/test_order_review_schema_authority.py`

**Interfaces:**
- Consumes: Task 1 UUID and Digest fields.
- Produces: MetaPlatform 权威 control tables `employee_definitions`, `employee_versions`, `employee_instances`, `employee_assignments`, `legacy_employee_id_map` 及其最小 repository/API；runtime tables `business_sessions`, `work_items`, `employee_runs`, `host_sessions`, `execution_leases`, `checkpoints`, `runtime_commands`; immutable object tables `artifacts`, `action_plans`, `approval_records`, `execution_receipts`; mutable/append-only consumption authority `approval_usage_state`, `approval_consumptions`; `side_effect_ledger`; and existing order-review tables under Alembic ownership. `mate-tech-dw` 只暴露兼容迁移读取投影，不接受员工控制写入。

- [ ] **Step 1: Write the migration authority test**

```python
def test_order_repository_never_creates_production_schema() -> None:
    source = Path(ORDER_REPOSITORY).read_text(encoding="utf-8")
    assert "create_all(" not in source
    assert "20260901_0016_employee_runtime_order_artifacts" in migration_names()
```

- [ ] **Step 2: Run the test and confirm it finds `create_all()`**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_order_review_schema_authority.py -q`

Expected: FAIL because the repository currently invokes `create_all()`.

- [ ] **Step 3: Implement upgrade and downgrade with constraints**

The migration must represent immutable EmployeeVersion and Assignment references, preserve old `dw_employees` IDs in an explicit mapping, and add ownership foreign keys `BusinessSession → WorkItem → EmployeeRun`, `HostSession → BusinessSession`, `ExecutionLease → HostSession + EmployeeRun`, `Checkpoint → EmployeeRun`, and `RuntimeCommand → EmployeeRun`. Create unique constraints on `(tenant_id, run_id)`, `(run_id, lease_epoch)`, `(tenant_id, run_id, idempotency_key)` for RuntimeCommand, `(tenant_id, operation, idempotency_key)`, `(tenant_id, object_type, digest)`, and `(tenant_id, approval_digest, idempotency_key)` for approval consumption. `approval_records` stays immutable; `approval_usage_state` holds the locked count and `approval_consumptions` append facts, both FK to the Approval Digest. Add foreign keys from approval to ActionPlan and receipt/consumption to approval; add RLS policies using `app.tenant_id`; and migrate existing EvidenceBundle rows into compatibility Artifact references. Implement create/publish/instantiate/assign/read operations in `mate_platform.employee_control`; the published EmployeeVersion is immutable, assignment changes increment the assignment watermark, and `dw_employees` can only be imported through the idempotent legacy map. Downgrade must remove only the new objects and leave existing order facts intact.

```python
revision = "0016_employee_runtime_order_artifacts"
down_revision = "0015_merge_migration_heads"
op.create_unique_constraint(
    "uq_artifact_tenant_type_digest", "artifacts", ["tenant_id", "object_type", "digest"]
)
```

- [ ] **Step 4: Remove runtime DDL and validate on a fresh PostgreSQL database**

The compose file pins PostgreSQL 17 by image digest, defines the `meta` user/database, healthcheck and a named volume used only by this test project. It must bind only `127.0.0.1:55432` and must not reference any developer database volume. `test-mvp-postgres.ps1` owns the complete live-suite lifecycle: it creates a unique compose project, starts PostgreSQL, sets `DATABASE_URL`, `EMPLOYEE_CONTROL_POSTGRES_URL` and `ORDER_REVIEW_POSTGRES_URL` in the same process, applies Alembic from the backend directory, runs only the named allowlisted suite, emits JUnit XML, rejects any skipped required-live test, and removes the named project/volume in `finally`. It accepts `schema`, `runtime`, `authorization`, `order`, `ontology-factory`, `events` and `drift` suites; it never points at a developer database.

Run: `pwsh -File scripts/test-mvp-postgres.ps1 -Suite schema`

Expected: upgrade succeeds twice only when the second run is a no-op; `alembic downgrade 0015_merge_migration_heads` followed by `upgrade head` succeeds; Employee Control tests run against PostgreSQL with zero skip. One published version can be instantiated and assigned; a second mutation of that version is rejected; importing the same legacy employee twice produces one map row; DW write attempts are rejected.

Expected: one published version can be instantiated and assigned; a second mutation of that version is rejected; importing the same legacy employee twice produces one map row; DW write attempts are rejected.

Expected: on success or failure only the runner's uniquely named test project and test volume are removed.

- [ ] **Step 5: Commit the schema authority change**

```bash
git add mate-platform-backend/alembic/versions/20260901_0016_employee_runtime_order_artifacts.py mate-platform-backend/docker-compose.test-postgres.yml scripts/test-mvp-postgres.ps1 mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control mate-platform-backend/packages/mate-platform/tests/test_employee_control_postgres.py mate-platform-backend/packages/mate-tech-dw/src/mate_tech_dw/employee_control_projection.py mate-platform-backend/packages/mate-tech-dw/tests/test_employee_control_projection.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/order_review.py mate-platform-backend/tests/architecture/test_order_review_schema_authority.py
git commit -m "feat(order): migrate runtime and artifact schema"
```

### Task 3: 实现 Run Ledger CAS、Lease fencing 与副作用台账

**Files:**
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/__init__.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/repository.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/service.py`
- Test: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_repository_postgres.py`

**Interfaces:**
- Consumes: `RunContext`, `LeaseToken` from Task 1 and tables from Task 2.
- Produces: `create_business_session(...) -> BusinessSession`; `create_work_item(...) -> WorkItem`; `attach_host_session(...) -> tuple[HostSession, ExecutionLease]`; `save_checkpoint(...) -> Checkpoint`; `transition_run(run_id: UUID, expected_state_version: int, command: RunCommand) -> EmployeeRun`; `assert_current_lease(token: LeaseToken) -> None`; `execute_once(key: SideEffectKey, operation: Callable[[], T]) -> T`.

- [ ] **Step 1: Write PostgreSQL concurrency tests**

```python
async def test_only_one_transition_wins(runtime_repo):
    results = await asyncio.gather(
        runtime_repo.transition_run(RUN, 3, approve_command()),
        runtime_repo.transition_run(RUN, 3, reject_command()),
        return_exceptions=True,
    )
    assert sum(isinstance(x, EmployeeRun) for x in results) == 1
    assert sum(isinstance(x, StateVersionConflict) for x in results) == 1
    assert await runtime_repo.command_count(run_id=RUN) == 1

async def test_duplicate_runtime_command_does_not_advance_twice(runtime_repo):
    first = await runtime_repo.transition_run(RUN, 3, approve_command(idempotency_key="approve-1"))
    second = await runtime_repo.transition_run(RUN, first.state_version, approve_command(idempotency_key="approve-1"))
    assert second == first
    assert await runtime_repo.command_count(run_id=RUN) == 1

async def test_old_lease_is_rejected_before_operation(runtime_repo):
    called = False
    async def operation():
        nonlocal called
        called = True
    with pytest.raises(StaleLease):
        await runtime_repo.execute_once(old_key(), operation)
    assert called is False

async def test_new_host_session_atomically_fences_old(runtime_repo):
    first = await runtime_repo.attach_host_session(SESSION, host="codex")
    second = await runtime_repo.attach_host_session(SESSION, host="dsh")
    assert second.lease.lease_epoch == first.lease.lease_epoch + 1
    with pytest.raises(StaleLease):
        await runtime_repo.assert_current_lease(first.lease)
```

- [ ] **Step 2: Run against PostgreSQL and verify failures**

Run: `pwsh -File scripts/test-mvp-postgres.ps1 -Suite runtime`

Expected: FAIL because repository methods do not exist.

- [ ] **Step 3: Implement transaction-scoped CAS and fencing**

Use `UPDATE employee_runs SET state=:next, state_version=state_version+1 WHERE run_id=:run_id AND state_version=:expected RETURNING ...`. The CAS winner appends exactly one RuntimeCommand with its unique idempotency key in that same transaction; CAS failure/rollback leaves no command, and a duplicate key returns the prior transition without advancing. Create/resume HostSession and increment Lease epoch under a BusinessSession advisory/row lock. Persist checkpoints by Run and state version. In `execute_once`, lock the current lease and approval usage state, compare epoch/usage, insert the operation-scoped side-effect key, and persist the result/receipt in the same transaction where the operation is database-local.

```sql
UPDATE employee_runs
SET state = :next_state, state_version = state_version + 1
WHERE tenant_id = :tenant_id AND run_id = :run_id AND state_version = :expected
RETURNING *;
```

External Providers must accept the same idempotency key or provide a status lookup. A timeout after dispatch sets the ledger to `INDETERMINATE`; reconciliation resolves it to `SUCCEEDED` or `FAILED`, and automatic retry is prohibited while indeterminate.

- [ ] **Step 4: Run concurrency and existing order tests**

Run: `pwsh -File scripts/test-mvp-postgres.ps1 -Suite runtime`

Expected: PASS with PostgreSQL concurrency tests executed and zero skipped required-live tests; cleanup occurs in `finally` even when pytest fails.

- [ ] **Step 5: Commit the runtime authority**

```bash
git add mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_repository_postgres.py
git commit -m "feat(runtime): add run ledger and lease fencing"
```

### Task 4: 落实订单双主体授权和策略水位

**Files:**
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/authz/employee.py`
- Create: `mate-platform-backend/packages/mate-clients/src/mate_clients/openfga.py`
- Create: `mate-platform-backend/packages/mate-clients/src/mate_clients/opa.py`
- Create: `mate-platform-backend/services/auth-service/src/mate_auth_service/runtime_token.py`
- Modify: `mate-platform-backend/services/auth-service/src/mate_auth_service/main.py`
- Create: `infra/helm/charts/openfga/Chart.yaml`
- Create: `infra/helm/charts/openfga/Chart.lock`
- Create: `infra/helm/charts/openfga/values.yaml`
- Create: `infra/helm/charts/openfga/templates/runtime-values.yaml`
- Create: `infra/helm/charts/opa/Chart.yaml`
- Create: `infra/helm/charts/opa/Chart.lock`
- Create: `infra/helm/charts/opa/values.yaml`
- Create: `infra/helm/charts/opa/templates/runtime-values.yaml`
- Create: `infra/policy/openfga/order-model.fga`
- Create: `infra/policy/openfga/order-tuples.yaml`
- Create: `infra/policy/opa/order/action.rego`
- Create: `infra/policy/opa/order/action_test.rego`
- Create: `infra/policy/opa/bundle-manifest.json`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/order_review.py`
- Test: `mate-platform-backend/packages/mate-platform/tests/test_employee_authorization.py`
- Test: `mate-platform-backend/tests/security/test_order_policy_matrix.py`
- Test: `mate-platform-backend/tests/security/test_runtime_token_claims.py`
- Test: `mate-platform-backend/tests/security/test_order_rls_pooling.py`

**Interfaces:**
- Consumes: current verified Keycloak human login, WorkItem/Run/Lease from Tasks 1-3, OpenFGA relationship checks, OPA context policy, PostgreSQL RLS, and the already completed/committed Production Convergence Task 1 toolchain/evidence infrastructure (`scripts/run-plan-tool.ps1` plus `acceptance/toolchain.lock.yaml`). It does not require any component production Gate to be PASSED.
- Produces: `authorize_employee_action(auth: EmployeeAuthContext, resource: ResourceRef, action: str, risk: RiskContext) -> AuthorizationDecision` with decision ID, policy/assignment/revocation watermarks and deny reasons.

- [ ] **Step 1: Write intersection and stale-watermark tests**

```python
async def test_employee_cannot_borrow_authorizer_scope(authorizer):
    decision = await authorizer.check(
        auth=auth(human={"order:write"}, employee={"order:read"}),
        resource=order("o-1"), action="follow_up_payment", risk=risk("R2"),
    )
    assert decision.allowed is False
    assert decision.reason == "EMPLOYEE_SCOPE_MISSING"

async def test_r2_fails_closed_when_revocation_watermark_is_stale(authorizer):
    decision = await authorizer.check(auth=auth(revocation_watermark=7), resource=order("o-1"), action="follow_up_payment", risk=risk("R2", required_watermark=8))
    assert decision.allowed is False
    assert decision.reason == "REVOCATION_WATERMARK_STALE"

def test_current_keycloak_path_issues_full_runtime_claim_contract(runtime_token):
    claims = verify(runtime_token)
    assert required_runtime_claims() <= claims.keys()
    assert claims["aud"] == "order-mcp"
```

- [ ] **Step 2: Run authorization tests and verify clients/policy are absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_employee_authorization.py mate-platform-backend/tests/security/test_order_policy_matrix.py mate-platform-backend/tests/security/test_runtime_token_claims.py -q`

Expected: FAIL with missing authorization module and clients.

- [ ] **Step 3: Implement the minimum order authorization model**

The current Keycloak compatibility path first verifies the human login token, then issues a short audience-limited Runtime Token containing every Architecture §7.1 claim; Supabase is not required for this contract. Derive human, employee, authorizer, tenant, WorkItem, Run, Lease, policy and assignment only from that verified token context. OpenFGA decides stable relations from the versioned order model and tenant-owned tuples; the signed OPA bundle calculates server-owned risk and context policy; RLS protects the final row. Each transaction executes `SET LOCAL app.tenant_id` and subject settings before queries; pooled-connection tests prove the next borrower cannot inherit them. Every order inspect/propose/confirm/reject route calls `authorize_employee_action` before repository access, and confirm/reject recheck immediately before side effects. The service returns one decision record and never retries an explicit deny. Cache only signed policies within their watermarks and TTL; R1-R4 fail closed after expiry.

```python
runtime_claims = build_runtime_claims(
    verified_human=human_claims,
    run=run_context,
    audience="order-mcp",
    ttl=timedelta(minutes=5),
)
```

- [ ] **Step 4: Wire the runtime-token route, deploy pinned OpenFGA/OPA charts and run the full policy matrix**

Register the Runtime Token route in auth-service `main.py`. Pin upstream chart versions and image Digests in `Chart.yaml`/`values.yaml`, generate and commit `Chart.lock`, and render the platform-owned policy/config templates. Run Helm and OPA from the repository CI tool image recorded in `acceptance/toolchain.lock.yaml`; the local workstation is not assumed to have either binary.

Run: `pwsh -File scripts/run-plan-tool.ps1 -- helm lint infra/helm/charts/openfga`

Run: `pwsh -File scripts/run-plan-tool.ps1 -- helm lint infra/helm/charts/opa`

Run: `pwsh -File scripts/run-plan-tool.ps1 -- opa test infra/policy/opa/order -v`

Run: `pwsh -File scripts/test-mvp-postgres.ps1 -Suite authorization`

Expected: PASS for employee/human intersection, tenant isolation, assignment revocation, policy rollback, expired approval, stale Lease and R4 deny; RLS pool-reuse cases execute against live PostgreSQL with zero skipped required-live tests and cleanup in `finally`.

- [ ] **Step 5: Commit the authorization gate**

```bash
git add mate-platform-backend/packages/mate-platform/src/mate_platform/authz/employee.py mate-platform-backend/packages/mate-clients/src/mate_clients/openfga.py mate-platform-backend/packages/mate-clients/src/mate_clients/opa.py mate-platform-backend/services/auth-service/src/mate_auth_service/runtime_token.py mate-platform-backend/services/auth-service/src/mate_auth_service/main.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/order_review.py infra/helm/charts/openfga infra/helm/charts/opa infra/policy/openfga/order-model.fga infra/policy/openfga/order-tuples.yaml infra/policy/opa mate-platform-backend/packages/mate-platform/tests/test_employee_authorization.py mate-platform-backend/tests/security/test_order_policy_matrix.py mate-platform-backend/tests/security/test_runtime_token_claims.py mate-platform-backend/tests/security/test_order_rls_pooling.py
git commit -m "feat(authz): enforce dual-principal order policy"
```

### Task 5: 把订单证据、计划、审批和回执拆成不可变对象链

**Files:**
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/artifacts.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/source.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/source_config.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/schemas.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/order_review.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/order_review.py`
- Test: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review_artifact_chain.py`
- Test: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_source_adapter.py`

**Interfaces:**
- Consumes: Task 1 Artifact contracts and Task 3 runtime service.
- Produces: `OrderSource.load_order(tenant_id, order_id) -> OrderSnapshot`; `build_order_report(snapshot, evidence, run_context) -> ReportArtifact`; `propose_follow_up(report_digest, order_version) -> ActionPlan`; `approve_action(plan_digest, evidence_digest, approver) -> ApprovalRecord`; `execute_approved_action(...) -> ExecutionReceipt`.

- [ ] **Step 1: Write a TOCTOU regression test**

```python
def test_approval_cannot_execute_modified_plan(order_service):
    approval = order_service.approve(original_plan())
    changed = original_plan().model_copy(update={"parameters": {"days": 14}})
    with pytest.raises(DigestMismatch):
        order_service.execute(changed, approval, current_lease())

async def test_single_use_approval_has_one_concurrent_winner(order_service):
    results = await asyncio.gather(
        order_service.execute(plan(), approval(), lease(), idempotency_key="a"),
        order_service.execute(plan(), approval(), lease(), idempotency_key="b"),
        return_exceptions=True,
    )
    assert sum(isinstance(x, ExecutionReceipt) for x in results) == 1
    assert sum(isinstance(x, ApprovalAlreadyConsumed) for x in results) == 1
```

- [ ] **Step 2: Run the focused test and confirm execution still accepts mutable proposal state**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review_artifact_chain.py -q`

Expected: FAIL before the immutable chain is implemented.

- [ ] **Step 3: Implement the chain and preserve EvidenceBundle compatibility**

Implement a configured `PostgresOrderSource`/business API adapter that reads the real acceptance datasource and returns source watermark plus row version; the test-only order creation endpoint is not an acceptance source. Map historical `EvidenceBundle` to `ReportArtifact.legacy_evidence_ref`; generate the initial `follow_up_payment` from an explicit versioned rule `overdue-payment-v1`, not from the UI. Bind approval to plan/evidence/policy Digests. ApprovalRecord is never updated. Execute only through Task 3 `execute_once`; in that transaction lock `approval_usage_state`, validate its count against the immutable ApprovalRecord `allowed_uses`, append one unique `approval_consumption`, increment usage and persist a receipt containing order before/after versions and follow-up case ID.

```python
approval = await tx.approvals.get_immutable(approval_digest)
usage = await tx.approval_usage.lock(approval.digest)
usage.assert_available(approval=approval, plan_digest=content_digest("ActionPlan", "1.0", plan), clock=clock)
await tx.approval_consumptions.append_once(approval.digest, key.idempotency_key)
receipt = await tx.side_effects.execute_once(operation="order.follow_up", key=key, call=call)
await tx.approval_usage.increment(approval.digest)
await tx.receipts.insert(receipt)
```

- [ ] **Step 4: Run API, repository and artifact tests**

Run: `pwsh -File scripts/test-mvp-postgres.ps1 -Suite order`

Expected: PASS with zero skipped required-live tests; historical EvidenceBundle reads still work, modified plans fail, and cleanup occurs in `finally`.

- [ ] **Step 5: Commit the immutable order chain**

```bash
git add mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/artifacts.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/source.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/source_config.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/schemas.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/order_review.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/order_review.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review_artifact_chain.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_source_adapter.py
git commit -m "feat(order): bind approval to immutable action plan"
```

### Task 6: 暴露稳定的数字员工 MCP 元工具和订单工具

**Files:**
- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/employee_runtime.py`
- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/order_insight.py`
- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/resources/artifact.py`
- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/artifact_routes.py`
- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/auth_context.py`
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/main.py`
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/server.py`
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/origin_routes.py`
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/protocol/streamable.py`
- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/auth/verifier.py`
- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/auth/middleware.py`
- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/tenancy/context.py`
- Modify: `mate-platform-backend/contracts/openapi/services/orchestrator.yaml`
- Test: `mate-platform-backend/packages/mate-platform/tests/test_runtime_request_context.py`
- Test: `mate-platform-backend/packages/mate-tech-mcp/tests/test_employee_runtime_tools.py`
- Test: `mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_auth_context.py`
- Test: `mate-platform-backend/packages/mate-tech-mcp/tests/test_resource_auth_context.py`
- Test: `mate-platform-backend/contracts/tests/test_order_runtime_contract.py`

**Interfaces:**
- Consumes: runtime, authorization and order APIs from Tasks 3-5 plus verified JWT claims.
- Produces: `BootstrapCallContext`, `RuntimeToolCallContext`, `MCPServer.call_tool(name, arguments, context: BootstrapCallContext | RuntimeToolCallContext)` and MCP tools `employee.bootstrap`, `employee.resume`, `order.inspect`, `order.propose_follow_up`, `order.confirm_action`; each returns `structuredContent` and an Artifact resource link.

- [ ] **Step 1: Write a confused-deputy test**

```python
async def test_request_body_cannot_replace_employee_claim(mcp_client):
    response = await mcp_client.call_tool(
        "order.confirm_action",
        {
            "employee_principal": "employee:admin",
            "action_plan_digest": PLAN,
            "run_id": str(RUN), "lease_id": str(LEASE), "lease_epoch": 4,
            "idempotency_key": "confirm-001",
        },
        token=token_for("employee:collector"),
    )
    assert response.error.code == "AUTH_CONTEXT_MISMATCH"

async def test_bootstrap_uses_human_context_before_runtime_token(mcp_client):
    result = await mcp_client.call_tool(
        "employee.bootstrap",
        {"requested_employee_id": "collector", "objective": "review overdue order"},
        token=human_login_token(tenant="tenant-a"),
    )
    assert result.structuredContent["run_id"]
    assert result.structuredContent["bootstrap_id"]
    assert "runtime_token" not in result.structuredContent
    assert "runtime_token_exchange_ref" not in result.structuredContent

async def test_bootstrap_context_cannot_call_runtime_tool(mcp_client):
    response = await mcp_client.call_tool("employee.resume", {}, token=human_login_token(tenant="tenant-a"))
    assert response.error.code == "RUNTIME_CONTEXT_REQUIRED"

async def test_bootstrap_exchange_is_one_use_host_and_audience_bound(connector):
    bootstrap = await connector.bootstrap(human_session(), host_proof("codex-1"))
    token = await connector.exchange(bootstrap.id, pkce(), dpop("codex-1"), audience="order-mcp")
    assert token.run_id == bootstrap.run_id
    assert (await connector.exchange(bootstrap.id, pkce(), dpop("codex-1"), audience="order-mcp")).error_code == "BOOTSTRAP_GRANT_REPLAY"
    assert (await connector.exchange(bootstrap.id, pkce(), dpop("dsh-2"), audience="order-mcp")).error_code == "BOOTSTRAP_HOST_MISMATCH"

async def test_two_tenants_never_share_streamable_context(streamable_client):
    left = await streamable_client(token=token_for("tenant-a", "employee:collector")).call_tool("employee.resume", {})
    right = await streamable_client(token=token_for("tenant-b", "employee:collector")).call_tool("employee.resume", {})
    assert left.structuredContent["tenant_id"] == "tenant-a"
    assert right.structuredContent["tenant_id"] == "tenant-b"
```

- [ ] **Step 2: Run MCP and contract tests and verify the tools are absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_runtime_request_context.py mate-platform-backend/packages/mate-tech-mcp/tests/test_employee_runtime_tools.py mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_auth_context.py mate-platform-backend/packages/mate-tech-mcp/tests/test_resource_auth_context.py mate-platform-backend/contracts/tests/test_order_runtime_contract.py -q`

Expected: FAIL with missing tool/contract.

- [ ] **Step 3: Implement thin tools without duplicating business rules**

Extend `VerifiedClaims` and `RequestContext` so verified human-login claims and the runtime claims `human_subject`, `employee_principal`, `authorizing_principal`, `business_session_id`, `work_item_id`, `run_id`, `lease_id`, `lease_epoch`, `policy_version`, `assignment_version` and `revocation_watermark` are retained without inventing missing values. `AuthMiddleware` validates the presented token and stores the typed result only in `request.state.ctx`; handlers do not depend on a second, nonexistent raw-claims state object. `BootstrapCallContext.from_request_context(...)` accepts only the verified human-login stage and cannot carry Run/Lease authority; `RuntimeToolCallContext.from_request_context(...)` requires every runtime claim for protected tools. Neither can be constructed from request arguments. `employee.bootstrap` validates requested employee/objective and Connector host proof server-side, creates BusinessSession/WorkItem/Run/Lease, and returns only a non-sensitive `bootstrap_id` plus projection Digests in model-visible output. The one-use exchange grant stays server-side, has `jti`/short TTL, and is bound to tenant/human/employee/Run/Lease/host/audience. The Connector exchanges it over a model-invisible control channel while presenting the original human session, PKCE and DPoP or mTLS; only the resulting Runtime Token can call `employee.resume` and order tools. Tests scan tool output/logs for grant/token leakage and cover replay, expiry, wrong host and wrong audience.

Register both tool builders and the Artifact resource in `main.py`. Change REST origin routes and streamable HTTP transport to pass the verified request context into `MCPServer.call_tool` and `read_resource`; dispatch validates that `employee.bootstrap` received `BootstrapCallContext` and every other employee/order tool or Artifact Resource received `RuntimeToolCallContext`. Remove fixed/default tenant and client-declared `__caller__` as authorization facts. Wrap the mounted Streamable HTTP ASGI application with an authentication-context middleware that derives the appropriate context from `scope["state"]["ctx"]`, sets a request-scoped `ContextVar`, and always resets its token in `finally`; the FastMCP tool/resource adapters must resolve that mandatory context for every call without changing the SDK's `(name, arguments)` override signature. Dynamic registry, federation and Artifact resource reads use the same tenant-bound runtime context. Tests run concurrent requests for two tenants, force one handler exception, then call without credentials and prove there is no ContextVar leakage; missing scope state returns `AUTH_CONTEXT_REQUIRED`. Stdio has no human request identity, so protected employee tools are disabled there unless the transport is configured with an explicit service-principal credential; it must never fall back to a default tenant. Parse tenant, human/employee/authorizer, Run and policy only from the correct verified context, then forward commands to the orchestrator API. Return JSON `structuredContent`, a short Markdown summary and `artifact://{tenant}/{object_type}/{digest}` resource link; the HTTPS route reauthorizes the caller and emits a short-lived audience-limited signed object URL. Use one stable MCP server configuration for the first supported host rather than installing one plugin per employee.

```python
context = context_for_tool(name, request.state.ctx)
result = await request.app.state.mcp_server.call_tool(name, body.arguments, context=context)
```

- [ ] **Step 4: Run MCP, OpenAPI and gateway compatibility tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_runtime_request_context.py mate-platform-backend/packages/mate-tech-mcp/tests/test_employee_runtime_tools.py mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_auth_context.py mate-platform-backend/packages/mate-tech-mcp/tests/test_resource_auth_context.py mate-platform-backend/contracts/tests/test_order_runtime_contract.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: PASS; an unauthorized employee and stale Lease both fail before the order mutation.

- [ ] **Step 5: Commit the first host-facing surface**

```bash
git add mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/employee_runtime.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/order_insight.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/resources/artifact.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/artifact_routes.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/auth_context.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/main.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/server.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/origin_routes.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/protocol/streamable.py mate-platform-backend/packages/mate-platform/src/mate_platform/auth/verifier.py mate-platform-backend/packages/mate-platform/src/mate_platform/auth/middleware.py mate-platform-backend/packages/mate-platform/src/mate_platform/tenancy/context.py mate-platform-backend/contracts/openapi/services/orchestrator.yaml mate-platform-backend/packages/mate-platform/tests/test_runtime_request_context.py mate-platform-backend/packages/mate-tech-mcp/tests/test_employee_runtime_tools.py mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_auth_context.py mate-platform-backend/packages/mate-tech-mcp/tests/test_resource_auth_context.py mate-platform-backend/contracts/tests/test_order_runtime_contract.py
git commit -m "feat(mcp): expose order employee runtime tools"
```

### Task 7: 交付 Artifact 查看、人工确认和真实订单 E2E

**Files:**
- Create: `metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.tsx`
- Create: `metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.test.tsx`
- Modify: `metaplatform-frontend/packages/shared/src/index.ts`
- Modify: `metaplatform-frontend/packages/shared/package.json`
- Create: `metaplatform-frontend/packages/shared/vitest.config.ts`
- Create: `metaplatform-frontend/packages/shared/test/setup.ts`
- Modify: `metaplatform-frontend/pnpm-lock.yaml`
- Modify: `metaplatform-frontend/apps/web/package.json`
- Modify: `metaplatform-frontend/apps/web/src/pages/superai/OrderReviewPage.tsx`
- Modify: `metaplatform-frontend/apps/web/src/pages/superai/components/OrderReviewEvidence.tsx`
- Modify: `metaplatform-frontend/apps/web/src/api/superai/orderReview.ts`
- Modify: `metaplatform-frontend/tests/e2e/order-review.spec.ts`
- Create: `infra/compose/e2e-mvp1-order.yml`
- Create: `scripts/test-mvp1-e2e.ps1`
- Create: `acceptance/e2e/mvp1-environment.lock.yaml`
- Create: `acceptance/mvp-01-order-insight-action.md`

**Interfaces:**
- Consumes: Task 5 object chain and Task 6 API/MCP contract.
- Produces: report/evidence/plan/approval/receipt UI and a real-source acceptance record.

- [ ] **Step 1: Establish a non-vacuous shared-package test runner**

Add the `test` script, Vitest/jsdom/Testing Library configuration and lockfile dependencies before the feature test. Configure `passWithNoTests: false`; prove the runner is active by running a deliberately missing filter and checking for a non-zero result, then add the real test file.

Run: `pnpm --dir metaplatform-frontend --filter @mate/shared run test -- __runner_must_not_match__.test.tsx`

Expected: FAIL because no test matches; an exit code 0 is a gate failure.

- [ ] **Step 2: Add component tests for immutable links and disabled confirmation**

```tsx
it("disables confirmation when plan and approval digests differ", () => {
  render(<ArtifactEnvelopeRenderer report={report} plan={changedPlan} approval={approval} />);
  expect(screen.getByRole("button", { name: "确认执行" })).toBeDisabled();
  expect(screen.getByText("计划已变化，需要重新审批")).toBeVisible();
});
```

- [ ] **Step 3: Run the frontend test and verify the renderer is missing**

Run: `pnpm --dir metaplatform-frontend --filter @mate/shared run test -- ArtifactEnvelopeRenderer.test.tsx`

Expected: FAIL because the renderer does not exist.

- [ ] **Step 4: Implement the renderer and remove the UI-fixed recommendation**

Add explicit `test` script and Vitest/jsdom/Testing Library setup to `@mate/shared`; add `antd`, `json-canonicalize` and required test dependencies through pnpm so the lockfile records them. Export the renderer from `src/index.ts`. Render JSON authority with Markdown/HTML representations, evidence sources, rule/model receipt, ActionPlan parameters, approval expiry and execution receipt. Verify the TypeScript RFC 8785 implementation against Task 1 vectors. The page obtains the recommendation from the API; it must not construct `follow_up_payment` locally. Migrate only touched controls to Ant Design and reuse existing graph/evidence components until their planned replacement.

```tsx
const bytes = concatBytes(
  new TextEncoder().encode(`metaplatform:${objectType}:${schemaVersion}\0`),
  new TextEncoder().encode(canonicalize(omitNullObjectFields(payload))),
);
const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
if (digest !== envelope.integrity.digest) return <Alert type="error" message="Artifact Digest 校验失败" />;
```

- [ ] **Step 5: Run typecheck, component tests and real-source E2E**

Run: `pnpm --dir metaplatform-frontend --filter @mate/shared run test -- ArtifactEnvelopeRenderer.test.tsx`

Run: `pnpm --dir metaplatform-frontend --filter @mate/web typecheck`

Run: `pwsh -File scripts/test-mvp1-e2e.ps1 run-all`

Expected: `mvp1-environment.lock.yaml` fixes every image by `image@sha256`, including the current Keycloak-compatible IAM path, PostgreSQL, API Gateway, auth, orchestrator/MCP, OpenFGA/OPA and web; the runner rejects a tag-only/mismatched image or unrecorded binary version. It starts those processes under one uniquely named E2E environment, applies migrations, waits for component health, issues a real Runtime Token, exports `E2E_GATEWAY_URL`, and runs Playwright before teardown in `finally`. It requires a configured acceptance order source ID and expected source watermark from a read-only seeded/acceptance adapter, rejects the test-create endpoint or mock/in-memory source, confirms once, retries the same idempotency key and observes one follow-up case. A skipped scenario or unexpected source watermark fails.

- [ ] **Step 6: Record business and architecture evidence separately**

In `acceptance/mvp-01-order-insight-action.md`, record Git SHA, datasource identifier and watermark, executed commands, test counts, skipped tests, policy/ontology/rule versions, business approver, failure injections and production gates still closed. Do not mark a skipped PostgreSQL concurrency test as passed.

- [ ] **Step 7: Commit the MVP1 vertical slice**

```bash
git add metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.tsx metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.test.tsx metaplatform-frontend/packages/shared/src/index.ts metaplatform-frontend/packages/shared/package.json metaplatform-frontend/packages/shared/vitest.config.ts metaplatform-frontend/packages/shared/test/setup.ts metaplatform-frontend/apps/web/package.json metaplatform-frontend/pnpm-lock.yaml metaplatform-frontend/apps/web/src/pages/superai/OrderReviewPage.tsx metaplatform-frontend/apps/web/src/pages/superai/components/OrderReviewEvidence.tsx metaplatform-frontend/apps/web/src/api/superai/orderReview.ts metaplatform-frontend/tests/e2e/order-review.spec.ts infra/compose/e2e-mvp1-order.yml scripts/test-mvp1-e2e.ps1 acceptance/e2e/mvp1-environment.lock.yaml acceptance/mvp-01-order-insight-action.md
git commit -m "feat(order): deliver auditable insight and action MVP"
```

### Task 8: 建立 MVP1 生产准入与第二宿主架构门

**Files:**
- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/employee/package.py`
- Create: `mate-platform-backend/packages/mate-clients/src/mate_clients/host_connector.py`
- Modify: `mate-platform-backend/packages/mate-clients/src/mate_clients/marketplace/oci.py`
- Create: `mate-platform-backend/packages/mate-clients/src/mate_clients/marketplace/cosign.py`
- Create: `mate-platform-backend/contracts/jsonschema/employee-package-v1.schema.json`
- Create: `infra/packages/order-collector/employee.yaml`
- Create: `infra/packages/order-collector/capabilities.yaml`
- Create: `scripts/package-employee.ps1`
- Create: `scripts/publish-employee-package.ps1`
- Create: `mate-platform-backend/tests/security/test_employee_package_policy.py`
- Create: `mate-platform-backend/tests/supply_chain/test_employee_package_signature.py`
- Create: `mate-platform-backend/tests/compatibility/host_capabilities.yaml`
- Create: `mate-platform-backend/tests/compatibility/adapters/codex_mcp.py`
- Create: `mate-platform-backend/tests/compatibility/adapters/deepseek_harness_mcp.py`
- Create: `mate-platform-backend/tests/compatibility/run-host-handoff.ps1`
- Create: `mate-platform-backend/tests/compatibility/test_host_handoff.py`
- Create: `mate-platform-backend/tests/security/test_order_authorization_matrix.py`
- Create: `acceptance/gates/mvp-01-production-gates.md`

**Interfaces:**
- Consumes: stable MCP tools and Run/Lease/authorization contracts from Tasks 3-6.
- Produces: declarative package load, host capability evidence and production gate record; it consumes the Task 2 EmployeeDefinition/Version/Instance/Assignment authority and creates no second business runtime or control authority.

- [ ] **Step 1: Encode the first and second host capability contract**

The two acceptance hosts are the installed Codex desktop build and the vendored DeepSeek Harness commit in this workspace. Their adapters only drive documented MCP configuration/session surfaces; they do not patch either host. `run-host-handoff.ps1` captures the exact Codex build identifier, DSH Git commit, configuration Digest and server capability negotiation before the scenario. If either host cannot be driven by a documented noninteractive test surface, mark that host `NOT_EXERCISED` and keep the cross-host production gate closed rather than simulating it.

For each tested host version, record `skills`, `mcp`, `tool_refresh`, `oauth_or_headers`, `structured_content`, `artifact_link`, `mcp_apps`, `resume`, and `known_limitations`. A capability is `verified`, `unsupported`, or `not_exercised`; absence is not treated as support.

Read immutable EmployeeVersion and tenant Instance/Assignment from the Task 2 control API. Define EmployeePackage v1 as declarative metadata, prompts, JSON Schemas, templates and static assets only. The validator rejects install hooks, executable entries, floating dependencies and undeclared file/network/process capabilities. Package the order collector with ORAS through the existing OCI client, verify Cosign trust policy and fixed Digest before the reference Host Connector loads it. Executable SkillPackage status is `NOT_SUPPORTED` until an open-source sandbox passes file/network/process, credential and egress tests; a permission manifest alone cannot enable execution.

Extend `OCIPuller` with a separate ORAS push path that returns the registry Digest; `CosignVerifier` verifies signature, certificate identity/issuer or offline public-key trust root, Rekor bundle when online, and the tenant revocation list before load. The acceptance registry uses an explicit immutable repository path and rejects tag-only references.

- [ ] **Step 2: Write package-policy and handoff/fencing tests**

```python
def test_second_host_fences_first_host(host_a, host_b):
    run = host_a.bootstrap_employee("order-collector")
    newer = host_b.resume(run.business_session_id, run.work_item_id)
    assert newer.lease_epoch == run.lease_epoch + 1
    assert host_a.confirm(run.action_plan_digest).error_code == "STALE_LEASE"

def test_employee_package_rejects_install_hook():
    with pytest.raises(PackagePolicyViolation, match="INSTALL_HOOK_FORBIDDEN"):
        validate_employee_package(package_with("post_install", "curl example"))

async def test_connector_rejects_unsigned_or_revoked_digest(connector):
    with pytest.raises(PackageTrustError):
        await connector.bootstrap(employee_package=revoked_unsigned_package())
```

- [ ] **Step 3: Run against the two explicitly recorded host versions**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/security/test_employee_package_policy.py mate-platform-backend/tests/supply_chain/test_employee_package_signature.py mate-platform-backend/tests/security/test_order_authorization_matrix.py -q`

Run: `pwsh -File mate-platform-backend/tests/compatibility/run-host-handoff.ps1`

Expected: PASS only when both live host adapters are configured; otherwise the acceptance record remains `NOT_EXERCISED` and production cross-host status stays closed.

- [ ] **Step 4: Record target-component gates without forcing them into MVP1**

Document whether Supabase→Keycloak, OpenFGA/OPA, LiteLLM, MemoryCore, NATS, Jena, Trino and SeaweedFS were required by the deployed order slice. For each required component, attach version, image Digest, SBOM, backup/restore and failure-injection evidence. Components not used are marked `NOT_EXERCISED` with reason `NOT_IN_RUNTIME`, not “passed”.

- [ ] **Step 5: Commit the production gate evidence**

```bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/employee/package.py mate-platform-backend/packages/mate-clients/src/mate_clients/host_connector.py mate-platform-backend/packages/mate-clients/src/mate_clients/marketplace/oci.py mate-platform-backend/packages/mate-clients/src/mate_clients/marketplace/cosign.py mate-platform-backend/contracts/jsonschema/employee-package-v1.schema.json infra/packages/order-collector scripts/package-employee.ps1 scripts/publish-employee-package.ps1 mate-platform-backend/tests/security/test_employee_package_policy.py mate-platform-backend/tests/supply_chain/test_employee_package_signature.py mate-platform-backend/tests/compatibility/host_capabilities.yaml mate-platform-backend/tests/compatibility/adapters mate-platform-backend/tests/compatibility/run-host-handoff.ps1 mate-platform-backend/tests/compatibility/test_host_handoff.py mate-platform-backend/tests/security/test_order_authorization_matrix.py acceptance/gates/mvp-01-production-gates.md
git commit -m "test(order): add host handoff and production gates"
```
