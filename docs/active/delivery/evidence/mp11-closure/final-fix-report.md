# Unified final fix wave — implementation report

**Status: DONE (implementation handoff only).** All I1–I4 changes and the controller's two precise extra consumer/fixture scopes are implemented. The sole controller scoped re-review, whole-branch acceptance, archive/retirement audit and Goal/Task8 completion remain pending.

- Repository: D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform
- FIX_BASE: 38ff11900b9d72560afe20db4715d344c1370a23
- Source commit: ee52a20037efca995808c930e12b10741a9afe12 — fix(mp11): close final application scope catalog and stop gaps
- Original final-review.md remained immutable. No nested agents/reviewers, push, merge, deployment, shared stop, data reset/drop or Scratch cleanup.
- All execution records below are new under docs/active/delivery/evidence/mp11-final-fix/. Earlier candidate reports/receipts remain historical, including the43/44-case Browser runs.

## Changes and acceptance

### I1 — exact application identity

SQL resolves the tenant-filtered exact ID first, then the tenant-local legacy code. Memory resolves the same rule under its existing app lock and returns a copy. Detail, PATCH, DELETE and release lookup call that repository resolver. The loader already calls the repository, so no loader source change was needed. Publication checks/snapshot capture/shortlinks pass the already-resolved app ID back to the loader, avoiding a second interpretation of an app's known code as another application's ID.

New collision tests cover memory, SQLite and **actual guarded owned PG**. Fifteen independent cases cover storage, published loader snapshot, HTTP detail, PATCH and runtime. They verify exact attribution, code fallback, neighbor-tenant isolation, unrelated app preservation, persistence and the accepted DELETE behavior. The immutable baseline source was also run in a private isolated import overlay to show each entry's failure without reverting live/shared files.

### I2 — proposal write capability and necessary MCP consumer

Only the three named non-action proposal handlers now check runtime platform.write immediately after the existing verified tenant context: create_instance, model_type and merge_suggestion. Proposal kinds, scoped USER/SERVICE use, documented ont.write metadata/runtime distinction, tenant checks, human confirmation/execution, deadline and replay machinery remain.

Eighteen new normal RSA-signed cases exercise memory and **actual PG**: readonly direct denial leaves the fresh tenant's stored proposal count unchanged; scoped USER/SERVICE creation succeeds; service human confirmation and wrong-tenant creation remain denied. Existing Ontology package and real Browser action/replay flows cover the untouched execution boundaries.

The required **actual** MCP probe exposed a pre-existing consumer defect: ont_propose_model_type always sent an `ont.__TENANT__` RID, so the correct upstream tenant guard returned403 and the REST MCP bridge surfaced500. This was preserved in actual-mcp-model-forwarding-failure.json. Controller Ruling41 authorized exactly OntProposeModelTypeTool RID assembly/comment and focused test_ontology_write_tools.py regressions. The RID now uses existing current_caller().tenant_id whenever context exists, and existing self._tenant only when context is None. A bound empty tenant cannot fall back. No client tenant argument, token decoding, scope/HITL widening, downstream guard change or origin-error refactor.

Actual-proposal-scopes-da9c5eef585a.json records normal signed Keycloak writer/service/readonly identities, direct three-kind readonly403 with PG counts56/56,58/58,60/60, USER/SERVICE positives and service human denial. All three MCP proposal tools then forward for USER, SERVICE and a newly issued key scoped to platform.read/platform.write/ont.read/ont.write. Every returned proposal is read back as pending through the real API. Readonly tool calls add no proposal. The new key is revoked; subsequent use returns401. Earlier failed-proof key was also exactly identified and revoked; models/pending proposals remain retained.

Controller Ruling40 authorized only the old _token helper's empty-tenant fixture to omit signed tenant_id/attributes, preserving exact400/E_TENANT_REQUIRED assertions. Absent tenant exercises require_tenant; malformed present-empty/blank/list shapes still fail401 in unchanged strict verifier coverage (56/56 signed-identity tests). No assertion was weakened.

### I3 — complete authorized catalog across all three consumers

listAllObjectTypes reads the existing limit100/offset contract until a short page. It is invocation-local, uses the existing authenticated apiClient, has no hard total cap/cache/tenant override, and rejects repeated RIDs/no progress. A later HTTP failure rejects the entire read rather than exposing a truncated success. BackingDatasourcePanel, OrderReviewBinding and ProductOnboarding use it; existing selection/error/loading behavior is retained, with explicit initial mapping catalog loading.

