# Task7 implementation report

Status: DONE_WITH_CONCERNS (implementation complete; controller independent gate pending).
Branch: codex/product-v1.1
Fixed BASE: 664aba152b40ce7d04b706ef0e39eb5d0234bd15
Commit: 35f00e8dc6cc094c9be13a0a0d9ff885b33d795e

## Result and exact boundaries

Persist verified scopes in existing API-key context/store with additive0022. Issuance requires USER, verified tenant and nonempty supported scope subset (equality allowed); roles/permission labels are never issuer grant proof. Supported scopes are platform.read/platform.write/ont.read/ont.write. SERVICE/API_KEY cannot manage keys or approve/execute as a human. Legacy [] grants fail closed and the UI requires reissue.

FastMCP and REST bind verified scopes/tenant and strip external `__caller__`. Discovery and invocation use the same static tool allowlist; unknown ordinary/dynamic/federated tools fail closed externally. Ontology operations map to exact upstream operationIds, retaining metadata and runtime scope distinctions. Read/query uses ont.read+platform.read; pending proposal uses ont.write+platform.write. Composite schema/SHACL preflight requires all four due the SHACL canonical write authority; its read category is insufficient. Preview metadata now matches actual ontPreviewV2Proposal. Existing service transport credential fallback remains only behind exact Agent operation/grant/tenant checks; human decision tools are never available to Agent dispatch.

Native dsh Cordis and WorkBuddy connector exports contain environment references only. UI tests actual initialize/initialized/list/query against same published object; no connected status from exports. Input changes abort/reset, including delayed published-page response race; temporary sessions DELETE after probing. Explicit app/page identifiers, first published object and200row probe limit remain documented.

Approval deadline is server-owned nullable legacy field on existing Proposal; confirm sets now+ONT_APPROVAL_TTL_SECONDS default900, accepted integer60..86400. Invalid config refuses confirmation; no client deadline/actor authority. Preview displays server duration and confirmed record deadline. Completed same-command replay returns original receipt after expiry, but pending/expired/undated cannot newly execute. Legacy confirmed-undated needs fresh proposal. Existing status/identity/idempotency/receipt model retained.

Approved pg_repo.py cutoffs: private _ProposalConnectionLease/_LEGACY_PROPOSAL_TX; _connect consults same owner+tenant+active connection; execute_proposal wraps only create_instance/model_type/merge_suggestion, delegates existing _execute_proposal_command body. Shared create / exclusive model+merge schema -> execute command advisory key -> tenant Proposal row -> object mutations. State/deadline reloaded after locks. Borrowed commit/close no-op, rollback marks transaction failed; outer alone commit/rollback/close, invalidates lease and resets context finally. Actual failure after mutation before receipt rolls back data/transition/receipt. Action/edit_set transaction paths preserved. Ordinary calls retain commit/close semantics. No external function atomicity claim.

## Verification commands and results

All backend commands use PYTHONUTF8=1, PYTHONDONTWRITEBYTECODE=1 and dot-source the guarded task-6-env.ps1. That script verifies the existing owned container and constructs credentials only in process environment; no DSN/token plaintext is recorded. PG regressions themselves assert127.0.0.1:55497 and codex_mp11_ prefix. No existing persistence suite with default5432/global delete was run.

RED:

- Initial new regression set observed7failed/1passed for missing deadline/scope behavior (historical tool output, no retained log).
- `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py -q --no-cov`: actualPG injected _persist_proposal_transition failure demonstrated an orphan Individual before transaction fix; exit1. Subsequent same file exit0. Exact orphan later removed only after verifying Task7 rollback Proposal provenance and no receipt, in task-7-owned-red-cleanup.json.
- `...python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py -k concrete_operation -q --no-cov -p no:cacheprovider`: exit1, ontGetV2ProposalPreview != ontPreviewV2Proposal. After exact operation allowlist/metadata correction exit0,1passed; read-only composite refusal/unknown operation denial/all-grant allowed covered.
- `pnpm --dir metaplatform-frontend/apps/web exec vitest run src/pages/mcp/IdeConfigPage.test.tsx --reporter=dot`: exit1,3passed/1failed; delayed published result after workspace reset showed query验证中 instead of未测试. Generation guard correction GREEN.
- Initial final affected nine-file backend run:111passed/10failed (task-7-backend-final.log). These were old contracts in test_ontology_write_tools (caller-string approval success) and test_protocol_tenant_binding/test_streamable_http (unscoped static fixtures/dynamic exposure and obsolete unknown error). Parent approved exact three test files; retained tenant/real HTTP roundtrip and genuine direct-helper tests, declared explicit allowed fixture scopes/agentInvokable, unknown tools remain denied. Existing fixed18601/18611 listeners were transient and confirmed absent; amended tests reserve owned55517 and shutdown/close/join in finally.
- Intermediate expanded set156passed/8warnings preceded final operation-map correction; it is prior-source evidence, not final range.

