# Issue #139: Excel source configuration evidence

2026-10-13. Scope: Tencent demo Excel modeling source configuration and release verification. Status: implementation ready; hosted PostgreSQL/browser CI and deployment pending.

## Local evidence

- Python 3.12.13, frozen mate-platform-backend/uv.lock runtime and locked dev dependencies prepared in this isolated worktree. Front-end navigation fix 1ff90c5e was subsequently integrated with its original authorship; local frontend dependencies are not prepared in this worktree, and exact-head CI must execute its full validation.
- Actual Docker Compose configuration regression failed before the fix: ONT_MODELING_SOURCE_DSN was empty while KERNEL_PG_DSN targeted metaplatform_ont. After the explicit environment setting, all 47 demo deployment unittest cases passed. This config parsing is offline and starts no services.
- Modeling core, ingestion, data treatment and publication scope: 162 passed, 0 skipped after incorporating main 51e0ab36; .ci/issue139-modeling-unit-refreshed.xml.
- Ruff check and format, git diff --check passed for the affected Python and diff.
- A new dedicated PostgreSQL 16 container mp139-excel-pg-20261013 was created on 127.0.0.1:55439 with issue/thread ownership labels. Fixed nonprivileged regression database preparation succeeded. Docker then returned API 500 and PostgreSQL accepted TCP but its handshake timed out. The owned pytest process was stopped; the mandatory real database test is NOT_EXERCISED locally and cannot count as passed. Shared Docker was not restarted or cleaned. The created container is preserved.

## Integration and review evidence

- Latest main 51e0ab36 was merged cleanly, preserving the complete ontology branch history. The initial PR head cb0d6f6b CI executed 126 required PostgreSQL tests with 0 skipped, plus 55 modeling publication/sync tests including the real endpoint probe. These receipts are initial-head evidence, not a substitute for final-head checks.
- Independent review validated production workbook parsing, model and data validation, 4 compiled nodes and 2 edges, native readback/identity comparisons, old receipt compatibility and automatic rollback receipt selection. Explicit new decisions were added for both synthetic classes, with consecutive fresh-release regression coverage. Final review found no remaining actionable issue.
- The cc3f7d1 browser job failed first in catalog-consumers.test.tsx: prior source navigation replaced a newly selected type. Later ECONNREFUSED results followed the unstarted stack. The already authored fix 1ff90c5e was reviewed and cherry-picked with provenance; no concurrent worktree was changed. Exact-head browser CI must re-run with this correction.
- Architecture kernel governance has preexisting typing failures registered in its workflow as continue-on-error. Its workflow conclusion remains success; required Ruff, strict Python type checks, architecture tests and GA checks remain enforced. No new gate exception was introduced.
- Historical local cloud credentials returned HTTP 401 on the optional original-batch readiness check. No enterprise sync was executed; trusted deployment acceptance uses current credentials stored on the server.

## Required next evidence

PR exact-head CI must execute the new probe against real PostgreSQL plus all required ontology database/browser gates with zero mandatory skips. Only after those checks may this branch merge to fresh main and enter trusted Tencent CI/CD. The cloud initial-write verifier must create a dedicated synthetic Excel source, publish two reviewed types and one relationship, read back 4 instances and 2 links, retry sync and retain unchanged identities. Receipt readback is part of future read-only validation.

## Business boundary

The automated probe never reads or synchronizes existing enterprise workbooks. Repairing the missing server dependency does not itself establish acceptance of the original issue batch's 224 objects and 76 relationships. That batch remains intact and should be rechecked and synchronized using its previously approved mappings, with conditional facts preserved. #112 is a distinct registered-source configuration issue. No Gate/GA status is changed by this report.
