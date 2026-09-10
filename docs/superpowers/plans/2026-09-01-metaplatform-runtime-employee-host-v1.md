# MetaPlatform Runtime, Employee and Host V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the tenant-safe Employee Runtime, governed digital-employee lifecycle, stable Host Connector and four independently verified host adapters so a task can continue across Codex, Claude Code, DeepSeek Harness and Hermes without moving state authority to a host.

**Architecture:** The Runtime owns `BusinessSession`, `WorkItem`, `EmployeeRun`, `SubRun`, `HostSession`, `ExecutionLease`, checkpoints and state-transition commands through PostgreSQL CAS plus lease fencing. The employee control plane owns immutable employee/version/package/policy/assignment facts and ephemeral assembly receipts; the Host Connector only obtains scoped projections and invokes governed Runtime/MCP contracts. Hosts display their native conversation/SubAgent interactions but never own platform Run state, authorization, employee identity, approvals or business side effects.

**Tech Stack:** Python 3.12, FastAPI, Pydantic 2, SQLAlchemy, PostgreSQL 16, Alembic, RFC 8785 JSON canonicalization, CloudEvents 1.0, MCP Streamable HTTP, A2A, OpenFGA, OPA, Supabase Auth, Keycloak, React 18, Vite, TypeScript, Vitest, Playwright, Docker/Compose, PowerShell, OpenTelemetry.

**Spec:** `docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md`; `docs/superpowers/specs/2026-09-01-metaplatform-agile-delivery-operating-model.md`; `docs/superpowers/plans/2026-09-01-mvp-01-order-insight-action.md`; `docs/superpowers/plans/2026-09-01-metaplatform-first-release-closure.md`; `docs/superpowers/plans/2026-09-01-metaplatform-agile-program-delivery.md`.

## Global Constraints

- Employee Runtime is the sole product authority for Session, WorkItem, Run, SubRun, HostSession, Lease, checkpoint, command and `CapabilityAvailabilityProjection`; a host, LangGraph, A2A peer or Temporal workflow is never a second Run authority.
- MVP1 is the primary implementation and migration owner for `employee_definitions`, `employee_versions`, `employee_instances`, `employee_assignments`, `business_sessions`, `work_items`, `employee_runs`, `host_sessions`, `execution_leases`, `checkpoints` and `runtime_commands`. This product plan consumes and extends those contracts; revision 0022 must not recreate or re-own the 0016 tables, paths or events.
- The control plane is the authority for user/tenant/policy facts; Artifact/Approval owns immutable conclusions and effects; this plan consumes their fixed Digests and does not create mutable substitutes.
- Standard employees have immutable `EmployeeVersion` and tenant `EmployeeInstance`/assignment lifecycle. Dynamic employees require an approved `EmployeeAssemblyPlan`, minimum-intersection authorization, `EphemeralEmployeeInstance` TTL and append-only `AssemblyReceipt` cleanup evidence.
- Every Run fixes employee, assignment, ontology, model/knowledge/memory policy, capability catalog, authorization and configuration watermarks. A later publish/revoke never silently rewrites an existing Run.
- Authorization is evaluated for every read, delegate, command, MCP call and resume using the verified human + employee/service dual subject and current policy/relationship/revocation watermarks. SubRun delegation can only narrow scope, depth, budget and deadline.
- State changes use `UPDATE ... WHERE state_version = :expected`, unique idempotency keys and an active Lease epoch. Stale/duplicate commands return the previous fact or typed conflict; they never make a second external effect.
- `CapabilityAvailabilityProjection` has only AVAILABLE, READ_ONLY, WAITING_RECOVERY, ACTIONS_PAUSED and UNAVAILABLE. It is user-readable, includes a next step/recovery notification reference, and never leaks secrets or component internals.
- One stable Connector per host loads `UserContextProjection`, `EmployeeProjection`, `CapabilityCatalog` and `CapabilityAvailabilityProjection` only. It does not dynamically install a full plugin per employee and does not receive bearer grants in model-visible tool input.
- Codex, Claude Code, DeepSeek Harness (DSH) and Hermes are four separate first-release adapter/capability contracts. A PASS for one host cannot satisfy another host; an unavailable documented automation surface is `NOT_EXERCISED`, which blocks its enabled production Gate.
- Protected tools use authenticated Streamable HTTP. Stdio is disabled for human-protected tools unless an explicit least-privilege service principal is configured; it must never select a default tenant.
- Production uses Alembic migrations and PostgreSQL repositories. Runtime DDL, in-memory stores, unsigned employee packages and host-private chat histories as platform state are prohibited.

