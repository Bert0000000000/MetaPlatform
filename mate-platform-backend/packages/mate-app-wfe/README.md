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

## P2-W5 scope

In-memory BPMN structural validator only. Real Flowable 8.0 engine
integration lands in P2-W6.
