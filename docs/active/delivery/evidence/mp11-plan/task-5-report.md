# Task 5 implementation report

Status: DONE_WITH_CONCERNS (implementation complete; live IAM and canonical contract review remain integration boundaries).
Branch: codex/product-v1.1
Task BASE: fc2c8f2136a6cc3c541228206f202e6bd006b5f1
Commit: 062c43592b240dea2d8a793cb6cd9a2f3b439719 — feat(data): connect verified PG and CSV sources with durable sync recovery
Date: 2026-10-11
Review: implementer self-review completed; independent review belongs to controller.

## Implemented behavior

- /gov/data/sources is mounted and visible in the data/governance domain. PG/CSV registration, edit, delete, actual connection probe/schema discovery, safe trace diagnostics and retry link into the existing ontology mapping page.
- Both SQL and memory source repositories resolve their actual selected record before invoking one narrow real psycopg2/stdlib-CSV connector. Recorded status is never fresh connection evidence. Removed browser random-success and sample-schema fallbacks.
- Create/list/detail/update serialize a public config whitelist; password/DSN/CSV contents stay server-side. Omitted, blank or display-mask secret updates preserve originals. Explicit PG host/database/user are required when no DSN is supplied; incomplete config cannot accidentally use machine libpq defaults. Discovery returns columns only, no sensitive row samples.
- PG reports authentication, permission, network, schema and unsupported failures with safe error_code/message/trace_id. SourceError in quality rules produces a failed diagnostic instead of an uncaught 500. Older tests now use genuine uploaded CSV fields, preserving positive/negative assertions.
- Six-step mapping uses actual discovered source/table/columns, model properties, stable primary key, optional time column, explicit confirmation of mapping suggestions, precheck, then real sync. Unknown columns/properties, unsuitable PK/non-null/time fields and numeric mapping conflicts fail before source ingestion.
- Registered source_id resolves only within verified binding/request tenant and never falls back to dsn_env when missing/denied. Legacy environment DSNs remain supported. Quoted SQL identifiers handle schema/table/column names.
- Existing backing datasource engine and apply_cdc_changes handle full PG upsert, timestamp+PK incremental and CSV batch. Initial integer PK scan avoids comparing an integer with an empty string; configured time scans order by (timestamp, PK) from the first full run, then use tuple keyset comparison. Equal-time rows across batch_limit=1 were verified. Checkpoints do not advance past a failed target row. Mapping identity changes (source_id/table/PK/time/field mapping) invalidate incompatible cursors.
- CSV is explicitly <=10 MiB batch import with actual header/rows, unique/nonblank stable PK, conversion/required-value checks, and idempotent upsert. CSV is excluded from incremental scheduling. Full sync does not delete missing source rows; removing a source/mapping preserves existing ontology objects. UI states these semantics.
- Actual run_id/trace_id/start/end/status/counts/cursors/errors persist in existing ont_backing_datasource run_history. PG advisory lock prevents concurrent runs for the same tenant/class. Start is durable; loss of the process owner changes an abandoned running record to interrupted on subsequent observation/retry. The most recent 20 runs remain queryable, including original failure after retry; expired IDs return 404.
- UI renders real run metadata/history, and request finally blocks clear loading on failure; configuration cancel clears configuration state. No asynchronous server-side cancel endpoint was introduced.

## Exact API / persistence / package changes

