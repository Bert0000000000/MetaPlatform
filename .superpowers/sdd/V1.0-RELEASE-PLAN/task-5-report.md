# Task 5 Report — Copilot payload and prompt-leak guard

Date: 2026-08-27
Worktree: `D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/.worktrees/ga-v1-followups`
Base HEAD before task commit: `adf2d758`

## Scope delivered

- Added an explicit pre-LLM stream-envelope guard at `1_000_000` bytes for:
  - `POST /api/v1/copilot/chat/completions/stream`
  - `POST /api/v1/copilot/chat/agent/stream`
- Reused the same validator before:
  - any LLMGW client construction
  - any provider-config lookup
  - any user-message persistence
- Added response-side prompt-leak filtering for streaming/fallback assistant text:
  - catches split provider chunks via bounded holdback buffering
  - blocks configured/internal prompt markers and common system/developer-instruction disclosures
  - replaces blocked output with `抱歉，无法提供内部系统指令。`
  - prevents blocked text from reaching SSE output or assistant-message persistence
  - keeps `<think>` stripping in place
- Added HTTP tests for real chat/agent stream behavior and persistence contracts.

## Files changed

- `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py`
- `mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot.py`
- `mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py`

## TDD evidence

### RED

Command:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py -k 'case3 or case7' -o addopts='' -p pytest_asyncio
```

Observed:

- `test_case3_system_prompt_injection_does_not_exfiltrate` failed because the split canary chunks were streamed through to the client.
- `test_case7_oversized_payload_rejected_before_llm` failed because `LlmgwStreamClient` was instantiated before any payload guard and raised the test sentinel `AssertionError: oversized payload reached the LLM client`.

### GREEN

Command:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py -k 'case3 or case7' -o addopts='' -p pytest_asyncio
```

Observed:

```text
2 passed, 10 deselected
```

## Added HTTP coverage

- `test_chat_completions_stream_rejects_oversized_payload_before_persistence`
- `test_chat_completions_stream_filters_split_prompt_leak_and_persists_safe_reply`
- `test_chat_agent_stream_rejects_oversized_payload_before_persistence`
- `test_chat_agent_stream_filters_prompt_leak_and_persists_safe_reply`

These prove:

- `413` is returned before LLM/orchestrator client work
- oversized requests do not persist the user turn
- split prompt canaries are sanitized in SSE output
- blocked assistant content is not persisted
- agent stream keeps its SSE end marker and conversation persistence behavior

## Verification

Commands run:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py -k 'case3 or case7' -o addopts='' -p pytest_asyncio
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot.py -k 'chat_completions_stream or chat_agent_stream' -o addopts='' -p pytest_asyncio
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot_tenant_integration.py -o addopts='' -p pytest_asyncio
pytest -q mate-platform-backend/packages/mate-app-copilot/tests/test_agent_stream_persistence.py -o addopts='' -p pytest_asyncio
ruff check --select I,F mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py mate-platform-backend/packages/mate-app-copilot/tests/test_app_copilot.py mate-platform-backend/packages/mate-app-copilot/tests/test_llm_adv_copilot.py
git diff --check
```

Observed:

- `test_llm_adv_copilot.py -k 'case3 or case7'`: `2 passed, 10 deselected`
- `test_app_copilot.py -k 'chat_completions_stream or chat_agent_stream'`: `4 passed, 23 deselected`
- `test_app_copilot_tenant_integration.py`: `10 passed`
- `test_agent_stream_persistence.py`: `2 passed`
- `ruff --select I,F`: `All checks passed!`
- `git diff --check`: exit `0` with only LF→CRLF working-copy warnings from Git

## Notes / limitations

- The streaming chat guard uses a bounded holdback window sized to the longest configured leak marker. That lets it catch split prompt canaries before emission, but very short safe prefixes immediately preceding a leaked marker may be collapsed into the replacement message rather than streamed separately.
- Test runs emitted pre-existing environment warnings from FastAPI (`asyncio.iscoroutinefunction` deprecation on Python 3.14) and JWT insecure test-secret length warnings. They did not affect pass/fail status.
