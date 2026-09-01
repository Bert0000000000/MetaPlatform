# MetaPlatform Database Release and Upgrade Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before PI-1 can use a production-equivalent path, establish one signed, least-privilege database-release and Supabase Auth → Keycloak identity path that can migrate, recover, reconcile, roll back, and prove evidence freshness in both cloud and connected-private environments.

**Architecture:** This is a PI-0 release blocker, not a PI-6 hardening task. A declarative database-safety contract ties the production profile, migration image, identity authority, compatibility window, recovery targets and environment-bound evidence together; CI rejects unsafe source paths before a deployable feature can be admitted. A dedicated Alembic Job is the only schema writer, while ordinary application services use runtime DML only and obtain a tenant-scoped Runtime Token through the single Supabase Auth → Keycloak broker path.

**Tech Stack:** Python 3.12, pytest, JSON Schema, YAML, Alembic, PostgreSQL/CloudNativePG, Barman Cloud Plugin, Helm, Kubernetes/RKE2, Supabase Auth, Keycloak, Cosign, Syft, Trivy, OpenTelemetry, PowerShell.

**Spec:** `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md`; `docs/superpowers/plans/2026-09-01-metaplatform-first-release-closure.md`; `docs/superpowers/plans/2026-09-01-metaplatform-agile-program-delivery.md`; `docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md`

## Global Constraints

- This plan must be complete and its PI-0 admission Gate must be `PASSED` before PI-1 real E2E, production-equivalent deployment, or a production schema mutation.
- Human identity authority is Supabase Auth; Keycloak is only the broker, Token Exchange issuer and service/runtime-client authority. Legacy IAM may be dual-read only during the signed compatibility window and is never a runtime authorization fact.
- Only the digest-pinned, Cosign-verified, least-privilege Alembic Job may mutate production schema. Runtime application images, service startup paths and repository source may not contain `create_all(` or `InMemoryOutboxWriter` in a production path.
- Every enabled component is pinned by image and configuration Digest and has an owner, RPO, RTO, rollback object and current `PASSED` Gate. `NOT_EXERCISED`, tag-only, mock or stale evidence is not production evidence.
- Migration evidence is bound to an immutable environment identity: topology class, cluster UID, account or customer identifier, region or site, database cluster UID, backup domain ID, profile Digest and tested migration-image Digest. Evidence expires when any binding changes or after the declared `valid_until` timestamp.
- Schema evolution follows expand → compatibility verification → backfill/reconciliation → consumer cutover → contract. A destructive contract migration is forbidden until the N/N-1 client matrix and tested rollback permit it.
- The migration runner creates and destroys only its own test namespaces, Jobs and temporary clusters; it does not delete pre-existing tenant data or customer infrastructure.

---

## File Structure

- `acceptance/release/v1/database-safety.schema.json`: schema for the signed database/identity safety contract and environment-bound proof references.
- `acceptance/release/v1/database-safety.yaml`: release-owned contract for the selected production profile.
- `acceptance/release/v1/migration-chain.yaml`: canonical single-head revision/down_revision, aggregate/table owner, phase, execution PI and rollback-test registry from 0015 through 0027.
- `scripts/verify-database-release-safety.py`: static contract, source-ban, digest and evidence-freshness verifier.
- `scripts/test-database-release.ps1`: the only live migration/upgrade/PITR runner; calls the locked plan-tool image and records JUnit, manifest and reconciliation evidence.
- `infra/helm/charts/alembic-migration-job/*`: isolated migration Job image, service account, RBAC, NetworkPolicy and Job template.
- `infra/alembic/migration-release-policy.yaml`: allowed revision chain, expand/contract phase, compatibility window and rollback target metadata.
- `mate-platform-backend/services/auth-service/src/mate_auth_service/supabase_broker.py`: Supabase issuer validation and Keycloak token-exchange adapter.
- `mate-platform-backend/services/auth-service/src/mate_auth_service/legacy_iam_retirement.py`: compatibility-window enforcement and legacy-route rejection.
- `mate-platform-backend/tests/architecture/test_database_release_safety.py`: source-ban, contract and evidence-validity tests.
- `mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py`: identity-chain and retirement tests.
- `mate-platform-backend/tests/compatibility/test_database_n_minus_one.py`: expand/contract and mixed-version client tests.
- `mate-platform-backend/tests/recovery/test_database_release_pitr.py`: independent-domain PITR, RPO/RTO and reconciliation tests.

