### Spec Compliance

- ❌ Issues found. SQL publication and declarative execution are substantially implemented, but Task6 is not yet compliant: ID-based deletion reports false success; concurrent app registration does not enforce same-tenant code uniqueness; filtered reviews lose their visible receipts; the required publication checklist is absent; and metadata updates can mislabel the running version. See I1–I5.
- Fixed range: `fc199803ee66e9914beb53563416a59582041bc1..ae9ab8ffb4a5692506b0bde0b6ae804564a9761d`, supplied `review-fc199803..ae9ab8ff.diff`, 43 files. Read the complete artifact in contract/backend/frontend/test passes, recovering tool-truncated portions. No fresh git diff, suite/build rerun, service/database mutation, or nested agent. Only this report was written.
- ⚠️ Task7 owns authoritative Proposal expiry. Task8 owns signed issuer authentication/correct USER–SERVICE classification, whole-candidate restart/fault acceptance, and the published-app model-impact browser scenario. Current fixture-auth results do not establish those outcomes. Preserve strict guards in `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:3570` and `:3935`.
- ⚠️ The actual PG regression establishes a declarative database edit and one audit under concurrent/restarted replay. It does not establish exactly-once external function effects after process failure/rollback. Assembly is now protected by the proposal lock (`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:6805`); broader external-function crash acceptance remains unverified.

Required file coverage against the brief (paths under their stated frontend/backend roots):

| Required file | Finding/check |
| --- | --- |
| backend `contracts/openapi/services/apphub.yaml` | Publication/runtime/page/usage DTOs and operation IDs changed; M1 remains. |
| frontend `src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx` | `:392` obtains real app usage; failure interrupts submission and shows unknown. |
| frontend `src/api/ont/kernel.ts` | `:1396` adds binding-usage client. |
| backend `packages/mate-app-hub/src/mate_app_hub/api/app.py` | `:803`, `:1231`, `:1253` implement snapshots, saved pages and explicit reverse usage; I1/I2/I5 remain. |
| backend `packages/mate-app-hub/src/mate_app_hub/repositories/sql_store.py` | `:387` implements actual CAS; definitions/history persist and sessions close. |
| frontend `src/api/apphub/apps.ts` | `:48`, `:90`, `:123` use real metadata, PATCH and explicit first-use creation. |
| frontend `src/pages/apphub/AppListPage.tsx` | Actual metadata and real order application/page creation added. |
| frontend `src/pages/apphub/AppDetailPage.tsx` | Actual module code, server publication and real shortlink navigation added; I4 remains. |
| frontend `src/pages/apphub/PageDesignerPage.tsx` | Dirty/save-failure protection and actual binding preview added. Native Back cancellation is implemented but not independently covered by supplied browser tests. |
| frontend `src/pages/apphub/components/FormBinding.tsx` | Mock fields replaced by saved module configuration fields. |
| frontend `src/pages/apphub/components/PublishValidation.tsx` | **Missing required hunk**; unchanged flow-only component (`:44`). I4. |
| frontend `src/pages/apphub/runtime/AppRuntimePage.tsx` | Formal shortlink errors retained; automatic demo fallback removed. |
| frontend `src/pages/dashboard/DashboardPage.tsx` | ProductOnboarding integrated. |
| frontend `src/pages/dashboard/components/ProductOnboarding.tsx` | `:26`, `:39`, `:57` derive completion from selected artifacts and isolate tenant/user resume state. |
| frontend `src/pages/dashboard/components/ProductOnboarding.test.tsx` | Selected import evidence and rendered tenant/user switching covered. |
| frontend `src/pages/apphub/AppListPage.test.tsx` | DTOs, explicit group creation, catalog failure and partial page retry covered; these are adapter/client tests, not rendered cards. |
| frontend `tests/e2e/mp11-order-app-flow.spec.ts` | Three real API/PG browser scenarios, with explicit fixture identity. |

- Approved dependencies are appropriate to this task: SQL facade/shortlink selection, migration0021, Ruling22 migration0017 repair, Ruling23 module/page insert-only semantics, and PG declarative execution. No separate framework or whole-Goal acceptance is inferred.

### Strengths

- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_store.py:387` uses tenant/id/revision in the SQL UPDATE predicate, owns the increment and rejects stale writes. `repositories/in_memory.py:416` copies nested app state. `tests/test_apphub_publication.py:212` verifies both stores preserve newer publication history.
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py:803` captures saved definitions on the server; `runtime/loader.py:40` selects the current published snapshot. Final release approval checks its saved base pointer; `tests/test_apphub_publication.py:314` verifies409 preserves the newer pointer and undecided task.
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/runtime/binding.py:65` forwards the verified caller Bearer without service-token fallback; `:96` validates tenant, model/checksum, actual fields, Action.on and relationship endpoints. Upstream failures remain explicit. `tests/test_apphub_order_binding.py:36` covers dependency and tenant rejection.
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:6785` takes schema/key/proposal locks before assembly and rechecks persisted state; `:7057` persists event/idempotency evidence within the execution transaction. `tests/test_apphub_order_binding.py:78` checks concurrent receipt equality, fingerprint conflict, exactly one audit and stale-state refusal against actual PG.
- `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py:1238` reports actual page success separately from later application-metadata CAS conflict. The focused regression and browser save503 test (`metaplatform-frontend/apps/web/tests/e2e/mp11-order-app-flow.spec.ts:48`) check preservation instead of fake success.
- `mate-platform-backend/alembic/versions/20261011_0021_apphub_publication.py:11` adds durable fields while retaining unknown legacy timestamps. Inspected migration/restart artifacts establish fresh-head and legacy-upgrade checks, original snapshot recovery and the same original audit receipt.

### Issues

#### Critical (Must Fix)

- None identified in this task-scoped review.

#### Important (Should Fix)

1. **I1 — Deleting by application ID returns success without deleting.** `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py:394–399` resolves ID or code but then calls `delete_app(tid, code)` using the original request value, ignoring its Boolean result. Both repositories delete by code (`repositories/sql_store.py:761–772`, `repositories/in_memory.py:431`), while the frontend passes appId (`metaplatform-frontend/apps/web/src/api/apphub/apps.ts:97`). A newly created app therefore remains present/runnable after a200 deletion response and deletion event. Delete the resolved identity/code and verify the result. Add create → DELETE by returned ID → GET/runtime unavailable checks for SQL and memory.

2. **I2 — Random app IDs leave same-code concurrent creation unprotected.** `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py:306–313` separately checks for existing code, then assigns a fresh UUID. `repositories/sql_store.py:393–413` inserts by that UUID; App ORM (`repositories/sql_models.py:21–42`) and original table migration (`alembic/versions/20260801_0003_apphub.py:34–45`) have no unique `(tenant_id, code)` constraint. Two workers can both observe no app and commit two rows with the same code; subsequent code lookup raises MultipleResultsFound and module ownership by app_code becomes ambiguous. Extend atomic create-only semantics to applications, preserving existing definitions and returning409. Ruling23's actual concurrent tests (`tests/test_apphub_order_binding.py:121`) cover only modules/pages.

3. **I3 — Review receipts disappear when the action moves an order out of its ObjectSet.** `metaplatform-frontend/apps/web/src/pages/apphub/runtime/OrderReviewRuntime.tsx:22–25` filters audits against the current live `actual.orders`. With a pending-order filter, approving an order changes its status and removes it from that set. Refresh/reopen then hides its audit and can display “当前订单尚无执行回执” (`:58`), despite a durable PG receipt. Query/display app/page/proposal-attributed history independently of current filter membership, retaining tenant authorization. Cover status-changing execution followed by reload. The supplied browser test retains an unfiltered two-order result (`tests/e2e/mp11-order-app-flow.spec.ts:79`) and misses this case.

4. **I4 — Required prepublication checklist is not implemented.** The brief explicitly lists `metaplatform-frontend/apps/web/src/pages/apphub/components/PublishValidation.tsx`, but it has no hunk and remains a flow-only FlowValidationResult display (`:11`, `:44–95`). `AppDetailPage.tsx:117–120` publishes immediately and shows only a failure toast. The spec (`docs/active/specs/2026-10-11-metaplatform-product-v1.1.md:106`) requires a visible checklist for bindings, reference versions, access, required components, action policy and loadable runtime before publishing. Server dependency refusal is useful but does not satisfy this UI requirement. Wire real validation results into a reviewable publication checkpoint and preserve failed/unknown states; do not add a static green checklist.

5. **I5 — Version metadata update can mislabel the running publication.** `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py:363–372` accepts a new version while preserving PUBLISHED, the previous published pointer and its snapshot. Publishing1.0.0 then PATCHing version2.0.0 yields a published2.0.0 registry/card while `runtime/loader.py:40–46` still runs1.0.0. The client maps that version/status pair directly (`metaplatform-frontend/apps/web/src/api/apphub/apps.ts:56–59`). Distinguish draft metadata version from actual published snapshot version, or restrict the transition so an unpublished version cannot be labeled running. Cover PATCH after publication, subsequent publication and rollback. Revision CAS does not resolve this semantic mismatch.