- Source CRUD frontend sends actual {name,type,connection_config}; source write routes require platform.write. Schema remains {source_id,tables:[{name,columns:[{name,type,nullable?,primary_key?}]}],discovered_at,trace_id}; PG tables additionally carry schema.
- Backing declaration adds source_id and ts_column; kind distinguishes pg_table and csv, while dsn_env remains available for legacy declarations. Frontend matching DTO and BackingSyncResult were updated.
- Add GET /api/v1/ont/v2/object-types/{rid}/datasources/runs/{run_id}, operationId ontGetV2BackingSyncRun; tenant-scoped retained history response or 404. Scheduler status listing is tenant filtered.
- PgOntologyRepository._ensure_schema uses existing idempotent initialization/upgrade statements to add source_id TEXT nullable and run_history JSONB default []. Existing ts_column is reused. Only backing schema/upsert/load/run sections changed; Task4 model version/publication and ordinary relationship lock/write code were preserved.
- mate-tech-ont declares mate-tech-data workspace dependency; mate-tech-data declares psycopg2-binary>=2.9.0.
- Runtime OpenAPI reflects the additive DTO/route. Canonical data/ontology OpenAPI documents were not changed; controller should include these exact additions in its Task8 contract reconciliation.

## TDD evidence

All commands ran with PYTHONDONTWRITEBYTECODE=1. Test credentials were constructed only in process environment from the pre-existing dedicated PG container, never printed or written to this report.

1. RED: powershell -File .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-run-tests.ps1 initially showed 3 failing regressions: localhost:1 was incorrectly reported successful from saved status; public response exposed stored password; real CSV schema was missing. GREEN: actual connector/redaction/CSV behavior passed the focused script, subsequently included in the final 133-test suite.
2. RED: pnpm exec vitest run src/pages/arch/DataSourcesPage.test.tsx exposed random successful probe fallback and flat/wrong CRUD payload. GREEN: source API adapter tests passed.
3. RED: backing declaration regression rejected source_id; GREEN: additive DTO accepted source_id/time and persistent runtime tests passed.
4. RED: focused BackingDatasourcePanel test could not find “验证连接并发现字段” after unrelated lottie/canvas test-environment mocks were corrected. GREEN: six-step actual-field workflow passed. The initial canvas issue was environment setup, not counted as the feature RED.
5. RED: incomplete-source regression observed psycopg connect called with host/database/user None. GREEN: explicit required config rejects before connecting.
6. RED: real discovery failure in quality rule evaluation raised SourceError instead of a failed quality record. GREEN: specific regression and final whole related suite passed.
7. Additional restart/history/migration/self-review cases were added as verification; no claim that every final test was independently observed RED.

## Final verification scope and results

| Actual command / scope | Result |
| --- | --- |
| powershell -File .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-related-tests.ps1 | 133 passed, 45 warnings, 50.71s |
| pnpm exec vitest run src/pages/arch/DataSourcesPage.test.tsx src/pages/ontology/data/mappings/BackingDatasourcePanel.test.tsx | 3 passed, 1.31s |
| pnpm exec tsc --noEmit --pretty false (apps/web) | exit 0; empty successful log task-5-tsc.log |
| pnpm exec vite build --outDir ../../../.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-dist --emptyOutDir | exit 0, 11127 modules, 33.38s; existing >500 kB chunk warnings |
| powershell -File .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-ui-test.ps1 | 1 passed, 6.6s; final API restarted with final code |
| ruff check selected connector/repositories/backing files; git diff --check | passed |
| uv lock --check --offline (mate-platform-backend) | exit 0 |

The 133-test command ran all mate-tech-data/tests plus mate-tech-ont/tests/test_ont_data14_datasources.py, tests/integration/test_ont_data_sync_integrity.py and tests/test_ont_p1_sync_scheduler.py. All their PG environment variables pointed to the guarded dedicated database. Earlier related run was 125 passed/6 failed due obsolete fake Kafka/MySQL schema fixtures; those exact two existing test files were approved and corrected, then the full same related suite was rerun to 133 passed. This is not a complete backend monorepo test run. Warnings include inherited Starlette/httpx deprecation and fixture JWT key length; output is not pristine.

### Real PG / HTTP / restart evidence

test_mp11_connection_schema.py contains 8 focused tests; the actual PostgreSQL scenarios are concentrated in the discovery, full recovery chain and migration tests rather than eight separate live database tests.

