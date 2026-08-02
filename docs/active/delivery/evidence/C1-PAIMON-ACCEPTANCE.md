# C1-PAIMON-ACCEPTANCE — Apache Paimon sub-chart 落地

> 状态：**Accepted** (C1 Paimon sub-chart)
> 日期：2026-08-02
> 关联：`docs/active/decisions/ADR-0016-business-slices.md` · `2026-08-02-v3.2-parallel-prompts.md` W1 Week2
> PROGRAM-BOARD 项：C1 Apache Paimon helm sub-chart 部署

---

## 1. 选型决策：Apache Paimon

| 维度 | Paimon（选） | Iceberg（弃） | Delta Lake（弃） |
|---|---|---|---|
| 流式写入 | 原生 Flink streaming sink，CDC 直达 | 需额外适配 | 批量为主 |
| Iceberg 兼容 | 兼容（table format 互通） | — | 不兼容 |
| CDC 集成 | Debezium → Paimon 一跳入湖 | 需 Iceberg sink | 需 Delta sink |
| 表格式 | orc / parquet | parquet | parquet |
| 本项目约束 | D0 Debezium CDC 已落地，Paimon 作为存储层衔接最短 | 额外 sink 适配 | 额外 sink 适配 |

**结论**：Apache Paimon 作为流式数据湖存储层，filesystem mode + S3 warehouse。
REST catalog server 为 Flink / Spark table store 提供统一元数据入口。

## 2. sub-chart 结构

```
infra/helm/charts/paimon/
├── Chart.yaml          apiVersion: v2, version: 0.1.0, appVersion: 0.8
├── values.yaml         C1 默认值（2 副本 / 100Gi PVC / 1Gi·500m / tenantIsolation）
├── README.md           values 表 + 架构图 + CDC 路径 + 硬规则映射
└── templates/
    ├── _helpers.tpl        paimon.fullname / labels / selectorLabels
    ├── statefulset.yaml    catalog server（httpGet /health probe + PVC）
    ├── service.yaml        headless（stable DNS）+ ClusterIP（REST :8081）
    ├── configmap.yaml      catalog 配置（mode / warehouse / CDC / tenant）
    ├── networkpolicy.yaml  default-deny，ingress 限 namespace（hard rule 13）
    └── NOTES.txt           部署后提示（catalog endpoint / CDC / 验证命令）
```

## 3. CDC 集成路径

```
PostgreSQL ──▶ Debezium (D0) ──▶ Kafka (mate.cdc.*) ──▶ Paimon lake tables
                                  CDC topics             tenant_isolated
```

- D0 Debezium connector（`mate-platform-debezium`）从 PostgreSQL 逻辑复制槽
  捕获变更事件，写入 Kafka topic（前缀 `mate.cdc.`）。
- Paimon CDC sink 消费这些 topic，物化为数据湖表。
- 每个 tenant 独立表前缀（`tenant_<tenant_id>.<domain>.<table>`），
  在 catalog 层面隔离（SEC-TENANT-01）。

## 4. C1 关键配置

| 配置 | 默认值 | 说明 |
|---|---|---|
| `replicaCount` | 2 | catalog server 副本数 |
| `catalog.mode` | filesystem | filesystem \| hive \| jdbc |
| `catalog.warehouse` | s3://mate-platform/data-lake | S3 数据湖根路径 |
| `persistence.enabled` | true | 100Gi PVC（local override=emptyDir）|
| `resources.requests` | 500m / 1Gi | 资源请求 |
| `tables.autoCreate` | true | 自动创建湖表 |
| `tables.formats` | [orc, parquet] | 支持的表格式 |
| `tables.retention.days` | 90 | 表保留窗口（天）|
| `cdc.enabled` | true | CDC 集成开启 |
| `cdc.debeziumConnector` | mate-platform-debezium | 对接的 Debezium connector |
| `cdc.topics.prefix` | mate.cdc. | CDC Kafka topic 前缀 |
| `tenantIsolation.enabled` | true | 每个 tenant 独立表前缀 |
| `tenantIsolation.tablePrefix` | tenant_ | 表 = tenant_\<tid\>.\<domain\>.\<table\> |

## 5. umbrella 集成

- `infra/helm/Chart.yaml` dependencies 含 `paimon`（version 0.1.0, condition
  `paimon.enabled`）。
- `infra/helm/values.yaml`：`paimon.enabled: true` + C1 完整配置块。

## 6. 验收

### 静态测试（pytest）

```
infra/tests/test_c1_paimon_chart.py — 7 tests
```

- `test_paimon_chart_exists` — Chart.yaml 文件存在 + appVersion 0.8
- `test_paimon_chart_has_catalog` — values 有 catalog.mode（filesystem）
- `test_paimon_chart_has_persistence` — values 有 persistence.enabled
- `test_paimon_chart_has_cdc_integration` — values 有 cdc.enabled
- `test_paimon_chart_has_tenant_isolation` — values 有 tenantIsolation.enabled
- `test_paimon_chart_has_networkpolicy` — networkpolicy.yaml 存在 + default-deny
- `test_umbrella_includes_paimon` — umbrella Chart.yaml dependencies 包含 paimon

### helm lint / helm template（CI 覆盖）

`helm lint` + `helm template` + `kubeconform` 由 CI job 覆盖。

## 7. 硬规则映射

| 硬规则 | C1 闭环 |
|---|---|
| §13 #8（K8s readiness + 回滚）| StatefulSet liveness/readiness probe（httpGet /health）+ PVC volumeClaimTemplates |
| §13 #13（NetworkPolicy 缺失=prod 不通过）| default-deny Ingress+Egress，限 metaplatform namespace |
| §13 #3（tenant 上下文）| tenantIsolation.enabled + 表前缀约定 |

## 8. 状态

**Accepted** — C1 Paimon sub-chart 落地完成。