Nine focused consumer cases use the **real catalog client reader** with controlled HTTP transport to cover103 types, late Order/Customer, saved onboarding selection, failing later pages and repeated-page denial. Seven pre-existing consumer cases keep their original behavior assertions and only rename the mocked API to the new shared reader.

Actual signed Browser fixture fd816e17f27b creates a separate additive mp11-catalog-fd816e17f27b tenant,101 fillers plus Late Customer and Late Order (103 total). A real API proof establishes100 first-page records and three later-page records, with both business models absent from the first page. The original relationship fixture remains exactly104 types and its old assertions are unchanged.

New mp11-catalog-pagination.spec.ts provides three real current API/PG/UI receipts:

- catalog-mapping-fd816e17f27b.json: Late Order chosen; Late Customer is available; actual registered PG schema/columns discovered; confirmed mapping saved/read back; two rows synchronized.
- catalog-binding-fd816e17f27b.json: both late models, actual total field, registered relation/action selected; application page saved and reopened with both model selections retained.
- catalog-onboarding-fd816e17f27b.json: real signed subject/tenant selects the late model; reload and explicit revalidation retain it, with no error.

The fresh **full selection is47/47** (previous44 plus three new cases), recorded separately. It also retains the original source/CSV mapping, actual app preview/save/publish/shortlink/human receipt, core proposal/typed/replay/tenant and relationship checks. No authenticated trace/video/screenshots.

### I4 — immediate owned-stop guard

The immediate termination loop rechecks recorded PID, ExecutablePath, CommandLine and CreationTicks before Stop-Process, failing closed on any mismatch. The initial all-record validation also checks PID. Missing processes remain harmless.

Six focused tests execute the actual generated PowerShell with harmless functions shadowing Get-CimInstance and Stop-Process. Four cases change ticks/executable/command/PID between observations and assert zero termination and retained ownership manifest; disappearance is harmless; unchanged identity invokes only the mocked termination. No live unowned PID fault was attempted.

### M1/M2 disposition

M1 remains disclosed maintenance: inherited short HMAC fixtures, Starlette/httpx, FastAPI lifecycle/class-fixture warnings and large SPA chunks. No warning filters/suppression, performance/P95/user-study or SLO inference.

Only the plan's uniform example was reconciled under the explicit M2 equivalent-sample ruling: candidate fixed sample is Customer(id,name)/Order(id,total,status), numeric customer1/order1/2 and explicit customer_orders LinkInstances. C001/O001/O002 and customer_id/amount remain a separately described business illustration; customer_id is an ordinary field, not automatic relationship creation. Historical receipts/schema/fixtures were not relabeled. Controller independently confirmed all48 normative checkbox acceptance texts and the binding spec were unchanged.

## RED/GREEN and complete run records

Each label below has its full sanitized .log and exact command/cwd/exit/elapsed/head .json in the final-fix evidence directory. Tests ran on validated WIP over FIX_BASE; source-evidence-map.json and source-commit-map.json map the exact source bytes to the committed implementation. A later evidence-only commit is not a rerun.

| Record | Result and interpretation |
| --- | --- |
| backend-red, backend-red-2 | 22 failed /8 passed;16 product failures plus6 new PG positive-fixture absolute-count mistakes. Retained; not claimed a pristine RED. |
| backend-red-3 |16 expected failures /14 passed /1 inherited warning: SQL/memory collision, all three signed readonly proposals in memory/PG, four simulated stop identity replacements. |
| backend-focused-green |30/30 /1 inherited warning. Later I1 independent coverage expanded and is included in AppHub232. |
| frontend-red, frontend-red-2, frontend-red-3 | New fixture collection failures from unrelated Lottie/jsdom canvas initialization; first two console summaries also hit Windows GBK. UTF-8 logs retained; not counted as product RED/tests. |
| frontend-red-4 |9/9 expected behavior failures from truncated/missing-error/no-progress catalog behavior. |
| frontend-focused-green |15 passed /1 fixture query failure: binding has two legitimate Late Order options. |
| frontend-focused-green-2 |16/16, clean. Corrected new query uses findAll; assertions retained. |
| app-identity-complete-red |15 passed: pytest pythonpath overrode the intended baseline overlay. Explicitly NOT RED. |
| app-identity-complete-red-2 |15 independent failures against verified FIX_BASE AppHub source in private overlay, including HTTP detail/PATCH/runtime and published loader on actual PG;1 inherited warning. |
| apphub-package |220 passed /3 failed /79 warnings. Private runner omitted existing PG history seed prerequisite (2 failures); old empty signed-tenant fixture401 instead of intended absent-tenant400 (1 failure). |
| apphub-package-final |232/232 /79 inherited warnings, after existing additive guarded verify.seed_backend_fixture and approved helper correction; includes all15 I1 cases. |
| ont-package |698 passed /13 skipped /27 inherited warnings. All PG counterparts and mandatory candidate G23 case exercised. |
| strict-signed-tenant-cover |56/56 /1 inherited warning, unchanged malformed signed401 boundaries. |
| mcp-model-tenant-red |2 failed /19 deselected; RID placeholder mismatches caller/header and bound-empty contract. |
| mcp-write-tools-green |21/21, clean. |
| mcp-package |279/279 /71 inherited warnings. |
| web-types |tsc --noEmit exit0. |
| web-build |build exit0; disclosed large-chunk warning. |
| actual-browser-fd816e17f27b |47/47 in83.83s; new full selection count, not historical44. |
| actual-proposal-scopes-da9c5eef585a |Actual signed direct/MCP three-kind persistence/readonly/key-revocation proof PASS after model consumer source reload. |

