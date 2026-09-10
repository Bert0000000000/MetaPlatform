# MetaPlatform Control Plane V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first-release personal, organization/identity/authorization, and tenant/configuration control plane as versioned, tenant-isolated, auditable product APIs and management surfaces.

**Architecture:** `mate-tech-iam` remains the policy and administrative API boundary; Supabase Auth is the connected-deployment human identity authority, Keycloak issues runtime tokens, and OpenFGA/OPA/RLS make the final authorization decision. The control plane owns user declarations, organization/role/policy facts and tenant configuration, but only emits minimum, TTL-bound projections for the Runtime and approved Host Connector. It never owns a Run, Lease, Artifact, Approval, or host-private conversation.

**Tech Stack:** Python 3.12, FastAPI, Pydantic 2, SQLAlchemy, PostgreSQL 16, Alembic, Supabase Auth, Keycloak, OpenFGA, OPA, RFC 8785 JSON canonicalization, CloudEvents 1.0, React 18, Vite, TypeScript, Ant Design, Vitest, Playwright, OpenTelemetry.

**Spec:** `docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md`; `docs/superpowers/specs/2026-09-01-metaplatform-agile-delivery-operating-model.md`; `docs/superpowers/plans/2026-09-01-metaplatform-first-release-closure.md`; `docs/superpowers/plans/2026-09-01-metaplatform-agile-program-delivery.md`.

## Global Constraints

- `HumanUser` identity facts originate from Supabase Auth in connected deployments; Keycloak is a trust broker/runtime-token issuer, not a second user authority.
- Every REST route, MCP tool/resource, CloudEvent, UI route and host projection listed below is a release Requirement; it must have schema, authorization, audit, contract test, E2E and rollback evidence.
- PostgreSQL with RLS is the authoritative store for control-plane domain facts. OpenFGA relation tuples and OPA bundles are derived authorization inputs with version/watermark evidence; frontend hiding is never authorization.
- All published assets are immutable. Draft changes create a new version; published/referenced assets are retired, revoked or archived rather than physically deleted.
- Every write carries tenant, authenticated human or service principal, correlation ID and idempotency key. Cross-tenant IDs, inferred tenant headers and client-supplied authorization claims are rejected.
- Preference values can change rendering and communication style only. They cannot alter organization, role, policy, approval, quota, retention or data-access decisions.
- The sole host-facing output is a minimum, audience-bound `UserContextProjection`; the projection has a TTL, policy/relationship/config watermarks and a canonical Digest. It never includes secrets, full profile data or private model reasoning.
- Runtime/Host work must consume the interfaces in this plan; this plan must not create `BusinessSession`, `EmployeeRun`, `LeaseToken`, `ArtifactEnvelope`, `ApprovalRecord` or `ExecutionReceipt` tables.
- A production migration is Alembic-only. `Base.metadata.create_all`, runtime DDL, in-memory authorization stores and legacy IAM authorization reads are forbidden on production paths.
- Failed dependencies produce a typed `CapabilityAvailabilityProjection` input (`READ_ONLY`, `WAITING_RECOVERY`, `ACTIONS_PAUSED`, or `UNAVAILABLE`) through Runtime; control-plane endpoints do not expose infrastructure internals.

---

## First-Release Surface Matrix

| Product area and lifecycle objects                                                                                             | REST/OpenAPI v1 surface                                                                                                           | Event contract                     | UI surface                                               | Host/MCP surface                                                      | Required acceptance                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| UserProfile, UserPreferenceSet, PreferenceCandidate, SavedView                                                                 | `/api/v1/control/me`, `/me/preferences`, `/me/preference-candidates`, `/me/views`                                                 | `control.user-context.changed.v1`  | `/workbench/profile`                                     | `platform.bootstrap` returns only effective context                   | User changes language/output preference; another tenant cannot read it; projection digest changes once     |
| HumanUser, OrganizationUnit, IdentityLink                                                                                      | `/api/v1/control/users`, `/org-units`, `/identity-links`                                                                          | `control.identity.changed.v1`      | `/admin/identity/users`, `/admin/identity/organizations` | no direct host write                                                  | SCIM/Supabase-linked user is disabled and all old projections are rejected                                 |
| DynamicRole, PermissionDefinition, RelationshipTuple, Policy, SoDRule, DelegationGrant, ServicePrincipal, AccessReviewCampaign | `/roles`, `/permissions`, `/relationships`, `/policies`, `/sod-rules`, `/delegations`, `/service-principals`, `/access-reviews`   | `control.authorization.changed.v1` | `/admin/access/*`                                        | bootstrap denies stale or over-scoped context                         | role publish, SoD failure, delegation expiry and access-review revoke are audited and fail closed          |
| Tenant, TenantDomain, ConfigValue, FeatureFlag, Quota, Dictionary, NotificationChannel, RetentionPolicy                        | `/tenants`, `/domains`, `/configs`, `/feature-flags`, `/quotas`, `/dictionaries`, `/notification-channels`, `/retention-policies` | `control.tenant-config.changed.v1` | `/admin/tenants/*`                                       | bootstrap includes only effective tenant/config capability watermarks | config release/rollback, quota downgrade, webhook rotation and retention deletion propagation are verified |