- Real PostgreSQL wrong password, real restricted schema role, nonexistent requested table, valid discovered columns/PK/nullability and actual HTTP serialization prove error truthfulness/redaction. Localhost connection-refusal regression uses an actual refused endpoint. Lightweight DTO/incomplete-config tests include narrow mocks.
- SQL-backed registered source -> full Customer/Order -> integer-key batch size 1 -> actual update plus same-time new key -> incremental -> no-op is verified against persistent ontology objects.
- Source missing-table failure -> retry retains the failed run. A genuine target PG trigger rejects key 4; checkpoint stays before failure, removing trigger then retry syncs exactly that row.
- Actual CSV rows convert to integer properties; batch and replay preserve five order objects.
- Persistent LinkType and LinkInstance creation/query use the actual repository; browser acceptance also creates/queries the relationship through real HTTP.
- New Python child process resolves the persisted SQL source and target data. A separate actual child is terminated after durable running start; its injected pause is before the sync body (not a simulated database crash mid-transaction). A new child completes sync with five objects and retains the interrupted original run.
- Actual TestClient HTTP with real middleware/routes/PG queries failed and interrupted run IDs successfully. 21 actual additional runs establish exact retention of 20 and old-ID 404/new-ID 200. Time-mapping edit resets incompatible checkpoint.
- Fresh codex_mp11_upgrade_<random> DB initializes via PgOntologyRepository._ensure_schema. Dropping only the two new columns recreates the previous backing table shape; a new repository's same _ensure_schema adds them correctly. Legacy dsn_env actual connection still works. The simulated-old-schema fixture is not a full historical release database restore.

Retained example interrupted run: tenant mp11-bd19f771ac, class ont.mp11-bd19f771ac.obj.order, run_id 1d7f1a6d87de4970a37a69d29c61ff0d. Example retained UI failure: class ont.mp11-ingestion-ui.obj.order, run_id c08d885d58994d8fafbd8d3c9c55afba. Both are public run identifiers, not credentials. Test-created source schemas are subsequently cleaned; retained records document runs, and attempting to rerun those fixture bindings after cleanup may rightly fail. Use the retained UI source schema for renewed interactive acceptance.

### Actual browser chain and mock / identity boundaries

The appended “MP11 verified” Playwright test ran against dedicated Vite 9365 -> dedicated API 55508 -> PostgreSQL 55497/codex_mp11_ingestion without API route mocks. It exercised visible source probe/discovery, Task4 ObjectTypeEditorV2Drawer importing actual integer total field (plus existing default id), Customer/Order six-step mappings and sync, CSV file upload/batch, repeat/no-duplicate count assertion and actual relationship HTTP create/query. Screenshot: task-5-ui.png (trace/video disabled to avoid recording request credentials/content).

Vitest tests mock APIs and validate UI/adapter behavior only. Browser and backend HTTP tests use synthetic fixture JWTs with the existing local signature-bypass mechanism; actual middleware tenant/scope extraction runs, but this is not live Keycloak issuer/signature proof. Live IAM belongs to Task8. No production/shared login state was altered.

## Lock generation result

Initial uv lock --offline was blocked by unrelated uncached a2a-sdk resolution. Controller then approved official-PyPI uv lock --dry-run without --upgrade/--refresh/install. Dry run found existing local mate-tech-agent-team manifest version 2.1.0 against stale lock 0.1.0; controller verified BASE already had 2.1.0 and explicitly approved its correction. Generated with uv lock, then uv lock --check --offline passed.

Final uv.lock diff is exactly 5 added lines / 1 removed line:
- data package psycopg2-binary dependency and requires-dist;
- ont package mate-tech-data dependency and requires-dist;
- local editable agent-team version 0.1.0 -> 2.1.0.
No remote package version, source manifest outside owned files, or installation changed. Existing psycopg2-binary remains 2.9.12.

## Resource creation, cleanup and retained handoff

