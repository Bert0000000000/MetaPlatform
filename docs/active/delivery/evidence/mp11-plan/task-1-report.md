# Task 1 report

Status: DONE_WITH_CONCERNS
Commit: 9d711b066ae4f1dcb2c1fda2fae8f38828b7b90b
Subject: fix(ontology): validate relationship writes and persist descriptions
Branch: codex/product-v1.1
Base supplied: b49426d5

## Scope and behavior

Owned changes:
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py: both relationship writes require authenticated platform.write scope; definitions require same-tenant existing ObjectTypes; invalid enum/conversion values become readable 422; instances require same-tenant existing type and endpoints with matching classes; existing instances block src/dst/cardinality/directionality changes with 409. Names and descriptions remain editable. Cardinality 409 and same-RID replay semantics remain intact. Constructor errors now fall within 422 translation.
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py: description included in ON CONFLICT update; transactional existing-instance structural guard; exclusive advisory definition lock for definition updates and shared definition lock before endpoint locks for instance writes. Revalidates materialized endpoint classes against the current definition after the lock. A failed structural update rolls back and maps to 409.
- mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py: 25 real authenticated FastAPI/InMemory cases plus 3 real PG regression cases, including both competing transaction orders.
- mate-platform-backend/contracts/openapi/services/ont.yaml: documents 403/404/409 responses on both existing operations. DTOs and operationIds retained unchanged.

## Authorization compatibility

The real install_auth middleware is installed in test apps. The existing tests/conftest.py auth_headers Keycloak-format JWT fixture is reused; no AuthMiddleware dispatch replacement, no production auth configuration changes. Tests retain issuer/audience/tenant resolution. The inherited test fixture already skips signature verification in its test environment.

platform.write is the token scope, enforced through the existing RequestContext.has_scope method. AuthMiddleware maps scopes from verified claims and permissions from client roles (mate_platform/auth/middleware.py:167-168). IAM login generation emits platform.read platform.write but no resource_access/client ontology permission (mate-tech-iam/api/auth.py:106). Therefore requiring a new ont.write client permission would break the current login and the existing authorized test context. Per root's explicit decision, this task enforces platform.write and does not introduce roles or alter login. x-mate-permission: ont.write remains contract metadata without an independent runtime permission gate on these two routes; Task 7 must account for this boundary. Read-only scope is rejected even on the fixture's existing super-admin role, so a role alone does not bypass the scope gate.

## RED evidence

Working directory for commands below: D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/mate-platform-backend
Python: .venv/Scripts/python.exe
All pytest runs use -p no:cacheprovider, preserving the protected existing cache.

Initial fixture construction errors (missing required Property fields) were corrected before treating a run as RED evidence. No production code was modified for that setup correction.

Command:
```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/test_mp11_relationship_writes.py -q --tb=short
```
Verified behavioral RED output: 20 failed, 5 passed, 1 skipped, 26 warnings in 3.25s (exit 1). Failures showed 200 instead of 403/404/422/409, enum errors returned 500, self-links returned 500, and read-only token scope could write. PG was skipped only because no explicit DSN had yet been supplied.

The disposable DSN was then assigned to MP11_RELATIONSHIP_PG_DSN, without using a default DSN. Credentials are omitted from this report.
Command:
```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/test_mp11_relationship_writes.py -q -k pg_description --tb=short
```
Verified PG RED output: 1 failed, 25 deselected, 1 warning in 3.28s (exit 1). Re-reading through a new PgOntologyRepository returned Original description rather than Updated persistent description after update.

Self-review identified an additional concurrent-definition window. The two real PG interleaving tests were written and run before the transaction lock/current-definition fix:
```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/test_mp11_relationship_writes.py -k 'concurrent_definition or revalidates_endpoint' -q --tb=short
```
Verified RED output: 2 failed, 26 deselected, 1 warning in 1.67s (exit 1). Instance-first interleaving silently changed definition; definition-first interleaving silently wrote mismatched instance. Tests use Events and independent real DB connections to hold the transaction window; the second test's cursor wrapper forwards all operations to the actual PG cursor and pauses only after the definition SQL has executed.

## GREEN and self-review

For final verification all four environment variables MP11_RELATIONSHIP_PG_DSN, EXP03_PG_DSN, LINKC_PG_DSN and LINKF_PG_DSN were explicitly assigned the same isolated localhost test database. No suite used its built-in default DSN.

