# Task 4 implementation report

Working checkout: `D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform`, branch `codex/product-v1.1`; starting HEAD `4253a4fe008cc94467245f8c629800f54db2f8ee`.

## Delivered behavior

- Backwards-compatible ObjectType `create_only` opt-in; default upsert remains an update. Strict intent survives schema-WIP save/list/restore/apply. Same RID and competing creation return structured 409 without modifying the winner. Pg row/advisory locks and SQL conflict refusal protect the actual write; InMemory uses its object lock.
- Actual WIP is distinct from status metadata. Verified auth context supplies author; runtime `platform.write` protects the requested ObjectType mutation routes and WIP mutations. Existing tenant identity/scope machinery is reused. WIP listing and inspection explicitly filter tenant. Greedy generic DELETE route moved behind WIP DELETE, retaining paths and operation IDs.
- Optimistic baseline captured when editor opens and in WIP storage, retained on ordinary resave, checked atomically with publication. Explicit compared-checksum retry uses the existing apply override. Draft restore, undo, conflict comparison, retry, locating existing type, and candidate cancel/continue/reuse preserve inputs; unsaved sources never invoke persisted-source merge.
- Progressive basic/advanced form, accessible name/identifier fields and local property/PK validation, actual property rows, draft restoration and real publish/preflight are functional. Source fields use actual backend `tables[].columns[]`; absence of `discovered_at` is reported as unverified and retryable, never accepted as seeded discovery.
- Edit impact uses existing migration assessment plus same-tenant `GET /classes/{class_rid}/inspect` ActionType.on references. Failed inspection explicitly shows unknown references and prevents publish. New unpublished types state no historical usage. Task6 owns real AppHub references, described below.
- Same-family Pg supersede rebinds both LinkType endpoint references transactionally before existing PR95 instance migration. Tenant schema shared lock for definition writes/exclusive supersede prevents phantom relationship definitions; endpoint versions are re-read after shared lock. Existing Task1 runtime link locks/structural checks are preserved; runtime instance write lock scope was not expanded.

## TDD evidence

All paths below are relative to the report directory unless stated. Runner logs contain no DSN/token values. Commands run from checkout root, except UI commands from `metaplatform-frontend/apps/web`.

- Initial RED: `& .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-4-test.ps1` → `task-4-red.log`: 15 failed, 2 passed, 1 skipped. Strict-new was ignored, readonly mutation allowed, checksum interleaving overwrote, and actual Pg old LinkType src v1 mismatched migrated individual v2. This real Pg failure preceded supersede changes.
- Follow-up RED `task-4-red-followup.log`: 4 failed, 18 passed, 2 skipped (WIP DELETE intercepted, InMemory metadata checksum incomplete, concurrent new relationship retained archived endpoint). Fixed route precedence, full canonical checksum, and shared/exclusive schema lock with post-lock endpoint validation.
- Scope RED `task-4-scope-red.log`: readonly ObjectType auxiliary mutations were allowed. Narrow existing-scope guards added with corresponding negative tests.
- Mixed tenant inspect RED `task-4-action-red.log`: 2 failed, 36 passed, 2 skipped; real ActionType.on matching and explicit same-tenant filters added. Tests mix another tenant's referencing action into returned catalogs and reject cross-tenant inspected RID.
- UI RED `pnpm exec vitest run src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx` → `task-4-ui-red.log`: six expected behavior failures. Follow-up restore RED `task-4-restore-red.log`: changed slug left restored property RID behind. Follow-up impact RED `task-4-impact-red.log`: missing explicit unknown action-reference state (1 failed, 11 passed); fixed and covered.
- SQL race RED `task-4-sql-red.log`: 1 failed, 39 passed, 4 skipped, `DID NOT RAISE ObjectTypeAlreadyExistsError` after a second real psycopg connection inserted without advisory locks immediately before strict INSERT. SQL conflict condition now refuses update even for this old-writer race.

## Final verification

