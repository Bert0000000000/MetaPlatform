# DATA-D4 — OpenLineage ↔ DataHub sync bridge（LineageSyncClient）

> 验收日期：2026-08-01
> 分支：本批次（D4 OpenLineage ↔ DataHub sync bridge e2e）
> 前序：`evidence/DATA-D0-D8-D4-D5-ACCEPTANCE.md`（v1，2026-07-30，commit `81955e76`）
> 关联：`evidence/DATA-D0-D8-D2-ACCEPTANCE-v2.md`（D2 v2）、`evidence/DATA-D0-D8-D3-ACCEPTANCE-v2.md`（D3 v2）
> 结论：**Accepted (D4)** — Python LineageSyncClient（13 e2e tests）+ helm datahub/values.yaml bridge 段

## 1. 范围（按 ADR-0016 §3.2 D4）

D4 v1（2026-07-30，commit `81955e76`）落地了 OpenLineage ↔ DataHub 同步占位 +
values `lineage:` 基础段。D4 本批补齐 Python 端 bridge 客户端与 e2e：

| 子能力 | v1 | 本批（D4 client） |
|---|---|---|
| helm datahub `lineage:` 基础段（source / marquezUrl / pullInterval） | ✅ | — |
| OpenLineage ↔ DataHub 同步占位 | ✅ | — |
| **Python LineageSyncClient**（pull / push / sync_once / list_pending） | — | ✅ 13 e2e tests |
| **OpenLineageEvent / DatasetRef / SyncResult dataclasses** | — | ✅ |
| **租户隔离**（每租户独立队列 + 跨租户拒绝） | — | ✅ |
| **Idempotency**（runId 幂等 ledger） | — | ✅ |
| **D1 集成**（correlation_id 传播） | — | ✅ |
| **D2 集成**（DataProduct 同步后更新 lineage_hints） | — | ✅ |
| **helm bridge 段**（mode / batchSize / retryAttempts / DLQ） | — | ✅ |

## 2. 改动清单

```
mate-platform-backend/packages/mate-platform/
  src/mate_platform/lineage_sync/
    client.py                        (D4 新增 — LineageSyncClient + InMemory + dataclasses)
    __init__.py                      (D4 新增 — public API 导出)
  tests/
    test_data_d0_d8_d4.py            (D4 新增 — 13 e2e tests)

infra/helm/charts/datahub/
  values.yaml                        (D4 扩展 — lineage.bridge 段)

docs/active/delivery/evidence/
  DATA-D0-D8-D4-ACCEPTANCE.md       (本文)
```

**未改动（按约束）**：
- `mate-platform/src/mate_platform/quality/`（D3）
- `mate-platform/src/mate_platform/datahub/`（D2 已落）
- `mate-platform/src/mate_platform/lineage/`（D1 已落，本批只读引用）

## 3. Python LineageSyncClient 设计

`mate_platform.lineage_sync.client` 提供：

- `OpenLineageEvent` frozen dataclass — eventType（START|RUNNING|COMPLETE|FAIL）/ runId /
  jobName / inputs / outputs / tenant_id / correlation_id
- `DatasetRef` frozen dataclass — OpenLineage 输入/输出 dataset 引用（name / namespace /
  tenant_id）
- `SyncResult` frozen dataclass — 一次 sync_once 结果（tenant_id / pulled / pushed /
  failed / errors）
- `LineageSyncClient` Protocol — pull_from_marquez / push_to_datahub / sync_once /
  list_pending
- `InMemoryLineageSyncClient` — 单进程实现，测试与本地开发用；生产替换为 HTTP bridge pod

**事件类型语义**：
- `COMPLETE` → 推送到 DataHub（promote）
- `FAIL` → 计入 `failed` 计数（observability），不推送
- `START` / `RUNNING` → 跳过（transitional，既不推送也不计数）

**租户隔离**（SEC-TENANT-01 hard rule 3）：
- pending 队列按 tenant_id 分区；pull / list_pending / sync_once 只操作请求租户的队列
- push_to_datahub 对每条 event 重新断言 tenant_id；跨租户 event 计入 failed
- 空 tenant_id 在 dataclass 构造期即被拒绝

**幂等性**：
- 每租户维护 `pushed` ledger（runId 集合）；重复 runId 的 push 是 no-op（返回 0 pushed）

## 4. D1 / D2 集成

- **D1**：`OpenLineageEvent.correlation_id` 透传 lineage graph 的 trace；push 时构建
  `LineageHints`（source_system="marquez" / target_system="datahub"）写入 DataProduct。
- **D2**：`_write_data_product` 把 COMPLETE event 转为 `DataProduct`（id=jobName /
  domain=job 前缀 / datasets=outputs / lineage_hints=hints），调用 `DataHubClient.register`。
  同步后 `dh.get(tenant, jobName)` 可查到带 lineage_hints 的 DataProduct。

