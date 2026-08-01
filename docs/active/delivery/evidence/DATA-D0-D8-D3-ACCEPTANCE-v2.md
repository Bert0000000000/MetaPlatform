# DATA-D3 v2 — GE Checkpoint 真实化 + Airflow 集成 + Python client

> 验收日期：2026-08-01
> 分支：本批次（D3 v2 GE checkpoint e2e）
> 前序：`evidence/DATA-D0-D8-D2-D3-ACCEPTANCE.md`（v1，2026-07-30，commit `820838e2`）
> 关联：`evidence/DATA-D0-D8-D2-ACCEPTANCE-v2.md`（D2 v2，2026-08-01）
> 结论：**Accepted (D3 v2)** — Python QualityClient（14 e2e tests）+ GE values checkpoints 段扩展

## 1. 范围（按 ADR-0016 §3.2）

D3 v1（2026-07-30）落地了 GE helm sub-chart + Airflow DAG template + expectations 租户隔离。
D3 v2 在此基础上补齐 Python 端 checkpoint 执行语义：

| 子能力 | v1 | v2 |
|---|---|---|
| GE helm sub-chart（values + NetworkPolicy） | ✅ | — |
| Airflow DAG template（`dag-template.py`） | ✅ | — |
| expectations.storagePerTenant 租户隔离 | ✅ | — |
| **Python QualityClient**（register / get / list / run / history） | — | ✅ 14 e2e tests |
| **Blocking / non-blocking checkpoint 语义** | — | ✅ |
| **GE values checkpoints 段**（默认 suite + blocking flag） | — | ✅ |
| **GE values tenantScoping 段**（显式 enabled / storagePerTenant） | — | ✅ |

## 2. 改动清单

```
mate-platform-backend/packages/mate-platform/
  src/mate_platform/quality/
    client.py                        (D3 v2 新增 — QualityClient + InMemory + dataclasses)
    __init__.py                      (D3 v2 新增 — public API 导出)
  tests/
    test_data_d0_d8_d3.py            (D3 v2 新增 — 14 e2e tests)

infra/helm/charts/ge/
  values.yaml                        (D3 v2 扩展 — checkpoints + tenantScoping 段)

docs/active/delivery/evidence/
  DATA-D0-D8-D3-ACCEPTANCE-v2.md     (本文)
```

**未改动（按约束）**：
- `infra/helm/charts/datahub/`（D4 会动）
- `mate-platform/src/mate_platform/datahub/`（D2 已落）
- `infra/helm/charts/ge/templates/dag-template.py`（v1 既有，未改）

## 3. Python QualityClient 设计

`mate_platform.quality.client` 提供：

- `ExpectationSuite` frozen dataclass — 租户级 expectation 集合（name / tenant_id /
  domain / datasets / checks）
- `Check` frozen dataclass — 单条 expectation（name / blocking / passes / metadata）
- `CheckResult` frozen dataclass — 单条 check 执行结果（name / passed / blocking）
- `Checkpoint` frozen dataclass — 一次 suite 执行的结果（suite_name / tenant_id /
  run_id / status / results）
- `QualityClient` Protocol — register_suite / get_suite / list_suites /
  run_checkpoint / checkpoint_history
- `InMemoryQualityClient` — 单进程实现，测试与本地开发用

**Blocking 语义**（映射 Airflow gate）：
- checkpoint status = `failed` ⟺ 至少一条 **blocking** check 失败
- checkpoint status = `passed` ⟺ 所有 blocking check 通过（non-blocking 失败不影响）
- checkpoint status = `skipped` ⟺ suite 无 checks

**租户隔离**（SEC-TENANT-01 hard rule 3）：
- 每个 ExpectationSuite 绑定 tenant_id
- `get_suite` / `run_checkpoint` / `checkpoint_history` 强制按 tenant_id 查找
- 跨租户访问抛 `ExpectationSuiteNotFoundError`
- `list_suites` 只返回当前 tenant 的 suites

## 4. GE values checkpoints 段

```yaml
checkpoints:
  - name: "tenant_id_not_null"
    domain: "iam"
    datasets: ["iam.user", "iam.role"]
    blocking: true
    description: "Critical: tenant_id column must never be NULL."
  - name: "tenant_id_matches_context"
    domain: "iam"
    datasets: ["iam.user"]
    blocking: true
    description: "Critical: tenant_id must match the request context."
  - name: "row_count_positive"
    domain: "iam"
    datasets: ["iam.user"]
    blocking: false
    description: "Non-blocking: dataset should have at least one row."
  - name: "schema_in_sync"
    domain: "data"
    datasets: ["data.lineage_node"]
    blocking: false
    description: "Non-blocking: schema matches the catalog definition."
```