- `& .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-4-affected.ps1`: **150 passed, 4 skipped**, 39.66 s (`task-4-affected.log`). Runs owned creation tests plus relationship writes, G33 WIP gate, version mechanism, migration plan, kernel dedup/API dedup, and G8 version ops. Real Pg envs `MP11_OBJECT_PG_DSN`, `MP11_RELATIONSHIP_PG_DSN`, `PG_DSN`, `VER_PG_DSN` all target one per-run disposable DB on 55497, never live/default DB. All four skips are InMemory-only: supersede source and destination cases (2), Pg schema-lock race (1), raw SQL conflict race (1); their corresponding Pg cases run and pass.
- `pnpm exec vitest run src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx src/pages/ontology/model/link-types/LinkTypesPage.test.tsx`: **24 passed, 2 files** (`task-4-ui-final.log`). UI unit transport is mocked. This does not claim real data-source discovery.
- `pnpm run typecheck`: passes (`task-4-typecheck.log`). A newly added test fixture lacked required property title; fixed before final pass.
- `pnpm run build`: passes, Vite 6.4.3 (`task-4-build.log`); existing large chunk warnings remain.
- OpenAPI YAML parsed; 65 operationIds, all unique. Existing DTO/operation IDs retained; optional new intent/baseline parameters documented.
- Real browser command: `& .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-4-e2e.ps1`, owned spec `tests/e2e/ontology-object-creation-flow.spec.ts`. API+Pg+Vite, no route mocks: saved WIP survives refresh, author/new intent verified, a competing create wins, draft publish409 leaves full winner DTO intact, second draft validates/publishes and real API query returns its name. Native-history extension also passes as detailed below.
- Full frontend suite intentionally not rerun: known baseline ProposalConfirmDrawer fixture issue belongs to Task8.
- Output is not pristine: existing FastAPI on_event/Starlette httpx warnings and local fixture HMAC-length warnings, browser FORCE_COLOR/NO_COLOR warning, Vite large chunks. No assertion failures in final backend/UI/build results.

## Owned commit files

1. `mate-platform-backend/contracts/openapi/services/ont.yaml`
2. `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/api.py`
3. `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py`
4. `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
5. `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
6. `mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_object_type_creation.py`
7. `metaplatform-frontend/apps/web/src/api/ont/kernel.ts`
8. `metaplatform-frontend/apps/web/src/pages/ontology/OntologyModelingPage.tsx`
9. `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx`
10. `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx`
11. `metaplatform-frontend/apps/web/src/pages/ontology/model/object-types/ObjectTypesPage.tsx`
12. `metaplatform-frontend/apps/web/tests/e2e/ontology-object-creation-flow.spec.ts`

Parent expressly authorized protocol, contract and new E2E additions; also narrow route-order, inspection filtering and auxiliary mutation scope guards. Report/runners/logs under ignored `.superpowers` remain local and are not source commit files. Parent's plan.md, tracked generated pycache, existing PNGs/worktrees/docs/examples never staged or reset.

## Identity, resource and integration boundaries

- Tests exercise real runtime tenant/scope parsing with existing JWT fixture signature bypass. This is not live Keycloak authentication verification; no IAM system added. E2E uses existing isolated `mp11-relationship-api.py` session helper, tenant-specific test token in disposable browser storage, no external users contacted.
- Pg container `codex-mp11-relationship-pg` is controller-owned, bound exclusively to 127.0.0.1:55497. Runners verify identity and binding, create fresh `codex_mp11_object_<uuid>` or `codex_mp11_ui_<uuid>` DB, and drop only their created DB in finally. Credentials only read into process memory, never printed. PYTHONDONTWRITEBYTECODE=1. No writes to 5432/live databases.
- E2E API 55498 and Vite 55499 use task-owned process trees; cleanup targets saved launcher PIDs only, no port-kill. Current preview9200 PID52012 and website9361 PID58796 are preserved; final cleanup evidence follows below.
- Task5: actual source discovery remains dependent on genuine discovered_at/trace_id backend contract. Importer already reads `{source_id,tables:[{name,columns:[{name,type,nullable?,primary_key?}]}],discovered_at}`. Seed schema lacking discovery evidence is explicitly rejected. Actual source-to-property end-to-end evidence belongs to Task5/8.
- Task6: integrate authoritative same-tenant app reverse references into `ObjectTypeEditorV2Drawer` preflight alongside `assessMigration`/`inspectObjectType`; extend narrow `src/api/ont/kernel.ts` wrapper or AppHub client. Display actual app bindings and unknown/retry on failure. Current pending label is NOT ONT-03 completion. Task8 validates app/action list end-to-end and integrates new E2E spec into versioned runner/CI.
- Local evidence only; no formal release, GA, deployment, live identity, or full Goal completion claim.

