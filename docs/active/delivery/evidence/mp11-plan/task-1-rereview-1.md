# Task 1 — scoped re-review, fix round 1

## Finding Verdicts

- **I1: missing endpoints and deletion races can create orphan HTTP relationships — ADDRESSED.** HTTP now calls `create_link_instance(..., require_endpoints=True)` and translates transaction-time `KeyError` to 404 (`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:5279-5281`). PostgreSQL strict mode rejects a missing definition and either missing endpoint (`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:3280-3281`, `pg_repo.py:3295-3296`). Its ordered `FOR SHARE` endpoint read holds row locks through the write transaction (`pg_repo.py:3285-3289`). Deletion obtains `FOR UPDATE` on the individual **before** scanning incident links (`pg_repo.py:4961-4964`), so it cannot miss a relationship inserted by a writer whose endpoint validation already completed.
- **M1: inherited warning noise — DISCLOSED / DEFERRED.** This was not a required fix in this round. The appended report discloses 33 warnings in the expanded covering run and identifies the additional existing FastAPI lifecycle warnings from the included tenant integration suite. The controller has deferred this owning-scope follow-up; the warnings are not represented as resolved.

## Spec Compliance

- ✅ **Compliant for the scoped fix.** Both I1 orderings are corrected without changing DTOs, operation IDs, or the existing authorization decision. The controller-authorized optional keyword is present in the kernel Protocol (`mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/api.py:56`), InMemory (`mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py:759-772`) and PostgreSQL (`pg_repo.py:3264`), preserving existing direct-call defaults while explicitly selecting strict HTTP writes.
- ✅ The new tests exercise real authenticated HTTP calls and independent real PostgreSQL connections: deletion after API reads must produce 404 and no persisted edge (`mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py:498`); deletion after transactional validation must wait, then remove the committed relationship in its cascade (`test_mp11_relationship_writes.py:524`). These tests check persisted results after both operations rather than only whether a method was called.

## New Breakage in the Fix Diff

- **Critical: None found.**
- **Important: None found.**
- **Minor: None newly identified.**
- The new row locks are acquired in RID order, reducing inversion risk between writers. The deletion path locks one individual before its cascade and now explicitly rolls back failures (`pg_repo.py:3287`, `pg_repo.py:4961`, `pg_repo.py:4968-4970`). The fix preserves the existing definition/advisory locking and same-RID write behavior rather than changing their ordering.

## Checks and Evidence

- Reviewed fix range **9d711b06..22d14de7** using the supplied package; read all five changed-file diffs. The initial tool output truncated part of the first new HTTP regression, so only that missing test excerpt was fetched again from the package. No Git commands or unchanged product-code exploration were performed.
- Checked the appended implementation evidence against the fix: two behavioral PostgreSQL HTTP tests first failed; strict InMemory support first failed; the amended task suite reported **31 passed**; the final covering command reported **79 passed, 33 warnings, no skips**. The named covering suites include relationship behavior, cardinality concurrency, server-side filtering, tenant integration and kernel compatibility.
- The directly affected existing deletion/synchronization check is separately named in the report: `test_ont_data_sync_integrity.py -k delete_event_and_full_tombstone`, reported **1 passed, 8 deselected**. Ruff and whitespace checks are reported clean.
- These execution results are implementer-reported, not independently rerun. The code and focused tests address the specific doubts from I1; no uncovered doubt justified another test run. No product/index/HEAD changes, subagents or Goal changes were made.

## Out-of-Scope Observations

- None newly identified. The previously recorded `platform.write` versus `ont.write` metadata boundary, legacy direct-repository default behavior, explicitly non-thread-safe InMemory concurrency boundary, and cross-task/release acceptance remain unchanged and are not expanded by this scoped re-review.

## Verdict

**Fix round: All required findings addressed, no new Critical/Important breakage.**

**Task quality: Approved for Task 1 scope.** I1 is closed; M1 remains disclosed and deferred in the controller's ledger. This approval establishes scoped implementation review, not deployment or formal release acceptance.