---

## First-Release Surface Matrix

| Object/lifecycle scope                                                                               | REST/OpenAPI v1 surface                                                                               | MCP/A2A/Event surface                                                                  | Product UI surface                                   | Host adapter acceptance                                                          |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| BusinessSession, WorkItem, EmployeeRun, SubRun, HostSession, RuntimeCommand                          | `/api/v1/runtime/sessions`, `/work-items`, `/runs`, `/runs/{id}:pause                                 | resume                                                                                 | cancel                                               | retry`, `/runs/{id}/subruns`, `/host-sessions`                                   | `runtime.run.changed.v1`; `employee.resume`; A2A delegated SubRun envelope | `/workbench/tasks`, `/workbench/tasks/{runId}` | Each host resumes the same session/run and sees no private chain-of-thought |
| ExecutionLease, Checkpoint, CapabilityAvailabilityProjection                                         | `/runs/{id}/lease`, `/runs/{id}/checkpoints`, `/availability`                                         | lease claim is transport-private; `runtime.availability.changed.v1`                    | timeline plus read-only/wait/pause/unavailable state | Disconnect/reconnect proves stale lease rejection and clear recovery message     |
| EmployeeDefinition, EmployeeVersion, Package/Release, Instance, Assignment, Team, Policy, Projection | `/api/v1/employees`, `/versions`, `/packages`, `/instances`, `/assignments`, `/teams`, `/projections` | `employee.release.changed.v1`; `platform.bootstrap` returns EmployeeProjection/Catalog | `/admin/employees`, `/workbench/my-employees`        | Each host reads only granted fixed projections and schema-compatible MCP catalog |
| EmployeeAssemblyPlan, EphemeralEmployeeInstance, AssemblyReceipt                                     | `/api/v1/runtime/assembly-plans`, `/ephemeral-employees`, `/assembly-receipts`                        | `employee.assembly.changed.v1`; A2A SubRun receives narrowed delegation                | task detail shows plan, expiry and receipt           | TTL, Run completion and revoke remove temporary credentials/roles on every host  |
| HostType/Version, HostCapabilityContract, ConnectorDefinition/Instance                               | `/api/v1/hosts`, `/contracts`, `/connectors`, `/connector-instances`                                  | `host.capability.changed.v1`; authenticated Connector bootstrap                        | `/admin/hosts`, `/admin/hosts/{host}/compatibility`  | Codex, Claude Code, DSH and Hermes each have version-pinned adapter and live job |

All REST writes require `If-Match`/expected state version and `Idempotency-Key`; all read routes re-authorize tenant/human/employee context. MCP responses use structured JSON plus an Artifact link, never hidden authorization authority. Every event carries CloudEvents `id`, `type`, `subject`, `tenant_id`, `causationid`, `schema_version` and canonical payload Digest.

## File Structure

- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/runtime/contracts.py` — shared lifecycle states, lease, command, projection, delegation and host contract Pydantic types.
- Create: `mate-platform-backend/packages/mate-kernel/tests/test_runtime_contracts.py` — state machine, digest, lease and delegation conformance vectors.
- Create: `mate-platform-backend/alembic/versions/20260901_0022_runtime_employee_host_v1.py` — revision 0022_runtime_employee_host_v1, down_revision 0021_control_plane_v1; extension tables for packages, teams, policy bindings, SubRun, dynamic assembly and host capability evidence, without recreating MVP1 core tables.
- Modify: MVP1-owned `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/repository.py` and `runtime/service.py`; create `runtime/projections.py` and `runtime/delegation.py` — extend the single authoritative CAS/Lease service for projection and SubRun.
- Modify: MVP1-owned `mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control/`; create `mate-tech-orchestrator/.../employees/assembly.py` — extend employee lifecycle and add temporary assembly/revocation without a second control service.
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/runtime.py` and `api/employees.py` — typed FastAPI routes.
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/app.py`, `main.py`, `repositories/sql_models.py`, `repositories/sql_store.py`, and `contracts/openapi/services/orchestrator.yaml` — registration, persistence adapter and exact REST contracts.
- Create: `mate-platform-backend/contracts/events/runtime.v1.schema.json`, `contracts/events/employee.v1.schema.json`, `contracts/events/host.v1.schema.json` — versioned event schemas.
- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/connectors/platform_connector.py` — context middleware and stable Bootstrap/Resume MCP facade.
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/main.py`, `api/origin_routes.py`, `transports/server.py` — authenticated streamable transport and connector registration.
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_ledger.py`, `tests/test_employee_lifecycle.py`, `tests/test_employee_assembly.py`, `tests/test_host_projection_api.py` — unit/integration contracts.
- Create: `acceptance/hosts/v1/codex.yaml`, `claude-code.yaml`, `deepseek-harness.yaml`, `hermes.yaml` — individually version-pinned HostCapabilityContract inputs.
- Create: `scripts/test-host-codex.ps1`, `test-host-claude-code.ps1`, `test-host-dsh.ps1`, `test-host-hermes.ps1`, `scripts/test-host-matrix.ps1` — separate live adapter jobs and aggregating verifier.
- Create: `metaplatform-frontend/apps/web/src/api/runtime.ts`, `api/employees.ts`, `pages/workbench/TaskCenterPage.tsx`, `pages/workbench/TaskDetailPage.tsx`, `pages/admin/employees/EmployeeCenterPage.tsx`, `pages/admin/hosts/HostCompatibilityPage.tsx` — operational product views, not a duplicate chat client.
- Create: `metaplatform-frontend/tests/e2e/runtime-host-continuation.spec.ts`, `employee-assembly.spec.ts`, `host-degradation.spec.ts` — browser/E2E evidence.
- Create: `scripts/test-runtime-employee-host-e2e.ps1` and `acceptance/e2e/runtime-employee-host-environment.lock.yaml` — pinned live integration/recovery runner.

### Task 1: Define Runtime, employee, delegation and host contracts

**Files:**

- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/runtime/contracts.py`
- Create: `mate-platform-backend/packages/mate-kernel/tests/test_runtime_contracts.py`
- Create: `mate-platform-backend/contracts/events/runtime.v1.schema.json`
- Create: `mate-platform-backend/contracts/events/employee.v1.schema.json`
- Create: `mate-platform-backend/contracts/events/host.v1.schema.json`
- Modify: `mate-platform-backend/contracts/openapi/services/orchestrator.yaml`

**Interfaces:**

- Produces: `transition_run(run_id: UUID, expected_state_version: int, command: RuntimeCommand, principal: DualSubject) -> EmployeeRun`.
- Produces: `acquire_lease(run_id: UUID, host_session_id: UUID, expected_epoch: int, ttl: timedelta) -> LeaseToken` and `assert_current_lease(token: LeaseToken) -> None`.
- Produces: `create_subrun(parent: EmployeeRun, request: DelegationRequest, principal: DualSubject) -> SubRun`.
- Produces: `assemble_employee(plan: EmployeeAssemblyPlan, run: EmployeeRun, principal: DualSubject) -> tuple[EphemeralEmployeeInstance, AssemblyReceipt]`.
- Produces: `HostCapabilityContract { host: Literal["codex", "claude-code", "deepseek-harness", "hermes"], host_version: str, connector_version: str, transport: Literal["streamable-http"], capabilities: dict[str, SupportState] }`. `DSH` is only a display alias; persisted contracts/evidence using `dsh` are rejected so GA consumes one canonical identifier.

- [ ] **Step 1: Write failing state/lease/delegation tests**

```python
def test_stale_lease_cannot_transition_run() -> None:
    run = employee_run(state="RUNNING", state_version=4)
    with pytest.raises(StaleLease):
        transition_run(run.id, 4, RuntimeCommand(kind="pause", idempotency_key="p-1", lease_epoch=3), dual_subject())

def test_subrun_can_only_reduce_parent_authority_budget_and_deadline() -> None:
    parent = employee_run(scopes={"orders.read", "orders.write"}, budget=100, deadline=utcnow() + timedelta(hours=2))
    with pytest.raises(DelegationEscalation):
        create_subrun(parent, DelegationRequest(scopes={"orders.write", "admin"}, budget=101, deadline=parent.deadline + timedelta(minutes=1)), dual_subject())

def test_ephemeral_employee_receipt_has_fixed_dependencies_and_expiry() -> None:
    instance, receipt = assemble_employee(approved_plan(), active_run(), dual_subject())
    assert receipt.employee_version_digest == approved_plan().employee_version_digest
    assert instance.expires_at <= active_run().deadline
