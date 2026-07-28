# mate-api-gateway

Mate Platform API Gateway — L7 路由 + 聚合 + Redis 限流。

## 架构位置

```
Internet / Frontend (BFF)
        |
   [Traefik]      <-- edge TLS / rate-limit / forward-auth (Keycloak)
        |
   [api-gateway]  <-- 本服务: 内部服务路由 + tenant 限流
        |
   +----+----+----+----+----+
   |    |    |    |    |    |
  rag  agent llmgw ont mcp ...
```

> **职责分离**:
> - **Traefik** (profile: edge) — TLS / WAF / OIDC 转发鉴权 / 全局限流
> - **api-gateway** (本服务) — 内部 L7 路由 / 租户级细粒度限流 / 聚合
> - **auth-service** (mate-auth-service) — JWT 验证 + 租户识别 (供内部调用)

## 路由表

| Path 前缀 | 上游服务 | 默认地址 |
|---|---|---|
| `/api/v1/rag/` | mate-tech-rag | `http://mate-tech-rag:8001` |
| `/api/v1/agent/` | mate-tech-agent | `http://mate-tech-agent:8002` |
| `/api/v1/llm/` | mate-tech-llmgw | `http://mate-tech-llmgw:8008` |
| `/api/v1/kb/` | mate-app-kb | `http://mate-app-kb:8003` |
| `/api/v1/ont/` | mate-tech-ont | `http://mate-tech-ont:8007` |
| `/api/v1/mcp/` | mate-tech-mcp | `http://mate-tech-mcp:8081` |

所有 `*_URL` 可通过环境变量覆盖（`RAG_URL`、`AGENT_URL` 等）。

## 限流

- **算法**: 固定窗口 (fixed window, per minute)
- **键**: `rl:<tenant>:<minute_bucket>`
- **阈值**: `RATE_LIMIT_PER_MIN` (默认 600/分钟)
- **超限响应**: `429 Too Many Requests` + `Retry-After: 60`
- **租户识别**: `X-Tenant-Id` header 优先, fallback 到 client IP

## Endpoints

| Method | Path | 用途 |
|---|---|---|
| GET | `/healthz` | liveness |
| GET | `/readyz` | 探测所有上游 `/healthz` |
| * | `/api/v1/{prefix}/{path}` | 代理到对应上游 |

## 本地运行

```bash
cd mate-platform-backend
uv sync
REDIS_URL=redis://localhost:6379/0 \
RAG_URL=http://localhost:8001 \
AGENT_URL=http://localhost:8002 \
uv run uvicorn mate_api_gateway.main:app --reload --port 8100
```

## Docker

参见根 `docker-compose.yml` 中 `mate-api-gateway` 服务 (默认 profile 不启动, 需 `services/api-gateway/` 目录存在)。