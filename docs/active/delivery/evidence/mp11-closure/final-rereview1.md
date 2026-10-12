**I1 — App ID/code collisions outside deletion** — **NOT ADDRESSED in full.** Public detail/PATCH/runtime and already-resolved publication/shortlink attribution are corrected, but the changed ID-first resolver is still called with an internal, known application code during page save. This now selects and updates a different application's revision. Changed resolver evidence: `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/in_memory.py:415` and `repositories/sql_store.py:181`; affected caller: `api/app.py:1285`. The signed isolated reproduction below returns HTTP 200, changes A's page, leaves A revision 0→0 and advances unrelated B revision 0→1.

### Finding Verdicts

- **I1 — consistent tenant-local exact-ID-first resolution** — **NOT ADDRESSED in full**, for the single residual above. SQL no longer uses the ambiguous OR predicate; memory resolves exact ID before its tenant-local code dictionary. Detail, PATCH, DELETE and release use the same repository function (`api/app.py:190`, `:338`, `:383`, `:1076`). The unchanged loader calls it at `runtime/loader.py:36`; publication validation/capture and shortlink creation pass already-resolved `app.id` at `api/app.py:829`, `:843`, `:848`, `:894`. The 15 new memory/SQLite/actual-PG regressions and AppHub covering output establish those fixes. They do not cover page-save ownership: `module.app_code` is already a code association, so reinterpreting it as a public ID can advance B's application revision while A's page changes. This is the same collision/attribution integration scope, rather than an unrelated whole-branch observation.
- **I2 — direct non-action proposals require write capability** — **ADDRESSED**. Exactly the three affected handlers require `ctx.has_scope("platform.write")` before their repository mutation (`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:3489`, `:3526`, `:3931`). Existing tenant guards, proposal kinds and USER/SERVICE creation remain; human confirmation/execution guards were not changed. New normal RSA-signed tests cover memory/PG readonly denial without insert and permitted USER/SERVICE creation (`tests/test_mp11_proposal_scopes.py:62`, `:72`). Actual Keycloak-signed direct receipts show 403 and unchanged PG counts 56/56, 58/58, 60/60, with six named allowed proposal IDs. Actual MCP receipts show all three tools forwarded for USER, SERVICE and a scoped delegated key, readonly denial without insertion, and key revocation. Ruling41 is narrow: model RID uses the same bound caller tenant as outbound headers (`mate-tech-mcp/src/mate_tech_mcp/tools/ontology_proxy.py:400`–`:403`); bound-empty tenant cannot fall back to service configuration. The earlier placeholder upstream403/REST500 failure remains recorded; no scope or origin-error behavior was broadened.
- **I3 — three downstream consumers read beyond the first 100 types** — **ADDRESSED**. `metaplatform-frontend/apps/web/src/api/ont/kernel.ts:108` reads the existing authenticated limit/offset API until a short page; it has no total cap, shared cache or tenant override, rejects duplicate RIDs/no progress and propagates later-page failure. Mapping (`BackingDatasourcePanel.tsx:34`), app binding (`OrderReviewBinding.tsx:17`) and onboarding (`ProductOnboarding.tsx:62`) use this reader. Mapping adds explicit catalog loading and selection disabling at `:26`, `:76`, `:78`. Nine focused cases use the real reader with controlled HTTP transport, covering late Order/Customer, retained onboarding selection, later-page failures and repeated-page errors. Fresh signed tenant `mp11-catalog-fd816e17f27b` has 103 types with both business models on the later page. Three actual Browser/API/PG cases verify mapping save/read-back/sync of two rows, saved app binding reopening, and signed onboarding reload/revalidation. Historical 104-type relationship fixture and 44-case runs retain their separate identities; new full selection is 47/47.
- **I4 — immediate stop identity revalidation** — **ADDRESSED**. The second termination loop checks ProcessId, ExecutablePath, CommandLine and CreationTicks immediately before `Stop-Process`, and throws before termination on mismatch (`scripts/acceptance/mp11/manage.py:248`). Missing processes continue harmlessly. Six tests execute the generated PowerShell with harmless query/termination substitutes (`scripts/acceptance/mp11/tests/test_manage_stop.py:13`): four changed identity fields cause zero mocked stops and retain the manifest; disappearance is harmless; unchanged identity invokes the mock only. Meaningful RED showed four identity replacements incorrectly stopped; covering GREEN includes all six cases. No real PID-reuse fault or service stop was attempted by this reviewer.
- **M1 — inherited fixture/dependency/build warnings** — **CONTROLLER-DEFERRED, triage retained** under Ruling38. AppHub/ONT/MCP logs retain 79/27/71 warnings, and the build retains its large-chunk warning. The diff adds no warning suppression or fabricated performance/SLO claim. This remains the one original consolidated maintenance Minor, not a new fix finding.
- **M2 — fixed sample differs from original illustration** — **ADDRESSED by the explicit equivalent-sample ruling**. `docs/superpowers/plans/2026-10-11-metaplatform-product-v1.1-implementation.md:42`–`:48` identifies actual Customer(id,name)/Order(id,total,status), numeric customer1/order1/2 and explicit LinkInstances as the fixed candidate sample, preserving C001/O001/O002 and customer_id/amount as a separate business illustration. `customer_id` is explicitly an ordinary property, not automatic relationship creation. Current unchanged fixture source `scripts/acceptance/mp11/verify.py:117`–`:120` and historical `mp11-candidate/acceptance.json:51`–`:68` agree with the actual-column sample. The plan diff changes only this sample description; the current plan has 48 original acceptance checkboxes, with no acceptance-step/spec rewrite in this fix range.