Final backend command (exact):

```powershell
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_api_keys.py mate-platform-backend/packages/mate-tech-mcp/tests/test_server.py mate-platform-backend/packages/mate-tech-mcp/tests/test_ontology_proxy_tools.py mate-platform-backend/packages/mate-tech-mcp/tests/test_ontology_write_tools.py mate-platform-backend/packages/mate-tech-mcp/tests/test_protocol_tenant_binding.py mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_http.py mate-platform-backend/packages/mate-kernel/tests/test_action_engine.py mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_proposal_preview.py mate-platform-backend/packages/mate-app-hub/tests/test_apphub_order_binding.py -q --no-cov -p no:cacheprovider
```

Exit0: **157passed,8warnings,17.44s** (`task-7-backend-green.log`). Covers key grants/service creators/revocation, tool filtering/tenant boundaries, kernel deadline/function refusal, actualPG action and legacy kinds rollback/replay/state/deadline, lease escaped context/wrong tenant, canonical key response/operationIDs, existing Proposal preview and Task6 AppHub order binding tests. RealPG is separate from mock upstream/identity fixtures; fixture USER is not signed-issuer proof.

Final UI commands:

```powershell
pnpm --dir metaplatform-frontend/apps/web exec vitest run src/pages/mcp/IdeConfigPage.test.tsx src/pages/ontology/components/ProposalConfirmDrawer.test.tsx --reporter=dot
pnpm --dir metaplatform-frontend/apps/web exec tsc --noEmit
pnpm --dir metaplatform-frontend/apps/web build
```

Exit0 each: **2files/9tests**, tsc clean, production build19.50s. Existing ProposalConfirmDrawer fixture correction was explicitly moved into Task7 ownership: pending mount, future server-confirmed deadline, executed receipt. Assertions retain denial behavior and verify pending server600seconds/10minutes plus exact server deadline. Task8 full all-web suite remains pending. `task-7-ui-build.log` records Vite warnings.

Migration command: `...python.exe .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-7-migration-check.py` exit0, PASS fresh,0021upgrade, independent-new-process scopes/deadline. Evidence task-7-migration-evidence.json; DB names below. Additive _ensure_schema tested old Proposal column absent -> nullable added, no legacy backfill.0022 legacy key rows empty grants. New-process completed execution replay additionally tested in backend file.

Protocol command: `...python.exe .superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-7-protocol-check.py` exit0 at final code (`task-7-protocol.log`, `task-7-protocol-evidence.json`). Real HTTP FastMCP initialize/list/query using persisted read key, and writer pending proposal. Existing same Task6 published Order artifact: app app-e1598b1298475cdf91c87b5bf7ecca26/page page-f5329031a0285d1d9d4fb07a9eae7409/object ont.mp11-app-ui.ind.order.alias-f321163f85f14837b5e1e859341f0066; runtime ObjectSet count1. No fallback seed. Final query rows11 before exact RED-orphan cleanup; successful query asserted exact object RID, not row count.

Actual negatives: read-key proposal/preflight/HITL refusal, forged caller, unknown dynamic/federation, foreign source/key/workspace, expired key, empty grants, revocation same initialized session401, SERVICE/API_KEY human route and creator403, readonly issuer escalation403. REST persisted-key list equals protocol list; same object query200; insufficient/HITL/unknown403. HTTP preview900/null, confirm actor from context/deadline+900, forged actor/deadline ignored, repeated same-key confirm does not extend, expired execute409. Actual create-key + get/preview/confirm response JSON Schemas and six operationIds match owned canonical routes.

## Resource identities and incident

