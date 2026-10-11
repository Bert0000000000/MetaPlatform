> 历史执行记录：任务6已在提交0f68c3d8通过第二轮限定复审，当前结论见../MP11-APPLICATION.md。中间检查点、旧PID和早期pending清单只代表当时状态，最新结果位于末尾Fix round2段；Fix1关于endTime声明的错误已在Fix2明确纠正。命令中忽略目录里的旧fixture脚本属于历史验证环境，不是当前候选版启动入口。此处真实HTTP/PG证据使用signature-bypass USER fixture；正式签名身份和完整候选由任务8验收。
# Task6 implementation and fix-round report

> Latest result: fix round1 complete locally, pending controller independent re-review; see final fix section below. Fix BASE ae9ab8ffb4a5692506b0bde0b6ae804564a9761d.

- Original implementation status: implementation complete, pending controller independent review. Fixed review BASE `fc199803ee66e9914beb53563416a59582041bc1`; owned commit `ae9ab8ffb4a5692506b0bde0b6ae804564a9761d` (43 files; exact owned list verified after commit, no owned changes or staged files remain).
- Scope: actual AppHub SQL metadata/page definitions/version and release snapshots; exact Order/ObjectSet/Customer/LinkInstance and registered Action; strict USER/write Proposal confirmation/execution and persistent receipt; authoritative same-tenant reverse references; selected-artifact UX01 resume. No new low-code/auth/job framework.
- Latest affected backend suite: **189 passed, zero skipped**, with explicit Task6 PG tests enabled, 83.51s (`task-6-ruling23-final.log`). Earlier184/1skip result is superseded. Frontend focused14 passed; direct declaration/edit-set12 passed. Final `pnpm exec tsc -b` passed and `pnpm run build` passed20.20s after the OFFLINE label correction. Full fixture-auth browser3 passed25.4s; Ruling23 later affects creation/storage only, covered by actualHTTP/PG and package tests.
- Actual PG/API evidence is distinct from fixture authentication. Full browser uses fixture USER JWT signature bypass on dedicated API, not live issuer/login. Task7 approval deadline and Task8 verified signed USER/SERVICE classification remain explicit handoff boundaries.
- Runtime resource handoff: keep own API55510 listener30556 / launcher61264 (2026-10-12 00:11:59+08), Vite9367 listener66080 (2026-10-11 23:34:03+08) and three owned databases for independent review. Exact executable/args/starttime in task-6-processes.json / task-6-listeners.json. Shared9200PID51708 /9361PID59928 and shared Docker/auth untouched by Task6.

## Final evidence and commands

All Python commands use `mate-platform-backend/.venv/Scripts/python.exe`, bytecode disabled, and `-p no:cacheprovider`; frontend commands run in `metaplatform-frontend/apps/web`.

- Final backend: dot-source task-6-env.ps1 (verifies dedicated container/loopback55497 in memory), remove MATE_DB_URL for per-test store fixtures, then `python -m pytest mate-platform-backend/packages/mate-app-hub/tests -q -p no:cacheprovider --tb=short`:189PASS. PG-specific tests explicitly use `MP11_APPHUB_PG_DSN`; no shared/default DSN used. Full artifact/release/unit suite verifies SQL and memory CAS, page partial-save truth, stale-release approval409, production noSQL rejection, reader/service denies, cross-tenant groups/modules/pages and repeated create.
- Frontend focused: `pnpm exec vitest run src/pages/apphub/AppListPage.test.tsx src/pages/apphub/components/OrderReviewBinding.test.tsx src/pages/apphub/runtime/AppRuntimePage.test.tsx src/pages/dashboard/components/ProductOnboarding.test.tsx`:14PASS. Includes real metadata DTOs, group failures, module-partial retry, binding selection, no demo fallback, exact artifact evidence and rendered user/tenant resume isolation (mock APIs/Storage).
- Direct related ontology: `python -m pytest packages/mate-tech-ont/tests/test_ont_act05_edit_set.py -q -p no:cacheprovider --tb=short`:12PASS. Did not run existing PG fixture that deletes all Proposal rows. Focused Task6 actualPG tests preserve shared Task6 chain data.
- Actual source/import/data: `task-6-api-check.py` PASS; safe exact IDs in task-6-api-evidence.json. Registered source maps actual dedicated customers/orders tables, successful sync produces1Customer/2Orders and one real link. Preview/save/publish/shortlink/runtime reads those records. Real handler create Proposal -> actor-authoritative confirm -> execution receipt -> repeat samekey equality; readonly/service403, other tenant app/shortlink404.
- Real PG helper tests in final189: concurrent first execution and repeat samekey have exactly1audit; altered fingerprint refused, changed DB proposal status refused before assembly. Module/page concurrent insert-only creates exactly1row and1conflict. Action fixture is declarative status update, not an external side-effect function claim.
- Migration: `task-6-migration-check.py` PASS full Alembic empty DB->head0021; second DB->0020, insert actual legacy App/Page, upgrade0021; legacy timestamps remain unknown/revision0; CAS stale write rejected; independent subprocess snapshot/page/revision restoration. task-6-migration-evidence.json, two migration logs, task-6-migration-databases.json. Ruling22 repaired existing0017 missing table and overlong revision support; no stamp-only shortcut.
- Recovery: `task-6-newprocess-check.py` PASS original snapshot/runtime/shortlink/confirmed actor/Proposal/receipt/samekey after process boundary, exactly1audit. Unknown/cross-tenant/expired/revoked shortlinks refused. task-6-newprocess-evidence.json. `task-6-response-check.py` PASS again after final API restart: original pointer/shortlink/samekey receipt unchanged; actual Application/Runtime/RuntimeData/PageDefinition/BindingUsage samples validate canonical JSON Schemas.
- Ruling23 actual HTTP/PG: `task-6-ruling23-api-check.py` PASS final running API, two unique tenants use samecode modules/pages without collision; duplicate POST409 retains saved definitions; Group/Module/Page actual response DTO schema validation PASS. Evidence task-6-ruling23-api-evidence.json.
- Browser: task-6-ui-test.ps1 / `pnpm exec playwright test tests/e2e/mp11-order-app-flow.spec.ts --reporter list --trace off --workers 1`:3PASS. Emptytenant group/app/page; real binding+preview+save503 input retention+publish+shortlink+human drawer+reload receipt; UX01 all5 steps from chosen IDs, saved position resume, injected503unknown/retry. Test explicitly uses traceoff/videooff. Public task-6-order-ui.png visually inspected; no tokens or network trace stored. Browser Return cancel was exercised; browser-back guard has implementation but not separate native-history E2E evidence.
- Canonical: task-6-canonical-check.py PASS AppHub35 operations and ontology8:metadata0errors/ref0missing, operationId/path/request DTO agreement, unrelated operations unchanged. Ruling23 create409 and exact Module/Page/Group response schemas added. task-6-canonical-evidence.json.

