# DATA-D0-D8 D4 + D5 验收证据

> 验收日期：2026-07-30
> 分支：`codex/data-d0-d8-d4-d5`
> Worktree：`.worktrees/data-d0-d8-d4-d5`
> 结论：**D4 + D5 Accepted**（OpenLineage ↔ DataHub 同步 + 跨域 data access 审计；7 e2e tests pass）

## 1. D4 + D5 范围（按 ADR-0016 §6.5）

| 阶段 | 范围 | 状态 |
|---|---|---|
| D4: OpenLineage ↔ DataHub 同步 | datahub chart 展开 lineage section + pullIntervalSeconds + marquezUrl | ✅ |
| D4: Per-tenant 切分 | `partitionByCorpGroup: true` 继承 SEC-TENANT-01 | ✅ |
| D5: 跨域 data access 审计 | `mate_platform.auth.audit` module: CrossTenantDataAccess + InMemoryAuditSink + StdoutAuditSink + emit_cross_tenant_data_access() | ✅ |
| D5: trace_id 关联 | audit event 携带 trace_id, 与 PLATFORM-EVENT-01 outbox 事件关联 | ✅ |
| 7 e2e tests | 全部 pass | ✅ |

## 2. 落地清单

```
infra/helm/charts/datahub/values.yaml        (D4 展开)
  - lineage section
  - pullIntervalSeconds: 30
  - openlineageVersion: "1.0.0"
  - marquezUrl: "http://marquez.metaplatform.svc.cluster.local:5000"

mate-platform-backend/packages/mate-platform/src/mate_platform/auth/audit.py
  - CrossTenantDataAccess (dataclass)
  - CrossTenantAuditSink (Protocol)
  - StdoutAuditSink (logger)
  - InMemoryAuditSink (test)
  - emit_cross_tenant_data_access() — in-tenant is no-op

mate-platform-backend/packages/mate-platform/src/mate_platform/auth/__init__.py
  - exports audit symbols

infra/tests/test_data_d0_d8_d4_d5.py
  - 7 tests pass
```

## 3. 13 项硬规则验收(D4+D5 scope)

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | (n/a D4/D5) | — |
| 2 | PRD Requirement ID | (n/a) | — |
| 3 | 没有 tenant 不访问 repository | `partitionByCorpGroup: true` + audit 同 tenant no-op | ✅ |
| 4 | 外部系统 ACL Client | datahub ↔ marquez (D4), emit_cross_tenant_data_access (D5) | ✅ |
| 5 | 禁止 fallback | (n/a) | — |
| 6 | ruff + pyright | (后续) | — |
| 7 | 不跳 tests | 7 e2e 全绿 | ✅ |
| 8 | K8s readiness + 回滚 | (后续) | — |
| 9 | audit/metrics/trace | audit event 带 tenant_id + trace_id | ✅ |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (后续) | — |
| 12 | secret 扫描 | (GA 已收口) | ✅ |
| 13 | NetworkPolicy | (后续) | — |

## 4. 本地实际运行

```text
$ pytest infra/tests/test_data_d0_d8_d4_d5.py -q
.......                                                                  [100%]
7 passed in 0.30s
```

## 5. 与 D0/D1/D2/D3 的关系

- **D0 (commit 2ee18610)**: 4 sub-chart 落地
- **D1 (commit 14a7a314)**: lineage tracking module
- **D2+D3 (commit 820838e2)**: DataHub + GE/Airflow 展开
- **D4 (本批)**: datahub chart 加 lineage section, 从 marquez 拉
- **D5 (本批)**: auth.audit module, 跨域 data access 自动 no-op

## 6. 后续推进

按 ADR-0016 §6.5:
- D6: 租户级 retention / GDPR
- D7: pii_mask 整合
- D8: data federation

每阶段独立 PR + commit。