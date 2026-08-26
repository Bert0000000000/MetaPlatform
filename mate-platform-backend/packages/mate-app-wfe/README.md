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

The current WFE endpoints still expose the existing flow-definition and BPMN
validation surface. Wiring `/workflows/{definition_id}/runs`, approval
signals, and the real worker is the next implementation slice; no production
request is allowed to silently use the current in-memory path.

## P2-W5 scope

In-memory BPMN structural validator only. Real Flowable 8.0 engine
integration lands in P2-W6.
