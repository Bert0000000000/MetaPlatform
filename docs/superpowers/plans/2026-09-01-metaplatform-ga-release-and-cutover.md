# MetaPlatform GA Release and Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the final-candidate, cross-interface, business-regression, host-compatibility and target-environment promotion process that makes `platform-ga` the sole, evidence-backed GO/NO-GO decision for MetaPlatform.

**Architecture:** The GA process consumes only immutable release inputs: a signed final-candidate manifest, the release requirements matrix, production profile, interface registry, component Gate DAG and named live evidence. It validates every declared interface provider/consumer before promotion, exercises every first-release module operation and business MVP, and separately promotes cloud and connected-private targets through a bounded slice, observation window and declared rollback. `platform-ga` can become `PASSED` only after all validators, live operations evidence and named accountability signatures are current; it is not a deployment command and cannot be set by a mock, local Compose run or manual YAML edit.

**Tech Stack:** Python 3.12, pytest, JSON Schema, YAML, PowerShell, Playwright, OpenAPI, MCP, A2A, Cosign, Syft, Trivy, OpenTelemetry, Prometheus, Alertmanager, Helm, Flux CD, Kubernetes/RKE2, CloudNativePG/Barman Cloud Plugin.

**Spec:** `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md`; `docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md`; `docs/superpowers/plans/2026-09-01-metaplatform-first-release-closure.md`; `docs/superpowers/plans/2026-09-01-metaplatform-agile-program-delivery.md`; `docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md`

## Global Constraints

- `platform-ga` is the only formal GO/NO-GO authority. A Sprint Done, PI Exit, component health check, mock E2E or `NOT_EXERCISED` Gate cannot substitute for it.
- Every manifest and proof is pinned to release ID, Git SHA, toolchain Digest, production-profile Digest, component image/config Digests and target environment identity. A changed input invalidates the candidate and requires a fresh run.
- The final candidate must cover the 15 first-release module groups, their authoritative objects and lifecycle operations, all declared API/MCP/A2A/event/workflow interfaces, the four business MVPs and all supported hosts.
- The release supports cloud production and connected-private deployment with the same TenantRuntime package. Each topology receives its own target identity, promotion evidence, observation window and rollback receipt. Disconnected Cell is included only when its separate Gate and profile row are `PASSED`.
- Four hosts—Codex, Claude Code, DeepSeek Harness and Hermes—must be tested as independently version-pinned HostCapabilityContract entries across both required topologies: a strict 4 × 2 matrix with eight independent evidence rows. Unsupported optional MCP Apps may fall back to `structuredContent`, Markdown/HTML and Artifact links; native dynamic per-employee plugin installation is never assumed.
- Supply-chain evidence must reject any Critical vulnerability. High vulnerabilities require a named security owner, compensating control, remediation SLA of no more than 30 calendar days, explicit expiry and release-owner approval; expired exceptions are `NO-GO`. All other license, signature, SBOM and revocation checks remain mandatory.
- A production promotion may only touch allowlisted target namespaces/tenants or traffic slices after the candidate verifier passes. The runner records every decision, SLO/error-budget result, alert state and rollback outcome; it does not mutate `platform-ga` to `PASSED` itself.

---

## File Structure