## Self-review and exact remaining boundaries

- Full app put now uses stored revision CAS; caller mutation DTO cannot set revision. SQL conditional tenant/id/revision update protects snapshot/history; memory deepcopies nested app state and locks writes. Page save reports `application_metadata_updated=false` when page committed but subsequent metadata CAS conflicts. Old release records retain basePublishedVersionId and cannot silently replace newer runtime; explicit rollback path remains deliberate.
- Formal runtime and shortlinks require actual current PUBLISHED snapshot, validate model checksum/fields/Action.on/link endpoints/fingerprints, and never render draft/demo data after failure. Metadata missing on legacy rows remains unknown. Runtime ID resolves to actual ID distinct from code. Selected column order and OFFLINE reverse-reference labels corrected during self-review.
- Repeated creation no longer upserts away saved page definitions. Ruling23 only adds insert_only to existing put methods for create endpoints; existing save/update semantics remain default. SQL/memory tenant checks and UUID5 are covered by final regression and actualAPI evidence.
- Releases support FULL strategy; unsupported grayscale is explicitly422. No new deployment queue. Existing generic WFE/marketplace/outbox implementations are not expanded or claimed durable by this task.
- **Task7 pending:** original Proposal engine has no approval deadline. This implementation does not claim expiration enforcement for Proposal approvals; Task7 must add authoritative deadline and expired-execute denial. Shortlink expiry evidence is separate.
- **Task8 pending:** actual signed provider login and correct USER/SERVICE classification. Existing verifier/middleware drops preferred_username, so azp-present signed users misclassify SERVICE. Keep strict USER/write guards; fixture users omitazp and use signature bypass only on own testAPI. Task8 owns narrow identity fix and candidate signed-login/end-to-end model-impact verification.
- ONT03 editor consumes actual app references and shows unknown/retry on failed lookup; authoritative API/runtime/PG evidence passed. The complete published-app model-change impact browser scenario stays Task8 as specified; no claim of it here.
- Warnings: existing Starlette/httpx deprecation, short test HMAC warning, Vite chunk-size advisory. No dependency/framework upgrade. Backend production memory guard remains failclosed. No Task1..5 suite rerun.
- Resources retained intentionally for review; no cleanup claimed. Owned main DB `codex_mp11_apphub_20261011`; fresh `codex_mp11_apphub_fresh_20261011_2345`; upgrade `codex_mp11_apphub_upgrade_20261011_2345`, all dedicated container `codex-mp11-relationship-pg` at127.0.0.1:55497. Passwords/tokens remain memory only. Original user screenshots, bytecode, examples/docs/worktrees and staging stay excluded.

## Owned source and tests (43 files)

- `mate-platform-backend/alembic/versions/20260831_0017_orchestrator_role_actor_roles.py`
- `mate-platform-backend/alembic/versions/20261011_0021_apphub_publication.py`
- `mate-platform-backend/contracts/openapi/services/apphub.yaml`
- `mate-platform-backend/contracts/openapi/services/ont.yaml`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/main.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/__init__.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/in_memory.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_models.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_store.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/runtime/binding.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/runtime/loader.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/runtime/renderer.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/shortlink/repository.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/shortlink/service.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_otel_01.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_publication.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_runtime_01.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_shortlink_01.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- `metaplatform-frontend/apps/web/src/api/apphub/apps.ts`
- `metaplatform-frontend/apps/web/src/api/apphub/modules.ts`
- `metaplatform-frontend/apps/web/src/api/apphub/pages.ts`
- `metaplatform-frontend/apps/web/src/api/apphub/runtime.ts`
- `metaplatform-frontend/apps/web/src/api/apphub/types/index.ts`
- `metaplatform-frontend/apps/web/src/api/ont/kernel.ts`
- `metaplatform-frontend/apps/web/src/pages/apphub/AppDetailPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/AppListPage.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/AppListPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/PageDesignerPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/components/FormBinding.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/components/OrderReviewBinding.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/components/OrderReviewBinding.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/runtime/AppRuntimePage.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/runtime/AppRuntimePage.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/runtime/OrderReviewRuntime.tsx`
- `metaplatform-frontend/apps/web/src/pages/dashboard/DashboardPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/dashboard/components/ProductOnboarding.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/dashboard/components/ProductOnboarding.tsx`
- `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx`
- `metaplatform-frontend/apps/web/tests/e2e/mp11-order-app-flow.spec.ts`

## Historical TDD/checkpoint detail

### Original checkpoint (historical)

- Review BASE: fc199803ee66e9914beb53563416a59582041bc1.
- Status: IN_PROGRESS. No Task6 commit yet; no services started; no live PG/API/browser acceptance yet.
- All shell work uses narrowly justified require_escalated because default managed helper fails before commands start with setup refresh had errors. No auto-review rejection.
- TDD skill read/applied. Preserve Task1..5, website, screenshots, original WIP and protected services.
- Approved extra paths: OrderReviewBinding.tsx, runtime/OrderReviewRuntime.tsx; existing runtime/binding.py, main.py, shortlink/repository.py/service.py; existing repositories; migration 20261011_0021_apphub_publication.py (revision0021_apphub_publication ->0020_mcp_clients).

## Implemented so far