All13 ONT skips are distinguished:8 privileged-role RLS cases remain NOT_EXERCISED (no nonprivileged RLS claim);5 memory parameterizations require PG and have passing actual PG counterparts. Unaffected Kernel/DATA/Auth full packages, unchanged broader web tests and remote CI were not rerun; meaningful affected package/selection checks above satisfy this wave.

Initial actual proposal fixture422 (invalid new underscore object/property slugs), retained diagnostic finalprobe model, actual MCP upstream403/REST500, image-name guard failure and post-reload Docker inspect timeout are retained in fixture-repairs.json / actual-mcp-model-forwarding-failure.json. No failed setup/probe was transformed into successful evidence.

## Runtime, identity guards and retained business

Only source API55522 was reloaded, twice within this same wave: first for I1/I2 handlers, then for the precise necessary MCP extension. Every stop used fresh listener ancestry plus full recorded identity and the fixed immediate termination guard. First shorthand image-name guard failed closed before Stop; verified actual image is pgvector/pgvector:pg16, not the brief's shorthand pgvector:pg16.

Current exact identities from resources-after-api-reload-mcp.json / runtime-handoff.json:

- API listener69576 / launcher68220, full executable/command/CreationTicks recorded.
- Auth listener45364 / launcher40756; Web9368 PID22216: exact original records unchanged.
- Goal PG ID d259c84a755a19ea18a1b089bb9cd83351dd6974dbd364555ab9740f3647bafa, image sha256:9b05db12a35460fff0587e009f9326e414a53e9484555547f96d214a2ba98ef7, loopback55497.
- Owned Keycloak55520 / Redis55521 exact container IDs/images/bindings retained. Auth55523/Web9368 stayed running.
- Resource-continuity.json verifies every initially running Docker container ID retained, and exact Auth/Web/KC/Redis/PG identity equality before/after.37 running at both snapshots. No shared/container/image/volume/database reset/removal.
- Second post-reload read-only Docker inspect timed out at20s after the API had started; only the read-only snapshot was retried and passed. No third restart.

retained-business-final.json proves normal signed current-source reads of app-5214d2501e8f5c76b706dea3f69670af, version ver-ad5edf1f07054feaa2dfd3632b0236cf, executed prop-47f32dc6 and original page history count1. Readonly positive GET succeeds; readonly/service human confirm/execute and wrong tenant header remain403. Added fixtures/proposals/source/mapping/application records are retained. Original candidate acceptance.json, earlier evidence, accounts and old databases were not overwritten.

Private credentials/tokens/DSNs and ownership recovery remain in ignored ACL-protected .tmp/codex-mp11-candidate outside Scratch. Bytecode writes disabled. No secrets in committed receipts and no authenticated media. Old Task6API55510 and historical PIDs were not revived/stopped.

## Source/evidence/commit ownership

Exactly24 source/test/documentation paths are owned by ee52a200; listed below. Evidence commit owns only new final-fix evidence files, the fresh additive browser-fixtures-fd816e17f27b.json provenance record, and this report. source-evidence-map.json contains26 SHA256s (24 owned plus unchanged candidate/loader); source-commit-map.json records committed blob SHA256 and normalized LF equality to the executed worktree bytes. validation-command-context.json records guarded test targets/environment/runner hashes without inputs. runtime-handoff.json is a new current handoff; the historical mp11-candidate/runtime-handoff.json is retained.

