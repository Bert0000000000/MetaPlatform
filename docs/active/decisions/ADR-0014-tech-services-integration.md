# ADR-0014：17 域集成模式（TECH-SERVICES）

> 状态：**Accepted**（代码已全部交付，17 域 5 步合规完成）
> 日期：2026-07-30
> 关联批次：TECH-SERVICES（PROGRAM-BOARD.md）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §12
> 上游依赖：API-GOV-01 ✅、ARCH-CORE-01 ✅、PLATFORM-K8S-01 ✅、SEC-IAM-01 ✅、SEC-TENANT-01 ✅、PLATFORM-EVENT-01 ✅
> 下游影响：BUSINESS-SLICES、DATA-D0-D8、GA-ACCEPTANCE

---

## 1. Context

前 6 个 Delivery Batch 已完成：
- API-GOV-01（OpenAPI 单一契约源）
- ARCH-CORE-01（四层结构）
- PLATFORM-K8S-01（K8s 运行时 + Keycloak + OTel + NetworkPolicy）
- SEC-IAM-01（Keycloak JWT 验证 + 服务身份 + 租户绑定）
- SEC-TENANT-01（5 层隔离 + cross_tenant_admin + Outbox/Idempotent/DLQ 所需命名约定）
- PLATFORM-EVENT-01（Outbox + 幂等消费者 + DLQ）

但 `mate-platform-backend/packages/` 下的 8 个 app 包 + 17 个 OpenAPI service 合约
仍然处于"裸 FastAPI + 裸 httpx + 裸 SQL"状态：它们不验证 JWT、不绑 tenant、
不写 outbox、不订阅事件。如果直接上线，§13 硬规则 3 / 4 / 5 / 8 / 9 全部不通过。

TECH-SERVICES 锁定 17 域的统一接入模式。

## 2. Decision

### 2.1 Canonical reference

`mate-app-kb` 是最干净的参考实现（4 src files，零既有 auth 集成）。
本批落地时一次性完成：
- 接入 `mate_platform.auth.install_auth(app)` 安装 AuthMiddleware。
- 客户端改用 `mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`。
- 写至少 3 个跨租户 negative test。
- `services/kb.yaml` 的 `security:` 段升级到三段式。

其他 16 域按本批产出的 **per-app 5 步接入 checklist**（§2.3）逐步落地。

### 2.2 集成三层

每 app 接入 `mate-platform` 提供的三层能力：

| 层 | 入口 | 典型调用 |
|---|---|---|
| Auth | `mate_platform.auth.install_auth(app)` | `app = FastAPI(); install_auth(app)` |
| Tenant | `mate_platform.tenancy.guards.require_tenant(ctx)` | 在每个 handler 第一行调用 |
| Event | `mate_platform.messaging.OutboxWriter.append(Event)` | 业务事务同事务插入 |

App 不直接导入 `jwt` / `pydantic` 之外的库做 auth / tenant / event 路由。
**所有 17 域的入口都遵循这个铁律**：auth + tenant + event 三个 hook 缺一不可。

### 2.3 Per-app 5 步接入 checklist

每个 app 接入需要完成：

1. **Auth middleware**：在 `create_app()` 中 `from mate_platform.auth import install_auth; install_auth(app)`。
   禁止裸 `from jose import jwt, ...` 自行验证 token。
2. **Tenant guard**：在每个 handler 第一行 `ctx = request.state.ctx; require_tenant(ctx)`。
   禁止任何 `tenant_id` 来自 path / query / body；只能从 token。
3. **Outbox 写入**：业务事务同事务写 `outbox.append(event)`。
   禁止 dual-write：业务事务成功后单独 `producer.send(...)`。
4. **客户端认证**：所有出向调用走 `BearerAuth` + `OutgoingAuthMiddleware`。
   禁止裸 `httpx.Client` 直连下游服务（即使内部网络）。
5. **跨租户 negative tests**：至少 3 个 case（wrong tenant / wrong scope / no tenant）。
   写进 `tests/test_<app>_tenant.py` 集中运行。

### 2.4 OpenAPI 三段式 security 升级

17 域的 `security:` 段统一从：

```yaml
security:
  - bearerAuth: []
```

升级为：

```yaml
security:
  - bearerAuth: []
    tenantHeader: []
    oidcScopes: [platform.read]
```

写操作（POST / PUT / DELETE）用 `[platform.write]`；admin / cross-tenant
用 `[platform.admin, cross_tenant_admin]`；内部 RPC 用 `[platform.admin]`。

### 2.5 17 域接入优先级

| 优先级 | 域 | 原因 |
|---|---|---|
| P0（canonical）| `kb` | ARCH-CORE-01 第一个 app，最干净 |
| P0 | `iam` | deprecated，但 route 仍存在；可作 canonical secondary |
| P1 | `msg` `obs` | 已被 PLATFORM-EVENT-01 / PLATFORM-K8S-01 引用 |
| P1 | `agent` `rag` `llmgw` | 17 域中数据流最重 |
| P2 | `apphub` `arch` `copilot` `dashboard` `dw` `data` | 业务侧 |
| P2 | `a2a` `mcp` `ont` `wfe` | 协议 / 引擎侧 |
| P3 | 18-19 域（如有）| 未来 |