- ApphubApp lifecycle/actual nullable timestamps/current version reference and version/release fields; ApphubPage actual definition.
- ORM + SQL serialization; SQL writes reject cross-tenant same-ID overwrite for app/page. Existing SQL sessions now close in finally.
- Repository facade selects SQL with explicitly configured MATE_DB_URL/DATABASE_URL. SQL does not seed. main keeps production memory fallback rejection when SQL absent.
- Alembic0021 additive upgrade preserves legacy unknown timestamps (migration/fresh/PG not yet exercised).
- AppHub actual module count; registry metadata; page PUT saves definition and draft update time.
- AppHub mutating routes enforce platform.write via tenant guard.
- Actual published server snapshot from saved pages; versions endpoints persist in app row; loader formal path reads published snapshot and rejects unpublished/offline. Generic snapshot publication rejects empty saved pages.
- Thin SQLShortlinkStore uses existing SQL CRUD and configuration; create shortlink requires published version. Frontend runtime uses only resolved shortlinks and no demo fallback, preserving lookup errors.
- Existing runtime/binding.py verified-Bearer HTTP adapter uses TECH_ONT_URL/ONTOLOGY_URL and never service-token fallback. Model/checksum/fields/Action.on/LinkType validate exact same-tenant bindings; action/link fingerprints detect drift.
- Publish/runtime validate ontology-bound pages; runtime/data reads actual ObjectSet + Customer ObjectSet + LinkInstance; ontology_propose runtime path restricts action to snapshot and target to bound ObjectSet. Routes still need real-handler/PG acceptance and DTO/docs closure.
- Same-tenant /bindings/usage emits explicit saved draft and current published binding references, app ID/name/model version/checksum/publication state. It never scans arbitrary RID strings.
- Ontology Proposal confirm/execute/reject/revert/withdraw enforce USER + platform.write. propose_action/propose_edit_set require write. Existing attribution/idempotency/expiry untouched.
- Frontend AppItem mapper uses actual status/owner/version/timestamps/module_count; update uses PATCH, publish uses publish endpoint, runtime open obtains shortlink. AppList displays actual metadata.

## TDD commands/evidence

From mate-platform-backend using .venv/Scripts/python.exe -m pytest and -p no:cacheprovider:
1. test_apphub_publication.py initially RED3: no status, no page definition, cross-tenant overwrite DID NOT RAISE. GREEN3 after implementation.
2. Added facade/page HTTP/unpublished runtime/readonly tests: RED seed list vs [] and app404; fixed conftest import collision, observed empty publish200 vs422. Full focused file GREEN6.
3. Shortlink test RED SQL lookup None; GREEN -k shortlink: 1 passed.
4. Saved binding publication/usage/drift test fixed pytest importlib fixture loading, RED versions len0 vs1; GREEN -k saved_binding: 1 passed.
5. test_apphub_order_binding.py RED7 missing validator; GREEN7 (mock HTTP upstream, real validator).
6. -k human --tb=short RED6 handlers returned Idempotency-Key400 instead of403; GREEN6. Real ontology handlers with RequestContext fixtures, not live provider login.

From metaplatform-frontend/apps/web using pnpm exec vitest run:
7. src/pages/apphub/runtime/AppRuntimePage.test.tsx RED2 demo PAGE_DEMO / swallowed forbidden shortlink; GREEN2.
8. src/pages/apphub/AppListPage.test.tsx RED2 fabricated PUBLISHED / wrong PUT; GREEN2. Mapper/client unit tests, not rendered cards yet.

Warnings: existing Starlette/httpx deprecation and existing auth fixture HMAC length warning. Initial pytest cache permissions avoided with -p no:cacheprovider. No dependency upgrade. Synthetic test identity only.

## Remaining mandatory work

- Persist release record/log/task flow still in _RELEASES/_RELEASE_LOGS/_RELEASE_TASKS; close cross-tenant approval lookup; unify snapshot publication.
- Finish OrderReviewBinding/OrderReviewRuntime, PageDesigner unsaved protection, real FormBinding, ONT03 ObjectTypeEditor integration, AppDetail template entry.
- UX01 selected flow/user/tenant isolated exact artifact IDs; actual import/model/relationship/app/release evidence, errors unknown/retry, no global-count/seed completion.
- Complete touched canonical OpenAPI operationIds/DTO/permissions and validators.
- Real PG fresh+0020 upgrade+new-process durability, actual Order/Customer/ObjectSet/LinkInstance/Action Proposal human confirmation/execution/receipt/idempotency/expiry/denial.
- Real UI/API E2E; final related regression + tsc/build; self-review and owned-only commit.
- Before service start announce ports/PID ledger. Dedicated PG loopback55497, write only codex_mp11_ DB. Protect9200PID52012/9361PID58796/sharedIAM. Task8 owns real issuer/login integration.


## Checkpoint 2026-10-11 (resumed after context compaction)

- Completed since earlier checkpoint: release snapshots/tasks/logs now persist in ApphubApp.releases; same-tenant release lookup and actual assigned USER/write approval culminate in the same published snapshot. Added release persistence RED (empty durable release list) -> GREEN1.
- OrderReviewBinding/OrderReviewRuntime now implemented with actual metadata and registered Proposal drawer/audit receipts. PageDesigner saves binding, keeps inputs on save failure, push/replace and beforeunload dirty guard. ONT03 ObjectTypeEditor consumes authoritative usage and blocks unknown usage on errors. FormBinding no longer imports mock fields.
- UX01 now records exact selected source/model/mapping/run/link/app IDs and resume position keyed by tenant/user; completion requires matching successful run with synced data, actual individual relationships and published binding. Pure derivation tests RED3 -> GREEN3. Rendered resume/browser verification still pending; existing-app choice currently verifies descriptor only.
- Binding selector tests RED2 -> GREEN2. Latest tsc -b passed (before subsequent backend-only release rewrite). No repeated suite for this checkpoint.
- Canonical OpenAPI remains pending. No Task6 API/Vite process started; real PG/fresh/upgrade/new-process/browser validation still pending.
- Remaining UI gaps to verify/fix: real binding preview, browser back dirty guard, existing-page editing entry, UX source route and exact published version ID. Formal shortlinks need active-PUBLISHED status guard as well as version pointer.
- Task8 handoff: verifier/middleware drops preferred_username, misclassifying azp-present signed users as SERVICE. Keep USER guard; current tests use fixtures and do not prove real provider login.

## Checkpoint 2026-10-11 23:15 (supersedes earlier remaining list)

