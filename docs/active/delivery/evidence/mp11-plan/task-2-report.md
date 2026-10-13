# Task 2 implementation report

Status: DONE_WITH_CONCERNS (Task 2 checks pass; one independently reproduced full-suite baseline failure remains).
Branch: codex/product-v1.1
Base: 02b42e8a840d3da320158eede66808c3f5bc979b
Commit: be62f0898157016e05d9313cc775c3d503a03a4f — feat(mp11): add relationship editing and object association UI

## Scope and interfaces

- Relationship page supports new definitions and explicit edit actions, generated/editable identifiers, authorized source/destination types, cardinality, all existing directionality values, two endpoint names, description, advanced technical RID, and relationship attributes through the existing PropertyEditorV2.
- Business relationship name reuses src_display_name as the source-side business name; destination name remains dst_display_name. No competing name field or model was added. Existing RID identity is read-only during edit.
- Create UI detects already loaded identifiers and directs the user to edit; both callers retain the existing backend upsert endpoint. This is not a new server create-only protocol.
- Existing instances (or unavailable statistics) protect source/destination/cardinality/directionality in the edit UI. Task 1 server-side structural/concurrent checks remain authoritative.
- Instance drawer supports real endpoint choices filtered by definition types, loading more choices, typed relationship property values, save-in-flight suppression, retained inputs/server errors/retry, and stable operation RID for a network retry. Success refetches instances and server statistics.
- List/statistics/endpoint failures display errors with retry; failed reads no longer masquerade as empty instances or zero counts.
- Corrected frontend KernelLinkInstance.props from its old array assumption to the actual response object {property_rid: value}. Creation uses existing {property_rid: {value}} LinkInstanceDTO. No backend DTO or operationId changed.
- Object detail links reach relationship management/creation with the current source preselected. UI explains business relationships versus inheritance and ordinary customer_id properties.
- Controller authorized the necessary relationship-list tenant dependency fix after real E2E exposed it: PG scoped list explicitly filters tenant_id; HTTP list additionally filters current tenant RID prefix, including InMemory/adapters without RLS. Unscoped direct repository catalog behavior remains. Role systems and production auth deployment were not expanded.

Existing APIs reused: POST/GET /api/v1/ont/v2/link-types, POST/GET /link-instances, GET /link-instances/stats, GET /object-types, GET /individuals, GET /value-types. Existing platform.write enforcement and Task 1 concurrency protection are retained.

## TDD and actual verification

### UI behavior — transport mocked, real mounted components and wrappers

Command:
pnpm --dir metaplatform-frontend --filter @mate/web test:unit src/pages/ontology/model/link-types/LinkTypesPage.test.tsx --maxWorkers=1 --minWorkers=1

RED: six tests failed before implementation: missing 新建关系/关联对象, hidden server/read errors, and absent preselection/protection.
Evidence: task-2-red.log in this SDD directory. Environment-only collection issues (jsdom canvas, Node storage, required SettingsProvider) were resolved before accepting behavioral RED. Production implementation followed behavioral RED.

Final GREEN: 6/6 passed at 2026-10-11 17:06:36 (9.71s). Covers definition creation/visible reload, C001/O001 association and count reload, retained 409 inputs plus retry, instance read failure/recovery, unavailable statistics, source preselection and structural protection.

### Same-database tenant reads and Task 1 writes — real HTTP/PostgreSQL

DSN captured only in child-process environment from dedicated PostgreSQL; never printed or persisted in source/report. PYTHONPATH uses backend package src directories and PYTHONDONTWRITEBYTECODE=1.

RED command:
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_reads.py -q -p no:cacheprovider

Observed three actual assertion failures: InMemory HTTP leaked neighboring relationship; PG HTTP returned other tenants; PG tenant-scoped direct list returned global/neighbor rows.
Evidence: task-2-reads-red.log. Fixture token strings were redacted in the stored failure diagnostics.

GREEN combined command:
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_reads.py mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py -q -p no:cacheprovider --tb=short

Result: 34 passed / 1 skipped in 6.19s. Skipped case was a PG-only direct-scope check inappropriately parameterized against Memory (no tenant_scope); not counted as passing. Self-review replaced that parameter with a dedicated PG fixture.

Final covering command after fixture cleanup:
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_reads.py -q -p no:cacheprovider --tb=short

Result: 3 passed / 0 skipped in 1.45s. All 31 Task 1 write/concurrency cases passed in the combined run; Task 1 write production code was unchanged.
Evidence: task-2-reads-green.log, task-2-reads-final.log.
Inherited warnings: Starlette/httpx test-client deprecation and existing short-HMAC identity fixture. Combined run 30 warnings; final read run 3 warnings. This is not a warning-free dependency suite.

