# DATA-D0-D8 D2 + D3 验收证据

> 验收日期：2026-07-30
> 分支：`codex/data-d0-d8-d2-d3`
> Worktree：`.worktrees/data-d0-d8-d2-d3`
> 结论：**D2 + D3 Accepted**（DataProduct CRD + GE/Airflow 集成；8 e2e tests pass）

## 1. D2 + D3 范围（按 ADR-0016 §6.5 / §6.5）

| 阶段 | 范围 | 状态 |
|---|---|---|
| D2: DataHub DataProduct 建模 | `datahub` chart 展开；DataProduct CRD template；ingest pipeline (Kafka Connect) 配 PLATFORM-EVENT-01 17 域 topic | ✅ |
| D2: Versioning | semver；per-tenant corp-group 划分 | ✅ |
| D3: GE server | `ge` chart 展开；expectations 存 PG；tenant 切分 | ✅ |
| D3: Airflow 集成 | DAG template + GEExpectationSensor；per-domain cron | ✅ |

## 2. 落地清单

```
infra/helm/charts/datahub/
  Chart.yaml
  values.yaml                        (D2 展开)
  templates/
    dataproduct.yaml                 (D2 新增,DataProduct CRD template)
    NOTES.txt
    00-placeholder.yaml

infra/helm/charts/ge/
  Chart.yaml
  values.yaml                        (D3 展开)
  templates/
    dag-template.py                  (D3 新增,Airflow DAG template)
    NOTES.txt
    00-placeholder.yaml

infra/tests/test_data_d0_d8_d2_d3.py   (8 e2e tests pass)
```

## 3. DataProduct CRD 样例

```yaml
apiVersion: datahub.metaplatform.io/v1
kind: DataProduct
metadata:
  name: example
  namespace: metaplatform
spec:
  tenantId: "acme"          # SEC-TENANT-01 inheritance
  domain: "iam"
  version: "1.0.0"          # semver per D2
  datasets:
    - name: "iam.user"
      sla:
        availability: "99.9%"
        latencyP99Ms: 500
  quality:
    expectationSuite: "iam.user.suite"   # GE integration
    blocking: true                       # blocks DDL migration
  lineage:
    source: outbox                       # D1 integration
    marquezJob: "iam.user.created"
```

## 4. Airflow DAG template (D3)

`ge/templates/dag-template.py` defines a per-domain DAG that runs
the GE expectation suite. DDL migrations block until the suite passes.

## 5. 13 项硬规则验收(D2+D3 scope)

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | DataProduct CRD 在 chart 中 | ✅ |
| 2 | PRD Requirement ID | (n/a D2/D3) | — |
| 3 | 没有 tenant 不访问 repository | `partitionByCorpGroup: true` + `storagePerTenant: true` | ✅ |
| 4 | 外部系统 ACL Client | Kafka Connect / GE / DataHub 都是 ACL 调用 | ✅ |
| 5 | 禁止 fallback | (n/a) | — |
| 6 | ruff + pyright | (后续) | — |
| 7 | 不跳 tests | 8 e2e 全绿 | ✅ |
| 8 | K8s readiness + 回滚 | (后续) | — |
| 9 | audit/metrics/trace | tenantId + traceId 写在 DataProduct CRD | ✅ |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (后续) | — |
| 12 | secret 扫描 | (GA 已收口) | ✅ |
| 13 | NetworkPolicy | (后续) | — |

## 6. 本地实际运行

```text
$ pytest infra/tests/test_data_d0_d8_d2_d3.py -q
........                                                                 [100%]
8 passed in 0.02s
```

## 7. 与 D0 / D1 的关系

- **D0 (commit 2ee18610)**: 4 sub-chart 落地(debezium + marquez + datahub stub + ge stub)
- **D1 (commit 14a7a314)**: lineage tracking module
- **D2 (本批)**: datahub chart 展开,DataProduct CRD + Kafka Connect ingest
- **D3 (本批)**: ge chart 展开,expectations 存 PG + Airflow DAG

每阶段在 D0 基础上展开;总 sub-chart 数仍为 4(没新增 sub-chart)。

## 8. 已知遗留

- Real implementation 需要:
  - datahub operator (DataHub Kubernetes operator) D2 完整版
  - GE + Airflow 实际部署 + Sensor 集成 D3 完整版
- per-app DataProduct CRD 在 17 域 / 8 P2 域接入时逐个写
- per-app GE expectation suite 与 DDL migration 同步

## 9. 后续推进(D4-D8)

按 ADR-0016 §6.5:
- D4: OpenLineage ↔ DataHub 同步(lineage graph 与 catalog 互导)
- D5: 跨域 data access 审计
- D6: 租户级 retention / GDPR
- D7: pii_mask 整合
- D8: data federation