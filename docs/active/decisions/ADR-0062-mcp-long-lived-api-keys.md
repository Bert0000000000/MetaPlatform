# ADR-0062：MCP 长期 API Key 作为 JWT 之外的第二入站凭证

> **状态**：Accepted
> **日期**：2026-09-14
> **作者**：Claude (Haiku 4.5) + 用户协作
> **关联 ADR**：ADR-0011（SEC-IAM-01 Keycloak JWT 验证）、ADR-0012（SEC-TENANT-01 五层隔离）、ADR-0014（TECH-SERVICES 5 步接入）
> **关联硬规则**：硬规则 3（无 tenant 上下文不访问 repository）、硬规则 12（Secret 不进 git）

---

## 1. 背景

外部 MCP 客户端（Codex CLI、Cursor 等）经
`http://localhost:8100/api/v1/mcp/protocol/mcp` 接入本体引擎。该端点由
`mate-tech-mcp` 的 `install_auth(app)` 中间件保护，唯一被接受的凭证是
Keycloak 签发的 JWT。

实测该 JWT **有效期恰好 1 小时**（`exp - iat = 3600`），且登录响应里的
`refreshExpiresIn = 1800` **短于 access token 本身**，刷新通道在时效上不成立。
后果是外部客户端每小时必然断连一次：401 → 重新登录 → 更新客户端凭证 →
重启客户端进程。对长时间运行的 AI 编码会话不可用。

平台现状盘点：

- 网关（`services/api-gateway`）**不做鉴权**，是纯 L7 反代，JWT 校验发生在各上游服务。
- `install_auth(...)` 早已预留 `api_key_verifier` 接缝
  （`mate-platform/auth/middleware.py:140-148`），仅在 JWT 验签失败后调用。
- `AuthMethod.API_KEY` 早已在 `mate-platform/tenancy/context.py:22` 预留。
- `mate-tech-llmgw` 已有完整的同类先例
  （`security/api_keys.py` + `api/keys_routes.py`）。
- MCP 中心前端**已存在**完整 UI
  （`metaplatform-frontend/apps/web/src/pages/mcp/components/ApiKeyGenerator.tsx`），
  且后端端点已存在（`mate-tech-mcp/api/management_routes.py:685-709`），
  **但后端是纯内存桩**：`_API_KEYS` 全局 list，`create_api_key` 只写
  `{id, name, scopes, createdAt}`，**不产生任何密钥材料**——前端读取的
  `k.key` / `k.prefix` 恒为 `undefined`，且重启即丢、不绑租户。

---

## 2. 决策

**为 `mate-tech-mcp` 引入长期、可吊销、绑租户的 API Key，作为 JWT 之外的第二入站
凭证；并复用已有的 `/api/v1/mcp/api-keys` 端与 UI，把内存桩替换为 PG 持久化实现。**

| 维度 | 决策 |
| --- | --- |
| 凭证形态 | `sk-mcp-<32B urlsafe>`，明文仅创建时返回一次 |
| 存储 | **仅存 sha256 十六进制**（硬规则 12），表 `mcp_api_keys` |
| 身份 | 绑 `tenant_id`；`auth_method = AuthMethod.API_KEY` |
| 校验接入点 | `install_auth(app, api_key_verifier=mcp_api_key_verifier)` |
| 权限范围 | **与 JWT 一致**（只读 + `ont_propose_*`），不引入 per-key scope 强制 |
| 签发/吊销 | 既有 `/api/v1/mcp/api-keys`（管理后台 MCP 中心 UI） |
| 注入 | PG `MATE_DB_URL` + alembic 迁移；Redis 30s 缓存限制吊销延迟 |

### 2.1 关键子决策：`mcp_api_keys` 刻意豁免 RLS