- `acceptance/release/v1/final-candidate.schema.json`: immutable final-candidate manifest schema.
- `acceptance/release/v1/final-candidate.yaml`: signed release candidate referencing all release Digests and current proof.
- `acceptance/release/v1/interface-registry.schema.json`: every externally observable interface contract, provider, consumer, schema/version and required verification.
- `acceptance/release/v1/interface-registry.yaml`: actual release interface registry, including OpenAPI, MCP, A2A, NATS, Temporal and UI/API surfaces.
- `acceptance/release/v1/module-operations.schema.json`: 15 module authoritative-object and lifecycle-operation regression matrix.
- `acceptance/release/v1/module-operations.yaml`: first-release operation vectors and expected audit/evidence results.
- `acceptance/release/v1/host-capability-contract.schema.json`: standalone four-host compatibility Gate schema.
- `acceptance/release/v1/host-capability-contract.yaml`: version-pinned Codex, Claude Code, DSH and Hermes results.
- `acceptance/release/v1/security-exceptions.schema.json`: vulnerability exception, owner, control, SLA and expiry schema.
- `acceptance/release/v1/security-exceptions.yaml`: only active approved exceptions for the candidate.
- `acceptance/release/v1/promotion-evidence.yaml`: append-only cloud and connected-private promotion/observation/rollback receipts, each referencing the frozen candidate Digest.
- `scripts/verify-final-candidate.py`: validates all immutable inputs, security thresholds and evidence freshness.
- `scripts/verify-interface-registry.py`: checks that every interface has version-compatible providers and consumers and live verification evidence.
- `scripts/test-first-release-module-operations.ps1`: executes the 15 module lifecycle regression vectors and collects audit correlation IDs.
- `scripts/test-host-capability-contract.ps1`: runs the four independent host contracts against exact versions.
- `scripts/test-production-release-promotion.ps1`: runs topology-specific replay, slice promotion, observation and rollback.
- `scripts/verify-platform-ga.py`: performs the final aggregate GO/NO-GO calculation.
- `mate-platform-backend/tests/architecture/test_final_candidate.py`: candidate, security exception and evidence-expiry tests.
- `mate-platform-backend/tests/architecture/test_interface_registry.py`: provider/consumer and schema compatibility tests.
- `mate-platform-backend/tests/acceptance/test_module_operations_matrix.py`: operation matrix completeness tests.
- `mate-platform-backend/tests/compatibility/test_host_capability_contract.py`: four-host contract tests.
- `mate-platform-backend/tests/architecture/test_platform_ga_evidence.py`: final aggregate Gate tests.

### Task 1: Create the signed final-candidate and supply-chain admission policy

**Files:**
- Create: `acceptance/release/v1/final-candidate.schema.json`
- Create: `acceptance/release/v1/final-candidate.yaml`
- Create: `acceptance/release/v1/security-exceptions.schema.json`
- Create: `acceptance/release/v1/security-exceptions.yaml`
- Create: `scripts/verify-final-candidate.py`
- Create: `mate-platform-backend/tests/architecture/test_final_candidate.py`

**Interfaces:**
- Produces: `FinalCandidate { release_id: str, git_sha: str, toolchain_digest: str, profile_digest: str, requirements_digest: str, components: list[ComponentRef], evidence_valid_until: datetime }`.
- Produces: `verify_final_candidate(candidate: Path, exceptions: Path, now: datetime) -> VerificationResult`.
- `ComponentRef` contains `name`, `image_digest`, `config_digest`, `sbom_digest`, `signature_ref`, `license_result`, `vulnerability_result`, `gate_id` and `gate_evidence_digest`.

- [ ] **Step 1: Write failing immutable-candidate and security-threshold tests**

```python
def test_candidate_rejects_critical_cve_and_expired_high_exception():
    result = verify_final_candidate(
        candidate_with(vulnerabilities=[("CVE-1", "CRITICAL")]),
        exceptions_with("CVE-2", severity="HIGH", expires_at="2026-09-01T00:00:00Z"),
        now=utc("2026-09-02T00:00:00Z"),
    )
    assert result.codes == {"CRITICAL_VULNERABILITY", "SECURITY_EXCEPTION_EXPIRED"}
```

- [ ] **Step 2: Run the candidate test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_final_candidate.py -q`

Expected: FAIL because the schemas and verifier do not exist.

- [ ] **Step 3: Implement candidate immutability and security policy**

```python
def validate_vulnerabilities(items: list[Vulnerability], exceptions: dict[str, SecurityException], now: datetime) -> set[str]:
    codes = set()
    for item in items:
        if item.severity == "CRITICAL": codes.add("CRITICAL_VULNERABILITY")
        if item.severity == "HIGH" and not valid_high_exception(exceptions.get(item.cve), now):
            codes.add("HIGH_VULNERABILITY_UNAPPROVED")
    return codes
