# PRD 05 Semantic Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn SuperAI routing into an authorized, tenant-isolated, observable decision path that fails closed instead of silently selecting a fallback role.

**Architecture:** The Copilot stream endpoint takes its identity from OIDC, asks Orchestrator for the tenant-authorized role snapshot, ranks only those roles with a versioned policy, emits a pre-selection and a final `routing_decision` SSE event, then dispatches only the chosen allowed role. Routing decisions are written to the configured outbox/audit path with correlation metadata.

**Tech Stack:** FastAPI, Python 3.12, Pydantic settings, existing Orchestrator client, SSE, React 19, TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-prd-05-08-sprint-0-design.md`; `docs/active/prd/APP-COPILOT/PRD-05-Semantic-Router_v1.0-20260831.md`.

## Global Constraints

- The router never receives a client-supplied role list or tenant value as authority; it consumes the authenticated tenant and an Orchestrator-authorized snapshot.
- Defaults are configuration values: `top_k=3`, minimum relevance `0`, cache TTL, and keyword boost. The client does not hard-code routing policy.
- Cache identity is `(tenant_id, actor role snapshot digest, capability version, role rid)`; a capability version change invalidates the old entry.
- An unavailable authorizer, empty authorized snapshot, below-threshold result, or dispatch failure returns an explicit failed/denied routing event and no target execution.
- Keep `routing_decision` event ordering stable: pre-screen before reasoning; final selected/denied event before any dispatch tool call; include policy version and correlation data in both.

---

## Task 1: Introduce a versioned, bounded routing policy

**Files:**

- Modify: `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/semantic_router.py`
- Create: `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/routing_policy.py`
- Modify: `mate-platform-backend/packages/mate-app-copilot/tests/test_semantic_router.py`

- [ ] **Step 1: Write failing unit tests.** Cover policy parsing/defaults, a relevance floor that returns no candidate, tenant/role/capability-version cache separation, cache reuse for the same snapshot, and invalidation after the version changes.

- [ ] **Step 2: Run the router tests and confirm the cache is currently keyed too broadly.**

- [ ] **Step 3: Implement `RoutingPolicy` and typed snapshot inputs.** Move constants out of `SemanticRouter`, require `tenant_id`, `actor_roles_digest`, and `capability_version` at route time, reject invalid policy bounds at startup, and make candidate ranking return an explicit no-match result instead of selecting a weak top-one.

- [ ] **Step 4: Run the router tests and confirm they pass.**

- [ ] **Step 5: Commit.** `feat(copilot): add tenant-scoped routing policy`

## Task 2: Authorize the role snapshot before routing

**Files:**

- Modify: `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py`
- Modify: `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/clients/orchestrator_client.py`
- Modify: `mate-platform-backend/packages/mate-app-copilot/tests/test_agent_loop_routing.py`
- Create: `mate-platform-backend/packages/mate-app-copilot/tests/test_routing_authorization.py`

- [ ] **Step 1: Write failing API/service tests.** Assert the gateway tenant and OIDC user roles are forwarded to an authorized snapshot call; an unauthorized/foreign role is absent before ranking; an Orchestrator failure, empty snapshot, and invalid snapshot produce a denied result with no dispatch call.

- [ ] **Step 2: Run the tests and confirm the current `list_roles(tenant_id)` path has no actor-role snapshot input.**

- [ ] **Step 3: Implement the narrow client contract.** Add an authorized role-snapshot method carrying service-authenticated tenant, OIDC subject, role digest, and correlation headers. In the stream endpoint derive these only from `request.state.ctx`, then pass the returned capability version and roles to the router.

- [ ] **Step 4: Run the tests and confirm no foreign/unauthorized role reaches `run_agent_loop`.**

- [ ] **Step 5: Commit.** `feat(copilot): authorize semantic routing snapshot`

## Task 3: Replace silent fallback dispatch with explicit fail-closed routing events

**Files:**

- Modify: `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/agent_loop.py`
- Modify: `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/dispatcher.py`
- Modify: `mate-platform-backend/packages/mate-app-copilot/tests/test_agent_loop_routing.py`
- Modify: `mate-platform-backend/packages/mate-app-copilot/tests/test_semantic_dispatcher.py`

- [ ] **Step 1: Write failing sequence tests.** Verify pre-screen -> reasoning -> selected is the successful sequence; no-match and LLM/dispatcher failure emit `stage=final`, `outcome=denied`, a reason code, and no tool call; selected targets must exist in the authorized snapshot.

- [ ] **Step 2: Run the tests and confirm the existing keyword/fallback path can route without the required policy result.**

- [ ] **Step 3: Implement deterministic bounded selection.** Preserve optional A2A only when it is an authorized target; remove substring fallback as a dispatch authority. Make `_routing_decision_event` carry `stage`, `outcome`, `policy_version`, `candidate_count`, `trace_id`, and `correlation_id` without exposing internal prompts or tokens.

- [ ] **Step 4: Run the focused agent-loop and dispatcher tests and confirm they pass.**

- [ ] **Step 5: Commit.** `fix(copilot): fail closed on routing uncertainty`

## Task 4: Persist decision audit evidence through the service outbox

**Files:**

- Modify: `mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py`
- Modify: `mate-platform-backend/packages/mate-app-copilot/tests/test_agent_loop_routing.py`
- Create: `mate-platform-backend/packages/mate-app-copilot/tests/test_routing_audit.py`

- [ ] **Step 1: Write failing audit tests.** For selected and denied decisions, assert exactly one `copilot.routing.decided` or `copilot.routing.denied` outbox event with tenant, actor, role snapshot digest, policy/capability version, selected RID when present, reason code, trace ID, and correlation ID. Assert an unavailable writer makes the stream terminate with a clear error rather than report a completed decision.

- [ ] **Step 2: Run the tests and confirm no decision audit record exists today.**

- [ ] **Step 3: Implement an explicit emit helper at the decision boundary.** Use the configured writer and existing event envelope; propagate write failure to the stream before dispatch. Do not log message content, bearer tokens, or raw OIDC claims.

- [ ] **Step 4: Run the audit and routing test files and confirm they pass.**

- [ ] **Step 5: Commit.** `feat(copilot): audit routing decisions`

## Task 5: Align the SuperAI trace UI with the server contract

**Files:**

- Modify: `metaplatform-frontend/apps/web/src/pages/superai/hooks/useAgentStream.ts`
- Modify: `metaplatform-frontend/apps/web/src/pages/superai/SuperAIChatPage.tsx`
- Modify: `metaplatform-frontend/apps/web/src/pages/superai/components/RoutingDecisionPanel.tsx`
- Create: `metaplatform-frontend/apps/web/src/pages/superai/components/RoutingDecisionPanel.test.tsx`

- [ ] **Step 1: Write failing component tests.** Verify pre-screen candidates render before selection, a final denied event renders a non-retryable explanation, the selected route exposes its source/reason and policy version, and no action lets a user manually choose a role.

- [ ] **Step 2: Run the component test and confirm the new event fields are ignored.**

- [ ] **Step 3: Implement typed SSE parsing and display.** Preserve event order per assistant turn, render a concise status for selected/denied, show only user-safe labels/reasons, and treat malformed events as a displayed stream error instead of silently retaining stale selection.

- [ ] **Step 4: Run frontend unit tests and the production build.**

- [ ] **Step 5: Commit.** `feat(superai): render authorized routing trace`

## Task 6: Prove authorized routing in Docker and Playwright

**Files:**

- Modify: `metaplatform-frontend/apps/web/tests/e2e/superai-routing.spec.ts`
- Create: `scripts/ci/prd05_semantic_router_smoke.ps1`
- Modify: `docs/active/prd/APP-COPILOT/PRD-05-Semantic-Router_v1.0-20260831.md`

- [ ] **Step 1: Write the failing acceptance assertions.** Use two tenant/operator contexts, prove top-k is bounded by the configured value, prove a selected role belongs to the current authorized snapshot, and prove a no-match yields a visible denied event without dispatch.

- [ ] **Step 2: Run the Playwright/API collection test and confirm it cannot yet assert authorization/audit fields.**

- [ ] **Step 3: Add a Docker smoke script.** Check the Copilot and Orchestrator health, execute a selected and denied stream via Gateway, and verify the decision event and audit record without printing credentials.

- [ ] **Step 4: Run the smoke script and Playwright test twice; confirm cache reuse does not cross tenant/role/version boundaries.**

- [ ] **Step 5: Record only passing current-SHA evidence in the PRD.**

- [ ] **Step 6: Commit.** `test(copilot): prove authorized semantic routing`

## Final Verification

- [ ] Run all `mate-app-copilot` router, dispatcher, agent-loop, authorization, and audit tests.
- [ ] Run the Router component test and frontend production build.
- [ ] Run `scripts/ci/prd05_semantic_router_smoke.ps1` and `superai-routing.spec.ts` against the local Docker acceptance profile.
- [ ] Check `git diff --check` and preserve the three existing untracked user paths.
