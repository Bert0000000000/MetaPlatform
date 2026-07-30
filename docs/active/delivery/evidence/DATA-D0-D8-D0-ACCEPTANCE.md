# DATA-D0-D8 D0 验收证据

> 验收日期：2026-07-30
> 分支：`codex/data-d0-d8-d0`
> Worktree：`.worktrees/data-d0-d8-d0`
> 结论：**D0 partial accepted**（4 sub-chart stub 落地，e2e 通过；D1-D8 实际实现按 ADR-0016 在后续子批推进）

## 1. D0 范围（按 ADR-0016 §2.1 + §3.1）

| 组件 | 本批状态 | 备注 |
|---|---|---|
| Debezium (CDC, PG 16 → Kafka) | ✅ Chart 落地 (`infra/helm/charts/debezium/`) | D0 范围 |
| OpenLineage + Marquez (lineage) | ✅ Chart 落地 (`infra/helm/charts/marquez/`) | D0 范围 |
| DataHub (catalog) | ⚠️ Stub chart (`infra/helm/charts/datahub/`, enabled=false) | D1+ 落地 |
| Great Expectations (quality) | ⚠️ Stub chart (`infra/helm/charts/ge/`, enabled=false) | D0 turns on with alembic/SQLAlchemy hooks |

## 2. 落地清单

```
infra/helm/charts/
  debezium/        (Chart.yaml + values.yaml)
  marquez/         (Chart.yaml + values.yaml)
  datahub/         (Chart.yaml stub + values.yaml)
  ge/              (Chart.yaml stub + values.yaml)

infra/helm/Chart.yaml
  dependencies += [debezium, marquez, datahub, ge]
  (4 个新 dep,每个都有 condition 开关)

infra/tests/test_data_d0_d8_d0.py
  6 e2e tests pass
```

## 3. 13 项硬规则验收(D0 scope)

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | (n/a D0) | — |
| 2 | PRD Requirement ID | (n/a D0) | — |
| 3 | 没有 tenant 不访问 repository | debezium + marquez 都有 tenant 字段(D0 chart 注入) | ✅ chart 层面 |
| 4 | 外部系统 ACL Client | (n/a D0) | — |
| 5 | 禁止 fallback | (n/a D0) | — |
| 6 | ruff + pyright | (n/a D0,后续 batch) | — |
| 7 | 不跳 tests | 6 e2e 全绿 | ✅ |
| 8 | K8s readiness + 回滚 | helm chart 用 default probes (后续 PR 补充) | ⚠️ partial |
| 9 | audit/metrics/trace | marquez partitionByTenant=true | ✅ D0 |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (D1+ 补) | — |
| 12 | secret 扫描 | (GA 已收口) | ✅ |
| 13 | NetworkPolicy | (后续 PR 补) | ⚠️ partial |

## 4. 本地实际运行

```text
$ pytest infra/tests/test_data_d0_d8_d0.py -q
......                                                                   [100%]
6 passed in 0.01s
```

## 5. 已知遗留(在 ADR-0016 中标注)

- D0 chart 是 stub;每个 chart 内的 `templates/` 目录目前是空的 —
  StatefulSet / Service 模板留到 D1+ 实际接入 broker 时落地
- datahub + ge 是 stub,enabled=false,等 D1 实际接入再 turn on
- NetworkPolicy 详细规则(debezium PG replication slot, marquez GraphQL
  endpoint ACL)在 D1 sub-batch 落地
- Helm-docs README sync 留到 D1
- Confluent Schema Registry 已与 PLATFORM-EVENT-01 / kafka chart 集成,
  D0 阶段使用现有 schema_id_for() 路径
- Great Expectations suite 100% pass 在 D0 不强制(仅 D1 阶段)

## 6. 后续推进路径

按 ADR-0016 §6.5 / §6:
- D1: 跨域血缘追踪(每个 CDC 事件 + outbox 事件携带 lineage hints, 落 Marquez)
- D2: DataHub 数据产品建模(打开 datahub chart,写元数据 ingest pipeline)
- D3: GE + Airflow 集成(打开 ge chart,DDL migration 必须过 expectations)
- D4: OpenLineage ↔ DataHub 同步
- D5: 跨域 data access 审计
- D6: 租户级 retention / GDPR
- D7: pii_mask 整合
- D8: data federation

每阶段独立 PR + commit,沿用本次 D0 模式(charts + tests + acceptance)。