```

Require a High exception to include `security_owner`, `release_owner`, `compensating_control`, `remediation_due_at`, `expires_at`, `approval_signature` and a remediation due date no later than 30 days after candidate creation. Reject missing or revoked signatures, a tag-only image, missing SBOM/license proof, unsigned package, missing Gate or evidence whose profile/environment binding no longer matches.

- [ ] **Step 4: Run the candidate verifier**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_final_candidate.py -q`

Run: `mate-platform-backend/.venv/Scripts/python.exe scripts/verify-final-candidate.py acceptance/release/v1/final-candidate.yaml acceptance/release/v1/security-exceptions.yaml`

Expected: PASS only for an immutable fully signed candidate with no Critical CVE and only current, approved High exceptions.

- [ ] **Step 5: Commit final-candidate admission**

```bash
git add acceptance/release/v1/final-candidate.schema.json acceptance/release/v1/final-candidate.yaml acceptance/release/v1/security-exceptions.schema.json acceptance/release/v1/security-exceptions.yaml scripts/verify-final-candidate.py mate-platform-backend/tests/architecture/test_final_candidate.py
git commit -m "test(release): require immutable secure final candidate"
```

### Task 2: Build the all-interface provider/consumer registry and live verifier

**Files:**
- Create: `acceptance/release/v1/interface-registry.schema.json`
- Create: `acceptance/release/v1/interface-registry.yaml`
- Create: `scripts/verify-interface-registry.py`
- Create: `mate-platform-backend/tests/architecture/test_interface_registry.py`
- Modify: `acceptance/release/v1/requirements.yaml`

**Interfaces:**
- Produces: `InterfaceContract { id: str, protocol: Literal["openapi", "mcp", "a2a", "nats", "temporal", "ui", "host"], version: str, provider: ComponentRef, consumers: list[str], compatibility: str, verification: EvidenceRef }`.
- Produces: `verify_interface_registry(registry: Path, candidate: FinalCandidate) -> VerificationResult`.
- Consumes: `FinalCandidate.components`, release OpenAPI files, MCP schema snapshots, A2A Agent Cards, NATS event schemas and Temporal workflow interfaces.

- [ ] **Step 1: Write a failing provider/consumer completeness test**

```python
def test_registry_rejects_orphan_provider_and_incompatible_consumer():
    result = verify_interface_registry(registry_with(
        interface("mcp.orders.v1", provider="orders", consumers=[]),
        interface("event.run.v2", provider="runtime", consumers=["maintenance-v1"]),
    ), candidate())
    assert result.codes == {"INTERFACE_CONSUMER_MISSING", "INTERFACE_VERSION_INCOMPATIBLE"}
```

- [ ] **Step 2: Run the registry test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_interface_registry.py -q`

Expected: FAIL because the interface registry verifier does not exist.

- [ ] **Step 3: Implement registry validation and evidence binding**

```python
def verify_interface_registry(registry: Path, candidate: FinalCandidate) -> VerificationResult:
    interfaces = load_interfaces(registry)
    codes = set().union(*(validate_provider_consumer(i, candidate) for i in interfaces))
    codes |= set().union(*(validate_live_contract_evidence(i, candidate.profile_digest) for i in interfaces))
    return VerificationResult("PASSED" if not codes else "FAILED", codes)
