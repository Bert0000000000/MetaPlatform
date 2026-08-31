# Task 4 Report

Date: 2026-08-27

Implementation commit: `92f02603`

Scope:
- `mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py`
- `mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py`
- `mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py`

Actual protected routes:
- `GET /api/v1/llmgw/quota/{tenant_id}`
- `GET /api/v1/llmgw/usage/{tenant_id}`
- `DELETE /api/v1/llmgw/cache/{tenant_id}`

Tenant guard behavior:
- Each protected management route now reads `request.state.ctx`.
- The route requires a non-anonymous tenant via `require_tenant(ctx)`.
- The path `tenant_id` must match the verified request tenant via `assert_same_tenant(...)`.
- Cross-tenant access returns `403 {"detail":"tenant access denied"}` before `quota.status(...)`, `usage.summary(...)`, or `cache.clear_tenant(...)` are invoked.
- Same-tenant access preserves the existing success path and existing return payloads.
- Deprecated `/api/v1/llm/*` path-only tests were not changed.

RED phase:
- Added real HTTP route tests for same-tenant and cross-tenant management access in `test_llmgw_business.py`.
- Replaced the placeholder inequality-only adversarial assertion in `test_llm_adv_llmgw.py` with a real `GET /api/v1/llmgw/quota/tenant-b` HTTP test.
- First focused RED run:

```text
pytest -q .../test_llmgw_business.py -k 'management_routes_reject_cross_tenant_before_lookup or management_routes_allow_same_tenant_lookup or cache_clear_endpoint or quota_status_endpoint or usage_endpoint'
3 failed, 8 passed, 6 deselected

FAILED ...test_management_routes_reject_cross_tenant_before_lookup[get-/api/v1/llmgw/quota/acme]
FAILED ...test_management_routes_reject_cross_tenant_before_lookup[get-/api/v1/llmgw/usage/acme]
FAILED ...test_management_routes_reject_cross_tenant_before_lookup[delete-/api/v1/llmgw/cache/acme]

Observed failure: all three cross-tenant requests returned 200, proving the route handlers still trusted the path tenant before the guard existed.
```

GREEN phase:
- Added `_require_same_tenant_management_access(request, tenant_id)` in `api/routes.py`.
- Wired the helper into:
  - `cache_clear_endpoint`
  - `quota_status_endpoint`
  - `usage_endpoint`
- Re-ran focused route tests after the implementation:

```text
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q .../test_llmgw_business.py -o addopts='' -k 'management_routes_reject_cross_tenant_before_lookup or management_routes_allow_same_tenant_lookup or cache_clear_endpoint or quota_status_endpoint or usage_endpoint'
11 passed, 6 deselected, 159 warnings in 1.10s

pytest -q .../test_llm_adv_llmgw.py -o addopts='' -k 'test_case2_cross_tenant_quota_lookup_blocked'
1 passed, 6 deselected, 29 warnings in 0.79s
```

Required verification:

Note: with `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`, these suites required explicitly loading `pytest_asyncio.plugin` in this environment to execute async tests. Using `-p pytest_asyncio` did not register the marker here; `-p pytest_asyncio.plugin` did.

```text
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py -o addopts=''
7 passed, 46 warnings in 1.02s

pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_real_providers.py -o addopts=''
10 passed, 55 warnings in 4.55s

pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_production_guards.py -o addopts=''
17 passed, 81 warnings in 1.04s

pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py -o addopts='' -k 'management_routes_reject_cross_tenant_before_lookup or management_routes_allow_same_tenant_lookup or cache_clear_endpoint or quota_status_endpoint or usage_endpoint'
11 passed, 6 deselected, 159 warnings in 1.10s
```

Ruff:

```text
ruff check mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py
FAILED with 86 findings.

Current failures are pre-existing `RUF001`/`RUF002`/`RUF003`/`RUF100` issues in the touched legacy files, mostly fullwidth punctuation in existing comments/docstrings plus existing unused `noqa` markers in `routes.py`.

ruff check --select I,F ...
All checks passed.
```