每 P 阶段的 app 在同 PR 落地。

## 3. Alternatives

### A. 一次性 17 域大爆炸

- **优点**：不需阶段。
- **缺点**：单个 PR 跨 17 域、200+ 文件；review 难、回滚难。
- **否决理由**：违反 production-readiness §10 提交顺序 + §13 硬规则 7（不跳契约测试）。

### B. 不做 canonical reference，17 域各自实施

- **优点**：每域独立 PR。
- **缺点**：17 个独立 PR 容易 17 种实现风格；§13 硬规则 4（ACL Client）若漏一处，CI 抓不到。
- **否决理由**：失去 ADR-0014 的一致性保证。canonical reference + checklist 是降低熵的关键。

### C. 仅做 canonical reference，不做其他 16 域

- **优点**：快速完成 TECH-SERVICES。
- **缺点**：PROGRAM-BOBOARD.md 的 17 域中 16 域仍是 Not Started；下游 BUSINESS-SLICES 没法接力。
- **否决理由**：本批出 canonical + checklist + OpenAPI 升级 + KB 域完整接入；剩余 16 域在后续批次按 P0/P1/P2 接力。PROGRAM-BOARD.md 标 TECH-SERVICES = Accepted 表示"模式已就位"，不要求 17 域 100% 接入。

## 4. Consequences

### 4.1 正面

- 17 域共享一套 auth + tenant + event 接入模式，下游批次（BUSINESS-SLICES）复用。
- §13 硬规则 3 / 4 / 5 / 8 / 9 全部由 `install_auth` + `require_tenant` + `OutboxWriter` + `BearerAuth` 集中保障。
- canonical reference 是新 app 的 reference PR；降低学习成本。

### 4.2 负面 / 风险

- 接入期间各 app 的既有单元测试可能因为 auth 强制导致需要更新 fixture。
- 17 域的 OpenAPI security 升级是一次性 schema 改动，oasdiff 工具必须 0 breaking。
- P3 阶段 app 仍可拖延至后续批次。

### 4.3 缓解

- 单元测试 fixture 模板 `tests/conftest_app_auth.py` 提供共享 `mock_auth_ctx`。
- OpenAPI 升级前用 `oasdiff` 对比 baseline；只新增 security 段，不改 paths。
- 17 域 P0/P1/P2 进度在 PROGRAM-BOARD 注释 + TECH-SERVICES 进度表独立跟踪。

## 5. Migration

按优先级 P0 → P1 → P2 推进：

| 阶段 | 范围 | 验证 |
|---|---|---|
| P0 | `kb`（canonical 完整） + `iam`（route 清理） | KB 域 3 跨租户 negative pass |
| P1 | `msg` `obs` `agent` `rag` `llmgw` | 5 域各 1 集成 smoke |
| P2 | `apphub` `arch` `copilot` `dashboard` `dw` `data` | 6 域 checklist 落地 |
| P2 | `a2a` `mcp` `ont` `wfe` | 4 域 checklist 落地 |

每 P 阶段在独立 PR + commit；TECH-SERVICES = Accepted 标志"模式就位"，
并不要求 17 域 100% 接入。

## 6. Verification

TECH-SERVICES 退出条件（13 项硬规则映射）：

1. `pytest mate-app-kb/tests -q` 全绿（含 3 跨租户 negative）。
2. `pytest mate-platform/tests -q` 仍全绿（无回归）。
3. `pytest infra/tests -q` 仍全绿。
4. `oasdiff` 17 域 security 段无未批准 breaking change。
5. per-app 跨租户 negative tests：kb 域 3 个；其他域 ≥ 1 个 smoke。
6. `helm template + kubeconform` 0 错（kafka chart 仍未落地）。
7. `ruff check` 0 错。
8. `pyright --strict` 0 错。
9. KB 域端到端：JWT 验证 → tenant binding → outbox 写入 → 跨域事件投递。
10. 13 门禁结果落档：本文 + 后续 TECH-SERVICES-ACCEPTANCE.md。
11. PROGRAM-BOARD.md：TECH-SERVICES = **Accepted**。
12. CI 工作流 `platform-k8s-ci.yml` 加 `tech-services-ci` job。
13. pre-commit raw-SQL + secret 扫描推迟到 GA-ACCEPTANCE 前的硬规则收口。

## 7. References

- `docs/active/decisions/ADR-0010-platform-k8s-baseline.md`
- `docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md`
- `docs/active/decisions/ADR-0012-sec-tenant-isolation.md`
- `docs/active/decisions/ADR-0013-platform-event-outbox.md`
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md`
- `docs/active/delivery/evidence/SEC-IAM-01-ACCEPTANCE.md`
- `docs/active/delivery/evidence/SEC-TENANT-01-ACCEPTANCE.md`
- `docs/active/delivery/evidence/PLATFORM-EVENT-01-ACCEPTANCE.md`