```

Register each control API, management UI API, Runtime/Run/Lease contract, Artifact/Approval contract, MCP tool/resource/prompt schema, A2A delegation, NATS domain event, Temporal boundary, data/knowledge API and host connector projection. A `host` record must reference HostCapabilityContract ID, exact host/Connector version and Digest, topology/environment identity and that host consumer E2E. Require at least one declared consumer except true ingress interfaces explicitly marked `external_ingress`; require every consumer version range to contain the provider version and every live evidence reference to bind to the final candidate and target environment.

- [ ] **Step 4: Run registry validation**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_interface_registry.py -q`

Run: `mate-platform-backend/.venv/Scripts/python.exe scripts/verify-interface-registry.py acceptance/release/v1/interface-registry.yaml acceptance/release/v1/final-candidate.yaml`

Expected: PASS only when every required interface has a compatible provider, consumer and current live proof.

- [ ] **Step 5: Commit the interface release registry**

```bash
git add acceptance/release/v1/interface-registry.schema.json acceptance/release/v1/interface-registry.yaml scripts/verify-interface-registry.py mate-platform-backend/tests/architecture/test_interface_registry.py acceptance/release/v1/requirements.yaml
git commit -m "test(release): verify all interface providers and consumers"
```

### Task 3: Exercise every authoritative object and lifecycle operation across 15 modules

**Files:**
- Create: `acceptance/release/v1/module-operations.schema.json`
- Create: `acceptance/release/v1/module-operations.yaml`
- Create: `scripts/test-first-release-module-operations.ps1`
- Create: `mate-platform-backend/tests/acceptance/test_module_operations_matrix.py`
- Modify: `acceptance/release/v1/requirements.yaml`

**Interfaces:**
- Produces: `ModuleOperation { module: str, authority_object: str, operation: Literal["create", "read", "update", "publish", "revoke", "archive", "delete"], actor: str, tenant: str, expected_status: int, audit_event: str, rollback_or_recovery: str }`.
- Produces: `run_module_operations(matrix: Path, target: TargetEnvironment) -> list[OperationEvidence]`.
- Consumes: the 15 module Requirements, RBAC/ABAC policy, audit service and final candidate interface registry.

- [ ] **Step 1: Write failing 15-module and lifecycle completeness tests**

```python
def test_matrix_requires_all_first_release_modules_and_lifecycle_actions():
    result = validate_module_operations(matrix_for_modules(["数字员工中心"]))
    assert "MODULE_COVERAGE_INCOMPLETE" in result.codes
    assert "LIFECYCLE_OPERATION_MISSING" in result.codes
```

- [ ] **Step 2: Run the matrix test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/acceptance/test_module_operations_matrix.py -q`

Expected: FAIL because the operation schema and matrix validator do not exist.

- [ ] **Step 3: Implement the operation matrix and live runner**

```yaml
- module: "任务与运行中心"
  authority_object: "Run"
  operation: "update"
  actor: "assigned_employee"
  tenant: "allowlisted-tenant"
  expected_status: 200
  audit_event: "run.transitioned"
  rollback_or_recovery: "lease-fencing-retry"
```

Include at least one authorized operation and one denied cross-tenant or insufficient-role operation for each of: personal, task/runtime, artifact/approval, application, digital employee, ontology, skill/capability, MCP, action/workflow, data/knowledge, memory, organization/identity/permission, tenant/configuration, host/deployment and operations/audit/quality. For each immutable or published object use version/publish/revoke/archive rather than physical deletion; for draft and personal-memory deletion assert compliant propagation. The runner captures API result, audit correlation ID, Artifact/Receipt Digest where applicable, availability/degradation state and declared rollback/recovery result.

- [ ] **Step 4: Run the full 15-module regression**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/acceptance/test_module_operations_matrix.py -q`

Run: `pwsh -File scripts/test-first-release-module-operations.ps1 -Matrix acceptance/release/v1/module-operations.yaml -Target cloud-preproduction`

Expected: PASS only when all 15 module groups have current authorized, denied, audit and recovery evidence; missing or mock-only operations fail.

- [ ] **Step 5: Commit module-operation regression**