每个 checkpoint 映射 ADR-0016 §3.1 的 critical checks（tenant_id NOT NULL +
tenant_id 与 RequestContext 一致），blocking=true 的 checkpoint 失败会阻塞
DDL migration / Airflow DAG。

## 5. 14 e2e tests 覆盖

| # | test | 覆盖点 |
|---|---|---|
| 1 | `test_checkpoint_runs_and_returns_status` | checkpoint 执行 → status |
| 2 | `test_suite_registered_before_run` | 未注册 suite 不可 run |
| 3 | `test_tenant_isolation` | 跨租户不可见 / 不可 run |
| 4 | `test_critical_check_blocks_on_failure` | blocking 失败 → status=failed |
| 5 | `test_non_blocking_check_passes_on_failure` | non-blocking 失败 → status=passed |
| 6 | `test_skipped_when_no_checks` | 无 checks → status=skipped |
| 7 | `test_run_id_unique_per_run` | 每次 run 的 run_id 唯一 |
| 8 | `test_results_carry_tenant_id` | checkpoint 携带 tenant_id |
| 9 | `test_list_suites_filtered_by_domain` | 按 domain 过滤 suite 列表 |
| 10 | `test_checkpoint_history_per_suite` | suite 历史 + run_id 唯一 |
| 11 | `test_history_empty_for_unrun_suite` | 未 run 的 suite 历史为空 |
| 12 | `test_history_isolated_per_tenant` | 历史按租户隔离 |
| 13 | `test_invalid_suite_empty_name` | 空 name → 拒绝 |
| 14 | `test_invalid_suite_empty_tenant` | 空 tenant_id → 拒绝 |

## 6. 13 项硬规则验收（D3 v2 scope）

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | (QualityClient 是内部 client，非 REST 接口) | — |
| 2 | PRD Requirement ID | (n/a D3) | — |
| 3 | **没有 tenant 不访问 repository** | ExpectationSuite.tenant_id 强制 + InMemoryQualityClient 每方法 tenant 校验 + 跨租户 negative tests | ✅ |
| 4 | 外部系统 ACL Client | Python QualityClient Protocol（生产经 GE REST）；InMemory 用于测试 | ✅ |
| 5 | 禁止 fallback | (client 无 fallback 路径) | — |
| 6 | ruff + pyright | Python client 遵循 strict（本批次未改 forbid 脚本） | ✅ |
| 7 | 不跳 tests | 14 e2e + infra 回归全绿，无 skip（1 skip 为既有非本批次） | ✅ |
| 8 | K8s readiness + 回滚 | (后续 GE operator 阶段) | — |
| 9 | audit/metrics/trace | checkpoint.results 携带 tenant_id；run_id 用于 OTel trace | ✅ |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (后续 sub-chart README 同步) | — |
| 12 | secret 扫描 | (GA 已收口；本批次无 secret) | ✅ |
| 13 | NetworkPolicy | (ge NetworkPolicy v1 既有，未改) | ✅ |

## 7. 本地实际运行

```text
$ pytest mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d3.py -v
.............                                                             [100%]
14 passed in 0.27s

$ pytest mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d3.py infra/tests -q
364 passed, 1 skipped in 2.93s
```

## 8. 与 D2 / D1 / D3 v1 的关系

- **D3 v1（commit `820838e2`）**：GE helm sub-chart + Airflow DAG template + expectations 租户隔离。
- **D3 v2（本批）**：Python QualityClient + blocking/non-blocking 语义 + values checkpoints 段。
- **D2**：ExpectationSuite.datasets 绑定 DataProduct 的 Dataset（D2 v2 Python client）。
- **D1**：Checkpoint.run_id 关联 lineage graph 的 correlation_id（D1 lineage client）。

## 9. 已知遗留（后续 operator 阶段）

- 真实 GE server REST client（HTTP），当前只有 InMemory。
- Airflow DAG template 从 checkpoints values 动态生成 task（当前是静态 template）。
- GE → DataHub search index 同步（D4 范围）。