## Self-review and limitations

Read the full owned backend/UI/runner/new test diff and file contents, including segments re-read after truncated output. Confirmed one shared app lookup, ID passing for already-resolved publication/shortlink calls, exactly three new write checks, shared authorized catalog paging, no partial-success/no-progress behavior, tenant-aware MCP RID and immediate full stop guard. Corrected only the documented new fixture assumptions, preserved original assertions and inherited line ending convention. Explicit staging was verified against the24-path allowlist; source commit left index empty. Final evidence staging is also checked explicitly; no protected WIP included.

Large existing api.py/ontology_proxy.py/verify.py files and the pre-existing long PowerShell assembly are kept focused, not restructured. No remaining implementation correctness uncertainty was found in self-review. M1 maintenance,13 inherited skip boundaries, nonprivileged RLS, external dsh/WorkBuddy/native clients, public rollout/domain/HTTPS, direct-JWT immediate logout revocation, browser WS gateway,72-hour SLO/user measurement and final controller approval remain distinct. This report does not mark any global gate/Goal/Task8 complete.

### Explicit owned source paths

- docs/superpowers/plans/2026-10-11-metaplatform-product-v1.1-implementation.md
- mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py
- mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/in_memory.py
- mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_store.py
- mate-platform-backend/packages/mate-app-hub/tests/test_app_hub_tenant_integration.py
- mate-platform-backend/packages/mate-app-hub/tests/test_mp11_app_identity.py
- mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/ontology_proxy.py
- mate-platform-backend/packages/mate-tech-mcp/tests/test_ontology_write_tools.py
- mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py
- mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_proposal_scopes.py
- metaplatform-frontend/apps/web/src/api/ont/kernel.ts
- metaplatform-frontend/apps/web/src/api/ont/catalog-consumers.test.tsx
- metaplatform-frontend/apps/web/src/pages/ontology/data/mappings/BackingDatasourcePanel.tsx
- metaplatform-frontend/apps/web/src/pages/ontology/data/mappings/BackingDatasourcePanel.test.tsx
- metaplatform-frontend/apps/web/src/pages/apphub/components/OrderReviewBinding.tsx
- metaplatform-frontend/apps/web/src/pages/apphub/components/OrderReviewBinding.test.tsx
- metaplatform-frontend/apps/web/src/pages/dashboard/components/ProductOnboarding.tsx
- metaplatform-frontend/apps/web/src/pages/dashboard/components/ProductOnboarding.test.tsx
- metaplatform-frontend/apps/web/tests/e2e/mp11-catalog-pagination.spec.ts
- scripts/acceptance/mp11/manage.py
- scripts/acceptance/mp11/verify.py
- scripts/acceptance/mp11/playwright.config.ts
- scripts/acceptance/mp11/README.md
- scripts/acceptance/mp11/tests/test_manage_stop.py

### Exact execution commands and working directories

**backend-red-3** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-app-hub/tests/test_mp11_app_identity.py packages/mate-tech-ont/tests/test_mp11_proposal_scopes.py ../scripts/acceptance/mp11/tests/test_manage_stop.py -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-1040ce3c
```

Exit 1; elapsed 15.86s. Full output: docs\active\delivery\evidence\mp11-final-fix\backend-red-3.log

**backend-focused-green** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-app-hub/tests/test_mp11_app_identity.py packages/mate-tech-ont/tests/test_mp11_proposal_scopes.py ../scripts/acceptance/mp11/tests/test_manage_stop.py -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-2b692f69
```

Exit 0; elapsed 16.63s. Full output: docs\active\delivery\evidence\mp11-final-fix\backend-focused-green.log

**frontend-red-4** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web

```text
pnpm.cmd exec vitest run src/api/ont/catalog-consumers.test.tsx
```

Exit 1; elapsed 11.24s. Full output: docs\active\delivery\evidence\mp11-final-fix\frontend-red-4.log

**frontend-focused-green-2** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web

```text
pnpm.cmd exec vitest run src/api/ont/catalog-consumers.test.tsx src/pages/ontology/data/mappings/BackingDatasourcePanel.test.tsx src/pages/apphub/components/OrderReviewBinding.test.tsx src/pages/dashboard/components/ProductOnboarding.test.tsx
```

Exit 0; elapsed 2.87s. Full output: docs\active\delivery\evidence\mp11-final-fix\frontend-focused-green-2.log