```

- [ ] **Step 2: Run tests to verify the contract module is absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_runtime_contracts.py -q`

Expected: FAIL because `mate_kernel.runtime.contracts` does not exist.

- [ ] **Step 3: Implement immutable contracts and schemas**

```python
class RuntimeCommand(BaseModel):
    kind: Literal["pause", "resume", "cancel", "retry"]
    idempotency_key: str
    lease_epoch: int

class CapabilityAvailabilityProjection(BaseModel):
    status: Literal["AVAILABLE", "READ_ONLY", "WAITING_RECOVERY", "ACTIONS_PAUSED", "UNAVAILABLE"]
    capability_id: str
    message: str
    next_step: str
    recovery_notification_ref: str | None
    source_watermark: str
    digest: str
```

Define legal Run transitions, terminal states, immutable dependency digest fields, and CloudEvents schemas. Reject host-supplied Run state, tenant, human, employee, authorization scope, policy watermark, or lease epoch as trusted data.

- [ ] **Step 4: Verify contracts and OpenAPI normalization**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_runtime_contracts.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: PASS; every matrix REST operation and every emitted event has a versioned schema and stable public error code.

- [ ] **Step 5: Commit the shared Runtime boundary**

```bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/runtime/contracts.py mate-platform-backend/packages/mate-kernel/tests/test_runtime_contracts.py mate-platform-backend/contracts/events/runtime.v1.schema.json mate-platform-backend/contracts/events/employee.v1.schema.json mate-platform-backend/contracts/events/host.v1.schema.json mate-platform-backend/contracts/openapi/services/orchestrator.yaml
git commit -m "feat(runtime): define employee host and lease contracts"
```

### Task 2: Extend the MVP1 employee/Runtime authority under RLS

**Files:**

- Create: `mate-platform-backend/alembic/versions/20260901_0022_runtime_employee_host_v1.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/repository.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/service.py`
- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control/repository.py`
- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control/service.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/employees/assembly.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/sql_models.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/sql_store.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_ledger.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_lifecycle.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_assembly.py`

**Interfaces:**

- Consumes the MVP1-owned employee definitions/versions/instances/assignments and Runtime ledger tables/APIs from revision 0016.
- Produces extension tables `employee_packages`, `employee_teams`, `employee_policy_bindings`, `employee_assembly_plans`, `ephemeral_employee_instances`, `assembly_receipts`, `sub_runs`, `host_capability_contracts` and extension Outbox facts; it adds compatible columns/indexes to core tables only through expand/contract rules.
- Consumes `UserContextProjection` and current control-plane authorization watermarks; stores references/digests only.

- [ ] **Step 1: Write failing RLS/CAS/lifecycle tests**

```python
def test_concurrent_confirmed_command_creates_one_runtime_command(db: Session) -> None:
    results = concurrently(2, lambda: ledger.transition_run(run_id=RUN, expected_state_version=2, command=resume_command("same-key"), principal=dual_subject()))
    assert {item.state_version for item in results} == {3}
    assert count_rows(db, "runtime_commands", run_id=RUN, idempotency_key="same-key") == 1

def test_published_employee_version_is_immutable_and_old_run_keeps_digest(db: Session) -> None:
    version = employees.publish(draft_employee_version(), admin_subject())
    run = ledger.create_run(employee_version_digest=version.digest, principal=dual_subject())
    with pytest.raises(PublishedVersionImmutable):
        employees.update_version(version.id, {"model": "other"}, admin_subject())
    assert ledger.get_run(run.id).employee_version_digest == version.digest
```

- [ ] **Step 2: Run tests to verify persistence is absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_ledger.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_lifecycle.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_assembly.py -q`

Expected: FAIL because the MVP1 core exists but the 0022 extension revision, SubRun/dynamic-assembly services and compatibility tests are absent.

- [ ] **Step 3: Implement migration, repositories and fencing**

Use `revision = "0022_runtime_employee_host_v1"` and `down_revision = "0021_control_plane_v1"`; assert the MVP1 revision 0016 tables are present and owned by the MVP1 plan, then create only the extension tables listed above with tenant RLS. Add compatible SubRun and projection references/indexes without dropping or recreating core columns. Reuse MVP1 CAS transition and Lease fencing services, extend them for SubRun and host revocation, and append commands/receipts/events transactionally. Employee policy changes generate a new immutable employee version through the existing Employee Control service. Dynamic assembly calculates the set intersection of human grants, employee capabilities, resource policy and plan constraints, then writes a TTL-bound instance and receipt.

- [ ] **Step 4: Verify PostgreSQL concurrency, RLS and downgrade**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_ledger.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_lifecycle.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_assembly.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_tenant_integration.py -q`