### New Breakage in the Fix Diff

**Critical 0 / Important 1 / Minor 0.** The following Important is the same single residual preventing full I1 closure, not a second independently counted I1 defect.

**[Important] Preserve code-only ownership when a page save touches its parent application.** `mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/in_memory.py:415` and `repositories/sql_store.py:181` now correctly prefer IDs for public ID-or-code inputs, but `api/app.py:1285` passes an already-known `module.app_code` through that resolver. For same-tenant A.code=`collision-key`, B.id=`collision-key`, a PUT to A's page selects B and calls `put_app` on B (`api/app.py:1288`). The page save returns `application_metadata_updated:true` while A's revision never advances. This silently mutates unrelated app metadata and breaks the application revision signal used for publication CAS; source establishes the same selection in SQL, while the new focused signed probe directly reproduces memory behavior. No cross-tenant escape or live-PG failure is claimed.

**Check — why this is fix-induced and in scope:** The immutable before hunk for memory `get_app` selects the first ID-or-code match. With A inserted before B, this internal code caller previously selected A; the new exact-ID precedence selects B. Before SQL raised MultipleResultsFound; after this fix it selects B and proceeds with the wrong parent update. The downstream caller line itself is unchanged, but its result and mutation change because the reviewed resolver was changed. The review's instruction explicitly requires checking all resolver callers and new integration breakage. A code-only internal association must be resolved as such, then carried as an exact ID, while retaining public ID-first behavior and legacy data.

**Check — same-pattern callers:** The bounded AppHub caller search identified page save as the only remaining known-code getter caller that dereferences its returned App to mutate application metadata. `api/app.py:577` uses `body.app_code` only as an existence check and stores that value at `:592`; it does not update the returned application's revision. Runtime endpoints pass public ID/code inputs; already-resolved publication/shortlink callers now pass IDs. No other same-pattern mutation residual was established. No unrelated branch review was opened.

### Out-of-Scope Observations

**None newly established.** Existing M1 maintenance and disclosed operational/release boundaries stay with the controller; they are not reclassified as fix breakage. No wholly untouched new observation blocks this scoped review.

### Evidence Checks

