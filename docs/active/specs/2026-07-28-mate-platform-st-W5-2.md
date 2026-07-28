# W5-2 子任务卡（ST）：tech-obs（可观测）

> **源任务卡**：[tasks-W5.md § W5-2](./2026-07-27-mate-platform-tasks-W5.md#w5-2-tech-obs可观测10-张-tc)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S5-S6（2026-08-31 ~ 2026-09-13）
> **里程碑**：M3
> **ST 总数**：20（拆解自 10 个 TC） — 2026-07-28 完成 20 ST (100%) ✅
> **粒度**：0.5-4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [TC-5.2.1 OTel SDK 集成（2 ST）](#tc-521-otel-sdk-集成2-st)
- [TC-5.2.2 自动 instrument（2 ST）](#tc-522-自动-instrument2-st)
- [TC-5.2.3 自定义 span（2 ST）](#tc-523-自定义-span2-st)
- [TC-5.2.4 Prometheus exporter（2 ST）](#tc-524-prometheus-exporter2-st)
- [TC-5.2.5 Loki 日志聚合（2 ST）](#tc-525-loki-日志聚合2-st)
- [TC-5.2.6 Tempo trace 存储（2 ST）](#tc-526-tempo-trace-存储2-st)
- [TC-5.2.7 Grafana 仪表盘（3 ST）](#tc-527-grafana-仪表盘3-st)
- [TC-5.2.8 告警规则（2 ST）](#tc-528-告警规则2-st)
- [TC-5.2.9 健康检查聚合（2 ST）](#tc-529-健康检查聚合2-st)
- [TC-5.2.10 OpenAPI + 文档（1 ST）](#tc-5210-openapi--文档1-st)
- [完成度检查表](#完成度检查表)

---
### TC-5.2.1 OTel SDK 集成（2 ST）

#### ST-5.2.1.1 libs/observability 包初始化 + init_tracing()

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.1 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | libs/observability/pyproject.toml、src/observability/tracing.py |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(obs): otel sdk |

**改动清单**：
1. uv init --package observability
2. 加 opentelemetry-sdk、opentelemetry-exporter-otlp
3. `def init_tracing(service_name: str)`：配置 TracerProvider + OTLP exporter

**DoD**：
- [ ] pyright strict 通过

---

#### ST-5.2.1.2 hello app 启动后 trace 推 Tempo

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.1 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | apps/hello/src/hello/main.py |
| 前置 ST | ST-5.2.1.1 |
| 输出 commit | feat(hello): otel init |

**改动清单**：
1. main.py 加 init_tracing("hello")
2. 加一个 trace span

**DoD**：
- [ ] Tempo 收到 hello 的 trace

---
### TC-5.2.2 自动 instrument（2 ST）

#### ST-5.2.2.1 自动 instrument 配置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.2 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | libs/observability/src/observability/instrument.py |
| 前置 ST | TC-5.2.1 |
| 输出 commit | feat(obs): auto-instr |

**改动清单**：
1. 加 opentelemetry-instrumentation-{fastapi,httpx,sqlalchemy,aiokafka,psycopg}
2. `def auto_instrument(app)`：批量启动

**DoD**：
- [ ] 5 个 instrument 启动

---

#### ST-5.2.2.2 trace 中 http/db/mq span 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.2 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | apps/hello/tests/test_instrument.py |
| 前置 ST | ST-5.2.2.1 |
| 输出 commit | test(obs): auto-instr spans |

**改动清单**：
1. 启 hello，调一个 PG + 一个 Kafka
2. 验证 trace 含 http/db/mq span

**DoD**：
- [ ] 3 类 span 可见

---
### TC-5.2.3 自定义 span（2 ST）

#### ST-5.2.3.1 @traced() 装饰器

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/observability/src/observability/decorators.py |
| 前置 ST | TC-5.2.1 |
| 输出 commit | feat(obs): traced decorator |

**改动清单**：
1. `@traced("kb.search")`：自动 start_as_current_span
2. 支持业务字段属性

**DoD**：
- [ ] 装饰器可用

---

#### ST-5.2.3.2 业务属性注入 + trace 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | libs/observability/tests/test_traced.py |
| 前置 ST | ST-5.2.3.1 |
| 输出 commit | test(obs): traced attrs |

**改动清单**：
1. 用例：装饰一个函数，验证 span 含 `kb.kb_id` 属性

**DoD**：
- [ ] 业务属性正确

---
### TC-5.2.4 Prometheus exporter（2 ST）

#### ST-5.2.4.1 每个 app /metrics 暴露

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.4 |
| 工时 | 1.5h | 角色 | DevOps |
| 目标文件 | libs/observability/src/observability/metrics.py |
| 前置 ST | TC-5.2.1 |
| 输出 commit | feat(obs): metrics exporter |

**改动清单**：
1. 加 prometheus-client
2. `/metrics` 端点 + 默认 metrics（request_count、latency、in_flight）

**DoD**：
- [ ] /metrics 暴露

---

#### ST-5.2.4.2 Prometheus 抓 9 app 数据验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.4 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | tests/test_metrics_scrape.py |
| 前置 ST | ST-5.2.4.1 |
| 输出 commit | test(obs): prom scrape |

**改动清单**：
1. 9 app 全部起
2. Prometheus 抓取

**DoD**：
- [ ] 9 app 抓得到

---
### TC-5.2.5 Loki 日志聚合（2 ST）

#### ST-5.2.5.1 docker-compose 加 Promtail + Loki

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.5 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | docker-compose.yml |
| 前置 ST | TC-2.1.6 |
| 输出 commit | feat(obs): loki compose |

**改动清单**：
1. 加 `grafana/loki:2.9.0`、`grafana/promtail:2.9.0`
2. promtail config 抓 docker stdout

**DoD**：
- [ ] Loki + Promtail 容器 healthy

---

#### ST-5.2.5.2 Grafana Explore 跨 app 日志搜索

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.5 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | docs/runbooks/observability.md |
| 前置 ST | ST-5.2.5.1 |
| 输出 commit | docs(obs): loki usage |

**改动清单**：
1. runbook：Grafana → Explore → Loki 数据源
2. 搜索 `{app="kb"}` 验证

**DoD**：
- [ ] 跨 app 日志搜索

---
### TC-5.2.6 Tempo trace 存储（2 ST）

#### ST-5.2.6.1 docker-compose 加 Tempo + OTLP

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.6 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | docker-compose.yml、infra/tempo.yaml |
| 前置 ST | TC-2.1.6 |
| 输出 commit | feat(obs): tempo compose |

**改动清单**：
1. 加 `grafana/tempo:2.4.0`
2. OTLP 接收器（端口 4317）

**DoD**：
- [ ] Tempo 容器 healthy

---

#### ST-5.2.6.2 trace 存 7 天验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.6 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | infra/tempo.yaml |
| 前置 ST | ST-5.2.6.1 |
| 输出 commit | feat(obs): tempo retention |

**改动清单**：
1. retention 配置：`compactor.block_retention=168h`

**DoD**：
- [ ] 7 天 retention 工作

---
### TC-5.2.7 Grafana 仪表盘（3 ST）

#### ST-5.2.7.1 Grafana datasource 配 Prometheus + Loki + Tempo

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.7 |
| 工时 | 1.5h | 角色 | DevOps |
| 目标文件 | infra/grafana/datasources.yaml |
| 前置 ST | TC-5.2.4 ~ TC-5.2.6 |
| 输出 commit | feat(obs): grafana datasources |

**改动清单**：
1. provisioning 3 个 datasource

**DoD**：
- [ ] datasources 自动加载

---

#### ST-5.2.7.2 4 个核心仪表盘（请求量/延迟/错误率/队列深度）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.7 |
| 工时 | 1.5h | 角色 | DevOps |
| 目标文件 | infra/grafana/dashboards/core/*.json |
| 前置 ST | ST-5.2.7.1 |
| 输出 commit | feat(obs): core dashboards |

**改动清单**：
1. 请求量 / 延迟 / 错误率 / 队列深度 dashboard
2. JSON 格式可导入

**DoD**：
- [ ] 4 dashboard 可导入

---

#### ST-5.2.7.3 4 个 infra 仪表盘（PG/Milvus/JVM/Traefik）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.7 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | infra/grafana/dashboards/infra/*.json |
| 前置 ST | ST-5.2.7.2 |
| 输出 commit | feat(obs): infra dashboards |

**改动清单**：
1. PG dashboard（连接数、慢查询）
2. Milvus dashboard（p99、qps）
3. JVM dashboard（heap、gc）
4. Traefik dashboard（rps、状态码分布）

**DoD**：
- [ ] Grafana http://localhost:3000 可访问

---
### TC-5.2.8 告警规则（2 ST）

#### ST-5.2.8.1 10 条 alert rules YAML

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.8 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | infra/prometheus/alerts.yaml |
| 前置 ST | TC-5.2.4 |
| 输出 commit | feat(obs): alerts |

**改动清单**：
1. 5xx > 1%
2. p95 > 1s
3. PG 连接打满
4. Milvus p99 > 100ms
5. （共 10 条）

**DoD**：
- [ ] rules 加载成功

---

#### ST-5.2.8.2 alertmanager 收到 + 静默规则

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.8 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | docker-compose.yml、infra/alertmanager.yaml |
| 前置 ST | ST-5.2.8.1 |
| 输出 commit | feat(obs): alertmanager |

**改动清单**：
1. 加 alertmanager 容器
2. 静默规则可配

**DoD**：
- [ ] alertmanager 收到测试 alert

---
### TC-5.2.9 健康检查聚合（2 ST）

#### ST-5.2.9.1 /api/v1/obs/health 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.9 |
| 工时 | 1.5h | 角色 | DevOps |
| 目标文件 | apps/tech-obs/src/tech_obs/health.py |
| 前置 ST | TC-5.2.4 |
| 输出 commit | feat(obs): health aggregator |

**改动清单**：
1. 9 个 app + 7 个基础设施健康检查
2. 并发执行 + 汇总

**DoD**：
- [ ] 端点返回 OK/DEGRADED/DOWN

---

#### ST-5.2.9.2 任一 down → 整体 down + 明细

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.9 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | apps/tech-obs/tests/test_health.py |
| 前置 ST | ST-5.2.9.1 |
| 输出 commit | test(obs): health aggregator |

**改动清单**：
1. mock 一个 app 返回 500
2. 验证整体 down + 明细列出

**DoD**：
- [ ] 失败聚合正确

---
### TC-5.2.10 OpenAPI + 文档（1 ST）

#### ST-5.2.10.1 openapi/paths/obs.yaml + runbook

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.2.10 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | openapi/paths/obs.yaml、docs/runbooks/observability.md |
| 前置 ST | TC-5.2.9 |
| 输出 commit | docs(obs): openapi+runbook |

**改动清单**：
1. openapi 同步
2. docs/runbooks/observability.md

**DoD**：
- [ ] swagger-ui 列出
- [ ] runbook 完整

---

## W5-2 完成度检查表

| 子领域 | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|
| W5-2 tech-obs | 否 | 10 | 20 | ~30h | 🟢 20/20 完成 (100%) ✅ |

---

## Sprint S5 排程

| 时段 | 重点 ST | 工时 |
|---|---|---|
| S5 D1 | ST-5.2.1.1 → ST-5.2.1.2 + ST-5.2.2.1 → ST-5.2.2.2 | 6h |
| S5 D2 | ST-5.2.3.1 → ST-5.2.3.2 + ST-5.2.4.1 → ST-5.2.4.2 | 4h |
| S5 D3 | ST-5.2.5.1 → ST-5.2.5.2 + ST-5.2.6.1 → ST-5.2.6.2 | 6h |
| S5 D4 | ST-5.2.7.1 → ST-5.2.7.3 + ST-5.2.8.1 → ST-5.2.8.2 | 6h |
| S5 D5 | ST-5.2.9.1 → ST-5.2.9.2 + ST-5.2.10.1 | 4h |

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W5-2 TC（10 条）拆出 ST（20 条） | 单回合执行避免 Token 超限 |