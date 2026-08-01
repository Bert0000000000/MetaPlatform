# mate-tech-scheduler

DAG scheduling control plane for the Mate Platform data plane
(`FR-DATA-SCHEDULER-001..008`).

## Endpoints

8 endpoints under `/api/v1/scheduler/*`:

| Method | Path                       | Description                          |
|--------|----------------------------|--------------------------------------|
| GET    | `/tasks`                   | List scheduler tasks (paginated)     |
| POST   | `/tasks`                   | Create a scheduler task              |
| GET    | `/tasks/{id}`              | Get a scheduler task by id           |
| PUT    | `/tasks/{id}`              | Update a scheduler task              |
| DELETE | `/tasks/{id}`              | Delete a scheduler task              |
| POST   | `/tasks/{id}/pause`        | Pause a scheduler task               |
| POST   | `/tasks/{id}/trigger`      | Manually trigger a scheduler task    |
| GET    | `/dag`                     | Get the DAG graph                    |
| GET    | `/health`                  | Anonymous liveness probe             |

## ADR-0014 5-step compliance

1. **install_auth** — `mate_platform.auth.install_auth(app, extra_anonymous_paths={"/api/v1/scheduler/health"})` in `main.py`.
2. **require_tenant** — every handler calls `_tid(request)` which wraps `require_tenant(ctx)`.
3. **Outbox events** — write handlers emit `scheduler.task.<verb>` events via `app.state.outbox_writer`.
4. **ACL Client** — `AsyncSchedulerClient` reserved in `clients.py` for the real scheduler engine (Airflow / DolphinScheduler / Dagster) integration.
5. **Tenant tests** — `tests/test_app_scheduler_tenant_integration.py` covers cross-tenant 403/404/400.

## Run tests

```bash
uv run pytest packages/mate-tech-scheduler/tests -p no:cacheprovider -v
```

## Status

P2-W7 in-memory stub. Real scheduler engine integration lands in a later batch
of the v3.1 DATA-D0-D8 track.