- Preview and offline-shortlink regressions RED2 (404 and unsafe201) -> GREEN2. Preview uses same actual validator/ObjectSet/Customer/link requests without saving or publishing; frontend renders preview with human action disabled. Existing page editor entry now uses true module_code; raw module DTO test RED1 -> GREEN3 AppList/adapter suite. Browser back cancellation guard added using existing pattern; pending browser proof.
- Added internal App revision CAS in SQL/memory and migration0021 after confirmed lost-update RED2 -> GREEN2. SQL atomic tenant/id/revision update; nested memory app reads isolated. Stale release base-published version now rejected. Page save reports actual saved definition plus application_metadata_updated=false if its later metadata timestamp CAS conflicts; frontend reports partial success truthfully. Additional actual PG/approval concurrency verification pending.
- apply_edit_set direct human execution alias now USER/write guarded (RED2 entered downstream repository work; initial invalid test RID and missing enum import corrected; final GREEN2 valid RID guards). No real issuer proof. Task7 now explicitly owns missing server-side approval deadline; Proposal has no current expiry field, so this remains pending and shortlink expiry is separate.
- Last tsc passed after real preview/module optional DTO changes. First-use group/entry tests RED2; implementation was written before interruption; GREEN still pending.
- Started API55510 (launcher64688, listener67596), Vite9367 (launcher18808, listener66776), all exact executable/command/starttime in task-6-processes.json and task-6-listeners.json. New owned DB codex_mp11_apphub_20261011 created in verified dedicated container55497; no shared DB/service mutation.
- Actual HTTP+PG achieved registered source -> successful Customer/Order import -> actual LinkInstance -> saved binding -> draft preview -> durable publish -> shortlink -> Order/Customer runtime read -> same-tenant usage -> actual USER fixture confirm (payload forged actor ignored) -> execution success. Readonly/service human decisions403. The script stopped at identical execute-key replay409 and has not yet recorded a complete PASS: existing PG declarative helper accepted but never inserted key/fingerprint, so replay lacked its authoritative row. Ruling20 approves narrow helper repair; actual concurrent/restart/collision checks pending.
- After Goal continuation, both55510/9367 show no listeners; prior process IDs checked separately before any restart. No claim services remain running. Existing owned DB will be reused after exact ownership check, not recreated.
- Canonical analysis found touched pages/version/release/binding endpoints absent or generic; before baseline retained in task-6-openapi-before.json. Contract edits/validators pending. Final regression/build/UI/PG migration-newprocess/self-review/commit remain pending.

## Checkpoint 2026-10-11 23:50 (current evidence; supersedes earlier pending items)

- Real HTTP/PG chain now PASS: selected source -> Customer/Order mappings and successful imports -> individual LinkInstance -> actual binding preview/save -> publish snapshot -> shortlink/runtime -> registered Action Proposal -> USER fixture confirm/execute/receipt. Payload actor spoof ignored; readonly/service decisions403, other tenant app/shortlink404. Exact safe artifact IDs/results: task-6-api-evidence.json.
- Confirmed idempotent declarative execution defect repaired in approved pg_repo helper using existing key/fingerprint/receipt transaction and schema/key/proposal locks. Actual PG focused test PASS1: concurrent first execution, same-key serial replay, different fingerprint rejection, one side effect/audit, stale confirmed object vs changed DB status refusal. New-process receipt proof still pending.
- Full browser PASS2 (13.9s): empty SQL tenant explicitly creates business group/app/order page; actual dataset binds/previews/saves/publishes, opens shortlink, creates Proposal and uses existing human drawer to confirm/execute, then reloads persisted receipt. Auth is fixture USER only; no real signed login claim. Trace/video off; public screenshot task-6-order-ui.png. UX01 rendered resume/isolation coverage remains pending (pure derivation PASS3).
- First-use frontend tests now PASS5 (includes raw module mapping and group catalog error); binding2/runtime2/onboarding3 earlier green. Group atomic insert backend RED cross-tenant overwrite -> GREEN1. Earlier covering backend run28 passed1 skipped preceded group addition; actual PG helper separately passed.
- After Docker restoration by controller, exact owned DB/container reverified and Task6 services restored, latest identities in task-6-processes.json and task-6-listeners.json. Main DB codex_mp11_apphub_20261011 remains owned/reused. Parent restored shared website9361 independently; Task6 did not alter shared services. Retain owned Task6 services/main DB through independent review.
- Touched canonical AppHub27 paths + ontology8 operations now synchronized, duplicate equivalent app path resolved; final metadata/ref/DTO/runtime-operation validation still pending.
- Created owned migration databases codex_mp11_apphub_fresh_20261011_2345 and codex_mp11_apphub_upgrade_20261011_2345 (ledger task-6-migration-databases.json), refusing existing databases. Full fresh Alembic run fails BEFORE Task6 migration: existing0017 attempts ALTER orchestrator_roles but no earlier migration creates it (UndefinedTable). Exact log codex_mp11_apphub_fresh_20261011_2345-head.log. Controller notified; no unrelated migration edited. Full fresh/0020 upgrade/new-process/CAS evidence not yet claimed.
- Remaining: resolve/scope inherited migration blocker, independent-process receipt/snapshot/CAS evidence, rendered UX01 and specific failure cases, final canonical check, final affected regression/tsc/build, self-review, owned-only commit. Proposal approval deadline remains Task7 pending; signed USER/SERVICE classification and real issuer login remain Task8 pending. Strict USER/write guards retained.

## Checkpoint 2026-10-12 00:03 (closing validation)