**Check — fixed review identity:** FIX_BASE `38ff11900b9d72560afe20db4715d344c1370a23`; fixed reviewed HEAD `ca01bf738165e2ab6ad11fdd8c9864d797885879`. Existing package is 579,990 bytes with 92 indexed diff sections; independently read package SHA256 is `179b1bc4f58b5c9416a5e576fa11eb40c3b0c2fc3448611ea147fecff28cff82`. Package contains source commit `ee52a20037efca995808c930e12b10741a9afe12` and evidence commit `ca01bf73`. No git package regeneration or original-range re-review.

**Check — supplied instructions and package:** Read complete scoped instructions/formal template, verbatim original findings, final fix brief/report, index, all owned source/test/doc hunks and covering command/log/receipt/mapping records. Used bounded byte-offset passes; verbose historical UI DOM diagnostics were inspected through section-local first-occurrence projections with byte/line counts, retaining every distinct diagnostic/assertion/result. Truncated tool output was recovered through smaller named reads; repeated console formatting was not treated as new code. Necessary current caller/dataclass/CAS reads remained within the changed resolver's integration context.

**Check — current-source attribution:** Independently recomputed all 26 mapped worktree SHA256s: 26 match, zero mismatch. Read source-evidence-map/source-commit-map and the controller's overlay audit: 47 accepted Task8 paths plus 26 final-map paths yield 67 unique current paths with all declared LF equalities true. Committed-blob equality remains the controller's recorded audit; this reviewer did not run git to recalculate it. Hash equality ties evidence to bytes and does not prove behavior; it does not answer the uncovered page-save collision.

**Check — covering executions, inspected rather than rerun:**

| Record in docs/active/delivery/evidence/mp11-final-fix | Observed output / exact command coverage |
| --- | --- |
| backend-focused-green.json/.log | Exit0, 30 passed /1 inherited warning; pytest new AppHub identity, proposal scope and generated stop tests. Later expanded AppHub tests have their own covering run. |
| apphub-package-final.json/.log | Exit0, 232 passed /79 warnings; pytest packages/mate-app-hub/tests. Includes all15 I1 cases on memory/SQLite/guarded owned PG, but lacks the internal page-save code collision. |
| ont-package.json/.log | Exit0, 698 passed /13 skipped /27 warnings; pytest packages/mate-tech-ont/tests. Eight privileged RLS skips remain NOT_EXERCISED; five memory cases are PG-only scenarios with actual PG counterparts. Mandatory candidate G23 is recorded as required, not silently skipped. |
| strict-signed-tenant-cover.json/.log | Exit0, 56 passed /1 inherited warning; pytest test_mp11_signed_identity.py. Ruling40 changes only absent-tenant helper construction; original400/E_TENANT_REQUIRED assertions remain, malformed present-empty/blank/list signed shapes retain401. |
| mcp-write-tools-green.json/.log; mcp-package.json/.log | Exit0, 21 passed; exit0, 279 passed /71 warnings. Bound tenant/header RID consistency, context reset and bound-empty rejection covered. |
| frontend-focused-green-2.json/.log | Exit0, four files /16 tests passed. Nine real-reader transport cases plus seven original consumer cases. Original assertions remain; prior ambiguous new Late Order query was corrected to the AllBy variant. |
| web-types.json/.log; web-build.json/.log | tsc --noEmit exit0; pnpm run build exit0, actual transform/build output and disclosed >500kB warning. No latency/user-study/SLO inference. |
| actual-browser-fd816e17f27b.json/.log | Exact scoped Playwright config command, exit0, all47 named cases passed, 83.83s command elapsed. Three new103-type cases plus original app/data/proposal/replay/relationship/website selection; no retries/skips/failed cases reported. Trace/video/screenshots remain off. |