Final command:
```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/test_mp11_relationship_writes.py packages/mate-tech-ont/tests/test_ont_exp03_link_semantics.py packages/mate-tech-ont/tests/integration/test_ont_link_cardinality_concurrency.py packages/mate-tech-ont/tests/integration/test_ont_link_instance_server_side_filter.py packages/mate-kernel/tests/test_ontology_api.py -q --tb=short
```
Final output: 69 passed, 26 warnings in 8.05s, exit 0, no skipped tests.
- Fresh final run includes shared-lock refinement that allows independent endpoints to write concurrently while blocking definition changes.
- Both transaction order regressions passed: instance commit first causes the structural update to fail; definition commit first causes the mismatched instance to fail.
- Existing cardinality concurrency and action/edit-set checks passed.
- Existing kernel suite remained included; parent baseline was 18 passed.
- New tests assert repository state remains unchanged following rejected writes and assert same-RID replay does not add another link.

Lint:
```powershell
.\.venv\Scripts\python.exe -m ruff check packages/mate-tech-ont/tests/test_mp11_relationship_writes.py packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py
.\.venv\Scripts\python.exe -m ruff format --check packages/mate-tech-ont/tests/test_mp11_relationship_writes.py
```
Outputs: All checks passed!; 1 file already formatted. git diff --check also exited 0. Full owned production/contract diff was self-reviewed before explicit-path staging and commit. Commit uses git commit --only with the four named owned files; no unrelated WIP was staged or committed.

## Isolated test resources

Created only new container codex-mp11-relationship-pg using existing local image pgvector/pgvector:pg16 and --pull never.
Container ID: d259c84a755a19ea18a1b089bb9cd83351dd6974dbd364555ab9740f3647bafa
Image ID verified before creation: sha256:9b05db12a35460fff0587e009f9326e414a53e9484555547f96d214a2ba98ef7
Binding: 127.0.0.1:55497 -> container 5432
Database: codex_mp11_relationship
Final state: running, retained for root's follow-on local acceptance work. The container has no attached existing database volume. No existing mate-postgres, MetaOntoOS, builder, preview, authentication or other service was restarted, reset or written to.
New PG tests fail closed unless DSN uses localhost/127.0.0.1, an explicit non-5432 port, and codex_mp11_* database name. They skip if the dedicated environment variable is absent; the final acceptance run supplied it and executed all 3 PG tests.

## Concerns and boundaries

- 26 inherited library/fixture warnings: 1 Starlette TestClient/httpx deprecation and 25 PyJWT short test-key warnings from existing auth_headers fixture. No production runtime warning/failure was observed; no dependency or shared auth-fixture changes were made to hide these.
- ont.write remains metadata as explained above; platform.write is actively enforced. Root assigned broader permission-range review to Task 7.
- Legacy direct repository writes remain lenient when LinkType or endpoint Individuals are not materialized, matching neighboring existing repository tests. Registered/materialized endpoints are now checked under the transaction lock. HTTP writes always require the type and both endpoints, and do not inherit legacy leniency.
- PgOntologyRepository production writes have DB transaction protection. InMemory is a dev/test implementation and the HTTP guard uses its existing list protocol; this task does not introduce a new InMemory concurrent mutation framework.
- Scope is local endpoint/database verification, not deployment, Gate closure or release acceptance. No UI changes made.

## Fix round 1 of 5 — review I1

Review source of truth: task-1-review.md, Important I1. Reviewed fix base: 9d711b06.
Status: DONE_WITH_CONCERNS
Fix commit: 22d14de7dbe677c454267ec588ae9fc44cd8c165
Subject: fix(ontology): protect relationship endpoint lifetime during writes

### Finding and corrected boundary

The previous transaction query permitted absent endpoint rows for legacy repository callers. HTTP's earlier endpoint checks were insufficient: deleting an endpoint between the API read and transaction, or after transaction validation before insertion, could yield a successful orphan edge. Thus the earlier report's HTTP-versus-legacy existence guarantee did not hold under deletion interleavings; this fix corrects that claim and behavior.

Chosen compatible kernel/repository signature:
```python
create_link_instance(self, li: LinkInstance, *, require_endpoints: bool = False) -> LinkInstance
```
The Protocol, InMemory and PG implementations all accept the keyword. Existing direct calls retain their default compatibility. HTTP explicitly passes require_endpoints=True. In this strict path a missing LinkType or either Individual raises KeyError and the HTTP handler translates the transaction failure to the existing documented 404. InMemory strict mode also checks materialized endpoints and their classes.

