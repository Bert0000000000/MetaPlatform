# ADR-0011：身份源迁移到 Keycloak（SEC-IAM-01）

> 状态：**Proposed**（待 SEC-IAM-01 验收通过后转 Accepted）
> 日期：2026-07-30
> 关联批次：SEC-IAM-01（PROGRAM-BOARD.md）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §12
> 上游依赖：API-GOV-01 ✅ Accepted、ARCH-CORE-01 ✅ Accepted、PLATFORM-K8S-01 ✅ Accepted
> 下游影响：SEC-TENANT-01、PLATFORM-EVENT-01、TECH-SERVICES、BUSINESS-SLICES、DATA-D0-D8、GA-ACCEPTANCE

---

## 1. Context

MetaPlatform 历史上由 `mate-tech-iam`（FastAPI + SQLite/Postgres + 自签 HS256 JWT）
提供本地身份源，包含用户、角色、权限、组织、SSO provider 配置等。ARCH-CORE-01 已
删除 `services/api-gateway` / `services/auth-service` 等旧 v2 组件，但
`mate-tech-iam` 作为四层结构下的 tech-iam 包仍保留。

`mate-platform/auth/__init__.py` 当前只是占位 docstring（"real implementation
lands in SEC-IAM-01"），意味着 Phase 0 时已预留接口但未落地实现。

PLATFORM-K8S-01 已把 Keycloak 24.x 作为唯一身份源在 K8s 上部署（infra/helm/）。
本 ADR 锁定 SEC-IAM-01 的迁移策略。

## 2. Decision

SEC-IAM-01 落地以下变更：

### 2.1 删除本地身份源

`mate-tech-iam` 包标记为 **deprecated**，在 SEC-IAM-01 完成后从主构建中剔除
（生产构建不再 include router），但保留在 git 历史中作为可回滚的归档。
具体动作：
- `mate-platform-backend/contracts/openapi/manifest.yaml` 中
  `iam.runtimeModule` 由 `mate_tech_iam.main:app` 改为 `null`
  （manifest.yaml 已记录此值；本 ADR 仅为状态声明）。
- `infra/argocd/applicationset.yaml` 不再为 `iam` 域生成 Application。
- `docker-compose.yml` / `docker-compose.override.yml` 中的 `mate-tech-iam`
  service 段删除。
- 任何 `from mate_tech_iam ...` 引用由新的 `mate-platform.auth.*` /
  `mate-clients.security.*` 模块替代。

### 2.2 JWKS 客户端（mate-platform/auth/jwks.py）

- 启动时从 Keycloak `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`
  拉取 JWKS。
- 后台线程每 5 分钟（KEYCLOAK_JWKS_REFRESH_INTERVAL）刷新；强制
  `X-Robots-Tag: noindex`，幂等。
- 缓存用 `dict[str, JWK]` 按 `kid` 索引，线程安全（RLock）。
- 签名验证优先查 kid；未命中则触发立即刷新一次（key rotation 容错）。
- 算法白名单 RS256 / RS384 / RS512（拒绝 HS*，避免 alg confusion 攻击）。
- `aud` 必须包含 `metaplatform-backend`；`iss` 必须等于 `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`。

### 2.3 RequestContext 强化

`mate-platform/tenancy/context.py` 的 `RequestContext` 增加 Keycloak claims：

```python
@dataclass(frozen=True, slots=True)
class RequestContext:
    request_id: str          # X-Request-ID 头
    trace_id: str            # OpenTelemetry trace id
    tenant_id: TenantId      # 来自 token.tenant_id（Keycloak attribute）
    user_id: UserId          # token.sub
    roles: frozenset[str]    # realm_access.roles
    permissions: frozenset[str]  # resource_access[client].roles
    scopes: frozenset[str]   # token.scope
    client_id: str           # token.azp（client_credentials 场景）
    auth_method: AuthMethod  # USER | SERVICE | ANONYMOUS
    locale: str = "en"
```

新 `AuthMethod` 枚举区分用户态、服务态、匿名态。

### 2.4 服务身份（client_credentials）

- 服务身份通过 `client_credentials` OAuth2 grant 获取 token。
- 注入 `RequestContext` 时 `auth_method = SERVICE`，`user_id = sub = <client-id>`。
- `roles` 来自 `resource_access[<client-id>].roles`（Keycloak 给每个 client
  独立 role namespace）。
