# DEPRECATED — `mate-tech-iam` 包

> **状态：DEPRECATED** — SEC-IAM-01 起弃用
> **替换路径：** `mate-platform.auth.*`（入站 JWT 验证）+ `mate-clients.security.*`（出站 Bearer）
> **移除计划：** 计划在下一次大版本（v3.1 / v4.0）时从主构建中完全删除。本包仍可独立运行（仅 dev profile），供历史回滚与对比测试使用。

## 为什么弃用

- 双源身份不一致风险（同步延迟 → 越权）。
- 维护成本翻倍：本地 SQLite/PG schema + Keycloak realm 同步。
- 与 `docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md` 中"唯一身份源 = Keycloak"原则冲突。
- §13 硬规则 5：production profile 禁止 fake / mock / memory fallback；本包在 dev profile 是 fallback 路径。

## 保留原因

- 历史回滚窗口：若 Keycloak 上线后出现严重事故，可临时回退。
- 单测对照：现有 13 个 pytest 文件（test_auth.py 等）保留，作为对 Keycloak 路径的回归基线。
- 迁移文档：作为 SEC-IAM-01 迁移的"before"快照。

## 不再做的事

- ❌ 不再为该包新增 endpoint。
- ❌ 不再将任何 OpenAPI operation 路由到 `mate_tech_iam.main:app`。
- ❌ 不再在 CI 部署或 Argo CD ApplicationSet 中引用（`infra/argocd/applicationset.yaml` 已剔除 iam 域的 application）。
- ❌ 不再在生产 profile（`LEGACY_LOGIN_COMPAT != true`）下被加载。

## 临时例外

- dev profile 可继续 `LEGACY_LOGIN_COMPAT=true` 启动；该 env 在生产 profile 下必须为 `false`，否则 `mate-platform.auth.config.load_auth_config()` 抛 `RuntimeError` 拒绝启动。
- 单测与本地开发的 HS256 JWT 模式保留；不在生产路径上。