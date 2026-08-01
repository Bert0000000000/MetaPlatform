# mate-tech-data

Data platform control plane for Mate Platform — CDC task management + data source
management (FR-DATA-001..015).

## Endpoints

15 endpoints under `/api/v1/data/*`:

**CDC tasks (8):**
- `GET /cdc-tasks` — list (paginated, optional `status` filter)
- `POST /cdc-tasks` — create
- `GET /cdc-tasks/{id}` — detail
- `PUT /cdc-tasks/{id}` — update
- `DELETE /cdc-tasks/{id}` — delete
- `POST /cdc-tasks/{id}/pause` — pause
- `POST /cdc-tasks/{id}/resume` — resume
- `GET /cdc-tasks/{id}/status` — status

**Data sources (7):**
- `GET /sources` — list (paginated, optional `type` filter)
- `POST /sources` — create
- `GET /sources/{id}` — detail
- `PUT /sources/{id}` — update
- `DELETE /sources/{id}` — delete
- `GET /sources/{id}/schema` — discover schema
- `POST /sources/{id}/test` — test connection

Plus an anonymous `GET /health` liveness probe.

## Architecture

Follows the ADR-0014 5-step integration pattern:

1. `install_auth(app)` in `create_app()` — bearer-token middleware
2. `require_tenant(ctx)` as the first line of every handler — tenant guard
3. Write handlers emit `data.<aggregate>.<verb>` outbox events
4. `AsyncDataClient` reserved for real CDC engine integration (Debezium/Flink)
5. Cross-tenant negative tests in `tests/test_app_data_tenant_integration.py`

P2-W6 ships an in-memory stub repository; real CDC engine integration lands in a
later batch.