- Preserved original services 9200, 9361/58796, shared authentication/databases/containers and existing codex_mp11_relationship DB.
- Reused existing codex-mp11-relationship-pg only after checking exact container, 127.0.0.1:55497 binding and expected original DB. No pull/recreate/restart of that container.
- Created codex_mp11_ingestion and retained it for controller review/Task8. It contains synthetic test tenants and mp11-ingestion-ui, actual mp11_ui_source Customer/Order tables, source records, mappings and run histories. Credentials remain only server-side; bootstrap scripts derive them in memory and do not persist a secret value.
- All per-run codex_mp11_upgrade_* databases and per-test source schemas/restricted roles were cleaned in fixture finally blocks. Retained synthetic ontology/source records are intentional evidence, not shared production data.
- Dedicated API55508 and Vite9365 were stopped by verified recorded own launcher/process trees, never by port-wide kill. Final cleaned PID record task-5-cleaned-processes.txt: 59576,29540,64936,46560,35940,55252,49324,62480,64656. Earlier own API64780/26512 was stopped during controlled restart. Both dedicated ports had no listeners after final cleanup.
- Scratch *.pid files are historical and must not be trusted for future cleanup without process identity verification. To reproduce, use task-5-ui-start.ps1 then task-5-ui-test.ps1 after checking availability, and re-record any new process tree.
- Retained local evidence/scripts: task-5-run-tests.ps1, task-5-related-tests.ps1, task-5-ui-api.py, task-5-ui-start.ps1, task-5-ui-restart-api.ps1, task-5-ui-test.ps1, task-5-retained-runs.ps1, task-5-ui.png, safe stdout/stderr logs, empty tsc success log and separate task-5-dist output. Scratch is ignored and not part of implementation commit.

## Self-review and remaining concerns

Self-review found and corrected incomplete config falling back to machine defaults, SQL quality incorrectly resolving memory sources, CSV predictable validation timing, initial numeric PK scan, time-sorted first full scan, mapping-change cursor invalidation, secret preservation on edit and bounded interrupted/failed history persistence. No additional framework or review agent was created.

Supported scope is a single-column stable PK with an optional non-null timestamp and PostgreSQL/CSV; CSV is bounded whole-batch, and full replay is upsert rather than destructive rebuild. The timestamp cursor assumes the source updates its configured timestamp monotonically for changed rows. Deletion/tombstones and arbitrary composite keys are not implemented. Large existing pg_repo.py remains large; changes stay in its approved backing sections.

Remaining integration concerns: live IAM proof and canonical OpenAPI reconciliation above; actual source password-at-rest storage follows the pre-existing source store rather than adding an encryption/credential subsystem. Independent controller review still required before broader acceptance. No formal delivery/Gate/GA claim is made.

## Owned files

- `mate-platform-backend/packages/mate-tech-data/pyproject.toml`
- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/app.py`
- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/__init__.py`
- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/in_memory.py`
- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/sql_store.py`
- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/services/source_connector.py`
- `mate-platform-backend/packages/mate-tech-data/tests/test_app_data.py`
- `mate-platform-backend/packages/mate-tech-data/tests/test_data_governance.py`
- `mate-platform-backend/packages/mate-tech-data/tests/test_mp11_connection_schema.py`
- `mate-platform-backend/packages/mate-tech-ont/pyproject.toml`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/backing_datasources.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/sync_scheduler.py`
- `mate-platform-backend/uv.lock`
- `metaplatform-frontend/apps/web/src/api/ont/kernel.ts`
- `metaplatform-frontend/apps/web/src/api/ontology-bigdata.ts`
- `metaplatform-frontend/apps/web/src/types/ontology-bigdata.ts`
- `metaplatform-frontend/apps/web/src/components/shell/domains.tsx`
- `metaplatform-frontend/apps/web/src/routes/gov.tsx`
- `metaplatform-frontend/apps/web/src/pages/arch/DataSourcesPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/arch/DataSourcesPage.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/ontology/data/mappings/BackingDatasourcePanel.tsx`
- `metaplatform-frontend/apps/web/src/pages/ontology/data/mappings/BackingDatasourcePanel.test.tsx`
- `metaplatform-frontend/apps/web/tests/e2e/ontology-ia-v2-data-flow.spec.ts`


