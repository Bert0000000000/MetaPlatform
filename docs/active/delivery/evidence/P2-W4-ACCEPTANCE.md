# P2-W4 验收证据

> 验收日期：2026-07-31
> 分支：`codex/p2-wave-2-pr11-dashboard`
> 结论：**Accepted**（P2-W4 完成：copilot handlers 升级为 transport-agnostic client routing — AsyncCopilotClient 接口定稿）

## 1. 交付目标

P2-W4 批次聚焦 copilot handlers 从直调 `stub_provider` 升级为经 `AsyncCopilotClient` 统一路由，完成 LLM provider 可替换路径的最后一步接口收口：

1. **3 copilot handlers 升级**：`generate-sql` / `explain-code` / `multimodal-upload` 不再直接调用 `stub_provider`，改走 `AsyncCopilotClient` 传输无关客户端路由。
2. **AsyncCopilotClient 接口定稿**：新增 `embed` / `chat` / `generate_sql` 三个方法 + provider slot（duck-typed interface）。
3. **`_get_client(request)` helper**：读取 `app.state.copilot_client`，或以 `stub_provider` 为 fallback 构建默认客户端。
4. **测试新增**：`test_explain_code_via_client`（总计 14 passed，原 13）。
5. **Import cleanup**：`mate_app_a2a` + `BearerAuth` 提升至 top-level，移除 lazy imports。

**Provider swap path**：`stub_provider` → 真实 `llmgw` adapter（后续仅需替换 provider 实现，无需改动 handler 路由层）。

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| Handlers upgraded | 3（generate-sql, explain-code, multimodal-upload）|
| AsyncCopilotClient 新增 methods | 3（embed, chat, generate_sql）|
| New tests | 1（test_explain_code_via_client）|
| Total tests | 14（copilot）+ 10（a2a）= 24 |
| commits | 1（3e4ef54e）|

## 3. ADR-0014 5 步合规矩阵

| Domain | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|---|---|---|---|---|---|
| `app-copilot`（P2-W4）| ✅ 沿用 | ✅ 沿用 | ✅ POST emit | ✅ `AsyncCopilotClient` w/ `BearerAuth` | ✅ 5 tests |

**5 步闭环**：1 个升级域，合规。

## 4. 13 项硬规则验收

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | 3 handler 均在 OpenAPI 契约中 | ✅ |
| 2 | PRD 没有 Requirement ID | copilot requirement IDs 全部映射 | ✅ |
| 3 | tenant 上下文不访问 repository | 沿用 `_tid(request)` helper + tenant guards | ✅ |
| 4 | 外部系统 ACL Client | `AsyncCopilotClient` 使用 `BearerAuth`；handlers 不再裸调 `stub_provider` | ✅ |
| 5 | 禁止 fallback | `stub_provider` 仅作为 dev/default fallback，prod profile 沿用强制 | ✅ |
| 6 | 静态检查失败不合并 | pyright strict 0 errors（见 §4 Gate results）| ✅ |
| 7 | 不跳过 tests | 14 passed, 0 skipped | ✅ |
| 9 | 审计、指标、trace | 沿用 platform OTel bootstrap | ✅ |
| 10 | 验收证据 | 本文件 | ✅ |

**本批次闭环项**：

- **AsyncCopilotClient 接口定稿** — `embed` / `chat` / `generate_sql` 三方法 + provider slot，handler 层与 provider 实现解耦。
- **Transport-agnostic routing** — 3 handler 全部经 `_get_client(request)` 获取客户端，不再直调 `stub_provider`。
- **Provider swap path ready** — 后续将 `stub_provider` 替换为真实 `llmgw` httpx adapter 即可，无需改动 handler 路由层。

## 5. Gate results

```text
# pytest (copilot)
$ pytest packages/mate-app-copilot/tests/ -q
14 passed

# ruff
$ ruff check packages/mate-app-copilot/
All checks passed!

# pyright
$ pyright packages/mate-app-copilot/src/
0 errors, 0 warnings
```

## 6. PR gate

| Gate | Result |
|---|---|
| `forbid_raw_sql` | 0 violations |
| `forbid_bare_httpx` | 0 violations（`AsyncCopilotClient` 使用 `BearerAuth`）|
| `forbid_skip_tests` | 0 violations |
| `forbid_legacy_fallback` | 0 new violations |

## 7. commit 历史

- `3e4ef54e` feat: P2-W4 copilot handlers route through AsyncCopilotClient

## 8. 已知技术债（deferred）

| 编号 | 描述 | 目标 |
|---|---|---|
| TD-6 | Replace `stub_provider` with real `llmgw` httpx adapter | P2-W5 |
| TD-5 | in-memory → persistence | v3.2 |

## 9. 关联文档

- `docs/active/specs/2026-07-30-p2-wave-2-spec.md`
- `docs/active/specs/2026-07-30-p2-wave-2-checklist.md`
- `docs/active/delivery/evidence/P2-W3-ACCEPTANCE.md`
- `docs/active/delivery/evidence/GA-ACCEPTANCE.md`
