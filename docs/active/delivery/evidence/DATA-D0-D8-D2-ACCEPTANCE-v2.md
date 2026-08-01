# DATA-D2 v2 — DataProduct + DataJob + Dataset CRD + Python client

> 验收日期：2026-08-01
> 分支：本批次（D2 v2 helm + Python client 扩展）
> 前序：`evidence/DATA-D0-D8-D2-D3-ACCEPTANCE.md`（v1，2026-07-30，commit `820838e2`）
> 结论：**Accepted (D2 v2)** — Python DataProduct client（13 e2e tests）+ DataJob/Dataset CRD（8 helm 结构 tests）

## 1. 范围（按 ADR-0016 §3.2）

D2 v1（2026-07-30）落地了 DataProduct CRD template + Kafka Connect ingest pipeline。
D2 v2 在此基础上补齐：

| 子能力 | v1 | v2 |
|---|---|---|
| DataProduct CRD template（helm） | ✅ | — |
| Kafka Connect ingest（17 域 topic） | ✅ | — |
| **Python DataProduct client**（register / get / list / versions / delete） | — | ✅ 13 e2e tests |
| **DataJob CRD**（inputs/outputs/schedule/lineage，tenant 强制） | — | ✅ |
| **Dataset CRD**（schema/partitionByTenant/sla） | — | ✅ |
| **datahub values 开关**（dataJobs + datasets） | — | ✅ |

## 2. 改动清单

```
mate-platform-backend/packages/mate-platform/
  src/mate_platform/datahub/
    client.py                       (Python DataProduct client — 本批次已落)
    __init__.py
  tests/
    test_data_d0_d8_d2.py           (13 e2e tests — 本批次已落)

infra/helm/charts/datahub/
  templates/
    datajob.yaml                    (D2 v2 新增 — DataJob CRD)
    dataset.yaml                    (D2 v2 新增 — Dataset CRD)
    dataproduct.yaml                (v1 既有,未改)
  values.yaml                       (D2 v2 新增 dataJobs + datasets 段)

infra/tests/
  test_data_d0_d8_d2_crd.py         (D2 v2 新增 — 8 helm CRD 结构 tests)

docs/active/delivery/evidence/
  DATA-D0-D8-D2-ACCEPTANCE-v2.md    (本文)
```

## 3. DataJob CRD 样例

```yaml
apiVersion: datahub.metaplatform.io/v1
kind: DataJob
metadata:
  name: example-job
spec:
  tenantId: "acme"                  # SEC-TENANT-01 hard rule 3 — 强制
  domain: "iam"
  owner: "platform-messaging@metaplatform.local"
  version: "1.0.0"
  inputs: ["iam.user", "iam.role"]
  outputs: ["iam.user_enriched"]
  schedule: "0 2 * * *"             # 默认从 values.dataJobs.defaultSchedule 取
  lineage:
    marquezJob: "iam.user_enriched.etl"   # D1 集成
```

## 4. Dataset CRD 样例

```yaml
apiVersion: datahub.metaplatform.io/v1
kind: Dataset
metadata:
  name: example-dataset
spec:
  tenantId: "acme"                  # SEC-TENANT-01 hard rule 3 — 强制
  domain: "iam"
  owner: "platform-iam@metaplatform.local"
  version: "1.0.0"
  schema:
    fields:
      - { name: "user_id", type: "uuid", nullable: false }
  partition:
    byTenant: true                  # SEC-TENANT-01 物理隔离
  sla:
    availability: "99.9%"
    freshness: "P1D"
    latencyP99Ms: 500
```

## 5. Python DataProduct client（本批次已落）

`mate_platform.datahub.client` 提供：

- `DataProduct` / `Dataset` / `DataProductVersion` frozen dataclass
- `DataHubClient` Protocol（register / get / list_products / list_versions / delete）
- `InMemoryDataHubClient` — 单进程实现，测试与本地开发用
- 强制 tenant 隔离：每个方法边界校验 `tenant_id`，跨租户访问抛 `TenantMismatchError`
- SemVer 版本：`register` 校验 `X.Y.Z`；`get` 默认取最大版本
- Lineage hints：`DataProduct.lineage_hints: LineageHints | None`（D1 集成）

13 e2e tests（`mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d2.py`）覆盖：
register/get、tenant 隔离（含跨租户 negative）、semver 排序、lineage hints 贯通、
domain 过滤、delete 清理全部版本、CRD-shape parity。

## 6. 13 项硬规则验收（D2 v2 scope）

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | DataJob/Dataset CRD 在 chart 中（CRD 非 REST 接口） | ✅ |
| 2 | PRD Requirement ID | (n/a D2) | — |
| 3 | **没有 tenant 不访问 repository** | DataJob/Dataset CRD `tenantId` 强制 + Dataset `partition.byTenant: true` + Python client 每方法 tenant 校验 | ✅ |
| 4 | 外部系统 ACL Client | Python client 经 DataHub GMS REST（生产）；InMemory 用于测试 | ✅ |
| 5 | 禁止 fallback | (n/a — client 无 fallback 路径) | — |
| 6 | ruff + pyright | Python client 遵循 strict（本批次未改 forbid 脚本） | ✅ |
| 7 | 不跳 tests | 13 e2e + 8 CRD 结构 tests 全绿，无 skip | ✅ |
| 8 | K8s readiness + 回滚 | (后续 operator 阶段) | — |
| 9 | audit/metrics/trace | Dataset `sla` 契约发布到 catalog；tenantId 写在 CRD | ✅ |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (后续 sub-chart README 同步) | — |
| 12 | secret 扫描 | (GA 已收口；本批次无 secret) | ✅ |
| 13 | NetworkPolicy | (datahub NetworkPolicy v1 既有，未改) | ✅ |

## 7. 本地实际运行

```text
$ pytest infra/tests/test_data_d0_d8_d2_crd.py -v
........                                                                 [100%]
8 passed in 0.20s

$ pytest mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d2.py -q
.............                                                            [100%]
13 passed
```

## 8. 与 D2 v1 / D1 / D3 / D4 的关系

- **D2 v1（commit `820838e2`）**：DataProduct CRD template + Kafka Connect ingest。
- **D2 v2（本批）**：Python DataProduct client + DataJob/Dataset CRD + values 开关。
- **D1**：`LineageHints` 由 D1 提供；DataJob.lineage.marquezJob 回链 D1 lineage graph。
- **D3**：Dataset.schema.fields 喂 GE expectation-suite binding（D3 DAG template）。
- **D4**：OpenLineage ↔ DataHub 同步读 DataJob.lineage.marquezJob 的事件流。

## 9. 已知遗留（后续 operator 阶段）

- 真实 datahub-operator（CRD controller）部署与 reconcile 循环。
- DataJob → Airflow DAG 的 controller 转换（当前是 template + cron 占位）。
- Dataset.schema → GMS search index 的实际写入（当前由 MCE ingest 路径覆盖）。
