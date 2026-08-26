# Order Review Evidence Chain Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展订单复核建议页面，在人工确认前同时展示真实订单事实、规范 Ontology 关系图、可重放的条件推导和行动建议，并让服务端以同一提案快照约束确认操作。

**Architecture:** 订单复核服务读取 PostgreSQL 订单事实，通过 tech-ont 的规范 Order ObjectType 与订单复核 ActionType 构造 EvidenceBundle，在 ReviewCase 创建时保存快照，并由提案详情接口返回。React 页面只消费这个后端证据契约，使用现有 SemiGraphCanvas 渲染关系图；证据不可用或历史提案没有快照时，后端和前端都阻止确认。

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, httpx, pytest, Pydantic, React 19, TypeScript, Vite, Semi UI, SemiGraphCanvas, Playwright, Docker Compose。

**Spec:** docs/superpowers/specs/2026-08-26-order-review-evidence-bundle-design.md

## Global Constraints

- 产品范围是订单复核建议展示扩展；EvidenceBundle 仅是后端承载四类证据的接口封装，不扩展为全平台重构。
- schema_version 固定为 order-review-evidence.v1，不与平台对外版本号混用。
- PostgreSQL 是订单金额、支付状态、复核状态和版本的交易事实源；Ontology Kernel 是对象模型和动作定义的语义源。
- 图只展示交易事实锚点、规范 Order ObjectType 和规范订单复核 ActionType；不得调用通用 Copilot 图接口作为订单证据。
- 规范 RIDs 为 ont.{tenant_id}.obj.crm.order.v1 和 ont.{tenant_id}.act.order-review-confirm.v1；当前租户无法解析任一 RID 时证据不可用。
- ORDER_REVIEW_THRESHOLD_CENTS 默认值为 100000，金额比较使用整数分。
- 证据在提案创建时生成并保存；查询时不得基于订单当前状态重新生成证据。
- EvidenceBundle.status != complete、缺少证据快照、提案过期、订单版本不匹配、跨租户访问和依赖失败都不得执行确认。
- 认证使用当前请求的用户 Bearer Token 和经校验的 X-Tenant-Id；tech-ont 请求必须透传租户范围和认证上下文。
- 不使用 mock、echo、demo、localStorage 业务数据或静默 fallback；不得迁移既有验收数据。
- 保留现有 suggestion、source_refs、幂等、乐观锁、Outbox 和审计字段语义；来源列表由后端规范化为可核验引用。
- 不暂存或修改 PROXY、mate-platform-backend/.tmp/、metaplatform-frontend/metaplatform-frontend/ 和已有 Playwright artifacts。

---

### Task 1: 注册订单复核的规范 Ontology 动作并接通 Docker 服务发现

**Files:**
- Modify: mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/seed.py
- Modify: mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_seed.py
- Modify: docker-compose.yml
- Modify: docker-compose.task5.yml

**Interfaces:**
- Produces ObjectType ont.{tenant_id}.obj.crm.order.v1 and ActionType ont.{tenant_id}.act.order-review-confirm.v1.
- Produces action metadata with on=[ont.{tenant_id}.obj.crm.order.v1], title=订单复核确认, a decision parameter, and side effects update_order, create_follow_up_task, audit_log.
- Makes mate-tech-orchestrator call http://mate-tech-ont:8007 through ONT_HTTP_BASE and wait for the healthy Ontology service.

- [ ] **Step 1: Write the failing Ontology seed test**

Extend TestSeedDemo.test_seed_populates_scenario:

~~~python
assert created == 18
object_types = {item["rid"]: item for item in c.get("/api/v1/ont/v2/object-types").json()}
order_rid = "ont.tenant-default.obj.crm.order.v1"
assert order_rid in object_types
action_types = {item["rid"]: item for item in c.get("/api/v1/ont/v2/action-types").json()}
action_rid = "ont.tenant-default.act.order-review-confirm.v1"
assert action_types[action_rid]["on"] == [order_rid]
assert action_types[action_rid]["title"] == "订单复核确认"
assert action_types[action_rid]["side_effects"] == [
    "update_order", "create_follow_up_task", "audit_log",
]
~~~

- [ ] **Step 2: Run the seed test and verify it fails**

Run from mate-platform-backend:

~~~powershell
uv run pytest packages/mate-tech-ont/tests/integration/test_v2_kernel_seed.py::TestSeedDemo::test_seed_populates_scenario -q
~~~

Expected: FAIL because the current seed count is 16 and the order review ActionType is absent.

- [ ] **Step 3: Add the versioned ActionType and function seed**

In seed_demo, use the existing idempotent repository methods:

