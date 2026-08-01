# DATA-D0-D8 D1 Lineage E2E 验收证据

> 验收日期：2026-08-01
> 分支：`codex/data-d0-d8-d1-e2e`
> 关联 ADR：[ADR-0016 §3.2 + §6.5](../decisions/ADR-0016-data-platform-architecture.md)
> 上一版：[DATA-D0-D8-D1-ACCEPTANCE.md](./DATA-D0-D8-D1-ACCEPTANCE.md)
> 结论：**D1 E2E Accepted** — 跨域 lineage 追踪从"事件可被 marquez 接收"升级为"端到端跨域可查询 + 租户隔离可断言"

---

## 1. 范围增量（相对于上一版 D1 ACCEPTANCE）

| 项 | 上一版状态 | 本次增量 | 备注 |
|---|---|---|---|
| `LineageEvent` (OpenLineage-shape) | ✅ 已落地 | — | `mate_platform.messaging.LineageEvent` 维持不变 |
| `InMemoryLineageEmitter` (emit 端) | ✅ 单测 7 e2e | — | emit 路径已在 D1 单测覆盖 |
| `LineageClient` (query 端) | ⚠️ 未实现 | ✅ **新增** | `mate_platform.lineage` 包：Protocol + InMemoryLineageClient + LineageHints |
| `LineageHints` dataclass | ⚠️ 未实现 | ✅ **新增** | tenant_id / correlation_id / source_system / target_system / job_name |
| `Event.create()` 自动注入 hints | ⚠️ 未实现 | ✅ **新增** | 默认 None 时填充，业务 0 改动 |
| 跨域 lineage e2e 测试 | ⚠️ stub | ✅ **5+1 测试** | `infra/tests/test_data_d0_d8_d1.py` 6 e2e 全绿 |

## 2. 落地清单

```
mate-platform-backend/packages/mate-platform/src/mate_platform/lineage/
  __init__.py        # 公开 API
  hints.py           # LineageHints + build_hints_from_event + merge_hints + default_hints
  client.py          # LineageClient Protocol + LineageNode / LineageEdge / LineageQueryResult
  in_memory.py       # InMemoryLineageClient + TenantIsolationError

mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/events.py
  + Event.lineage_hints (Any | None)
  + Event.create() 接受 source_system + lineage_hints;None 时自动 build_hints_from_event
  + Event.from_dict() 重建 hints

infra/tests/test_data_d0_d8_d1.py
  6 e2e tests pass (cross-domain chain + tenant isolation + hints propagation)
```

## 3. 13 项硬规则验收（D1 E2E scope）

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口不写 route | (n/a — D1 E2E 纯 query 路径) | — |
| 2 | PRD Requirement ID | (n/a) | — |
| 3 | **没有 tenant 不访问 repository** | `LineageHints.__post_init__` 拒绝空 tenant;`InMemoryLineageClient.emit/link/query` 拒绝空 tenant;`build_hints_from_event` 必须从 `Event` 取 tenant | ✅ enforced |
| 4 | **外部系统 ACL Client** | D1 E2E 用 `InMemoryLineageClient`(无外部依赖);HTTP emitter 沿用 D1 的 `MarquezHttpLineageEmitter`(已被 D1 acceptance 覆盖) | ✅ |
| 5 | **禁止 fallback** | 无 fallback 路径;空 tenant 直接 raise | ✅ |
| 6 | **ruff + pyright 0 错** | ruff clean / pyright 0 errors (lineage + events.py) | ✅ |
| 7 | **不跳 tests** | 6 e2e + 7 D1 单测 + 124 platform 单测 + 56 mate-tech-msg 单测 = **193 tests pass**(原 187 + 6 新增) | ✅ |
| 8 | K8s readiness + 回滚 | (n/a — 纯 Python lib) | — |
| 9 | **audit / metrics / trace** | `LineageHints` 携带 `tenant_id` + `correlation_id`(= trace_id);`Event.lineage_hints` 随 `to_dict` 序列化 | ✅ |
| 10 | **验收证据** | 本文件 | ✅ |
| 11 | helm-docs | (n/a — 纯 Python lib) | — |
| 12 | secret 扫描 | (n/a) | ✅ GA 已收口 |
| 13 | NetworkPolicy | (n/a) | — |

## 4. 5 项 e2e 验证 (per ADR-0016 §6.5)

| 测试 | 验证内容 | 结果 |
|---|---|---|
| `test_lineage_event_emitted_from_outbox` | 业务事件 → outbox → relay → Producer → lineage 节点可查;`LineageEvent.to_openlineage_dict()` payload 含 `tenant_id` + `trace_id` | ✅ |
| `test_lineage_query_returns_cross_domain_chain` | msg → obs → dw 三节点 + 三跨域边,单查询可见 | ✅ |
| `test_lineage_tenant_isolation` | tenant-a 查询只返回 tenant-a 节点;tenant-b 不可见;空 tenant_id 直接 `TenantIsolationError` | ✅ |
| `test_lineage_hints_carry_correlation_id` | 整条 chain 所有节点 + 边 correlation_id 一致;`build_hints_from_event` 默认取 trace_id | ✅ |
| `test_lineage_hints_carry_tenant_id` | 整条 chain 所有节点 + 边 tenant_id 一致;`Event.create()` 自动注入 `LineageHints`;显式传入也被保留 | ✅ |
| `test_list_namespaces_isolated_per_tenant` *(bonus)* | `list_namespaces` 返回租户命名空间;`all_correlation_ids` 暴露链 ID 不暴露节点 | ✅ |

