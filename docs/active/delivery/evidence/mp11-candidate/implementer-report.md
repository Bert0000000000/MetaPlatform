# Task 8 implementer report — candidate verification handoff

BASE: `2f869020a50707857fb5e42151ddd5dcbef03f8c`. Current source is an owned working-tree delta over BASE; final source fingerprint and commit mapping accompany this report. Implementation checks, including final canonical handler metadata reconciliation, are complete; controller task review and whole-branch review remain required. No Goal completion, public deployment or GA claim.

## Product and source changes

- Conservative USER/SERVICE classification uses normally verified issuer claims. A human requires nonempty sub/azp/preferred_username plus sid or session_state; explicit service-account metadata or service-account username excludes USER. Unknown metadata remains SERVICE. Existing signature, issuer, audience, tenant and signed scopes remain authoritative. This contract is proven with cached Keycloak25.0.6 normal password/client-credentials tokens; providers with different signed session metadata are unsupported until separately contracted.
- WS object changes uses installed TokenVerifier, bearer header, platform.read+ont.read, fixed signed tenant with no switching, SQL tenant predicate before LIMIT, worker-local tenant_scope and access-token expiry. Route binds the existing notify hub loop and only marks genuinely delivered events. Existing hub has no automatic LISTEN reconnection: bounded durable polling recovered, then explicit exact-owned API restart restored fast notifications.
- AuthService login/refresh returns verified tenantId/sub. Shared password login consumes those values; present malformed/empty tenant fails, legacy absent tenant stores empty and existing client omits X-Tenant-Id. Actual server derives signed tenant and rejects mismatch. Logout validates JWT before blacklist mutation, invokes Keycloak end-session with refresh token, and UI awaits server before local clear; partial provider failure is displayed. Direct candidate API JWTs do not consult the gateway blacklist and remain usable until expiry; refresh is revoked.
- Kernel audit identifier changes only from process-prefix/per-instance-counter to UUID per record. Actual two-repository ActionService execution previously collided; two unique PG audits now persist, same-key receipts replay identically, function effects remain two. This does not prove external function exactly-once delivery.
- Existing fixtures were corrected to intended signed human metadata/scopes, actual PG producer semantics and model prerequisite setup. MCP module purge was removed to preserve SQL metadata/caller-context identity, normal auth was installed, and unknown metadata-less external tools remain hidden/403. Unit-only mocks stay distinguished from actual issuer/Redis acceptance.
- ONT and DATA canonical operations were relocated as byte/block moves from components into paths; parsed operations/DTOs/security preserved. Candidate composes existing routes/repositories/auth/limiter; no alternate identity/store/success endpoint.

## RED/GREEN and failed-run provenance

1. Signed local-RSA identity RED3 failed/7 passed (normal human azp falsely SERVICE and metadata-less unknown falsely USER), GREEN40 with existing IAM tests; final Platform325 includes malformed/service negatives.
2. WS anonymous/invalid/expired/wrongtenant/no-scope baseline RED5 accepted; GREEN5 localRSA installed verifier. Actual PG tenant-predicate regression plus auth focused48 passed. Actual notify timing RED2.203s, GREEN0.282s after route-local loop binding.
3. Verified login tenant RED10 ->10; logout forged/expired blacklist RED4 -> Auth14 total. Browser normal password login, server logout, rejected old refresh, relogin and persisted history exercised actual Keycloak.
4. Audit collision RED repeated audit-9917fb-1 PK failure -> unique UUID local regression and actual PG two independent repositories/audits/effects, stable replay. Old counter-format assertion corrected; covering15 passed.
5. G23 original blank-tenant memory WS fixture failed after correct fail-closed route. Real-PG replacement received edit_set.applied while original test waited task.closed; PG exact event/action/count/outbox equality and independent6-second receive now pass. Separate InMemory task.closed producer assertion retained. Final G23+WS14 passed. Intermediate timeout12 passed/1 failed remains original tool-output provenance.
6. Initial broad backend inherited candidate issuer settings into old unit fixtures; corrected only child environment/root config. Initial and pre-fixture-fix logs retained. Candidate runtime never disabled signature or real limiter.
7. Initial UI prep inherited an owned Keycloak2-second client override because omitted/empty attributes did not remove it. Explicit null removes override; actual readback/restore asserted. Initial browser25 passed/18 failed retained; corrected full43 yielded42 passed/1 duplicate-name locator failure. Unique object display name corrected and its whole flow passed; added actual action/app impact flow passed separately.
8. Initial effective AppHub target defaulted shared8100, received401 issuer rejection. This is a failed configuration attempt, not no-touch evidence. Actual instantiated clients now all55522, verified with real HTTP. Controller official Docker Desktop recovery restored existing resources; receipts retained, no continuous uptime claim.
9. Original RED output exposed a truncated locally signed ephemeral RSA fixture JWT through assertion introspection, not actual provider credentials. Original tool output remains. Safe fixture/response repr and durable JWT/password/DSN sanitization now precede assertions/archive. No invented deletion or credential rotation.
10. Existing test DB Alembic attempt failed DuplicateTable after legacy fixture-created data_sources; no reset/stamp workaround. Separate newly owned fresh/upgrade databases ran actual Alembic and full signed chains. An editing helper without UTF8 failed before applying G23 change; old runner treated unknown phase as default business probe. Explicit unknown-phase rejection now prevents that ambiguity; no failed helper counted as PG-test success.