## Native-history closure and final handoff

- Real RED `task-4-history-red.log` (after correcting the test URL to the actual `/ontology` overview route): real UI navigation `/ontology` -> “去语义模型” -> new unsaved form -> browser `page.goBack()` removed the input with no prompt. Assertion failed because 业务名称 was no longer mounted. `beforeunload` does not cover this same-document popstate path.
- Narrow fix remains in the owned editor module: register a guard before BrowserRouter's synchronous listener using the already-eager ontology route import; activate only during open dirty draft. On cancel, stop Router notification and restore `history.state.idx`; suppress that restoration event so Router and form stay consistent. Confirmation permits normal navigation. Existing push/replace/refresh/close protections remain. HMR disposal removes the registration. Future conversion of ontology routes to lazy imports must preserve this early registration contract.
- Final real browser GREEN `task-4-e2e.log`: **1 passed, 8.2 s** (scenario 7.2 s), including full prior save/restore/strict publication flow plus close cancellation, native back cancellation preserving business-name input and original URL, then native back confirmation reaching `/ontology` with drawer gone. No mock transport. Temporary numeric history diagnostics removed before final run.
- Final E2E launcher PIDs API48456/Vite49316, isolated DB `codex_mp11_ui_fa21b25509354785972199174a020b73`, tenant `mp11-ui-68124c28631447ad9073a96d6870efc2`; runner finally terminated only own trees and dropped this DB. Final cleanup rechecked before commit.
- Final focused UI suite **24 passed / 2 files**, 12.22 s (`task-4-ui-final.log`); final typecheck and production build re-run after native history fix. `git diff --check` has no whitespace errors (only parent plan CRLF notice).
- Self-review repaired SQL-level non-advisory strict-new race, canonical InMemory metadata checksum, route order, restored property identity, real action unknown-state handling, and native history event ordering. No unresolved Task4 correctness issue is known; independent review remains required. Task5 actual discovery and Task6 app references retain their explicit cross-task boundaries.

Final current HEAD / owned commit: 1a3bfebc30e3c92fc6eb1eda0afd65e54d5117db — fix(ontology): preserve creation intent through draft publication. 12 owned files only. Final production build completed in 24.14 s. Cleanup catalog lists only codex_mp11_relationship; 55498/55499 have no listeners; owned final launcher PIDs absent; 9200 PID52012 and 9361 PID58796 preserved.

## Fix round 1/5 — independent review I1/I2

Base `1a3bfebc30e3c92fc6eb1eda0afd65e54d5117db`. Read `task-4-review.md`; implemented only its two Important findings plus controller-authorized stale write-fixture correction. No delegated agent or new independent review was launched.

### I1: edit-set versus supersede lock cycle

- RED command: `& .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-4-fix1-pg.ps1`; log `task-4-fix1-pg-red.log`: **1 failed, 1 skipped, 46 deselected**. Actual `psycopg2.errors.DeadlockDetected`: publisher waited for the edit-set's individual transaction while edit-set waited for publisher's relationship advisory lock. Failure occurred updating `ont_individual` during supersede.
- New regression uses public `apply_edit_set_now` with ordered set_property + add_link, holds at the actual individual FOR UPDATE, starts supersede on a second real connection, and observes `pg_blocking_pids` before resuming edit-set. Both actors use the requested tenant. A third read-only observer connection determines the barrier rather than assuming a scheduling delay. Bounded statement timeout and finally release prevent stranded transactions.
- Fix: `_execute_edit_set_proposal` obtains existing tenant shared schema-definitions lock in its transaction before the first operation/individual lock. Supersede's existing exclusive schema lock now serializes these whole transactions; ordinary `create_link_instance` is unchanged. No additional runtime link-instance lock scope or new lock system.
- Same test GREEN: **1 passed, 1 skipped, 46 deselected**, 1.43 s (`task-4-fix1-pg-green.log`). Confirms both commits, edited property retained, individual moved to v2, LinkType references v2, and traversal reaches linked peer. Only InMemory parameter is skipped, real Pg executes.