- Ruling22 approved existing0017 migration dependency repair: RoleORM had only startup create_all, no earlier Alembic table creation; full fresh failed UndefinedTable, then version registration exposed 33-character revision vs Alembic VARCHAR32. Same0017 now explicitly creates missing existing role table, adds only missing allowed_actor_roles, leaves preexisting rows/columns, widens only PostgreSQL version_num<64, downgrade never shrinks version or drops base table. Three-shape regression RED2/legacyPASS1 -> GREEN3. Task6 0021 direct migration RED1 found malformed releases column declaration after revision edit -> GREEN1 upgrade/repeat/downgrade.
- Actual dedicated PG full migration now PASS on both owned fresh and0020-upgrade DBs, with legacy rows unknown timestamps/revision0, snapshot/page retention, stale CAS rejected and independent new-process read. Exact task-6-migration-evidence.json and DB logs; no stamp-only or hand-created baseline substitutes.
- Self-review fixes RED2 -> GREEN2: field metadata now follows selected columns, preventing mismatched headers; current published-pointer references of OFFLINE app now show OFFLINE. Creation partial result RED1 -> GREEN6 adapter suite: created module code retained, retries reuse module and re-read pages rather than silently duplicating after page failure. Source/checkpoint wrappers contain no credentials.
- Production-noSQL failclosed, explicit SQL selection, page-save conflict partial result PASS2; stale release approval after newer publish returns409 and preserves newer snapshot/history PASS1 (initial test used wrong list wrapper; corrected to real DTO). Current server-owned CAS revision is not mutation DTO input.
- Canonical exact checks PASS: AppHub35 operations / ontology8, required metadata0 errors, references0 missing, actual path/operationId and typed request-property/required sets match; unrelated operations equal pre-task baseline (date serialization normalized). task-6-canonical-evidence.json. Release assignee fields corrected to actual techLeadId/opsOwnerId.
- UX01 actual browser selected source/mapping/run/model/link/app validates all5 steps; saved position/app resumes; injected503 becomes unknown with same input and retry restores actual status PASS1. Rendered user/tenant switching isolated PASS4 (Storage/API fixtures). Main full browser initiallyPASS2, latest full3 including page-save503 input retention running against restarted final API; all trace/video off.
- New-process actualPG receipt proof PASS: original Proposal/confirmed_by/execution audit recovered, samekey replay returns same audit exactly1; original publishedsnapshot/runtime/shortlink recovered, unknown/cross-tenant/expired/revoked shortlinks rejected. task-6-newprocess-evidence.json. Shortlink expiry is distinct from Task7 pending Proposal deadline.
- First all-AppHub regression174PASS/1 explicitPGskip/10FAIL due obsolete unpublishedseed formal-runtime/empty-page publication assumptions. Approved three existing tests now explicitly save real page and publish before runtime/shortlink/OTel assertions. Latest full covering run ongoing; frontend focused14PASS, final tsc/build ongoing after correcting testing-library options.
- Only owned API55510 restarted after exact PID/starttime/cmd/listener match (old35372); new launcher53188, actual listener recorded task-6-listeners.json. Vite9367 and shared controller-owned9200PID51708/9361PID59928 untouched. Parent retains owned API/DB until independent review. No new controller dependency pending.

## Final commit and late self-review closure

- Commit: `ae9ab8ffb4a5692506b0bde0b6ae804564a9761d`. No push/merge. Exactly43 owned files committed; report/safe evidence remain in designated scratch for controller archival; original user WIP retained.
- Ruling23 exact RED: cross-tenant samecode module changed Acme name to Globex; insert_only missing in both stores. GREEN4 including actualPG race. Final full package189PASS/0skip covers new code and both actualPG tests, with explicit55497 DSN in memory. Final actualHTTP/PG duplicatecreate409/two-tenant ID isolation preserves existing page definition and validates Group/Module/Page DTOs.
- OFFLINE reference UI final self-review correction now displays 已下线; this small frontend change prompted final tsc/build repeat (both0;build20.20s), not another unrelated suite. Browser3 result preceded only Ruling23 creation hardening and this label; actual finalAPI creation/recovery checks cover the backend delta. No claim of fresh real-issuer identity acceptance.
- No new controller dependency is pending. Independent review should compare fixed BASE to this commit, including the approved0017 and PG declarative helper changes. Final resources intentionally retained with exact ownership ledgers; no unknown process/database deletion performed.


## Fix round 1 checkpoint — 2026-10-12 00:56
Base ae9ab8ffb4a5692506b0bde0b6ae804564a9761d. All I1–I6 accepted; M1 in scope, M2 remains Task8. No fix commit yet.
- I1/I2: Memory+SQLite RED4 (false-success ID deletion / missing insert_only) → GREEN4. Deletion uses resolved code and checks actual result; tenant+code UUID5 registration uses atomic create-only, PG advisory transaction same-code lock, legacy ID/code rejection without overwrite/cleanup. Memory ID lookup aligned with SQL. Actual PG two-process same-code test PASS; existing duplicate legacy rows retained and creation refused.
- I5: RED missing published_version → GREEN. App DTO now distinguishes draft version from published snapshot version; PATCH→publish→rollback regression PASS; cards/detail show draft/running explicitly.
- I4: RED absent publication-check → GREEN. Server checks saved components, bindings, reference fingerprints, caller read/write, registered Action target/human decision rule, runtime tree and actual data queries. AppDetail renders six real pass/fail/unknown results and review/confirm step. Final publication recomputes checks; dependency failure retains saved definitions. Publication focused suite33 PASS. No approval-expiry claim.
- I3: frontend RED absent receipt after empty live ObjectSet; query now server-attributed app/page/exact published snapshot via existing Proposal provenance, PG filters join before LIMIT. Actual PG history test PASS: unrelated app/page/version/newer un-attributed audits excluded, cross-tenant empty, new Python process recovers original receipt. RuntimeContext snapshot ID addition approved to avoid rereading a changing publication pointer; concurrency regression still to add.
- I6: approved tests/publication_helpers.py shared setup, relative import needed by pytest importlib mode; three duplicate helpers removed, behavior assertions retained. Full affected suite still pending.
- Frontend targeted3 files9 PASS. One initial PublishValidation test collection hit existing Semi/lottie canvas dependency; scoped UI-library mock fixed test environment, no production suppression.
- Docker was unavailable, controller restored existing engine and verified dedicated PG55497. No shared container changes by implementer. Actual PG resumed only after controller confirmed owned target. API/Vite not restarted yet this round.
Remaining: canonical new operations/precise release array DTO samples; browser filtered order→receipt reopen, provenance-load race regression, actual API fresh process, amended full suite and frontend tsc/build, self-review and owned commit. Prior migration fresh/upgrade evidence remains baseline; no schema/migration changes this round. Boundary: legacy receipt without complete page/version provenance is not guessed into history; Task7 Proposal expiry and Task8 signed USER classification/full candidate acceptance remain pending.


## Fix round 1 final — 2026-10-12 01:19

**Status:** I1–I6 and M1 implemented and locally verified; pending independent re-review. Fixed BASE `ae9ab8ffb4a5692506b0bde0b6ae804564a9761d`; owned commit recorded after staging below. M2 inherited warning cleanup remains Task8. No new migration, persistent store, identity framework or nested reviewer.

### Findings resolved