## Final validation coverage (preserve full runs and covering amendments)

| Area | Actual complete run | Final covering amendment |
|---|---|---|
| Web units |22 files,123 passed|No later frontend production changes|
| Shared login |3 passed|Included verified/legacy tenant cases|
| Web TypeScript/build |exit0/exit0|Inherited chunk-size warnings|
| Platform |325 passed|Includes signed identity|
| DATA |129 passed|Canonical metadata-only amendment tracked separately|
| MCP |277 passed|Normal auth + capability/HTTP fixture fixes included|
| AuthService |14 passed|Login/refresh/logout forgery cases|
| Kernel |733 passed,1 obsolete ID-format failed|15 passed: engine+multi-service audit regression|
| AppHub |216 passed,1 old azp-spoof failed|1 passed: stale approval retains new snapshot|
| ONT |678 passed,1 old WS fixture failed,13 skipped|14 passed: G23 producer+real PG WS+WS guards|
| Actual browser |42 passed,1 failed of43|Object whole flow1 passed; new app/action impact1 passed|

These are full runs plus covering amendments, not a single all-green aggregate run. `final-validation-coverage.json`, `frontend-checks.json`, `backend-checks.json`, original full logs and each covering log retain the distinction. `browser-checks.json` describes only the latest focused invocation. Each command/cwd/exit/elapsed/base HEAD is in check receipts; final file SHA256 manifest maps tested source to the eventual commit. No unchanged suite was repeated merely to hide previous failures.

Canonical: official OpenAPI3.1 schema downloaded from spec.openapis.org, four service structures0errors;719 internal refs0errors; moved parsed semantics equal. Repository metadata validator exit0. Actual live13 operation IDs now all match after existing ONT metrics route composition and exactly7 DATA decorator operation_id additions. DATA AST is equal to BASE after removing only operation_id keywords; no handler/auth/tenant/DTO behavior change. This13-ID proof does not imply whole runtime contract equality. Initial mismatch receipt retained. Workflow YAML parsed; modified CI was not run remotely.

## Actual signed acceptance and fault evidence

`acceptance.json` and `migration-chains.json` contain actual IDs, outcomes and no credentials. Existing AuthService obtains Keycloak password and service grants; normal TokenVerifier checks them. Writer/readonly/neighbor/service and signed unknown identities cover scope and tenant negatives. Real isolated Redis permits50 then429 on51, real60-second proposal deadline rejects execution409, real2-second issuer WS closes4401 and provider config is restored/read back. Anonymous/malformed/expired/wrongtenant localRSA security tests are separate from actual KC cases.

Actual PostgreSQL discovery -> required/type/PK/time mapping validation -> WIP draft restore -> publish -> sync -> Customer/Order relation -> real AppHub page/version/published binding -> human login/query/confirm/execute -> durable receipt -> repeat key/relogin/restart/replay. Actual CSV and201-row relationship paging plus cardinality/illegal cases are browser covered. Same-tenant action and published-app model-impact prechecks are actual browser covered. MCP initialize/list/query uses the same objects, scope-filtered discovery and human-tool denial; API key issuance/revocation covered.

Fresh owned database reaches0022_mcp_key_scopes; upgrade from0020 with existing app and undated proposal reaches0021/0022, preserves old record and rejects old undated approval, then each runs full signed business chain. Initial fresh migration log was replaced by a later no-op invocation; final revision/chain receipts and original tool output remain, no fabricated fresh-DDL log.

Named faults: exact source DB ALLOW_CONNECTIONS=false and owned sessions only, restored in finally; persistent failed sync then retry. Actual wrong column422 and locked concurrent sync409; API interruption via exact manifest process stop/start, existing run marked interrupted, retry/new process rows3 and same-timestamp PK cursor replay0. MCP endpoint unavailability observed. Receipt replay and audit count1 remain stable. Consumer fault terminates only exact LISTEN ont_changes PID/backend_start/datname/query after recheck; writer gets real event by polling1.172s, neighbor none; finally exact API restart and fast path0.282s plus original receipt replay. No automatic hub reconnection claim. Human create-instance compensation returns equivalent and instance404; readonly/service403.