### I2: compared checksum lost at destructive confirmation

- RED command from web directory: `pnpm exec vitest run src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx`; `task-4-fix1-ui-red.log`: **2 failed, 12 passed**. Third onSubmit request expected checksum B but received old baseline.
- Fix: store checksum alongside pending destructive confirmation and pass it in confirm-name resubmission. Clear pending checksum when form resets/confirmation cancels/submission starts. Error responses clear old latest comparison, requiring another compare after a new conflict.
- Tests cover A -> conflict -> compare B -> destructive confirmation -> successful close with original input retained; second variant inserts another conflict at confirmation, requires comparison C, then confirms with C and succeeds. One intermediate test run exposed an unused mockResolvedValueOnce(C) leaking into the next case; each combined test now resets that mock and onSubmit before arranging its sequence.
- Final GREEN: **14 passed / 1 file**, 9.99 s (`task-4-fix1-ui-green.log`). `pnpm run typecheck` passed (`task-4-fix1-typecheck.log`); `pnpm run build` passed in **20.88 s** (`task-4-fix1-build.log`). No whole frontend suite or unrelated E2E rerun. Prior real browser proof remains scoped to the previous report, not newly relabelled as this round's run.

### Affected regressions and fixture repair

- Command: `& .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-4-fix1-affected.ps1` runs `test_mp11_object_type_creation.py`, `test_mp11_relationship_writes.py`, `test_ont_act05_edit_set.py`, `test_ont_act05_unified.py`.
- All Pg fixture env names (MP11_OBJECT_PG_DSN, MP11_RELATIONSHIP_PG_DSN, ACT05_PG_DSN, ACT05U_PG_DSN and existing PG_DSN/VER_PG_DSN) explicitly point to the same generated `codex_mp11_object_<uuid>` database at 127.0.0.1:55497. No fixture fell back to its 5432 default. Same container/binding guards, secret redaction, PYTHONDONTWRITEBYTECODE and finally drop as previous run.
- First affected run: **121 passed, 5 skipped, 2 failed** (`task-4-fix1-affected-fixture-red.log`). Existing TestC8Delete tests expected valid soft-delete200/hard-delete-instance409 but their direct RequestContext fixture had empty scopes, so Task4's already-approved runtime platform.write guard returned403.
- Controller approved a narrow additional file change to `mate-platform-backend/packages/mate-tech-ont/tests/test_ont_act05_unified.py`: parameterize helper scopes (default still empty), add s3_write_client with platform.write, use it only in these two legitimate writes. Existing 200/409 assertions and readonly negative regressions preserved. No global admin or fixture scope upgrade. This RequestContext fixture is not a signed identity login test.
- Final affected result: **123 passed, 5 skipped**, 18.22 s (`task-4-fix1-affected.log`). All skips are InMemory counterparts of PostgreSQL-only tests: supersede src/dst (2), concurrent new definition/schema lock (1), raw strict-new SQL race (1), and new edit-set/supersede race (1). Corresponding Pg cases pass.
- M1 retained for Task8/final review: 87 warnings in affected backend run (Starlette deprecation and local fixture HMAC length), existing Vite dependency/chunk noise. No global warning suppression, dependency upgrade, or unrelated performance change.

### Fix-round owned files and handoff

Production: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`; `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx`.
Tests: `mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_object_type_creation.py`; `mate-platform-backend/packages/mate-tech-ont/tests/test_ont_act05_unified.py` (controller-approved addition); `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx`.

Existing controller plan/evidence, pycache, PNGs and worktrees untouched by staging. Current preview9200 PID52012 and website9361 PID58796 still listening, no 55498/55499 helpers started this round. Generated Pg databases dropped after each test run; final catalog verification recorded below. Task5/6/8 integration and identity boundaries are unchanged. I1/I2 locally resolved; await controller independent review, no release or whole-Goal claim.

Fix round1 current HEAD: 12c8d79965d13f7da13edec461bf7991e6853b34 — fix(ontology): serialize edit sets and retain confirmed baseline. Exactly five owned source/test files committed. Final database catalog contains only preserved codex_mp11_relationship; no fix-run disposable databases remain. Final backend and UI/typecheck/build process exit codes both 0.