## Controller-requested canonical contract closure (2026-10-11)

Status: DONE_WITH_CONCERNS; canonical contract gap is resolved. Live IAM remains the explicit Task8 boundary; existing unrelated contract-validator errors are reported below.
Final contract commit: 6dbef678393f37a956472ba4a11d8fc4b3eb0219
Implementation commit remains 062c43592b240dea2d8a793cb6cd9a2f3b439719. This addendum supersedes the earlier statement that canonical OpenAPI reconciliation remained for Task8.

Owned files in this follow-up only:
- mate-platform-backend/contracts/openapi/services/data.yaml
- mate-platform-backend/contracts/openapi/services/ont.yaml

Missing-contract evidence before editing: the seven source operations used generic ApiResponse, create/update lacked requestBody, and SourceDiscovery/discovered_at/trace_id/public-config schemas were absent. ont.yaml had no datasource paths or backing/run DTOs. The exact scratch check, after correcting workspace import paths, failed with AssertionError: RED: canonical missing actual ontGetV2BackingSyncRun path. The earlier ModuleNotFoundError was harness setup, not feature RED.

Change: source create/update typed inputs, writeOnly credentials/CSV content, public config whitelist rejecting secret keys, actual unwrapped list/create/get/update/delete/probe/schema responses, safe errors and real discovery evidence. Added exactly three ontology paths /datasources (GET/POST), /datasources/sync (POST), /datasources/runs/{run_id} (GET), with the four actual runtime operationIds and request/declaration/run/cursor/count/failure/history DTOs. Documents PG/CSV kinds, source_id/ts_column, tenant source resolution, no environment fallback, CSV batch-only behavior, non-destructive full replay and 20-run expiry/404. No CDC, scheduler-health or unrelated missing paths were added. Other paths and old schemas compare equal to pre-edit YAML subtrees.

Permission accuracy: source CRUD writes and backing upsert/sync handlers enforce platform.write, and backing writes enforce the verified tenant RID. Source probe and reads require authenticated verified tenant but have no explicit write-scope requirement; the touched contracts now reflect this actual behavior rather than advertising a nonexistent write guard. No source or IAM implementation changed. Four actual FastAPI TestClient + auth middleware + real handler requests confirm HTTP403 for read-only upsert/sync and cross-tenant writer upsert/sync before any repository method can run. This uses synthetic local signature bypass, not live issuer proof; successful authorized writers were already covered in prior real PG/browser evidence and were not rerun.

Verification command from repository root (PYTHONDONTWRITEBYTECODE=1):
mate-platform-backend/.venv/Scripts/python.exe .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-contract-check.py
Final exit 0. Exact output:
- data: existing document validator 0 baseline errors, zero introduced
- ont: existing document validator 16 baseline errors, zero introduced
- PASS: 11 canonical operations match live router paths/methods; 4 backing operation IDs; 3 request DTO field/default/required sets; local refs; zero new document-validator errors; unrelated subtrees unchanged
- PASS: actual memory-CSV public/discovery/probe/error payloads and representative running/completed/interrupted schemas; public schema rejects secret keys
- PASS: 4 actual middleware/handler HTTP403 checks: readonly upsert/sync and cross-tenant writer upsert/sync; no repository access
- git diff --check for both contracts passed.

Used existing contracts/scripts/validate_contracts.py validate_document and compare_runtime.py normalize_path; JSON Schema validation checks concrete payloads using actual memory CSV adapter plus representative run records. This is a precise contract verification, not a new full PG run or full OpenAPI CI claim. The scratch script and pre-edit baseline JSON are retained for reproduction; no new test framework or committed test file. One inherited Starlette httpx deprecation warning remains.

