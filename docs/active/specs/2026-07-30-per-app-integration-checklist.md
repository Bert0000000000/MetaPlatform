# Per-App 5 步接入 Checklist（TECH-SERVICES）

> 版本：v1.0 · 2026-07-30
> 关联：ADR-0014 TECH-SERVICES 17 域集成模式
> 配套：mate-app-kb 是 canonical reference（已完整落地）
> 范围：17 域 OpenAPI service（a2a, agent, apphub, arch, copilot, dashboard, data, dw, iam, kb, llmgw, mcp, msg, obs, ont, rag, wfe）

---

## 1. 入口安装 Auth 中间件（mandatory）

**目标**：让每个入站请求都带 `request.state.ctx`（SEC-IAM-01）。

代码模板：

```python
from fastapi import FastAPI
from mate_platform.auth import install_auth

app = FastAPI(title="<service>")
install_auth(app)  # 必须在 create_app() 第一行
```

**禁止**：
- ❌ 自行 `from jose import jwt; jwt.decode(...)` 验证 token
- ❌ 用 `Depends(get_current_user)` 之类的自定义 auth 跳过中间件
- ❌ 在 `if __name__ == "__main__"` 之外启动 FastAPI 不调 install_auth

**参考**：`mate-app-kb/src/mate_app_kb/api/app.py`

---

## 2. 每个 Handler 第一行 `require_tenant(ctx)`（mandatory）

**目标**：在 handler 第一行拦截无 tenant / 跨 tenant 访问（§13 硬规则 3）。

代码模板：

```python
from fastapi import Request, HTTPException
from mate_platform.tenancy.guards import require_tenant, assert_same_tenant

@app.post("/api/v1/<service>/<resource>")
async def create(request: Request, body: CreateSchema):
    ctx = request.state.ctx  # 由 install_auth 注入
    require_tenant(ctx)        # mandatory
    # 如果 path 中带 tenant_id，必须与 ctx 一致：
    # assert_same_tenant(TenantId(body.tenant_id), ctx)
    ...
```

**禁止**：
- ❌ `tenant_id` 来自 path / query / body（只能来自 token）
- ❌ 跳过 `require_tenant` 直接读写 DB
- ❌ `if ctx.tenant_id: ...` —— 空 tenant 必须 raise

**参考**：`mate-app-kb/src/mate_app_kb/api/app.py` 的 `_require_ctx()` helper

---

## 3. 业务事务同事务写 Outbox（mandatory for write handlers）

**目标**：业务事务 + 事件发布原子化（§13 硬规则 8 零丢失）。

代码模板：

```python
from mate_platform.messaging import Event, OutboxWriter

@app.post("/api/v1/<service>/<resource>")
async def create(request: Request, body: CreateSchema):
    ctx = request.state.ctx
    require_tenant(ctx)

    # Step A: 业务事务（业务表 INSERT）
    new_id = create_business_row(tenant_id=ctx.tenant_id, ...)

    # Step B: 同事务写 outbox（必须 atomic）
    outbox: OutboxWriter = request.app.state.outbox_writer
    outbox.append(Event.create(
        type="<domain>.<aggregate>.created",
        tenant_id=ctx.tenant_id,
        aggregate_id=str(new_id),
        payload={"id": str(new_id), "...": "..."},
        trace_id=ctx.trace_id,
    ))
    # ... commit 在 SQLAlchemy session.commit() 处；outbox.append 必须在
    # 同一 session 上
```

**禁止**：
- ❌ Dual-write（业务事务成功后单独 `producer.send(...)`）
- ❌ 在事务外调 `outbox.append`
- ❌ 在事务外调 `producer.send`（必须走 relay）

**参考**：`mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/outbox.py`

---

## 4. 出向调用走 BearerAuth + OutgoingAuthMiddleware（mandatory）

**目标**：所有出向调用携带 Bearer + X-Tenant-Id（§13 硬规则 4 ACL Client）。

代码模板：

```python
from mate_clients.security import BearerAuth, OutgoingAuthMiddleware
import httpx

# 在 FastAPI handler 内
async def call_downstream(request: Request):
    ctx = request.state.ctx
    auth: BearerAuth = request.app.state.bearer_auth
    async with httpx.AsyncClient(
        auth=OutgoingAuthMiddleware(auth, tenant_id=ctx.tenant_id),
    ) as client:
        r = await client.get("http://<service>/api/v1/...")
```