- **I1:** DELETE resolves exact application ID before code, passes resolved ID into tenant-qualified repository deletion and checks the boolean result before emitting success. Memory deletion locks the mutation. SQL and Memory RED2 reproduced the ID/code collision deleting the wrong application; GREEN2 verifies the other application survives. Initial create/publish/DELETE-by-returned-ID tests cover runtime and GET unavailability in both stores. Actual SQL HTTP create→duplicate409→DELETE ID→GET/runtime404 passes.
- **I2:** Application POST derives tenant+code UUID5 and calls create-only storage. PostgreSQL uses a transaction advisory lock for the tenant/code and rechecks existing codes before insert, catches PK conflicts, never overwrites a legacy row. Memory locks the same check. Existing random IDs and preexisting duplicate code rows are preserved; create rejects rather than clearing/merging. Actual PG two independent Python processes yield one create and one conflict, exactly one row. No migration is needed; default put retains CAS behavior.
- **I3:** RuntimeContext carries the exact loaded published snapshot ID; application/page/version provenance is injected from it, not from a later pointer read or request ownership fields. API history authorizes tenant/app/page/exact published snapshot and calls the existing audit query with attribution filters. PG joins persisted Proposal provenance and applies tenant/action/app/page/version predicates before LIMIT. Current ObjectSet membership is never used to suppress historical receipts. Default history is the current published version; explicit version_id selects an authorized historical published snapshot.
- **I3 trust boundary:** Direct Ontology Proposal requests can supply provenance, so injection alone was insufficient. Top-level and parameters.provenance RED2 demonstrated the bypass. A shared validator now forwards the verified caller Bearer to the existing AppHub authority via `APPHUB_URL` (gateway fallback8100; isolated fixture explicitly55510). Read-only POST proposal-context checks actual same-tenant exact app ID, published state, requested historical PUBLISHED snapshot, page/binding/registered Action, live model fingerprints and actual ObjectSet target. Missing/duplicate/conflicting attribution, forged references, unavailable authority and custom edits carrying application attribution reject explicitly. The propose-edit-set/apply-edit-set aliases use the same guard. The legacy apply_action_by_rid endpoint is already410 and creates no reachable audit, so was not changed. Attribution means *validated against the application's binding*, not proof of browser origin. Legal direct requests can receive this attribution after the same check. No service-token fallback or credentials in storage. No changes to execution/approval identity, idempotency or schema/proposal/object lock ordering.
- **I4:** PublishValidation now includes the application checkpoint; AppDetail fetches six server-derived checks and requires a visible confirm action. Bindings, model/Action/link versions, caller read/write access, saved components, registered Action/HITL policy and actual runtime data/tree are checked. Missing dependencies fail or remain unknown with next steps; final publication recomputes checks. Saved definitions remain intact on failure. No static all-green list. The Task7 approval-expiry gap is not portrayed as validated.
- **I5:** `version` is draft metadata; `published_version` is derived from the exact persisted published pointer. Cards and detail show draft/running versions separately. PATCH after publication leaves actual runtime1.0 while draft2.0 is labeled separately; later publish and explicit rollback return the corresponding running version. Regression covers these transitions.
- **I6:** The three identical saved-page/publish helpers now live in one approved `tests/publication_helpers.py`; all original runtime/shortlink/telemetry assertions remain. Relative imports respect pytest's configured importlib mode.
- **M1:** Canonical release logs/tasks are arrays with concrete AppHubReleaseLog/AppHubReleaseTask item DTOs, including actual endTime. Actual submitted/rejected release responses were validated, not just static schemas. New publication-check/history/proposal-context operations and exact request DTO/readonly permission semantics are canonical.

### Verification and evidence

- **Final backend227 PASS,0 skipped,79 warnings,133.62s**: dot-source `task-6-env.ps1`, remove only env MATE_DB_URL for per-test fixtures, then project Python `-m pytest mate-platform-backend/packages/mate-app-hub/tests mate-platform-backend/packages/mate-tech-ont/tests/test_ont_act05_edit_set.py -q -p no:cacheprovider --tb=short`. This is AppHub215 plus directly affected declaration/edit-set12; log `task-6-fix1-final-backend.log`. Four actual-PG tests enabled, scoped explicitly127.0.0.1:55497/codex_mp11_. Includes CAS/publication legacy coverage, two-process app create, serial/concurrent replay, tenant/history filter-before-limit and new-Python-process recovery.
- **Frontend33 PASS /7 files,14.12s** (`task-6-fix1-final-frontend.log`): AppListPage, OrderReviewBinding, PublishValidation, AppRuntimePage, OrderReviewRuntime, ProductOnboarding and approved ObjectTypeEditorV2Drawer fixture integration. The first expanded invocation exposed3 failures because original Task6's new usage call lacked a mock in the older editor test; controller approved only the fixture addition and actual-reference/unknown-refusal tests. BeforeEach now returns an actual empty-array fixture; original3 assertions retained. Source editor unchanged. Initial failure evidence retained in `task-6-fix1-frontend.log`; isolated fixed file16PASS then combined33PASS. No blanket Task1–5 rerun.
- **TypeScript exit0** final `pnpm --dir metaplatform-frontend/apps/web exec tsc -b --pretty false`, log `task-6-fix1-final-tsc.log`. **Production Vite build exit0,31.26s**, `task-6-fix1-build.log`; later frontend edits were only tests, so no redundant rebuild. Existing >500kB warning retained.
- **Browser3 PASS16.2s** on real55510 HTTP/PG +9367 Vite after the attribution guard. The dedicated fixture USER JWT bypasses signature verification; this is not live issuer proof. Test creates a unique real pending order and filters by its status. Approval updates it, ObjectSet becomes0, reopening the shortlink still shows its exact persisted receipt/actor; history API matches the same order. Publication-check503 yields unknown/disabled confirmation, retry shows all6 real passes. Existing save503/dirty-return/empty-tenant creation/UX01 cases retained. The initial button exact-name failure was an icon-accessible-name mismatch; locator corrected from actual DOM. `trace:off`, `video:off`; only public UI screenshot retained and visually inspected.
- **Actual API/PG canonical and attribution PASS:** `task-6-fix1-api-check.py` / `task-6-fix1-provenance-check.py` and corresponding whitelisted JSON evidence. Includes real duplicate409, delete-by-ID404, filtered receipt, six-check response, concrete release log/task arrays, verified proposal-context sample, top+nested forged app/page/version denial, alias/custom-edit denial and legitimate direct registered Action proposals. No credential/request traces saved.
- **New process recovery PASS:** final API process restart after receipt creation reads the same0-order ObjectSet and exact original receipt ID, recorded `actual_api_new_process_filtered_receipt=PASS` in `task-6-fix1-api-evidence.json`. Independent PG history test also opens a new Python process and retrieves the same audit with limit1 despite newer unrelated audits.
- **Canonical38 AppHub /9 Ont PASS**: `task-6-canonical-check.py`, metadata0errors, refs0missing, operationId/path/request fields agree and unrelated operations unchanged; `task-6-canonical-evidence.json`. Live response schemas separately validated above. ApplicationAttribution readonlyPOST uses read permission; proposing still requires write.
- **Migration boundary:** this fix changes no ORM columns or Alembic files. Prior actual full fresh-head and0020→0021 upgrade/CAS evidence (`task-6-migration-evidence.json`) remains the migration evidence; it was not relabeled as newly rerun. New process evidence above covers this fix's persistence behavior.