### Real UI + actual API + independent PostgreSQL — no business request mocks

Command:
pwsh -NoProfile -File metaplatform-frontend/apps/web/tests/e2e/helpers/run-mp11-relationship.ps1

Runner launches the actual v2 router, install_auth middleware and PgOntologyRepository on a guarded loopback test API; launches a separate Vite/cache; creates one fresh `codex_mp11_ui_<UUID>` database in the dedicated PG container. Two tenants are seeded in the SAME per-run DB, including neighbor object types and a neighbor relationship.

Successful result: 1 passed (7.0s total; scenario 6.2s), verifying:

- Own relationship catalog initially empty; neighbor relationship excluded; only authorized own object types; neighbor absent from UI options.
- Preselected Customer; relationship definition and attribute created by actual HTTP 200.
- C001/O001 association with persisted property created by actual HTTP 200.
- C002/O001 rejected by actual cardinality HTTP 409; selected endpoints and inline server error remain.
- Browser reload shows persisted association/property and count.
- Actual src and dst filtered API queries both return the same association/property.
- Read-only scope write rejected by actual HTTP 403.
- Structure locked with existing instances; description update succeeds and is reread from PostgreSQL.

Failed diagnostic iterations were not counted as success: fixture session endpoint initially required auth (401); shared Task 1 DB exposed relation-list tenant leakage; exact-label selector with nested select options timed out. Fixed only fixture anonymous path and accessible combobox selectors; added tenant regression and filtering; moved independent Vite cache under node_modules to avoid Babel recompiling optimized chunks. Final scenario includes a neighbor tenant so database isolation does not hide tenant leakage.

Identity boundary: fixture signature bypass is confined to the dedicated test process, following existing backend test fixture. Issuer/audience/tenant/scope context and API/PG behavior are real. Live Keycloak signature integration, formal Gates, deployment and release are not claimed. Fixture session endpoint exists only in test helper. Trace/video/screenshots disabled to avoid token-bearing artifacts. No credentials enter report, tracked configs or images.

### Type check/build and complete frontend regression boundary

pnpm --dir metaplatform-frontend --filter @mate/web typecheck
Result: exit 0, including final check after tenant dependency changes.

pnpm --dir metaplatform-frontend --filter @mate/web build
Result: exit 0; 11126 modules transformed; built in 2m22s. Existing >500kB chunk warnings remain an inherited performance limitation. No semantic frontend production edit followed build; subsequent edits were backend filtering, test/harness corrections and whitespace.

pnpm --dir metaplatform-frontend --filter @mate/web test:unit --maxWorkers=1 --minWorkers=1
Result: 71 passed / 1 failed (11 files, 72 tests). Failure is unchanged ProposalConfirmDrawer.test.tsx: only reports success after authoritative confirmation/execution states, then shows audit evidence.

Systematic-debugging baseline evidence:

- Current focused ProposalConfirmDrawer test: 1 failed / 2 passed, missing executeProposal invocation.
- Exact ProposalConfirmDrawer.tsx, its test and OntologyStagingPreview.tsx obtained using `git show 02b42e8a840d3da320158eede66808c3f5bc979b:<path>` into ignored test scratch. Current source not modified.
- Isolated Vitest config explicitly includes ONLY the snapshot test; result 1 failed / 2 passed, identical failure.
- Command: pnpm --dir metaplatform-frontend/apps/web exec vitest run --config tests/e2e/.artifacts/codex-mp11-baseline-unit/vitest.config.ts --maxWorkers=1 --minWorkers=1
- Snapshot test Git blob equals baseline: 7db49768780f8f198ad5e18722613e668114b0be. Current drawer/test diff versus base is empty.
- Root cause: mount-time getProposal preflight consumes mocked confirmed response; confirmation reread receives executed and correctly fails closed. Controller deferred correctly sequenced fixture correction and full regression rerun to Task 8. Task 2 did not modify drawer/test.
- Logs: task-2-full-unit.log, task-2-baseline-unit.log, task-2-base02b-unit.log. Ignored snapshot: tests/e2e/.artifacts/codex-mp11-baseline-unit.

## Self-review, resource isolation and limitations

Self-review verified N:N and all three directionality enums, corrected response props representation, removed inapplicable Memory PG-scope skip, and removed EOF whitespace. git diff --cached --check clean before commit. Only 14 explicitly owned files staged; previous screenshots/pycache/worktrees/WIP/controller documents excluded.

Dedicated PostgreSQL remains codex-mp11-relationship-pg on 127.0.0.1:55497. Original codex_mp11_relationship DB preserved. Read regressions use unique test tenants there.

