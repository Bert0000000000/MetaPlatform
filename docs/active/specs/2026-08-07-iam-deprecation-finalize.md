# mate-tech-iam DEPRECATED 落地（GOVERN-02）

> 编制：2026-08-07 · 维护：MatePlatform Architecture Council · 关联：ADR-0011 / SEC-IAM-01-ACCEPTANCE
>
> 状态：**DEPRECATED** · 默认 profile 下不启动；`--profile deprecated-iam` / `audit` 才拉起。
> 退役时间窗口：**2026-08-07 → 2026-12-31**（与 v1 ontology router Sunset 一致）
>
> **2026-08-11 GOVERN-02-FIX 修订**：mate-tech-iam 的 7 个 router（dashboard/users/permissions/orgs/logs/configs/models，共 100+ 路由）已完整镜像到 mate-auth-service；api-gateway ROUTE_MAP 已把 `/api/v1/dashboard/` 与 `/api/v1/admin/` 从 `iam-admin` 切换到 `iam`。详见 [SEC-IAM-01-ACCEPTANCE.md §5](../delivery/evidence/SEC-IAM-01-ACCEPTANCE.md#5-2026-08-11-govern-02-fix--dashboardadmin-路由完整迁移到-mate-auth-service)。

## 1. 退役原因

| 维度 | 旧（mate-tech-iam:8102） | 新（mate-auth-service:8101） |
|---|---|---|
| 协议 | 自研 BearerAuth + `INSECURE_SKIP_SIGNATURE=true` | Keycloak JWT + JWKS 验签 |
| 13 硬规则 #5 | startup guard 允许 dev fallback | 强制 SEC-IAM-01，禁止 fallback |
| 租户隔离 | 模块级单例 `mate_tech_iam` | `mate-platform/auth` + `RequestContext` |
| API Gateway ROUTE_MAP | `/api/v1/admin/*`、`/api/v1/dashboard/*` 同时打 iam-admin | 同上 + 全部走 Keycloak |
| OTel | 仅 `OTEL_SERVICE_NAME=mate-tech-iam` | 全套 OTEL 自动埋点 + 租户 span 属性 |

## 2. 落地动作（2026-08-07 已执行）

1. `mate-platform-backend/pyproject.toml:95` pythonpath 删除 `packages/mate-tech-iam/src`（pytest 不再收录）
2. `docker-compose.yml` 服务块加 `profiles: ["deprecated-iam", "audit"]`，默认不拉起
3. api-gateway env `IAM_ADMIN_URL` 重定向至 `mate-auth-service:8101`（不再依赖 iam-admin）
4. api-gateway depends_on 注释 `mate-tech-iam`，audit profile 才解注
5. 新增 `forbid_iam_dep_imports.py` CI 守门（`scripts/ci/`），扫描 `from mate_tech_iam import` / `import mate_tech_iam`
6. `packages/mate-tech-iam/DEPRECATED.md` 加 deprecation header

## 3. 退役时间表

| 阶段 | 日期 | 动作 |
|---|---|---|
| T0 | 2026-08-07 | compose profile + pythonpath + URL 重定向（本 spec 落地） |
| T1 | 2026-09-30 | 全仓 grep `mate_tech_iam` 残留 ≤ 0（仅 acceptance/ARCHIVE） |
| T2 | 2026-11-30 | docker-compose 默认 profile 完全不提 `mate-tech-iam`；只剩 audit profile |
| T3 | 2026-12-31 | 移除 `packages/mate-tech-iam/` 物理包；alembic 单库迁移迁完即删 |

## 4. 验收（机器可检查）

```bash
# 默认 profile 不含 iam
docker compose config -q          # exit 0，无 mate-tech-iam service

# audit profile 仍可启动
docker compose --profile deprecated-iam config -q   # exit 0

# pythonpath 不含 iam
python -c "import tomllib; print('mate-tech-iam' in str(tomllib.loads(open('mate-platform-backend/pyproject.toml').read())['tool']['pytest']['ini_options']['pythonpath']))"
# → False

# CI 守门无残留生产 import
python scripts/ci/forbid_iam_dep_imports.py        # exit 0
```

## 5. 影响

- 13 硬规则 #5（Production profile 禁止 fallback）正式闭环
- 13 硬规则 #12（Secret 不进 git）覆盖 `INSECURE_SKIP_SIGNATURE` 入口
- 退役完成前禁止任何新代码 import `mate_tech_iam`
