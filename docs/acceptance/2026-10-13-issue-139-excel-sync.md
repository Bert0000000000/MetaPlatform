# Issue #139: Excel source configuration evidence

2026-10-13. Scope: Tencent demo Excel modeling source configuration and release verification. Status: implementation ready; hosted PostgreSQL/browser CI and deployment pending.

## Local evidence

- Python 3.12.13, frozen mate-platform-backend/uv.lock runtime and locked dev dependencies prepared in this isolated worktree. No frontend sources or dependencies changed.
- Actual Docker Compose configuration regression failed before the fix: ONT_MODELING_SOURCE_DSN was empty while KERNEL_PG_DSN targeted metaplatform_ont. After the explicit environment setting, all 47 demo deployment unittest cases passed. This config parsing is offline and starts no services.
- Modeling core, ingestion, data treatment and publication scope: 150 passed, 0 skipped; .ci/issue139-modeling-unit.xml.
- Ruff check and format, git diff --check passed for the affected Python and diff.
- A new dedicated PostgreSQL 16 container mp139-excel-pg-20261013 was created on 127.0.0.1:55439 with issue/thread ownership labels. Fixed nonprivileged regression database preparation succeeded. Docker then returned API 500 and PostgreSQL accepted TCP but its handshake timed out. The owned pytest process was stopped; the mandatory real database test is NOT_EXERCISED locally and cannot count as passed. Shared Docker was not restarted or cleaned. The created container is preserved.

## Required next evidence

PR exact-head CI must execute the new probe against real PostgreSQL plus all required ontology database/browser gates with zero mandatory skips. Only after those checks may this branch merge to fresh main and enter trusted Tencent CI/CD. The cloud initial-write verifier must create a dedicated synthetic Excel source, publish two reviewed types and one relationship, read back 4 instances and 2 links, retry sync and retain unchanged identities. Receipt readback is part of future read-only validation.

## Business boundary

The automated probe never reads or synchronizes existing enterprise workbooks. Repairing the missing server dependency does not itself establish acceptance of the original issue batch's 224 objects and 76 relationships. That batch remains intact and should be rechecked and synchronized using its previously approved mappings, with conditional facts preserved. #112 is a distinct registered-source configuration issue. No Gate/GA status is changed by this report.
