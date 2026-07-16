# MetaPlatform Integration Test Suite

Cross-platform integration tests covering **every public endpoint** of the
MetaPlatform API. Two parallel implementations share the same assertions:

| File | Platform | Used by |
|---|---|---|
| `run.sh`  | bash + jq | GitHub Actions CI |
| `run.ps1` | PowerShell 5.1+ | Local Windows dev |

Both scripts cover identical scenarios:

| # | Section | Endpoints |
|---|---|---|
| 1 | Auth         | login, /me, JWT |
| 2 | Storage      | health (7 backends), Neo4j query |
| 3 | AI           | status, embed, chat, agent tools |
| 4 | Analytics    | ClickHouse CRUD, NL2SQL, Quality, Simulator |
| 5 | Observability| Prometheus, status, traces, audit |
| 6 | Notifications| in-app send, list, mark read, mark-all |
| 7 | Scheduler    | status, register, run, cleanup |
| 8 | Tenant       | admin X-Tenant-Id override |
| 9 | OpenAPI      | spec retrieval (≥100 paths), Swagger UI |

Total: **25 steps / 53 assertions**.

## Running Locally

### Windows (PowerShell)

```powershell
# Start API first (or have it running already)
powershell -ExecutionPolicy Bypass -File tests\integration\run.ps1
```

### macOS / Linux / WSL (bash)

```bash
# Requires jq: apt install jq / brew install jq
bash tests/integration/run.sh
```

### Docker (any platform)

```bash
docker run --rm -it \
  --network metaplatform \
  -v $(pwd)/tests:/tests \
  -e BASE_URL=http://api:3001 \
  appropriate/curl-jq /tests/integration/run.sh
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` | API base URL |
| `EMAIL` | `admin@metaplatform.com` | Login email |
| `PASSWORD` | `admin123` | Login password |
| `VERBOSE` | unset | Print every response body |

## CI Integration

`.github/workflows/ci.yml` runs `tests/integration/run.sh` in the
`backend-integration` job, which spins up all 7 backend services as
GitHub Actions service containers, waits for each port, starts the API,
then executes the test suite.

## Test Output

```
════════════════════════════════════════════════════════════════
  Tests passed:  53
  Tests failed:  0
  Tests skipped: 0
════════════════════════════════════════════════════════════════

All integration tests passed!
```

A failure exits with status 1 and prints each failure name on the
summary block.

## ClickHouse Skip Behavior

If ClickHouse is unreachable in the test environment, the 3 CH-specific
tests (create/insert/query) are reported as **SKIP** (yellow), not
**FAIL**. The reasoning: developers running locally may not have
ClickHouse up. CI always has CH because of the service container.

If you want to fail-hard when CH is missing, edit the `CH_STATUS` check
in step 9 of the script.

## Adding a New Test

1. Pick a section that matches your endpoint (or add a new step at the
   end of the file).
2. Add a `step "<n>" "<description>"` block.
3. Use the helpers `call <METHOD> <PATH> [BODY] [TOKEN]` (bash) or
   `Call <METHOD> <PATH> [BODY] [TOKEN]` (PowerShell).
4. Assert with `assert_eq` / `assert_contains` / `assert_true` (bash) or
   `Assert-Equal` / `Assert-Contains` / `Assert-True` (PowerShell).
5. Increment `PASS`/`FAIL` automatically — the helpers do it.

## Philosophy

- **Black-box**: tests only know the public HTTP API. No DB access, no
  module imports. So the same suite exercises any deployment.
- **Stateless**: each test creates its own data (e.g. `integration.test`
  scheduler job is deleted in step 22). Runs are repeatable.
- **Read-mostly**: a few writes (`create-table`, `insert`) for the CH
  smoke test. The CH `integration_test` table persists between runs —
  that's fine, tests assert `count >= 2`, not exact counts.