Successful UI resources:

- API 127.0.0.1:55498 (launcher PID 47744); Vite 127.0.0.1:55499 (PID 25748).
- DB codex_mp11_ui_a530eecd67c64dba9fc053d2eeeb7306; main tenant mp11-ui-257bb070aa1c4eedba1d0f0278c4b521 plus neighbor.
- Runner terminated only its own process trees and dropped only its generated regex-checked DB. Follow-up catalog count for this DB was 0; 55498/55499 had no listeners.
- Existing 9200 preview, Keycloak, services/databases, dedicated PG container and prior Vite cache were not restarted or replaced.
- Extra owned files are reproducible test-only harness: API helper, runner, dedicated Playwright config and Vite config. Cache node_modules/.vite-codex-mp11-relationship is separate. No tracked .env or printed credentials.

Remaining concern: full frontend suite remains 71/72 because of independently reproduced baseline proposal fixture failure. Owned UI/read tests and real API/PG E2E have no remaining failures. No formal release or live identity acceptance is claimed.

Owned committed files:

- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py
- mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_reads.py
- metaplatform-frontend/apps/web/src/api/ont/kernel.ts
- metaplatform-frontend/apps/web/src/pages/ontology/OntologyModelingPage.tsx
- metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx
- metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx
- metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkInstanceEditor.tsx
- metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.test.tsx
- metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts
- metaplatform-frontend/apps/web/tests/e2e/mp11-relationship.config.ts
- metaplatform-frontend/apps/web/tests/e2e/mp11-vite.config.ts
- metaplatform-frontend/apps/web/tests/e2e/helpers/mp11-relationship-api.py
- metaplatform-frontend/apps/web/tests/e2e/helpers/run-mp11-relationship.ps1

## Fix round 1/5 — I1, I2, M1, M2

Fix base: be62f0898157016e05d9313cc775c3d503a03a4f
Fix commit: 635163f544c1e73640610f401800faaf4c8edeca
Subject: fix(mp11): make relationship creation atomic and load all type pages
Status: fixes implemented and verified; ready for scoped rereview. This appendix supersedes the original report's create-only and pagination limitations.

### Changes / findings addressed

I1:

- Create UI now explicitly distinguishes an unknown/failed directory from a successfully loaded directory. New save is disabled until success; failed directory has retained form inputs and retry feedback.
- New forms send POST /link-types?create_only=true. Editing/default callers preserve upsert compatibility.
- Added keyword-only create_only=False to the existing repository protocol and implementations. InMemory relationship writes check-and-write under one RLock (not a claim that its entire repository is thread-safe).
- PG strict creation uses the existing definition advisory transaction lock, checks existence in that transaction, and additionally uses ON CONFLICT DO NOTHING plus affected-row conflict detection. It never overwrites a competing existing definition, even if a writer bypasses the advisory convention.
- Shared typed LinkTypeAlreadyExistsError maps to actual HTTP 409. Existing DTO/operationId unchanged; canonical OpenAPI documents optional boolean create_only=false and duplicate/competing-creation 409 semantics.
- Tests cover duplicate strict creates, all original DTO content remaining unchanged, Memory/PG competing writers with one winner, a RID claimed after catalog loading, and unchanged default edit semantics.

I2:

- listObjectTypes wrapper accepts the real limit/offset parameters without changing old callers' default behavior.
- Definition editor loads all authorized pages in chunks of 100, deduplicates RID, stops on the final short page, rejects a non-progressing pagination response, and retains later-page source deep links. Partial/failed loading still blocks save and exposes existing retry feedback.
- UI fixture has 102 types; real PG UI fixture has 104 owned types plus neighbor-tenant types. Order and z_customer source are after the first page and both usable.

M1:

- Removed unsupported offset/limit progression and fake load-more controls from instance endpoint editor. It reads the actual full authorized class list, as the current individuals API contract specifies.
- UI boundary cases 200/201 individuals verify all are selectable without fake pagination. Real E2E has 201 actual customers and selects from that full response.
- Large individual lists still use the current full-response/native-select contract; implementing actual API pagination remains outside this fix.

M2:

- A failed next-page instance request retains its error and enables previous-page navigation. Returning triggers an actual previous-page request; failed rows are not shown as successful or empty.
- Covered in UI test and real HTTP/PG harness using explicit fixture-only transient 503 injection.
- Real pointer interaction exposed directory retry at the top of the sheet being intercepted by existing app tabs. Moved directory status/retry next to save controls; final E2E uses normal click (no force-click bypass).

### RED evidence before implementation

API command:
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py -k create_only -q -p no:cacheprovider --tb=short

