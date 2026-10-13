# Task 5 independent review

## Spec Compliance

**❌ Issues found.** Real PG/CSV source discovery, mapping, sync and persistent history are implemented, but four concrete defects remain: changing a registered source in place can reuse an incompatible cursor; recovery can overwrite a completed run with stale interrupted metadata; an accepted unqualified table can resolve differently during preflight and SELECT; CSV primary-key conversion can silently collapse distinct input rows.

Scope: BASE `fc2c8f2136a6cc3c541228206f202e6bd006b5f1`, HEAD `caf0b1f2f377beabbb66bb76d15fe11a88e3a2de`; three commits, 27 files. This is a Task 5 gate, not a whole-branch review.

**⚠️ Integration boundary:** real issuer/signature/login proof remains Task 8 ownership. `task-5-report.md:77` explicitly identifies fixture JWTs and local signature bypass. These tests do not establish real IAM acceptance, and that authorized boundary is not counted as a Task 5 omission.

## Strengths

- Selected-store source resolution now precedes genuine discovery/probe. Public serialization uses a shared whitelist, and blank/display-mask secret edits preserve the server value: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/__init__.py:129`, `repositories/in_memory.py:466`, `repositories/sql_store.py:530`, `services/source_connector.py:46`. Browser fake success/schema fallbacks were removed (`metaplatform-frontend/apps/web/src/api/ontology-bigdata.ts:289`).
- Actual PG schema/table privilege and field inspection, CSV content parsing, tenant-owned source resolution and no environment fallback are concrete implementations (`mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/services/source_connector.py:135`; `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/backing_datasources.py:94`). Backing write handlers enforce tenant and platform.write (`v2_kernel/api.py:772`, `:849`), matching the appended HTTP 403 evidence.
- Time-column DTO/persistence/query order, durable run start, bounded history and actual fresh/upgrade initialization are wired through existing modules (`v2_kernel/backing_datasources.py:339`, `v2_kernel/pg_repo.py:390`, `:5081`, `:5114`). Existing failed-row checkpoint behavior is retained; the findings below concern specific unhandled boundaries.
- The source page is mounted and visible, links to the existing ontology mapping page, and uses real discovery, explicit mapping confirmation and persisted key/time parameters. History renders real IDs/errors/counts and the explicit 20-run limit (`metaplatform-frontend/apps/web/src/routes/gov.tsx:38`, `src/components/shell/domains.tsx:255`, `src/pages/arch/DataSourcesPage.tsx:24`, `src/pages/ontology/data/mappings/BackingDatasourcePanel.tsx:56`).
- Database tests and the actual browser chain cover substantially more than mocked UI behavior, including Task 4 field import, retries, restart, retained run IDs and relationship operations (`mate-platform-backend/packages/mate-tech-data/tests/test_mp11_connection_schema.py:1`; `metaplatform-frontend/apps/web/tests/e2e/ontology-ia-v2-data-flow.spec.ts:70`). Canonical source/backing contracts and the separately authorized Task 4 metadata closure are included. Package/lock changes match the approved dependency scope.

## Issues

### Critical — 0

None identified in this task-scoped review.

### Important — 4

**I1 — Source retargeting under the same source_id retains the old dataset's checkpoint.**

- Evidence: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/sql_store.py:530` and `repositories/in_memory.py:466` merge connection edits under the same ID. `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:4827` invalidates only when `(source_id, table_name, pk_column, ts_column, field_mapping)` changes. `pg_repo.py:5191` supplies the old persisted cursor to sync.
- Trigger: sync database A through timestamp T, then edit that registered source's host/database/DSN to database B with the same schema/table/columns and older records. The binding and source_id stay unchanged. Structural preflight passes, incremental SELECT begins after A's T, and B's rows at or below T are silently skipped. Re-saving the same binding does not invalidate it either. The existing regression changes ts_column, which is a different case.
- Required fix boundary: couple checkpoints to effective non-secret source identity/revision and invalidate or require explicit full resync on dataset retargeting. Include legacy dsn_env identity in that reasoning, since it is also absent from the invalidation tuple. Coordinate source/mapping changes with an active sync so an old run cannot write its checkpoint back after invalidation. A revision must distinguish identity changes from harmless display-name/credential rotation if those preserve the dataset.
- Verification: same source_id, same qualified table/mapping, different real database/host with older source timestamps; assert all expected target rows arrive or an explicit resync-required response is returned before any success. Add an edit-during-run boundary case for checkpoint persistence.

