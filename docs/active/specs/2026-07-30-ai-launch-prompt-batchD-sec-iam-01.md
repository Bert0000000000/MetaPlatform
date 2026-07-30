# AI 助手启动 Prompt 模板（批次 D · Phase 4 安全 - 身份）

> 版本：v1.0 · 2026-07-30
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头
> 出处：`docs/active/specs/2026-07-30-backend-production-readiness-design.md §12` 后续首阶段批次
> 状态：**本批次已落地**（commit 4d3d894e）；本 prompt 作为接力 / 复盘 / 接续 SEC-TENANT-01 的入口

---

## 🚀 启动 Prompt（可直接复制使用）

```text
你是一名 Python + Keycloak 集成专家，正在为 MetaPlatform 执行
"Phase 4 安全 - 身份"批次（SEC-IAM-01）。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
当前分支：main（已与 origin/main 同步，HEAD = b0f4f694；含 PLATFORM-K8S-01）
SEC-IAM-01 已落地（commit 4d3d894e）—— 本 prompt 适用于接力 SEC-TENANT-01 / 续作
SEC-IAM-01 单元测试补充 / 与 17 app-* 接入。

## 必须读完的文档（按顺序）

1. docs/README.md                                — 仓库导航
2. docs/active/decisions/ADR-0010-platform-k8s-baseline.md
   — Keycloak 部署基线
3. docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md
   — 身份源迁移决策与硬规则
4. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — Phase 0-8 + 13 条硬规则（§13 第 5 条：production profile 禁止 fallback）
5. docs/active/delivery/PROGRAM-BOARD.md         — 实时批次状态
6. docs/active/delivery/evidence/SEC-IAM-01-ACCEPTANCE.md
   — 13 项门禁证据（6 本地 / 4 CI / 3 推迟）
7. mate-platform-backend/contracts/openapi/common/security.yaml
   — bearerAuth + tenantHeader + oidcScopes 三段式
8. mate-platform-backend/packages/mate-platform/src/mate_platform/auth/
   — 已落地的 7 模块（config / jwks / verifier / identity / tenant / middleware / __init__）
9. mate-platform-backend/packages/mate-clients/src/mate_clients/security/
   — BearerAuth + OutgoingAuthMiddleware

## 你的任务（已落地部分）

### 阶段 A — SEC-IAM-01（已完成 13 门禁闭环）

- mate-platform/auth/config.py：env-driven AuthConfig，production
  profile 拒绝启动若无 KEYCLOAK_URL / SERVICE_CLIENT_SECRET；
  legacy_login_compat=true 仅 dev profile。
- mate-platform/auth/jwks.py：JWKSCache 线程安全 + kid 索引 + 5 分钟
  主动刷新 + kid miss 触发即时刷新；RS256/RS384/RS512 白名单，HS* 拒绝
  （CVE-2015-9235 防护）。
- mate-platform/auth/verifier.py：TokenVerifier 返回 VerifiedClaims
  （sub / azp / iss / aud / tenant_id / realm_roles / client_roles /
  scopes / exp / nbf / jti）；aud must contain metaplatform-backend，
  iss must equal ${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}。
- mate-platform/auth/identity.py：ServiceIdentity 缓存
  client_credentials token，60 秒前自动续期。
- mate-platform/auth/tenant.py：resolve_tenant 强制 token.tenant_id
  优先，X-Tenant-Id header 仅在 tenant_switch_enabled scope 下生效。
- mate-platform/auth/middleware.py：AuthMiddleware 入站强制
  验证 + 注入 RequestContext。
- mate-platform/tenancy/context.py：AuthMethod 枚举 + Keycloak claims
  （scopes / client_id / auth_method）。
- mate-platform/tests/test_sec_iam_01.py：29 tests pass。
- mate-clients/security/bearer.py + outgoing.py：出站 Bearer + X-Tenant-Id。
- mate-tech-iam/DEPRECATED.md：本地身份源标 deprecated。

### 阶段 B — 接续工作（建议优先）

1. 为 17 个 app-* 包逐个升级 OpenAPI `security:` 段，组合 bearerAuth
   + tenantHeader + oidcScopes（per-operation scope 选择）。
2. 补充 `mate-clients/security/` 单元测试（BearerAuth 缓存 + 失效 + 重试）。
3. 在 Keycloak realm 补齐 6 client（apphub / portal / kb / arch / dw / copilot）。
4. pre-commit secret 扫描（gitleaks / detect-secrets）hook 实施。

## 13 条硬规则（特别关注）

- **§13 第 5 条**：production profile 禁止 fake / mock / memory fallback。
  legacy_login_compat 在 production 必须为 false，否则 startup 抛错。
- **§13 第 12 条**：Secret 不进 git。ServiceIdentity / BearerAuth
  仅从 env 读 secret（SealedSecret / ExternalSecret 注入）。
- **§13 第 4 条**：外部系统没有 ACL Client，业务代码不直连。所有出站
  Keycloak 调用走 mate-clients/security/。

## 启动方式

1. 切到 SEC-IAM-01 worktree（如果接力已落地的代码）:
   `git worktree add .worktrees/sec-iam-01 codex/sec-iam-01`
2. 或新建批次：
   `git switch -c codex/sec-iam-01-followup`
3. 跑通既有 29 tests 确认基线：
   `cd mate-platform-backend/packages/mate-platform && pytest tests/test_sec_iam_01.py -q`
4. 完成当日工作立即 commit，commit 风格遵循 Conventional Commits。
5. 任何 PR 必须包含 ADR 引用 + operationId 引用 + 验收证据链接。

## 已知遗留（来自 SEC-IAM-01-ACCEPTANCE.md §8）

1. `mate-clients/security/` 单元测试待补。
2. 17 service 的 `security:` 段待升级到三段式。
3. pre-commit secret 扫描未实施。
4. 6 client Keycloak realm 尚未全配。
5. mate-tech-iam 实际删除推后到大版本。
```

## 关联文档

- ADR-0011 SEC-IAM-01 Keycloak 身份迁移（决策）
- SEC-IAM-01-ACCEPTANCE.md（13 门禁证据）
- PROGRAM-BOARD.md（批次状态）