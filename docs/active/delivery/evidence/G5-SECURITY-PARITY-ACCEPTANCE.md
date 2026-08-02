# G5 — Security 三段式补齐 — ACCEPTANCE

> **Batch**: G5-SECURITY-PARITY  
> **Date**: 2026-08-02  
> **Status**: Accepted  
> **Related**: v3.2 W3 Week2 · ADR-0011 (SEC-IAM-01) · 13 硬规则 §1

## 1. 目标

确保 17 域 service YAML 中每个 HTTP endpoint 都有完整的三段式
security contract：

```yaml
security:
  - bearerAuth: []          # Keycloak JWT
    tenantHeader: []        # X-Tenant-Id
    oidcScopes: [platform.read | platform.write | platform.admin]
```

## 2. Scope 分配规则

| 条件 | oidcScopes |
|---|---|
| GET / HEAD / OPTIONS | `[platform.read]` |
| POST / PUT / DELETE / PATCH | `[platform.write]` |
| `/admin/` + GET | `[platform.admin]` |
| `/admin/` + POST/PUT/DELETE | `[platform.write, platform.admin]` |

## 3. 豁免规则

| 路径 | 理由 |
|---|---|
| `/healthz` `/readyz` `/health` | 基础设施探针，最多 bearerAuth |
| `/metrics` | Prometheus scrape，无需 auth |
| `security: []` endpoints | 登录/刷新/SSO 等故意公开 |

## 4. 补齐统计

| 域 | endpoints 补齐 |
|---|---|
| a2a | 2 |
| agent | 5 |
| apphub | 5 |
| arch | 29 |
| copilot | 35 |
| dashboard | 33 |
| data | 39 |
| dw | 15 |
| iam | 38 (含 25 admin) |
| kb | 5 |
| llmgw | 4 |
| mcp | 12 (含 1 +tenantHeader) |
| msg | 2 |
| obs | 7 |
| ont | 12 |
| rag | 7 |
| wfe | 2 |
| **TOTAL** | **252 endpoints, 253 行插入** |

## 5. 测试覆盖

`infra/tests/test_g5_security_parity.py` — 6 个测试函数：

1. `test_secured_endpoints_have_three_part_security` — 每个非豁免 endpoint
   必须有 bearerAuth + tenantHeader + oidcScopes
2. `test_oidc_scopes_valid_and_appropriate` — scope 值有效且与 HTTP method 匹配
3. `test_write_endpoints_not_read_only` — 写操作必须含 platform.write
4. `test_admin_endpoints_use_admin_scope` — admin 路径必须含 platform.admin
5. `test_health_endpoints_exempt_from_oidc` — 健康探针豁免 oidcScopes
6. `test_secured_endpoint_inventory_non_empty` + `test_all_seventeen_domains_present` — inventory 守卫

## 6. 关联

- ADR-0011: SEC-IAM-01 Keycloak JWT 验证 + 服务身份
- 13 硬规则 §1: Swagger 没有接口，不写 route
- `test_g5_security_coverage.py`: per-endpoint security coverage
- `test_service_security_segments.py`: securitySchemes + contract 级别