All collection routes support only cursor pagination, explicit `tenant_id` derived from the verified principal, stable filtering/sorting allowlists and `If-Match` for mutable draft/config resources. Every mutable route returns `{id, version, digest, status, audit_id}`. Every retire/revoke/delete request first returns an immutable `ImpactReport`; a changed dependency set invalidates its confirmation.

## File Structure

- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/control_plane/contracts.py` — Pydantic types, lifecycle states, projection and CloudEvent envelopes shared by IAM, Runtime and Connector.
- Create: `mate-platform-backend/packages/mate-kernel/tests/test_control_plane_contracts.py` — canonical-Digest, state-machine and projection-minimization conformance vectors.
- Create: `mate-platform-backend/alembic/versions/20260901_0021_control_plane_v1.py` — revision 0021_control_plane_v1, down_revision 0020_event_inbox_dlq; RLS-protected control-plane tables, indexes, triggers and reversible expand/contract migration.
- Modify: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/domain/user.py`, `domain/role.py`, `domain/permission.py`, `domain/org.py`, `domain/system_config.py` — replace legacy mutable-only models with versioned domain adapters.
- Create: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/domain/control_plane.py` — repositories/services for profiles, roles, policy, tenant config, impact reports and projection issuance.
- Create: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/api/control_plane.py` — typed FastAPI routers for every matrix route.
- Modify: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/main.py` and `contracts/openapi/services/iam.yaml` — router registration and versioned OpenAPI operations/errors.
- Create: `mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_api.py`, `tests/test_control_plane_rls.py`, `tests/test_control_plane_events.py` — route/OpenAPI, RLS/SoD, event outbox and rollback tests.
- Create: `mate-platform-backend/contracts/events/control-plane.v1.schema.json` — CloudEvents payload schemas and compatibility rules for the three events in the matrix.
- Create: `metaplatform-frontend/apps/web/src/api/control-plane.ts` — typed client generated from the IAM OpenAPI operations, without local authorization decisions.
- Create: `metaplatform-frontend/apps/web/src/pages/workbench/ProfilePage.tsx`, `pages/admin/access/AccessControlPage.tsx`, `pages/admin/tenants/TenantControlPage.tsx` — first-release management/view pages.
- Create: `metaplatform-frontend/apps/web/src/pages/control-plane-routes.tsx` and `tests/e2e/control-plane.spec.ts` — route registration and real browser acceptance.
- Create: `scripts/test-control-plane-e2e.ps1` and `acceptance/e2e/control-plane-environment.lock.yaml` — pinned IAM/Keycloak/Supabase-compatible/PostgreSQL/OpenFGA/OPA test environment and teardown-safe runner.

### Task 1: Define versioned control-plane contracts and interface catalog

**Files:**

- Create: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/control_plane/contracts.py`
- Create: `mate-platform-backend/packages/mate-kernel/tests/test_control_plane_contracts.py`
- Create: `mate-platform-backend/contracts/events/control-plane.v1.schema.json`
- Modify: `mate-platform-backend/contracts/openapi/services/iam.yaml`

**Interfaces:**

- Produces: `UserContextProjection.issue(subject: BootstrapSubject, effective: EffectiveContext, expires_at: datetime) -> UserContextProjection`.
- Produces: `LifecycleCommand(resource_id: UUID, expected_version: int, action: Literal["publish", "retire", "revoke", "archive"], impact_digest: str | None)`.
- Produces: `ControlPlaneEvent[T] { id, type, tenant_id, subject_id, aggregate_id, aggregate_version, data_digest, data }` for `control.user-context.changed.v1`, `control.authorization.changed.v1`, and `control.tenant-config.changed.v1`.
- Consumes: verified `BootstrapSubject { tenant_id, human_id, host_instance_id, audience, policy_watermark }`; no caller-provided role or tenant field.