~~~python
order_rid = ClassRef("ont." + t + ".obj.crm.order.v1")
action_rid = ClassRef("ont." + t + ".act.order-review-confirm.v1")
repo.upsert_action_type(ActionType(
    rid=action_rid,
    parameters=(_prop("ont." + t + ".prop.decision.v1", "string", "decision"),),
    submission_criteria=("decision in (confirm, reject)",),
    side_effects=("update_order", "create_follow_up_task", "audit_log"),
    function_ref=ClassRef("ont." + t + ".fn.order-review-confirm.v1"),
    on=(order_rid,),
    title="订单复核确认",
    description="人工确认订单复核建议，更新订单并创建回款跟进单",
))
repo.upsert_function(_function_placeholder(t, "order-review-confirm.v1"))
created += 2
~~~

Do not create an Order Individual here; v1 uses the transaction anchor defined by the evidence contract.

- [ ] **Step 4: Run the seed test and verify it passes**

Run uv run pytest packages/mate-tech-ont/tests/integration/test_v2_kernel_seed.py -q. Expected: all seed tests PASS, including the second invocation returning 0.

- [ ] **Step 5: Add service discovery and commit**

Add the following mapping to mate-tech-orchestrator in both Compose files, retaining existing dependencies:

~~~yaml
environment:
  ONT_HTTP_BASE: http://mate-tech-ont:8007
depends_on:
  mate-tech-ont:
    condition: service_healthy
~~~

Run docker compose -f docker-compose.yml -f docker-compose.task5.yml config, git diff --check, then commit only the four listed paths with git commit -m "feat: register order review ontology action".

### Task 2: Build the deterministic order-review evidence domain

**Files:**
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/__init__.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/evidence.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review_evidence.py

**Interfaces:**
- Produces OrderReviewFacts, OntologyContract, OrderReviewEvidenceBuilder, EvidenceUnavailable and EVIDENCE_SCHEMA_VERSION.
- OrderReviewEvidenceBuilder.build(*, facts: OrderReviewFacts, contract: OntologyContract, requested_suggestion: dict[str, Any], now: datetime) -> dict[str, Any] returns the JSON-serializable EvidenceBundle.
- The builder accepts only a fact snapshot and a verified Ontology contract; it never reads browser state or calls the generic Copilot graph endpoint.

- [ ] **Step 1: Write failing builder tests**

Use a tenant-default order with amount 250000, payment unpaid, review status pending, version 1, and the two canonical RIDs. Assert:

~~~python
bundle = builder.build(facts=facts, contract=contract, requested_suggestion={}, now=now)
assert bundle["schema_version"] == "order-review-evidence.v1"
assert bundle["status"] == "complete"
assert {node["type"] for node in bundle["ontology"]["graph"]["nodes"]} == {
    "transaction_anchor", "object_type", "action_type",
}
assert {edge["label"] for edge in bundle["ontology"]["graph"]["edges"]} == {
    "符合对象模型", "支持动作",
}
assert {fact["id"] for fact in bundle["data"]["facts"]} == {
    "fact.amount_cents", "fact.payment_status", "fact.review_status", "fact.version",
}
assert all(item["passed"] for item in bundle["derivation"])
assert bundle["recommendation"]["action"] == "follow_up_payment"
~~~

- [ ] **Step 2: Run the test and verify it fails**

Run uv run pytest packages/mate-tech-orchestrator/tests/test_order_review_evidence.py -q. Expected: FAIL because the module and builder do not exist.

- [ ] **Step 3: Define immutable inputs and validation**

Implement in evidence.py:

~~~python
EVIDENCE_SCHEMA_VERSION = "order-review-evidence.v1"

@dataclass(frozen=True)
class OrderReviewFacts:
    tenant_id: str
    order_id: str
    amount_cents: int
    payment_status: str
    review_status: str
    version: int
    updated_at: datetime

@dataclass(frozen=True)
class OntologyContract:
    object_type: dict[str, Any]
    action_type: dict[str, Any]

class EvidenceUnavailable(RuntimeError):
    pass
~~~

Require exact tenant-scoped ObjectType and ActionType RIDs, action on containing the ObjectType RID, and a non-empty action title. Raise EvidenceUnavailable for malformed or mismatched contracts.

- [ ] **Step 4: Implement facts, graph, derivation and recommendation**

Emit facts with integer value, formatted display_value, and database source. Emit threshold, unpaid, and eligible derivations; the first two reference fact.amount_cents and fact.payment_status, while eligible references both condition IDs. Use graph IDs order-fact-anchor:{order_id}, object-type:{object_rid}, action-type:{action_rid} and edge IDs order-instance-of-model, model-supports-action. Include a legend saying the anchor is not a persisted Ontology Individual.