## Runtime, usability, rollback and limits

Current-source candidate <http://127.0.0.1:9368/website/> and /login; API55522/Auth55523/KC55520/Redis55521, all loopback. Exact PG d259c84a... on55497, manifests list all owned databases. `runtime-handoff.json` is public safe identity/path metadata; `.tmp/codex-mp11-candidate/resources.json` and ACL-protected credentials/config live outside plan Scratch. Hidden process ancestry is checked to actual listener; stop rechecks PID/executable/start/args. Container stop/start checks ID/name/image digest/label/loopback. Cached --pull never; no shared reset/down/drop.

`run-mp11-acceptance.ps1 -Phase Status|Verify|Frontend|Backend|PrepareBrowser|Browser|Security|Recovery|Migrations|Start|Stop` validates explicit config targets. README gives normal accounts and private input location, startup and data-retaining teardown; no passwords copied. Recovery is a retained acceptance fixture rather than arbitrary repeatable health probe. Deployment configuration is isolated local candidate composition; shared Docker application images are older unchanged images.

Native browser WS needs a trusted header-capable gateway; actual acceptance uses normal header-capable signed WS. Eight existing privileged-role RLS tests NOT_EXERCISED and five memory-only parameterizations skipped with PG counterparts passing: exact IDs/reasons in skips.json. Do not claim all RLS passed. External bus dispatch for DATA/AppHub admin outbox, external dsh/WorkBuddy integration, arbitrary external side-effect exactly-once, public deployment,72-hour SLO/user study and1.1.1/1.2 remain outside this candidate exit.

Legacy Task6API55510 listener62164/parent65568 still depends on task-6-ui-api.py, task-6-ui-start/restart.ps1 and task-6-processes/listeners.json under plan Scratch; input env MP11_SOURCE_PG_DSN/MATE_DB_URL comes from exact Goal PG and codex_mp11_apphub_20261011. Read-only exact identity in legacy-fixture-handoff.json. Controller will coordinate retirement/archive after reviews. Do not stop it or delete Scratch now. Protected9200/9361 and user PNG/WIP/pyc remain excluded. Controller Docker recovery and preview handoff JSONs preserved in archive.

## Review handoff

Independent task and final whole-branch reviews remain pending. No nested reviewer was spawned. Owned files/source ranges and SHA256s are generated below; exact commit mapping follows source commit. No push/merge/public deploy performed.

## Owned source files and exact changed ranges

