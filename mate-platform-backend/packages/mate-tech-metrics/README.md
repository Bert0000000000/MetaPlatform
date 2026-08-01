# mate-tech-metrics

Data metrics control plane — CRUD + compute/lineage/values (FR-DATA-METRICS-001..008).

## Endpoints (8)

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/metrics | List metrics (paginated) |
| POST | /api/v1/metrics | Create metric |
| GET | /api/v1/metrics/{id} | Get metric detail |
| PUT | /api/v1/metrics/{id} | Update metric |
| DELETE | /api/v1/metrics/{id} | Delete metric |
| POST | /api/v1/metrics/{id}/compute | Trigger manual compute |
| GET | /api/v1/metrics/{id}/lineage | Get metric lineage |
| GET | /api/v1/metrics/{id}/values | Get metric values |

## ADR-0014 5-step compliance

1. `install_auth(app)` in `create_app()` first line
2. `require_tenant(ctx)` in every handler via `_tid(request)`
3. Write handlers emit `metrics.metric.<verb>` outbox events
4. `AsyncMetricsClient` reserved for real OLAP engine integration (Doris/ClickHouse)
5. 6 cross-tenant negative tests in `test_app_metrics_tenant_integration.py`
