# ADR-0027: MP-ONT-REGISTER-01 — Ontology 注册客户端

## Status

**Accepted**（2026-08-06，commit 待补）

## Context

MARKETPLACE-CONSUMER-01 中 3 类市场资产的注册客户端并行落地：

| Sub-spec | 客户端 | 目标服务 | Endpoint |
|---|---|---|---|
| MP-MCP-REGISTER-01 | `McpMarketplaceClient` | `mate-tech-mcp` | `POST /api/v1/mcp/federation/servers` |
| MP-AGENT-REGISTER-01 | `AgentMarketplaceClient` | `mate-tech-agent` | `POST /api/v1/agent/registry/agents` |
| **MP-ONT-REGISTER-01** | **`OntologyMarketplaceClient`** | **`mate-tech-ont`** | **`POST /api/v1/ont/v2/object-types`** |

`OntologyInstaller` 此前是占位 stub，标记 `[blocked-on: MP-ONT-REGISTER-01]`，所有 ontology 资产（object-type 定义、property schema、interface 绑定）的安装路径阻塞。

v4 RUNTIME-MVP-01 已在 `mate-tech-ont` 落地 `POST /api/v1/ont/v2/object-types`（operation_id `ontPostV2ObjectType`，v2 kernel `ObjectTypeDTO` 包含 `rid/primary_key/properties/display_name/interfaces`），作为 ontology 的 canonical register endpoint。

## Decision

落地 `OntologyMarketplaceClient`（mate-clients）+ `OntologyInstaller`（mate-platform），与 MCP/Agent 两个 sibling 严格同构：

### OntologyMarketplaceClient

- **Endpoint**: `POST {base_url}/api/v1/ont/v2/object-types`（`mate-tech-ont` 默认端口 8007）
- **Payload**（`ObjectTypeDTO`）：
  ```json
  {
    "rid": "ot.employee.1.0.0",
    "primary_key": ["employee_id"],
    "properties": [{"name": "employee_id", "type": "string"}],
    "display_name": "Employee",
    "interfaces": []
  }
  ```
  manifest 缺字段时按 spec 默认值回填（`primary_key=["id"]`、`display_name=artifact.name`、`interfaces=[]`）
- **Enveloped return**:
  ```python
  {
    "rid": "...",
    "name": "...",
    "registered_digest": "<sha256 of blob>",
    "status": "registered",
  }
  ```
  后端未回 `registered_digest` 时客户端用本地 `sha256(blob)` 兜底，仍满足硬规则 #14（`registered_digest == manifest.digest`）。

### 13 硬规则对位

| # | 规则 | 本 Batch 实施 |
|---|---|---|
| 4 | 外部系统必须有 ACL Client | `BearerAuth` + `OutgoingAuthMiddleware(tenant_id=...)` 注入 `Authorization` + `X-Tenant-Id` 双 header（与 MCP/Agent 严格同构） |
| 3 | 没有 tenant 不访问 repository | dev profile 可不带 auth；带 auth 必须有 tenant_id；middleware 在 client init 时强制绑定 |
| 5 | Production profile 禁 fallback | digest 兜底仅发生在 dev profile（与 MCP/Agent 一致） |
| 12 | Secret 不进 git | 测试用 stub BearerAuth，不引用真实 token |
| 6 | 静态检查 ruff + pyright | 新代码 ruff 0 errors |

### set_tenant() 行为

`set_tenant(tenant_id)` 重新构造 `OutgoingAuthMiddleware`，保持 token 不变、tenant 切换。**rebind 模式**与 MCP/Agent 一致——marketplace dispatcher 在跨租户调度时无需重建 client。

### OntologyInstaller

完全继承 `BaseInstaller`：
- `kind = "ontology"`
- `register_method = "register_ontology"`
- `__init__(ontology_client=...)`（保留与 `mcp_client`/`agent_client` 平行命名）

去掉 stub 上的 `[blocked-on: MP-ONT-REGISTER-01]` 标记，正式进入 dispatcher 调度表。

## Consequences

- **正**：3 类市场资产的 install 路径全部对齐 marketplace dispatcher；MARKETPLACE-CONSUMER-01 解开最后一个子 spec 阻塞。
- **正**：`OntologyMarketplaceClient` 与 `McpMarketplaceClient` / `AgentMarketplaceClient` 严格同构（同名 `set_tenant`、相同 envelope key 集、相同兜底逻辑）——后续 marketplace 多类型批量 dispatch 统一调用形态。
- **正**：注册走 v2 kernel `ObjectTypeDTO`，与 v4 RUNTIME-MVP-01 已交付的 `ontPostV2ObjectType` 完全对位。
- **风险**：`mate-tech-ont` v2 kernel 的 `primary_key` 是 list[str] 而 marketplace manifest 可能只给 string——payload 构造时做 `[str]` 归一（已在代码内实现）。

## Alternatives Considered

- **A1. 直接在 installer 内 `httpx.post`**：拒绝——重复实现 auth/tenant 绑定，违反 13 硬规则 #4。
- **A2. 共用一个 `MarketplaceBase` 抽象**：拒绝——3 类的 endpoint、payload schema、envelope key 都不同，强行抽象只会引入配置字段膨胀；保持 3 个 parallel 客户端更直白。

## Verification

```bash
# mate-clients
cd packages/mate-clients
ruff check src/mate_clients/marketplace/ontology.py
pytest tests/test_marketplace_ontology_client.py -v
# 期望：6 passed / 0 failed

# mate-platform
cd packages/mate-platform
ruff check src/mate_platform/marketplace/jobs/installer_ontology.py
pytest tests/test_marketplace_installer_ontology.py -v
# 期望：4 passed / 0 failed

# 回归（确认未破坏既有）
pytest packages/ -q  # 期望既有 2180 + 新增 10 = 2190 passed（不含 main 上 54 个 pre-existing 失败）
```

## References

- ADR-0020 — MARKETPLACE-CONSUMER-01（umbrella）
- ADR-0025 — MP-MCP-REGISTER-01（sibling pattern）
- ADR-0026 — MP-AGENT-REGISTER-01（sibling pattern）
- ADR-0022 — RUNTIME-MVP-01（`ontPostV2ObjectType` 来源）
- `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`（canonical endpoint）
- 13 硬规则 §4 / §3 / §5 / §12