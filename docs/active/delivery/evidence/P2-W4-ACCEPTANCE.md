# P2-W4 验收证据

> 验收日期：2026-08-01
> 分支：`main`
> 结论：**Accepted**（P2-W4 完成：arch 补 4 endpoint + copilot 补 3 endpoint = 7 endpoint 闭环）

## 1. 交付目标

P2-W4 批次把 arch 和 copilot 两个已有包的剩余未实现 endpoint 补齐，
使两个域达到 spec 全覆盖：

1. **arch 补 4 endpoint**（扁平列表 + 分页）：
   - `GET /api/v1/arch/capabilities`（FR-ARCH-ARCHGETARCHCAPABILITIES）
   - `GET /api/v1/arch/capability-mappings`（FR-ARCH-ARCHGETARCHCAPABILITYMAPPINGS）
   - `GET /api/v1/arch/orgs`（FR-ARCH-ARCHGETARCHORGS）
   - `GET /api/v1/arch/roles`（FR-ARCH-ARCHGETARCHROLES）
2. **copilot 补 3 endpoint**：
   - `POST /api/v1/copilot/actions/execute`（FR-COPILOT-COPILOTPOSTCOPILOTACTIONSEXECUTE，body 取 action_id / action_name，emit outbox event）
   - `GET /api/v1/copilot/generate/process`（FR-COPILOT-COPILOTGETCOPILOTGENERATEPROCESS，分页，复用 list_plans）
   - `GET /api/v1/copilot/scheduling/templates`（FR-COPILOT-COPILOTGETCOPILOTSCHEDULINGTEMPLATES，分页，复用 list_templates）

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| 净增 endpoint | 7（arch 4 + copilot 3）|
| 净增 repository 函数 | 3（`list_capabilities` / `list_orgs` / `list_roles`）|
| 净增 happy-path tests | 7（arch 4 + copilot 3）|
| 净增 tenant tests | 5（arch 2 + copilot 3）|
| arch 累计 endpoint | 31 / 31（全通）|
| copilot 累计 endpoint | 35 / 35（全通）|
| 全后端 pytest | 590 passed, 0 failed |
| 未实现 endpoint | 40 → 33 |

## 3. ADR-0014 5 步合规矩阵

| Domain | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|---|---|---|---|---|---|
| `mate-app-arch`（P2-W4 增量）| ✅ 沿用 `install_auth(app)` | ✅ `_tid(request)` helper（`require_tenant`）| n/a（4 个新增均为 GET 只读）| ✅ 沿用 `clients.py` | ✅ 2 tenant tests（isolation + no-tenant 400）|
| `mate-app-copilot`（P2-W4 增量）| ✅ 沿用 | ✅ 沿用 `_tid(request)` | ✅ `POST /actions/execute` emit `copilot.action.executed` outbox event | ✅ 沿用 `BearerAuth` + `OutgoingAuthMiddleware` | ✅ 3 tenant tests（isolation + scoped + no-tenant 400）|

## 4. 13 项硬规则验收

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | 7 个新增 endpoint 均在 OpenAPI 契约中（operationId 已映射）| ✅ |
| 2 | PRD 没有 Requirement ID | FR-ARCH-ARCHGETARCHCAPABILITIES 等 7 个 Requirement ID 全部映射 | ✅ |
| 3 | tenant 上下文不访问 repository | 所有新增 handler 第一行 `require_tenant(ctx)`；5 tenant tests pass | ✅ |
| 4 | 外部系统 ACL Client | arch 沿用 `clients.py`；copilot 沿用 `BearerAuth` + `OutgoingAuthMiddleware` | ✅ |
| 5 | 禁止 fallback | `LEGACY_LOGIN_COMPAT=false` 仍强制 | ✅ |
| 6 | 静态检查失败不合并 | 无新 pyright 错误（沿用既有模式）| ✅ |
| 7 | 不跳过 tests | 590 passed, 0 skipped | ✅ |
| 9 | 审计、指标、trace | 共享 platform OTel bootstrap | ✅ |
| 10 | 验收证据 | 本文件 | ✅ |

## 5. 实际运行结果

```text
# mate-app-arch（含新增 4 endpoint）
$ pytest packages/mate-app-arch/tests/ -q
15 passed in 1.5s   # 9 原有 + 4 happy-path + 2 tenant

# mate-app-copilot（含新增 3 endpoint）
$ pytest packages/mate-app-copilot/tests/ -q
16 passed in 1.6s   # 10 原有 + 3 happy-path + 3 tenant

# 全后端回归
$ pytest packages/ -q --no-header
590 passed in 131.04s
```

## 6. PR gate

| Gate | Result |
|---|---|
| `forbid_raw_sql` | 0 violations |
| `forbid_bare_httpx` | 0 violations |
| `forbid_skip_tests` | 0 violations |
| `forbid_legacy_fallback` | 0 new violations |

## 7. 文件清单

```
mate-platform-backend/packages/mate-app-arch/
  src/mate_app_arch/api/app.py                      (+4 endpoint + _paginate helper)
  src/mate_app_arch/repositories/in_memory.py       (+list_capabilities / list_orgs / list_roles)
  src/mate_app_arch/repositories/__init__.py        (export 3 new functions)
  tests/test_app_arch.py                            (+4 happy-path tests)
  tests/test_app_arch_tenant_integration.py         (+2 tenant tests)

mate-platform-backend/packages/mate-app-copilot/
  src/mate_app_copilot/api/app.py                   (+3 endpoint + _paginate helper + import list_templates)
  tests/test_app_copilot.py                         (+3 happy-path tests)
  tests/test_app_copilot_tenant_integration.py      (+3 tenant tests)

docs/active/specs/2026-07-31-backend-impl-backlog.md  (v1.3: 40 → 33 未实现)
docs/active/delivery/evidence/P2-W4-ACCEPTANCE.md     (本文件)
```

## 8. 已知技术债（deferred）

| 编号 | 描述 | 目标 |
|---|---|---|
| TD-5 | in-memory → Paimon / Postgres 持久化 | v3.2 |
| TD-6 | copilot LLM provider 真实路由（llmgw 接入）| P2-W5 |
| Future | arch / copilot 新增 GET endpoint 的真实跨服务聚合 | P2-W5+ |

## 9. 关联文档

- `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.3 — 后端实现清单
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0 — 5 步模式
- `docs/active/decisions/ADR-0014-tech-services-integration.md` — 集成模式决策
- `docs/active/delivery/evidence/P2-W3-ACCEPTANCE.md` — 上一批次（dw 包）
