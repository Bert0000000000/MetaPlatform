# Task 2 Report — FOLLOW-UP-B MCP management-test isolation

## Scope

- Worktree: `D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.worktrees/ga-v1-followups`
- Baseline HEAD verified at start: `0f15c3760532cb0300c07a19d7ec83a275e58cf1`
- Production files intentionally untouched: `mate_tech_mcp/main.py`, dependency locks, OpenAPI, other FOLLOW-UP files, NetworkPolicy, protected files

## Root Cause

The executable root cause for FOLLOW-UP-B was not PostgreSQL. The failing management CRUD test imported `mate_tech_mcp.main.app`, and that full app import mounted the streamable MCP protocol surface:

`mate_tech_mcp.main -> mate_tech_mcp.protocol.streamable -> mcp.server.fastmcp -> mcp.os.win32.utilities -> pywintypes`

On the supported local environment, `pywintypes` was unavailable, so pytest failed during collection before any management CRUD route or repository code executed.

Why PostgreSQL was not the root cause:

- `test_tool_categories.py` exercises `/api/v1/mcp/tool-categories` against `management_repo.py`, which is an in-memory tenant-scoped store.
- The RED stack never reached any SQL store code.
- The separate SQL-store verification target is `test_mcp_sql_store.py`, which uses SQLite in memory and does not require PostgreSQL.

## TDD Record

### RED

Command:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-tech-mcp/tests/test_tool_categories.py -o addopts=''
```

Observed failure:

```text
ERROR collecting tests/test_tool_categories.py
...
from mate_tech_mcp.main import app
...
from .protocol.streamable import build_streamable_http_app
...
import pywintypes
E   ModuleNotFoundError: No module named 'pywintypes'
```

### GREEN

Commands:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-tech-mcp/tests/test_tool_categories.py -o addopts=''
pytest -q mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_sql_store.py -o addopts=''
git diff --check
ruff check mate-platform-backend/packages/mate-tech-mcp/tests/test_tool_categories.py mate-platform-backend/packages/mate-tech-mcp/tests/conftest.py
```

Observed results:

```text
15 passed, 494 warnings in 0.91s
14 passed in 0.35s
git diff --check: no whitespace errors (Git emitted an LF->CRLF warning only)
ruff: All checks passed!
```

## Changes

### 1. Management-only test app

File changed:

- `mate-platform-backend/packages/mate-tech-mcp/tests/test_tool_categories.py`

Change:

- Removed `from mate_tech_mcp.main import app`
- Built a minimal `FastAPI()` test app inside the test fixture
- Installed the existing `install_auth(app)` middleware contract
- Included only `mate_tech_mcp.api.management_routes.router`

Effect:

- The management CRUD tests now exercise the real HTTP routes they care about without importing or mounting the unrelated streamable MCP protocol app.

### 2. MCP test-scope fixture path completion

File changed:

- `mate-platform-backend/packages/mate-tech-mcp/tests/conftest.py`

Change:

- Added `mate-tech-db` to the MCP test package's in-tree `sys.path` bootstrap list

Effect:

- The required verification target `test_mcp_sql_store.py` can import `mate_tech_db` and run its SQLite in-memory coverage in this worktree.

## Changed Files

- `D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.worktrees/ga-v1-followups/mate-platform-backend/packages/mate-tech-mcp/tests/test_tool_categories.py`
- `D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.worktrees/ga-v1-followups/mate-platform-backend/packages/mate-tech-mcp/tests/conftest.py`

## Concerns

- `test_tool_categories.py` still emits existing FastAPI/PyJWT warnings under Python 3.14 (`asyncio.iscoroutinefunction` deprecation and short HMAC test-key warning). They did not block this task and were not widened by the fix.
- `git diff --check` returned no whitespace errors, but Git printed an informational line-ending warning for `test_tool_categories.py` (`LF will be replaced by CRLF the next time Git touches it`).

## Commit Hash

- Implementation commit: `05825861a4243f6d8af0d6317c9b0d877f34b154`

---

## Fix Round 1 — scope narrowing for SQLite SQL-store bootstrap

Reviewer finding addressed:

- The previous fix widened package-global MCP test bootstrap by adding `mate-tech-db` to shared `tests/conftest.py`.
- This round removes that shared-path expansion and keeps the extra import-path setup local to `test_mcp_sql_store.py`.

### Root cause for this round

`test_mcp_sql_store.py` depends on `mate_tech_db`, but that dependency only exists to support the SQLite verification target. Putting `mate-tech-db/src` into the package-level `conftest.py` altered the import environment for every MCP test module, which was broader than the task allowed.

### RED

After removing the shared `mate-tech-db` path entries from `tests/conftest.py`, I re-ran the focused checks before adding any local replacement:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q packages/mate-tech-mcp/tests/test_mcp_sql_store.py -o addopts=''
pytest -q packages/mate-tech-mcp/tests/test_tool_categories.py -o addopts=''
```

Observed output:

```text
=================================== ERRORS ====================================
________________ ERROR collecting tests/test_mcp_sql_store.py _________________
...
from mate_tech_db.base import create_all, init_engine, reset_engine
E   ModuleNotFoundError: No module named 'mate_tech_db'
...
1 error in 0.17s

15 passed, 494 warnings in 0.85s
```

This confirmed the scope issue precisely:

- `test_tool_categories.py` stayed green without the shared `mate-tech-db` path
- only the SQLite verification target needed the extra path setup

### Fix

Files changed in this round:

- `mate-platform-backend/packages/mate-tech-mcp/tests/conftest.py`
- `mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_sql_store.py`

Changes:

- removed `mate-tech-db` from all shared MCP test bootstrap loops in `tests/conftest.py`
- added a file-local `sys.path` insertion in `test_mcp_sql_store.py` that prepends `packages/mate-tech-db/src` before importing `mate_tech_db`
- kept the management CRUD test assembly unchanged

### GREEN

Verification commands:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q packages/mate-tech-mcp/tests/test_tool_categories.py -o addopts=''
pytest -q packages/mate-tech-mcp/tests/test_mcp_sql_store.py -o addopts=''
git diff --check
ruff check D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.worktrees/ga-v1-followups/mate-platform-backend/packages/mate-tech-mcp/tests/conftest.py D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.worktrees/ga-v1-followups/mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_sql_store.py D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.worktrees/ga-v1-followups/mate-platform-backend/packages/mate-tech-mcp/tests/test_tool_categories.py
```

Observed output:

```text
15 passed, 494 warnings in 0.91s
14 passed in 0.35s
git diff --check: no whitespace errors (Git emitted an LF->CRLF warning for test_mcp_sql_store.py only)
ruff: All checks passed!
```

### Commit hash

- Code fix commit: `8658e34df3a2484932b5da85f9193e1d3702945e`
