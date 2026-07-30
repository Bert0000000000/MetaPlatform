# ADR-0012：全栈租户隔离（SEC-TENANT-01）

> 状态：**Proposed**（待 SEC-TENANT-01 验收通过后转 Accepted）
> 日期：2026-07-30
> 关联批次：SEC-TENANT-01（PROGRAM-BOARD.md）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §12 / §13
> 上游依赖：API-GOV-01 ✅、ARCH-CORE-01 ✅、PLATFORM-K8S-01 ✅、SEC-IAM-01 ✅
> 下游影响：PLATFORM-EVENT-01、TECH-SERVICES、BUSINESS-SLICES、DATA-D0-D8、GA-ACCEPTANCE

---

## 1. Context

Mate Platform v3.0 是多租户（multi-tenant）平台。SEC-IAM-01 把 Keycloak 作为唯一
身份源落地，并把 `RequestContext.tenant_id` 写入了所有入站请求。但仅靠
"token 里带 tenant_id" 还不够：应用代码仍然可能在不感知 tenant 的情况下
读写跨租户数据。

§13 硬规则第 3 条明确规定：
> 没有 tenant 上下文，不访问 repository。

本 ADR 锁定 SEC-TENANT-01 的 5 层隔离策略 + 跨租户 admin 通道。

## 2. Decision

### 2.1 5 层隔离

| 层 | 机制 | 实现位置 |
|---|---|---|
| 1. HTTP | 每个入站请求的 `RequestContext.tenant_id` 由 AuthMiddleware 强制填充；任何 repository 入口必须先校验 `ctx.tenant_id` 非空。| `mate-platform/tenancy/guards.py` |
| 2. DB | SQLAlchemy event listener 拦截所有 SELECT / UPDATE / DELETE，强制注入 `tenant_id = :tenant_id` 谓词；带 `cross_tenant_admin` scope 的会话可绕过并触发审计。| `mate-platform/tenancy/db_filter.py` |
| 3. Kafka | Topic 命名约定 `metaplatform.<domain>.<tenant-id>.<event>`；producer 强制使用 `RequestContext.tenant_id` 拼前缀；consumer 必须验证消息的 tenant 与当前 session tenant 一致。| `mate-platform/messaging/kafka_tenant.py` |
| 4. Redis | 所有 key 强制前缀 `t:<tenant-id>:`；ACL Client 拒绝跨前缀读写。| `mate-clients/redis/keys.py` |
| 5. MinIO | 每租户独立 bucket `metaplatform-<tenant-id>`；通过 STS 临时凭证 + IAM policy 限制访问范围。| `mate-clients/minio/buckets.py` |

### 2.2 跨租户 admin 通道

`cross_tenant_admin` 作用域开启时：
- DB 谓词注入被跳过，session 进入"跨租户模式"。
- 每次读写触发 `audit.cross_tenant_access` 事件，payload 含 actor、target tenant、operation、query 摘要。
- 仅 `realm_access.roles` 含 `cross_tenant_admin` 的用户可启用；不通过 client_credentials 颁发。
- 跨租户操作不可在事务内嵌套；事务粒度内可单次跨，读写之间必须 commit 或 rollback。

### 2.3 Repository 协议

`mate-platform/tenancy/repository.py` 定义：

```python
class TenantScopedRepository(Protocol):
    def require_tenant(self, ctx: RequestContext) -> None: ...
    def filter_by_tenant(self, stmt: Select) -> Select: ...
    def assert_tenant_owned(self, row_id: Any, ctx: RequestContext) -> None: ...
```

任何 `app-*` 包继承此协议，SQLAlchemy session 在 open / first / get 操作前
调用 `require_tenant` 校验；CRUD 操作自动追加 `filter_by_tenant` 谓词。

### 2.4 TenantGuard 实现

`mate-platform/tenancy/guards.py` 实现 §13 第 3 条的硬要求：

```python
def require_tenant(ctx: RequestContext) -> None:
    if not ctx.tenant_id:
        raise TenantAccessError(
            "no tenant context; refusing repository access (hard rule 3)"
        )
    if ctx.auth_method == AuthMethod.ANONYMOUS:
        raise TenantAccessError("anonymous callers cannot access tenant data")
```

每个 repository / service 在第一行调用此函数。

### 2.5 提交顺序（强约束）

```
docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance
```

每个 PR 必须包含：
- ADR-0012 引用
- operationId 引用
- 跨租户 negative test 引用

## 3. Alternatives

### A. 仅靠应用层 tenant 校验

- **优点**：实现简单，无 DB / 中间件改动。
- **缺点**：每一行新代码都需手动校验，易遗漏；§13 第 3 条无机械保障。
- **否决理由**：硬规则要求"不访问 repository"是绝对保障，DB 层 event listener 是不可绕过的机械执行。

### B. PostgreSQL 原生 RLS（Row-Level Security）

- **优点**：DB 引擎层强制，最强保障。
- **缺点**：与多 DB 后端（MySQL / SQLite dev）不兼容；本项目 R5 报告明确 PG 16 生产但 dev 仍用 SQLite；RLS 在 SQLite / MySQL 上不存在等价物。
- **否决理由**：跨 DB 后端的可移植性更重要。SQLAlchemy event listener 在所有 SQL 后端表现一致，应用层用 RLS-friendly 的 `tenant_id` 列做 fallback。