PG's endpoint SELECT now takes sorted ORDER BY rid FOR SHARE row locks, protecting endpoint existence and class_rid until insert/update commit. Definition locks and cardinality endpoint locks from the initial implementation remain intact. delete_individual takes SELECT ... FOR UPDATE on the individual before scanning/deleting its incident relationships, so it waits for a validated in-flight relationship write and then sees the newly committed edge in the cascade scan. Failed deletion explicitly rolls back. No DTO, operationId or contract changes were needed in this round.

Owned files in fix commit:
- mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/api.py
- mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py
- mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py

### RED evidence

All commands use mate-platform-backend working directory and its existing .venv Python. MP11_RELATIONSHIP_PG_DSN explicitly targeted the same dedicated 127.0.0.1:55497 / codex_mp11_relationship database; credentials are omitted.

```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/test_mp11_relationship_writes.py -k 'endpoint_deleted or delete_waits' -q --tb=short
```
Behavioral RED: 2 failed, 28 deselected, 3 warnings in 1.84s, exit 1.
- Real authenticated HTTP request paused at the repository boundary after the API endpoint reads. Real separate PG repository deleted the target and committed. Resumed HTTP returned 200 instead of 404 and persisted an orphan edge.
- Real HTTP write paused after transaction-level endpoint validation. Real separate delete completed before the write, proving that its cascade scan could precede insertion and miss the edge.

```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/test_mp11_relationship_writes.py -k in_memory_strict -q --tb=short
```
Strict-mode RED: 1 failed, 30 deselected, 1 warning in 0.88s. Existing InMemory method rejected the new keyword with TypeError, confirming strict-mode support was absent before the Protocol/implementation change.

### GREEN evidence

Initial task-only GREEN after implementing locks and strict mode: 31 passed, 28 warnings in 5.52s, no skips.

For covering verification MP11_RELATIONSHIP_PG_DSN, EXP03_PG_DSN, LINKC_PG_DSN and LINKF_PG_DSN were explicitly assigned the isolated test DSN; no default DSN was used.
```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/test_mp11_relationship_writes.py packages/mate-tech-ont/tests/test_ont_exp03_link_semantics.py packages/mate-tech-ont/tests/integration/test_ont_link_cardinality_concurrency.py packages/mate-tech-ont/tests/integration/test_ont_link_instance_server_side_filter.py packages/mate-tech-ont/tests/test_tenant_integration.py packages/mate-kernel/tests/test_ontology_api.py -q --tb=short
```
Fresh final covering output: 79 passed, 33 warnings in 20.23s, exit 0, no skips.
- Delete-first ordering: HTTP returns readable 404; no relationship persisted.
- Validated-write-first ordering: delete blocks before its cascade scan; HTTP write commits 200, delete then commits true; endpoint is absent and newly inserted edge has been removed. Assertions inspect the real PG repository after both operations.
- Both prior definition-update competition orderings continue to pass.
- Legacy direct-repo, cardinality concurrency and kernel protocol/default calls continue to pass.
- Existing tenant deletion/cascade test continues to pass.

SYNC_IT_PG_DSN was also explicitly assigned the isolated test DSN before this directly affected existing PG deletion check:
```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider packages/mate-tech-ont/tests/integration/test_ont_data_sync_integrity.py -k delete_event_and_full_tombstone -q --tb=short
```
Output: 1 passed, 8 deselected in 5.39s, exit 0. Confirms CDC deletion and full-sync tombstone deletion still work against the dedicated database.

Ruff check over all five fix-owned files: All checks passed! Ruff format check on the changed test module: 1 file already formatted. git diff --check on fix-owned files: exit 0. Full production fix diff was self-reviewed before git commit --only with the five explicit owned paths.

### Resource and residual boundaries

Reused codex-mp11-relationship-pg only; same localhost binding/database/container identity as initial report. No new container was required and existing services/databases were untouched. Dedicated container retained running for root's follow-on acceptance.

Warnings were not suppressed: 33 warnings in the broader covering command comprise the existing TestClient warning, existing short JWT test-key warnings (more instances because two new authenticated HTTP cases and the tenant suite are included), and existing main.py/FastAPI on_event deprecations introduced into the output by the existing tenant integration module. They remain the review's Minor M1 owning-scope follow-up.

The agreed platform.write enforcement and ont.write metadata boundary remain unchanged. Default direct-repo writes may still reference unmaterialized legacy resources; strict HTTP cannot. InMemory remains the existing explicitly non-thread-safe dev/test repository; PG provides the endpoint lifetime transaction guarantee. This round establishes local relationship/deletion correctness and does not claim release/Gate acceptance.