### Resources, exclusions, handoff

Final owned API55510 listener44604 /launcher39352 started2026-10-12T01:17:44+08; Vite9367 listener66080 unchanged. Exact executable/args/starttime are in task-6-listeners.json and task-6-processes.json. Own PG stays codex-mp11-relationship-pg at127.0.0.1:55497, main codex_mp11_apphub_20261011 and previously owned fresh/upgrade DBs retained for review. Controller separately restored Docker during this round; no shared container/auth/database restart was performed by implementer. Shared9200PID51708 /9361PID59928 remain unchanged. Resources retained, no cleanup claimed.

Legacy receipts without complete page/version provenance are excluded, never guessed from a global audit list. History attribution is the validated application binding association; it is not a UI-origin attestation. Task7 authoritative approval deadline, Task8 signed issuer USER/SERVICE classification, final candidate/model-impact browser acceptance and warning cleanup remain pending. The actual declarative PG tests do not establish exactly-once external function effects under process crashes.

Self-review checked current pointer vs loaded snapshot race, direct-provenance aliases, tenant filters before limit, stable idempotency parameters, readonly validation no mutations, ID/code deletion ambiguity, no legacy overwrites, truthful draft/running versions and preserved failed inputs. Exact owned scope has27 files in task-6-fix1-owned-files.json (listed next); parent-owned MP11-EXECUTION.md, user screenshots/bytecode/worktrees/docs/examples, generated logs and fixture credentials are excluded.