- [ ] **Step 1: Write failing contract tests**

```python
def test_projection_excludes_roles_secrets_and_private_fields() -> None:
    projection = UserContextProjection.issue(
        subject=BootstrapSubject(tenant_id="t-a", human_id="u-a", host_instance_id="h-a", audience="codex"),
        effective=EffectiveContext(display_name="A", preference={"format": "markdown"}, roles=["finance-admin"], secret_refs=["vault://x"]),
        expires_at=datetime(2026, 9, 1, tzinfo=UTC),
    )
    assert projection.model_dump(exclude_none=True) == {
        "tenant_id": "t-a", "human_id": "u-a", "display_name": "A",
        "preferences": {"format": "markdown"}, "audience": "codex",
        "expires_at": "2026-09-01T00:00:00Z", "schema_version": "1.0",
    }
    assert projection.digest == canonical_digest(projection.payload())

def test_publish_requires_matching_impact_digest() -> None:
    with pytest.raises(ImpactReportChanged):
        LifecycleCommand(resource_id=uuid4(), expected_version=3, action="publish", impact_digest="stale")
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_control_plane_contracts.py -q`

Expected: FAIL because `mate_kernel.control_plane.contracts` does not exist.

- [ ] **Step 3: Implement minimum immutable types and event schemas**

```python
class UserContextProjection(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    tenant_id: str
    human_id: str
    display_name: str
    preferences: dict[str, JsonValue]
    audience: Literal["codex", "claude-code", "deepseek-harness", "hermes"]
    expires_at: datetime
    digest: str

    @classmethod
    def issue(cls, subject: BootstrapSubject, effective: EffectiveContext, expires_at: datetime) -> "UserContextProjection":
        payload = {"tenant_id": subject.tenant_id, "human_id": subject.human_id, "display_name": effective.display_name,
                   "preferences": effective.allowed_preferences(), "audience": subject.audience,
                   "expires_at": expires_at.astimezone(UTC).isoformat().replace("+00:00", "Z"), "schema_version": "1.0"}
        return cls(**payload, digest=canonical_digest(payload))
```

Define JSON Schema `$id` values for each CloudEvent data type and reject unknown schema versions, cross-tenant aggregate IDs and absent causation/correlation IDs at deserialization.

- [ ] **Step 4: Run contracts and OpenAPI normalization tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_control_plane_contracts.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: PASS; `iam.yaml` contains every matrix operation with `401`, `403`, `404`, `409`, `412`, `422`, and typed `CAPABILITY_UNAVAILABLE` responses where applicable.

- [ ] **Step 5: Commit the contract boundary**

```bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/control_plane/contracts.py mate-platform-backend/packages/mate-kernel/tests/test_control_plane_contracts.py mate-platform-backend/contracts/events/control-plane.v1.schema.json mate-platform-backend/contracts/openapi/services/iam.yaml
git commit -m "feat(control): define versioned control-plane contracts"
```

### Task 2: Create RLS-protected lifecycle storage and migration safety

**Files:**

- Create: `mate-platform-backend/alembic/versions/20260901_0021_control_plane_v1.py`
- Modify: `mate-platform-backend/alembic/env.py`
- Create: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/domain/control_plane.py`
- Create: `mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_rls.py`
- Modify: `mate-platform-backend/packages/mate-tech-db/tests/test_db_migrations.py`

**Interfaces:**

- Produces: `ControlPlaneRepository.create_draft(resource: DraftResource, actor: Principal) -> VersionedResource`, `publish(command: LifecycleCommand, actor: Principal) -> VersionedResource`, and `impact(resource: ResourceRef, actor: Principal) -> ImpactReport`.
- Produces tables `user_preferences`, `preference_candidates`, `saved_views`, `organization_units`, `dynamic_roles`, `permission_definitions`, `relationship_tuples`, `policy_versions`, `sod_rules`, `delegation_grants`, `service_principals`, `access_review_campaigns`, `tenant_configs`, `config_releases`, `feature_flags`, `quotas`, `notification_channels`, `retention_policies`, `control_plane_outbox`.
- Consumes: `app.tenant_id`, `app.principal_id`, and `app.correlation_id` set with `SET LOCAL` for every transaction.

- [ ] **Step 1: Write failing migration/RLS tests**

```python
def test_tenant_b_cannot_select_or_confirm_tenant_a_role(db: Session) -> None:
    role = create_dynamic_role(db, tenant_id="t-a", name="approver")
    with tenant_transaction(db, tenant_id="t-b", principal_id="u-b"):
        assert list_roles(db) == []
        with pytest.raises(NotFound):
            publish_role(db, role.id, expected_version=1, impact_digest="x")

