# ARCH-CORE-01 架构内核与模块边界治理｜验收证据

> **For agentic workers:** This document records the acceptance evidence for the
> ARCH-CORE-01 architecture kernel and module boundary governance program. It is
> the canonical reference for downstream batches (PLATFORM-K8S-01, SEC-IAM-01,
> ...) that build on the new kernel.

## 1. Scope

ARCH-CORE-01 establishes the unique architecture foundation by introducing three
kernel packages, enforcing a four-layer module boundary, banning fake adapter
production assembly, and removing the duplicate deployment source trees. It does
not touch business logic; the existing `mate-tech-*` and `mate-app-*` packages
keep their current structure. The only business-related adjustment is the
deprecation of `mate-common` as the canonical kernel source - downstream packages
will migrate to `mate-kernel` in subsequent batches.

## 2. Deliverables

| Item | Path | Status |
|---|---|---|
| `mate-kernel` (pure-domain types) | `mate-platform-backend/packages/mate-kernel` | shipped |
| `mate-platform` (cross-cutting platform) | `mate-platform-backend/packages/mate-platform` | shipped |
| `mate-clients` (anti-corruption layer) | `mate-platform-backend/packages/mate-clients` | shipped |
| Four-layer module template | `mate-platform-backend/scripts/arch_template.py` | shipped |
| Architecture tests | `mate-platform-backend/tests/architecture` | shipped |
| `import-linter` contracts | `mate-platform-backend/tests/architecture/import-linter.ini` | shipped |
| Source-cleanup guardrail | `mate-platform-backend/tests/architecture/test_no_duplicate_source.py` | shipped |
| Quality gate script | `mate-platform-backend/scripts/quality_check.sh` | shipped |
| Architecture CI workflow | `.github/workflows/architecture-ci.yml` | shipped |
| python-ci architecture job | `.github/workflows/python-ci.yml` | shipped |
| Source-cleanup evidence | `docs/active/delivery/evidence/arch-core-01-source-cleanup.md` | shipped |
| Program Board update | `docs/active/delivery/PROGRAM-BOARD.md` | shipped |

## 3. Test results

All 13 mandatory quality gates passed on `codex/arch-core-01` worktree.

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | Architecture tests | `uv run pytest tests/architecture -q` | 6 passed |
| 2 | Import-linter contracts | `uv run python scripts/architecture_check.py` | exit 0 |
| 3 | Ruff (kernel + tests) | `uv run ruff check packages/mate-kernel packages/mate-platform packages/mate-clients tests/architecture scripts/architecture_check.py scripts/tests scripts/arch_template.py` | All checks passed |
| 4 | Pyright (kernel + tests) | `uv run pyright packages/mate-kernel packages/mate-platform packages/mate-clients tests/architecture scripts/architecture_check.py scripts/arch_template.py` | 0 errors |
| 5 | Kernel package tests | `uv run pytest packages/mate-kernel -q` | 4 passed |
| 6 | Platform package tests | `uv run pytest packages/mate-platform -q` | 2 passed |
| 7 | Clients package tests | `uv run pytest packages/mate-clients -q` | 2 passed |
| 8 | arch_template test | `uv run python -m pytest scripts/tests/test_arch_template.py -q` | 1 passed |
| 9 | Source-cleanup guard | `uv run pytest tests/architecture/test_no_duplicate_source.py -v` | PASSED |
| 10 | Root `services/api-gateway` absent | `Test-Path ../services/api-gateway` | OK: absent |
| 11 | Root `services/auth-service` absent | `Test-Path ../services/auth-service` | OK: absent |
| 12 | `scripts/quality_check.sh` present and well-formed | `tests/architecture/test_quality_script_exists.py` | PASSED |
| 13 | `python-ci.yml` architecture-tests job with `continue-on-error: false` | manual inspection | OK |

## 4. CI validation

Two GitHub Actions workflows enforce the governance continuously:

- `.github/workflows/architecture-ci.yml` runs the full quality gate on every
  push or pull request that touches `mate-platform-backend/**` or the workflow
  file itself. It installs `uv`, syncs the workspace, installs
  `import-linter`, runs ruff/pyright scoped to the kernel packages and the
  architecture tests, runs `pytest tests/architecture -q`, and finally runs
  `scripts/architecture_check.py` to verify all import-linter contracts.
- `.github/workflows/python-ci.yml` now has a dedicated `architecture-tests`
  job that executes the same gates inside the Python Backend CI pipeline.
  `continue-on-error` is `false` so any regression fails the build.

## 5. Source cleanup

The root-level `services/api-gateway/` and `services/auth-service/` trees
were deleted; their canonical source now lives under
`mate-platform-backend/services/<name>/`. The cleanup is documented in
`docs/active/delivery/evidence/arch-core-01-source-cleanup.md` and guarded by
`tests/architecture/test_no_duplicate_source.py`. `mate-platform-backend/.gitignore`
now contains `/services/` so any future stray tree is ignored.

## 6. Source/build mapping

- **Kernel packages**: `packages/mate-{kernel,platform,clients}` source trees
  are listed in `tool.uv.workspace.members` so the production build resolves
  them as editable workspace members. Each package depends on the lower
  layer (`mate-clients` depends on `mate-kernel` and `mate-platform`;
  `mate-platform` depends on `mate-kernel`) via `[tool.uv.sources]` workspace
  entries.
- **Image builds**: The deployment Dockerfiles under
  `mate-platform-backend/services/<name>/Dockerfile` continue to reference
  the canonical sources. No production image build references the deleted
  root trees.
- **Pyright / Ruff**: Both tools know about the kernel packages via
  `pyrightconfig.json` extraPaths and `ruff.toml` `known-first-party`.

## 7. Approved plan corrections

While implementing Task 5 we discovered two corrections needed against the
draft plan:

1. `import-linter` 2.13 requires every contract to declare a `name` field
    and the root section to declare `root_package` and
    `include_external_packages = True`. The plan's `source =` / `forbidden`
    fields were renamed to `source_modules` / `forbidden_modules` and the
    root section was added. No business logic change.
2. The plan assumed `lint-imports` would honor `PYTHONPATH`. The uv
    trampoline (`lint-imports.exe`) clears `PYTHONPATH`, so
    `scripts/architecture_check.py` now shells out via
    `python -m importlinter.cli lint_imports` with an explicit
    `PYTHONPATH` env entry for the kernel source trees. Behaviour on Linux
    CI runners is identical.

## 8. Risks and follow-up

- `mate-common` still exposes domain types that overlap with `mate-kernel`.
  Downstream batches (TECH-SERVICES, BUSINESS-SLICES) should migrate to
  `mate-kernel` and then delete the duplicate types.
- The `mate-clients` package ships only stub ACL clients. Real
  implementations land in subsequent batches; the `assert_fake_allowed`
  policy is in place so that no production profile can accidentally wire a
  fake adapter.
- `pyright` and `ruff` are currently scoped to the kernel packages,
  architecture tests, and the `scripts/` directory. Extending coverage to
  every business package is a follow-up tracked under TECH-SERVICES.

## 9. Conclusion

ARCH-CORE-01 establishes the unique architecture foundation that subsequent
Mate Platform batches depend on. All 13 mandatory quality gates pass in the
worktree and the governance is wired into CI. ARCH-CORE-01 is therefore
marked **Accepted** on the Program Board.
