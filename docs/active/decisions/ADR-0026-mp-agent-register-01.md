# ADR-0026: MP-AGENT-REGISTER-01 — Agent 资产 register 子 spec

> 起草：2026-08-06 · 状态：**Accepted**
> 关联：ADR-0020（marketplace-consumer 总览）/ ADR-0025（MCP register 子 spec）/ 13 硬规则 #4

## 背景

继 [ADR-0025](ADR-0025-mp-mcp-register-01.md) 解锁 MCP register 子 spec 后，MARKETPLACE-CONSUMER-01 仍被 `MP-AGENT-REGISTER-01` 与 `MP-ONT-REGISTER-01` 阻塞。

`AgentInstaller` 在 MP-AGENT-REGISTER-01 之前同样是占位：

```python
# mate-platform/src/mate_platform/marketplace/jobs/installer_agent.py
"""Agent installer — [blocked-on: MP-AGENT-REGISTER-01]。"""
class AgentInstaller(BaseInstaller):
    kind = "agent"
    register_method = "register_agent"
```

`BaseInstaller.run()` 期望 `self.client.register_agent(artifact=..., blob=...)` 返回
`{"registered_digest": "<sha256>"}` 以满足硬规则 #14。

## 决策

**MP-AGENT-REGISTER-01**：在 `mate-clients.marketplace.agent` 新建 `AgentMarketplaceClient`，调用 `mate-tech-agent` 的 `/api/v1/agent/registry/agents` 端点（POST）完成注册；`AgentInstaller` 把 client 注入即可工作。

### API 契约

```
POST /api/v1/agent/registry/agents
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
    "agent_id": "agt-xxx",
    "name": "<artifact name>",
    "registered_digest": "<sha256>",   # 13 硬规则 #14
    "status": "registered"
  }
```

### `AgentMarketplaceClient` 设计

```python
class AgentMarketplaceClient:
    DEFAULT_URL = "http://localhost:8090"
    def __init__(self, base_url=None, *, timeout=30.0,
                 auth: BearerAuth | None = None, tenant_id: str = ""): ...
    async def register_agent(self, *, artifact: dict, blob: bytes) -> dict: ...
    def set_tenant(self, tenant_id: str) -> None: ...
    async def aclose(self) -> None: ...
```

要点（与 McpMarketplaceClient 完全平行）：

1. **13 硬规则 #4 闭环** — `BearerAuth + OutgoingAuthMiddleware` 强制注入。
2. **digest fallback** — 上游缺 `registered_digest` 时回退本地 sha256。
3. **set_tenant 重绑** — 多租户切换时重建 middleware。
4. **dev profile 旁路** — `auth=None` 时不发送任何认证头。

### `AgentInstaller` 变更

```python
class AgentInstaller(BaseInstaller):
    kind = "agent"
    register_method = "register_agent"
```

仅移除 `[blocked-on: ...]` 注释。

### 13 硬规则对位

| # | 规则 | 本 ADR 实施 |
|---|---|---|
| 3 | 没有 tenant 不访问 repo | set_tenant 强制 X-Tenant-Id |
| 4 | 外部系统必须有 ACL Client | BearerAuth + OutgoingAuthMiddleware 复用 |
| 6 | 静态检查 ruff+pyright | ruff 0 / pyright 0 |
| 7 | 跳过测试不标 Accepted | 0 skip |
| 10 | 验收证据 | MP-AGENT-REGISTER-ACCEPTANCE.md |

## 实施清单

- `packages/mate-clients/src/mate_clients/marketplace/agent.py`（NEW）
- `packages/mate-clients/tests/test_marketplace_agent_client.py`（NEW，5 tests）
- `packages/mate-platform/src/mate_platform/marketplace/jobs/installer_agent.py`（M，去 blocked-on）
- `packages/mate-platform/tests/test_marketplace_installer_agent.py`（NEW，4 tests）

合计 **9 tests / 0 skip**。

## 验收

- 客户端测试：`pytest packages/mate-clients/tests/test_marketplace_agent_client.py` 5/5 pass
- 安装器 e2e 测试：`pytest packages/mate-platform/tests/test_marketplace_installer_agent.py` 4/4 pass
- ruff：`ruff check packages/mate-clients packages/mate-platform` 0 errors
- 证据：`docs/active/delivery/evidence/MP-AGENT-REGISTER-ACCEPTANCE.md`

## 不在本子 spec 范围

- MP-ONT-REGISTER-01（ontology 服务 register 子 spec）
- MARKETPLACE-CONSUMER-01 整体 → Accepted（等 MP-ONT-REGISTER-01 + SEC-TENANT-01 豁免签字）

## 备选方案（被拒）

1. **让 AgentInstaller 直接调 httpx**：违反 13 硬规则 #4。
2. **复用 MarketplaceClient（公有 SaaS）**：语义不对，那是上游 SaaS catalog。
3. **把 AgentMarketplaceClient 放到 mate-platform.marketplace**：违反分层，ACL Client 必须放 mate-clients。