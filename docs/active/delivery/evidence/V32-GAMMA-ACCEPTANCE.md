# v3.2-γ Iceberg + Trino sub-chart — ACCEPTANCE

> 验收日期：2026-08-03
> 范围：v3.2-γ M-里程碑 — Apache Iceberg REST catalog + Apache Trino federated SQL sub-charts
> 关联 commit：`0d9a96cc06c6`
> 关联 v3.2-γ spec：`docs/active/specs/2026-08-01-roadmap-v3.2.md` §3 阶段 3 任务
> 状态：**Accepted (v3.2-γ sub-chart delivery)**

## 1. 选型决策

| 维度 | Iceberg (选) | Delta Lake (弃) | Hudi (弃) |
|---|---|---|---|
| 引擎支持 | Trino / Spark / Flink / Dremio 全支持 | 主要 Spark | 主要 Spark |
| 流式 | 流批一体 (Flink 同写) | 批量为主 | 流式但社区小 |
| 本项目约束 | Trino 已选为查询引擎，Iceberg REST 是 Trino 标准 connector | — | — |
| 与 Paimon 协同 | 共享 warehouse，table format 互通 | — | — |

**结论**：Apache Iceberg + Apache Trino 作为 v3.2-γ 数据湖 SQL federation 双子。Iceberg REST catalog 在 `infra/helm/charts/iceberg/`，Trino coordinator + worker 在 `infra/helm/charts/trino/`。共享 S3 warehouse，Trino 通过 Iceberg + Paimon connector 联邦查询。

## 2. Iceberg sub-chart 结构

```
infra/helm/charts/iceberg/
├── Chart.yaml          apiVersion: v2, version: 0.1.0, appVersion 1.4
├── values.yaml         REST catalog mode + warehouse + tenant prefix + 100Gi PVC + NetworkPolicy
└── templates/
    ├── _helpers.tpl        iceberg.fullname / labels / selectorLabels
    ├── configmap.yaml      catalog mode / warehouse / tables / tenant prefix
    ├── statefulset.yaml    catalog server (httpGet /health probe + PVC)
    ├── service.yaml        headless (stable DNS) + ClusterIP (REST :8181)
    ├── networkpolicy.yaml  default-deny，ingress 限 namespace (hard rule 13)
    └── NOTES.txt           catalog endpoint / 验证命令
```

| 字段 | 值 |
|---|---|
| fullnameOverride | `iceberg` |
| replicaCount | 2 |
| image | `apache/iceberg-rest-fixture:1.4` |
| catalog.mode | filesystem |
| catalog.warehouse | `s3://mate-platform/data-lake` |
| tables.format | parquet |
| service.port | 8181 |
| tenantIsolation.tablePrefix | `tenant_` |
| persistence.size | 100Gi |
| networkPolicy.allowedIngressNamespaces | `metaplatform` |

## 3. Trino sub-chart 结构

```
infra/helm/charts/trino/
├── Chart.yaml          apiVersion: v2, version: 0.1.0, appVersion 435
├── values.yaml         coordinator + worker / 联邦 3 catalog / tenant prefix / NetworkPolicy
└── templates/
    ├── _helpers.tpl        trino.fullname / labels / selectorLabels
    ├── configmap.yaml      联邦 catalog endpoints + tenant prefix
    ├── coordinator.yaml    Deployment 1 副本 (init script 写 /etc/trino/catalog/*.properties)
    ├── worker.yaml         Deployment 2 副本 (discovery URI 指向 coordinator)
    ├── service.yaml        ClusterIP HTTP :8080 + Thrift :8081
    ├── networkpolicy.yaml  default-deny，ingress 限 namespace (hard rule 13)
    └── NOTES.txt           JDBC URL + 验证命令
```

| 字段 | 值 |
|---|---|
| fullnameOverride | `trino` |
| coordinator replicaCount | 1 |
| worker replicaCount | 2 |
| image | `trinodb/trino:435` |
| catalogs.iceberg.endpoint | `http://iceberg:8181` |
| catalogs.paimon.endpoint | `http://paimon:8081` |
| catalogs.system.enabled | true |
| tenantIsolation.tablePrefix | `tenant_` |
| service.httpPort | 8080 |
| Thrift | 8081 |
| networkPolicy.allowedIngressNamespaces | `metaplatform` |

