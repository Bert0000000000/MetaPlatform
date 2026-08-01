# DATA-D8 v2 — 跨域数据联邦查询 ACCEPTANCE

> 批次:DATA-D0-D8 D8(最后一阶段)
> 日期:2026-08-01
> 关联 ADR:ADR-0016 §3.3 / ADR-0012(SEC-TENANT-01)
> 状态:**Accepted (D8 v2)** — DATA-D0-D8 全部闭环 ✅

## 1. 范围

D8 实现跨域数据联邦查询:
- 授权 cross_tenant_admin 发起跨租户查询
- 引擎 fan-out 到各租户数据分区 → 合并结果
- 每行标注 `_source_tenant_id`(溯源)
- 多租户查询自动 emit CrossDomainQuery 审计
- 单租户查询不触发审计(避免噪音)
- partial / failed 状态处理

## 2. 改动清单

### 2.1 既有基础(D8 v1)
- `observability/xdomain_audit.py` — CrossDomainQuery + emit_cross_domain_query + Sink

### 2.2 本批次新增(D8 v2)
- `alembic/versions/20260801_0012_federation_query.py` — **新建**:federation_query 表(10 字段 + 3 索引)
- `federation/client.py` — **新建**:FederationClient + DataSourceAdapter Protocol + InMemoryDataSourceAdapter + FederationResult / TenantQueryResult
- `federation/__init__.py` — public API
- `tests/test_data_d0_d8_d8.py` — **新建**:9 e2e tests

## 3. 测试结果

```
test_data_d0_d8_d8.py: 9 passed
- TestFederationQuery: 5 tests(multi-tenant merge / audit emit / single-tenant no-audit / per-tenant results / unique query_id)
- TestErrorHandling: 3 tests(partial / failed / empty tenant)
- TestAlembic0012Schema: 1 test
```

## 4. 联邦查询流程

```
FederationClient.execute(actor, targets=[t1, t2], query)
  → for each target: adapter.query(tenant_id, sql)
  → merge rows (tag _source_tenant_id)
  → status: completed | partial | failed
  → emit_cross_domain_query (multi-tenant only)
  → return FederationResult
```

## 5. DATA-D0-D8 全量状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| D0 | CDC + Marquez + DataHub + GE 接入 | ✅ Accepted |
| D1 | 跨域 lineage e2e | ✅ Accepted |
| D2 | DataProduct + DataJob + Dataset CRD | ✅ Accepted v2 |
| D3 | GE checkpoint + Airflow 集成 | ✅ Accepted v2 |
| D4 | OpenLineage ↔ DataHub sync bridge | ✅ Accepted |
| D5 | 跨租户数据访问审计 | ✅ Accepted v2 |
| D6 | retention + GDPR right-to-be-forgotten | ✅ Accepted v2 |
| D7 | 统一 PII 脱敏引擎 | ✅ Accepted v2 |
| **D8** | **跨域数据联邦查询** | **✅ Accepted v2(本批次)** |

**DATA-D0-D8 全部 9 个阶段闭环 ✅**
