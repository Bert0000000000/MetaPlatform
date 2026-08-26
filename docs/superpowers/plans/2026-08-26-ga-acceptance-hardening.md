# GA Acceptance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将本地和 CI 的 GA 验收从“条件跳过”收口为真实协议探测、真实外部 A2A 服务和真实非特权 PostgreSQL RLS 验证。

**Architecture:** 运行时 smoke 按依赖类型选择 HTTP、Keycloak OIDC 或 TCP readiness 探测，不再把没有 `/healthz` 等同于不验收。外部 A2A 服务作为独立 uv workspace 服务和 Task5 Docker 服务运行，使用独立宿主端口避免与 Data 冲突。RLS 使用专用数据库和 `NOSUPERUSER/NOBYPASSRLS` 测试角色，由幂等准备脚本创建、建表和启用策略，生产数据库不被改写。

**Tech Stack:** Playwright APIRequestContext, Node.js `net`, Docker Compose, Python 3.12, uv workspace, FastAPI, a2a-sdk 1.1.2, PostgreSQL 16 RLS。

**Spec:** 用户确认的《Mate Platform v1.0 正式 GA：全量复盘与落地计划》；相关基线见 `docs/superpowers/specs/2026-07-30-backend-production-readiness-design.md`。

## Global Constraints

- API Gateway 是唯一公共入口；外部服务只用于服务间验收，不增加前端 REST 双轨。
- Docker Compose 仅用于本地开发和验收，生产部署仍以 Kubernetes/Helm/GitOps 为准。
- 不触碰、暂存或提交未跟踪文件 `PROXY`。
- 不删除现有开发数据；RLS 只使用专用 `metaplatform_ont_test` 数据库。
- 所有测试失败必须保留现场并报告，不通过扩大 skip 条件或静默 fallback 绕过。

---

### Task 1: Protocol-aware runtime smoke

**Files:**
- Modify: `metaplatform-frontend/tests/e2e/runtime-mvp-02-smoke.spec.ts`
- Modify: `scripts/task5-verify.sh`

**Interfaces:**
- Produces one runtime probe per public service plus TCP readiness checks for PostgreSQL, Redis and Kafka.
- Keeps service-specific endpoints identical to Docker healthchecks: Data `/api/v1/data/health`, DW `/healthz`, A2A `/api/v1/a2a/health`, MinIO `/minio/health/live`, Keycloak `/realms/metaplatform/.well-known/openid-configuration`.

- [x] **Step 1: Replace the skip set with explicit HTTP and TCP probe maps.**

  In `runtime-mvp-02-smoke.spec.ts`, define `HTTP_PROBES` as `{ name, port, path }` records and `TCP_PROBES` as `{ name, port }` records. Add a `connectTcp(host, port, timeoutMs)` helper using `node:net` that resolves only after `socket.connect` and rejects on `timeout`, `error`, or `close` before connect. Keep the assertion that HTTP probe responses are `200`, `401`, `403`, or `503`; TCP probes assert the promise resolves.

- [x] **Step 2: Make the shell verifier use the same service-specific probes.**

  In `scripts/task5-verify.sh`, retain the existing service checks and add explicit checks for `mate-postgres`, `mate-redis`, and `mate-minio` container health. Keep the Keycloak realm probe and the existing Kafka Docker health probe. The script must fail with the service name and exact endpoint when any check fails.

- [x] **Step 3: Run the focused smoke suite.**

  Run from `metaplatform-frontend`:

  ```powershell
  $env:E2E_GATEWAY_URL='http://127.0.0.1:8100/api/v1'
  pnpm exec playwright test --config=playwright.config.ts --project=web --workers=1 tests/e2e/runtime-mvp-02-smoke.spec.ts
  ```

  Expected: all runtime probes pass and zero tests are skipped in this spec.

### Task 2: Package and run the external A2A service

**Files:**
- Create: `mate-platform-backend/services/a2a-external-agent/pyproject.toml`
- Modify: `mate-platform-backend/pyproject.toml`
- Modify: `docker-compose.task5.yml`
- Modify: `scripts/task5-up.sh`
- Modify: `scripts/task5-verify.sh`
- Test: `mate-platform-backend/packages/mate-tech-orchestrator/tests/test_a2a_external_agent_docker.py`

**Interfaces:**
- The package exports `mate_a2a_external_agent.server:app` and remains compatible with the existing test imports.
- The Task5 service listens on container port `8701` and host port `8702`, avoiding the existing Data service on host port `8701`.
- The external service exposes `GET /healthz`, `GET /.well-known/agent-card.json`, and A2A JSON-RPC `POST /`.

- [x] **Step 1: Add the workspace package metadata.**

  Create `services/a2a-external-agent/pyproject.toml` with `requires-python = ">=3.12"`, `a2a-sdk==1.1.2`, `fastapi==0.140.4`, `uvicorn==0.51.0`, and `structlog>=25.0.0`. Use Hatchling and set `[tool.hatch.build.targets.wheel].packages = ["src/mate_a2a_external_agent"]`.