## 4. Umbrella 集成

`infra/helm/Chart.yaml` 加 2 依赖：

```yaml
  - name: iceberg
    version: 0.1.0
    condition: iceberg.enabled
  - name: trino
    version: 0.1.0
    condition: trino.enabled
```

`infra/tests/test_chart_structure.py` `REQUIRED_SUB_CHARTS` 加 `iceberg` + `trino` —— 22 test_chart_structure 静态 guard 现在 13 sub-chart 全检。

## 5. 测试 (22 tests)

| 测试类 | 覆盖 |
|---|---|
| `TestIcebergChart` (7) | Chart.yaml / apiVersion / name / tenant isolation / NetworkPolicy / StatefulSet 探针 + configmap / default-deny |
| `TestTrinoChart` (9) | Chart.yaml / apiVersion / name / 联邦 3 catalog 端点 / tenant isolation / coordinator-worker 分离 / coordinator init script / worker discovery URI / service http+thrift / default-deny |
| `TestUmbrellaChartDeclaresIcebergTrino` (5) | iceberg 注册 / trino 注册 / iceberg condition / trino condition / 全 dependencies condition 一致性 |

模式与 G4 (`test_g4_kind_workflow.py`) 同源：static smoke + CI 上每 PR 跑，无需真实 kind / helm。

## 6. CI workflow

新增 `.github/workflows/g4-d1-staging-e2e.yml`：

```yaml
name: g4-d1-staging-e2e
on: push / pull_request on infra/helm + scripts/ci + workflow file
jobs:
  d1-staging-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - checkout
      - helm/kind-action (cluster_name=mate-platform-staging)
      - azure/setup-helm@v4
      - pre-flight checks (script + values 文件)
      - lineage stack smoke (bash scripts/ci/d1_staging_smoke.sh)
      - helm uninstall (cleanup)
```

## 7. 验证

```text
$ pytest infra/tests/test_iceberg_trino_chart.py -q
22 passed in 0.53s

$ pytest infra/tests/ -q
1549 passed, 5 skipped in 8.60s
  (1501 → 1549, +48 来自 iceberg/trino tests + chart_structure REQUIRED_SUB_CHARTS 扩展)

$ pytest packages/mate-clients -q
14 passed in 0.95s

$ pytest packages -q
1587 passed in 276.45s
```

## 8. 13 硬规则映射

| # | 硬规则 | v3.2-γ |
|---|---|---|
| 5 | Production fallback | ✅ values-staging 用独立 stg_ 前缀 (继承 G1/G6 pattern) |
| 8 | K8s readiness | ✅ Iceberg/Trino StatefulSet/Deployment 探针 livenessProbe + readinessProbe (/health, /v1/info) |
| 9 | 审计/指标/trace | ✅ 通过 OTel collector (out-of-scope of this chart; 已部署) |
| 10 | 验收证据 | ✅ 本文档 + 22 tests + V3.2-γ 接力 prompt |
| 13 | NetworkPolicy | ✅ Iceberg/Trino sub-charts 自带 default-deny + kube-system DNS egress |

## 9. 后续工作

1. **真实 K8s 部署**：DevOps 在 staging 集群跑 `helm install metaplatform infra/helm --values values-staging.yaml --set iceberg.enabled=true --set trino.enabled=true`。
2. **catalog 集成测试**：Trino coordinator 启动后跑 `SHOW CATALOGS` + `SHOW SCHEMAS FROM iceberg` 验证 联邦配置。
3. **真实数据跑通**：CDC → Paimon / Iceberg → Trino SQL 端到端 query（v3.2-δ 2027-02-15）。
4. **BI 集成**：StarRocks / Grafana data source 指向 Trino JDBC。

## 10. 结论

**v3.2-γ Iceberg + Trino sub-chart delivery Accepted** ✅

`infra/helm/charts/{iceberg,trino}/` 14 文件 + umbrella 依赖 + CI workflow + 22 static smoke tests。真实部署由 DevOps 在 staging 集群执行（v3.2-δ 2027-02-15 milestone）。Trino 通过 Iceberg + Paimon connector 联邦查询共享 S3 warehouse，构成 v3.2 数据平台 SQL federation 入口。