Result: 4 failed. Duplicate strict create returned actual HTTP 200 and replaced description; Memory/PG did not accept create_only, including the stale catalog/competitor case. Log: task-2-fix1-api-red.log.

UI command:
pnpm --dir metaplatform-frontend --filter @mate/web test:unit src/pages/ontology/model/link-types/LinkTypesPage.test.tsx --maxWorkers=1 --minWorkers=1

Result: 7 passed / 5 failed (12 cases). Failed regressions: directory failure allowed save, another session's claim produced no conflict, Order after page 100 absent, exactly 200 individuals offered fake load-more, and failed page disabled previous navigation. The 201 full-list case already passed and documents the existing actual contract. Log: task-2-fix1-ui-red.log.

### GREEN / final checks

Backend covering reads + writes:
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_reads.py -q -p no:cacheprovider --tb=short

38 passed / 0 skipped in 7.16s (33 inherited fixture/dependency warnings). Includes all earlier relationship write/concurrency/read cases. Log: task-2-fix1-api-green.log.
Self-review strengthened new cases to typed conflicts and entire original DTO comparisons. Covering -k create_only rerun: 4 passed / 31 deselected in 1.91s, 4 inherited warnings. Log: task-2-fix1-api-final.log. Production behavior unchanged by that assertion refinement.

Final owned UI suite:
pnpm --dir metaplatform-frontend --filter @mate/web test:unit src/pages/ontology/model/link-types/LinkTypesPage.test.tsx --maxWorkers=1 --minWorkers=1

12 passed in 10.89s (2026-10-11 17:37:40). Log: task-2-fix1-ui-final.log.
pnpm --dir metaplatform-frontend --filter @mate/web typecheck: exit 0.
pnpm --dir metaplatform-frontend --filter @mate/web build: exit 0, built in 19.67s after final semantic form layout change. Log: task-2-fix1-build-final.log. Inherited large-chunk warning remains.

Canonical OpenAPI parsed via backend venv Python/yaml.safe_load and checked: operationId unchanged; query create_only boolean/default false/optional; 409 retained. This was a schema semantics check, not text-grep evidence.

Real UI command:
pwsh -NoProfile -File metaplatform-frontend/apps/web/tests/e2e/helpers/run-mp11-relationship.ps1

Final result: 1 passed (scenario 9.4s, total 10.2s). Log: task-2-fix1-e2e.log.
Scenario retains original positive/negative tenant/association/cardinality/reload/both-side/read-only/edit chain and additionally verifies:

- 104 actual owned type definitions, neighbor excluded, later-page target and source deep link;
- 201 actual individuals and no fake load-more;
- strict-create query sent, actual second session claims RID after browser snapshot, browser receives actual 409 and retains description, winner description remains, duplicate strict create actual 409;
- directory 503 disables save and successful actual-PG retry preserves inputs;
- page-2 503 permits navigation back and displays genuine reread page-1 data.

503 cases are explicitly controlled by test-helper-only transient error injection. They verify HTTP error UI/recovery around real successful PG requests; they are not evidence of an actual PostgreSQL outage. All successful business requests and competing writes use the actual router, auth context and PG repository. Fixture signature boundary remains as documented above.

### Resources / self-review / remaining boundaries

Successful final E2E resources: API launcher PID 69508 on 55498, Vite PID 1252 on 55499; database codex_mp11_ui_5d87022461f44942899ce73b4b54fbb3; main tenant mp11-ui-16e21226ba59466ab71ac207847866f9 plus neighbor.
Runner cleaned its own process trees and generated DB. Follow-up DB catalog count: 0. Dedicated helper listeners: 0. Existing PG container 55497, original test DB, 9200 preview, auth/services and existing caches were retained.
Backend regressions use only guarded 55497/codex_mp11_relationship and fixture data. No default 5432 or live databases used.

Self-review checked atomicity/rollback/no-overwrite SQL, explicit edit compatibility, unknown-directory fail-closed state, complete authorized paging, actual individual contract, accessible non-forced retry/back navigation, and actual resource cleanup. git diff --cached --check was clean. Only 13 explicitly owned source/contract/test files committed; controller planning/research documents and pre-existing WIP were not staged.

M3 remains inherited fixture/dependency/build warnings; no warning-free claim.
M4 remains the previously independently reproduced ProposalConfirmDrawer baseline fixture issue assigned to Task 8. Per controller instruction, no complete suite or baseline snapshot rerun in this fix round. The prior 71/72 full-suite result is historical evidence, not a new full-suite execution containing the six added UI cases.
No formal release, deployed identity or Gate acceptance claimed.