```bash
git add acceptance/release/v1/module-operations.schema.json acceptance/release/v1/module-operations.yaml scripts/test-first-release-module-operations.ps1 mate-platform-backend/tests/acceptance/test_module_operations_matrix.py acceptance/release/v1/requirements.yaml
git commit -m "test(release): exercise first release module operations"
```

### Task 4: Verify four business MVPs and the four standalone host contracts

**Files:**
- Create: `acceptance/release/v1/host-capability-contract.schema.json`
- Create: `acceptance/release/v1/host-capability-contract.yaml`
- Create: `scripts/test-host-capability-contract.ps1`
- Create: `mate-platform-backend/tests/compatibility/test_host_capability_contract.py`
- Modify: `acceptance/release/v1/requirements.yaml`
- Modify: `acceptance/release/v1/interface-registry.yaml`

**Interfaces:**
- Produces: `HostCapabilityContract { host: Literal["codex", "claude-code", "deepseek-harness", "hermes"], topology: Literal["cloud", "connected-private"], environment_id: str, exact_version: str, connector_version: str, connector_digest: str, capabilities: HostCapabilities, environment_digest: str, valid_until: datetime, evidence: list[EvidenceRef] }`.
- Produces: `run_host_contract(host: str, exact_version: str, target: TargetEnvironment) -> HostEvidence`.
- Consumes: MVP1–MVP4 E2E contracts, UserContextProjection, EmployeeProjection, CapabilityCatalog and CapabilityAvailabilityProjection.

- [ ] **Step 1: Write failing host-matrix and business-evidence tests**

```python
def test_release_requires_exact_four_hosts_and_real_mvp_evidence():
    result = validate_host_and_mvp_evidence(
        hosts=[host("codex"), host("hermes")],
        mvp_evidence={"mvp1": "mock"},
    )
    assert result.codes == {"HOST_TOPOLOGY_MATRIX_INCOMPLETE", "MVP_E2E_NOT_LIVE"}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/compatibility/test_host_capability_contract.py -q`

Expected: FAIL because the standalone host contract and MVP evidence validator do not exist.

- [ ] **Step 3: Implement independent host and MVP verification**

```python
REQUIRED_HOSTS = {"codex", "claude-code", "deepseek-harness", "hermes"}
REQUIRED_TOPOLOGIES = {"cloud", "connected-private"}

def validate_host_matrix(contracts: list[HostCapabilityContract]) -> set[str]:
    required = {(host, topology) for host in REQUIRED_HOSTS for topology in REQUIRED_TOPOLOGIES}
    actual = {(c.host, c.topology) for c in contracts if c.environment_id and c.connector_digest}
    return set() if actual == required else {"HOST_TOPOLOGY_MATRIX_INCOMPLETE"}
```

For each exact host version in each required topology test Connector/Bootstrap, identity propagation, EmployeeProjection load, MCP discovery/refresh, structuredContent, Artifact Markdown/HTML fallback, Run resume, capability degradation presentation and documented security limitations. Test cross-host continuation but require all eight host × topology evidence rows independently; an approved equivalence exception must name the pair, boundary, reason and expiry and is never inferred. Execute MVP1 order insight/reversible confirmed action, MVP2 contract evidence report, MVP3 ontology proposal/review/publish and MVP4 event-driven maintenance/recovery on real or de-identified approved inputs; record Run, Artifact/Decision/Receipt and audit IDs.

