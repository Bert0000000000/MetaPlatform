# FOLLOW-UP-B — MCP management-test isolation acceptance evidence

> Scope status: **Accepted for the focused management-test gate**
> Commits: `05825861` → `8658e34d`

## Result

MCP tool-category CRUD tests use a management-only FastAPI app and local SQLite
SQL-store coverage. The package-global test bootstrap was not broadened, so
the unrelated streamable MCP/Win32 import chain is outside this test path.

## Verification

- `test_tool_categories.py`: 15 passed.
- `test_mcp_sql_store.py`: 14 passed.
- Ruff on the changed test files: passed.

The historical full-package warning volume remains environmental/test-suite
noise and is not represented as a production failure here.