### C. Schema-per-tenant（每租户独立 schema）

- **优点**：物理隔离，最安全。
- **缺点**：17 域 × N 租户的 schema 爆炸；migration 工具链要 N 倍工作量；租户配额和监控难以聚合。
- **否决理由**：仅适合 ≤ 10 租户的企业版；Mate Platform 面向数百租户。

### D. Database-per-tenant

- **优点**：物理隔离 + 简单 RBAC。
- **缺点**：运维成本 N 倍；连接池耗尽；metric / log 聚合困难；Data-D0-D8 批次会重新设计 data plane。
- **否决理由**：与 v3.0 多租户 SaaS 模式不兼容。

## 4. Consequences

### 4.1 正面

- §13 第 3 条"没有 tenant 上下文，不访问 repository" 通过 SQLAlchemy event listener 获得机械保障。
- 跨租户越权从"应用层不变量"提升为"DB 层拒绝"，即使应用代码漏掉 tenant 校验也无法越权。
- 5 层隔离对应 5 个独立纵深，单层失效不致越权。
- cross_tenant_admin 通过 audit 通道提供合法的运维 / SRE 通道，不留 shadow path。

### 4.2 负面 / 风险

- SQLAlchemy event listener 在 raw SQL / execute() 路径下不生效；强制所有 SQL 走 ORM 的 `select()` / `update()` / `delete()`。
- Kafka consumer 必须显式校验消息 tenant 与 session tenant；漏掉一条会越权。
- Redis prefix 是约定性隔离，运维误操作（手动 key flush）会绕过；用 `CLIENT NO-EVICT` + ACL 缓解。
- MinIO bucket 数量增长（每租户一个）；监控和成本需配合 FIN-OPS 跟踪。

### 4.3 缓解

- CI 静态检查禁止 `session.execute(text("..."))` 走 raw SQL；必须用 ORM 构造。
- Kafka consumer 入口强制 tenant 校验，单元测试覆盖跨租户消息拒收。
- Redis 用 `ACL` 配置 + `RENAME-COMMAND` 防误操作；定期 audit。
- MinIO bucket lifecycle 由 operator 守护进程管理（不在本批范围）。

## 5. Migration

按环境顺序推进：

```
dev → local → contract → integration → staging → pre-production → production
```

| 阶段 | 动作 | 验证 |
|---|---|---|
| dev | DB filter 旁路（`BYPASS_TENANT_FILTER=1`），SQLite 单租户跑通 | 单测全绿 |
| local | DB filter 启用，PG 16 跑 17 域端到端 | 跨租户 negative tests |
| contract | helm chart 升级 NetworkPolicy 允许 tenant filter 旁路 | helm template 0 错 |
| integration | Kafka + Redis + MinIO 全部启用 tenant prefix | 集成测试 |
| staging | 完整 5 层隔离 + cross_tenant_admin 通道 | DR + 越权矩阵 |
| pre-production | 真实数据 + 灰度 | 监控 + alert |
| production | GA 切流 | 13 硬规则 + SLO 达标 |

## 6. Verification

SEC-TENANT-01 退出条件（13 项硬规则映射）：

1. `pytest mate-platform/tests -q` 全绿（DB filter / TenantGuard / Repository）。
2. `pytest mate-clients/tests -q` 全绿（Redis prefix / MinIO bucket / Kafka topic）。
3. `pytest app-*/tests -q` 全绿（每 app 至少 3 个跨租户 negative case）。
4. `oasdiff` 无未批准 breaking change；securityScheme 已含 `tenantHeader`。
5. 跨租户越权 negative tests：HTTP 401 / DB 403 / Kafka 拒收 / Redis 拒读 / MinIO 403，
   每个 app 至少 3 个 case。
6. `helm template infra/helm/ -f values-production.yaml` + `kubeconform` 0 错。
7. `ruff check` 0 错。
8. `pyright --strict` 0 错。
9. SQLAlchemy event listener 在 integration 测试中实测：raw SQL 抛 TenantAccessError。
10. 13 门禁结果落档：本文 + 后续 SEC-TENANT-01-ACCEPTANCE.md。
11. PROGRAM-BOARD.md：SEC-TENANT-01 = **Accepted**。
12. CI 工作流 `platform-k8s-ci.yml` 增加 `security-tenant-ci` job
    （跨租户越权 + DB filter 单元测试）。
13. pre-commit hook 增加 raw-SQL 检测（禁止 `session.execute(text("..."))` 出现在
    `app-*/src` 下）。

## 7. References

- `docs/active/decisions/ADR-0010-platform-k8s-baseline.md`
- `docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md`
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §13
- `docs/active/delivery/PROGRAM-BOBOARD.md`
- `docs/active/delivery/evidence/SEC-IAM-01-ACCEPTANCE.md`
- `mate-platform-backend/contracts/openapi/common/security.yaml`
- `mate-platform-backend/contracts/openapi/common/tenancy.yaml`（待创建）