The 16 baseline validator errors are four missing x-mate fields (owner, permission, requirements, implementation-status) on each of these existing operations: GET and POST /api/v1/ont/v2/object-types/wip, POST /api/v1/ont/v2/object-types/wip/{rid}/apply, DELETE /api/v1/ont/v2/object-types/wip/{rid}. Confirmed identical before and after this task; no unrelated repair made. Controller notified for its owning task. No new runtime processes, DBs, network calls, dependency changes or installs in this closure; prior cleanup/retained resource handoff remains unchanged.


### Task4 existing WIP metadata closure (separately authorized)

Controller subsequently authorized exactly the 16 missing x-mate fields on the four existing WIP operations above. This is Task4 contract metadata maintenance, not a Task5 feature. Added owner ontology-platform; permission ont.read for list and ont.write for save/apply/discard; actual MP11-ONT-02/08 requirements (plus MP11-ONT-03 for apply); implementation-status implemented, matching the already implemented handlers. No paths, request/response behavior, business source or Gate status changed.

Reran only the updated precise contract check after this new change. Final result: data validate_document 0 errors (baseline 0); ont validate_document 0 errors (baseline 16). All 11 operation/4 operationId/3 DTO comparisons, actual CSV payload validation and four actual handler HTTP403 checks remain PASS; unrelated subtree comparison explicitly allows only these 16 newly approved metadata fields. git diff --check passed. One inherited Starlette deprecation warning remains. The previous addendum's 16 baseline errors are now resolved, not deferred.

Contract chain commit: 6dbef678393f37a956472ba4a11d8fc4b3eb0219 (two approved YAML files).
Final metadata commit / HEAD: caf0b1f2f377beabbb66bb76d15fe11a88e3a2de.


## Fix round 1 — independent review I1/I2/I3/I4 (2026-10-11)

Status: DONE; ready for controller-limited re-review.
Fix BASE: caf0b1f2f377beabbb66bb76d15fe11a88e3a2de.
Fix commit: 841102f1af0085aa58474f029c7d74d29adde006.
No new framework, subagent or reviewer. Only six owned files changed; additional internal column, busy-conflict API/contract and source-read session lifecycle were explicitly approved by controller.

### I1: checkpoint identity, fixed source snapshot and active edits

Added nullable ont_backing_datasource.checkpoint_identity through PgOntologyRepository._ensure_schema. It is a SHA-256 digest of effective non-secret endpoint host/hostaddr/port, actual database/current_user, resolved namespace/relation/OID, kind, PK, configured time column and field mapping. Display name, password, raw DSN and SSL credentials are excluded. Resolving the actual relation incorporates data-affecting legacy search_path and effective role. No new credential storage.

Each run pins a deep-copied tenant-owned registered source or legacy environment DSN before preflight/reads. Current effective identity is compared with the checkpoint's durable identity; unknown/changed identities use an empty boundary, so older records in a newly targeted database are read. Old pre-upgrade cursors without an identity are conservatively rescanned once. Metadata is independent of the bounded run history. Default public list (and consequently run lookup) omits checkpoint_identity; only an optional keyword internal=True returns it for repository sync.

After reads, current source identity is checked again before checkpoint persistence. A changed/unavailable source clears the old checkpoint, marks the actual run failed with source_changed diagnostic, retains actual partial synced counts, and directs retry to rescan current data. The stored checkpoint always has its own identity, so any subsequent edit is also detected before the next read. It does not pretend that already committed target rows were rolled back. Full sync/retry still upserts and preserves rows missing from the current source.

Mapping upsert and sync share the tenant/class advisory lock. Mapping changes fail immediately with BackingSyncBusyError while a sync owns it; no waiting/deadlock or stale run overwriting an edited mapping checkpoint. Backing upsert/sync API map that error to HTTP409, with existing tenant/write guards preserved. ont.yaml declares the two 409 responses. Existing frontend failure handling retains input and releases loading; UI/build were not changed or rerun.