Expected: PASS; stale lease, duplicate key, circular SubRun, cross-tenant read, expired temporary employee and mutable published version are rejected.

- [ ] **Step 5: Commit ledger and employee authority**

```bash
git add mate-platform-backend/alembic/versions/20260901_0022_runtime_employee_host_v1.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/employees mate-platform-backend/packages/mate-platform/src/mate_platform/employee_control mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/sql_models.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/sql_store.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_ledger.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_lifecycle.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_employee_assembly.py
git commit -m "feat(runtime): extend employee runtime authority for hosts and assembly"
```

### Task 3: Expose Runtime/employee APIs, projections and availability events

**Files:**

- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/projections.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/delegation.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/runtime.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/employees.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/app.py`
- Modify: `mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/main.py`
- Create: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_host_projection_api.py`
- Modify: `mate-platform-backend/contracts/openapi/services/orchestrator.yaml`

**Interfaces:**

- Produces `GET /api/v1/runtime/runs/{run_id}`, `POST /api/v1/runtime/runs/{run_id}:pause|resume|cancel|retry`, `GET /api/v1/runtime/runs/{run_id}/availability`, and `POST /api/v1/runtime/runs/{run_id}/subruns`.
- Produces employee lifecycle collection routes and `GET /api/v1/runtime/projections/{host_session_id}` returning fixed User/Employee/Capability/Availability projections.
- Produces outbox events only after committed CAS state transition or projection invalidation.

- [ ] **Step 1: Write failing route/projection tests**

```python
def test_projection_contains_only_fixed_minimums_and_invalidates_after_policy_change(client: TestClient) -> None:
    first = client.get(f"/api/v1/runtime/projections/{HOST_SESSION}", headers=connector_headers()).json()
    assert set(first) == {"user_context", "employee_projection", "capability_catalog", "availability"}
    advance_policy_watermark(TENANT)
    denied = client.get(f"/api/v1/runtime/projections/{HOST_SESSION}", headers=connector_headers())
    assert denied.status_code == 409
    assert denied.json()["code"] == "PROJECTION_STALE"

def test_availability_hides_dependency_name_but_preserves_recovery_path(client: TestClient) -> None:
    response = client.get(f"/api/v1/runtime/runs/{RUN}/availability", headers=runtime_headers())
    assert response.json()["status"] == "ACTIONS_PAUSED"
    assert "postgres" not in response.text.lower()
    assert response.json()["next_step"] == "等待授权恢复后继续执行"
```

- [ ] **Step 2: Run tests to verify routes fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-orchestrator/tests/test_host_projection_api.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: FAIL because Runtime/employee routers and projection service are absent.

- [ ] **Step 3: Implement routes, dual-subject checks and event outbox**

Use dependencies that verify Keycloak runtime token, connector instance proof, tenant/human/employee binding and current policy watermarks before invoking the ledger. All mutating endpoints require `Idempotency-Key`; all lifecycle endpoints require expected version. `EmployeeProjection` contains fixed employee version/package/policy/knowledge scope Digests and allowed catalog IDs, never source secrets or permissive prompt text. `CapabilityAvailabilityProjection` aggregates only allowed capability descriptions and recovery paths; it must be invalidated on policy, data, identity, service and host-contract changes.

- [ ] **Step 4: Verify contract and event behavior**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-orchestrator/tests/test_host_projection_api.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_runtime_ledger.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: PASS; route/OpenAPI consistency holds, projections stale on watermark advance, and repeated commands emit one event/audit correlation.

- [ ] **Step 5: Commit Runtime APIs**

```bash
git add mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/projections.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/runtime/delegation.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/runtime.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/employees.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/app.py mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/main.py mate-platform-backend/packages/mate-tech-orchestrator/tests/test_host_projection_api.py mate-platform-backend/contracts/openapi/services/orchestrator.yaml
git commit -m "feat(runtime): expose projections commands and employee APIs"
```

### Task 4: Implement the stable MCP Host Connector

**Files:**

- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/connectors/platform_connector.py`
- Create: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/connectors/context.py`
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/main.py`
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/origin_routes.py`
- Modify: `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/transports/server.py`
- Create: `mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector.py`
- Create: `mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector_isolation.py`