def test_downgrade_preserves_existing_order_and_audit_tables(alembic_runner: AlembicRunner) -> None:
    alembic_runner.upgrade("0021_control_plane_v1")
    alembic_runner.downgrade("0020_event_inbox_dlq")
    assert alembic_runner.table_exists("order_review_orders")
    assert not alembic_runner.table_exists("dynamic_roles")
```

- [ ] **Step 2: Run tests to verify the migration is absent**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_rls.py mate-platform-backend/packages/mate-tech-db/tests/test_db_migrations.py -q`

Expected: FAIL because revision `20260901_0021_control_plane_v1` and repositories are absent.

- [ ] **Step 3: Implement expand-only migration, repositories and RLS**

Create every table with `tenant_id`, `id`, `version`, `status`, `created_at`, `created_by`, `updated_at`, `updated_by`, `digest`, and append-only audit/outbox references. Add `UNIQUE (tenant_id, id)`, resource-specific natural-key uniqueness, FKs to immutable version records, and RLS policies using `current_setting('app.tenant_id', true)`. Use an AFTER INSERT/UPDATE trigger only to append audit/outbox facts; never mutate a published version. Use `down_revision = "0020_event_inbox_dlq"` from the canonical migration chain and a bounded downgrade that removes only this revision's objects.

- [ ] **Step 4: Verify migration, pooling cleanup and no runtime DDL**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_rls.py mate-platform-backend/packages/mate-tech-db/tests/test_db_migrations.py -q`

Run: `rg -n "create_all\(|metadata\.create_all|InMemory.*Authoriz" mate-platform-backend/packages/mate-tech-iam mate-platform-backend/services -g '*.py'`

Expected: tests PASS; source scan returns no production runtime DDL or in-memory authorizer.

- [ ] **Step 5: Commit storage authority**

```bash
git add mate-platform-backend/alembic/versions/20260901_0021_control_plane_v1.py mate-platform-backend/alembic/env.py mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/domain/control_plane.py mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_rls.py mate-platform-backend/packages/mate-tech-db/tests/test_db_migrations.py
git commit -m "feat(control): add tenant-isolated lifecycle storage"
```

### Task 3: Implement authorization, tenant configuration, projection and event APIs

**Files:**

- Create: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/api/control_plane.py`
- Modify: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/main.py`
- Modify: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/services/security.py`
- Modify: `mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/services/deps.py`
- Create: `mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_api.py`
- Create: `mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_events.py`

**Interfaces:**

- Produces `GET /api/v1/control/me/context?audience={codex|claude-code|deepseek-harness|hermes}`; it accepts a verified connector credential and returns `UserContextProjection` only. `DSH` is a UI alias and is normalized before validation; stored contracts use `deepseek-harness`.
- Produces create/read/update-draft/impact/publish/retire routes for all matrix resource collections; `POST /{collection}/{id}:impact`, `POST /{collection}/{id}:publish`, `POST /{collection}/{id}:retire` share the lifecycle contract.
- Produces `POST /api/v1/control/access-reviews/{id}:close` and `POST /api/v1/control/config-releases/{id}:activate|rollback` with policy/SoD re-evaluation in the same transaction.
- Emits outbox events after the database commit; consumers receive canonical `data_digest` and never a secret reference.

- [ ] **Step 1: Write failing API/authorization tests**

```python
def test_bootstrap_context_rejects_cross_tenant_and_strips_roles(client: TestClient, connector_token: str) -> None:
    response = client.get("/api/v1/control/me/context?audience=codex", headers={"Authorization": f"Bearer {connector_token}"})
    assert response.status_code == 200
    assert set(response.json()) >= {"tenant_id", "human_id", "preferences", "audience", "expires_at", "digest"}
    assert "roles" not in response.json() and "secret_refs" not in response.json()
    denied = client.get("/api/v1/control/roles?tenant_id=other", headers={"Authorization": f"Bearer {connector_token}"})
    assert denied.status_code == 403

def test_role_publish_rejects_sod_conflict_and_writes_one_audit_event(client: TestClient, admin_token: str) -> None:
    response = client.post("/api/v1/control/roles/r-1:publish", json={"expected_version": 1, "impact_digest": "d" * 64}, headers={"Authorization": f"Bearer {admin_token}", "Idempotency-Key": "role-publish-1"})
    assert response.status_code == 409
    assert response.json()["code"] == "SOD_CONFLICT"
```

