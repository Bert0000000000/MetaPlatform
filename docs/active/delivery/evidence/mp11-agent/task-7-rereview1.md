**I1 — Isolate optional pgvector upgrade failure from the borrowed Proposal transaction — ADDRESSED.** `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:1424-1431` returns before connection acquisition/DDL for an active same-repository Proposal lease. Failed optional SQL cannot abort the business transaction, and readiness cannot be published for upgrade DDL later rolled back with a failed receipt.

### Finding Verdicts

- **I1 — ADDRESSED.** Guard matches `_connect` interception (`pg_repo.py:1358-1362`) and existing three-kind active lease (`:7154-7175`); outer owner still commits/rolls back and invalidates/resets lease (`:7176-7187`). No second business transaction or action/edit_set alteration.
- **Fallback — verified.** Actual embedding generation (`pg_repo.py:4325-4346`) and JSONB write (`:4367-4376,4412-4433`) remain enabled. `mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py:363-367,392-404` supplies nonempty deterministic embedding output and genuinely failing CREATE EXTENSION, asserting SQLSTATE0A000 and PostgreSQL INERROR. `:408-416` checks Proposal execution performs no optional DDL, commits both JSONB embeddings, returns business receipt and replays it.
- **Rollback/readiness/cache — verified.** Test removes optional column only in dedicated Fix1 DB and injects post-embedding receipt failure (`test_mp11_client_contract.py:431-444`). It verifies no Individual/embedding/vector column/receipt, readiness false/dim0, persisted Proposal confirmed, and successful retry/replay (`:446-456`). Source reloads persisted Proposal state (`pg_repo.py:6032-6046`) and resets lease (`:7183-7187`). Without upgrade DDL/readiness publication under the lease, receipt rollback cannot leave this attempt cached as ready.
- **Ordinary calls — verified.** Existing independent connection/commit/readiness remains reachable outside lease (`pg_repo.py:1463-1475`). Tests cover ordinary JSONB fallback after genuine SQL failure (`test_mp11_client_contract.py:417-425`) and successful ordinary upgrade/vector indexing (`:457-465`). Existing ready-vector writes remain enabled.

### New Breakage in the Fix Diff

- **None. Critical 0 / Important 0 / Minor 0.** Supplied package changes exactly two files: eight production lines and 128 test lines. Guard only defers optional upgrades under this repository's active Proposal lease. Source and existing covering evidence resolve scoped doubts; no test rerun necessary.

### Out-of-Scope Observations

- **None newly discovered.** Original M1 warnings remain Task8/final-review owned, not new fix breakage. Signed issuer/classification, isolated normal Redis limiter, all-web/full candidate and real dsh/WorkBuddy runtime retain existing reported boundaries.

### Checks

- **Scope:** Read binding re-review instructions, full brief, complete original findings, full report/Fix1 appendix and supplied `review-35f00e8d..e9ef0de6.diff` once. FIX_BASE `35f00e8dc6cc094c9be13a0a0d9ff885b33d795e` to supplied HEAD `e9ef0de62bb819c6fa09a6257aeb2ebfdaeaa1e9`. No regenerated Git diff or index/branch operation; initial key/protocol review not repeated.
- **RED:** Selected non-secret `task-7-fix1-red.log:62-64,95-102` lines retain both named failures: actual InFailedSqlTransaction and readiness True is False. These directly match both I1 defects.
- **GREEN:** `task-7-fix1-covering.log:1,3,7,16` shows **28 passed, 2 warnings in 7.18s** for reported covering run, including client-contract and existing ordinary vector tests. Warnings at `:4-13` are existing Starlette/httpx and class-scoped instance-fixture deprecations. Separately retained `task-7-fix1-focused-green.log:1` contains only one dot, so it does not independently establish report's complete two-test focused transcript. Complete covering result supports verdict. No reviewer rerun claimed.
- **Original UI/typecheck provenance:** `task-7-original-ui-typecheck-receipt.md:3,7-14,23-24,29-37` retains original 9 UI output and final process exit0/build completion. Silent standalone tsc exit0 is command-gated original-run evidence; no separate raw tsc-only output exists. Recovered existing-run receipts are not fresh Fix1 frontend/build evidence.
- **Resource/incident boundary:** `task-7-fix1-db.json:2-5` names owned loopback55497 dedicated Fix1 DB. Fixture validates explicit loopback/owned prefix and identity-only representation (`test_mp11_client_contract.py:348-377`). `task-7-fix1-repr-incident.md:3-7` records original truncated password-prefix exposure, sanitized durable RED log and unretracted conversation output. Original Redis incident/limiter-fixture limitation remains reported. Review printed no credential fragments, raw environment, Docker config or DSN.
- **Execution boundary:** Read-only source/evidence inspection and this report only. No tests/builds/network probes/database connections/Docker/service actions/cleanup/deployment. Some default shell reads failed from helper initialization; narrowly justified elevated commands read exact required cutoffs. Two apply_patch writes, default shell write and node file API failed from infrastructure. Controller explicitly authorized a narrowly elevated write of only this report; no production/index/branch file was edited.

### Verdict

**Fix round: All findings addressed, no new Critical/Important breakage.** I1 closed. New counts **C0/I0/M0**. Scoped Fix1 verdict only; no signed-login/full-candidate acceptance, deployment or GA claim.
