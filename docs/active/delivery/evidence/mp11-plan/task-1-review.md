# Task 1 review — b49426d5..9d711b06

## Spec Compliance

- ❌ Issues found: endpoint existence is checked before the repository transaction, but the new transactional revalidation explicitly permits missing endpoints. A concurrent endpoint deletion between those stages allows an HTTP write to persist an orphan relationship. This leaves the required existing-endpoint/persistence boundary incomplete (I1 below).
- ✅ Remaining reviewed requirements are implemented: tenant checks and authenticated `platform.write` scope on both writes; readable enum/type failures; 404 for ordinary missing resources; 409 for cardinality and used-definition structural changes; editable labels/description; PostgreSQL description persistence; unchanged DTOs and operation IDs. Evidence: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:4555`, `api.py:5231`, `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:2833`, `pg_repo.py:2864`, and response additions in `mate-platform-backend/contracts/openapi/services/ont.yaml:761` and `ont.yaml:1090`.
- ✅ The brief's `mate-kernel/tests/test_ontology_api.py` entry is a test target, not a mandated modification; the implementation report includes it in the final 69-pass run (`task-1-report.md:58`). Its absence from the diff is not a missing deliverable.
- ⚠️ Cannot verify from this task diff: resource-specific `ont.write` authorization across the product. The report explicitly records the controller's decision to enforce existing `platform.write` and defer permission-range review to Task 7 (`task-1-report.md:21`, `task-1-report.md:85`). This review accepts that task boundary; it does not establish that `x-mate-permission: ont.write` metadata is enforced.
- ⚠️ Cannot verify from this task diff: full business-chain/UI acceptance, deployment, formal Gate/release acceptance, or equivalence of all Action/edit-set entry points. These remain cross-task checks, not grounds to expand this review.

## Strengths

- Definition updates take an exclusive transaction advisory lock before reading existing structure and checking for instances; instance creation takes the matching shared lock before its endpoint locks. This covers both definition/instance transaction orders while allowing unrelated endpoints to write concurrently (`pg_repo.py:2833`, `pg_repo.py:3335`, `pg_repo.py:3351`). The new two-connection tests exercise both orderings using real PostgreSQL operations.
- The update persists `description` in `ON CONFLICT`, and failed definition updates explicitly roll back (`pg_repo.py:2864`, `pg_repo.py:2883`). The new persistence regression reads through a new repository instance rather than checking only the returned object.
- API tests use the real router and installed authentication, assert externally visible status codes, and check rejected writes leave repository state unchanged. They cover structural updates both with and without instances, permitted descriptive updates, and same-RID replay (`mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py:1`).
- Existing upsert behavior remains: `ON CONFLICT (rid)` updates the link definition reference/endpoints/properties, and cardinality excludes that RID before writing (`pg_repo.py:3295`, `pg_repo.py:3308`). The API-side validation now applies to the requested endpoints before both new writes and replays.

## Issues

### Critical (Must Fix)

- None found in this task scope.

### Important (Should Fix)

**I1 — Missing endpoints still pass the new transaction-level validation.**

- Location: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:3280-3293`, especially the `actual is not None` condition at line 3290; HTTP caller: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:5255`.
- Trigger: request A successfully reads an existing source/destination through the API; request B deletes that individual and commits before A enters `create_link_instance`; A then reads the definition, receives no row for the deleted endpoint, skips the class check because `actual is None`, and inserts the relationship. A returns success with a nonexistent endpoint instead of the required missing-resource failure.
- Evidence: the schema declares `src` and `dst` as plain `TEXT NOT NULL` without endpoint foreign keys (`pg_repo.py:302-312`). `delete_individual` deletes currently existing links first and then the individual, without taking the new locks (`pg_repo.py:4945-4956`). The new existence read is also an unlocked `SELECT`, so deletion after that read is not prevented either. The new shared definition lock protects the definition from `upsert_link_type`, not the lifetime of its individual endpoints.
- Impact: the report's assertion that HTTP writes do not inherit legacy leniency (`task-1-report.md:86`) is false for this interleaving. A successful HTTP write can silently produce an orphan relationship, defeating Task 1's existence/persistence guarantee.
- Fix: preserve any required lenient direct-repository compatibility through an explicit mode/path, while making the HTTP write's transactional path require both endpoints. Coordinate that strict path with endpoint deletion so the existence check and insertion cannot straddle a committed delete (for example, a shared endpoint-lock protocol acquired before deletion's cascade scan, or suitable database constraints). Translate a missing endpoint to the documented 404. Do not fix only `actual is None`: an unlocked check leaves the post-check deletion window open.
- Focused regression to add: use the existing isolated PostgreSQL fixture to pause a real HTTP write after API endpoint reads, delete the endpoint, and resume; assert rejection and no persisted relationship. Also cover deletion starting after transactional endpoint validation to demonstrate that the agreed coordination prevents an orphan. Existing tests exercise definition updates, not deletion, so their reported success does not answer this doubt. No suites were rerun for this review.

### Minor (Nice to Have)

**M1 — Reported successful test output contains 26 inherited warnings.**

- Location: `.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-1-report.md:58` and `task-1-report.md:84`.
- Trigger: the reported final pytest command emits one Starlette/TestClient/httpx deprecation warning and 25 short JWT test-key warnings.
- Impact: validation passes, but output is not pristine and recurring warning noise can obscure a newly introduced warning. The report correctly discloses their inherited origin; this is not a Task 1 functional regression.
- Follow-up: update the shared test signing key and supported dependency combination in their owning scope. Do not suppress the warnings merely to make this task appear clean.

## Focused checks and evidence boundaries

- Read the supplied review package once, including all four changed-file diffs. No Git commands, product edits, index/HEAD mutations, or suite reruns were performed.
- Named risk: the new lock helper could affect lock order in existing callers. A focused reference search showed the direct create path and Action/edit-set path both acquire definition-shared then endpoint-exclusive locks (`pg_repo.py:3273`, `pg_repo.py:6701`); no reversed acquisition was identified in that check. The Action/edit-set path still has its own validation flow, so this does not assert cross-task semantic equivalence.
- Named risk: transactional revalidation might allow a deleted endpoint to survive. The focused check inspected the existing deletion sequence and relationship table constraints (`pg_repo.py:4945-4956`, `pg_repo.py:302-312`), supporting I1.
- Named risk: connection behavior could nullify transaction locks. A focused check confirmed `autocommit = False` and dictionary cursors (`pg_repo.py:1323-1324`, `pg_repo.py:1429-1433`). Success commits and failure rolls back in the reviewed diff. No separate claim is made about nondefault deployment isolation settings.
- The `create_link_instance` hunk was cut off between the cardinality check and SQL/return. Only the missing INSERT/ON CONFLICT segment (`pg_repo.py:3301-3328`) was read separately to judge same-RID compatibility; no complete changed file was reread.
- Validation considered: report's behavioral RED, description RED, both concurrency REDs, final **69 passed / 26 warnings / no skips**, Ruff and diff checks. These are implementer-reported execution results, assessed against the code; they were not independently rerun.

## Assessment

**Task quality: Needs fixes.**

The requested ordinary API validation, description persistence and definition-update lock protocol are well targeted and have substantial behavior-level coverage. I1 must be resolved before trusting the endpoint existence guarantee under concurrent writes; the inherited warnings and deferred cross-task checks are separate from that blocker.