Use the following recommendation shape only when eligible passes:

~~~python
{
    "action": "follow_up_payment",
    "title": "创建回款跟进单",
    "reason": f"订单金额 {format_amount(facts.amount_cents)} 且当前未支付，建议人工确认后创建回款跟进单。",
    "requires_confirmation": True,
    "derivation_refs": ["eligible"],
    "source_refs": [
        f"ontology://object-type/{object_rid}",
        f"ontology://action-type/{action_rid}",
        "policy://payment-follow-up-policy",
    ],
}
~~~

Do not use the requested suggestion to select an action or overwrite facts. Copy a supplied numeric confidence only as explanatory metadata when it is between 0 and 1; it must not affect eligibility.

- [ ] **Step 5: Add boundary tests and commit**

Test amounts 99999, 100000, and 100001, both payment states, both review states, wrong tenant RIDs, missing action metadata and a version 7 snapshot. Assert the threshold is inclusive, ineligible inputs raise EvidenceUnavailable, and version 7 is preserved. Run the focused pytest and Ruff commands, git diff --check, then commit the three listed paths with git commit -m "feat: build order review evidence bundle".

### Task 3: Connect tech-ont, persist the snapshot, and protect confirmation

**Files:**
- Create: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/order_review/ontology_catalog.py
- Create: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review_ontology_catalog.py
- Modify: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/repositories/order_review.py
- Modify: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review.py

**Interfaces:**
- OrderReviewOntologyCatalog.get_contract(*, tenant_id: str, token: str) -> OntologyContract performs authenticated GETs against canonical ObjectType and ActionType paths.
- OrderReviewService.__init__(..., evidence_builder: OrderReviewEvidenceBuilder | None = None, ontology_catalog: OrderReviewOntologyCatalog | None = None) keeps injection seams for SQLite tests and uses the HTTP catalog by default.
- OrderReviewService.create_review_case(..., auth_token: str = "") creates a proposal only after a complete bundle is built.
- _proposal_dict returns evidence from persisted suggestion.evidence_bundle.

- [ ] **Step 1: Write failing catalog tests**

Mock the two GETs with the repository’s respx/httpx style. Assert every request includes X-Tenant-Id, includes the Bearer token, uses exact canonical RIDs, and returns an OntologyContract. Assert a 404 or malformed RID raises a catalog error.

Run uv run pytest packages/mate-tech-orchestrator/tests/test_order_review_ontology_catalog.py -q; expected result is FAIL because the catalog module does not exist.

- [ ] **Step 2: Implement the authenticated catalog**

Implement a sync httpx.Client using ONT_HTTP_BASE with default http://localhost:8007; URL-encode each RID path segment, set X-Tenant-Id on every request, set Authorization: Bearer {token} when supplied, require 2xx JSON responses, and validate returned RIDs. Provide a close method for tests.

- [ ] **Step 3: Write failing service tests**

Inject a fake catalog into OrderReviewService, create an order and case, then assert:

~~~python
proposal = service.get_proposal(tenant_id="tenant-acme", proposal_id=proposal_id)
assert proposal["evidence"]["status"] == "complete"
assert proposal["evidence"]["order_version"] == 1
assert proposal["suggestion"]["evidence_bundle"] == proposal["evidence"]
~~~

Add tests that catalog failure creates no case/proposal, an old proposal without evidence_bundle raises EvidenceRequired from confirmation, and no follow-up or extra Outbox event is created.

- [ ] **Step 4: Integrate creation and snapshot persistence**

In create_review_case, read the tenant-scoped order, convert it to OrderReviewFacts, resolve the catalog contract, and build the bundle. Open the existing database transaction, reread the order, compare amount, payment status, review status and version, and raise VersionConflict if any changed. Store the bundle under suggestion["evidence_bundle"], normalize source_refs from the recommendation, and return proposal metadata plus top-level evidence. Do not add a database column.

- [ ] **Step 5: Guard confirmation and add auditable references**

Add EvidenceUnavailable and EvidenceRequired service exceptions. Before existing side-effect writes, require a complete bundle, matching expected order version, and recommendation.requires_confirmation is True. Add evidence_schema_version, fact IDs, graph node IDs and order version to proposal-created, confirmed and rejected event payloads; do not place the full graph in events.

- [ ] **Step 6: Run backend tests and commit**

Run the catalog and order-review test files plus Ruff and git diff --check; commit only the four listed paths with git commit -m "feat: persist order review evidence snapshot". Existing confirmation, idempotency, version-conflict, tenant-isolation and rejection tests must remain green.

