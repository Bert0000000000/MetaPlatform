# ARCH-CORE-01 源代码清理证据

> **For agentic workers:** This document records the cleanup of duplicate deployment
> source trees performed under ARCH-CORE-01 Task 6. It is part of the acceptance
> audit for the architecture kernel program.

## 1. Scope

ARCH-CORE-01 deletes the root-level deployment source trees that duplicated the
monorepo copy of the same services. The canonical deployment source now lives
exclusively under `mate-platform-backend/services/<name>/`. The deployment image
builds reference those paths.

## 2. Diff with monorepo copy

Before deletion we verified each pair was effectively identical using:

```bash
git diff --no-index --stat services/api-gateway mate-platform-backend/services/api-gateway
git diff --no-index --stat services/auth-service mate-platform-backend/services/auth-service
```

Both pairs differed only by line endings (CRLF vs LF) and minor cosmetic metadata
produced by independent scaffolding runs. No business code diverged.

## 3. Deleted trees

| Path | Reason |
|---|---|
| `services/api-gateway/` | Duplicate of `mate-platform-backend/services/api-gateway/` |
| `services/auth-service/` | Duplicate of `mate-platform-backend/services/auth-service/` |

Removed with `git rm -r services/api-gateway services/auth-service`.

## 4. Image and deployment mapping

The Docker images referenced by the deployment manifests (compose and CI workflows)
build directly from `mate-platform-backend/services/<name>/Dockerfile`. Removing the
root copies has no impact on container builds because nothing references the root
tree.

## 5. Guardrail

`tests/architecture/test_no_duplicate_source.py` scans `services/<name>/src/<name>/main.py`
at the repo root and fails the architecture tests if a duplicate reappears. The
guardrail is wired into the architecture tests suite and the future
`architecture-ci.yml` workflow.

## 6. `.gitignore`

`mate-platform-backend/.gitignore` now contains `/services/` so any future stray
tree inside the backend is ignored (the canonical services live under the
workspace `packages`/`services` members declared in `pyproject.toml`).

## 7. Plan conformance

- Source-cleanup task in `docs/superpowers/plans/2026-07-30-arch-core-01.md` is
  complete.
- Step 3 of the plan required diff verification; we ran it for both pairs.
- Step 7 requires the architecture tests to pass after deletion.
- No business code was modified during this cleanup.
