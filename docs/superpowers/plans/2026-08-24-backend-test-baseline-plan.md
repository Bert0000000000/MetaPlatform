# Backend Test Baseline Implementation Plan

> For agentic workers: use the `executing-plans` or `subagent-driven-development` skill to execute this plan task by task.

**Goal:** Make the backend test suite reproducible from the repository root and restore collection to the point where genuine test failures, rather than path, dependency, cache, or interpreter errors, are visible.

**Architecture:** Keep the backend as the owner of its Python/pytest configuration. Add a thin repository-root runner that enters `mate-platform-backend`, performs a frozen environment sync, verifies the selected interpreter, and delegates to pytest. Use pytest importlib mode to avoid same-basename module collisions; exclude transient pytest cache/temp directories by pattern. Do not change business APIs, workflows, or runtime behavior.

**Tech Stack:** Python 3.12, uv workspace, pytest, TOML configuration, repository-root Python runner.

**Spec:** `docs/superpowers/specs/2026-08-24-backend-test-baseline-design.md`

## Global Constraints

- Work only on the approved test/dependency baseline scope.
- Preserve existing user changes and the untracked `PROXY` artifact; do not delete or stage it.
- Do not use an unfrozen dependency update in the test runner.
- Do not mask business-test failures with broad skips or relaxed pytest settings.
- Keep the existing CI architecture-test commands compatible.

## Task 1: Add a tested repository-root backend test runner

**Files:**
- Create `scripts/ci/run_backend_tests.py`
- Create `scripts/ci/test_run_backend_tests.py`

**Steps:**

- [x] Write unit tests for command construction: backend working directory, frozen `uv sync --all-packages`, interpreter preflight, pytest delegation, argument forwarding, and non-zero exit propagation.
- [x] Run the focused runner tests and verify they fail because the runner module does not exist.
- [x] Implement the smallest runner that resolves the repository root from its own location, checks that uv is available, runs `uv sync --frozen --all-packages` in the backend, verifies the runtime is Python 3.12.x through `uv run`, then runs `uv run pytest` with forwarded arguments.
- [x] Run the focused runner tests and verify they pass.
- [x] Run the runner from the repository root with `--help` and a collection-only command to validate its user-facing behavior.

## Task 2: Correct backend pytest discovery and module isolation

**Files:**
- Modify `mate-platform-backend/pyproject.toml`

**Steps:**

- [x] Add pytest importlib mode to the backend configuration so identically named tests from separate packages do not collide in `sys.modules`.
- [x] Change cache/temp exclusion patterns to cover pytest-generated names such as `.pytest_cache.tmp-*` and `.pytest-tmp*`, while retaining existing source/build/environment exclusions.
- [x] Preserve strict markers/config and the existing backend package test paths.
- [x] Run backend collection through the root runner and verify cache permission errors and duplicate-module import mismatch errors are gone.

## Task 3: Synchronize declared dependencies and lock data

**Files:**
- Modify `mate-platform-backend/uv.lock` through the repository’s uv lock workflow.
- Inspect `mate-platform-backend/packages/mate-app-a2a/pyproject.toml` and related package declarations; modify only if the lock workflow exposes a declaration inconsistency.

**Steps:**

- [x] Confirm the workspace dependency graph includes the declared `a2a-sdk` package and the Windows MCP runtime dependencies required by the existing tests.
- [x] Regenerate the lock data using the project’s uv workflow, without changing unrelated version constraints.
- [x] Run `uv sync --frozen --all-packages` from the runner and verify it succeeds with the committed lock.
- [x] Re-run collection and identify remaining failures as genuine test or package issues rather than missing lock entries.

## Task 4: Verify the baseline and hand off

**Files:**
- No additional files unless verification finds a directly related defect.

**Steps:**

- [x] Run focused tests for the new runner.
- [x] Run backend collection and the smallest relevant core test slices.
- [x] Run the existing architecture/CI checks that do not require external staging services.
- [x] Review the diff for scope creep, accidental cache files, and the untracked `PROXY` artifact.
- [x] Record verification results and commit only the approved changes to `main`.

## Self-Review Checklist

- Every approved design point maps to a concrete file and verification step.
- No task relies on a vague placeholder or an unspecified “appropriate” implementation.
- The runner uses the backend’s canonical environment instead of duplicating dependency configuration.
- Collection failures after the change remain actionable and are not hidden by configuration.
