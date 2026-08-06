# ADR-0025: MP-MCP-REGISTER-01 — MCP 资产 register 子 spec

> 起草：2026-08-06 · 状态：**Accepted**
> 关联：ADR-0020（marketplace-consumer 总览）/ 13 硬规则 #4（外部系统必须 ACL Client）

## 背景

MARKETPLACE-CONSUMER-01（ADR-0020）设计了 3 类 installer 共用 `BaseInstaller`（`mcp` / `agent` / `ontology`），每一类把 artifact 落到对应域的运行时。

`McpInstaller` 在 MP-MCP-REGISTER-01 之前是占位：

```python
# mate-platform/src/mate_platform/marketplace/jobs/installer_mcp.py
"""MCP installer — [blocked-on: MP-MCP-REGISTER-01]。"""
class McpInstaller(BaseInstaller):
    kind = "mcp"
    register_method = "register_server"
```

`BaseInstaller.run()` 期望 `self.client.register_server(artifact=..., blob=...)` 返回
`{"registered_digest": "<sha256>"}` 以满足硬规则 #14（manifest digest 一致性）。

MARKETPLACE-CONSUMER-01 因此处于 **Pending**：

```
前置阻塞：MP-MCP-REGISTER-01 / MP-AGENT-REGISTER-01 / MP-ONT-REGISTER-01
三个子 spec 必须先 Accepted，本 Batch 才能转 Accepted。
```

本 ADR 解除这一阻塞的 MCP 子 spec。

## 决策

**MP-MCP-REGISTER-01**：在 `mate-clients.marketplace.mcp` 新建 `McpMarketplaceClient`，它调用 `mate-tech-mcp` 的 `/api/v1/mcp/federation/servers` 端点（POST），完成 artifact 注册；`McpInstaller` 把 client 注入即可工作。

### API 契约

```
POST /api/v1/mcp/federation/servers
Headers:
  Authorization: Bearer <service-jwt>
  X-Tenant-Id: <tenant>
Body:
  {
    "name": "<artifact name>",
    "version": "<semver>",
    "source": "marketplace",
    "artifact_id": "<id>",
    "digest": {"sha256": "<sha256>"},
    "manifest": {...},
    "blob_b64": "<hex>"
  }
200 Response:
  {
    "server_id": "srv-xxx",
    "name": "<artifact name>",
    "registered_digest": "<sha256>",   # 13 硬规则 #14
    "status": "registered"
  }
```

### `McpMarketplaceClient` 设计

```python
class McpMarketplaceClient:
    DEFAULT_URL = "http://localhost:8081"
    def __init__(self, base_url=None, *, timeout=30.0,
                 auth: BearerAuth | None = None, tenant_id: str = ""): ...
    async def register_server(self, *, artifact: dict, blob: bytes) -> dict: ...
    def set_tenant(self, tenant_id: str) -> None: ...
    async def aclose(self) -> None: ...
```

要点：

1. **13 硬规则 #4 闭环** — 构造时绑定 `BearerAuth + OutgoingAuthMiddleware`；
   每个 outbound 请求携带 `Authorization: Bearer …` + `X-Tenant-Id: …`。
2. **fallback digest** — 当上游响应缺 `registered_digest` 时回退到本地 sha256(blob)；
   这样硬规则 #14 在最小后端也能通过。
3. **set_tenant 重绑** — 多租户切换时重新构造 middleware（与 `FlowableClient` 同模式）。
4. **无 auth 也可用** — dev profile 可构造时不传 auth（生产 profile 由 call site 强制）。

### `McpInstaller` 变更

```python
# mate-platform/src/mate_platform/marketplace/jobs/installer_mcp.py
"""MCP installer — registers an MCP artifact with ``mate-tech-mcp``."""
class McpInstaller(BaseInstaller):
    kind = "mcp"
    register_method = "register_server"
```

仅移除 `[blocked-on: ...]` 注释。`BaseInstaller` 通过 `register_method` 属性动态
获取 `self.client.register_server`，无构造逻辑变更。

### 13 硬规则对位

| # | 规则 | 本 ADR 实施 |
|---|---|---|
| 3 | 没有 tenant 不访问 repo | McpMarketplaceClient.set_tenant 强制注入 X-Tenant-Id |
| 4 | 外部系统必须有 ACL Client | BearerAuth + OutgoingAuthMiddleware 复用 mate-clients/security |
| 6 | 静态检查 ruff+pyright | 新代码 ruff 0 / pyright 0 |
| 7 | 跳过测试不标 Accepted | 0 skip |
| 10 | 验收证据 | MP-MCP-REGISTER-ACCEPTANCE.md |

## 实施清单

- `packages/mate-clients/src/mate_clients/marketplace/mcp.py`（NEW）
- `packages/mate-clients/tests/test_marketplace_mcp_client.py`（NEW，4 tests）
- `packages/mate-platform/src/mate_platform/marketplace/jobs/installer_mcp.py`（M，去 blocked-on）
- `packages/mate-platform/tests/test_marketplace_installer_mcp.py`（NEW，4 tests）

合计 **8 tests / 0 skip**。

## 验收

- 客户端测试：`pytest packages/mate-clients/tests/test_marketplace_mcp_client.py` 4/4 pass
- 安装器 e2e 测试：`pytest packages/mate-platform/tests/test_marketplace_installer_mcp.py` 4/4 pass
- ruff：`ruff check packages/mate-clients packages/mate-platform` 0 errors
- 全后端回归：`pytest packages` 1694 / 0 failed
- 证据：`docs/active/delivery/evidence/MP-MCP-REGISTER-ACCEPTANCE.md`

## 不在本子 spec 范围

- MP-AGENT-REGISTER-01（agent 服务 register 子 spec）
- MP-ONT-REGISTER-01（ontology 服务 register 子 spec，与 v3.1 kernel 集成）
- MARKETPLACE-CONSUMER-01 整体 → Accepted（等另外两个 register 子 spec）

## 备选方案（被拒）

1. **让 McpInstaller 直接调 httpx**：违反 13 硬规则 #4（外部系统必须 ACL Client）。
2. **复用 `MarketplaceClient.list_artifacts` 等公有 SaaS API**：语义不对，那是上游 SaaS
   catalog，本 spec 是下游 mate-tech-mcp。
3. **把 McpMarketplaceClient 放到 `mate-platform.marketplace`**：违反分层，
   marketplace 域逻辑不应直接引用 httpx；ACL Client 必须放 `mate-clients`。