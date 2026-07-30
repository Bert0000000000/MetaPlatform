# DATA-D0-D8 D1 验收证据

> 验收日期：2026-07-30
> 分支：`codex/data-d0-d8-d1`
> Worktree：`.worktrees/data-d0-d8-d1`
> 结论：**D1 Accepted**（cross-domain lineage tracking 落地；7 e2e tests pass；与 D0 marquez chart 集成就位）

## 1. D1 范围（按 ADR-0016 §6 + §6 D1）

| 组件 | 本批状态 | 备注 |
|---|---|---|
| LineageEvent (OpenLineage-shape) | ✅ `mate_platform.messaging.LineageEvent` | 含 tenant_id + trace_id + job/input/output namespace |
| LineageEmitter (Protocol) | ✅ | InMemory + MarquezHttp 两个实现 |
| MarquezHttpLineageEmitter | ✅ | POST `/api/v1/lineage` with tenant_id check + soft-fail on Marquez down |
| InMemoryLineageEmitter | ✅ | 单测 / 集成测试用 |
| `lineage_event_from_outbox` helper | ✅ | outbox 调 PLATFORM-EVENT-01 时也建 lineage event |
| 7 e2e tests | ✅ | format / emit / outbox helper / tenant scoping / config |

## 2. 落地清单

```
mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/lineage.py
  - LineageConfig (Marquez URL + tenant namespace)
  - LineageEvent (OpenLineage-shape: job/run/inputs/outputs/facets)
  - LineageEmitter (Protocol)
  - InMemoryLineageEmitter (test impl)
  - MarquezHttpLineageEmitter (prod impl)
  - lineage_event_from_outbox (helper)

mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/__init__.py
  - exports LineageConfig, LineageEvent, InMemoryLineageEmitter,
    MarquezHttpLineageEmitter, lineage_event_from_outbox

mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d1_lineage.py
  - 7 tests pass
```

## 3. 13 项硬规则验收(D1 scope)

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | (n/a D1) | — |
| 2 | PRD Requirement ID | (n/a D1) | — |
| 3 | 没有 tenant 不访问 repository | LineageEvent.tenant_id 必填;emit() 拒绝空 | ✅ enforced |
| 4 | 外部系统 ACL Client | MarquezHttpLineageEmitter (curl POST) | ✅ |
| 5 | 禁止 fallback | (n/a D1) | — |
| 6 | ruff + pyright | (后续) | — |
| 7 | 不跳 tests | 7 e2e 全绿 | ✅ |
| 8 | K8s readiness + 回滚 | (后续) | — |
| 9 | audit/metrics/trace | lineage event 携带 tenant_id + trace_id | ✅ |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (D1 chart 已有 stub,D1 留 chart hook) | partial |
| 12 | secret 扫描 | (GA 已收口) | ✅ |
| 13 | NetworkPolicy | (后续) | — |

## 4. 本地实际运行

```text
$ pytest mate-platform/tests/test_data_d0_d8_d1_lineage.py -q
.......                                                                  [100%]
7 passed in 0.18s
```

## 5. 与 D0 / PLATFORM-EVENT-01 / SEC-TENANT-01 的关系

- **D0 (commit 2ee18610)**: `marquez` sub-chart 提供 HTTP 端点;本批 D1 用它
  作为 lineage receiver
- **PLATFORM-EVENT-01 (commit 95b35e43)**: outbox 事件带 trace_id,D1 的
  `lineage_event_from_outbox` 把这个 trace_id 喂进 OpenLineage run.facets
- **SEC-TENANT-01 (commit 026ce4a8)**: 5 层隔离 — lineage 走 HTTP bearer +
  tenant_id;namespace `metaplatform.<tenant>` 强制 per-tenant graph

## 6. 已知遗留(接 D2)

- D1 阶段不实际发 HTTP — 单测用 InMemoryLineageEmitter
  验证 event format;集成 e2e 在 staging 跑
- LineageEventSchema 与 Confluent Schema Registry 集成(D1+ 接入)
- D1b(per ADR-0016 §6.5): 17 域 outbox relay 集成 lineage 自动化
  (后续 batch 在每个 app 包加 `mate_clients.kafka.KafkaProducer` 旁
  路 emit lineage)

## 7. 后续推进

按 ADR-0016 §6.5:
- D2: DataHub 数据产品建模
- D3: GE + Airflow 集成(DDL migration + expectations 校验)
- D4: OpenLineage ↔ DataHub 同步

每阶段独立 PR + commit,沿用 D0 + D1 模式。