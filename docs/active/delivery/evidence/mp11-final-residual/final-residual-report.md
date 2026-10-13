# Final residual I1 page-save parent report

Status: BLOCKED on current dependency/business continuity, pending controller Ruling45 recovery. The narrow product amendment and required focused tests are complete. FIX_BASE ca01bf738165e2ab6ad11fdd8c9864d797885879; source commit 3e844b844a201731b8170bd40b22580a83103771 (fix(apphub): preserve code parent revision on page save). This is Ruling43's single residual exception on the existing implementation/reviewer seats. Complete immutable final-rereview1 was read; its ca01bf73 verdict remains NOT APPROVED. No scoped approval, global Gate, remote deployment or Goal completion is claimed.

## Implementation and exact ownership

Changed only:

- mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py: save_page selects the module's parent by exact a.code == module.app_code from existing tenant-local list_apps(tid), followed by existing put_app CAS. Module associations identify their parent by code.
- mate-platform-backend/packages/mate-app-hub/tests/test_mp11_app_identity.py: appended one storage-parametrized normal RSA-signed HTTP regression (memory, SQLite, actual owned PostgreSQL), retaining all original15 cases and assertions as an unchanged normalized-byte prefix.

The brief expressly allows this existing tenant-local list lookup. No new repository/export API was needed. Both storage implementations, facade, public exact-ID-first/local-code fallback, already-resolved publication/shortlink IDs, create_module existence-only behavior, schema/auth/UI/CAS implementation remain unchanged. Test PG records use fresh tenant/IDs; no DB reset/drop/create or seed occurred. Original15 tests retain their isolated fixture DELETE behavior. Failed RED fixture rows remain retained. Original candidate business data was not reset.

## RED and covering GREEN

No new regression mocks repositories, handlers, publication or auth. A normal RSA-signed token is actually verified by installed signature middleware with a test public JWK; TestClient HTTP runs in-process. PG variant uses the existing owned codex_mp11_candidate_tests_20261012 database on PG d259c84a755a19ea18a1b089bb9cd83351dd6974dbd364555ab9740f3647bafa, pgvector/pgvector:pg16, digest sha256:9b05db12a35460fff0587e009f9326e414a53e9484555547f96d214a2ba98ef7, loopback55497. Guarded PG inspection and current_database query succeeded before every covering run. These are in-process signed HTTP tests against actual PG; current live Keycloak continuity remains separate below.

| Receipt | Result | Meaning |
| --- | --- | --- |
| page-save-red.json/.log | Exit1;3 failed /1 warning | Memory, SQLite, actual PG each returned signed page PUT200 with metadata_updated:true, A revision0->0 and B0->1. Expected A0->1. All3 are product RED, no setup/fixture failure. |
| page-save-green.json/.log | Exit0;18 passed /1 warning | Original15 plus3 new cases. Saved A page/schema increment and A-only revision; full canonical serialized B app and neighboring tenant app/page bytes unchanged; public collision ID still selects B, local code fallback works, neighboring page404. |
| publication-page-save-cover.json/.log | Exit0;5 passed /4 warnings | Four affected existing test functions, including2 stale-write storage variants: ordinary SQL page save, stale application publication CAS, page-success/metadata409 partial result, saved-binding publication/snapshot/runtime. |

Each new GREEN case additionally proves publication-check sees A's incremented revision, stale pre-save parent update raises existing AppRevisionConflict, publication captures A's saved page/exact appId with prior versions intact, later draft save advances A without changing running snapshot, and stale published-parent metadata cannot overwrite it. No assertion was weakened. New cases use strict RSA signature verification. Named existing fixtures retain their original authentication/ontology fixture behavior and serve compatibility coverage, not a replacement for strict proof.

Warnings retained: identity1 inherited Starlette/httpx deprecation; existing selection same warning plus3 inherited short-HMAC fixture warnings. No suppression or pristine-output claim. No unchanged whole AppHub/ONT/MCP/web/Browser suite/build repeated; earlier232/47 receipts remain historical and are not relabeled as covering the amendment.

## Exact commands, cwd, exits and source mapping

Full sanitized covering output and exact commands are retained. Bytecode disabled, Python -B -X utf8, pytest cache disabled, unique private basetemp. Tests ran against validated worktree overlay over ca01bf73 before source commit. source-commit-map.json proves all8 validated file hashes and normalized-LF equality to committed blobs, including unchanged stores/facade/publication tests/manage/candidate. No post-commit run is fabricated.

