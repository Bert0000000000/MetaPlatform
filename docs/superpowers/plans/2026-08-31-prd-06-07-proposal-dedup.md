# PRD 06–07 Proposal and Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ontology proposal and deduplication changes durable, identity-bound, idempotent, and auditable from proposal creation through executed or rejected terminal state.

**Architecture:** `mate-tech-ont` remains the authoritative transaction boundary. The existing `ont_proposal` row holds current state; append-only proposal events, idempotency records, execution receipts, and the business mutation commit together in PostgreSQL. The API derives the actor solely from `request.state.ctx.user_id`; the React drawer renders only server-returned state.

**Tech Stack:** FastAPI, Pydantic, Python 3.12, PostgreSQL/psycopg, React 19, TypeScript, Vitest, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-31-prd-05-08-sprint-0-design.md`; `docs/active/prd/APP-ONTSTUDIO/PRD-06-Ontology-Proposal_v1.0-20260831.md`; `docs/active/prd/APP-ONTSTUDIO/PRD-07-Ontology-Dedup_v1.0-20260831.md`.

## Global Constraints

- Public proposal states are exactly `pending`, `confirmed`, `rejected`, and `executed`. Migrate stored `applied` values to `executed`; do not expose both words as terminal alternatives.
- Mutation commands require `Idempotency-Key`; repeated same tenant, operation, key, and request digest return the original response, while a digest mismatch returns `409`.
- Use `ctx.user_id` for confirm/reject/execute actor identity. Remove `confirmed_by` from public request input; never accept a client-supplied actor string.
- All reads and writes remain tenant-scoped through `_scoped_repo` and PostgreSQL RLS. Cross-tenant proposal IDs are indistinguishable from not found.
- The source object type of a confirmed merge is archived, never physically deleted. Repeated execution must not remap data twice.
- The production path must remain PostgreSQL; no in-memory or silent outbox failure can report a successful executed proposal.

---

## Task 1: Freeze the public lifecycle and execution receipt contract

**Files:**

- Modify: `mate-platform-backend/packages/mate-kernel/src/mate_kernel/action/engine.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- Modify: `metaplatform-frontend/apps/web/src/api/ont/kernel.ts`
- Test: `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_proposal_preview.py`

- [ ] **Step 1: Write failing lifecycle tests.** Cover `pending -> confirmed -> executed`, rejection as terminal, confirmation/execution after a terminal transition returning `409`, and the preview lock message naming `executed`.

- [ ] **Step 2: Run the focused test and confirm it fails** because the public state is still `applied`.

- [ ] **Step 3: Implement the smallest contract change.** Rename `ProposalStatus.APPLIED` and `mark_applied()` to `EXECUTED` and `mark_executed()`, update DTOs, preview locks, OpenAPI descriptions, and frontend status unions. Keep a private migration parser only long enough to hydrate historical `applied` rows as `executed`.

- [ ] **Step 4: Run the focused test and confirm it passes.**

- [ ] **Step 5: Commit.** `feat(ontology): standardize proposal executed state`

## Task 2: Add transactional proposal events, idempotency, and migration

**Files:**

- Modify: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/main.py` only if startup migration registration is required
- Create: `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_proposal_persistence.py`
- Modify: `scripts/ci/task5_ontology_persistence_smoke.ps1`

- [ ] **Step 1: Write failing PostgreSQL integration tests.** Use two tenants and assert: schema migration changes legacy `applied` to `executed`; each transition appends one ordered event with actor, tenant, trace, correlation, request digest, and UTC timestamp; the same idempotency key returns the saved receipt; a reused key with a different body returns a conflict; a second tenant cannot read either the proposal or events.

- [ ] **Step 2: Run the new integration file against the Task5 PostgreSQL service and confirm the tables/semantics are absent.**

- [ ] **Step 3: Implement the schema and repository boundary.** Extend `_SCHEMA_STATEMENTS` with `ont_proposal_event`, `ont_proposal_idempotency`, and receipt fields on `ont_proposal` (`executed_at`, `execution_result`, `version`). Add a forward-only migration that changes `applied` to `executed`. Introduce repository helpers that lock the proposal row (`FOR UPDATE`), compare request digests, append events, persist the receipt, and commit all of those with the business mutation.

- [ ] **Step 4: Make execution atomic.** Refactor `execute_proposal` so create-instance, model-type, merge-suggestion, and action-kind execution use one transaction. A merge records the source archive marker and mapping in the receipt before commit; a failed outbox/audit write aborts the transaction and leaves the proposal confirmed.

- [ ] **Step 5: Extend the Task5 smoke script.** It must recreate only `mate-tech-ont`, verify the persisted proposal and its event/receipt after restart, and continue to avoid recreating PostgreSQL or Neo4j.

- [ ] **Step 6: Run the new test plus the Task5 smoke script; confirm all pass.**

- [ ] **Step 7: Commit.** `feat(ontology): persist proposal audit and idempotency`

## Task 3: Bind approval actions to OIDC identity and tenant authorization

**Files:**

- Modify: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_proposal_preview.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_dedup_http.py`

- [ ] **Step 1: Write failing HTTP tests.** Confirm and reject with a spoofed JSON `confirmed_by`, then assert the stored actor is the JWT `sub`; assert unauthenticated requests get `401`, a tenant mismatch gets `404`, and confirm/reject/execute without `Idempotency-Key` gets `400`.