- [ ] **Step 4: Run host and MVP acceptance**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/compatibility/test_host_capability_contract.py -q`

Run: `pwsh -File scripts/test-host-capability-contract.ps1 -Contracts acceptance/release/v1/host-capability-contract.yaml -Target cloud-preproduction`

Run: `pwsh -File scripts/test-host-capability-contract.ps1 -Contracts acceptance/release/v1/host-capability-contract.yaml -Target connected-private-preproduction`

Expected: PASS only when all eight host × topology rows and all four real MVP evidence chains are current. A host with unsupported MCP Apps passes only if its structured Artifact fallback succeeds.

- [ ] **Step 5: Commit independent host and MVP evidence**

```bash
git add acceptance/release/v1/host-capability-contract.schema.json acceptance/release/v1/host-capability-contract.yaml scripts/test-host-capability-contract.ps1 mate-platform-backend/tests/compatibility/test_host_capability_contract.py acceptance/release/v1/requirements.yaml acceptance/release/v1/interface-registry.yaml
git commit -m "test(release): gate four hosts and business MVPs"
```

### Task 5: Promote cloud and connected-private targets through slice observation and rollback

**Files:**
- Create: `acceptance/release/v1/promotion-plan.schema.json`
- Create: `acceptance/release/v1/promotion-plan.yaml`
- Create: `acceptance/release/v1/promotion-evidence.yaml`
- Create: `scripts/test-production-release-promotion.ps1`
- Create: `mate-platform-backend/tests/recovery/test_release_promotion_rollback.py`
- Modify: `acceptance/release/v1/production-profile.yaml`

**Interfaces:**
- Produces: `PromotionPlan { topology: Literal["cloud", "connected-private"], environment: EvidenceEnvironment, allowlist: Slice, observation_window_minutes: int, slo_queries: list[str], rollback_thresholds: RollbackThresholds, rollback_digest: str }`.
- Produces: append-only `PromotionEvidence { candidate_digest: str, topology: str, environment_id: str, replay_digest: str, slice: Slice, observation: ObservationResult, rollback_receipt: EvidenceRef, signed_at: datetime }` in promotion-evidence.yaml.
- Produces: `promote_candidate(plan: PromotionPlan, candidate: FinalCandidate) -> PromotionEvidence` without modifying final-candidate.yaml.
- Consumes: Tasks 1–4 proofs, PI-0 database safety/recovery evidence and the locked `production-profile.yaml`.

- [ ] **Step 1: Write failing topology, observation and rollback tests**

```python
def test_promotion_rejects_shared_environment_and_missing_rollback_observation():
    result = validate_promotion_plan(plan(topologies=["cloud"], observation_window_minutes=0, rollback_digest=""))
    assert result.codes == {"CONNECTED_PRIVATE_PROMOTION_REQUIRED", "OBSERVATION_WINDOW_REQUIRED", "ROLLBACK_PLAN_REQUIRED"}
```

- [ ] **Step 2: Run the promotion tests to verify they fail**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/recovery/test_release_promotion_rollback.py -q`

Expected: FAIL because topology-specific promotion validation and runner do not exist.

- [ ] **Step 3: Implement target-bound promotion and reversible Flux rollout**

```powershell
$candidate = Get-Content $CandidateManifest -Raw | ConvertFrom-Yaml
Assert-FinalCandidate -Candidate $candidate -Target $Target
Invoke-DeidentifiedReplay -Target $Target -Candidate $candidate
Promote-AllowlistedSlice -Target $Target -Slice $Plan.allowlist
Wait-ObservationWindow -Minutes $Plan.observation_window_minutes
if (Test-RollbackThreshold -Target $Target -Plan $Plan) { Invoke-FluxRollback -Target $Target -Digest $Plan.rollback_digest }
```

Create one plan each for cloud and connected-private targets with distinct immutable environment identities and separate allowlisted tenants/traffic slices. Before any production resource mutation, verify candidate signature, target binding, pre-production replay provenance and PI-0 recovery validity. During the locked observation window evaluate declared SLO/error-budget queries, alert state, audit errors, duplicate side effects and reconciliation. Force one rollback rehearsal per topology and record the returned prior Digest, Flux reconciliation, RPO/RTO impact and user-visible degradation/recovery notification.

Freeze and sign final-candidate.yaml before the first promotion. The runner may append promotion-evidence.yaml only; each receipt must repeat the frozen candidate Digest. Any attempted write to final-candidate.yaml after signing fails the run and invalidates the release.