### Task 1: Create the PI-0 database-safety contract and admission verifier

**Files:**
- Create: `acceptance/release/v1/database-safety.schema.json`
- Create: `acceptance/release/v1/database-safety.yaml`
- Create: `acceptance/release/v1/migration-chain.yaml`
- Create: `scripts/verify-database-release-safety.py`
- Create: `mate-platform-backend/tests/architecture/test_database_release_safety.py`
- Modify: `.github/workflows/ga-acceptance.yml`

**Interfaces:**
- Produces: `DatabaseSafetyContract { profile_digest: str, identity_authority: "supabase-auth", token_broker: "keycloak", migration: MigrationAuthority, environments: list[EvidenceEnvironment], compatibility: CompatibilityWindow, recovery: RecoveryTarget, evidence: list[EvidenceRef] }`; PI-1 admission requires distinct cloud and connected-private receipts.
- Produces: `verify_database_safety(contract_path: Path, repository_root: Path, now: datetime) -> VerificationResult` where `VerificationResult.status` is `PASSED` or `FAILED` and `codes: set[str]`.
- Consumes: `acceptance/release/v1/production-profile.yaml`, `acceptance/gates/component-matrix.yaml`, and `acceptance/toolchain.lock.yaml`; validates the canonical migration chain and unique table/API/event ownership.

- [ ] **Step 1: Write failing contract and source-ban tests**

```python
def test_pi0_contract_rejects_legacy_identity_runtime_ddl_and_stale_evidence(tmp_path):
    contract = write_contract(
        tmp_path,
        identity_authority="legacy-iam",
        evidence_valid_until="2026-09-01T00:00:00Z",
    )
    add_production_source(tmp_path, "app.py", "Base.metadata.create_all(engine)")
    result = verify_database_safety(contract, tmp_path, now=utc("2026-09-02T00:00:00Z"))
    assert result.codes == {
        "IDENTITY_AUTHORITY_INVALID",
        "PRODUCTION_RUNTIME_DDL_FORBIDDEN",
        "EVIDENCE_EXPIRED",
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_database_release_safety.py::test_pi0_contract_rejects_legacy_identity_runtime_ddl_and_stale_evidence -q`

Expected: FAIL because `verify_database_safety` and the contract schema do not exist.

- [ ] **Step 3: Implement the schema and verifier**

```python
FORBIDDEN_PRODUCTION_TOKENS = ("create_all(", "InMemoryOutboxWriter", "LEGACY_LOGIN_COMPAT=true")

def verify_database_safety(contract_path: Path, repository_root: Path, now: datetime) -> VerificationResult:
    contract = load_and_validate(contract_path, "acceptance/release/v1/database-safety.schema.json")
    codes = validate_authority(contract) | scan_production_sources(repository_root, FORBIDDEN_PRODUCTION_TOKENS)
    codes |= validate_environment_bindings(contract["environments"], contract["evidence"], now)
    codes |= validate_profile_digests(contract)
    return VerificationResult("PASSED" if not codes else "FAILED", codes)
```

Require each `environments` entry to contain `topology_class`, `cluster_uid`, `tenant_or_account_id`, `region_or_site`, `database_cluster_uid`, `backup_domain_id`, `profile_digest`, `migration_image_digest` and `valid_until`. Require the exact topology set `{cloud, connected-private}` and one independently signed schema-foundation receipt per topology. Require every evidence reference to repeat its environment Digest and reject a changed profile, migration image, cluster UID, topology or expired timestamp. Validate migration-chain.yaml as one head with no duplicate revision, table/column owner, OpenAPI path or event topic and with every down_revision present.