6. **I6 — New publication setup is duplicated verbatim across three tests.** `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_otel_01.py:157`, `test_apphub_runtime_01.py:529`, and `test_apphub_shortlink_01.py:365` add the identical `_save_runtime_fixture` function, including module/page insertion and publication. The supplied rubric explicitly categorizes verbatim logic-block duplication as Important. Consolidate this into one fixture/helper so publication precondition changes cannot leave three independent copies inconsistent; preserve each test's behavior assertions.

#### Minor (Nice to Have)

1. **M1 — Canonical release list responses have the wrong JSON type.** `mate-platform-backend/contracts/openapi/services/apphub.yaml:2028` (apphubListReleaseLogs) and `:2097` (apphubListReleaseTasks) declare object responses, while `packages/mate-app-hub/src/mate_app_hub/api/app.py:1158–1166` returns arrays. Use array schemas with concrete item DTOs and validate actual response samples. The canonical PASS covers metadata/references/request models; the restarted-response samples cover Application/Runtime/RuntimeData/PageDefinition/BindingUsage, not these lists.

2. **M2 — Inherited warnings remain in final evidence.** `.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-6-ruling23-final.log:4–22` records69 Starlette/httpx and short fixture-HMAC warnings; `task-6-frontend-build.log` ends with a >500kB chunk advisory. These are the implementer's recorded inherited fixture/library/build warnings, not a newly found production-secret defect. Carry them to the existing Task8 cleanup/acceptance owner; do not call the output warning-free or broaden Task6 into a dependency upgrade.

### Evidence checked

- Inspected `task-6-ruling23-final.log`: **189 passed,0 skips,69 warnings,83.51s**. Superseded184/skip output was not used as final evidence; no suite rerun.
- Read all changed backend tests: real SQLite persistence/engine reset, SQL+memory CAS, tenant isolation, page partial-success semantics, stale approval refusal, migration shapes, production fallback refusal and duplicate preservation. Both actual-PG tests in `test_apphub_order_binding.py` assert explicit isolated targets and are included in the final189 run.
- Inspected safe whitelisted fields from `task-6-api-evidence.json`: explicitly signature-bypassed USER fixture, two successful imports (1Customer/2Orders), actual confirming actor and audit receipt. Inspected `task-6-newprocess-evidence.json` and `task-6-api-restart-evidence.json`: original snapshot/receipt recovered, same-key replay with one audit, shortlink cross-tenant/expiry/revoke checks PASS.
- Inspected `task-6-migration-evidence.json`: fresh-head and0020-with-legacy both reach0021 with CAS PASS. Inspected `task-6-ruling23-api-evidence.json`: distinct tenant-scoped same-code module/page IDs and duplicate409 retaining definitions.
- Inspected `task-6-canonical-evidence.json`:35 AppHub/8 ontology operations,0 metadata errors,0 unresolved references, operation-ID/request-model agreement, unrelated operations unchanged. That narrower evidence does not override M1.
- Read all new frontend tests and all three browser scenarios. Frontend14, direct ontology12, tsc success and browser3 are recorded in `task-6-report.md:15–24`; inspected build tail confirms20.20s success with warning. Browser3 predates only final create-hardening/OFFLINE-label changes; later HTTP/PG and tsc/build cover that delta as reported. No real-issuer/whole-Goal acceptance inferred.

### Named outside-diff checks

- **App-code uniqueness:** inspected App ORM declaration/index definitions and exact AppHub migration table/index declarations (0003/0014/0019). Existing unique indexes concern shortlinks/domains, not apps; I2 remains.
- **Mandatory publication UI omission:** read only unchanged PublishValidation.tsx to determine whether the requested checklist already existed; it is flow-specific. I4 remains.
- **Proposal/schema lock ordering:** inspected exact existing `pg_repo.py` execute dispatcher (`:7075`), legacy action helper entry (`:6369`) and supersede lock entry (`:1692`). Declarative execution takes the schema lock before proposal/object/link locks; checked call sites do not establish a new inversion. Legacy/external-function crash guarantees remain unverified.
- Read relevant spec lines100–116 to adjudicate publication/version semantics. No unchanged whole-repository crawl, no relevant memory source used, and no credential/DSN output in this report.

### Assessment

**Task quality:** Needs fixes.

**Counts:** Critical0 / Important6 / Minor2.

**Reasoning:** Durable publication, tenant-scoped module/page creation and declarative replay have substantive source and PG evidence. False deletion success, duplicate app identity, disappearing receipt history and publication/version presentation gaps still prevent Task6 approval; none is resolved by relaxing the explicit Task7/8 boundaries.
