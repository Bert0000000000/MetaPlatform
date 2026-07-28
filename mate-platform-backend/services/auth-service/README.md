# mate-auth-service

Mate Platform Auth Service — JWT 校验 + 租户识别 (via Keycloak JWKS)。

## 职责 (per agent.md)

> **AuthService 独立 FastAPI 微服务，做 JWT 校验 + 租户识别（不做切流决策）**

✅ **做**:
- JWT 验证 (RS256/RS384/RS512, Keycloak JWKS)
- 租户识别 (从 `tenant_id` / `organization` claim)
- Token 黑名单 (Redis, 登出/吊销)
- 转发 OIDC `/userinfo` (RFC 7662)
- JWKS 缓存 (Redis, 5min TTL)

❌ **不做**:
- 不发 token (Keycloak)
- 不做用户/角色管理 (Keycloak admin API)
- 不做切流/限流决策 (Traefik 边网关)

## Endpoints

| Method | Path | 用途 |
|---|---|---|
| GET | `/healthz` | liveness |
| GET | `/readyz` | 检查 JWKS + Redis |
| POST | `/api/v1/auth/verify` | 验签 + 返回 claims |
| POST | `/api/v1/auth/revoke` | 吊销 JTI (logout) |
| GET | `/api/v1/auth/userinfo` | OIDC userinfo 代理 |

## 调用示例

```bash
# 1. 验证
curl -X POST http://localhost:8101/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$ACCESS_TOKEN\"}"
# => {"valid": true, "subject": "abc-123", "tenant_id": "acme", "roles": ["developer"], ...}

# 2. 登出
curl -X POST http://localhost:8101/api/v1/auth/revoke \
  -H "Content-Type: application/json" \
  -d "{\"jti\": \"$TOKEN_JTI\"}"

# 3. 透明 userinfo 代理
curl http://localhost:8101/api/v1/auth/userinfo \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `KEYCLOAK_URL` | `http://keycloak:8080` | Keycloak 公开 URL (用于签发 token) |
| `KEYCLOAK_INTERNAL_URL` | 同上 | Keycloak 内部 URL (服务间调用) |
| `KEYCLOAK_REALM` | `metaplatform` | Realm 名 |
| `KEYCLOAK_CLIENT_ID` | `metaplatform-backend` | 受众 (aud claim) |
| `REDIS_URL` | `redis://redis:6379/0` | JWKS 缓存 + 黑名单 |
| `JWKS_REFRESH_SEC` | `300` | JWKS 缓存 TTL |
| `PORT` | `8101` | HTTP 端口 |

## 与 Traefik / api-gateway 协作

```
[Client] -- Bearer JWT --> [Traefik] -- forward-auth --> [mate-auth-service]
                                |                              |
                                | 200 OK + X-Tenant-Id 头       |
                                <------------------------------+
                                |
                                v
                          [api-gateway] (读取 X-Tenant-Id 做限流)
```

Traefik 配 `forwardauth` middleware (见 `infra/traefik/dynamic.yml`)，未通过验证的请求被 401 拦截。

## 本地运行

```bash
cd mate-platform-backend
uv sync
KEYCLOAK_URL=http://localhost:8180 \
KEYCLOAK_REALM=metaplatform \
uv run uvicorn mate_auth_service.main:app --reload --port 8101
```