- [x] **Step 2: Include the service source in workspace test imports.**

  Remove `services/a2a-external-agent` from the root `uv` exclude list and append `services/a2a-external-agent/src` to the root pytest `pythonpath`. Regenerate `uv.lock` with `uv lock` and verify `uv lock --check`.

- [x] **Step 3: Add the real service to the Task5 overlay.**

  Add `a2a-external-agent` to `docker-compose.task5.yml` with build context `./mate-platform-backend`, Dockerfile `services/a2a-external-agent/Dockerfile`, image `a2a-external-agent:task5`, host mapping `${A2A_EXTERNAL_AGENT_PORT:-8702}:8701`, `A2A_EXTERNAL_AGENT_HOST=http://a2a-external-agent:8701`, and the existing healthcheck. Add it to `task5-up.sh` wait targets and to `task5-verify.sh` with card and health probes.

- [x] **Step 4: Run package and live service verification.**

  Run:

  ```powershell
  C:\Users\houuu\.local\bin\uv.exe run pytest packages/mate-tech-orchestrator/tests/test_a2a_external_agent_docker.py -q
  docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.task5.yml up -d --build a2a-external-agent
  Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8702/healthz
  Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8702/.well-known/agent-card.json
  ```

  Expected: four package tests pass, the container is healthy, and the card advertises all three skills.

### Task 3: Non-privileged PostgreSQL RLS acceptance database

**Files:**
- Create: `scripts/ci/prepare_ont_rls_test_db.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/tests/security/test_tenant_isolation_hard.py`
- Modify: `.github/workflows/ga-acceptance.yml`
- Modify: `scripts/task5-verify.sh`

**Interfaces:**
- The preparation script is idempotent and accepts `--admin-dsn`, `--test-dsn`, and `--role-password` or their environment equivalents.
- The test suite defaults to `postgresql://mate_ont_test:mate_ont_test@localhost:5432/metaplatform_ont_test` and still honors `PG_DSN`.
- The role is `NOSUPERUSER NOBYPASSRLS`; no production database or application role is altered.

- [x] **Step 1: Write the preparation script.**

  Connect to the maintenance database using the admin DSN, create or reset only role `mate_ont_test` with `LOGIN NOSUPERUSER NOBYPASSRLS`, create database `metaplatform_ont_test` owned by that role if absent, connect using the test DSN, call `PgOntologyRepository._ensure_schema()`, and for the nine `KERNEL01_V2_TABLES_FOR_TESTS` tables execute `ENABLE ROW LEVEL SECURITY`, replace policy `tenant_isolation` with `USING/WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)`, and `FORCE ROW LEVEL SECURITY`. Set the database default `app.tenant_id` to the empty string so an unset tenant denies rows.

- [x] **Step 2: Make the hard suite seed and clean through explicit tenant contexts.**

  Update `_clean_pg` to truncate only the nine test tables as their test role owner. Update `_seed_ind_raw` to issue `SET LOCAL app.tenant_id` for the row's tenant before inserting. Preserve the eight attack-vector assertions; do not weaken the expected `InsufficientPrivilege`, empty SELECT, or zero-row UPDATE checks.

- [x] **Step 3: Add the preparation gate to CI and local verification.**

  In `ga-acceptance.yml`, install workspace dependencies, run the preparation script against the job PostgreSQL service, then run the hard RLS suite without `--runxfail`. In `scripts/task5-verify.sh`, add an opt-in `RLS_TEST_DB=1` branch that runs the same script and reports the exact DSN/database name; the default Task5 verification remains non-destructive.

- [x] **Step 4: Run the isolated RLS suite.**

  Run:

  ```powershell
  C:\Users\houuu\.local\bin\uv.exe run python scripts/ci/prepare_ont_rls_test_db.py
  $env:PG_DSN='postgresql://mate_ont_test:mate_ont_test@localhost:5432/metaplatform_ont_test'
  C:\Users\houuu\.local\bin\uv.exe run pytest packages/mate-tech-ont/tests/security/test_tenant_isolation_hard.py -q
  ```

  Expected: 8 passed and zero skipped; `SELECT rolsuper, rolbypassrls` for `mate_ont_test` returns `false, false`.

### Task 4: Evidence and regression closure

**Files:**
- Modify: `docs/active/governance/FOLLOW-UP-BOARD.md` if its status rows are stale
- Modify: `docs/README.md` only where current local acceptance evidence is explicitly documented

- [x] **Step 1: Run the complete acceptance evidence set.**

  Run the runtime smoke, external A2A package test, isolated RLS suite, `uv lock --check`, `git diff --check`, frontend typecheck/build, backend full pytest, and full real-auth Playwright. Record counts and skipped reasons; do not call skipped checks “passed”.

- [x] **Step 2: Verify the working tree boundary.**

  Confirm `git diff --cached --name-only` is empty, `PROXY` remains untracked and untouched, and no generated test artifact is staged.

- [x] **Step 3: Update the plan status only after all gates pass.**

  Mark a task complete only with its command exit code and evidence. If external staging credentials, Kubernetes, or production approval are unavailable, leave those GA gates explicitly pending rather than claiming production readiness.