Real evidence:
- Same registered source_id, same qualified table, changed database with 2020 timestamps after syncing 2026 timestamps: one older row is ingested, not falsely reported as an empty successful increment.
- Same legacy dsn_env retargeted to a different database: older row is read.
- Legacy DSN search_path changes between two same-named tables in one isolated DB: initial public.orders key99 then configured-schema orders key21 are both observed, despite key21 being below the old boundary.
- Source edited either before the pinned engine starts reading or immediately after it reads: old snapshot yields exactly two original rows, reported synced=2/failed=1, cursor cleared; retry reads one current-dataset row.
- Mapping edit while sync holds the actual PG advisory lock is rejected; separate real HTTP checks return409 for mapping save and sync while leaving priority unchanged.
- Own restricted PG role's actual password is rotated, source display name changed: effective digest stays equal and a no-op incremental stays synced=0.
- Fresh/previous schema shapes include the new column through _ensure_schema. The existing real terminated-child/new-process recovery test now asserts restored PG checkpoint identity and absence from public declarations. CSV deliberately has no incremental checkpoint identity.

Necessary associated lifecycle correction:
The first related round was 38 passed/1 failed: the existing 21-run history loop encountered a safe NETWORK failure after the additional source re-reads. Investigation found sql_store.get_source left its SQLAlchemy Session checked out and relied on GC. A deterministic real-PG pool_size=1/max_overflow=0/pool_timeout=0.1 regression retaining Session references failed with QueuePool TimeoutError. Only get_source now scopes its Session with a context manager and fully materializes the tenant-filtered DataSource before close. No lazy ORM row is returned. Successful reads, absent ID, cross-tenant ID and conversion exception all return the pool to zero checked-out connections. No other repository lifecycle was refactored.

### I2: recover only fresh history after lock ownership

After a possible running record is observed, recovery acquires the actual sync advisory lock and re-reads current declarations FOR UPDATE with tenant/class filtering. Only fresh still-running entries become interrupted; it never writes the stale pre-lock JSON snapshot.

Deterministic actual-PG interleaving changes the observed running run to failed with original counts/error and appends a newer succeeded record immediately before recovery acquires the advisory lock. Both exact terminal records survive. A separate actual live-owner test preserves running while the lock is held and marks the same record interrupted after its owner releases the lock. The existing real process termination/new-process recovery test remains included.

### I3: schema-qualified registered PG names and resolved identifiers

Registered PG bare table names now fail preflight with SourceError error_code=SCHEMA and message “PostgreSQL table must be schema-qualified in the configured schema” (HTTP422 via existing backing preflight handler). Qualified names must match the discovered configured schema. Identifier components are retained separately; a discovered table whose name contains a dot is quoted as a single relation component, not split into an accidental third qualifier.

Real isolated DB has public.orders key99 and the configured schema's orders key21. Bare orders is rejected with zero target writes; qualified configured-schema form imports only key21. An additional actual table named orders.detail imports only key31 through its two correctly quoted components.

### I4: normalize CSV target PK before checking uniqueness/writing

CSV value conversion uses the primary property's type for the key column, converts each selected column once, then tests the exact string identity consumed by apply_cdc_changes for nonblank/uniqueness. Integer input 01 and 1 collides after normalization and fails actionable preflight; the batch path performs the same check before writing any row. Actual PG target stays empty on that failed batch. Replacing the fixture with legitimate keys1/2 permits two imports and a repeated batch, with exactly two persistent objects.

### RED / GREEN commands and scope

All commands use PYTHONDONTWRITEBYTECODE=1 and the guarded 127.0.0.1:55497/codex_mp11_ingestion target. Secrets remain process/server-side and are not logged in report.