- Existing owned PostgreSQL container codex-mp11-relationship-pg, loopback55497->5432, original configured database codex_mp11_relationship; candidate business DB codex_mp11_apphub_20261011. Docker identity/bindings recorded without credentials in task-7-resources-final.json. No container restart/image/auth changes.
- New Task7 databases at that explicit owned server: codex_mp11_agent_fresh_20261012 and codex_mp11_agent_upgrade_20261012, retained for evidence/review. Migration scope-test records retained; key plaintext discarded. Temporary protocol keys revoked. Test-specific Proposal/model records retained; exact intentional RED orphan removed and recorded.
- Re-read Task6 manifests before reuse: API55510 listener62164/launcher65568 created2026-10-12T01:41:41.430158+08; Vite9367 listener66080 created2026-10-11T23:34:03.671721+08. API used read-only as fixture published binding, not restarted or represented as signed issuer.
- Shared9200PID51708 and9361PID59928 unchanged. Temporary55517 verified absent at final, harness thread stopped/joined and sockets closed. Existing WIP screenshots/worktrees/specs/examples/bytecode preserved.
- **Harness incident:** initial REST extension incorrectly passed RateLimitConfig as Redis positional client (AttributeError); keyword correction then attempted default localhost6379 and timed out during Redis connection/HELLO before a successful REST response. A shared listener exists there. No verified no-touch claim or Redis cleanup claim is made. No shared Redis cleanup/readback action was performed. Failure preserved in task-7-rest-harness-failure.log. Corrected final harness wires explicit AsyncMock limiter only; actual caller/key repository/proxy/downstream auth are not mocked. Rate limiting **NOT_EXERCISED**; Task8 must use explicitly owned isolated Redis for the normal limiter.

## Warnings and remaining scope

Backend warning owners: Starlette TestClient/httpx deprecation; MCP legacy client helper deprecation; Ontology FastAPI on_event deprecation. Earlier cache ACL warning avoided in final command via no:cacheprovider. Vite build warns existing large chunks. No warning represents a test pass beyond scope.

Real dsh/WorkBuddy runtime/login remains1.1.1 NOT_EXERCISED. Signed issuer classification/grant provisioning, full candidate and all-web suite remain Task8; strict USER guards unchanged here. Unknown tools and stdio limitations documented. Preexisting unrelated Ontology canonical paths nested under components remain untouched; only owned routes/response schemas verified, no global OpenAPI PASS. No deployment or GA claim. Controller owns independent review/gate and evidence archival.

## Explicit owned files

- `docs/active/delivery/evidence/MP11-AGENT-COMPATIBILITY.md`
- `mate-platform-backend/alembic/versions/20261012_0022_mcp_key_scopes.py`
- `mate-platform-backend/contracts/openapi/services/mcp.yaml`
- `mate-platform-backend/contracts/openapi/services/ont.yaml`
- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/action/engine.py`
- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/management_routes.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/api/origin_routes.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/caller_context.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/protocol/streamable.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/repositories/sql_models.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/security/api_keys.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/server.py`
- `mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/ontology_proxy.py`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_api_keys.py`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_ontology_write_tools.py`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_protocol_tenant_binding.py`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_streamable_http.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- `metaplatform-frontend/apps/web/src/api/ont/kernel.ts`
- `metaplatform-frontend/apps/web/src/pages/mcp/IdeConfigPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/mcp/IdeConfigPage.test.tsx`
- `metaplatform-frontend/apps/web/src/pages/mcp/McpClientPage.tsx`
- `metaplatform-frontend/apps/web/src/pages/mcp/components/ApiKeyGenerator.tsx`
- `metaplatform-frontend/apps/web/src/pages/ontology/components/ProposalConfirmDrawer.tsx`
- `metaplatform-frontend/apps/web/src/pages/ontology/components/ProposalConfirmDrawer.test.tsx`

Commit validation: git diff --cached --check exit0; committed exact28owned paths, no foreign staged files; git diff-tree names match task-7-owned-files.json.

## Task7 Fix round1 — I1 optional pgvector DDL isolation

FIX_BASE: `35f00e8dc6cc094c9be13a0a0d9ff885b33d795e`. Only approved I1 is addressed; M1 deprecation/chunk warnings remain Task8-deferred. Exact owned source paths:

- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py`

The private Proposal lease captured `_try_pgvector_upgrade` on the business connection. A swallowed genuine DDL failure left that transaction aborted; successful DDL could publish readiness flags and then be rolled back by a later receipt failure. The narrow eight-line guard now defers optional schema upgrades while this repository owns an active lease. Actual JSONB embedding generation/writes remain inside the Proposal transaction. Ordinary repository calls retain independent upgrade/commit/close behavior and vector indexing. No new lifecycle/pool/store, embedding disable, action/edit_set change, or external-function atomicity claim.