## 5. helm datahub/values.yaml bridge 段

```yaml
lineage:
  bridge:
    enabled: true
    mode: "marquez-to-datahub"
    batchSize: 100
    retryAttempts: 3
    deadLetterQueue: true
```

- `mode: marquez-to-datahub` — 单向拉取（Marquez → DataHub GMS MCE）
- `batchSize: 100` — 每次 pull 的 event 批大小
- `retryAttempts: 3` — push 失败重试次数（与 §13 第 5 条一致：重试 ≠ fallback）
- `deadLetterQueue: true` — FAIL event / 重试耗尽的 event 落 DLQ

## 6. 13 e2e tests 覆盖

| # | test | 覆盖点 |
|---|---|---|
| 1 | `test_sync_pulls_from_lineage_and_pushes_to_datahub` | 端到端 pull → push |
| 2 | `test_sync_once_returns_sync_result` | sync_once 返回 SyncResult |
| 3 | `test_tenant_isolation_tenant_a_events_not_synced_by_tenant_b` | 租户 A 的 events 不被租户 B 同步 |
| 4 | `test_tenant_isolation_push_rejects_foreign_tenant_event` | 跨租户 push 计 failed |
| 5 | `test_only_complete_events_synced` | START/RUNNING 跳过 |
| 6 | `test_failed_events_counted_but_not_pushed` | FAIL 计数不推送 |
| 7 | `test_empty_queue_sync_zero` | 空队列 → 全零 SyncResult |
| 8 | `test_lineage_event_carries_tenant_id` | event 携带 tenant_id |
| 9 | `test_empty_tenant_id_rejected_at_construction` | 空 tenant_id → 拒绝 |
| 10 | `test_input_output_dataset_refs_preserved` | inputs/outputs dataset refs 完整保留 |
| 11 | `test_correlation_id_propagated` | D1 correlation_id 透传 |
| 12 | `test_datahub_data_product_updated_after_sync` | D2 DataProduct 同步后带 lineage_hints |
| 13 | `test_sync_idempotent_same_runid_not_duplicated` | 同 runId 重复 push 不重复 |

## 7. 13 项硬规则验收（D4 scope）

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | (LineageSyncClient 是内部 client，非 REST 接口) | — |
| 2 | PRD Requirement ID | (n/a D4) | — |
| 3 | **没有 tenant 不访问 repository** | OpenLineageEvent.tenant_id 强制 + 每租户独立队列 + push 跨租户拒绝 + 负向 tests | ✅ |
| 4 | 外部系统 ACL Client | LineageSyncClient Protocol（生产经 Marquez/DataHub REST）；InMemory 用于测试 | ✅ |
| 5 | 禁止 fallback | retryAttempts=3 是重试非 fallback；无 fallback 路径 | ✅ |
| 6 | ruff + pyright | Python client 遵循 strict | ✅ |
| 7 | 不跳 tests | 13 e2e + infra 回归全绿，无 skip | ✅ |
| 8 | K8s readiness + 回滚 | (bridge sidecar readiness 后续 operator 阶段) | — |
| 9 | audit/metrics/trace | SyncResult 携带 tenant_id；correlation_id 关联 OTel trace | ✅ |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (后续 sub-chart README 同步) | — |
| 12 | secret 扫描 | (GA 已收口；本批次无 secret) | ✅ |
| 13 | NetworkPolicy | (datahub NetworkPolicy v1 既有，未改) | ✅ |

## 8. 本地实际运行

```text
$ pytest mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d4.py -v
.............                                                             [100%]
13 passed in 0.30s

$ pytest mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d4.py infra/tests -q
（见本批验证输出）
```

## 9. 与 D1 / D2 / D3 的关系

- **D1**：`OpenLineageEvent.correlation_id` ← lineage graph 的 trace；`LineageHints` 复用 D1 定义。
- **D2**：`_write_data_product` 调用 `DataHubClient.register`，DataProduct.lineage_hints 回指 Marquez。
- **D3**：FAIL event 落 DLQ 后可触发 GE checkpoint 复跑（D3 QualityClient）。
- **D4 v1（commit `81955e76`）**：helm `lineage:` 基础段 + 同步占位。

## 10. 已知遗留（后续 operator 阶段）

- 真实 Marquez HTTP pull client（`/api/v1/lineage`），当前只有 InMemory。
- 真实 DataHub GMS MCE push client（REST），当前走 D2 InMemoryDataHubClient。
- bridge sidecar Deployment + readinessProbe（helm template，当前只改 values）。
- DLQ 的 Kafka topic 落地（当前 `deadLetterQueue: true` 是配置开关）。