- RED: powershell -File .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-fix1-tests.ps1 => 7 failed,1 passed,8 deselected. Expected failures: same-source/legacy retarget both falsely synced0, active mapping edit failed to raise, source edit returned succeeded, recovery replaced terminal history with interrupted and dropped newer run, bare PG name accepted, normalized CSV collision accepted. Active-owner/abandoned recovery test already passed.
- Initial GREEN after bounded fixes: same script => 8 passed. Added snapshot timing/password/409 coverage => 11 passed. These are intermediate scopes, not the final suite.
- Extended original recovery test initially failed because its new private-identity assertion selected alphabetically first CSV mapping; corrected to inspect PG mappings. It did not indicate a runtime identity failure. The subsequent first related run was 38 passed/1 failed due the source Session lifecycle above.
- Pool RED: task-5-fix1-pool-tests.ps1 => 1 failed/21 deselected, real QueuePool size1 overflow0 timeout0.10 on second read. GREEN after get_source fix => 1 passed/21 deselected.
- Final related command: powershell -File .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-fix1-related-tests.ps1 => **53 passed,2 warnings in56.77s**. Exact files: mate-tech-data/tests/test_mp11_connection_schema.py (22 cases), mate-tech-data/tests/test_data_sql_store.py, mate-tech-ont/tests/test_ont_data14_datasources.py, tests/integration/test_ont_data_sync_integrity.py, tests/test_ont_p1_sync_scheduler.py. DATA14_PG_DSN/SYNC_IT_PG_DSN/P14_PG_DSN all pointed to the dedicated DB. No all-backend or all-data-package pass is claimed.
- After that process started, controller requested explicit not-found/exception Session-release assertions. Added them to the one pool test, then ran only task-5-fix1-pool-tests.ps1 => **1 passed,21 deselected,1 warning in0.67s**. The 53-pass run is not misrepresented as having executed those later-added assertions.
- Existing scratch task-5-contract-check.py => exit0: both complete validate_document checks zero;11 operations/4 backing operationIds/3 DTOs aligned; actual memory CSV public/error payloads and4 real middleware/handler403 checks passed. New real-PG busy HTTP409 assertions are in the53-test scope.
- Ruff check: backing_datasources.py, test_mp11_connection_schema.py, sql_store.py => all checks passed. Scoped git diff --check passed.
- No unchanged frontend build, browser acceptance, package lock or broad monorepo test was repeated.

### Resource handoff and M1

Created only per-test source_* schemas/restricted mp11_reader_* roles and per-run codex_mp11_retarget_* / codex_mp11_upgrade_* databases within the already approved dedicated PG. Fixtures cleaned them on success/failure. Final task-5-fix1-cleanup-check.ps1 actual catalog query returned: per_run_databases_remaining=0, test_source_schemas_remaining=0, test_reader_roles_remaining=0. Test Python subprocesses were communicated/terminated by their recorded handles. No API/Vite launcher was restarted, no new container created, and no port-wide kill performed.

Retained codex_mp11_ingestion has synthetic ontology/source/run metadata and the new private checkpoint column for review; test source schemas are gone, so replaying old disposable-fixture mappings can correctly fail. Existing scheduler integration scans the dedicated DB and may append source-unavailable failed runs to those retained disposable bindings; this does not modify the original relationship DB. Protected9200,9361/58796, shared authentication/containers,55497 container and codex_mp11_relationship remain unchanged.

M1 remains explicitly owned by Task8 integration verification: inherited Starlette/httpx deprecation and fixture JWT short-key warning, plus previously reported Vite chunk warnings. Nothing was upgraded, hidden or reclassified as pristine; no live IAM claim.

### Fix1 owned files

- mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/sql_store.py (get_source session lifetime only)
- mate-platform-backend/packages/mate-tech-data/tests/test_mp11_connection_schema.py
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/backing_datasources.py
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py (approved backing schema/store/run sections only)
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py (backing busy409 only)
- mate-platform-backend/contracts/openapi/services/ont.yaml (two backing409 declarations only)