## 5. 本地实际运行

```text
$ pytest infra/tests/test_data_d0_d8_d1.py -v
collected 6 items

infra/tests/test_data_d0_d8_d1.py::TestLineageEventEmittedFromOutbox::test_lineage_event_emitted_from_outbox PASSED
infra/tests/test_data_d0_d8_d1.py::TestLineageQueryReturnsCrossDomainChain::test_lineage_query_returns_cross_domain_chain PASSED
infra/tests/test_data_d0_d8_d1.py::TestLineageTenantIsolation::test_lineage_tenant_isolation PASSED
infra/tests/test_data_d0_d8_d1.py::TestLineageHintsCarryCorrelationId::test_lineage_hints_carry_correlation_id PASSED
infra/tests/test_data_d0_d8_d1.py::TestLineageHintsCarryTenantId::test_lineage_hints_carry_tenant_id PASSED
infra/tests/test_data_d0_d8_d1.py::TestLineageListNamespaces::test_list_namespaces_isolated_per_tenant PASSED
============================== 6 passed in 0.45s ==============================
```

```text
$ pytest mate-platform-backend/packages/mate-platform/tests mate-platform-backend/packages/mate-tech-msg/tests -q
180 passed, 12 warnings in 1.52s
```

```text
$ pytest infra/tests -q
210 passed in 1.23s
```

```text
$ ruff check mate-platform-backend/packages/mate-platform/src/mate_platform/lineage/ \
            mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/events.py \
            infra/tests/test_data_d0_d8_d1.py
All checks passed!

$ pyright mate-platform-backend/packages/mate-platform/src/mate_platform/lineage/ \
         mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/events.py
0 errors, 0 warnings, 0 informations
```

## 6. 与上下游 batch 的关系

- **DATA-D0 (commit 2ee18610)**: `marquez` sub-chart 提供 HTTP 端点;本批沿用其
  URL(`MARQUEZ_URL` 环境变量),生产路径仍走 `MarquezHttpLineageEmitter`。
- **PLATFORM-EVENT-01 (commit 95b35e43)**: outbox 事件带 `trace_id`;本批
  `Event.lineage_hints` 把 `trace_id` 复制为 `correlation_id`,lineage 服务
  端到端可关联。
- **SEC-TENANT-01 (commit 026ce4a8)**: 5 层隔离 — `LineageHints.__post_init__`
  + `InMemoryLineageClient.query/emit/link` 都强制 tenant_id 非空;namespace
  `metaplatform.<tenant>` 强制 per-tenant graph(由 `LineageEvent` 的 OpenLineage
  payload 沿用)。
- **GA-ACCEPTANCE (commit 87f589be)**: 不修改 13 门禁脚本(`scripts/ci/forbid_*`);
  本次新增的 `InMemoryLineageClient` 是纯内存实现,无外部依赖,不触发
  `forbid_bare_httpx` 或 `forbid_raw_sql` 守门。

## 7. 公开 API 摘要

```python
from mate_platform.lineage import (
    InMemoryLineageClient,
    LineageClient,            # Protocol
    LineageHints,             # dataclass(frozen, slots)
    LineageNode,              # dataclass(frozen, slots)
    LineageEdge,              # dataclass(frozen, slots)
    LineageQueryResult,       # dataclass(frozen, slots)
    build_hints_from_event,   # helper
    default_hints,            # helper
    merge_hints,              # helper
)

# Auto-injection inside Event.create():
ev = Event.create(
    type="order.placed.created",
    tenant_id="acme",
    aggregate_id="order-1",
    payload={"total": 100},
    trace_id="trace-abc",
    source_system="order",
)
assert isinstance(ev.lineage_hints, LineageHints)
assert ev.lineage_hints.tenant_id == "acme"
assert ev.lineage_hints.correlation_id == "trace-abc"
```

## 8. 已知遗留（接 D2/D4/D5）

- `InMemoryLineageClient` 是同步实现;生产环境使用 Marquez HTTP client 替换,
  由 D4(OpenLineage ↔ DataHub 同步)的 Marquez HTTP client 补完。
- `LineageHints.correlation_id` 默认取 `Event.trace_id`;Debezium CDC 事件
  的 correlation 策略在 D2 schema migration 中定(沿用 Debezium envelope 的
  `source.ts_ms` + `transaction.id`)。
- 当前 `Event.from_dict()` 重建 hints 时只取 dict 字段;若 CDC envelope
  增加 `parent_job` 等 facet,需在 D2 schema migration 时同步扩展。

## 9. 后续推进

- **D2**: DataHub DataProduct 建模;`LineageHints.job_name` 作为 DataProduct
  的 OpenLineage job 链接。
- **D4**: OpenLineage ↔ DataHub 同步;`LineageClient` 升级为 Marquez HTTP 实现。
- **D5**: 跨域 data access 审计;`audit.cross_tenant_data_access` 与
  `LineageQueryResult` 关联(同一 trace)。
- **D8**: data federation;`LineageClient.list_namespaces` 扩展为
  `list_jobs(namespace, job_name)` 以支持 federation query。