- [ ] **Step 4: Run both live promotions and rollbacks**

Run: `pwsh -File scripts/test-production-release-promotion.ps1 -ReleaseManifest acceptance/release/v1/final-candidate.yaml -PromotionPlan acceptance/release/v1/promotion-plan.yaml -Topology cloud -ExerciseRollback`

Run: `pwsh -File scripts/test-production-release-promotion.ps1 -ReleaseManifest acceptance/release/v1/final-candidate.yaml -PromotionPlan acceptance/release/v1/promotion-plan.yaml -Topology connected-private -ExerciseRollback`

Expected: PASS only after separate target-bound pre-production replay, allowlisted slice, observation and confirmed rollback evidence for both topologies.

- [ ] **Step 5: Commit promotion evidence mechanics**

```bash
git add acceptance/release/v1/promotion-plan.schema.json acceptance/release/v1/promotion-plan.yaml acceptance/release/v1/promotion-evidence.yaml scripts/test-production-release-promotion.ps1 mate-platform-backend/tests/recovery/test_release_promotion_rollback.py acceptance/release/v1/production-profile.yaml
git commit -m "test(release): promote and roll back both deployment topologies"
```

### Task 6: Aggregate all current evidence into the only GA decision

**Files:**
- Create: `acceptance/release/v1/platform-ga.schema.json`
- Create: `acceptance/release/v1/platform-ga.yaml`
- Verify: `acceptance/release/v1/promotion-evidence.yaml`
- Verify: `acceptance/release/v1/migration-chain.yaml`
- Verify: `acceptance/release/v1/migration-receipts.yaml`
- Create: `scripts/verify-platform-ga.py`
- Create: `mate-platform-backend/tests/architecture/test_platform_ga_evidence.py`
- Modify: `.github/workflows/ga-acceptance.yml`
- Create: `acceptance/release/v1/release-readiness-report.md`

**Interfaces:**
- Produces: `PlatformGA { release_id: str, candidate_digest: str, requirements_digest: str, interface_registry_digest: str, host_contract_digest: str, migration_chain_digest: str, migration_receipts: list[MigrationReceipt], promotion_evidence: list[PromotionEvidence], signatures: Signatures, status: Literal["PASSED", "FAILED", "NOT_EXERCISED"] }`.
- Produces: `verify_platform_ga(ga: Path, candidate: FinalCandidate, now: datetime) -> VerificationResult`.
- Consumes: all prior task artifacts, append-only promotion-evidence.yaml, the requirements matrix, component Gate DAG, recovery drill and named business/security/data/operations/release signatures.

- [ ] **Step 1: Write failing aggregate-GA tests**

```python
def test_platform_ga_rejects_not_exercised_host_gate_and_missing_connected_private_rollback():
    result = verify_platform_ga(ga_with(host_gate="NOT_EXERCISED", connected_private_rollback=None), candidate(), utcnow())
    assert result.codes == {"HOST_GATE_NOT_PASSED", "CONNECTED_PRIVATE_ROLLBACK_MISSING"}

def test_platform_ga_rejects_single_topology_or_stale_migration_receipt():
    result = verify_platform_ga(
        ga_with(migration_receipts=[cloud_receipt(expired=True)]), candidate(), utcnow()
    )
    assert result.codes == {
        "MIGRATION_TOPOLOGY_EVIDENCE_MISSING", "MIGRATION_RECEIPT_EXPIRED"
    }
```