**Interfaces:**

- Produces MCP tools `platform.bootstrap`, `platform.resume_task`, `platform.get_task_status`, `platform.get_artifact_link`; each returns `structuredContent` plus an authorized Artifact resource link when applicable.
- Consumes only a verified HTTP connector context; the model-visible argument schema has no tenant ID, principal ID, role, lease, policy watermark, bearer token or secret.
- Produces `BootstrapCallContext` and `RuntimeToolCallContext` internally; a missing context returns `AUTH_CONTEXT_REQUIRED`.

- [ ] **Step 1: Write failing MCP isolation tests**

```python
def test_bootstrap_argument_cannot_override_verified_tenant_or_audience(server: MCPServer) -> None:
    result = server.call_tool("platform.bootstrap", {"tenant_id": "other", "audience": "hermes"}, verified_context(tenant_id="t-a", audience="codex"))
    assert result.structuredContent["user_context"]["tenant_id"] == "t-a"
    assert result.structuredContent["user_context"]["audience"] == "codex"

def test_protected_tool_without_http_context_fails_closed(server: MCPServer) -> None:
    with pytest.raises(MCPError, match="AUTH_CONTEXT_REQUIRED"):
        server.call_tool("platform.resume_task", {"run_id": str(uuid4())}, None)
```

- [ ] **Step 2: Run tests to verify connector code is absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector.py mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector_isolation.py -q`

Expected: FAIL because platform connector tools and context middleware are absent.

- [ ] **Step 3: Implement authenticated Streamable HTTP connector**

Wrap Streamable HTTP ASGI requests with middleware that verifies the connector token/instance proof, sets a request-scoped `ContextVar`, calls Runtime projection/command APIs, and resets the token in `finally`. Register exactly one server configuration per host installation; employee changes are projection changes, not plugin installs. Disable protected stdio tool registration unless the configuration names an explicit service principal with a tenant scope. Re-authorize Artifact links through the Artifact authority rather than returning object-store paths.

- [ ] **Step 4: Verify MCP protocol, tenant isolation and API compatibility**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector.py mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector_isolation.py mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_http.py -q`

Expected: PASS; concurrent tenant calls cannot leak ContextVar state, host argument injection cannot alter projection, and no tool exposes private thoughts or credentials.

- [ ] **Step 5: Commit the Host Connector**

```bash
git add mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/connectors/platform_connector.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/connectors/context.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/main.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/origin_routes.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/transports/server.py mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector.py mate-platform-backend/packages/mate-tech-mcp/tests/test_platform_connector_isolation.py
git commit -m "feat(host): add stable authenticated platform connector"
```

### Task 5: Deliver four independent host adapters and capability Gates

**Files:**

- Create: `acceptance/hosts/v1/codex.yaml`
- Create: `acceptance/hosts/v1/claude-code.yaml`
- Create: `acceptance/hosts/v1/deepseek-harness.yaml`
- Create: `acceptance/hosts/v1/hermes.yaml`
- Create: `scripts/test-host-codex.ps1`
- Create: `scripts/test-host-claude-code.ps1`
- Create: `scripts/test-host-dsh.ps1`
- Create: `scripts/test-host-hermes.ps1`
- Create: `scripts/test-host-matrix.ps1`
- Create: `mate-platform-backend/packages/mate-tech-mcp/tests/test_host_contract_matrix.py`
- Modify: `acceptance/gates/component-matrix.yaml`

**Interfaces:**

- Each YAML pins host build/version, Connector version/Digest, documented configuration surface, supported transport, projection/tool/resource/subagent/streaming/artifact-fallback capabilities and one Gate ID.
- Each job emits `{host, host_version, connector_digest, contract_digest, scenario_digest, status, evidence_uri}` and cannot reuse another host's evidence.
- All four jobs must prove bootstrap, catalog visibility, task resume, Artifact link read, revoked projection rejection and user-visible availability fallback.

- [ ] **Step 1: Write failing host matrix tests**