**禁止**：
- ❌ 裸 `httpx.Client()` / `httpx.AsyncClient()` 直连下游（即使内部网络）
- ❌ 在出向请求中硬编码 Authorization header
- ❌ 在出向请求中塞 tenant_id（应该用 OutgoingAuthMiddleware 自动注入）

**参考**：`mate-app-kb/src/mate_app_kb/clients.py`

---

## 5. 跨租户 negative tests（mandatory ≥ 3 per app）

**目标**：每 app 至少 3 个 case（per ADR-0012 §6.5 + ADR-0014 §2.3）。

测试文件路径：`tests/test_<app>_tenant.py`（或 `tests/test_tenant_integration.py`）。

最小 3 case：

1. **wrong tenant** —— handler 被不同 tenant 的 token 调用，断言拒绝。
2. **missing scope** —— token 没有 `platform.read` / `platform.write` scope，断言拒绝。
3. **no tenant** —— 注入的 `RequestContext` `tenant_id == ""`，断言 `require_tenant` raise。

**参考**：`mate-app-kb/tests/test_tenant_integration.py::TestCrossTenantNegatives`

---

## 6. OpenAPI security 段三段式升级（mandatory per service）

`contracts/openapi/services/<service>.yaml` 的 `security:` 段从：

```yaml
security:
  - bearerAuth: []
```

升级为：

```yaml
security:
  - bearerAuth: []
    tenantHeader: []
    oidcScopes: [platform.read]   # POST/PUT/DELETE 用 [platform.write]
```

**本批已批量升级 17 域**（commit `<ADR-0014 实现 commit>`）。

---

## 7. 17 域接入优先级

| P | 域 | 状态 | 备注 |
|---|---|---|---|
| **P0** | `kb` | ✅ canonical reference 完整 | 已含本批次所有 5 步 |
| **P0** | `iam` | 🟡 route 清理 | SEC-IAM-01 已 deprecated；保留路由到 PLATFORM-EVENT-01 完成 |
| **P1** | `msg` `obs` | 🟡 smoke | 受 PLATFORM-EVENT-01 / PLATFORM-K8S-01 影响 |
| **P1** | `agent` `rag` `llmgw` | 🟡 smoke | 数据流最重，KB 已接入 |
| **P2** | `apphub` `arch` `copilot` `dashboard` `dw` `data` | ⏳ 待 P1 完成 | |
| **P2** | `a2a` `mcp` `ont` `wfe` | ⏳ 待 P1 完成 | 协议 / 引擎侧 |
| P3 | 18-19 域（如有）| ⏳ 未来 | |

TECH-SERVICES = Accepted 标志"模式就位"，不要求 17 域 100% 接入。

---

## 8. 自检 Checklist（每 PR 前勾选）

- [ ] 步骤 1：`install_auth(app)` 在 `create_app()` 第一行
- [ ] 步骤 2：每个 handler 第一行 `require_tenant(ctx)`
- [ ] 步骤 3：写 handler 用 `outbox.append(Event.create(...))` 同事务
- [ ] 步骤 4：出向调用用 `BearerAuth` + `OutgoingAuthMiddleware`
- [ ] 步骤 5：`tests/test_<app>_tenant.py` ≥ 3 cross-tenant negative
- [ ] 步骤 6：OpenAPI `security:` 段已升级三段式
- [ ] `pytest <app>/tests` 全绿；`pytest infra/tests` 全绿
- [ ] `git log` 显示每个 PR commit 信息包含 ADR-0014 引用

---

## 9. 关联文档

- ADR-0014（决策）
- ADR-0010 / ADR-0011 / ADR-0012 / ADR-0013（上游 ADR）
- SEC-IAM-01-ACCEPTANCE.md（auth 能力）
- SEC-TENANT-01-ACCEPTANCE.md（tenant 能力）
- PLATFORM-EVENT-01-ACCEPTANCE.md（event 能力）
- PROGRAM-BOARD.md（17 域进度）