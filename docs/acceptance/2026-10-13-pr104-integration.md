# PR #104 integration evidence

## Scope

Merge the six remote commits after PR #98 into `main` through PR #104.
PR head before the infrastructure fix: `82563d169647e615b7147fae5c0b6ebb699310f7`.
The existing local Compose override and generated artifacts are excluded.

## CI diagnosis

- PR run `38285417325`, job `114932486723`: the gateway image build fails
  because its fixed Tsinghua PyPI index returns no FastAPI distributions.
  The stack never starts; migration, Builder and modeling browser cases then
  fail with `ECONNREFUSED` on port 8100. These are failures, not passes.
- Use official PyPI by default and allow an explicit build argument for
  deployments requiring a different package index.
- Architecture workflow job `114932486016` reports 296 Pyright errors.
  `.github/workflows/architecture-ci.yml` already records this as baseline
  debt and declares `continue-on-error: true`; this change does not alter it.

## Validation status

- Local official-index probe: all ten direct gateway dependencies downloaded
  successfully with `pip download --no-deps --index-url https://pypi.org/simple/`
  to a task-specific temporary directory. This does not prove a Docker build.
- Local Docker daemon is unavailable; full stack execution must use CI.
- Refetch after the user's update: PR #104 remains at `82563d16`, `main` remains
  at `303d3ca6`; PR #103 separately points to `8312e625` (scope clarification
  pending, not included in PR #104).
- Current PR PostgreSQL regressions and nonprivileged RLS checks: CI success.
- Current PR frontend check, GA checks and backend tests: CI success.
- Browser acceptance after the infrastructure fix: pending an actual CI run.
- Local database/browser acceptance, deployment and business acceptance:
  not executed in this task; not claimed as passing.

Related sources: ADR-0080, ADR-0082, `HARD-RULES-MATRIX.md`.