- [ ] **Step 2: Run tests to verify the routes fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_api.py mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_events.py -q`

Expected: FAIL because `control_plane` router is not registered.

- [ ] **Step 3: Implement typed routes and final authorization checks**

For every write, resolve the authenticated principal, load the resource under RLS, ask OpenFGA/OPA for current action permission, perform SoD/delegation/retention checks, append an audit event and enqueue one typed event in a single transaction. Return `412 VERSION_MISMATCH` for stale `If-Match`, `409 IMPACT_REPORT_CHANGED` for stale impact confirmation, `403 POLICY_DENIED` for authorization denial and `503 CAPABILITY_UNAVAILABLE` with an availability code for unavailable external identity/policy dependencies. Never accept `tenant_id`, `human_id`, `role`, `policy_watermark`, or `scope` as authority from the JSON body.

- [ ] **Step 4: Run route/OpenAPI/event compatibility tests**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_api.py mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_events.py mate-platform-backend/contracts/tests/test_openapi_ci.py -q`

Expected: PASS; generated app routes, methods, status codes and schemas match `iam.yaml`, duplicate idempotency returns the original audit ID, and event consumers reject wrong schema/tenant/digest.

- [ ] **Step 5: Commit APIs and event publication**

```bash
git add mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/api/control_plane.py mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/main.py mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/services/security.py mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/services/deps.py mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_api.py mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_events.py mate-platform-backend/contracts/openapi/services/iam.yaml
git commit -m "feat(control): expose governed control-plane APIs"
```

### Task 4: Deliver management and personal-workbench interfaces

**Files:**

- Create: `metaplatform-frontend/apps/web/src/api/control-plane.ts`
- Create: `metaplatform-frontend/apps/web/src/pages/workbench/ProfilePage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/admin/access/AccessControlPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/admin/tenants/TenantControlPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/control-plane-routes.tsx`
- Modify: `metaplatform-frontend/apps/web/src/main.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/workbench/ProfilePage.test.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/admin/access/AccessControlPage.test.tsx`

**Interfaces:**

- Consumes the generated typed API client; frontend receives `PermissionDecision { allowed, reason_code, policy_watermark }` only for presentation and rechecks server responses.
- Produces profile preference update/reset/candidate-confirm UI, dynamic-role draft/publish/SoD-impact UI, and tenant config release/rollback UI.
- Produces no generic chat page and no direct write to OpenFGA, OPA, Supabase, Keycloak, or PostgreSQL.

- [ ] **Step 1: Write failing component tests**