Git diff check:

```text
git diff --check
exit 0
stdout/stderr only contained line-ending warnings:
- LF will be replaced by CRLF the next time Git touches the three changed files
```

Changed files:
- `mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py`
- `mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py`
- `mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py`

Concerns:
- The required `ruff check` command still fails on pre-existing legacy-file punctuation/noqa issues outside Task 4’s auth change.
- The mandated pytest commands needed `-p pytest_asyncio.plugin` in this environment when plugin autoload was disabled.

---

Fix round 1 date: 2026-08-27

Fix round 1 root cause:
- `_require_same_tenant_management_access(...)` delegated to shared `assert_same_tenant(...)`.
- `assert_same_tenant(...)` intentionally allows callers with `cross_tenant_admin`.
- Task 4 is stricter than the shared helper: these three management routes must deny cross-tenant access even for `cross_tenant_admin` unless a route-specific entitlement exists, and none exists here.

Fix round 1 RED phase:
- Added a real HTTP regression test in `test_llmgw_business.py` that injects `RequestContext(..., roles={"cross_tenant_admin"})` and calls:
  - `GET /api/v1/llmgw/quota/acme`
  - `GET /api/v1/llmgw/usage/acme`
  - `DELETE /api/v1/llmgw/cache/acme`
- Added `test_main_app_installs_auth_middleware()` in `test_llmgw_business.py` to confirm the real production app still includes `AuthMiddleware`, which is the auth-wiring boundary above these route tests.
- RED verification:

```text
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py -o addopts='' -k 'deny_cross_tenant_admin_before_lookup or main_app_installs_auth_middleware'
3 failed, 1 passed, 17 deselected, 72 warnings in 1.24s

FAILED ...test_management_routes_deny_cross_tenant_admin_before_lookup[get-/api/v1/llmgw/quota/acme]
FAILED ...test_management_routes_deny_cross_tenant_admin_before_lookup[get-/api/v1/llmgw/usage/acme]
FAILED ...test_management_routes_deny_cross_tenant_admin_before_lookup[delete-/api/v1/llmgw/cache/acme]

Observed failure: each cross-tenant-admin request still returned 200, proving the route-local guard was too permissive.
```

Fix round 1 GREEN phase:
- Changed `_require_same_tenant_management_access(...)` to:
  - call `require_tenant(ctx)` for verified tenant extraction
  - enforce strict `tenant_id == request_tenant_id`
  - raise a route-local denial on mismatch
- Left shared tenancy helpers and broad auth behavior unchanged.
- GREEN verification:

```text
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py -o addopts='' -k 'deny_cross_tenant_admin_before_lookup or management_routes_reject_cross_tenant_before_lookup or management_routes_allow_same_tenant_lookup or main_app_installs_auth_middleware'
10 passed, 11 deselected, 150 warnings in 1.20s
```

Fix round 1 required verification:

```text
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py -o addopts=''
7 passed, 46 warnings in 0.98s

pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_real_providers.py -o addopts=''
10 passed, 55 warnings in 4.51s

pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_production_guards.py -o addopts=''
17 passed, 81 warnings in 1.02s

pytest -p pytest_asyncio.plugin -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py -o addopts='' -k 'management_routes_reject_cross_tenant_before_lookup or management_routes_deny_cross_tenant_admin_before_lookup or management_routes_allow_same_tenant_lookup or main_app_installs_auth_middleware or cache_clear_endpoint or quota_status_endpoint or usage_endpoint'
15 passed, 6 deselected, 215 warnings in 1.20s

ruff check --select I,F mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py
All checks passed!

git diff --check
exit 0
stdout/stderr only contained CRLF line-ending warnings for the changed files
```

Fix round 1 changed files:
- `mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py`
- `mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py`

Fix round 1 concerns:
- Full `ruff check` remains noisy on pre-existing legacy punctuation/noqa findings in these files; scoped `--select I,F` is clean.
- `git diff --check` still emits CRLF conversion warnings even though it exits 0.
