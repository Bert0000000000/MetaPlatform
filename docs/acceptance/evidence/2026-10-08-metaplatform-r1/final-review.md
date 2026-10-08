# R1 C0–C2 final whole-branch review

Reviewed range: `e965d866b20dddf8d9ebb0418869b58a4697ee32` → `d1e11382a0d77ef44834b00c700d8a0bb1b6a96b` (18 commits). Source validation commit: `22954b68`; subsequent reviewed changes are acceptance/evidence documentation. Scope is the accepted R1 implementation plan and its global constraints, not completion of the program roadmap.

### Strengths

- **Consistent current authority and evidence boundary.** `AGENTS.md:7` identifies the authorized repository, isolated worktree, ADRs, workspace locks and executable validation entrypoints. The compatibility pointers make the historical Ontology-repository migration and old Accepted numbers historical. `docs/acceptance/2026-10-08-metaplatform-r1.md:3` distinguishes current local acceptance from remote CI, deployment and business acceptance. C0 evidence records 168 index-only bytecode removals, 11 gitlink removals with local directories preserved, and 16 registered worktrees; the initial read-only worktree listing still contains 16 entries.
- **Required database execution has meaningful completeness checks.** `scripts/ci/verify_ont_postgres.py:76` sanitizes inherited pytest selectors, `:89` collects fresh exact identities, and `:115` rejects absent, skipped, failed, extra or duplicate executions. Both subprocesses use the same sanitized DSNs and identity plugin. The workflow provisions PostgreSQL 16 with a NOSUPERUSER/NOBYPASSRLS business role and preserves the separate nine-table FORCE RLS specialty. The earlier incomplete-execution finding is closed by the actual fix, not merely by a larger passing count.
- **Producer/consumer browser compatibility was verified.** `metaplatform-frontend/playwright.migration.config.ts:8` explicitly reaches the app migration file outside the core test directory, while retaining the core workflow. The safe reporter serializes test identities instead of inherited web-server environment. `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:2532` retains the existing client's optional null/default behavior, and `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_ont_migration_plan.py:886` checks equality with omitted fields. The initial browser failure and corrected successful evidence remain distinguishable.
- **Reference and plan validation agree across layers.** `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:2114` checks reference tenant/family, `:2127` checks persisted snapshot metadata and definition checksum, and `:2155` rebuilds a plan from real family definitions before comparison. Kernel validation allows explicit removed-to-added renames and supported options while rejecting duplicate destinations and expanded plans. API status translation, ADR-0082 §2.7, source OpenAPI and generated bundle describe the same behavior.
- **Side effects share the intended scope.** `pg_repo.py:2461` fixes and locks the tenant/family instance set before writes; reattach, props, provenance, overlay, coercion and drop reuse it. PK moves update that set at `:2667` and restrict link/overlay rewrites by tenant. Data-source mapping writes use tenant plus family membership. Tests cover both a same-prefix unrelated-type decoy and a legitimate member with an unrelated instance prefix, as well as whole-row equality across seven tables after rejection.
- **Collision handling preserves data consistently.** `pg_repo.py:2230` rejects source/destination key coexistence in props, props_src, overlays and mappings before mutation. Null and equal destinations are deliberately treated as occupied. The documented cost is operator resolution of those cases; no automatic overwrite or merge is implied. The exception path at `pg_repo.py:2718` rolls back the transaction.

### Issues

#### Critical (Must Fix)

- None found within accepted R1 scope.

#### Important (Should Fix)

- None found. There is no load-bearing R1 code issue requiring a fix before integration.

#### Minor (Nice to Have)

- No new minor finding. Retain the existing deferred contract-warning classification: Redocly 36 and Spectral 100 warnings are reported outside the migration paths, with no independent historical count reproduction. The representative bundled-contract warning at `mate-platform-backend/contracts/openapi/generated/bundled.yaml:257` and five existing framework deprecation warnings remain nonblocking and belong to the documented later cleanup scope.

### Evidence checked

- Read the prepared whole-branch diff in bounded passes, including substantive documentation, workflows, contracts and generated bundle, runtime code, fixture changes, new tests and gate scripts. Initial output truncation was recovered through narrower ranges. Read the R1 plan, roadmap boundaries, ledger/ruling, ADR-0080 family/version semantics and the committed C0/C1/C2 review reports.
- Focused unchanged call-site checks covered the core Playwright config and stack command, both original migration browser cases, CI RLS service image, DTO conversion, family/row identity derivation and the transaction rollback tail. These checks addressed concrete integration risks; no broad repository crawl was used.
- Machine-parsed every committed JSON receipt for syntactic validity. For all outcome receipts, checked declared test totals and outcome counts against their case arrays. Initial migration RED is 58 cases / 34 failures / 24 passes / 0 skips; first GREEN is 69 passes; nullable RED is 5 failures and nullable GREEN is 23 passes. Intermediate 115-case and final 123-case outcomes remain separately identified.
- Parsed committed `docs/acceptance/evidence/2026-10-08-metaplatform-r1/ont-postgres.xml`: 123 passed, zero failure/error/skip, no duplicate case identities. Its exact `ont_required_nodeid` set matches `c2-final-postgres.collection.json`: migration 77, sync 9, atomicity 5, relationship concurrency 3, version 16 and query 13. All original 22 migration case identities are retained in the final result.
- Parsed committed `ont-rls.xml` (8 passed), `ci-gate-behavior.xml` (27 passed) and `migration-browser.xml` (2 passed), all with zero failure/error/skip and distinct case identities. Both browser titles in `migration-browser-list.json` match the actual successful JUnit cases. All four XML files contain no system-out/system-err and no properties other than `ont_required_nodeid`.
- Read `database-environment.json`, `runtime-sources.json`, `shared-services.txt` and the acceptance record. They distinguish pgvector regression at 55483 from native RLS/browser PostgreSQL at 55484, confirm the recorded role/RLS boundaries, disclose local Node 26 versus CI Node 22 and native binary verification limits, and record preserved service startup times. These are supplied environment/preservation evidence; this review did not independently query or restart live services. The recorded 34 passing contract tests and successful lint/bundle results were not rerun.
- All required review/evidence artifacts named by the review brief are present. The final-review exit checkbox and acceptance statement are intentionally pending the controller's documentation closure.

### Recommendations

- Record this verdict in the R1 exit checklist and acceptance document, preserving the local-only evidence boundary and explicit conservative collision policy.
- Obtain the fresh PR/mainline workflow outcomes and confirm required-check configuration at integration. This technical review does not attest remote CI or branch protection, which were not inspected or changed.
- Continue with the accepted R2 C3/C4 entry. Numeric precision, rename/coerce/PK composition and continuous-sync lifecycle remain R2 work; replay fingerprints and concurrency remain R3 work. Model rollback still restores only the model. None is represented here as solved or as an unexpected omission from R1.

### Assessment

**Ready to merge? Yes — technically ready for R1 integration.**

**Reasoning:** The C0–C2 changes are coherent across authority, executable gates, API contract and repository side effects, and the committed exact-identity database and existing-client browser evidence supports the scoped local result. No new Critical or Important issue was found; remote CI, deployment and business acceptance remain separate unverified stages.

Review was read-only except for this requested report. No subagents, Git mutations, suite reruns, service/database mutations or resource cleanup were performed.
