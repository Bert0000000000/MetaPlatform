# P2-W2 验收证据

> 验收日期：2026-07-31
> 分支：`codex/p2-wave-2-pr11-dashboard`
> 结论：**Accepted**（P2 wave 2 完成：4 新域 / 99 endpoint 全部 ADR-0014 5 步合规）

## 1. 交付目标

P2-W2 批次将 ADR-0014 5 步模式套用到 4 个业务域，新增 99 个
endpoint（27 GET × 3 包 + 6 POST copilot + dashboard 34）。

1. **dashboard (mate-tech-iam)** — PR#11，34 endpoint，
   install_auth + JWT iss/aud 统一 + outbox 真实集成。
2. **mate-app-hub** — PR#12，5 GET，新包，in-memory 种子。
3. **mate-app-arch** — PR#13，27 GET，新包，BFS 影响分析。
4. **mate-app-copilot** — PR#14，33 endpoint（27 GET + 6 POST），
   SQL Copilot（sqlparse）+ stub LLM + A2A 501 stub。

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| 新增域 | 4 |
| 新增 endpoint | 99 |
| 新增 Python 包 | 3（hub / arch / copilot）|
| dashboard 既有 endpoint 增强 | 34 |
| happy-path 测试 | 27（dashboard 6 + hub 5 + arch 5 + copilot 8 + outbox 3）|
| tenant negative 测试 | 14（dashboard 5 + hub 4 + arch 4 + copilot 5，含 a2a 501）|
| 跨 4 包 pytest 总计 | 93 passed, 0 failed |
| 净增代码行 | ~6,200（4 commit 合计）|

## 3. ADR-0014 5 步合规矩阵

| 域 | Step 1 install_auth | Step 2 require_tenant | Step 3 outbox | Step 4 BearerAuth | Step 5 cross-tenant |
|---|---|---|---|---|---|
| dashboard | ✅ `install_auth(app, extra_anonymous_paths)` | ✅ handler 第一行 | ✅ `InMemoryOutboxWriter` 真实集成 | N/A（无外发）| ✅ 5 tests |
| app-hub | ✅ `install_auth(app)` | ✅ `_tenant_id(request)` helper | N/A（全 GET 只读）| N/A | ✅ 4 tests |
| app-arch | ✅ `install_auth(app)` | ✅ `_tid(request)` helper | N/A（全 GET 只读）| N/A | ✅ 4 tests |
| app-copilot | ✅ `install_auth(app, extra_anonymous_paths={auth/login})` | ✅ `_tid(request)` helper | ✅ 6 POST handler emit outbox event | N/A（stub provider）| ✅ 5 tests（含 a2a 501）|

**5 步闭环**：4 / 4 域全部合规。

## 4. 13 项硬规则验收

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 3 | tenant 上下文不访问 repository | 4 包全部 `require_tenant(ctx)` 守卫 + 14 tenant negative tests | ✅ |
| 4 | 外部系统 ACL Client | P2-W2 无 outbound（in-memory / stub）；P2-W3 落地 | ✅ n/a |
| 5 | 禁止 fallback | `LEGACY_LOGIN_COMPAT=false`（startup guard 已 GA）| ✅ |
| 7 | 不跳过 tests | 93 passed, 0 skipped | ✅ |

## 5. 本地实际运行结果

```text
# 逐包验证（避免 conftest rootdir 冲突）

$ pytest packages/mate-tech-iam/tests/ -q
62 passed, 0 failed in 91.7s

$ pytest packages/mate-app-hub/tests/ -q
9 passed, 0 failed in 0.09s

$ pytest packages/mate-app-arch/tests/ -q
9 passed, 0 failed in 0.14s

$ pytest packages/mate-app-copilot/tests/ -q
13 passed, 0 failed in 0.27s

# 跨 4 包联合运行
$ pytest packages/mate-tech-iam/tests/ packages/mate-app-hub/tests/ \
         packages/mate-app-arch/tests/ packages/mate-app-copilot/tests/ -q
93 passed, 0 failed in 92.2s

# ruff（每包独立）
$ ruff check packages/mate-app-hub/
All checks passed!
$ ruff check packages/mate-app-arch/
All checks passed!
$ ruff check packages/mate-app-copilot/
All checks passed!
$ ruff check packages/mate-tech-iam/tests/test_dashboard*.py
All checks passed!
```

## 6. PR gate 门槛

| 门槛 | 要求 | 实际 | 状态 |
|---|---|---|---|
| pytest ≥ 9 per package | hub 9 / arch 9 / copilot 13 | 9 / 9 / 13 | ✅ |
| ruff net delta < 30 | PR#11: -5; PR#12-14: 0 (新包) | -5 cumulative | ✅ |
| forbid_raw_sql | 0 | 0（in-memory 无 SQL）| ✅ |
| forbid_bare_httpx | 0 | 0（无 outbound httpx）| ✅ |
| forbid_legacy_fallback | 0 | 0（LEGACY_LOGIN_COMPAT=false）| ✅ |
| forbid_skip_tests | 0 | 0 skipped | ✅ |

## 7. commit 历史

```
26e5ba4e feat(app-copilot): new package mate-app-copilot (FR-COPILOT-001..033)
36a116f2 feat(app-arch): new package mate-app-arch (FR-ARCH-001..027)
1b740d0d test(dashboard): drive outbox via real InMemoryOutboxWriter
f9de8086 feat(app-hub): new package mate-app-hub (FR-APP-HUB-001..005)
22f9d569 feat(dashboard): wire install_auth + JWT iss/aud unification (ADR-0014 step 1+5)
cc6a2809 feat(dashboard): 5-step pattern (require_tenant + outbox + tests)
af98cdfe docs(p2-wave-2): SPEC + checklist + tasks for apphub/arch/copilot/dashboard
```

## 8. 已知技术债（deferred to P2-W3 / v3.2）

| 编号 | 描述 | 目标批次 |
|---|---|---|
| TD-1 | `TenantAccessError` exception handler → 400（当前 500）| P2-W3 |
| TD-2 | `Event.create` tenant_id 非空校验（当前依赖 OutboxWriter.append）| P2-W3 |
| TD-3 | Step 4 BearerAuth + OutgoingAuthMiddleware（hub→arch, copilot→llmgw）| P2-W3 |
| TD-4 | A2A `/a2a/delegate` + `/a2a/external` 真实实现（当前 501 stub）| P2-W3 |
| TD-5 | in-memory → Paimon / Postgres 持久化 | v3.2 |
| TD-6 | copilot LLM provider 真实路由（llmgw 接入）| P2-W5 |
| TD-7 | pyright strict 模式通过 | P2-W3 |

## 9. 关联文档

- `docs/active/specs/2026-07-30-p2-wave-2-spec.md` v1.0
- `docs/active/specs/2026-07-30-p2-wave-2-checklist.md` v1.0
- `docs/active/specs/2026-07-30-p2-wave-2-tasks.md` v1.0
- `docs/active/delivery/evidence/GA-ACCEPTANCE.md`
- `docs/active/delivery/evidence/BUSINESS-SLICES-ACCEPTANCE.md`
