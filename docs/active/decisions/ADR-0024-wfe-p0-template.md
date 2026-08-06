# ADR-0024 — BUSINESS-SLICES P0 模板：mate-app-wfe 全量 5 步闭环

**状态**：Accepted
**日期**：2026-08-06
**关联**：ADR-0014（TECH-SERVICES 17 域接入模式）、ADR-0016（BUSINESS-SLICES checklist）、ADR-0018（AI 服务 SLO）
**对应 P0 域**：`mate-app-wfe`（workflow engine center / FR-WFE-001..002）
**对应 v3.1 BOARD §4**：BUSINESS-SLICES P0 wave 1

---

## Context

TECH-SERVICES（ADR-0014）已就位 SEC-IAM-01 / SEC-TENANT-01 / PLATFORM-EVENT-01
"3 层模式"，17 域按 P0/P1/P2 分批接入 `mate-platform` 提供的 auth + tenant +
event 中间件。`mate-app-kb` 是 canonical reference（已完整落地 5 步）。

`mate-app-wfe`（workflow engine center，BPMN 流程中心）状态盘点（2026-08-06
联调审计）：

| ADR-0014 步骤 | 已落地？ | 证据 |
|---|---|---|
| 1. `install_auth(app)` | ✅ | `main.py:38` 第一行调 `install_auth(app)` |
| 2. `require_tenant(ctx)` 守卫 | ✅ | `api/app.py:_tid()` 每 handler 第一行调用 |
| 3. 写 handler outbox 原子 | ✅ | `api/app.py:_emit()` 调 `Event.create(...).append(outbox)` |
| 4. 出向 BearerAuth + OutgoingAuthMiddleware | ❌→✅ | **本 ADR 修复**：`clients.py` 用裸 `httpx.AsyncClient`，违反 13 硬规则 #4 |
| 5. ≥3 cross-tenant negative | ✅ | `test_app_wfe_tenant_integration.py` 3 case |

**问题**：步骤 4 是 13 硬规则 #4（"外部系统没有 ACL Client"）唯一未闭环项。
`FlowableClient.deploy()` 直连 `http://flowable:8080/...`，无 Bearer / X-Tenant-Id
注入 —— 跨服务调用会落到 Flowable 默认共享 namespace，违反 SEC-TENANT-01
隔离语义。

**触发来源**：今日（2026-08-06）`goal` 指令 "按照123顺序开始做，有所的都推倒
accepted"，把 BUSINESS-SLICES P0 模板 1 域设为 priority 2。

---

## Decision

`mate-app-wfe` 升级为 P0 模板：补齐步骤 4，把 `FlowableClient` 升级到
`mate-app-kb` 同款 ACL 模式。

### 改动清单

| 文件 | 改动 | 行数 |
|---|---|---|
| `clients.py` | `FlowableClient.__init__` 加 `auth: BearerAuth \| None` + `tenant_id: str` 参数；建长生命周期 `httpx.AsyncClient` 并挂 `OutgoingAuthMiddleware`；新增 `set_tenant()` + `aclose()` | ~40 行 |
| `api/app.py` | `FlowableClient()` 实例化处改为 `FlowableClient(auth=app.state.bearer_auth, tenant_id=tid)`；`try/finally` 包 `aclose()` | ~6 行 |
| `tests/test_wfe_flowable.py` | 新增 2 个 case：`test_flowable_client_injects_bearer_and_tenant_header`（respx mock 验 Authorization + X-Tenant-Id 头注入）+ `test_flowable_client_set_tenant_rebinds_auth` | ~40 行 |

### 关键决策点

1. **长生命周期 `AsyncClient` + `aclose()`** —— 取代原 per-call `async with
   httpx.AsyncClient()`。理由：BearerAuth token 缓存复用，避免每次请求都换
   client；遵循 `mate-app-kb/RAGClient` 的同款模式。

2. **`auth=None` / `tenant_id=""` 时不挂 OutgoingAuthMiddleware** —— 兼容
   P2-W5 时代的 in-memory 单元测试（无 token）；只在真实跨服务调用且 tenant
   非空时才挂中间件，避免 dev profile 误注入。

3. **`FlowableClient.set_tenant(tenant_id)`** —— `OutgoingAuthMiddleware` 是
   有状态的（绑死一个 tenant_id），需要 hot-rebind 接口。`mate-app-kb` 的
   `RAGClient.set_tenant` 同款。

4. **`aclose()` 在 `try/finally` 调** —— 避免 resource leak；与 FastAPI
   handler 的 Request 生命周期对齐（每个请求 aclose 一次）。

### 验收口径

- `pytest packages/mate-app-wfe/tests/` 47/47 pass（原 45 + 新 2 ACL case）
- `test_flowable_client_injects_bearer_and_tenant_header`：respx mock 验
  outbound 请求 header 含 `Authorization: Bearer <token>` 和
  `X-Tenant-Id: tenant-acme`
- `test_flowable_client_set_tenant_rebinds_auth`：验证 tenant hot-rebind 后
  `_tenant_id` 同步更新
- 13 硬规则对位（§13 hard rule 4 闭环）

### 不在本 ADR 范围

- Flowable 真接入（依赖 docker-compose Flowable 8.0 服务 + `FLOWABLE_BASE_URL`
  env） —— P2-W6 已规划
- wfe 域 SLO（ADR-0018 §2.1） —— 独立 PR
- 其余 16 域 P0 接入 —— BUSINESS-SLICES P0 wave 2/3

---

## 实施

```
refactor/wfe-p0-template-01 (基于 main HEAD 677a8697)
  + clients.py 升级
  + api/app.py 实例化点改造
  + tests/test_wfe_flowable.py +2 case
  + docs/active/decisions/ADR-0024-wfe-p0-template.md  (本文件)
  + docs/active/delivery/evidence/BUSINESS-SLICES-WFE-P0-ACCEPTANCE.md
```

## 关联文档

- ADR-0014：TECH-SERVICES 17 域集成模式
- ADR-0016：BUSINESS-SLICES checklist
- ADR-0018：AI 服务 SLO
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md`：5 步接入
- `packages/mate-app-kb/src/mate_app_kb/clients.py`：canonical reference