- [ ] **Step 2: Run the focused HTTP files and confirm the spoofing test fails.**

- [ ] **Step 3: Implement the API contract.** Replace `ProposalConfirmDTO` with an empty command body (or no body) and pass `str(ctx.user_id)` plus trace/correlation metadata to repository methods. Require and normalize `Idempotency-Key` on confirm, reject, and execute. Map transition conflicts to the common `409` error envelope and preserve `404` for inaccessible proposals.

- [ ] **Step 4: Run the focused HTTP files and confirm they pass.**

- [ ] **Step 5: Commit.** `fix(ontology): bind proposal approvals to oidc actor`

## Task 4: Complete ActionType execution and outbox/audit evidence

**Files:**

- Modify: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_proposal_persistence.py`
- Modify: `mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_dedup.py`

- [ ] **Step 1: Write failing tests for action-kind proposal execution.** Assert a confirmed action proposal executes only through `POST /proposals/{proposal_id}/execute`, produces one receipt with result/audit/outbox identifiers, rejects duplicate execution, and does not emit a success response when the audit/outbox writer fails.

- [ ] **Step 2: Run the tests and confirm the direct ActionType-only path fails the new contract.**

- [ ] **Step 3: Implement the single execution path.** Route action-kind execution through the same proposal executor, including the server-derived actor and proposal provenance. Keep the older direct apply endpoint only as a rejecting compatibility endpoint with a migration message; no route may bypass a confirmed proposal for a side effect.

- [ ] **Step 4: Run proposal, dedup, and action focused tests and confirm they pass.**

- [ ] **Step 5: Commit.** `feat(ontology): execute actions through proposal boundary`

## Task 5: Make the confirmation drawer display authoritative outcomes

**Files:**

- Modify: `metaplatform-frontend/apps/web/src/api/ont/kernel.ts`
- Modify: `metaplatform-frontend/apps/web/src/pages/ontology/components/ProposalConfirmDrawer.tsx`
- Modify: `metaplatform-frontend/apps/web/src/pages/ontology/hooks/useOntologyAssistant.ts`
- Create: `metaplatform-frontend/apps/web/src/pages/ontology/components/ProposalConfirmDrawer.test.tsx`

- [ ] **Step 1: Write failing component tests.** Verify the drawer shows ontology diff, relationship/impact proof, and server status; disables repeat clicks while a command is pending; refreshes the proposal after confirmation; shows the authoritative executed receipt; and shows a clear conflict/permission error without claiming success.

- [ ] **Step 2: Run the component test and confirm it fails against the current optimistic close flow.**

- [ ] **Step 3: Implement the smallest UI change.** Send an idempotency key per button action, fetch the proposal after every transition, render actor/time/audit/outbox receipt fields, and only invoke `onExecuted` after a returned `executed` state. Do not store proposal business data in `localStorage`.

- [ ] **Step 4: Run frontend unit tests and production build; confirm both pass.**

- [ ] **Step 5: Commit.** `feat(ontology-ui): show durable proposal outcomes`

## Task 6: Prove the real local acceptance journey

**Files:**

- Create: `metaplatform-frontend/apps/web/tests/e2e/ontology-proposal-dedup.spec.ts`
- Modify: `docker-compose.task5.yml`
- Modify: `docs/active/prd/APP-ONTSTUDIO/PRD-06-Ontology-Proposal_v1.0-20260831.md`
- Modify: `docs/active/prd/APP-ONTSTUDIO/PRD-07-Ontology-Dedup_v1.0-20260831.md`

- [ ] **Step 1: Write the Playwright journey before changing compose/docs.** Authenticate an ontology operator, create or load a merge proposal, inspect source/target semantic proof and impact counts, confirm, execute, reload, and assert the source is archived, the target owns the relationships, and the executed receipt is visible. Add a second-tenant request assertion through the API context.

- [ ] **Step 2: Run the journey and confirm it fails before the completed implementation.**

- [ ] **Step 3: Wire the Docker profile and test data.** Use the existing Task5 PostgreSQL-backed `mate-tech-ont` service only; add health checks and seeded source/target records needed by the test. Never add a memory fallback profile for acceptance.

- [ ] **Step 4: Run the journey twice.** The second run must show no duplicate data mutation and a stable execution receipt.

- [ ] **Step 5: Update the PRD evidence sections with current SHA, commands, and result links only after the tests pass.** Keep product approval distinct from implementation acceptance.

- [ ] **Step 6: Commit.** `test(ontology): prove proposal and dedup local acceptance`

## Final Verification

- [ ] Run `pytest` for `mate-tech-ont` proposal/dedup/persistence tests.
- [ ] Run `scripts/ci/task5_ontology_persistence_smoke.ps1` against the running Docker services.
- [ ] Run the frontend proposal component test and `pnpm build` from `metaplatform-frontend`.
- [ ] Run `npx playwright test tests/e2e/ontology-proposal-dedup.spec.ts` with the local acceptance profile.
- [ ] Inspect `git diff --check`, ensure only task files are staged, and preserve `PROXY`, `mate-platform-backend/.tmp/`, and `metaplatform-frontend/metaplatform-frontend/`.