- [ ] **Step 2: Run the GA test to verify it fails**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_platform_ga_evidence.py -q`

Expected: FAIL because the aggregate verifier and schema do not exist.

- [ ] **Step 3: Implement the only GO/NO-GO calculation**

```python
def verify_platform_ga(ga: Path, candidate: FinalCandidate, now: datetime) -> VerificationResult:
    codes = verify_final_candidate(candidate.path, ga.security_exceptions, now).codes
    codes |= verify_interface_registry(ga.interface_registry, candidate).codes
    codes |= verify_module_operations(ga.module_operations, candidate).codes
    codes |= verify_hosts_and_mvps(ga.host_contract, ga.mvp_evidence, candidate).codes
    codes |= validate_migration_receipts(
        ga.migration_receipts,
        migration_chain_digest=ga.migration_chain_digest,
        candidate_digest=candidate.digest,
        required_topologies={"cloud-preproduction", "connected-private-preproduction"},
        required_phases={"pi0-schema-foundation", "pi6-contract"},
        now=now,
    ).codes
    codes |= verify_promotions(ga.promotions, required_topologies={"cloud", "connected-private"}, candidate_digest=candidate.digest).codes
    codes |= verify_requirements_gates_recovery_signatures(ga, candidate, now).codes
    return VerificationResult("PASSED" if not codes else "FAILED", codes)
```

Reject any non-`IMPLEMENTED` first-release Requirement; child Gate not `PASSED`; stale profile, environment or toolchain Digest; invalid signature; missing independent recovery drill; absent cloud or connected-private observation/rollback; missing, expired, cross-candidate or Digest-mismatched migration receipt pair (`MIGRATION_TOPOLOGY_EVIDENCE_MISSING`); unapproved security exception; missing module operation; incompatible interface; missing host; mock E2E; or unrehearsed rollback. The verifier emits a `release-readiness-report.md` listing each Requirement, interface, component Gate, host, topology, owner, evidence Digest and exact NO-GO code, plus the cloud/connected-private receipts for both PI-0 0015→0026 schema foundation and PI-6 0026→0027 contract phases.

- [ ] **Step 4: Run all final validators in CI**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_final_candidate.py mate-platform-backend/tests/architecture/test_interface_registry.py mate-platform-backend/tests/acceptance/test_module_operations_matrix.py mate-platform-backend/tests/compatibility/test_host_capability_contract.py mate-platform-backend/tests/recovery/test_release_promotion_rollback.py mate-platform-backend/tests/architecture/test_platform_ga_evidence.py -q`

Run: `mate-platform-backend/.venv/Scripts/python.exe scripts/verify-platform-ga.py acceptance/release/v1/platform-ga.yaml acceptance/release/v1/final-candidate.yaml`

Expected: `PASSED` only when all current evidence is bound to the locked candidate and both target topologies; otherwise a signed `NO-GO` report is produced.

- [ ] **Step 5: Commit the final release decision controls**

```bash
git add acceptance/release/v1/platform-ga.schema.json acceptance/release/v1/platform-ga.yaml acceptance/release/v1/migration-chain.yaml acceptance/release/v1/migration-receipts.yaml scripts/verify-platform-ga.py mate-platform-backend/tests/architecture/test_platform_ga_evidence.py .github/workflows/ga-acceptance.yml acceptance/release/v1/release-readiness-report.md
git commit -m "test(release): make platform ga the only go no-go decision"
```

## Self-Review

- Tasks 1 and 6 make the final candidate and `platform-ga` immutable, current and the sole GO/NO-GO authority; `NOT_EXERCISED` and mock proof cannot pass.
- Task 2 validates provider/consumer compatibility for every declared interface; Task 3 executes authoritative-object lifecycle operations for all 15 first-release modules.
- Task 4 independently verifies all four business MVPs and all four host versions without coupling host verification to the optional Disconnected Cell.
- Task 5 requires separate cloud and connected-private replay, slice, observation and rollback evidence.
- Tasks 1 and 6 enforce Critical vulnerability rejection, bounded High-risk exception approval, expiry and remediation SLA.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-01-metaplatform-ga-release-and-cutover.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task and review between tasks.
2. **Inline Execution** — execute tasks in this session using executing-plans, with checkpoints.