### page-save-red

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' '-m' 'pytest' '-c' 'pyproject.toml' 'packages/mate-app-hub/tests/test_mp11_app_identity.py::test_signed_page_save_updates_only_code_parent_and_keeps_publication_cas' '-q' '--tb=short' '-p' 'no:cacheprovider' '--basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-pytest-ef395f19'

Output: page-save-red.log; command/source or private-script hash: page-save-red.json.

### page-save-green

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend; exit0.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' '-m' 'pytest' '-c' 'pyproject.toml' 'packages/mate-app-hub/tests/test_mp11_app_identity.py' '-q' '--tb=short' '-p' 'no:cacheprovider' '--basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-pytest-d1cad6cf'

Output: page-save-green.log; command/source or private-script hash: page-save-green.json.

### publication-page-save-cover

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend; exit0.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' '-m' 'pytest' '-c' 'pyproject.toml' 'packages/mate-app-hub/tests/test_apphub_publication.py::test_sql_http_page_save_and_unpublished_runtime' 'packages/mate-app-hub/tests/test_apphub_publication.py::test_stale_application_write_cannot_erase_publication_history' 'packages/mate-app-hub/tests/test_apphub_publication.py::test_page_save_reports_partial_result_when_app_metadata_conflicts' 'packages/mate-app-hub/tests/test_apphub_publication.py::test_saved_binding_publishes_snapshot_runtime_and_tenant_usage' '-q' '--tb=short' '-p' 'no:cacheprovider' '--basetemp=D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-pytest-51e1b05a'

Output: publication-page-save-cover.log; command/source or private-script hash: publication-page-save-cover.json.

### api-reload-attempt-1

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'mate-platform-backend/.venv/Scripts/python.exe' '-B' '-X' 'utf8' '.tmp/codex-mp11-candidate/final-residual-business.py' 'reload'

Output: api-reload-attempt-1.log; command/source or private-script hash: api-reload-attempt-1.json.

### api-reload-attempt-2

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-business.py' 'reload'

Output: api-reload-attempt-2.log; command/source or private-script hash: api-reload-attempt-2.json.

### post-reload-snapshot-retry

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-business.py' 'snapshot' 'resources-after-api-reload'

Output: post-reload-snapshot-retry.log; command/source or private-script hash: post-reload-snapshot-retry.json.

### post-reload-snapshot-read60

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-business.py' 'snapshot' 'resources-after-api-reload'

Output: post-reload-snapshot-read60.log; command/source or private-script hash: post-reload-snapshot-read60.json.

### retained-business-check

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-business.py' 'retained'

Output: retained-business-check.log; command/source or private-script hash: retained-business-check.json.

### retained-business-read60

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-business.py' 'retained'

Output: retained-business-read60.log; command/source or private-script hash: retained-business-read60.json.

### retained-business-direct-http

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-http.py'

Output: retained-business-direct-http.log; command/source or private-script hash: retained-business-direct-http.json.

### retained-business-direct-http-status

Cwd: D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform; exit1.

    & 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\.venv\Scripts\python.exe' '-B' '-X' 'utf8' 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.tmp\codex-mp11-candidate\final-residual-http.py'

Output: retained-business-direct-http-status.log; command/source or private-script hash: retained-business-direct-http-status.json.

## API reload and actual continuity boundary

Fresh initial/pre-stop snapshots revalidated API69576/68220 with executable/command/ticks/ancestry, Auth45364/40756 and Web22216/9368, exact KC/Redis IDs/images/bindings and exact owned PG ID/digest/binding. All37 original running container IDs were present. First reload attempt failed BEFORE Stop because read-only KC docker inspect exceeded20s; it stopped/restarted nothing. Its categorical failure reconstruction names observed complete exec traceback session10791 honestly; no raw subprocess log was captured for that initial attempt.

Second attempt passed every full fresh pre-stop predicate; unchanged fixed manage.stop immediately rechecked PID/executable/command/ticks before termination. Exactly API alone stopped/restarted once and passed openapi readiness. Command later exited1 because post-start Docker image inspect exceeded20s. Full sanitized output is retained; that operational command is not called passed. No further API restart attempted.