- [ ] **Step 4: Run the architecture test and CI verifier**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_database_release_safety.py -q`

Run: `mate-platform-backend/.venv/Scripts/python.exe scripts/verify-database-release-safety.py acceptance/release/v1/database-safety.yaml`

Expected: PASS only for a Supabase Auth authority, Keycloak broker, current locked Digests, no forbidden production source paths and unexpired environment-bound evidence.

- [ ] **Step 5: Make PI admission depend on the verifier**

```yaml
- name: Verify PI-0 database and identity safety
  run: mate-platform-backend/.venv/Scripts/python.exe scripts/verify-database-release-safety.py acceptance/release/v1/database-safety.yaml
```

Place this job before every job that accepts a PI-1 Sprint commitment or updates a production-equivalent release evidence file. `admit_pi1()` must fail unless both topology-specific 0015 → 0026 → rollback → 0026 receipts are current and bound to the same production-profile and migration-image Digests.

- [ ] **Step 6: Commit the PI-0 admission contract**

```bash
git add acceptance/release/v1/database-safety.schema.json acceptance/release/v1/database-safety.yaml acceptance/release/v1/migration-chain.yaml scripts/verify-database-release-safety.py mate-platform-backend/tests/architecture/test_database_release_safety.py .github/workflows/ga-acceptance.yml
git commit -m "test(release): block PI-1 on database identity safety"
```

### Task 2: Build the signed least-privilege Alembic release Job

**Files:**
- Create: `infra/helm/charts/alembic-migration-job/Chart.yaml`
- Create: `infra/helm/charts/alembic-migration-job/values.yaml`
- Create: `infra/helm/charts/alembic-migration-job/templates/serviceaccount.yaml`
- Create: `infra/helm/charts/alembic-migration-job/templates/role.yaml`
- Create: `infra/helm/charts/alembic-migration-job/templates/networkpolicy.yaml`
- Create: `infra/helm/charts/alembic-migration-job/templates/job.yaml`
- Create: `infra/alembic/migration-release-policy.yaml`
- Create: `scripts/build-and-sign-migration-image.ps1`
- Create: `mate-platform-backend/tests/security/test_alembic_migration_job_policy.py`

**Interfaces:**
- Produces: `MigrationAuthority { image_digest: str, signer_identity: str, service_account: str, allowed_revisions: list[str], database_role: str, profile_digest: str }`.
- Produces: `assert_migration_job_policy(rendered: str) -> set[str]`, returning violations such as `MIGRATION_JOB_PRIVILEGE_TOO_BROAD` or `MIGRATION_IMAGE_UNSIGNED`.
- Consumes: `DatabaseSafetyContract.migration` from Task 1 and the OCI signature/SBOM verifier from the production Gate plan.

- [ ] **Step 1: Write failing least-privilege Job tests**

```python
def test_migration_job_rejects_unsigned_image_and_broad_service_account():
    rendered = render_chart(image="registry/migrate:latest", cluster_role="cluster-admin")
    assert assert_migration_job_policy(rendered) == {
        "MIGRATION_IMAGE_DIGEST_REQUIRED",
        "MIGRATION_JOB_PRIVILEGE_TOO_BROAD",
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/security/test_alembic_migration_job_policy.py -q`

Expected: FAIL because the chart and policy verifier do not exist.

- [ ] **Step 3: Implement the isolated Job and signing policy**

```yaml
serviceAccount:
  name: metaplatform-alembic-release
job:
  image: "{{ .Values.image.repository }}@{{ required \"image.digest is required\" .Values.image.digest }}"
  command: ["alembic", "upgrade", "head"]
databaseRole: metaplatform_migrator
networkPolicy:
  allowEgress:
    - database
    - openbao
    - oci-registry
```

The role may alter only approved tenant database schemas and may not read business tables except metadata needed by a revision. The Job must verify Cosign signature, SBOM and policy-bound image Digest before executing `alembic upgrade`; it records the previous revision, target revision, profile Digest, environment identity and migration receipt.

- [ ] **Step 4: Run policy and rendering checks**

Run: `pwsh -File scripts/run-plan-tool.ps1 -- sh -lc "helm template alembic-migration infra/helm/charts/alembic-migration-job | kubeconform -strict -summary"`

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/security/test_alembic_migration_job_policy.py -q`

Expected: PASS; the rendered Job uses a Digest image, a namespace-scoped role, default-deny network policy and no runtime service account credentials.

- [ ] **Step 5: Commit the migration authority**

```bash
git add infra/helm/charts/alembic-migration-job infra/alembic/migration-release-policy.yaml scripts/build-and-sign-migration-image.ps1 mate-platform-backend/tests/security/test_alembic_migration_job_policy.py
git commit -m "feat(release): add signed least-privilege migration job"
```

### Task 3: Establish the single Supabase Auth → Keycloak identity path and retire legacy IAM

**Files:**
- Modify: `infra/helm/charts/supabase-auth/values.yaml`
- Modify: `infra/helm/charts/keycloak/values.yaml`
- Modify: `infra/keycloak/realm/identity-broker.json`
- Create: `mate-platform-backend/services/auth-service/src/mate_auth_service/supabase_broker.py`
- Create: `mate-platform-backend/services/auth-service/src/mate_auth_service/legacy_iam_retirement.py`
- Create: `mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py`
- Create: `mate-platform-backend/tests/security/test_runtime_token_claims.py`
- Modify: `acceptance/gates/identity-supabase-keycloak.yaml`

**Interfaces:**
- Produces: `exchange_supabase_identity(id_token: str, audience: str) -> RuntimeToken`.
- Produces: `reject_legacy_iam_request(path: str, now: datetime, compatibility_until: datetime) -> None`, raising `LegacyIdentityRetired` after the window.
- `RuntimeToken` contains `iss`, `sub`, `tenant_id`, `actor_id`, `aud`, `exp`, `jti`, `policy_watermark` and `assignment_watermark`; it never contains a Supabase refresh token or a legacy-IAM entitlement.

- [ ] **Step 1: Write failing issuer, mapping and retirement tests**

```python
def test_only_supabase_subject_can_exchange_and_legacy_route_closes_after_window():
    with pytest.raises(InvalidIssuer):
        exchange_supabase_identity(token(issuer="legacy-iam"), audience="runtime")
    with pytest.raises(LegacyIdentityRetired):
        reject_legacy_iam_request("/api/iam/login", utc("2026-10-01"), utc("2026-09-30"))
```

- [ ] **Step 2: Run the identity tests to verify they fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py mate-platform-backend/tests/security/test_runtime_token_claims.py -q`

Expected: FAIL because the broker adapter and retirement guard do not exist.

- [ ] **Step 3: Implement issuer validation, broker exchange and route retirement**

```python
def exchange_supabase_identity(id_token: str, audience: str) -> RuntimeToken:
    claims = verify_jwt(id_token, expected_issuer=settings.supabase_issuer, required_audience="authenticated")
    subject = stable_subject(issuer=claims["iss"], sub=claims["sub"])
    return keycloak_token_exchange(subject=subject, tenant_id=claims["tenant_id"], audience=audience)
```

Remove legacy IAM login, entitlement lookup and authorization facts from runtime routes and OpenAPI documents when `compatibility_until` expires. During the approved dual-read window, legacy identity may be used only to map an already-linked `(issuer, sub)` pair; it cannot create a grant, role, policy tuple or Runtime Token claim.

- [ ] **Step 4: Run identity and live Gate checks**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py mate-platform-backend/tests/security/test_runtime_token_claims.py -q`

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate identity-supabase-keycloak -WithDependencies`

Expected: PASS only when MFA/revocation, stable `(issuer, sub)` mapping, token exchange, tenant isolation, expiry and legacy-route retirement are tested against the locked identity images.

- [ ] **Step 5: Commit the identity authority convergence**

```bash
git add infra/helm/charts/supabase-auth/values.yaml infra/helm/charts/keycloak/values.yaml infra/keycloak/realm/identity-broker.json mate-platform-backend/services/auth-service/src/mate_auth_service/supabase_broker.py mate-platform-backend/services/auth-service/src/mate_auth_service/legacy_iam_retirement.py mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py mate-platform-backend/tests/security/test_runtime_token_claims.py acceptance/gates/identity-supabase-keycloak.yaml
git commit -m "feat(identity): converge runtime onto supabase keycloak chain"
```

### Task 4: Prove expand/contract, N/N-1 compatibility and rollback

PI-0 freezes, implements and applies the complete 0016–0026 schema-only expand chain as one backward-compatible foundation in both production-equivalent topologies. PI-1 through PI-5 activate their services, routes and Feature Flags only after their own Gate/compatibility checks; they do not defer a required predecessor migration until feature activation. The destructive 0027 contract revision is created and exercised only in PI-6 after all N/N-1 consumers and the legacy-IAM window are closed.

**Files:**
- Create: `mate-platform-backend/alembic/versions/20260901_0027_contract_legacy_iam.py` (revision = 0027_contract_legacy_iam; down_revision = 0026_deployment_operations_v1)
- Create: `mate-platform-backend/tests/compatibility/test_database_n_minus_one.py`
- Create: `mate-platform-backend/tests/recovery/test_database_release_rollback.py`
- Create: `mate-platform-backend/tests/migrations/test_canonical_migration_chain.py`
- Modify: `acceptance/release/v1/migration-chain.yaml`
- Modify: `infra/alembic/migration-release-policy.yaml`
- Modify: `scripts/test-database-release.ps1`

**Interfaces:**
- Produces: `upgrade_release(from_revision: str, to_revision: str, client_version: str, environment: EvidenceEnvironment) -> MigrationReceipt` where the receipt binds topology, environment/profile/migration-image Digests, from/to revisions, rollback/re-apply result and validity.
- Produces: `reconcile_release_state(expected: ReleaseSnapshot, actual: ReleaseSnapshot) -> ReconciliationResult`.
- Consumes: Task 2 `MigrationAuthority` and Task 3 stable subject mapping.

- [ ] **Step 1: Write failing mixed-version and forbidden-contract tests**

```python
def test_contract_revision_is_refused_while_n_minus_one_client_uses_legacy_column(cluster):
    cluster.upgrade("0026_deployment_operations_v1")
    assert cluster.client("n-1").read_legacy_identity_link().status_code == 200
    with pytest.raises(CompatibilityWindowOpen):
        cluster.upgrade("0027_contract_legacy_iam")

def test_migration_evidence_requires_both_current_topologies(receipts):
    result = validate_migration_receipts(receipts.only("cloud-preproduction"))
    assert result.codes == {"MIGRATION_TOPOLOGY_EVIDENCE_MISSING"}
```

- [ ] **Step 2: Run the compatibility tests to verify they fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/compatibility/test_database_n_minus_one.py mate-platform-backend/tests/recovery/test_database_release_rollback.py -q`

Expected: FAIL because the revision metadata, live runner and compatibility guard do not exist.

- [ ] **Step 3: Implement explicit phase policy and reversible release execution**

```yaml
revisions:
  - revision: "0020_event_inbox_dlq"
    down_revision: "0019_ontology_operations"
    phase: existing-head
  - revision: "0021_control_plane_v1"
    down_revision: "0020_event_inbox_dlq"
    phase: expand
  - revision: "0022_runtime_employee_host_v1"
    down_revision: "0021_control_plane_v1"
    phase: expand
  - revision: "0023_artifact_application_output"
    down_revision: "0022_runtime_employee_host_v1"
    phase: expand
  - revision: "0024_ontology_skill_mcp"
    down_revision: "0023_artifact_application_output"
    phase: expand
  - revision: "0025_action_data_knowledge_memory_v1"
    down_revision: "0024_ontology_skill_mcp"
    phase: expand
  - revision: "0026_deployment_operations_v1"
    down_revision: "0025_action_data_knowledge_memory_v1"
    phase: expand
  - revision: "0027_contract_legacy_iam"
    down_revision: "0026_deployment_operations_v1"
    phase: contract
    requires: ["n-1-retired", "legacy-iam-window-closed", "reconciliation-passed"]
    rollback_to: "0026_deployment_operations_v1"
```

The migration-chain schema and `test_canonical_migration_chain.py` require the exact receipt pair `{cloud-preproduction, connected-private-preproduction}` for each applicable phase. Each receipt independently binds profile, environment and migration-image Digests and must be current; a missing, stale or cross-environment receipt returns `MIGRATION_TOPOLOGY_EVIDENCE_MISSING`. The PI-0 runner must create a pre-migration snapshot, apply 0016–0026, restart the current/legacy application image, prove all future services/routes/Feature Flags remain disabled, compare row counts/checksums/identity links, perform a bounded rollback and re-apply 0026. The PI-6 runner restarts N/N-1 application images, validates retirement/reconciliation and only then permits 0027 contract. A failed precondition performs no contract DDL. A rollback restores the previous compatible application and schema state without creating a new identity authority. GA consumes the current receipt pair rather than inferring equivalence from one topology.

- [ ] **Step 4: Execute the live upgrade and rollback runner**

Run (PI-0 schema foundation): `pwsh -File scripts/test-database-release.ps1 -Chain acceptance/release/v1/migration-chain.yaml -FromRevision 0015_merge_migration_heads -ToRevision 0026_deployment_operations_v1 -Topology cloud-preproduction -ExerciseRollback -RequireFutureFeaturesDisabled`

Run (PI-0 schema foundation): `pwsh -File scripts/test-database-release.ps1 -Chain acceptance/release/v1/migration-chain.yaml -FromRevision 0015_merge_migration_heads -ToRevision 0026_deployment_operations_v1 -Topology connected-private-preproduction -ExerciseRollback -RequireFutureFeaturesDisabled`

Run (PI-6 contract): `pwsh -File scripts/test-database-release.ps1 -Chain acceptance/release/v1/migration-chain.yaml -FromRevision 0026_deployment_operations_v1 -ToRevision 0027_contract_legacy_iam -Topology cloud-preproduction -ExerciseRollback -RequireNMinusOneRetired`

Run (PI-6 contract): `pwsh -File scripts/test-database-release.ps1 -Chain acceptance/release/v1/migration-chain.yaml -FromRevision 0026_deployment_operations_v1 -ToRevision 0027_contract_legacy_iam -Topology connected-private-preproduction -ExerciseRollback -RequireNMinusOneRetired`

Expected: PI-0 PASS only if both independently identified topologies prove 0016–0026 form one compatible head, current/legacy traffic remains healthy, future Features remain unavailable and rollback/re-apply succeeds. PI-6 PASS only if both topologies prove N/N-1 is retired, contract waits for all prerequisites, reconciliation is exact and the declared rollback returns a healthy compatible state.

- [ ] **Step 5: Commit compatibility and rollback proof**

```bash
git add mate-platform-backend/alembic/versions/20260901_0027_contract_legacy_iam.py mate-platform-backend/tests/compatibility/test_database_n_minus_one.py mate-platform-backend/tests/recovery/test_database_release_rollback.py mate-platform-backend/tests/migrations/test_canonical_migration_chain.py acceptance/release/v1/migration-chain.yaml infra/alembic/migration-release-policy.yaml scripts/test-database-release.ps1
git commit -m "test(database): prove expand contract compatibility and rollback"
```

### Task 5: Exercise independent-domain PITR, RPO/RTO and business reconciliation

**Files:**
- Create: `acceptance/gates/environments/database-recovery-two-domain.yaml`
- Create: `mate-platform-backend/tests/recovery/test_database_release_pitr.py`
- Create: `scripts/collect-database-reconciliation-evidence.py`
- Modify: `acceptance/release/v1/database-safety.yaml`
- Modify: `acceptance/gates/cnpg-barman-backup.yaml`

**Interfaces:**
- Produces: `RecoveryEvidence { environment_digest: str, backup_domain_id: str, restore_cluster_uid: str, recovery_point: datetime, achieved_rpo_seconds: int, achieved_rto_seconds: int, reconciliation_digest: str, valid_until: datetime }`.
- Produces: `reconcile_business_facts(before: ReleaseSnapshot, after: ReleaseSnapshot) -> ReconciliationResult` with `duplicate_side_effects`, `missing_artifacts`, `identity_mismatches` and `audit_chain_breaks`.
- Consumes: Task 1 environment binding and Task 4 migration receipts.

- [ ] **Step 1: Write failing recovery-domain and objective tests**

```python
def test_recovery_evidence_rejects_same_failure_domain_and_rto_breach():
    evidence = recovery_evidence(primary_domain="zone-a", backup_domain="zone-a", achieved_rto_seconds=901)
    result = validate_recovery(evidence, target_rpo_seconds=60, target_rto_seconds=900)
    assert result.codes == {"BACKUP_DOMAIN_NOT_INDEPENDENT", "RTO_BREACH"}
```

- [ ] **Step 2: Run recovery tests to verify they fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/recovery/test_database_release_pitr.py -q`

Expected: FAIL because recovery evidence validation and reconciliation collection do not exist.

- [ ] **Step 3: Implement independent-domain restore and reconciliation collection**

```python
def reconcile_business_facts(before: ReleaseSnapshot, after: ReleaseSnapshot) -> ReconciliationResult:
    return ReconciliationResult(
        duplicate_side_effects=diff(before.receipt_ids, after.receipt_ids).duplicates,
        missing_artifacts=diff(before.artifact_digests, after.artifact_digests).missing,
        identity_mismatches=diff(before.identity_links, after.identity_links).changed,
        audit_chain_breaks=verify_audit_chain(after.audit_records),
    )
```

Require a backup object endpoint, credentials and attested domain identity distinct from the primary database domain. Restore to a new cluster in that independent domain at a recorded point in time; measure RPO/RTO against the contract, then reconcile Run Ledger, Artifact references, approvals/receipts, `(issuer, sub)` links, policy watermarks and audit chain.

- [ ] **Step 4: Run the live PITR Gate**

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate cnpg-barman-backup -WithDependencies -EnvironmentProfile acceptance/gates/environments/database-recovery-two-domain.yaml`

Expected: PASS only with distinct attested domains, a new restored cluster, achieved RPO/RTO within contract, exact reconciliation and fresh environment-bound evidence.

- [ ] **Step 5: Commit recovery evidence support**

```bash
git add acceptance/gates/environments/database-recovery-two-domain.yaml mate-platform-backend/tests/recovery/test_database_release_pitr.py scripts/collect-database-reconciliation-evidence.py acceptance/release/v1/database-safety.yaml acceptance/gates/cnpg-barman-backup.yaml
git commit -m "test(recovery): bind database pitr evidence to independent domain"
```

### Task 6: Close the PI-0 blocker and enforce evidence invalidation

**Files:**
- Modify: `scripts/verify-database-release-safety.py`
- Modify: `acceptance/release/v1/database-safety.yaml`
- Modify: `acceptance/release/v1/sprint-board.yaml`
- Modify: `acceptance/release/v1/requirements.yaml`
- Modify: `.github/workflows/ga-acceptance.yml`
- Create: `mate-platform-backend/tests/architecture/test_database_safety_pi0_admission.py`

**Interfaces:**
- Produces: `admit_pi1(board: SprintBoard, safety: VerificationResult, identity_gate: GateResult, recovery: RecoveryEvidence, topology_receipts: dict[Topology, MigrationReceipt]) -> AdmissionResult`.
- `AdmissionResult.status` is `ADMITTED` only when all inputs are current and `PASSED`; otherwise it is `BLOCKED` with stable failure codes.

- [ ] **Step 1: Write the failing PI-1 admission test**

```python
def test_pi1_is_blocked_when_identity_recovery_or_topology_receipts_are_incomplete():
    result = admit_pi1(
        board(), safety=passed(), identity_gate=gate("NOT_EXERCISED"),
        recovery=expired_recovery(),
        topology_receipts={"cloud-preproduction": current_receipt()},
    )
    assert result.codes == {
        "IDENTITY_GATE_NOT_PASSED",
        "RECOVERY_EVIDENCE_EXPIRED",
        "MIGRATION_TOPOLOGY_EVIDENCE_MISSING",
    }

def test_pi1_rejects_mismatched_or_expired_topology_receipts():
    receipts = receipt_pair(connected_private_profile_digest="wrong", cloud_expired=True)
    assert admit_pi1(board(), passed(), gate("PASSED"), current_recovery(), receipts).codes == {
        "MIGRATION_RECEIPT_DIGEST_MISMATCH", "MIGRATION_RECEIPT_EXPIRED"
    }
```

- [ ] **Step 2: Run the admission test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_database_safety_pi0_admission.py -q`

Expected: FAIL because the PI-0 admission rule does not exist.

- [ ] **Step 3: Implement the closed PI-0 admission rule**

```python
def admit_pi1(board, safety, identity_gate, recovery, topology_receipts):
    codes = set()
    if safety.status != "PASSED": codes.add("DATABASE_SAFETY_NOT_PASSED")
    if identity_gate.status != "PASSED": codes.add("IDENTITY_GATE_NOT_PASSED")
    if recovery.valid_until <= utcnow(): codes.add("RECOVERY_EVIDENCE_EXPIRED")
    codes |= validate_migration_receipts(
        topology_receipts,
        required_topologies={"cloud-preproduction", "connected-private-preproduction"},
        required_path=("0015_merge_migration_heads", "0026_deployment_operations_v1", "rollback", "0026_deployment_operations_v1"),
        profile_digest=board.production_profile_digest,
        config_digest=board.config_digest,
        now=utcnow(),
    ).codes
    return AdmissionResult("ADMITTED" if not codes else "BLOCKED", codes)
```

Invalidate the PI-0 result whenever the production-profile Digest, migration-image Digest, Supabase/Keycloak image Digest, cluster identity, backup domain, revision chain or compatibility-window signature changes. CI must mark affected PI-1 Stories blocked until fresh live evidence is recorded.

- [ ] **Step 4: Run the complete PI-0 evidence suite**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_database_release_safety.py mate-platform-backend/tests/architecture/test_database_safety_pi0_admission.py mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py mate-platform-backend/tests/compatibility/test_database_n_minus_one.py mate-platform-backend/tests/recovery/test_database_release_pitr.py -q`

Run: `mate-platform-backend/.venv/Scripts/python.exe scripts/verify-database-release-safety.py acceptance/release/v1/database-safety.yaml`

Expected: PASS only for current, environment-bound, live migration, identity, recovery and reconciliation proof.

- [ ] **Step 5: Commit PI-0 database-release closure**

```bash
git add scripts/verify-database-release-safety.py acceptance/release/v1/database-safety.yaml acceptance/release/v1/sprint-board.yaml acceptance/release/v1/requirements.yaml .github/workflows/ga-acceptance.yml mate-platform-backend/tests/architecture/test_database_safety_pi0_admission.py
git commit -m "test(release): close database safety PI-0 blocker"
```

## Self-Review

- PI-0 blocking, signed least-privilege Alembic authority and production-source bans are implemented by Tasks 1, 2 and 6.
- Supabase Auth → Keycloak authority, legacy IAM retirement and token constraints are implemented by Task 3.
- Expand/contract, N/N-1, rollback, PITR, RPO/RTO, reconciliation, environment binding and evidence expiry are implemented by Tasks 4–6.
- No task treats mock, local-only, `NOT_EXERCISED` or stale evidence as a pass.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task and review between tasks.
2. **Inline Execution** — execute tasks in this session using executing-plans, with checkpoints.