**Check — RED/setup distinctions:** app-identity-complete-red-2 has15 failures on verified baseline overlay; first misconfigured overlay run passed15 and is explicitly not RED. backend-red/backend-red-2 preserve22 failures including six incorrect new PG absolute-count fixtures; backend-red-3 preserves16 product regressions and14 passing cases. frontend-red1/2/3 are canvas/Lottie collection failures, not behavioral RED; frontend-red-4 has nine behavior failures. First frontend GREEN was15/1 fixture-query failure. First AppHub covering run was220/3: two omitted existing PG fixture prerequisites plus the absent-versus-malformed signed tenant fixture; final232/232 follows the approved helper correction and additive seed. MCP model tenant RED has2 failures/19 deselected before21/21. These are separate histories, not a fabricated aggregate green run.

**Check — real signed I2 persistence/MCP:** Read `actual-proposal-scopes-da9c5eef585a.json`, actual failure receipt and command context. Subject `56093853-128e-4771-8742-4af5c0f788f8`, tenant `mp11-candidate`, normal issuer signature required. Direct readonly403 preserves counts56,58,60 before/after; scoped USER/SERVICE positives have six named persisted proposals and service human403. Each of the three MCP tools has three named forwarded proposals and readonly no-insert; delegated key revoked. The report records pending read-back and post-revocation401. Earlier failed-proof key is revoked in its failure receipt. Credentials/private inputs were not accessed by this reviewer, and no new real-provider/PG invocation was made.

**Check — real I3 consumer chain:** Read fresh preparation/catalog fixture plus mapping/binding/onboarding receipts and the actual47-case log. Catalog tenant `mp11-catalog-fd816e17f27b` has100 first-page and3 later-page types; Order/Customer RID assertions establish that they are absent from the first100. Mapping source `src-68813eb7`, saved backing datasource and two actual PG rows are recorded. App page `page-eed720d276645c5a90994a374f2297ba` has actual field visibility and saved/reopened selections. Onboarding subject `08b701df-8e30-4768-98ef-c64c60af65c4` retains the selected model after reload/revalidation. Test source requires API success/read-back and tenant-local RIDs; receipts are backed by the named real browser cases, not only mocked UI assertions.

**Check — retained runtime/business evidence:** Read all four pre/post API resource snapshots, resource-continuity, runtime-handoff and both retained-business receipts. API alone changes from57396/10756 to40780/52920 and then69576/68220; Auth45364/40756 and Web22216/9368 identities, full executable/command/ticks, KC/Redis/PG IDs/images/bindings and all37 running container IDs remain consistent across the records. Snapshot strings' uptime changes are not treated as identity changes. GoalPG is exact d259c84a…7bafa with recorded pgvector image SHA and loopback55497. Original app `app-5214d2501e8f5c76b706dea3f69670af`, version `ver-ad5edf1f07054feaa2dfd3632b0236cf`, executed proposal `prop-47f32dc6` and history count1 remain; readonly positive GET/runtime plus readonly/service human and wrong-tenant-header403 are recorded. These are inspected execution-time records, not freshly queried live identities. No service/container/database was altered by this review.

**Check — sanitization/formatting boundary:** Read public-log-redaction provenance: one fixed synthetic rejected-URL label, unchanged result/count/exit, original private/raw and public SHA256s. The supplied controller instructions record the corrected67public/12private/14actual-value privileged scan with zero secrets; this reviewer did not inspect private credential contents or claim another scan. Broad default whitespace check was FAILED for console formatting/preserved CRLF fixture; the explicit non-log/CR-at-EOL handled check passed. No blanket whitespace-policy or all-green claim is made.

### Focused Check Run for the Unanswered I1 Doubt

**Check — documented doubt before execution:** The new tests and package outputs did not answer whether an internal `module.app_code` remains attached to A after the shared resolver becomes ID-first. The doubt and isolation plan were sent to the controller before running the following single probe. No suite/build or unchanged test rerun was performed.

