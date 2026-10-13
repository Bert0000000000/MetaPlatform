# Ontology issue release implementation plan

> **For agentic workers:** Use subagent-driven-development for the independent schema repair and requesting-code-review before merge. Preserve this worktree and the automation ledger.

**Goal:** Repair the cloud publication blocker #116, integrate ontology PR #109 with current main without lost commits, and correct usage/materialization regressions #115/#113 before an exact-revision Tencent release.

**Architecture:** Retain tenant-scoped AppHub repositories and the existing additive deployment upgrade. Preserve schema transaction locks and original link cardinality. Frontend samples normalize property aliases without merging distinct full RIDs; usage returns explicit counters.

**Tech Stack:** Python 3.12, locked uv dependencies, Node 22, frozen pnpm lock, PostgreSQL 16, native Playwright CI.

**Spec:** AGENTS.md; ADR-0080, ADR-0082, ADR-0083; contracts/openapi/services/{ont,apphub}.yaml; GitHub issues #113, #115, #116 and PR #109.

## Global Constraints

- Work only in the newly attached issue-main-cicd-20261013 worktree on codex/issue-main-cicd-20261013, initially dc8980d3e129e94f0bc55190705ede7cbe304ba0.
- Preserve all primary checkout WIP, other worktrees, services, containers and databases. Local Docker API returns 500; use existing independent CI PostgreSQL jobs rather than restarting it.
- No credentials in source, reports, logs or Git. Unknown dependencies continue to refuse publication.
- Existing app/module/page records, grants and publication snapshots must remain unchanged by schema preparation; repeated upgrade makes zero mutations.
- No merge until latest main is included and required checks pass. Verify remote main SHA, same-SHA CI and deployment result. Do not disable branch protection or CI.

### Task 1: Restore AppHub catalog reads (#116)

**Files:** infra/demo-cloud/configure_schema.py; infra/demo-cloud/verify.py; infra/demo-cloud/CICD.md; mate-platform-backend/packages/mate-app-hub/tests/test_demo_schema_upgrade.py; infra/demo-cloud/tests/test_cicd.py.

- [ ] First reproduce: upgrade a fresh isolated schema using schema_tool().upgrade_schema(connection), then exercise list_modules/list_pages/list_apps through the actual SQL facade and /bindings/usage. Expect current missing apphub_modules table failure; test empty usage and actual draft/published bindings across tenants.
- [ ] Expand the explicit allowlist to all AppHub ORM catalog tables needed by current routes, plus the existing MCP keys table. Use ADDITIONS.get(name, set()) when checking legacy columns; keep all existing type/nullability/grant/connected-target checks.
- [ ] Update existing fixtures to represent complete legacy catalog state without weakening old-row, zero-mutation-retry or fail-closed assertions. Exercise fresh and partial schemas on SQLite and real CI PostgreSQL.
- [ ] Extend credential-free release verification to call modules and bindings/usage on the synthetic class; an HTTP failure blocks release and an empty known result succeeds.
- [ ] Run SQLite schema cases, complete AppHub publication tests and demo unittest suite. Update docs to describe the expanded initializer. Record actual red/green results and PG limitation.

### Task 2: Integrate ontology PR #109

**Files:** pg_repo.py; test_mp11_relationship_writes.py; ontology-from-data.spec.ts; generated/bundled.yaml.

- [ ] Fetch the latest PR head and main; merge the actual PR branch into this integration branch, resolve only conflicts, preserve main's property_slug logic.
- [ ] Reproduce two-connection inherited endpoint writes competing with child supersession; both operations must complete or reject cleanly, never deadlock or leave dangling links. Take shared schema-definitions transaction lock before link and endpoint locks; supersession already holds its exclusive counterpart.
- [ ] Replace stale exact-label browser assertion with two actual semantic inheritance-edge selectors and preserve the rest of the real publication/sync/parent-query scenario.
- [ ] Generate OpenAPI bundled.yaml with the repository bundle entrypoint; verify contract lint and strict checks.
- [ ] Run focused kernel/modeling/relationship and frontend regressions; independent reviewer must evaluate changes.

### Task 3: Explicit write usage (#115)

**Files:** pg_repo.py; existing PostgreSQL usage regression; UsagePage.tsx and UI test.

- [ ] Add a read-only usage row and a row with actual write activity; assert literal reads/writes zero and nonzero counts.
- [ ] COALESCE the FILTER SUM counters to 0. UI renders null/missing statistics as unavailable rather than blank and retains read/write distinction.
- [ ] Run focused backend and UI regressions; include actual write and readback in independent PostgreSQL CI.

### Task 4: Materialization property aliases (#113)

**Files:** MaterializationSamples.tsx; focused sample component test.

- [ ] Render RID-keyed schema with slug-keyed data, short/full/domain-prefixed/versioned RID fixtures and distinct same-slug properties; assert one correctly valued column per unambiguous property and separate true extras.
- [ ] Match canonical full RID first, derive aliases using existing property_slug semantics, and consume an alias only when unambiguous. Never collapse two distinct RIDs or substitute null values with unrelated data.
- [ ] Run sample tests, frontend full unit tests/typecheck/build and real browser CI.

### Task 5: Merge and Tencent release

- [ ] Re-fetch main and PR head before pushing and before merging; if new commits arrive, incorporate them and rerun affected checks. Never force push shared branches.
- [ ] Open integration PR with codex and available codex-automation labels and attach it to this chat. Merge by merge commit after all required and affected checks pass, retaining PR109 ancestry.
- [ ] Verify remote main, all same-revision release workflows and the Tencent deployment JSON artifact, including server revision and real checks.
- [ ] Verify public login and the repaired query/write flows using only independent synthetic records. Close only issues with complete current acceptance evidence; preserve others and record follow-up boundaries in automation memory.

## Triage boundaries

#111 has just merged as #110 and requires cloud verification at current server revision. #112 lacks a configured registered source; #114 requires a supported Action authoring/run design; #117 requires authoritative lifecycle dependency protection beyond adding a delete button. Issue #1 is a historical documentation question. This run prioritizes publication and integration blockers with the existing contracts; these remaining issues stay open until their full acceptance can be demonstrated. The no-issue streak is 0 and the schedule remains ACTIVE; pause only after four consecutive successful empty issue-list runs.