```python
def test_every_enabled_host_has_its_own_contract_and_live_job(host_contracts: list[HostCapabilityContract]) -> None:
    assert {contract.host for contract in host_contracts} == {"codex", "claude-code", "deepseek-harness", "hermes"}
    assert all(contract.transport == "streamable-http" for contract in host_contracts)
    assert all(contract.gate_id != host_contracts[0].gate_id or contract.host == "codex" for contract in host_contracts)

def test_host_evidence_cannot_be_relabelled(host_matrix: HostMatrix) -> None:
    with pytest.raises(HostEvidenceMismatch):
        host_matrix.record(host="hermes", evidence=codex_evidence())

def test_runtime_host_ids_are_consumed_without_aliasing_by_ga(host_contracts, ga_required_hosts) -> None:
    assert {contract.host for contract in host_contracts} == ga_required_hosts
    assert "dsh" not in ga_required_hosts
```

- [ ] **Step 2: Run tests to verify contracts/jobs are absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_host_contract_matrix.py -q`

Expected: FAIL because the four contract files and job declarations are absent.

- [ ] **Step 3: Implement documented adapters and capability evidence**

`test-host-codex.ps1` uses the installed Codex desktop documented MCP configuration surface; `test-host-claude-code.ps1` uses Claude Code's documented configuration surface; `test-host-dsh.ps1` uses `vendor/deepseek-harness` at its pinned commit and emits the canonical host ID `deepseek-harness`; `test-host-hermes.ps1` uses Hermes' documented configuration surface. Each starts the same pinned connector, records host/connector negotiation, runs the six required scenarios, captures a non-secret trace and removes only its own temporary profile/test session. No job patches host source code or simulates a host response.

- [ ] **Step 4: Run all four jobs and the matrix verifier**

Run: `pwsh -File scripts/test-host-codex.ps1 -Mode run-all`

Run: `pwsh -File scripts/test-host-claude-code.ps1 -Mode run-all`

Run: `pwsh -File scripts/test-host-dsh.ps1 -Mode run-all`

Run: `pwsh -File scripts/test-host-hermes.ps1 -Mode run-all`

Run: `pwsh -File scripts/test-host-matrix.ps1 -Contracts acceptance/hosts/v1`

Expected: all five commands PASS. A missing documented noninteractive surface produces `NOT_EXERCISED`, leaves that host Gate closed and prevents GA while that host remains enabled.

- [ ] **Step 5: Commit host-specific contracts and Gates**

```bash
git add acceptance/hosts/v1/codex.yaml acceptance/hosts/v1/claude-code.yaml acceptance/hosts/v1/deepseek-harness.yaml acceptance/hosts/v1/hermes.yaml scripts/test-host-codex.ps1 scripts/test-host-claude-code.ps1 scripts/test-host-dsh.ps1 scripts/test-host-hermes.ps1 scripts/test-host-matrix.ps1 mate-platform-backend/packages/mate-tech-mcp/tests/test_host_contract_matrix.py acceptance/gates/component-matrix.yaml
git commit -m "test(host): require independent four-host connector evidence"
```

### Task 6: Deliver Runtime/employee product views and end-to-end recovery proof

**Files:**

- Create: `metaplatform-frontend/apps/web/src/api/runtime.ts`
- Create: `metaplatform-frontend/apps/web/src/api/employees.ts`
- Create: `metaplatform-frontend/apps/web/src/pages/workbench/TaskCenterPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/workbench/TaskDetailPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/admin/employees/EmployeeCenterPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/admin/hosts/HostCompatibilityPage.tsx`
- Create: `metaplatform-frontend/tests/e2e/runtime-host-continuation.spec.ts`
- Create: `metaplatform-frontend/tests/e2e/employee-assembly.spec.ts`
- Create: `metaplatform-frontend/tests/e2e/host-degradation.spec.ts`
- Create: `scripts/test-runtime-employee-host-e2e.ps1`
- Create: `acceptance/e2e/runtime-employee-host-environment.lock.yaml`

**Interfaces:**

- Produces task timeline/status, approval/artifact links, SubRun list, availability and recovery notice screens; it does not render a general-purpose platform chat loop.
- Produces employee draft/version/publish/assign/retire and assembly-plan/receipt management screens using typed server APIs.
- Consumes host-agnostic Run IDs and projection digests; browser clients never manufacture Employee/Lease/Approval facts.

- [ ] **Step 1: Write failing UI/E2E tests**

```ts
test("Codex-started work continues in Hermes without duplicate command or changed employee digest", async ({
  page,
  request,
}) => {
  const created = await startRunThroughHost("codex");
  await resumeRunThroughHost("hermes", created.sessionId, created.runId);
  await page.goto(`/workbench/tasks/${created.runId}`);
  await expect(page.getByText("跨宿主继续")).toBeVisible();
  await expect(page.getByTestId("employee-version-digest")).toHaveText(
    created.employeeVersionDigest,
  );
  expect(await commandCount(request, created.runId)).toBe(1);
});