- `.github/workflows/ontology-loop.yml` lines 26,8, 84,15, 120,2; SHA256 `d6a1a85d030b5692bd9af47c800ea8ffe72b064ac1bf1dd00274a59264e77a8f`
- `mate-platform-backend/contracts/openapi/services/data.yaml` lines 21,182, 2360,0; SHA256 `d35d492311184c9ffdad3d07f31699c9f24ff016a29c7980fd04dafb32adf3ae`
- `mate-platform-backend/contracts/openapi/services/ont.yaml` lines 20,2, 23,11, 35,3, 39, 41,34, 76,2, 83,21, 105,9, 116,2, 118,0, 124,19, 144,2, 151,20, 172,9, 183,2, 185,0, 191,13, 205,2, 212,28, 241,10, 252,3, 255,0, 257,4, 262,2, 269,71, 345,69, 417, 419, 423, 427,4, 437,0, 444,3, 478,7, 488,2, 502,6, 514, 546,9, 558,2, 561, 563, 568,4, 573,0, 579, 586, 618,7, 628,3, 644, 651, 683, 685,2, 690, 693,28, 723, 727,3, 733, 735, 739,5, 747,3, 755, 757, 759,25, 784,0, 786, 790,5, 798, 800, 804,5, 812,3, 820, 822, 824,36, 860,0, 862, 866,5, 874, 876, 880,5, 888,91, 996,3, 1023,4, 1028,5, 1034, 1036,3, 1039,0, 1041,2, 1046,2, 1052,3, 1058,3, 1064,40, 1105,3, 1109,37, 1147,67, 1218, 1220,0, 1223,0, 1226,2, 1231,3, 1239, 1247, 1254,3, 1258,3, 1264,3, 1269, 1278, 1287, 1291,3, 1297,2, 1300, 1305,2, 1311, 1314,6, 1323,6, 1330,3, 1334, 1336,175, 4719,0; SHA256 `0ca7a958e0656b05e7054e027738bbcef6203361d38538f50cc4b8f2ac66eb6d`
- `mate-platform-backend/packages/mate-app-hub/tests/conftest.py` lines 46; SHA256 `e5f0905f7c7d8458b56b9b05ce8c4ff1d6391e3a02cbb86a3adad5af1084abf7`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py` lines 86; SHA256 `4de64c8b5ef4171b71735a5e80a8ddbf8a1c24ee5a54cb43d52d86376abdf652`
- `mate-platform-backend/packages/mate-app-hub/tests/test_apphub_publication.py` lines 317; SHA256 `772993391a5bd2f5f5acb7decd2c385892b384aab72d040f4c8606163f2eb54e`
- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/action/engine.py` lines 29,0, 447; SHA256 `85ce1b96bb15292cd07bbcee5d55bb05a5b82b8e3972f1e1a510da147ab25f3c`
- `mate-platform-backend/packages/mate-kernel/tests/test_action_engine.py` lines 121,5; SHA256 `72c0c753d3fb2282cd2e2e0ed7eb795015b42068733bae1de70f061902db83f0`
- `mate-platform-backend/packages/mate-kernel/tests/test_mp11_audit_identity.py` lines 1,11; SHA256 `f168d29e4f81faa103265ac56232b463e6ee14b4a13a3cc1819ebfeb54a1c348`
- `mate-platform-backend/packages/mate-platform/src/mate_platform/auth/middleware.py` lines 8,0, 198,9; SHA256 `50f5f09e4310f0779d0c19d7a5c4735ddb73c4a59fc504cde491d2a83af0ed0c`
- `mate-platform-backend/packages/mate-platform/src/mate_platform/auth/verifier.py` lines 33,3, 84,3, 219,5; SHA256 `e0ff3991b492cd9d02ef625f7ec357def8ee06bf2d382c2a862f7993cedb5b03`
- `mate-platform-backend/packages/mate-platform/tests/test_mp11_signed_identity.py` lines 1,64; SHA256 `22d5c3f45a62edf822b7856813f0afcf9a72451fd5120c94e9f4e8ba7824b223`
- `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/app.py` lines 775, 796, 805, 827, 836, 856, 865; SHA256 `f665410c8e4adc4ae636107a064af14d240d8594b31584d5bb7683475ecaa106`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_dynamic_registry.py` lines 36,2, 44, 46, 67, 88,12, 125, 128, 130, 146,10; SHA256 `8815e390cc948d271d4064ba9b8d4d5a8b4fdbe5538c004c52059f4d7a05e8c2`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_llm_adv_mcp.py` lines 54, 63, 136; SHA256 `a2e57c04f095fff35f53c9b07faf9682167fc1cb0ddfc966b78472ed60a9694d`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_http_endpoints.py` lines 56,2, 59,6, 77,2, 112,13, 137,0, 140,6, 149,2, 178,2, 185,2, 192; SHA256 `867d29299fc76bca7532e36d08c24a3ef4520518a6802e1c02fc7ff358723256`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_protocol_tenant_binding.py` lines 295, 298, 300,2, 303; SHA256 `e47b2ec4912447f5225bc90bf04ac234afdea84e46771bfb3d3326eb07f096c3`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_http.py` lines 150, 154; SHA256 `426f99a9a31b60c75c1b112f8b9aa17ad79e8231e7b37ed183c762e28b076031`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py` lines 1104, 1106,4, 1111,19, 1137,0, 1144,2, 1147,7, 1155,2, 1159, 1161, 1171,3, 1177,5, 1188,2, 1194, 1209,2; SHA256 `8d8eae2a5e78f349a2a36659979687fd910ff285a3c9a36361e07c6f421662ee`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py` lines 4607,8; SHA256 `e590775ab8348b52166f31df2e6d9ea580bee1faff02d73d925f26aa6bdc369d`
- `mate-platform-backend/packages/mate-tech-ont/tests/conftest.py` lines 72, 97; SHA256 `755fbfae611439243166fa9c84035ada23d7a626bfa368a1ed378e4f79cc6350`
- `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_e2e.py` lines 413,3; SHA256 `32417eb454869bdaedcb54e89ee45e1947324edc0bcad102a283f238eae8ef7d`
- `mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_ws_auth.py` lines 1,63; SHA256 `7a5f20c0c6a15338b634b75a8d8a9043f94f4039b22d9315bbb8b92e6f8952c8`
- `mate-platform-backend/packages/mate-tech-ont/tests/test_ont_act05_unified.py` lines 745, 747, 766, 769, 771, 805, 807, 838, 840, 860, 862; SHA256 `8c438686e2446347961a3287abbb8448ba01bdb8464525dc240058a631ba2af6`
- `mate-platform-backend/packages/mate-tech-ont/tests/test_ont_ai09_vector_search.py` lines 108, 110; SHA256 `243b381ec61299cbb4c2be2b0c8cf62b8a48e65d242c18f987e225328f7cf2d7`
- `mate-platform-backend/packages/mate-tech-ont/tests/test_ont_g23_functions.py` lines 97,34, 132,10, 152,11, 166,3, 174,16, 192,28, 221,6; SHA256 `708d0ed0726a55c1c3615c584e09caea5f11bbb9c0345afd65d5d52a65d0eccc`
- `mate-platform-backend/services/auth-service/src/mate_auth_service/main.py` lines 140, 371,10, 391, 400, 441,7, 449,2, 459,4, 464,3, 468,0, 470,7, 478,17; SHA256 `39626498723fb195452e712e9218e943eb1107cf923a5cfa0249530f462c8b20`
- `mate-platform-backend/services/auth-service/tests/test_mp11_login_tenant.py` lines 1,90; SHA256 `0280e0414411e2c6a265bb4b89606888dd519fdc16225af8db8f020cf0b0c2ee`
- `metaplatform-frontend/apps/web/src/components/shell/TopBar.test.tsx` lines 1,32; SHA256 `36e2165eaef4db7d6ddf2614b297d308c3dfa20d274480ade2f4ca4cc53e7063`
- `metaplatform-frontend/apps/web/src/components/shell/TopBar.tsx` lines 4, 110,9; SHA256 `d2eb7889345712723a80d212ee9dba9743a82a84c63b434f1cbdf54f7f84b500`
- `metaplatform-frontend/apps/web/tests/e2e/mp11-order-app-flow.spec.ts` lines 7,2, 29, 95, 105, 109, 114, 117, 136,46; SHA256 `65b9968230b7cd4b0466257a17cdd0259b134c7f3f2c1257ae3df69cf3a2e541`
- `metaplatform-frontend/apps/web/tests/e2e/ontology-ia-v2-data-flow.spec.ts` lines 73, 77, 81, 83, 108, 127,5, 136, 143, 149, 151, 157; SHA256 `3c568c63016ecd34f9256aa1d2d568488c1f955a0ce3c0842f6a845ce77b8b7d`
- `metaplatform-frontend/apps/web/tests/e2e/ontology-object-creation-flow.spec.ts` lines 1, 5,3, 22, 25, 28,2, 32, 39, 42, 49,2; SHA256 `381422e25d96ad0ca4089f4935e536720d4623eace41f3e1fe0810d46ed760b0`
- `metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts` lines 1, 5,2, 105,2, 111, 141, 148; SHA256 `a1dea45ad533c28020ba643468f2cc858c0dcd7543bb5ee27e1e7bb3d1d9f460`
- `metaplatform-frontend/packages/shared/src/api/auth.ts` lines 27,2, 57, 59,2; SHA256 `e17671008ca33b6fa4af771b7a235e08d6fac49ece055e52c498536d65da2d33`
- `metaplatform-frontend/packages/shared/src/components/SharedLoginPage.test.tsx` lines 1,48; SHA256 `4688f4f6cb673f9531062177fadd565567821398fa4bb2fc60237de258bee337`
- `metaplatform-frontend/packages/shared/src/components/SharedLoginPage.tsx` lines 95,7, 105; SHA256 `617f0b2f2abb72049313c86ce6f51cf271b29078214c635982b22aad249ca3c0`
- `metaplatform-frontend/tests/e2e/helpers/pg.ts` lines 13, 21,2, 30; SHA256 `00c3fea4c19122f46fff90483b4ca2037cce32b2ece636855f870582d9b459c2`
- `metaplatform-frontend/tests/e2e/ontology-loop/ontology-core.spec.ts` lines 19,3, 23, 55,2; SHA256 `bb3f2f5db929b6a1d406e76f185d373bea9d3288a41f2237b4530f8c8284eb0c`
- `scripts/acceptance/mp11/README.md` lines 1,31; SHA256 `a85bda9c955af5f814caf4746a76e77cc436aa3d73fbd095a7fe6237d2807319`
- `scripts/acceptance/mp11/candidate.py` lines 1,82; SHA256 `9d99789f1d9876a9c35eb538d208c84d6d34b4a69ec381f3e53a11a5822db747`
- `scripts/acceptance/mp11/config.example.json` lines 1,15; SHA256 `f52321d4ec937bfa2a04c0807e819d00440a2e899f200c6fd41530bb028dd8c5`
- `scripts/acceptance/mp11/manage.py` lines 1,269; SHA256 `9a887aab5b3b4556faa79c9a01ce56a88bdf2674c5191e6f1654689124734d84`
- `scripts/acceptance/mp11/playwright.config.ts` lines 1,28; SHA256 `ead19c330a3103b6c1bbc652cc569a0e14a4cfc4215646951f6af3fa19783c4f`
- `scripts/acceptance/mp11/verify.py` lines 1,765; SHA256 `c828fb6060b3ab6473984666670c994c4f7b82f5f0fb55b614c8fa26b5652bd8`
- `scripts/acceptance/mp11/vite.config.ts` lines 1,13; SHA256 `181bddb439a59d357d9f88db71b2993cd80e70ed3dd90632001a049b197447d2`
- `scripts/acceptance/run-mp11-acceptance.ps1` lines 1,35; SHA256 `77c80df7186ed491e89cd835c338000defd6b1ead7307e9892a435141032d2ed`

## Exact commands and resulting durable receipts

Run from repository root unless check receipt lists package cwd. Python is mate-platform-backend/.venv/Scripts/python.exe with PYTHONUTF8=1/PYTHONDONTWRITEBYTECODE=1. `verify.py frontend`, `backend`, `backend-rest`, `backend-fixes`, `backend-cover`, `backend-ws`, `browser`, `browser-object`, `browser-impact` retain subprocess argv/cwd/exit/elapsed in corresponding *-checks.json; historical check sources point at BASE because worktree was not yet committed. `source-manifest.json` maps final owned bytes and exact changed ranges.

Actual issuer phases: `python scripts/acceptance/mp11/verify.py` (full signed source/app/MCP chain, final source restart PASS); `prepare-browser`, `refresh-browser`, `ws`, `mapping-negatives`, `audit`, `consumer`, `faults`, `migrations`, `security`, `targets` all completed with retained named receipts. Consumer/fault/migration phases explicitly restart only ownAPI through manage.stop/start and restore source/activeDB settings in finally. Last ownAPI restart loads final13 metadata; `targets` PASS afterward. Final publicwebsite HTTP200 on9368/9200/9361 in final-public-health.json.

`python mate-platform-backend/contracts/scripts/validate_contracts.py` exit0. Officialschema Draft202012Validator against four YAMLs0errors; internal-reference walker719resolved; parsed old/new relocation equality; final actualGET55522/openapi.json13matched. canonical-structure/reference-and-equality/handlers/data-metadata-amendment JSONs contain output and hashes. Workflow YAML parsing/supportPython AST valid; git diff --check final exit recorded at handoff. Archived private credential/JWT scan reports clean without echoing matches.

Named tool-run provenance: final kernel/AppHub covering session63508 had15/1PASS and oldG23 timeout; corrected G23 realPG14PASS in tool chunk32fd21, independent6-second wait. Final guarded API metadata restart session61336, launcher40756; final listener/executable/start/args and container image digests in runtime-handoff.json. Runtime manager retains authoritative private manifest. Exact source commit mapping follows in commit-mapping.json; report itself is assigned ignored planning documentation, durable report copy accompanies archive.

## Ruling34 final CI profile amendment

Controller verified existing ga-acceptance.yml ont-kernel-tests has no PG service. Exact G23 fixture now skips only this optional realPG integration case when no DSN and MP11_WS_PG_REQUIRED is not1. Candidate Backend explicitly sets REQUIRED=1 and guarded55497 DSN: absent/invalid target hardfails. Three configuration probes prove ordinary-noPG explicit skip and required-missing/required-invalid failures; logs/commands in g23-profile-boundaries.json. Actual candidate G23+WS rerun14PASS5.76s with realPG. InMemory task.closed producer and localRSA WS negatives remain ordinary-CI coverage. No workflow gate changed and no current candidate failure was converted to skip. The13 earlier skips remain distinct from this ordinary-noPG profile's one integration skip.

Final staging uses exact owned paths. Sanitized .log evidence is force-added only because repository ignores *.log; no private inputs or authenticated trace/video/screenshots are included. Two existing CRLF fixture files preserve unchanged baseline byte-lines to avoid unrelated formatting churn; new lines are LF. Initial source-only diff check succeeded; force-added archived logs exposed trailing whitespace, now trimmed without changing recorded outcomes. Final combined diff check follows formatting commit.

Source/evidence first commit:658d2522. A follow-up preserves original CRLF fixture byte-lines in Git and removes archived log trailing whitespace only; tested Python semantics unchanged. No parent mp11-plan coordination files are staged.

Final source commit: `01a5e9d5b2916acf602a26028bee09e16ce8aeb1`. All47 owned source files mapped to committed blobs with CRLF/LF normalization equality in commit-mapping.json; exact worktree and Git blob SHA256 both retained. Final BASE-to-source diff check0. Follow-on commit only publishes mapping/report metadata. Independent reviews remain pending; signed9368 candidate kept available.

## Task8 fix round1/5: I1/I2 repair handoff

Fix BASE 67a0e34d1b8ea65f8c903f800a598d6a50451b19; source commit 726be90950e42d650bd6dc73f34cd9b8cceeef64, fix(mp11): validate signed tenants and prepare fresh browser fixtures. Checkout D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform, branch codex/product-v1.1 unchanged. Original report,47-source manifests and historical results above are preserved. Task8 is not marked verified; Goal is not complete. Scoped independent re-review and whole-branch review remain required.

### Finding dispositions and changed source

I1 fixed in existing packages/mate-platform/src/mate_platform/auth/verifier.py. A present top-level tenant_id is authoritative, followed only when absent by attributes.tenant_id, then existing string-only tenant fallback. Strings must be nonblank; supported top/attribute lists select first string and require every member nonblank/string. Null/object/numeric/empty/whitespace/mixed values and malformed attributes raise TokenError, never coercion or fallback to valid lower-priority hints. Valid higher-priority claims retain precedence. Completely absent tenant still yields empty for existing internal/global compatibility; AuthService existing login/refresh gates refuse missing identity. services/auth-service/main.py required no new change: normal verifier calls now reject invalid shapes before trusted DTO emission. Signature/JWKS/issuer/audience/scopes unchanged.

Owned tests services/auth-service/tests/test_mp11_login_tenant.py and packages/mate-platform/tests/test_mp11_signed_identity.py add login+refresh [null]/[object]/whitespace plus attributes/fallback equivalents, scalar/empty/mixed shapes, malformed attributes, valid string/list shapes/precedence, wrong audience and actual forged RSA signature. Original issuer/expiry/client-hint/userinfo/tenant-header/human-service/logout assertions remain. Process-local RSA/MockTransport and installed verifier, no ASGI lifespan/real IAM/Redis init; actual provider proof remains separate.

I2 fixed in scripts/acceptance/run-mp11-acceptance.ps1 and mp11/verify.py. Each advertised full Browser invokes prepare-browser, refresh-browser and all selected tests. Existing helper creates new additive signed relation writer/reader and empty identities, seeds104 types/201 customers/201 orders/201 links, and preserves every prior tenant/account/data. Exact owned Keycloak checked before issuer mutation. Previous/private per-run account/session inputs remain in ignored ACL-protected .tmp/codex-mp11-candidate/browser-runs. Distinct public run fixtures/logs/check receipts preserve old actual-browser.log/browser-checks.json and original47 manifests. Direct inner browser refuses consumed fixtures before launching tests. Existing E2E files/assertions unchanged, including empty groups=[] and exactly-one initial relationship. README documents preparation/retention; no reset/deletion/auth/media weakening.

The actual default powershell.exe -File invocation also exposed empty PSScriptRoot during parameter default evaluation. The same owned launcher now resolves unchanged config.example.json in its body and still validates explicit approved targets before dispatch. Failed default command and an incomplete intermediate insertion into mixed-newline source are preserved in fix-round-1-runner-preflight.json, original tool chunks19e3db/466594, both exit1/zero tests started. Both later complete successful phases use default config.

### Commands, full outputs and counts

Focused tests cwd mate-platform-backend, source package PYTHONPATH with PYTHONUTF8=1/PYTHONDONTWRITEBYTECODE=1. Only child test env removes inherited candidate issuer/DB config; actual candidate signatures/limiter remain strict.

Command: .venv/Scripts/python.exe -m pytest -c pyproject.toml services/auth-service/tests/test_mp11_login_tenant.py packages/mate-platform/tests/test_mp11_signed_identity.py -q --tb=short -p no:cacheprovider
RED before verifier edit:68 failed/66 passed/1 warning in7.77s, subprocess exit1, demonstrating authoritative malformed tenant acceptance/fallback. Complete sanitized output/argv/cwd/elapsed: fix-round-1-signed-red.log/.json.
First GREEN:134 passed/1 warning in7.00s, exit0, complete fix-round-1-signed-green.log/.json.

Final command adds packages/mate-platform/tests/test_sec_iam_01.py to the same argv after added signature/audience/attributes/precedence regressions. Concrete affected shared verifier/tenant/scope compatibility, not repeated full Platform. Result188 passed/0 failed/0 skipped/1 inherited Starlette/httpx TestClient deprecation warning in9.66s, exit0. Complete exact command/output: fix-round-1-signed-final-green.json/.log. Counts are separate; no warning filter.

Twice consecutively from root:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/acceptance/run-mp11-acceptance.ps1 -Phase Browser

Both report explicit owned config validated, prepare-browser PASS, refresh-browser PASS, then44 selected web/core cases/one worker/no retries:

- bf7ce3d0ff0d:44 passed/0 failed/0 skipped/0 warnings, outer/subprocess exit0, elapsed69.32s, reporter1.1m. Full output actual-browser-bf7ce3d0ff0d.log; exact Playwright argv/cwd/source_head/elapsed browser-checks-bf7ce3d0ff0d.json; fixtures browser-fixtures-bf7ce3d0ff0d.json.
- 1194b651968c:44 passed/0 failed/0 skipped/0 warnings, outer/subprocess exit0, elapsed58.49s, reporter57.3s. Full output actual-browser-1194b651968c.log; exact argv/cwd/source_head/elapsed browser-checks-1194b651968c.json; fixtures browser-fixtures-1194b651968c.json.

Both consume fresh empty/relation states while retaining old rows. Coverage includes draft/competition/publication, PG/CSV, existing migration, relations, app publication/action/receipt/history, normal provider logout/relogin, website22 and root core9. Authenticated trace/video/screenshots remain disabled. Original43-case failed/full and separate object/impact coverage remain historical; new44-case runs are separate, never an88-case invented run. No unchanged package suite/build/migration rerun.

### Actual signed runtime and continuity

Process-local lifecycle script uses existing manage.pg_dsn(DB), inspect_dependency(keycloak/redis), record_listener(api/auth/web), then stop(api/auth) and start(api/auth) only. Exact PID/executable/start/args/listener ancestry checked before stop; no shared service/container/PG change. Before identities fix-round-1-runtime-before.json; new API launcher10756/listener57396, Auth40756/listener45364, unchanged Web22216. Final exact identity/data manifests runtime-handoff.json and fix-round-1-final-continuity.json.

Normal Acceptance.login invokes real AuthService password grants(writer/readonly/neighbor) and Keycloak client_credentials SERVICE; installed TokenVerifier checks signed tenant/scope/human identity. Writer/neighbor human read+write, readonly human read only, SERVICE read+write but nonhuman. New GET retained order and app-5214d2501e8f5c76b706dea3f69670af both200, original version ver-ad5edf1f07054feaa2dfd3632b0236cf unchanged. New proof fix-round-1-postfix-readback.json, not reused controller restoration evidence.

After both full runs, fresh provider grants/readbacks passed; readonly WIP POST403 and readonly/SERVICE human confirm403. Original proposal replay equals retained receipt and real PG audit count remains1. All old/new archived empty identities still log in through AuthService and retain consumed group count1. Complete safe projection fix-round-1-final-continuity.json; no token/password/DSN output. Direct python scripts/acceptance/mp11/verify.py browser refused consumed fixture exit1/zero tests started, exact argv/output fix-round-1-consumed-refusal.json/.log. This is a guard proof, not a Browser test failure.

fix-round-1-acceptance-before.json snapshots prior acceptance before additive preparation; acceptance.json retains earlier checks with latest fixture metadata. Original47 source-manifest.json/commit-mapping.json unchanged. Six source BASE/tested SHA256s fix-round-1-source-manifest.json; all map to committed726be909 blob hashes/normalized-LF equality in fix-round-1-commit-mapping.json. Browser source_head67a0e34d denotes precommit HEAD plus exact tested mapped delta, not unchanged BASE.

### Self-review and concerns

Read all six source diffs: authoritative shape/precedence/DTO denial, normal guards unchanged, additive fixtures/retention, separate full outputs and consumed refusal. Source staging verified exact six paths/diff-check0. No ownership expansion, assertion weakening, agents/reviewer, branch change/push/merge/deploy/reset/cleanup. Protected parent mp11-plan/WIP/PNG/pyc excluded. fix-round-1-coverage.json is additive; prior failed counts preserved. Final evidence scan/end HEAD follow.

M1 warning noise deferred: focused run has one inherited Starlette/httpx warning, prior short-HMAC/class-fixture/lifecycle/build warnings remain disclosed. Previous release limits remain: native-browser WS gateway, direct JWT expiry after logout, explicit LISTEN restart, privileged RLS NOT_EXERCISED, external clients/bus/effects, deployment/72h SLO/user study. Private fixture histories accumulate intentionally; no cleanup authorized. Independent re-review is required before Task8 acceptance.

### Fix-round commit and final evidence publication ledger

BASE 67a0e34d1b8ea65f8c903f800a598d6a50451b19; source commit 726be90950e42d650bd6dc73f34cd9b8cceeef64; evidence commit d980180dc65cea3e46631d083690a0c61c0451b6. Evidence commit contains only28 explicitly owned report/receipt/log paths. Private secret/JWT/credential-DSN scan is clean, values/matches were never printed (fix-round-1-evidence-scan.json). The five new logs with blank EOF whitespace were trimmed only at EOF, then staged diff-check passed; actual outputs/counts unchanged. BASE-to-evidence diff-check0, source working-tree paths clean, index empty, protected user/controller WIP remains excluded. Original47 manifests are untouched and six source mappings match tested bytes.

This final metadata appendix is published in the immediately following report-only commit; the ignored assigned task-8-report.md records its exact resulting endHEAD after commit. No tests/source/runtime were changed after the passing runs or source commit. Scope remains I1/I2 fix handoff; independent re-review pending.