- 禁止服务身份携带 `tenant_id = "*"` 或 `tenant_id = ""` 越权穿透。
  SEC-TENANT-01 阶段会进一步强制服务身份的 tenant 边界。

### 2.5 Tenant 映射

- Keycloak 中 `user.attributes.tenant_id` 是 SSO → tenant 的桥。
- 用户的 `tenant_id` 强制来自 token claims，不接受请求头注入。
- `X-Tenant-Id` 请求头只用于 BFF 内部"切换 active tenant"场景，必须配
  `tenant_switch_enabled=true` 的 service account 签名。
- 跨租户访问仅在 `cross_tenant_admin=true` 用户角色下允许，且全部走
  `audit.cross_tenant_access` 审计通道（写入 OBS）。

### 2.6 OpenAPI securityScheme 升级

`mate-platform-backend/contracts/openapi/common/security.yaml` 增加：

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        Keycloak RS256 JWT. aud must include `metaplatform-backend`.
        iss must equal `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`.
    tenantHeader:
      type: apiKey
      in: header
      name: X-Tenant-Id
      description: |
        Tenant binding. Required for BFF multi-tenant flows.
        Must equal `token.tenant_id` (mismatch = 403).
    oidcScopes:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: ${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token
          scopes:
            platform.read: Read-only access
            platform.write: Mutation access
            platform.admin: Service-to-service admin
```

每个 service 的 `security:` 段从单 `bearerAuth` 升级为：

```yaml
security:
  - bearerAuth: []
    tenantHeader: []
    oidcScopes: [platform.read]
```

（写操作替换为 `platform.write`，管理操作为 `platform.admin`。）

### 2.7 mate-clients/security/ 适配器层

- `BearerAuth`：从环境变量 `CLIENT_ID` / `CLIENT_SECRET` 启动时获取
  `client_credentials` token；过期前 60 秒续期；缓存到内存。
- `OutgoingAuthMiddleware`：httpx 中间件，在每次出向请求自动注入
  `Authorization: Bearer <token>` + `X-Tenant-Id: <ctx.tenant_id>`。
- 对外调用必须走 mate-clients（§13 硬规则 4），无 ACL Client 禁止业务代码直连。

## 3. Alternatives

### A. 保留 mate-tech-iam 作为"影子本地身份源"

- **优点**：过渡期容错。
- **缺点**：双源不一致风险（同步延迟 → 越权）、运维成本翻倍、与 PLATFORM-K8S-01
  唯一身份源目标冲突。
- **否决理由**：硬规则 5（"Production profile 禁止 fake / mock / memory fallback"），
  影子源在生产 profile 下等同 fallback。

### B. 直接切到 Auth0 / Cognito 等托管 IdP

- **优点**：免运维 Keycloak。
- **缺点**：与多云中立 + 私有部署兼容目标冲突；租户数据出境合规风险。
- **否决理由**：与 v3.0 自建治理原则不符。

### C. 用 OAuth2 替代 OIDC

- **优点**：协议更轻。
- **缺点**：丢失 id_token 与 userinfo，Keycloak 的 realm/role 抽象用不上。
- **否决理由**：OIDC 是事实标准，且 Keycloak 自身就是 OIDC provider。

### D. JWT 离线验证（不拉 JWKS）

- **优点**：减少 Keycloak 依赖。
- **缺点**：key rotation 必须发版，不满足 §13 硬规则 8（readiness + 回滚）。
- **否决理由**：JWKS rotation 才是生产可用的密码学实践。

## 4. Consequences

### 4.1 正面

- 唯一身份源 = 单一攻击面 = 简化 §13 硬规则 9（审计/指标/trace）落地。
- Keycloak 自带 client_id / role / group 三层 RBAC，可直接喂入 mate-platform 的
  RequestContext。
- JWKS rotation 模式天然支持 key rollover（§13 硬规则 8）。
- 服务身份 + 用户身份共享同一 token 协议栈，但通过 `azp` 与 `sub` 字段
  在 RequestContext 中清晰区分。

### 4.2 负面 / 风险

- 迁移窗口期需要双源兼容：保留一个 `legacy_login_compat=true` 旗标，
  灰度期间仍可走 `mate-tech-iam` 的 HS256 JWT（仅 dev profile）。
  在 §13 硬规则 5（production no fallback）下，该旗标在 production profile
  必须为 `false`，由 env 校验在 startup 阶段抛错。
- Keycloak 不可用时所有 token 验证失败 → 整平台断电。需 Keycloak HA
  部署（PLATFORM-K8S-01 已用 replicas: 3 production）。
- 服务身份的 client_secret 走 SealedSecret / ExternalSecret，
  不能进入 git；CI 上预检 helm-template 渲染，禁止 raw secret 出现。

### 4.3 缓解

- Keycloak HA：production 3 副本（PLATFORM-K8S-01 values-production）。
- JWKS 本地缓存 + 5 分钟主动刷新 + 失败时降级到上一次已知 JWKS（仅验签，不发新 token）。
- `legacy_login_compat` 仅 dev profile 启用，env 校验抛错。
- Service secret 走 SealedSecret / ExternalSecret，CI 用 helm template
  静态扫描 `value: "..."` 形式注入的 secret。

## 5. Migration

按环境顺序推进（与 production-readiness §10 一致）：

```
dev → local → contract → integration → staging → pre-production → production
```

| 阶段 | 动作 | 验证 |
|---|---|---|
| dev | `legacy_login_compat=true`，mate-tech-iam HS256 仍可用 | 端到端冒烟 |
| local | Keycloak 本地 helm install，JWKS 端到端跑通 | pytest 跨租户 negative cases |
| contract | helm template + kubeconform | contract CI 全绿 |
| integration | Keycloak 真实启动，17 个 app 切换到 bearer + tenantHeader | 17 域端到端 e2e |
| staging | 完整 13 硬规则跑通 | DR 演练 + 跨租户越权矩阵 |
| pre-production | 真实数据 + 灰度切流 | 全量 e2e + 性能基线 |
| production | GA 切流，旧 mate-tech-iam 路由全部 404 | 0 越权 + 0 服务身份越界 |

回退路径：若 SEC-IAM-01 production 上线后出现重大故障，PLATFORM-K8S-01
ApplicationSet 单一 application 回滚到上一 commit；Keycloak realm 通过
admin REST API 增量恢复。

## 6. Verification

SEC-IAM-01 退出条件（13 项硬规则映射）：

1. `pytest mate-platform/tests -q` 全绿（含 JWKS rotation + token verify + service identity）。
2. `pytest mate-clients/tests -q` 全绿（含 BearerAuth + OutgoingAuthMiddleware）。
3. `pytest mate-tech-iam/tests -q` 全绿（**保留回归**，但路由在新构建中不被 include），
   验证旧 IAM 仍可独立运行（仅 dev profile）。
4. `oasdiff services/iam.yaml` 无未批准 breaking change；securityScheme
   升级合规（oasdiff 通过）。
5. 跨租户越权 negative tests：每个 app 至少 3 个 case（拒绝 wrong tenant、
   拒绝 expired token、拒绝 missing scope）。
6. `helm template infra/helm/ -f values-production.yaml` + `kubeconform` 0 错。
7. `ruff check mate-platform mate-clients` 0 错。
8. `pyright --strict mate-platform mate-clients` 0 错。
9. Keycloak realm 启动导入 6 client + 3 role（admin / developer / viewer），
   apphub client_credentials 拿 token 成功。
10. 13 门禁结果落档：本文 + 后续 SEC-IAM-01-ACCEPTANCE.md。
11. PROGRAM-BOARD.md：SEC-IAM-01 = **Accepted**。
12. CI 工作流 `platform-k8s-ci.yml` 增加 `security-iam-ci` job
    （JWT 单元测试 + OpenAPI securityScheme 校验）。
13. `pre-commit` hook 增加 secret 扫描（gitleaks / detect-secrets），
    防止 raw secret 进入 git。

## 7. References

- `docs/active/decisions/ADR-0010-platform-k8s-baseline.md`（上游 Keycloak 基线）
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §12 / §13
- `docs/active/specs/2026-07-30-ai-launch-prompt-batchC-platform-k8s.md`
- `docs/active/delivery/PROGRAM-BOARD.md`（批次跟踪）
- `docs/active/delivery/evidence/PLATFORM-K8S-01-ACCEPTANCE.md`（前置 DoD）
- `mate-platform-backend/contracts/openapi/common/security.yaml`（被升级对象）
- `mate-platform-backend/contracts/openapi/manifest.yaml`（runtimeModule 表）
- `infra/helm/charts/keycloak/values.yaml`（Keycloak 部署契约）
- `infra/keycloak/realm-mate.json`（realm + 6 client 模板）