Fresh process-only receipt processes-after-api-reload.json verifies current API 41356/50968 and full executable/commands/ticks/ancestry; Auth/Web exact original identities unchanged. Production manage.py unchanged. Controller approved private-only bounded60s read-only Docker inspect/image-inspect/ps recovery, all identity predicates unchanged. Both20s/60s post-reload full snapshots failed and remain separate receipts. Docker-coupled retained helper also failed on PG inspect before auth; no business acceptance ran there.

Independent HTTP continuity used actual protected normal Auth credentials and intended Keycloak grant, unchanged live API signature guards. Writer login504 prevented any token. First failed assertion omitted status; separately retained diagnostic retry records actual504 in auth-login-status.json. readonly-runtime-http-status.json records website9368/login/API55522/Auth55523 openapi200 and KC55520 issuer discovery ReadTimeout8s. Sanitized owned Auth log tails retained. No stale token/historical receipt reuse, bypass, credential substitution, successful signed retained-business claim or inference from HTTP200.

Last full pre-stop inventory has all37 IDs running and unchanged supabase_db_metaontoos ID63aab943b8ef unhealthy. Complete current Docker/container health and post-reload dependency identities remain UNVERIFIED while reads time out. Worker stopped/restarted/reset/altered no shared container, DB or volume. No blanket all-healthy/preserved-current-container-state claim.

Original app app-5214d2501e8f5c76b706dea3f69670af, published ver-ad5edf1f07054feaa2dfd3632b0236cf, executed proposal prop-47f32dc6 and historycount1 have not been newly revalidated after this reload. Historical receipts remain immutable. Passing new actual-PG signed product tests do not substitute for that missing live chain.

Root independently confirmed Docker metadata hangs and issuer/auth failure. Ruling45 now authorizes root's official bounded Docker Desktop recovery under the user's Docker-startup request, retaining containers/images/volumes/DBs/previews. Worker pauses redundant probes/restarts until root outcome. Root coordinates engine and exact-owned dependency startup/readback; no recovery completion is claimed by this report.

## Self-review, preservation, sanitization and commits

Exactly2 source/test paths staged in source commit. Index empty before/after; protected tracked WIP hashes match baseline, including screenshots/ONT bytecode. self-review.json records original15 unchanged prefix, exact ownership, detached existing tenant-local list selection followed by unchanged CAS, no product fixture failure, source whitespace PASS with CR-at-EOL handling. Raw logs keep console formatting; no cosmetic all-green check claim.

New public evidence only under docs/active/delivery/evidence/mp11-final-residual. Complete report is this new Scratch final-residual-report.md and byte-equal public mirror. Earlier report/review/receipt bytes not overwritten. Private operational scripts/inputs stay ignored ACL-protected .tmp/codex-mp11-candidate outside Scratch. Capture sanitization uses known actual credential values, DSN/JWT filters; no authenticated media. Controller full privileged archival/global secret scan remains controller-owned.

The evidence commit uses explicitly enumerated paths only. Exact final SHA/index/WIP result is returned to controller and Git history after commit; this report cannot embed its own immutable Git commit SHA. No push/merge/public deployment, new agent/reviewer, Scratch cleanup, Goal rewrite, broad suite/build repetition or worker dependency intervention.

## Unresolved requirement

Product amendment is ready for the same existing reviewer's amendment-only check. Current full dependency inventory and normal signed retained-business remain blocked by Docker metadata/Keycloak responsiveness, with root Ruling45 recovery underway. No additional production fix proposed. I2/I3/I4/M2 are outside this residual; M1 remains controller-deferred. Original ca01bf73 review remains NOT APPROVED; scoped re-review/global closure pending.

## Local evidence sanitization and staging receipt

Local residual-only scan:37 public files/report,39 private JSON files,44 derived actual sensitive variants, zero actual-value/JWT/private-key/credential-URL matches. PG runtime environment was not queried during root pause; this is explicitly narrower than controller final privileged/global scan. The report mirror remains byte-equal. First explicit evidence git add returned1 because logs/Scratch are ignored; its partial index contained only owned evidence. The same explicit40-path list is force-added for these authorized evidence/report files, with no ignore-rule edit or private path staged. Protected hashes and full original status are checked again after commit.