**Check — exact command, working directory and isolation:** cwd `D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/mate-platform-backend`; PowerShell command below, child Python `-B`, bytecode disabled. Ambient DB selection is removed in the child only; all AppHub records, RSA key/token and HTTP application exist in that process. TestClient is in-process, not a request to a retained service. No file database, provider/network/private input, pytest cache or source write.

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'; @'
import os, json, time
os.environ.pop('DATABASE_URL', None)
os.environ.pop('MATE_DB_URL', None)
from fastapi import FastAPI
from fastapi.testclient import TestClient
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from mate_platform.auth.config import AuthConfig
from mate_platform.auth import install_auth
from mate_app_hub.repositories import in_memory as mem
from mate_app_hub import repositories as repo
from mate_app_hub.api.app import router
mem.reset_store()
tenant='mp11-rereview-process-only'
a=repo.put_app(tenant, mem.ApphubApp('app-owner',tenant,'A','collision-key','business',''))
b=repo.put_app(tenant, mem.ApphubApp('collision-key',tenant,'B','other-code','business',''))
repo.put_module(tenant,mem.ApphubModule('module-owner',tenant,'A module','module-code',a.code,'',''))
repo.put_page(tenant,mem.ApphubPage('page-owner',tenant,'A page','page-code','module-code','grid'))
app=FastAPI()
cfg=AuthConfig('https://issuer.invalid','mp11','backend','backend','unused',300,5,0,False,False)
verifier=install_auth(app,config=cfg)
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
verifier._cache._by_kid={'test':json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))}
now=int(time.time())
token=jwt.encode({'sub':'writer','preferred_username':'writer','sid':'signed-human','azp':'web','tenant_id':tenant,'iss':cfg.issuer,'aud':cfg.audience,'iat':now,'exp':now+60,'scope':'platform.read platform.write'},key,algorithm='RS256',headers={'kid':'test'})
app.include_router(router)
with TestClient(app,headers={'Authorization':'Bearer '+token},raise_server_exceptions=False) as c:
    r=c.put('/api/v1/apphub/pages/page-owner',json={'name':'A page edited'})
current_a=repo.get_app(tenant,a.id)
current_b=repo.get_app(tenant,b.id)
print(json.dumps({'probe':'I1 internal module code caller','http':r.status_code,'response':r.json(),'A_before_revision':a.revision,'A_after_revision':current_a.revision,'B_before_revision':b.revision,'B_after_revision':current_b.revision,'A_page_name':next(p.name for p in repo.list_pages(tenant) if p.id=='page-owner')},ensure_ascii=False))
assert r.status_code==200 and current_a.revision==a.revision and current_b.revision==b.revision+1
'@ | & '.venv/Scripts/python.exe' -B -
```

**Check — observed output:** child exit0, command wall1.3785s; the assertion confirms the defect, not product correctness. One inherited StarletteDeprecationWarning precedes this exact JSON:

```json
{"probe": "I1 internal module code caller", "http": 200, "response": {"id": "page-owner", "name": "A page edited", "layout": "grid", "widgets": [], "scripts": {}, "description": "", "application_metadata_updated": true}, "A_before_revision": 0, "A_after_revision": 0, "B_before_revision": 0, "B_after_revision": 1, "A_page_name": "A page edited"}
```

### Verdict

**Fix round: Findings remain open — I1 internal known-code page-save attribution / new Important above.** I2, I3 and I4 are addressed; M2 documentation is reconciled under the equivalent-sample ruling; M1 remains controller-deferred maintenance. New fix counts are Critical0 / Important1 / Minor0, with no second duplicate count for the I1 residual.

**Scoped candidate verdict for fixed ca01bf73: NOT APPROVED.** This single re-review does not authorize a second wave, remote merge/deployment, Scratch cleanup, global Gate/status rewrite or Goal completion. Controller adjudication, archival/private recovery audit and preserved live runtime closure remain controller-owned. Reviewer wrote only this report, changed no source/index/HEAD/runtime/DB state, used no nested reviewer and ran only the named process-local focused probe.
