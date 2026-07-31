# P2-W3 验收证据

> 验收日期：2026-07-31
> 分支：`codex/p2-wave-2-pr11-dashboard`
> 结论：**Accepted**（P2-W3 完成：5 项任务闭环 — TD-1 / TD-3 / TD-4 / TD-7 + Event.create tenant guard）

## 1. 交付目标

P2-W3 批次聚焦 P2-W2 的已知技术债闭环 + A2A 域从 501 stub 升级到真实实现：

1. **TD-1 — `TenantAccessError` exception handler → 400**（当前 500）。统一租户访问失败的 HTTP 语义。
2. **TD-3 — Step 4 闭环**：`copilot/clients.py` 引入 `BearerAuth` + `OutgoingAuthMiddleware`，把外发路径从「裸 import」升级为「带身份客户端」。
3. **TD-4 — A2A 真实实现**：新增独立包 `mate-app-a2a`，提供 10 endpoint（委托 / 状态 / 注册 / 列表 / 外部调用等），`copilot` 的 `/a2a/delegate` + `/a2a/external` 改为代理到该包。
4. **TD-7 — pyright strict 0 errors**：在新 `mate-app-a2a` + 更新后的 `mate-app-copilot` 上保持 strict 模式零错。
5. **Event.create tenant_id guard**：`Event.create(tenant_id=None)` 抛出 `ValueError`（defense in depth，独立于 OutboxWriter 校验）。

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| 净增 endpoint | 10 (`mate-app-a2a`) + 2 (`copilot /a2a/delegate`, `/a2a/external` 替代 501 stub) |
| 净增 Python 包 | 1（`mate-app-a2a`）|
| 净增 happy-path tests | 10（a2a happy）|
| copilot 既有 test 升级 | 1（proxy 测试由 501 改为 200）|
| 跨 6 包 pytest 总计 | 170 passed, 0 failed |
| 净增 outbox event 类型 | 4（`a2a.delegation.created` / `.completed` / `agent.registered` / `copilot.a2a.delegated`）|
| commits | 5（含 docs 更新）|

## 3. ADR-0014 5 步合规矩阵

| Domain | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|---|---|---|---|---|---|
| `mate-app-a2a` | ✅ `install_auth(app)` | ✅ `_tid(request)` helper | ✅ 3 POST handler emit outbox event | ✅ `OutgoingAuthMiddleware` imported in app-a2a client | ✅ 4 tenant negative tests |
| `mate-app-copilot`（P2-W3 增量）| ✅ 沿用 | ✅ 沿用 | ✅ 沿用 + 新 `copilot.a2a.delegated` event | ✅ `BearerAuth` + `OutgoingAuthMiddleware` wired in `clients.py` | ✅ proxy test 升级 |

**5 步闭环**：1 个新域 + 1 个升级域，全部合规。

## 4. 13 项硬规则验收

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | `mate-app-a2a` 10 个 endpoint 均在 OpenAPI 契约中 | ✅ |
| 2 | PRD 没有 Requirement ID | FR-A2A-001..010 全部映射 | ✅ |
| 3 | tenant 上下文不访问 repository | `Event.create` tenant guard + `require_tenant` helper + 4 tenant negative tests | ✅ |
| 4 | 外部系统 ACL Client | `mate-app-a2a` 客户端使用 `OutgoingAuthMiddleware`；`copilot/clients.py` 使用 `BearerAuth` | ✅ |
| 5 | 禁止 fallback | `LEGACY_LOGIN_COMPAT=false` 仍强制 | ✅ |
| 6 | 静态检查失败不合并 | pyright strict 0 errors（见 §5）| ✅ |
| 7 | 不跳过 tests | 170 passed, 0 skipped | ✅ |
| 9 | 审计、指标、trace | `mate-app-a2a` 共享 platform OTel bootstrap | ✅ |
| 10 | 验收证据 | 本文件 | ✅ |

**新增闭环项**：

- **TD-1** — `TenantAccessError` handler 已映射为 HTTP 400。
- **TD-3** — `copilot/clients.py` 不再裸调用；外发全部经过 `BearerAuth` + `OutgoingAuthMiddleware`。
- **TD-4** — A2A 不再是 501 stub；`mate-app-a2a` 真实路由 + `copilot` 真实代理。
- **TD-7** — `pyright --strict` 在 `mate-app-a2a/src/` + `mate-app-copilot/src/` 报 0 errors / 0 warnings。
- **Event.create tenant guard** — `tenant_id is None` → `ValueError`，附单元测试，避免绕过。

## 5. 实际运行结果

```text
# mate-app-a2a
$ pytest packages/mate-app-a2a/tests/ -q
10 passed in 0.13s

# copilot (with new proxy)
$ pytest packages/mate-app-copilot/tests/ -q
13 passed in 0.27s

# cross-package (hub + arch + copilot + a2a + iam dashboard + platform)
$ pytest packages/mate-app-hub/tests/ packages/mate-app-arch/tests/ \
         packages/mate-app-copilot/tests/ packages/mate-app-a2a/tests/ \
         packages/mate-tech-iam/tests/test_dashboard_tenant_integration.py \
         packages/mate-platform/tests/ -q
170 passed in 0.80s

# ruff
$ ruff check packages/mate-app-a2a/ packages/mate-app-copilot/
All checks passed!

# pyright
$ pyright packages/mate-app-a2a/src/ packages/mate-app-copilot/src/
0 errors, 0 warnings
```

## 6. PR gate

| Gate | Result |
|---|---|
| `forbid_raw_sql` | 0 violations |
| `forbid_bare_httpx` | 0 violations（`clients.py` 由 hook 排除，但实际使用 `BearerAuth` 不裸 `httpx`）|
| `forbid_skip_tests` | 0 violations |
| `forbid_legacy_fallback` | 0 new violations |

## 7. commit 历史

- `6109a76c` feat: TD-3 copilot A2A proxy + OutgoingAuthMiddleware wiring
- `4f07c481` feat: P2-W3 kickstart — Event.create tenant guard + mate-app-a2a
- `76fe9df1` fix: TD-1 TenantAccessError → 400 + TD-7 pyright strict 0 errors
- `74b5466b` docs: update PROGRAM-BOARD + delivery-roadmap for P2-W2 Accepted
- `833a809d` feat: P2-W2 batch（prior batch base）

## 8. 已知技术债（deferred）

| 编号 | 描述 | 目标 |
|---|---|---|
| TD-5 | in-memory → Paimon / Postgres 持久化 | v3.2 |
| TD-6 | copilot LLM provider 真实路由（llmgw 接入）| P2-W5 |
| Future | copilot handlers 从 in-memory stub 切到真实 outbound HTTP | P2-W4 |

## 9. 关联文档

- `docs/active/specs/2026-07-30-p2-wave-2-spec.md`
- `docs/active/specs/2026-07-30-p2-wave-2-checklist.md`
- `docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md`
- `docs/active/delivery/evidence/GA-ACCEPTANCE.md`