- `mate-platform-backend/contracts/openapi/services/apphub.yaml`
- `mate-platform-backend/contracts/openapi/services/ont.yaml`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/in_memory.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_store.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/runtime/loader.py`
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/runtime/schema.py`
- `mate-platform-backend/packages/mate-app-hub/tests/publication_helpers.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_otel_01.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_publication.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_runtime_01.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_shortlink_01.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- `metaplatform-frontend/apps/web/src/api/apphub/apps.ts`
- `metaplatform-frontend/apps/web/src/api/apphub/runtime.ts`
- `metaplatform-frontend/apps/web/src/api/apphub/types/index.ts`
- `metaplatform-frontend/apps/web/src/pages/apphub/AppDetailPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/AppListPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/AppListPage.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/components/PublishValidation.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/components/PublishValidation.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/runtime/OrderReviewRuntime.tsx`
- `metaplatform-frontend/apps/web/src/pages/apphub/runtime/OrderReviewRuntime.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx`
- `metaplatform-frontend/apps/web/tests/e2e/mp11-order-app-flow.spec.ts`

Fix-round 1 owned commit: **e6eb1564565ca6df0efa9fd263505809eec9f09a** (parent/base ae9ab8ffb4a5692506b0bde0b6ae804564a9761d). Post-commit verification: exactly the approved 27 files; index empty; no owned source changes remaining. Controller documents, user WIP, screenshots and tracked bytecode remain uncommitted and untouched by staging. Implementation is ready for controller-led independent re-review; no overall Task6/Goal approval is claimed.


## Fix round2 — 2026-10-12 01:44

BASE: `e6eb1564565ca6df0efa9fd263505809eec9f09a`. Read full `task-6-fix-round2.md`, brief and Fix1 final report. Scope only N1 and eligible M1. Original I1–I6 accepted by independent review; M2 stays Task8. No extra dependency, migration, frontend change or architecture request.

### N1 implementation and evidence

`PgOntologyRepository.list_action_audit` now selects provenance by actual persisted proposal kind: `action` reads `parameters.provenance`; `edit_set` reads `parameters.parameters.provenance`; other kinds have no application attribution. No coalesce/fallback to a competing shape. Tenant/action/app/page/published-version predicates still execute before LIMIT. The query still closes its connection. Validation, USER/write guards, Proposal confirmation, execution locks, idempotency and registered Action selection are unchanged.

Existing actual-PG regression is parametrized for action/edit_set. Both execute real registered Action proposals, preserve same audit after newer other-app/page/version/legacy records, reject cross-tenant history, and recover the same audit in a newly spawned Python process with LIMIT1. An explicitly injected competing wrong-shape provenance on an unrelated proposal cannot override its kind's real provenance. This direct test fixture mutation is confined to unique test proposals in the dedicated database; it is not a new external API pathway.

The approved existing `task-6-fix1-provenance-check.py` now executes both legal HTTP aliases against the actual saved filtered Browser Order publication. `propose-edit-set` creates pending, real USER fixture confirms and executes; `apply-edit-set` uses its existing authorized human immediate-confirm path. For each, a newly created order is present in the actual ObjectSet before execution and absent afterward; app history contains the precise returned audit_id, whose persisted Proposal has the matching target/action and kind=edit_set. Reopening via a fresh API process recovers both same audits. Forged top/nested app/page/version and both aliases' forged attribution/custom edits still reject. No client service-identity fallback or custom edits substitution was added.

Exact actual persisted receipts (see `task-6-fix2-provenance-evidence.json`):
- propose-edit-set: `prop-44e84e655718` / `audit-ab1b8291ac8d`.
- apply-edit-set: `prop-b30f296f9da3` / `audit-071ebc1b5bda`.
- Shared validated app `app-e1598b1298475cdf91c87b5bf7ecca26`, page `page-f5329031a0285d1d9d4fb07a9eae7409`, publication `ver-f1d4394ba9b146b7a9002bb0090f1cf1`.

### M1 correction

The prior Fix1 report's statement that the declared task schema included actual endTime was incorrect. The schema still declared completedAt, and permissive additionalProperties let the sample pass. This round changes only the optional AppHubReleaseTask property to actual `endTime`, preserving every other optional field and API behavior. The focused test asserts the completed sample's keys are declared, explicitly rejects a completedAt declaration, and validates the JSON. A separate assertion checks the actual previously captured completed response's endTime against the declared properties; permissive additionalProperties cannot conceal this mismatch anymore. No new completed release or application publication was needed.

### Commands, exit codes and observed results

All PG/API commands ran from the repository root after `. .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-6-env.ps1`. That script verifies existing container identity/binding and sets an in-memory DSN for `127.0.0.1:55497/codex_mp11_apphub_20261011`; no credentials are printed or retained. Pytest additionally uses `Remove-Item Env:MATE_DB_URL` so only the explicitly opted-in PG tests receive PG state; all package paths are in PYTHONPATH and PYTHONDONTWRITEBYTECODE=1.

1. RED command: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py -k 'actual_pg_history or completed_release_task' -q -p no:cacheprovider --tb=short`. Exit1: **2 failed /1 passed /31 deselected**,3.68s. Exact failures: edit_set expected audit but got []; completed sample endTime absent from declared properties. Log `task-6-fix2-red.log`.
2. Same command after minimal source changes, exit0: **3 passed /31 deselected**,4.22s. Log `task-6-fix2-green.log`.
3. Actual old-process API RED: `mate-platform-backend/.venv/Scripts/python.exe .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-6-fix1-provenance-check.py`, exit1 after negative checks passed: `('propose-edit-set', 'persisted audit absent from app history')`. Log `task-6-fix2-api-red.log`. First script attempt incorrectly assumed ObjectSet iid instead of real rid; corrected from actual API/source before this valid failure. After restart, another fixture assertion assumed receipt included proposal_id; corrected to follow the returned audit_id into persisted history and read its real Proposal. Neither fixture correction changed production behavior or relaxed the audit match.
4. Same API script after owned API loaded the fix, exit0: **PASS actual HTTP/PG top+nested forged app/page/version rejection, aliases/custom-edits rejection, verified direct registered Action and exact context canonical sample; PASS both legal aliases execute registered Action, leave actual ObjectSet, retain exact app audit**. Log `task-6-fix2-api-green.log`, data `task-6-fix2-provenance-evidence.json` and `task-6-fix2-provenance-prechecks.json`.
5. Final covering command: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py -q -p no:cacheprovider --tb=short`. Exit0: **34 passed /0 skipped /1 inherited Starlette-httpx warning /8.35s**. Log `task-6-fix2-final-tests.log`. This includes actual PG action/edit_set history/new-Python-process, prior app creation two-process check, all existing attribution alias/custom/incomplete/duplicate/conflicting rejection tests, and completed-field regression. No full backend suite was rerun.
6. Changed-contract check ran an inline Python script with `validate_contracts.validate_document(apphub_path, doc)` plus recursive local/external `$ref` resolution; parsed `git show e6eb1564565ca6df0efa9fd263505809eec9f09a:mate-platform-backend/contracts/openapi/services/apphub.yaml`, asserted `doc['paths'] == old['paths']` and whole-document equality after only renaming old AppHubReleaseTask.properties.completedAt to endTime. It read `task-6-fix1-api-evidence.json` actual COMPLETED sample and asserted nonempty `endTime` and `set(completed) <= set(declared_properties)`. Exit0: **metadata errors0, missing refs0, paths/operations unchanged, only endTime schema delta, actual completed sample declared PASS**. Persisted `task-6-fix2-canonical-evidence.json`.
7. Fresh API process recovery command: `mate-platform-backend/.venv/Scripts/python.exe .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-6-fix1-provenance-check.py --recover`. Exit0: **PASS new API process: both alias receipts retained after targets left ObjectSet**. Log `task-6-fix2-api-recovery.log`; existing exact receipt evidence updated with `new_api_process_same_alias_receipts=PASS`.
8. `git diff --check` exit0. Complete three-file diff self-reviewed. No frontend/tsc/build/browser or unchanged migration suite rerun; their prior results remain historical evidence, not new Fix2 claims.

### Resource ownership and remaining boundaries

Before any execution/restart, verified dedicated container `d259c84a755a19ea18a1b089bb9cd83351dd6974dbd364555ab9740f3647bafa`, image `pgvector/pgvector:pg16`, sole mapping127.0.0.1:55497, running. DB names and credentials remained isolated; no Docker mutation. Initial API55510 listener44604/start01:17:44.139695+08 and exact task-6-ui-api.py executable/args matched ledgers. Restarted only that owned API to load the fix: intermediate listener13716/start01:39:31.988567+08; after actual alias execution, restarted only that verified instance to prove fresh-process recovery. Final listener **62164 /launcher65568 /start2026-10-12T01:41:41.430158+08**. Exact executable/args recorded in `task-6-listeners.json` and `task-6-processes.json`. Vite9367 remains66080/start23:34:03.671721+08. Protected9200PID51708 and9361PID59928 unchanged. Services retained for review; no cleanup claimed.

Fixture identity still bypasses signature; this is real handler/tenant/USER-scope/PG execution proof, not Task8 signed issuer login. Attribution means validated actual binding association, not proof of browser origin. Task7 approval expiry, Task8 real USER/SERVICE issuer classification and M2 inherited warnings remain pending. Historical provenance-free receipts remain excluded; unrelated kinds cannot acquire application history from arbitrary parameters. No need for controller dependency adjudication emerged. Independent re-review is still required, not overall Task6/Goal approval.

Source commit contains only:
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py`
- `mate-platform-backend/contracts/openapi/services/apphub.yaml`

Updated existing scratch API-check script and safe evidence/report are retained for controller archival. Controller MP11-EXECUTION.md/MP11-WEBSITE.md and all original user WIP are excluded. Final commit SHA is recorded below after owned-only staging verification.

Fix2 commit **0f68c3d86cf311fd79e66c73d235f84221590480**; parent **e6eb1564565ca6df0efa9fd263505809eec9f09a**. Post-commit exact3-file verification PASS; index empty and owned source clean. No push/merge. Ready for controller scoped independent re-review.