test("unavailable action dependency pauses actions but preserves report and recovery path", async ({
  page,
}) => {
  await induceCapabilityFailure("action-service");
  await page.goto(`/workbench/tasks/${RUN}`);
  await expect(page.getByText("操作已暂停")).toBeVisible();
  await expect(page.getByText("报告仍可查看")).toBeVisible();
  await expect(page.getByText("等待恢复后继续")).toBeVisible();
});
```

- [ ] **Step 2: Run UI/E2E tests to verify they fail**

Run: `pnpm --dir metaplatform-frontend --filter @mate/web test -- TaskCenterPage`

Run: `pnpm --dir metaplatform-frontend exec playwright test tests/e2e/runtime-host-continuation.spec.ts tests/e2e/employee-assembly.spec.ts tests/e2e/host-degradation.spec.ts`

Expected: FAIL because Runtime pages and pinned integration environment are absent.

- [ ] **Step 3: Implement views and live test runner**

Render server-provided status and availability with clear action/state affordances. The runner starts pinned PostgreSQL, IAM/control plane, Runtime, MCP connector and four host jobs; applies migrations; creates a real employee/version/assignment; runs cross-host continuation; tests lease expiry/revoke/TTL cleanup; injects identity/data/action failure domains; snapshots the ledger; restores into an independent test target; verifies no duplicate RuntimeCommand, no orphan temporary employee and preserved audit/Artifact references; and cleans only named resources in `finally`.

- [ ] **Step 4: Run typecheck, browser E2E and recovery evidence**

Run: `pnpm --dir metaplatform-frontend --filter @mate/web run typecheck`

Run: `pwsh -File scripts/test-runtime-employee-host-e2e.ps1 -Mode run-all`

Expected: PASS with zero required-live skips; emitted evidence contains four host results, E2E traces, lease/assembly cleanup assertions, degradation views, restore RPO/RTO and correlation IDs.

- [ ] **Step 5: Commit Runtime/employee/host acceptance**

```bash
git add metaplatform-frontend/apps/web/src/api/runtime.ts metaplatform-frontend/apps/web/src/api/employees.ts metaplatform-frontend/apps/web/src/pages/workbench/TaskCenterPage.tsx metaplatform-frontend/apps/web/src/pages/workbench/TaskDetailPage.tsx metaplatform-frontend/apps/web/src/pages/admin/employees/EmployeeCenterPage.tsx metaplatform-frontend/apps/web/src/pages/admin/hosts/HostCompatibilityPage.tsx metaplatform-frontend/tests/e2e/runtime-host-continuation.spec.ts metaplatform-frontend/tests/e2e/employee-assembly.spec.ts metaplatform-frontend/tests/e2e/host-degradation.spec.ts scripts/test-runtime-employee-host-e2e.ps1 acceptance/e2e/runtime-employee-host-environment.lock.yaml
git commit -m "test(runtime): verify employee host continuation and recovery"
```

## Self-Review

- Runtime coverage: Session, WorkItem, Run, SubRun, HostSession, Lease, checkpoint, command and availability lifecycles are defined in Task 1, persisted in Task 2, exposed in Task 3 and proven in Task 6.
- Digital employee coverage: definition/version/package/instance/assignment/team/policy/projection and dynamic assembly/receipt/revocation are represented by the surface matrix and Tasks 1–3 and 6.
- Host coverage: stable Connector isolation is in Task 4; Codex, Claude Code, DSH and Hermes each have an independent pinned contract and live adapter job in Task 5.
- Interface coverage: REST/OpenAPI, MCP, A2A delegation, CloudEvents, UI routes and host compatibility contracts are enumerated and tested; no interface is satisfied by a mock-only result.
- Authority and safety coverage: CAS/leases, dual-subject authorization, tenant RLS, immutable dependency digests, user-visible degradation and independent restore are explicit in Tasks 2, 3 and 6.
- Placeholder scan: this plan contains no deferred work markers, no generic test instruction, and every task includes files, exact interfaces, a failing test, execution command, implementation behavior, verification command and commit boundary.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-01-metaplatform-runtime-employee-host-v1.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, with checkpoints.

Which approach?