```tsx
it("shows an impact report before publishing a role and never treats a hidden button as authorization", async () => {
  mockControlPlaneApi.impactRole.mockResolvedValue({
    digest: "a".repeat(64),
    blockers: ["SOD_CONFLICT"],
  });
  render(<AccessControlPage />);
  await userEvent.click(screen.getByRole("button", { name: "发布角色" }));
  expect(await screen.findByText("职责冲突")).toBeVisible();
  expect(mockControlPlaneApi.publishRole).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run: `pnpm --dir metaplatform-frontend --filter @mate/web test -- ProfilePage.test.tsx AccessControlPage.test.tsx`

Expected: FAIL because the pages and typed client do not exist.

- [ ] **Step 3: Implement pages, typed client and routes**

Build forms from OpenAPI request/response types. Show effective preference source and priority; display policy-denied/SoD/impact errors in user language; use `If-Match` and idempotency keys generated per user gesture. Every retire/revoke/delete action first displays the server `ImpactReport.digest`, blockers and recovery implications. Do not cache a successful permission decision after its watermark changes.

- [ ] **Step 4: Verify UI typecheck and accessibility tests**

Run: `pnpm --dir metaplatform-frontend --filter @mate/web run typecheck`

Run: `pnpm --dir metaplatform-frontend --filter @mate/web test -- ProfilePage.test.tsx AccessControlPage.test.tsx`

Expected: PASS; no frontend API call sends tenant or role claims as authority.

- [ ] **Step 5: Commit control-plane UI**

```bash
git add metaplatform-frontend/apps/web/src/api/control-plane.ts metaplatform-frontend/apps/web/src/pages/workbench/ProfilePage.tsx metaplatform-frontend/apps/web/src/pages/admin/access/AccessControlPage.tsx metaplatform-frontend/apps/web/src/pages/admin/tenants/TenantControlPage.tsx metaplatform-frontend/apps/web/src/pages/control-plane-routes.tsx metaplatform-frontend/apps/web/src/main.tsx metaplatform-frontend/apps/web/src/pages/workbench/ProfilePage.test.tsx metaplatform-frontend/apps/web/src/pages/admin/access/AccessControlPage.test.tsx
git commit -m "feat(control): add profile access and tenant workbenches"
```

### Task 5: Prove real identity, authorization, rollback and recovery behavior

**Files:**

- Create: `scripts/test-control-plane-e2e.ps1`
- Create: `acceptance/e2e/control-plane-environment.lock.yaml`
- Create: `metaplatform-frontend/tests/e2e/control-plane.spec.ts`
- Create: `mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_recovery.py`
- Modify: `mate-platform-backend/contracts/tests/test_openapi_ci.py`

**Interfaces:**

- Consumes pinned image/config Digests for PostgreSQL, Supabase-compatible auth test issuer, Keycloak, IAM, OpenFGA and OPA.
- Produces E2E evidence for profile bootstrap, SoD, delegation expiry, config rollback, projection revocation, independent restore and audit correlation.

- [ ] **Step 1: Write failing E2E/recovery assertions**

```python
def test_restore_reconciles_role_revocation_and_rejects_old_projection(restored_environment: Environment) -> None:
    old = restored_environment.issue_context("u-a", audience="hermes")
    restored_environment.revoke_role("u-a", "approver")
    restored_environment.restore_from_snapshot()
    assert restored_environment.bootstrap_with(old).status_code == 401
    assert restored_environment.audit_has("authorization.revoked", tenant_id="t-a")
```

- [ ] **Step 2: Run the test to verify it fails before runner implementation**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_recovery.py -q`

Expected: FAIL because the locked control-plane environment and restore fixture are absent.

- [ ] **Step 3: Implement the live runner and recovery fixture**

The PowerShell runner creates a uniquely named environment, verifies image digests before startup, applies Alembic, initializes test-only Supabase/Keycloak trust, and exports only ephemeral non-secret endpoints. It runs Playwright against Profile, Access and Tenant pages; creates two tenants; proves cross-tenant denial; runs SoD/delegation/config rollback; snapshots PostgreSQL and policy/config state; restores into an independent target; reconciles identity links, authorization watermarks and audit chain; then removes only its named resources in `finally`.

- [ ] **Step 4: Run the complete live evidence suite**

Run: `pwsh -File scripts/test-control-plane-e2e.ps1 -Mode run-all`

Expected: PASS with zero required-live skips; output records source/image/config digests, correlation IDs, restore RPO/RTO, rollback result and browser traces.

- [ ] **Step 5: Commit acceptance evidence tooling**

```bash
git add scripts/test-control-plane-e2e.ps1 acceptance/e2e/control-plane-environment.lock.yaml metaplatform-frontend/tests/e2e/control-plane.spec.ts mate-platform-backend/packages/mate-tech-iam/tests/test_control_plane_recovery.py mate-platform-backend/contracts/tests/test_openapi_ci.py
git commit -m "test(control): verify identity authorization and recovery evidence"
```

## Self-Review

- Personal center coverage: UserProfile, preferences/candidates, saved views and minimum context projection are covered by Tasks 1, 3 and 4.
- Organization/identity/permission coverage: users, organization units, dynamic roles, permissions, relationship tuples, policy, SoD, delegations, service principals and access reviews are persisted in Task 2 and exposed/tested in Tasks 3–5.
- Tenant/configuration coverage: tenant/domain/config release, flags, quota, dictionary, notification and retention objects are lifecycle resources in Tasks 2–4; Task 5 proves rollback and restore.
- Interface coverage: the matrix enumerates REST/OpenAPI, CloudEvents, UI and host projection surfaces; Tasks 1, 3, 4 and 5 respectively test schemas, routes, UI and live consumers.
- Authority coverage: Runtime/Artifact/Host ownership is explicitly excluded; only TTL-bound user projections leave the control plane.
- Placeholder scan: this plan contains no deferred work markers, no generic test instruction, and every implementation task names files, interfaces, tests, commands and commits.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-01-metaplatform-control-plane-v1.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, with checkpoints.

Which approach?
