# PRD 08 Action Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a versioned, persistent Action Orchestration editor whose server-owned Plan JSON is published and executed through the existing stable workflow-run contract.

**Architecture:** `mate-app-wfe` owns workflow-definition persistence in its SQL repository. A definition has a draft Plan JSON, optimistic version, publish metadata, and immutable published revisions. The editor uses that API; it never sends browser-owned execution semantics. Runs resolve the published revision and delegate to the backend-neutral `Plan`/Temporal executor. The old AppHub BPMN/FlowDesigner path remains a separate legacy AppHub capability and is not a second source for Action Orchestration.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL, Python 3.12, Temporal adapter, React 19, TypeScript, Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-prd-05-08-sprint-0-design.md`; `docs/active/prd/APP-WFE/PRD-08-Action-Orchestration-v1.7_v1.0-20260831.md`.

## Global Constraints

- The only orchestration definition API is `GET/PUT /api/v1/workflow-definitions/{definition_id}` and `POST /api/v1/workflow-definitions/{definition_id}:publish`; runs remain `POST /api/v1/workflows/{definition_id}/runs`.
- Plan JSON contains business steps only and must not expose Temporal workflow IDs, task queues, activity names, or worker implementation details.
- `PUT` requires the caller's version and returns `409` with current version and a compact summary on conflict. Publish validates the server-side draft, creates an immutable revision, and requires an idempotency key.
- All workflow definitions, revisions, and runs are tenant-isolated. Production has no in-memory WFE definition state and no Flowable execution path.
- Browser state is transient UI state only. Remove the Action Orchestration dependency on `localStorage`, AppHub Flow API, generated BPMN, and demo success responses.

---

## Task 1: Define and test the versioned Plan-definition domain model

**Files:**

- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/workflow/contracts.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/repositories/sql_models.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/repositories/sql_store.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/repositories/in_memory.py`
- Create: `mate-platform-backend/packages/mate-app-wfe/tests/test_workflow_definitions_repository.py`

- [ ] **Step 1: Write failing repository tests.** Cover tenant-scoped get/save, unique IDs per tenant, optimistic version increment, stale update conflict carrying latest summary, immutable published revisions, and a published revision retaining the exact Plan JSON used by a run.

- [ ] **Step 2: Run the new test and confirm the current WFE repository has only BPMN `FlowDefinition` state.**

- [ ] **Step 3: Implement `WorkflowDefinition` and `WorkflowDefinitionRevision`.** Add JSON-backed draft/revision tables under the `wfe_` prefix, tenant/version/status/published metadata, and repository operations for get, compare-and-save, publish, and resolve-published. Keep the in-memory implementation test-only; production selection must use SQL.

- [ ] **Step 4: Run the repository test and confirm it passes on PostgreSQL and the explicit test store.**

- [ ] **Step 5: Commit.** `feat(wfe): persist versioned plan definitions`

## Task 2: Add definition APIs and connect runs to published revisions

**Files:**

- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/api/workflows.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/main.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/tests/conftest.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/tests/test_workflow_runs_api.py`
- Create: `mate-platform-backend/packages/mate-app-wfe/tests/test_workflow_definitions_api.py`

- [ ] **Step 1: Write failing HTTP tests.** Assert GET returns a tenant-owned draft, PUT requires a version and rejects stale updates with `409`, publish rejects invalid graphs with actionable errors, publishes once idempotently, hides other tenants with `404`, and starts a run using the published revision without accepting caller-supplied steps.

- [ ] **Step 2: Run the HTTP tests and confirm only the legacy `WorkflowStartRequest.steps` API exists.**

- [ ] **Step 3: Implement the API.** Add typed Plan JSON request/response DTOs, use `request.state.ctx` for tenant/actor, require `Idempotency-Key` for publish and runs, resolve the published revision in `start_workflow`, and include `definition_version` in the returned run/status payload. Return `503` if the repository or executor is unavailable.

- [ ] **Step 4: Run the API/run tests and confirm they pass.**

- [ ] **Step 5: Commit.** `feat(wfe): expose versioned plan definition api`

## Task 3: Validate Plan graphs through a server node registry

**Files:**

- Create: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/plan_validation.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/api/workflows.py`
- Create: `mate-platform-backend/packages/mate-app-wfe/tests/test_plan_validation.py`

- [ ] **Step 1: Write failing validation tests.** Cover unique node IDs, allowed ActionType node registry, required input schema, start/end reachability, no dangling edges, confirmation policy, and error objects containing `node_id`, field, code, and user-safe message.

- [ ] **Step 2: Run validation tests and confirm legacy BPMN structural validation cannot validate Plan JSON.**

- [ ] **Step 3: Implement the Plan node registry and validator.** Keep allowed node types and input rules in a server-owned registry; return structured validation results from save/publish. Do not convert Plan JSON to BPMN or Flowable artifacts.

