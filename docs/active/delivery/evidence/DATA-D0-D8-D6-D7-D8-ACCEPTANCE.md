# DATA-D0-D8 D6 + D7 + D8 验收证据

> 验收日期：2026-07-30
> 分支：`codex/data-d0-d8-d6-d7-d8`
> Worktree：`.worktrees/data-d0-d8-d6-d7-d8`
> 结论：**D6 + D7 + D8 Accepted**（17 e2e tests pass；DATA-D0-D8 全部 8 阶段收口）

## 1. D6 + D7 + D8 范围（按 ADR-0016 §6.5）

| 阶段 | 范围 | 状态 |
|---|---|---|
| D6: 租户级 retention + GDPR | `mate_platform.auth.retention` module: RetentionPolicy + SoftDeleteRecord + request_gdpr_forget() + is_tenant_soft_deleted() | ✅ |
| D7: pii_mask 整合 | `mate_clients.security.pii_mask` module: PIIMatch + PIIRedactionResult + detect_pii() + redact_pii() + redact_dict() | ✅ |
| D8: data federation audit | `mate_platform.observability.xdomain_audit` module: CrossDomainQuery + emit_cross_domain_query() (single-tenant no-op) | ✅ |
| 17 e2e tests | 全部 pass | ✅ |

## 2. 落地清单

```
mate-platform-backend/packages/mate-platform/src/mate_platform/auth/retention.py
  - RetentionPolicy (hardDeleteAfterDays + retentionDays)
  - SoftDeleteRecord (record_id + tenant_id + requested_at + hard_delete_at)
  - RetentionAction enum
  - RetentionStore Protocol + InMemoryRetentionStore
  - request_gdpr_forget() — marks tenant for soft-delete + schedules hard-delete
  - is_tenant_soft_deleted() — gate before accepting new writes

mate-platform-backend/packages/mate-clients/src/mate_clients/security/pii_mask.py
  - PIIMatch (field + kind + count)
  - PIIRedactionResult (redacted + matches + has_pii)
  - detect_pii() — phone/email/SSN/credit_card patterns
  - redact_pii() — irreversible default + reversible option
  - redact_dict() — recursive dict redaction

mate-platform-backend/packages/mate-platform/src/mate_platform/observability/xdomain_audit.py
  - CrossDomainQuery (query_id + actor + target_tenants + trace_id)
  - CrossDomainAuditSink Protocol + StdoutCrossDomainSink + InMemoryCrossDomainSink
  - emit_cross_domain_query() — single-tenant no-op, multi-tenant emits

infra/tests/test_data_d0_d8_d6_d7_d8.py
  - 17 e2e tests (D6: 6 + D7: 8 + D8: 3)
```

## 3. 13 项硬规则验收(D6+D7+D8 scope)

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口 | (n/a D6/D7/D8) | — |
| 2 | PRD Requirement ID | (n/a) | — |
| 3 | 没有 tenant 不访问 repository | is_tenant_soft_deleted() + cross_domain_query (single-tenant no-op) | ✅ |
| 4 | 外部系统 ACL Client | redact_pii() 在 mate-clients.security(D7) | ✅ |
| 5 | 禁止 fallback | (n/a) | — |
| 6 | ruff + pyright | (后续) | — |
| 7 | 不跳 tests | 17 e2e 全绿 | ✅ |
| 8 | K8s readiness + 回滚 | (后续) | — |
| 9 | audit/metrics/trace | emit_cross_domain_query (D8) + emit_cross_tenant_data_access (D5) | ✅ |
| 10 | 验收证据 | 本文 | ✅ |
| 11 | helm-docs | (后续) | — |
| 12 | secret 扫描 | (GA 已收口) | ✅ |
| 13 | NetworkPolicy | (后续) | — |

## 4. 本地实际运行

```text
$ pytest infra/tests/test_data_d0_d8_d6_d7_d8.py -q
.................                                                        [100%]
17 passed in 0.33s
```

## 5. 与 D0-D5 的关系

- **D0-D5 (commits 2ee18610, 14a7a314, 820838e2, 81955e76, d4a4bd9b)**: 4 sub-chart + lineage + DataHub + GE + audit
- **D6 (本批)**: retention + GDPR (data lifecycle)
- **D7 (本批)**: PII 检测与脱敏 (data privacy)
- **D8 (本批)**: 跨域查询审计 (data federation)

8 阶段全部 Accepted,共同组成 DATA-D0-D8 数据平台基础设施。

## 6. 后续推进

按 ADR-0016 §6.5 + TECH-SERVICES rollout status:
- **BUSINESS-SLICES P2 wave 2**: apphub / arch / copilot / dashboard 等 4 域
  (需先建包代码)
- **BUSINESS-SLICES P2 wave 3**: dw / data / a2a / ont / wfe 等 5 域
- **TECH-SERVICES §6** 后续 sub-batch

## 7. DATA-D0-D8 最终状态

| 阶段 | 状态 |
|---|---|
| D0: 4 sub-chart 落地 | ✅ Done |
| D1: 跨域 lineage tracking | ✅ Done |
| D2: DataHub DataProduct | ✅ Done |
| D3: GE + Airflow | ✅ Done |
| D4: OpenLineage ↔ DataHub 同步 | ✅ Done |
| D5: 跨域 data access 审计 | ✅ Done |
| **D6: retention + GDPR** | ✅ **Done (本批)** |
| **D7: pii_mask** | ✅ **Done (本批)** |
| **D8: data federation audit** | ✅ **Done (本批)** |

**DATA-D0-D8 全部 8 阶段 Accepted。** v3.0 GA + v3.1 数据平台基础设施全部收口。