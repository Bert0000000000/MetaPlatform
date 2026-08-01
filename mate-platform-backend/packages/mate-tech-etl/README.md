# mate-tech-etl

ETL task control plane — tasks CRUD + run/stop/status (FR-DATA-ETL-001..008).

## Endpoints (8)

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/etl/tasks | List ETL tasks (paginated) |
| POST | /api/v1/etl/tasks | Create ETL task |
| GET | /api/v1/etl/tasks/{id} | Get ETL task detail |
| PUT | /api/v1/etl/tasks/{id} | Update ETL task |
| DELETE | /api/v1/etl/tasks/{id} | Delete ETL task |
| POST | /api/v1/etl/tasks/{id}/run | Run ETL task |
| GET | /api/v1/etl/tasks/{id}/status | Get ETL task status |
| POST | /api/v1/etl/tasks/{id}/stop | Stop ETL task |

## ADR-0014 5-step compliance

1. `install_auth(app)` in `create_app()` first line
2. `require_tenant(ctx)` in every handler via `_tid(request)`
3. Write handlers emit `etl.task.<verb>` outbox events
4. `AsyncEtlClient` reserved for real ETL engine integration (Spark/Flink/Airflow)
5. 6 cross-tenant negative tests in `test_app_etl_tenant_integration.py`
