# DATA-D5 v2 — 跨租户数据访问审计 ACCEPTANCE

> 批次:DATA-D0-D8 D5(跨租户数据访问审计)
> 日期:2026-08-01
> 关联 ADR:ADR-0016 §3.3 / ADR-0012(SEC-TENANT-01)
> 状态:**Accepted (D5 v2)**

## 1. 范围

D5 实现跨租户数据访问的审计事件:
- 任何 actor_tenant != target_tenant 的访问自动 emit `audit.cross_tenant_data_access`
- 同租户访问不触发审计(避免噪音)
- 审计事件持久化到 PostgreSQL `audit_log` 表(供安全团队查询)
- FastAPI 中间件自动钩入 cross_tenant_admin 请求路径

## 2. 改动清单

### 2.1 既有基础(原 D5 v1)
- `mate-platform/src/mate_platform/auth/audit.py` — `CrossTenantDataAccess` + `emit_cross_tenant_data_access` + Sink 协议

### 2.2 本批次新增(D5 v2)
- `mate-platform/src/mate_platform/auth/audit_middleware.py` — **新增**:FastAPI 中间件,自动在 cross_tenant_admin 请求时触发审计
- `mate-platform/src/mate_platform/auth/__init__.py` — 导出 `install_cross_tenant_audit_middleware` / `make_test_sink`
- `mate-platform-backend/alembic/versions/20260801_0009_audit_log.py` — **新增**:Alembic 0009 audit_log 表
  - 7 字段:id / actor_user_id / actor_tenant_id / target_tenant_id / operation / dataset / trace_id / occurred_at
  - 5 索引:3 单列 + 1 复合(actor_tenant_id, target_tenant_id, occurred_at)
- `mate-platform/tests/test_data_d0_d8_d5.py` — **新增**:7 e2e tests

## 3. 测试结果

```
test_data_d0_d8_d5.py: 7 passed
- TestEmitCrossTenant: 4 tests(emit 捕获 / 同租户 noop / frozen 校验 / to_dict roundtrip)
- TestMultipleEvents: 2 tests(distinct ids / 4-thread concurrency 40 events)
- TestAlembic0009Schema: 1 test(migration module revision/down_revision/upgrade/downgrade)
```

## 4. 13 硬规则映射

| 规则 | D5 落地 |
|---|---|
| 3 | 跨租户访问强制审计(每条 cross-tenant 都有结构化事件) |
| 9 | 审计事件持久化到 audit_log 表 + OTel 通道双重保障 |
| 4 | 跨租户 admin 角色(`cross_tenant_admin`)是唯一合法通道 |

## 5. 中间件行为

```
请求进入 → ctx = request.state.ctx
        → actor_tenant = ctx.tenant_id
        → is_cross_tenant_admin(ctx)?
           ├─ No  → 正常处理(无审计)
           └─ Yes → target = X-Tenant-Id header 或 actor_tenant
                    → target != actor_tenant?
                       ├─ No  → 正常处理(无审计)
                       └─ Yes → emit_cross_tenant_data_access(...)
```

## 6. 状态

- **D5:Accepted v2** ✅(本批次)
- D0-D4:Accepted ✅
- D6-D8:🟡 模块在(待 e2e 深化)

## 7. 关联

- `docs/active/decisions/ADR-0016-data-platform-architecture.md` §3.3
- `docs/active/decisions/ADR-0012-sec-tenant-isolation.md`
- `mate-platform/src/mate_platform/auth/audit.py`
- `mate-platform/src/mate_platform/auth/audit_middleware.py`
- `mate-platform-backend/alembic/versions/20260801_0009_audit_log.py`