**I2 — Recovery overwrites terminal run evidence from a snapshot read before acquiring the lock.**

- Evidence: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:5061` reads declaration/history first; `:5065` subsequently attempts the advisory lock; `:5072` marks the previously read record interrupted and `:5073` replaces the JSON history with that snapshot.
- Trigger: GET/list reads run R as running; R commits its succeeded/failed result and releases its lock; GET now obtains the lock and writes its older running snapshot as interrupted. Completed counts/error information, and potentially newer entries, are lost. The terminated-child regression proves abandoned-run recovery but not this completion/read interleaving.
- Required fix boundary: after owning the advisory lock, re-read current history under the appropriate row lock and transition only entries still running in that fresh state, or apply an atomic conditional transition. Never replace history using the pre-lock observation.
- Verification: deterministically complete R between the first history read and recovery lock acquisition; assert its final status/counts/errors and any new history entries remain intact. Retain proof that a truly abandoned running record becomes interrupted and that a genuinely active owner is not disturbed.

**I3 — Bare table acceptance can preflight one schema and import another.**

- Evidence: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/backing_datasources.py:118` accepts either the discovered bare name or qualified name. `:339` creates the SQL identifier directly from the submitted ds.table. `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/services/source_connector.py:67` connects without applying the configured discovery schema as search_path.
- Trigger: registered source configuration says schema=sales and the binding sends table=orders. Preflight checks sales.orders; the actual SELECT queries "orders" using the connection search path. With a compatible public.orders and the usual public path it imports the wrong data; without such a relation it fails after successful preflight. The UI sends a qualified name, but the backend explicitly accepts the unsafe bare-name form.
- Required fix boundary: resolve/persist/query exactly the discovered schema-qualified relation, or consistently reject bare PG table names before saving. Preserve SQL identifier components instead of treating unchecked dotted strings as the resolved identity.
- Verification: two schemas with same-named tables and distinct rows; submit the bare-name case and assert explicit rejection or ingestion only from the configured schema. Ensure the qualified form and safe identifier handling still work.

**I4 — CSV uniqueness checks raw keys, then conversion merges distinct rows.**