- [ ] **Step 4: Run validation and definition API tests; confirm they pass.**

- [ ] **Step 5: Commit.** `feat(wfe): validate plan graphs server side`

## Task 4: Replace the SuperAI task demo with the persistent editor

**Files:**

- Create: `metaplatform-frontend/apps/web/src/api/wfe/workflowDefinitions.ts`
- Create: `metaplatform-frontend/apps/web/src/pages/wfe/ActionOrchestrationPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/wfe/components/PlanCanvas.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/wfe/components/PlanInspector.tsx`
- Modify: `metaplatform-frontend/apps/web/src/App.tsx`
- Modify: `metaplatform-frontend/apps/web/src/pages/superai/TaskOrchestrationPage.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/wfe/ActionOrchestrationPage.test.tsx`

- [ ] **Step 1: Write failing UI tests.** Verify server load state, node registry palette, inspector editing, atomic node deletion removing related edges, save with version, visible conflict recovery, publish validation errors, and native fullscreen through a button. Assert no `localStorage` or AppHub flow API calls occur.

- [ ] **Step 2: Run the test and confirm the existing SuperAI task page is an intent/plan/execution demo rather than a definition editor.**

- [ ] **Step 3: Implement the smallest real editor.** Add an `/wfe/action-orchestration/:definitionId` route and redirect the old `/superai/tasks` route to it. Keep the editable draft in React state only, load/save/publish through the WFE API, provide the inspector/canvas workflow, and implement fullscreen with `Element.requestFullscreen()`.

- [ ] **Step 4: Run frontend unit tests and production build; confirm they pass.**

- [ ] **Step 5: Commit.** `feat(wfe-ui): add persistent action orchestration editor`

## Task 5: Execute published Plans through the existing Temporal contract

**Files:**

- Modify: `mate-platform-backend/packages/mate-platform/src/mate_platform/workflow/executor.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/src/mate_app_wfe/api/workflows.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/tests/test_temporal_workflow.py`
- Modify: `mate-platform-backend/packages/mate-app-wfe/tests/test_workflow_runs_api.py`

- [ ] **Step 1: Write failing executor tests.** A run must use the immutable published Plan revision, retain its definition version through restart/query, wait for required approval, and reject cancellation/retry for another tenant.

- [ ] **Step 2: Run the focused tests and confirm a client can currently submit arbitrary steps at run time.**

- [ ] **Step 3: Implement revision resolution and execution handoff.** Build `Plan` only from the repository's published revision plus allowed run input/trace/correlation values. Pass its stable `definition_id/version` to the Temporal adapter; preserve existing run/status endpoints and never return Temporal internals to the browser.

- [ ] **Step 4: Run WFE unit/API/Temporal tests and confirm they pass.**

- [ ] **Step 5: Commit.** `feat(wfe): run immutable published plan revisions`

## Task 6: Verify the local editor-to-run journey and retire misleading evidence

**Files:**

- Create: `metaplatform-frontend/apps/web/tests/e2e/action-orchestration.spec.ts`
- Create: `scripts/ci/prd08_action_orchestration_smoke.ps1`
- Modify: `docs/active/prd/APP-WFE/PRD-08-Action-Orchestration-v1.7_v1.0-20260831.md`
- Modify: `docs/active/specs/flowgram-usage-specification.md`

- [ ] **Step 1: Write a failing Playwright journey.** Authenticate, open the Action Orchestration route, change a draft, deliberately produce a validation error, correct it, publish, reload to prove persistence, start a run, and verify its status/version. Include two-tab stale-save conflict handling.

- [ ] **Step 2: Run the journey and confirm it fails before the editor and API are implemented.**

- [ ] **Step 3: Add Docker acceptance smoke coverage.** Check WFE API and Temporal worker readiness, create/update/publish/run via Gateway with OIDC, then read the persisted definition and run. Fail if the selected backend is in-memory or Flowable.

- [ ] **Step 4: Run the smoke script and Playwright journey twice; confirm reload and restart preserve the same published revision.**

- [ ] **Step 5: Update PRD/spec evidence only with passing commands, SHA, and an explicit distinction between old AppHub BPMN and the new Plan editor.**

- [ ] **Step 6: Commit.** `test(wfe): prove action orchestration local acceptance`

## Final Verification

- [ ] Run all `mate-app-wfe` repository, definition API, validation, run API, and Temporal tests.
- [ ] Run the Action Orchestration component test and `pnpm build` from `metaplatform-frontend`.
- [ ] Run `scripts/ci/prd08_action_orchestration_smoke.ps1` and `action-orchestration.spec.ts` against local Docker services.
- [ ] Check `git diff --check`; ensure no legacy Flowable or browser persistence path is presented as the new execution chain; preserve existing untracked user paths.
