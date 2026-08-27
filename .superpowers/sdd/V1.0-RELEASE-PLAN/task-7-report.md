# Task 7 Report

## Scope

Implemented Task 7 in the isolated worktree `D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\.worktrees\ga-v1-followups` within the requested source and test areas, plus this report artifact.

## Changes

1. Wired the existing `RedisTokenBucket` into `mate_tech_llmgw.main.lifespan`.
   - Added explicit env switch `MATE_LLMGW_ENABLE_REDIS_QUOTA`.
   - Default behavior is profile-based: enabled by default for `staging` / `production` / `prod`, disabled by default otherwise.
   - Startup only creates a bucket when no bucket is already injected.
   - Shutdown closes the bucket only when the app created and owns it.
   - Redis init failures degrade by logging a warning and leaving quota inactive.

2. Preserved the existing quota algorithm and shared auth path.
   - Reused `RedisTokenBucket` as-is.
   - Did not add a second limiter.
   - Did not alter Copilot production code or shared auth wiring.

3. Added deterministic HTTP quota boundary coverage for LLMGW.
   - `test_chat_http_returns_429_with_retry_after_before_provider_call`
   - `test_chat_http_same_tenant_under_quota_returns_200`
   - `test_staging_lifespan_wires_owned_quota_bucket_and_closes_it`
   - `test_staging_lifespan_respects_explicit_quota_disable`
   - `test_lifespan_preserves_external_quota_bucket_without_closing_it`

4. Replaced the Copilot case-4 false-green loop with a deterministic LLMGW-boundary contract test.
   - Removed the 120-request loop and “non-5xx is acceptable” assertion.
   - New case asserts downstream LLMGW `/api/v1/llmgw/chat` returns `429` with `Retry-After` and does not call the provider.

5. Fixed the existing `/api/v1/llmgw/chat` response serialization path needed by the new HTTP success contract.
   - `ChatResponse` is now converted with `dataclasses.asdict(...)` for canonical and legacy chat routes.

## TDD Evidence

### RED

Focused run before implementation:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_production_guards.py -k staging_lifespan_wires_owned_quota_bucket_and_closes_it -o addopts=''
```

Observed failure:

- `AssertionError` because `mate_tech_llmgw.main.lifespan` did not provision any quota bucket, so `get_quota_bucket()` stayed `None`.

Additional early focused runs exposed test-shape issues that were corrected before production changes:

- HTTP 429 proof used a stub without an initialized call counter.
- HTTP 200 proof exposed the existing `/chat` serialization bug (`'ChatResponse' object has no attribute '__dict__'`).

### GREEN

Focused post-change runs:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_production_guards.py -k lifespan -o addopts=''
pytest -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py -k "chat_http_returns_429_with_retry_after_before_provider_call or chat_http_same_tenant_under_quota_returns_200" -o addopts=''
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py -k case4 -o addopts=''
pytest -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py -o addopts=''
```

Observed results:

- lifecycle slice: `3 passed`
- focused HTTP quota slice: `2 passed`
- Copilot case 4: `1 passed`
- LLMGW adversarial suite: `7 passed`

## Verification

### Required commands from brief

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py -o addopts=''
pytest -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_llm_adv_llmgw.py -o addopts=''
pytest -q mate-platform-backend/packages/mate-tech-llmgw/tests/test_production_guards.py -o addopts=''
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py -k case4 -o addopts=''
```

Results:

- `test_llm_adv_llmgw.py`: passed (`7 passed`)
- `test_llm_adv_copilot.py -k case4`: passed (`1 passed`)
- `test_llmgw_business.py`: failed on pre-existing async test execution setup when plugin autoload is disabled (`async def functions are not natively supported`)
- `test_production_guards.py`: failed on the same pre-existing async test execution setup

This limitation is pre-existing in those files because many older tests still require an async pytest plugin while the prescribed command explicitly disables plugin autoload. The Task 7 additions were written sync-first where practical to avoid expanding that limitation.

### Additional checks

```powershell
ruff check --select I,F mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/main.py mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py mate-platform-backend/packages/mate-tech-llmgw/tests/test_production_guards.py mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py
git diff --check
```

Results:

- `ruff --select I,F`: passed
- `git diff --check`: no diff errors; Git emitted CRLF normalization warnings only

## Ownership / Lifecycle Notes

- If a quota bucket is already injected before startup, lifespan leaves it in place and does not close it.
- If lifespan creates the bucket, it registers it via `set_quota_bucket(...)` and closes it on shutdown.
- If Redis initialization fails during startup, the app logs `mate-tech-llmgw.quota.degraded` and continues with the existing degraded behavior.

## Files Changed

- `mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/main.py`
- `mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py`
- `mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py`
- `mate-platform-backend/packages/mate-tech-llmgw/tests/test_production_guards.py`
- `mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py`
- `.superpowers/sdd/V1.0-RELEASE-PLAN/task-7-report.md`