- Evidence: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/backing_datasources.py:177` tests raw string uniqueness; `:191` converts integer properties in place, including PK. _csv_batch sends the converted key to apply_cdc_changes, which derives target identity with str(pk) at `:609` and counts every successful input at `:651`.
- Trigger: integer-key mapping imports `id,total\n01,10\n1,20\n`. Raw 01 and 1 are unique; both normalize to integer 1. The second input overwrites the first, while sync reports two synchronized rows and zero failures.
- Verification performed: one narrow in-memory probe executed the actual _prepare_csv_rows, _csv_batch and apply_cdc_changes bodies with synthetic source/target adapters. It confirmed synced=2, failed=0 and only target key 1 with total 20. This was not a real PG acceptance test and touched no service/database.
- Required fix boundary: canonicalize the target identity once, then validate nonblank/uniqueness after normalization and before writes. Reject collisions with actionable precheck diagnostics. Cover 01/1 and preserve valid replay idempotence.

### Minor — 1

**M1 — Reported verification output retains inherited warnings.**

- Evidence: `.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-5-report.md:48`, `:51`, `:56`, `:171`: 45 backend warnings (reported inherited Starlette/httpx and fixture JWT key length), large Vite chunk warnings and the contract-probe Starlette warning.
- Record as Minor, not pristine output and not a newly failing Task 5 test. Recommended exact follow-on: Task 8 integration verification, with shared test-fixture maintenance for deprecations/JWT warning and frontend build-baseline maintenance for chunk warnings. Do not expand the four-defect patch into unrelated upgrades. The earlier 16 canonical metadata errors were resolved in the final addendum and are not an open issue.

## Requirement and file coverage

Every initial mandatory file has a corresponding hunk:

| Required file/group | Reviewed implementation |
| --- | --- |
| mate-tech-data api/app.py | Real schema diagnostics and source write scopes |
| `repositories/__init__.py` | Selected-store source resolution before connector |
| repositories/in_memory.py and sql_store.py | Real quality diagnostics, disconnected initial state, preserve-on-edit and public serialization |
| frontend api/ontology-bigdata.ts and types/ontology-bigdata.ts | Actual CRUD/adaptation/schema shape, no fake success/schema fallback |
| frontend routes/gov.tsx and components/shell/domains.tsx | Mounted visible source route |
| DataSourcesPage.tsx and .test.tsx | Source CRUD/probe/discovery, CSV upload, adapter regressions |
| BackingDatasourcePanel.tsx and .test.tsx | Actual-field mapping, key/time confirmation, precheck, persisted outgoing DTO and real runs |
| test_mp11_connection_schema.py | Actual connectors, SQL sources, sync/retry/restart/history/migration |
| ontology-ia-v2-data-flow.spec.ts | Actual browser importer, mapping, PG/CSV and relationship chain |

Approved extensions are present and task-related: narrow shared connector; backing engine, scheduler, backing API and PG store; frontend kernel DTO; two package manifests and generated lock metadata; two obsolete fixture test corrections; canonical data.yaml/ont.yaml and explicitly approved WIP metadata. No unrelated source module expansion was found.

CSV is explicitly batch-only and excluded from scheduling; full replay is non-destructive upsert and its delete semantics are stated. Actual run IDs/start/end/status/trace/counts/cursor/error records persist, and retained failures are separate from later retries. UI history labels the 20-run limit and renders absent in-progress counts as unavailable. No asynchronous server cancellation was claimed; request finally blocks clear loading on success/failure. Task 4's real field importer is covered by the browser chain without claiming full Task 4 publication/version/relationship revalidation.

## Review evidence and limitations

- Read the instructions, task-reviewer rubric, brief, global constraints, full implementation report with both contract addenda, and named Task 5 preflight sections.
- Read all 4869 lines of review-fc2c8f21..caf0b1f2.diff once in nonoverlapping complete blocks: **1–500; 501–1250; 1251–1850; 1851–2450; 2451–3050; 3051–3650; 3651–4250; 4251–4869**. No output was truncated. No git command or full-repository crawl was used.
- Supplementary reads were restricted to named risks: existing row-write/error handling at backing_datasources.py:458–569; cursor persistence omitted by the diff's final sync hunk at pg_repo.py:5176–5226 (adjacent existing CDC context was returned by that narrow range); normalized CSV PK consumption at backing_datasources.py:585–666. A targeted search located exact line references. The CSV probe parsed the file only to execute its three named function bodies; it did not import/run the application.
- Source connection diagnostics use fixed safe messages and schema discovery returns metadata instead of row samples. The unchanged target row-write helpers inspected above retain raw exception formatting; no claim is made that this task review is a complete security audit of inherited ontology error/log paths.
- Existing reported evidence was not regenerated: **133 backend, 3 Vitest, 1 actual browser**, tsc/build, lint/diff, lock and canonical checks. The final addendum reports 11 canonical operation matches, 4 operation IDs, 3 DTO comparisons, public CSV/run schema validation and four middleware/handler 403 checks, with final data/ont document validation both zero. None of these checks was rerun.
- Fresh/upgrade tests use actual initialization against fresh and prior backing-column shapes, not a full historical-release restore. Terminated-process evidence pauses after durable running start, not midway through a target-row transaction. These boundaries remain explicit.
- No implementation source/index/HEAD/branch mutation was performed. This authorized scratch report is the sole review artifact. Default exec/apply helper failures required narrow elevated calls; no automatic approval policy rejection occurred.

## Assessment

**Task quality: Needs fixes.** Counts: **Critical 0 / Important 4 / Minor 1**.

The actual PG/CSV chain and canonical alignment have substantial evidence. The four important gaps can skip a retargeted dataset, corrupt completed run evidence, import from an unintended relation, or silently overwrite a CSV record; approval requires their bounded fixes and focused regressions.
