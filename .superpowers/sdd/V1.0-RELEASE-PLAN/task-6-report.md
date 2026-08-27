# Task 6 Report — Copilot A2A target authorization

## Scope

- Modified `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py`
- Modified `mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py`
- Modified `mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot.py`

No shared auth context, shared A2A package, or non-Copilot files were changed.

## Root cause

`POST /api/v1/copilot/a2a/delegate` delegated immediately via the default
`InMemoryA2AClient` and only translated downstream `E_AGENT_NOT_FOUND` into a
404. The adversarial `case6` test was false-green because it called the
nonexistent `/api/v1/copilot/a2a/invoke` route and accepted 404, so it never
proved target authorization on the real handler.

## TDD evidence

### RED

1. Replaced the placeholder adversarial test with a real HTTP test against
   `/api/v1/copilot/a2a/delegate`.
2. Registered `agent-belonging-to-other-tenant` only under `tenant-globex`.
3. Included a body `tenant_id` override to prove the route must trust
   `_tid(request)`, not request JSON.
4. Patched `delegate()` to return a success-shaped response if it was reached.

Command:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py -k case6 -o addopts=''
```

Observed failure before the fix:

- `test_case6_a2a_call_to_unauthorized_agent_rejected` failed
- actual status was `200`
- response body was a success-shaped delegation payload
- patched `delegate()` was reached, proving no route-level authorization guard

### GREEN

Implemented a Copilot-local `_authorize_a2a_target()` helper in `api/app.py`
that checks `target_agent_id` against the current tenant's existing
`AgentCardRegistry` entry set before delegation and raises:

```json
{
  "detail": {
    "code": "A2A_TARGET_NOT_ALLOWED",
    "message": "target agent is not allowed for this tenant",
    "target_agent_id": "<target>"
  }
}
```

This uses only `_tid(request)` for tenant selection and does not introduce any
`RequestContext.allowed_agents` claim.

## Behavior covered

- Unauthorized or cross-tenant target:
  - real route `/api/v1/copilot/a2a/delegate`
  - body tenant override ignored
  - returns safe `403`
  - `delegate()` is not called
  - no success-shaped echo
- Same-tenant registered target:
  - still returns `200 completed`
  - preserves lineage hints with `tenant_id` and `target_agent_id`
  - still emits `copilot.a2a.delegated` outbox event with the same payload

## Verification

Required focused tests:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py -k case6 -o addopts=''
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot_tenant_integration.py -k a2a -o addopts=''
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot.py -k a2a -o addopts=''
```

Results:

- `test_llm_adv_copilot.py -k case6`: `1 passed, 11 deselected`
- `test_app_copilot_tenant_integration.py -k a2a`: `1 passed, 9 deselected`
- `test_app_copilot.py -k a2a`: `1 passed, 29 deselected`

Relevant broader Copilot suites:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot_tenant_integration.py -o addopts=''
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot.py -o addopts=''
```

Results:

- `test_app_copilot_tenant_integration.py`: `10 passed`
- `test_app_copilot.py`: `30 passed`

Lint / hygiene:

```powershell
ruff check --select I,F mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot.py
git diff --check
```

Results:

- `ruff`: `All checks passed!`
- `git diff --check`: no whitespace or conflict-marker errors

## Environment / warning notes

- Pytest emitted pre-existing `fastapi.routing` deprecation warnings about
  `asyncio.iscoroutinefunction`.
- Pytest emitted pre-existing JWT insecure HMAC key length warnings from test
  fixtures.
- `git diff --check` printed line-ending warnings (`LF will be replaced by
  CRLF`) for touched files, but reported no diff-check errors.
