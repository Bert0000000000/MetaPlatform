# DATA-D6 v2 — 租户级 retention + GDPR right-to-be-forgotten ACCEPTANCE

> 批次:DATA-D0-D8 D6
> 日期:2026-08-01
> 关联 ADR:ADR-0016 §3.3 / ADR-0012(SEC-TENANT-01)
> 状态:**Accepted (D6 v2)**

## 1. 范围

D6 实现租户级数据保留 + GDPR 被遗忘权:
- 每租户可配置 retention policy(retentionDays / hardDeleteAfterDays)
- GDPR 请求标记 soft-delete → N 天后 hard-delete
- 周期性清理:删除超过 retentionDays 的旧数据
- hard-delete 保留 audit_log(安全审计需要)

## 2. 改动清单

### 2.1 既有基础(D6 v1)
- `auth/retention.py` — RetentionPolicy / SoftDeleteRecord / RetentionStore / request_gdpr_forget / is_tenant_soft_deleted

### 2.2 本批次新增(D6 v2)
- `alembic/versions/20260801_0010_retention.py` — **新建**:retention_policy + gdpr_soft_delete 表(10 字段 + 4 索引)
- `auth/retention_cleanup.py` — **新建**:CleanupResult + CleanupConnection Protocol + run_retention_cleanup + run_gdpr_hard_delete + find_ready_hard_deletes
- `tests/test_data_d0_d8_d6.py` — **新建**:13 e2e tests

## 3. 测试结果

```
test_data_d0_d8_d6.py: 13 passed
- TestGDPRRequest: 4 tests(soft-delete 标记 / window 未来 / 空 tenant 拒绝 / 负数拒绝)
- TestRetentionCleanup: 3 tests(0 天 noop / 删除旧数据 / 错误捕获)
- TestGDPRHardDelete: 3 tests(删除全部 / 排除 audit_log / frozen 校验)
- TestFindReadyHardDeletes: 2 tests(过期过滤 / 空列表)
- TestAlembic0010Schema: 1 test(migration module 校验)
```

## 4. GDPR 窗口流程

```
request_gdpr_forget(tenant_id) → SoftDeleteRecord(hard_delete_at = now + 30d)
    → is_tenant_soft_deleted(tenant_id) == True(拦截新写入)
    → [30 天后] find_ready_hard_deletes() → run_gdpr_hard_delete()
        → DELETE FROM all business tables WHERE tenant_id = ...
        → audit_log 保留(GDPR 例外:安全审计需要)
```

## 5. 状态

- **D6:Accepted v2** ✅
- D0-D5:Accepted ✅
- D7-D8:🟡 模块在(待 e2e 深化)
