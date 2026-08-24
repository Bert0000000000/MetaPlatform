# Backend Test Baseline Design

## Context

The repository’s backend test configuration is owned by `mate-platform-backend`, but the root-level pytest invocation resolves its relative `pythonpath` entries from the wrong directory. The backend also has a Python 3.12/uv contract that is not enforced by the current local entrypoint, and the workspace lock is missing the declared `a2a-sdk` dependency. Pytest collection additionally traverses generated cache/temp directories and imports same-named test modules by path, producing permission and module-collision errors before business assertions run.

## Approved Scope

This batch restores the engineering test baseline only:

- Provide one repository-root backend test entrypoint.
- Use the backend’s Python 3.12 and uv environment contract.
- Keep dependency installation frozen during test runs.
- Synchronize the workspace lock with declared dependencies, including `a2a-sdk`.
- Use pytest importlib mode to isolate same-named test modules.
- Exclude pytest cache/temp directories from discovery.
- Add an environment preflight with actionable errors.

This batch does not change business behavior, public APIs, workflows, staging services, LLM providers, sandbox execution, Temporal, or the proposed v6 architecture.

## Design

The root runner lives at `scripts/ci/run_backend_tests.py`. It resolves the repository root from its own location, locates uv from PATH or the standard per-user installation location, runs `uv sync --frozen` in `mate-platform-backend`, verifies the selected interpreter is Python 3.12, and delegates all remaining arguments to `uv run pytest` in the backend directory.

The backend remains the single owner of pytest configuration. Its `pyproject.toml` enables `--import-mode=importlib` and extends `norecursedirs` to match generated pytest cache/temp directories without weakening strict markers or config validation.

The lock file is regenerated with uv after confirming package declarations. No dependency is added solely to hide a failing test; the lock must represent the declared workspace graph.

## Acceptance Criteria

- A root invocation reaches the backend pytest configuration without path-based `ModuleNotFoundError` errors.
- Frozen uv synchronization succeeds from a clean environment represented by the committed lock.
- `a2a-sdk` is present in the lock because the A2A package declares it.
- Same-basename tests do not produce import-file-mismatch collection errors.
- Generated pytest cache/temp directories do not produce collection permission errors.
- Remaining failures are genuine test or package failures that can be fixed in subsequent batches.
- Existing CI architecture-test commands remain usable.