**app-identity-complete-red-2** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-app-hub/tests/test_mp11_app_identity.py -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-34802312 -o pythonpath=
```

Exit 1; elapsed 36.2s. Full output: docs\active\delivery\evidence\mp11-final-fix\app-identity-complete-red-2.log

**apphub-package** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-app-hub/tests -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-3db27133
```

Exit 1; elapsed 149.63s. Full output: docs\active\delivery\evidence\mp11-final-fix\apphub-package.log

**apphub-package-final** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-app-hub/tests -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-53408772
```

Exit 0; elapsed 181.08s. Full output: docs\active\delivery\evidence\mp11-final-fix\apphub-package-final.log

**ont-package** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-tech-ont/tests -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-003c5772
```

Exit 0; elapsed 284.41s. Full output: docs\active\delivery\evidence\mp11-final-fix\ont-package.log

**strict-signed-tenant-cover** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-platform/tests/test_mp11_signed_identity.py -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-61e2f4e8
```

Exit 0; elapsed 5.14s. Full output: docs\active\delivery\evidence\mp11-final-fix\strict-signed-tenant-cover.log

**mcp-model-tenant-red** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-tech-mcp/tests/test_ontology_write_tools.py -k model_proposal -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-46f79f39
```

Exit 1; elapsed 2.13s. Full output: docs\active\delivery\evidence\mp11-final-fix\mcp-model-tenant-red.log

**mcp-write-tools-green** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-tech-mcp/tests/test_ontology_write_tools.py -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-367f1215
```

Exit 0; elapsed 2.94s. Full output: docs\active\delivery\evidence\mp11-final-fix\mcp-write-tools-green.log

**mcp-package** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend

```text
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe -m pytest -c pyproject.toml packages/mate-tech-mcp/tests -q --tb=short -p no:cacheprovider --basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-fix-pytest-4cc12c54
```

Exit 0; elapsed 70.32s. Full output: docs\active\delivery\evidence\mp11-final-fix\mcp-package.log

**web-types** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web

```text
pnpm.cmd exec tsc --noEmit
```

Exit 0; elapsed 17.15s. Full output: docs\active\delivery\evidence\mp11-final-fix\web-types.log

**web-build** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web

```text
pnpm.cmd run build
```

Exit 0; elapsed 41.95s. Full output: docs\active\delivery\evidence\mp11-final-fix\web-build.log

**actual-browser-fd816e17f27b** — cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web

```text
pnpm.cmd exec playwright test --config D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/scripts/acceptance/mp11/playwright.config.ts
```

Exit 0; elapsed 83.83s. Full output: docs\active\delivery\evidence\mp11-final-fix\actual-browser-fd816e17f27b.log

Actual orchestration commands (repository root; private inputs remain outside Scratch):

```text
mate-platform-backend/.venv/Scripts/python.exe -X utf8 .tmp/codex-mp11-candidate/final-fix-business.py reload
mate-platform-backend/.venv/Scripts/python.exe -X utf8 .tmp/codex-mp11-candidate/final-fix-business.py prepare
mate-platform-backend/.venv/Scripts/python.exe -X utf8 .tmp/codex-mp11-candidate/final-fix-business.py reload mcp
mate-platform-backend/.venv/Scripts/python.exe -X utf8 .tmp/codex-mp11-candidate/final-fix-business.py snapshot resources-after-api-reload-mcp
mate-platform-backend/.venv/Scripts/python.exe -X utf8 .tmp/codex-mp11-candidate/final-fix-proposals.py
```

## Public evidence sanitization

Controller performed an escalated scan of63public evidence files against12private JSON inputs and14actual secret-value variants: zero actual-value/JWT/private-key matches. One credential-URL pattern in the Browser log was internally classified against the fixed unsafe-URL test source as a synthetic rejected-URL case. Its public label was categorically redacted; the exact original receipt remains in ACL-protected ignored final-fix-raw-receipts outside Scratch, with original/public SHA256 in public-log-redaction.json. No matched URL or secret fragment is printed. Result47/47 and exit0 are unchanged. The earlier default-sandbox scan with0private inputs was not accepted as authoritative.

Evidence staging note: the broad Git whitespace check flagged preserved raw archived test-log blank/indented warning output. All staged non-log source/documentation/evidence files passed the scoped whitespace check. Raw historical failure/GREEN outputs were preserved, not rewritten merely to satisfy a code whitespace check.
