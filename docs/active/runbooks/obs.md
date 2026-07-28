# mate-tech-obs Runbook (ST-5.2.10/11/12)

## 概述

Mate Platform Observability 聚合服务（OTel + Prometheus + Loki + Tempo）。

## 启动

```bash
cd packages/mate-tech-obs
uv run --package mate-tech-obs python -m mate_tech_obs.main
```

## 端点

| Method | Path | 说明 |
|---|---|---|
| GET | /healthz | 健康检查 |
| GET | /metrics | Prometheus 指标（text/plain） |
| GET | /api/v1/obs/health | 9 apps + 7 infra 健康聚合 |
| GET | /api/v1/obs/instrument | OTel 自动 instrument 状态 |

## 默认监控目标

**9 apps**: portal, dashboard, ontstudio, kb, mcphub, apphub, arch, dw, superai
**7 infra**: postgres, redis, kafka, neo4j, milvus, minio, keycloak

## OTel

- **SDK 初始化**: `init_tracing(service_name)`
- **自动 instrument**: `auto_instrument(app)` — FastAPI + httpx + aiokafka
- **自定义 span**: `@traced("name")` 装饰器
- **OTLP exporter**: `OTEL_EXPORTER_OTLP_ENDPOINT` env

## Prometheus 指标

- `http_requests_total{method, endpoint, status}` (Counter)
- `http_request_duration_seconds{method, endpoint}` (Histogram)
- `http_requests_in_flight{method, endpoint}` (Gauge)

## 告警（10 条）

| 严重度 | Alert | PromQL 摘要 |
|---|---|---|
| 🔴 critical | Http5xxRate | 5xx > 1% for 5m |
| 🔴 critical | PgConnectionPoolFull | 连接池 > 90% |
| 🔴 critical | AppDown | up == 0 for 1m |
| 🟡 warning | HttpP95Latency | p95 > 1s |
| 🟡 warning | MilvusP99Latency | p99 > 100ms |
| 🟡 warning | KafkaConsumerLag | lag > 10000 |
| 🟡 warning | LlmErrorRate | LLM > 5% |
| 🟡 warning | RagRecallFailure | 检索 > 0.1/s |
| 🟡 warning | DiskSpaceLow | < 10% |
| 🟡 warning | MemoryHigh | > 90% |

## Grafana 仪表盘（8 个）

- `core/request_volume.json` — 请求量
- `core/latency.json` — p95 延迟
- `core/error_rate.json` — 5xx 错误率
- `core/top_endpoints.json` — Top 10 端点
- `infra/pg.json` — PG 连接数
- `infra/milvus.json` — Milvus search p99
- `infra/jvm.json` — JVM heap
- `infra/traefik.json` — Traefik RPS

## 故障排查

| 现象 | 排查 |
|---|---|
| /metrics 空 | 检查 `prometheus_client` import |
| OTel 不上报 | 检查 `OTEL_EXPORTER_OTLP_ENDPOINT` |
| 9 apps down | 检查 K8s/Docker 服务 |
| 告警不触发 | 检查 `infra/prometheus/alerts.yaml` 已加载 |
| 健康聚合 200 但 overall=False | 检查 `_check_endpoint` 5xx 阈值 |