### Owned target and actual SQL reproduction

New database `codex_mp11_agent_pgvector_fix1_20261012` was announced, checked absent, and created on existing explicitly owned PostgreSQL127.0.0.1:55497; manifest `task-7-fix1-db.json`. The existing guarded env script verifies owned container `/codex-mp11-relationship-pg`, exact loopback binding and codex_mp11_relationship identity. No new network listener, Redis use, restart, auth change, or shared DB mutation in this fix. Original shared9200/9361, owned Task6API55510/Vite9367 and original Task7 DB identities/boundaries remain as recorded above.

Tests use actual `_embed_chunks` with deterministic nonempty three-dimensional embedder output. The unavailable-extension test rewrites only the optional CREATE EXTENSION statement to actual SQL `CREATE EXTENSION codex_mp11_unavailable_vector`, verifies SQLSTATE0A000 and PostgreSQL INERROR transaction status, and exercises JSONB mutation+receipt+replay. It does not substitute a Python-only exception. The rollback test drops only the optional vector column in this dedicated DB, injects failure after actual embedding writes, and checks no Individual/embedding/receipt/column persists, Proposal remains confirmed, readiness stays false/dim0, then retry/replay succeeds. Ordinary unavailable-extension JSONB fallback and successful vector upgrade/indexing are checked. Existing actualPG expiry/undated/state-race/replay regressions remain covered; existing vector KNN/hybrid tests exercise ordinary384-dimensional behavior on this same dedicated DB.

### Exact commands and RED/GREEN results

All commands ran at repository root with `PYTHONUTF8=1`, `PYTHONDONTWRITEBYTECODE=1`, then dot-sourced `.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-6-env.ps1` without printing credentials.

RED against FIX_BASE production plus the two new tests, and focused GREEN after guard:

```powershell
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py -k proposal_embedding -q --no-cov -p no:cacheprovider
```

RED exit1, two failures (`task-7-fix1-red.log`, original tool chunk7aa348): real `psycopg2.errors.InFailedSqlTransaction` at receipt SQL after extension failure, and `_pgvector_ready True is False` after actual rolled-back DDL. GREEN exit0, `.. [100%]` (`task-7-fix1-focused-green.log`, chunkb11460).

Final covering run, source range FIX_BASE plus exactly the two approved file diffs:

```powershell
$env:AI09_PG_DSN=$env:MP11_APPHUB_PG_DSN.Replace('/codex_mp11_apphub_20261011','/codex_mp11_agent_pgvector_fix1_20261012')
mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py mate-platform-backend/packages/mate-tech-ont/tests/test_ont_ai09_vector_search.py::TestPgVector -q --no-cov -p no:cacheprovider
```

Exit0, **28 passed, 2 warnings in7.18s**, `task-7-fix1-covering.log`, tool chunka811ae. Warnings: existing Starlette/httpx TestClient deprecation and class-scoped instance-fixture PytestRemovedIn10Warning. No unchanged frontend/typecheck/build/full-backend repeats. Original157-pass source range and Redis limiter-fixture boundary above remain historical evidence, not rerun claims.

### Evidence retention and incident

`task-7-original-ui-typecheck-receipt.md` recovers the original9UI output (chunk5a53e5/session55544) and final process exit0/build output (chunk21c513), with command provenance. The original tsc step was silent; no independent tsc-only tool output exists. Its original exit0 is established by the command's explicit nonzero exit guard before the successful build, not a fabricated transcript. Task8 all-web check remains pending.

The original RED pytest fixture representation exposed only a password prefix, not the complete password or an API secret, for the owned Fix1 PG fixture. Durable RED log sanitized and fixture repr made identity-only before GREEN; original conversation output was not retracted. Categorical sanitized receipt: `task-7-fix1-repr-incident.md`. No credential rotation/restart/readback was performed. Original Task7 Redis timeout incident remains recorded above; rate limiting remains NOT_EXERCISED, to be checked with Task8 isolated Redis.

Fix1 commit: e9ef0de62bb819c6fa09a6257aeb2ebfdaeaa1e9. Exact two approved paths committed; git diff --cached --check exit0, diff-tree ownership matched, and both owned paths clean after commit. Covering tests above ran on these same file contents before commit. No other WIP staged or committed.