### Task 4: Expose the evidence contract through FastAPI and OpenAPI

**Files:**
- Modify: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/order_review.py
- Modify: mate-platform-backend/packages/mate-tech-orchestrator/src/mate_tech_orchestrator/api/schemas.py
- Modify: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review.py
- Modify: mate-platform-backend/contracts/openapi/services/orchestrator.yaml

**Interfaces:**
- ReviewCase creation forwards the current Bearer token and returns evidence.
- Proposal detail returns ActionProposal.evidence with the design schema.
- EvidenceUnavailable maps to HTTP 503 and X-Error-Code: evidence_unavailable; EvidenceRequired maps to HTTP 409 and X-Error-Code: evidence_required.
- OpenAPI declares EvidenceBundle, OntologyEvidence, EvidenceGraph, EvidenceFact, EvidenceDerivation, EvidenceData and EvidenceRecommendation and references EvidenceBundle from ActionProposal.

- [ ] **Step 1: Write failing HTTP and contract assertions**

Extend the HTTP flow test to assert the create and GET responses contain evidence.status, ontology.graph, data.facts, derivation and recommendation. Add an unavailable-catalog test expecting status 503 and the exact error header.

- [ ] **Step 2: Forward auth and map errors**

Extract only the Bearer credential from Request, pass it to the service, and add explicit mappings for the two evidence exceptions while preserving existing error mappings.

- [ ] **Step 3: Define response schemas and OpenAPI**

Add Pydantic models in schemas.py with Literal status/type fields. The model shape must be equivalent to:

~~~python
class EvidenceFact(BaseModel):
    id: str
    field: str
    label: str
    value: Any
    display_value: str
    source: str

class EvidenceBundle(BaseModel):
    schema_version: Literal["order-review-evidence.v1"]
    status: Literal["complete", "unavailable"]
    proposal_id: str
    order_id: str
    tenant_id: str
    order_version: int
    captured_at: str
    ontology: dict[str, Any]
    data: dict[str, Any]
    derivation: list[dict[str, Any]]
    recommendation: dict[str, Any]
~~~

Update orchestrator.yaml with the same names and required fields. The EvidenceBundle schema must require schema_version, status, proposal_id, order_id, tenant_id, order_version, captured_at, ontology, data, derivation and recommendation. Document the 503 creation response and evidence-required 409 confirmation response.

- [ ] **Step 4: Run verification and commit**

Run the order-review pytest file, contracts/tests/test_docs_compose.py, Ruff for changed Python files and git diff --check; commit the four listed paths with git commit -m "feat: expose order review evidence contract".

### Task 5: Extend the React order-review evidence experience

**Files:**
- Create: metaplatform-frontend/apps/web/src/pages/superai/components/OrderReviewEvidence.tsx
- Modify: metaplatform-frontend/apps/web/src/api/superai/orderReview.ts
- Modify: metaplatform-frontend/apps/web/src/pages/superai/OrderReviewPage.tsx
- Modify: metaplatform-frontend/tests/e2e/order-review.spec.ts

**Interfaces:**
- OrderReviewEvidence consumes ActionProposal.evidence and never fetches data.
- ActionProposal exposes evidence?: EvidenceBundle; old proposals remain viewable but cannot be confirmed.
- Required test IDs are review-evidence, ontology-node-order-model, ontology-node-review-action, ontology-edge-order-model, review-fact-amount, review-fact-payment-status, review-derivation-threshold, review-derivation-eligible and review-recommendation.

- [ ] **Step 1: Extend types and write failing Playwright assertions**

Add TypeScript interfaces matching OpenAPI. The core types must have this shape:

~~~ts
export interface EvidenceFact {
  id: string;
  field: string;
  label: string;
  value: unknown;
  display_value: string;
  source: string;
}

export interface EvidenceBundle {
  schema_version: 'order-review-evidence.v1';
  status: 'complete' | 'unavailable';
  proposal_id: string;
  order_id: string;
  tenant_id: string;
  order_version: number;
  captured_at: string;
  ontology: { source: string; model_rid: string; action_rid: string; graph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> }; legend: Record<string, string> };
  data: { source: string; captured_at: string; facts: EvidenceFact[] };
  derivation: Array<{ id: string; label: string; passed: boolean; fact_refs?: string[]; details?: Record<string, unknown> }>;
  recommendation: { action: string; title: string; reason: string; confidence?: number; requires_confirmation: boolean; derivation_refs: string[]; source_refs: string[] };
}
~~~

