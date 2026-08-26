# mate-app-wfe

> Mate Platform - APP-WFE workflow engine center (FR-WFE-001..002).

## Endpoints

| Method | Path | operationId | FR |
|---|---|---|---|
| POST | `/api/v1/wfe/flows/test` | `wfePostWfeFlowsTest` | FR-WFE-WFEPOSTWFEFLOWSTEST |
| GET  | `/api/v1/wfe/flows/validate` | `wfeGetWfeFlowsValidate` | FR-WFE-WFEGETWFEFLOWSVALIDATE |

## ADR-0014 5-step compliance

- **Step 1**: `install_auth(app)` in `create_app()` first line.
- **Step 2**: `_tid(request)` helper (`require_tenant`).
- **Step 3**: `POST /flows/test` emits `wfe.flow.tested` outbox event.
- **Step 4**: `AsyncFlowableClient` reserved (P2-W6 wires `BearerAuth`).
- **Step 5**: `test_app_wfe_tenant_integration.py` cross-tenant negatives.

## Workflow execution boundary

`mate_platform.workflow` is the backend-neutral boundary for the GA
workflow contract. `Plan` and `WorkflowRun` are stable public models; the
Temporal workflow id, namespace, task queue, and query names are adapter
details and are not part of the frontend contract.

Development/local acceptance defaults to the explicit in-memory executor:

```text
MATE_PROFILE=development
MATE_WORKFLOW_BACKEND=local
```

Staging and production must use Temporal and fail during startup when the
address is missing or the backend is set to `local`:

```text
MATE_PROFILE=staging|production
MATE_WORKFLOW_BACKEND=temporal
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=mate-platform
```

`PlanWorkflow` and `build_temporal_worker()` now provide the real Temporal
worker boundary. A workflow with a confirmation step pauses at
`waiting_approval`; `mate.workflow.confirm` and `mate.workflow.reject` are
the only approval signals. The worker requires an injected real
`ActionExecutor` and fails closed when it is absent.

The production worker composition root is
`mate_app_wfe.worker_main:run_worker`. It initializes the configured database,
constructs the order-review `ActionExecutor`, connects to Temporal, and runs
until shutdown. Start it as a separate worker process:

```bash
python -m mate_app_wfe.worker_main
```

The current supported action is `order_review_confirm`. Its Temporal activity
payload must contain the tenant in the envelope and a `proposal_id` in the
step input. When no explicit idempotency key is provided, the adapter derives
one from the Temporal `run_id` and step id, so activity replay cannot create a
second follow-up task or duplicate Outbox events. The adapter uses the
transactional order-review service and never returns a synthetic success.

The current WFE endpoints still expose the existing flow-definition and BPMN
validation surface in addition to `/workflows/{definition_id}/runs`; no
production request is allowed to silently use the current in-memory path.

## P2-W5 scope

In-memory BPMN structural validator only. Real Flowable 8.0 engine
integration lands in P2-W6.