**`mcp_api_keys` 不得加入 `alembic/versions/20260801_0008_tenant_rls.py` 的
`TENANT_TABLES`。** 该迁移对列内每张表执行
`CREATE POLICY tenant_isolation ... USING (tenant_id = current_setting('app.tenant_id')::text)`。
而 API Key 验签时**必须先按 `key_hash` 查找、此刻尚不存在任何租户上下文**
（租户恰恰是查出来之后才知道的）。若纳入 RLS，`app.tenant_id` 为默认空串，
策略恒为假 → **所有 key 一律验证失败**，功能整体不可用。

豁免的安全论证：查找键是 256-bit 不可猜的 key hash，且查找结果只用于确定
该 key 自身的租户；越权者无法借此读取或枚举他租户数据。租户隔离对 key 的
**使用**（工具调用）仍然生效。

---

## 3. 理由

1. **复用而非新造**：接缝（`api_key_verifier`）、枚举（`AuthMethod.API_KEY`）、
   先例（llmgw）、端点（`/api/v1/mcp/api-keys`）、UI（`ApiKeyGenerator.tsx`）
   全部已存在。本次是把既有空壳做真，不是新建设施。
2. **可吊销优于不可吊销**：相比静态共享密钥（env + `hmac.compare_digest`），
   多密钥表允许单独吊销某一个客户端而不影响其他客户端，且签发/吊销/最后使用
   时间可审计。
3. **明文不落库**：只存 sha256，符合硬规则 12；DB 泄露不等于凭证泄露。
4. **权限不膨胀**：HITL 边界（`ont_confirm/reject/execute_proposal`）由
   `protocol/streamable.py` 无条件剥离 `__caller__` + `server.py` 的
   `agent_invokable` 门禁独立保障，**与凭证类型无关**。因此新增 key 通道
   在结构上不可能解锁 AI 直接落库。

---

## 4. 后果

### 4.1 已接受的限制（须在文档中如实说明，不得宣称已解决）

- **租户传播存在缺口**：streamable 协议层与本体代理工具当前的租户来源
  （`protocol/streamable.py` 的固定值 / `ontology_proxy.py` 的
  `TECH_ONT_TENANT` 环境变量）**不取自 key 记录**。因此 key 的 `tenant_id`
  目前只作用于 key 管理与 `RequestContext`，**尚未**实现按 key 隔离工具执行
  的数据面。真正的 per-key 工具数据隔离是后续独立工作项。
- **scope 选择器从 UI 移除**：per-key scope 未强制，保留选择器会造成
  "界面宣称 `tools:read`、实际可调全部工具"的误导。故移除选择器，UI 只
  陈述事实。
- **`mate-tech-mcp` 首次引入 PG 依赖**：此前该服务在 dev 下不接 PG
  （`repositories/sql_store.py` 实际未被运行时接线）。本次为其增加
  `MATE_DB_URL` 与 alembic 迁移，服务启动依赖 postgres healthy。

### 4.2 被否决的替代方案

| 方案 | 否决理由 |
| --- | --- |
| 静态共享密钥（env + `hmac.compare_digest`） | 无法单独吊销，泄漏只能靠重启换密钥；无 per-client 审计 |
| 密钥存 Redis | dev Redis 非持久，重启丢密钥导致全部客户端断连；审计性弱 |
| 延长 JWT / 放宽 refresh TTL | 改 Keycloak realm 配置会同时放宽所有交互式用户会话的时效，攻击面大于收益；且刷新仍需客户端交互 |
| 在网关层放行 MCP 路径 | 网关当前不做鉴权，把凭证判定下沉到网关会削弱"JWT 校验在各上游服务"的既有边界 |

---

## 5. 验证

- 单元/回归：`mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_api_keys.py`
  （含 fail-closed、跨租户、**持 key 仍无法调 HITL 工具**的回归）。
- 契约：三条既有路由补入 `contracts/openapi/services/mcp.yaml`，
  `npm run check` 重新 bundle 并提交生成物。
- 端到端：管理后台 MCP 中心签发 key → 以该 key 作 Bearer 调用
  `POST /api/v1/mcp/protocol/mcp` 完成 initialize + `tools/list` → 调
  `ont_confirm_proposal` 必须被拒。