Add golden-path assertions for the evidence wrapper, order model, action, 支持动作, ¥2,500.00, 未支付, both passing derivations and 创建回款跟进单. Run the test and verify it fails because the response type and DOM regions do not exist.

- [ ] **Step 2: Implement the evidence component**

Create OrderReviewEvidence.tsx with SemiGraphCanvas and fixed positions for the three v1 nodes. Convert backend nodes and edges without changing IDs or labels. Render a left Ontology 关系图 with legend, right 订单事实证据 table, then 推导过程 and 行动建议. Display captured_at and order_version; show structured unavailable state without a graph fallback.

- [ ] **Step 3: Replace the flat proposal card**

In OrderReviewPage.tsx, render the component, remove page-generated reason/confidence/Ontology/RAG proof text, and use only server evidence for the current proposal. Show 历史提案无证据快照 when evidence is absent. Enable confirmation only when status is pending, evidence status is complete and requires_confirmation is true. Preserve rejection, result, refresh and alert behavior.

- [ ] **Step 4: Run UI checks**

Run from metaplatform-frontend:

~~~powershell
$env:E2E_GATEWAY_URL = 'http://127.0.0.1:8100/api/v1'
pnpm exec playwright test tests/e2e/order-review.spec.ts --project=web
pnpm --filter @mate/web typecheck
pnpm --filter @mate/web build
~~~

Expected: the real Docker-backed order-review path and all frontend checks pass.

- [ ] **Step 5: Add negative UI states and commit**

Add route fixtures for a proposal without evidence and one with status="unavailable"; assert the explicit error state is visible and 确认执行 is disabled. Keep fixtures limited to negative UI-state tests. Run the targeted Playwright suite and git diff --check, then commit the four listed paths with git commit -m "feat: show order review evidence chain".

### Task 6: Run system-level acceptance in the local Docker environment

**Files:**
- Modify: none unless a directly related verification failure identifies a defect.
- Test: mate-platform-backend/packages/mate-tech-ont/tests/integration/test_v2_kernel_seed.py
- Test: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review_evidence.py
- Test: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review_ontology_catalog.py
- Test: mate-platform-backend/packages/mate-tech-orchestrator/tests/test_order_review.py
- Test: metaplatform-frontend/tests/e2e/order-review.spec.ts

**Interfaces:** Verifies AppHub → /superai/order-review → real order → tech-ont contract → evidence graph/data/derivation → human confirmation → order writeback/follow-up/Outbox/Audit.

- [ ] **Step 1: Rebuild required services**

Run docker compose -f docker-compose.yml -f docker-compose.task5.yml up -d --build mate-tech-ont mate-tech-orchestrator mate-api-gateway, then check the health endpoints at ports 8007, 8505 and 8100.

- [ ] **Step 2: Verify runtime RIDs**

With an authenticated tenant-default request, GET the canonical ObjectType and ActionType through the gateway. Assert the returned RIDs, action title, target Order RID and side effects match Task 1. If the old seed set is returned, rebuild tech-ont before continuing.

- [ ] **Step 3: Run backend regression checks**

Run from mate-platform-backend:

~~~powershell
uv run pytest packages/mate-tech-ont/tests/integration/test_v2_kernel_seed.py packages/mate-tech-orchestrator/tests/test_order_review_evidence.py packages/mate-tech-orchestrator/tests/test_order_review_ontology_catalog.py packages/mate-tech-orchestrator/tests/test_order_review.py -q
uv run pytest tests/architecture tests/entrypoints -q
uv lock --check
~~~

Expected: all targeted backend, architecture, entrypoint and lock checks pass.

- [ ] **Step 4: Run real Playwright acceptance**

Run from metaplatform-frontend with E2E_GATEWAY_URL=http://127.0.0.1:8100/api/v1:

~~~powershell
pnpm exec playwright test tests/e2e/order-review.spec.ts --project=web
~~~

Expected: AppHub entry, graph, facts, derivation, recommendation, confirmation, order version, follow-up task and no-API-failure assertions pass.

- [ ] **Step 5: Perform final repository verification**

Run git diff --check, git status --short --branch and git log --oneline -6. Confirm only the pre-existing untracked paths remain and no untracked file was staged. Do not push as part of this plan.

## Execution Notes

- Each task ends with a focused commit so a later failure leaves earlier verified work intact.
- If a targeted test fails, keep preceding commits and fix the related contract or implementation before continuing.
- Do not bypass a missing Ontology ActionType by changing the graph node to action_contract; the selected v1 extension requires a registered ActionType.
- Full Customer/Payment/Product Ontology instance synchronization remains outside this extension.
