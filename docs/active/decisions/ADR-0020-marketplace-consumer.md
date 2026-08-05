# ADR-0020: 云服务市场 — 私有化消费侧 (MARKETPLACE-CONSUMER-01)

> 状态：**Accepted**（本会话用户已确认）
> 日期：2026-08-05
> 关联批次：MARKETPLACE-CONSUMER-01（PROGRAM-BOARD.md v3.1+ 增量）
> 关联设计：[docs/superpowers/specs/2026-08-05-marketplace-consumer-design.md](../specs/2026-08-05-marketplace-consumer-design.md)
> 关联实施计划：[docs/superpowers/plans/2026-08-05-marketplace-consumer.md](../plans/2026-08-05-marketplace-consumer.md)
> 编号跳号说明：原计划 ADR-0018 已被 `business-slices-slo` 占用，本 ADR 跳到 0020。
> 上游依赖：TECH-SERVICES (ADR-0014) ✅、GA-ACCEPTANCE (ADR-0015) ✅、SEC-IAM-01 (ADR-0011) ✅、SEC-TENANT-01 (ADR-0012) ✅、PLATFORM-EVENT-01 (ADR-0013) ✅
> 触发来源：用户在 2026-08-05 提出在门户一级菜单新增"云服务市场"，市场包含 共用 MCP / 开放 Agent / 本体行业库 三类资产，支持从云 SaaS 拉取到本地服务。

---

## 1. Context

Mate Platform（私有化版，on-prem）当前缺乏"云市场消费侧"能力：
- 私有化版用户在 portal 上看不到 `mate-cloud-marketplace`（独立 SaaS 仓）中已发布的 MCP / Agent / Ontology 资产。
- 用户无法一键把 SaaS 上的资产安装到本地 `mate-tech-{mcp,agent,ont}` 服务里。
- marketplace SaaS 端的发布/审核/license/Billing 不在本 ADR 范围。

GA-ACCEPTANCE (ADR-0015) §13 hard rule #3 要求"没有 tenant 上下文，不访问 repository"，
§13 hard rule #4 要求"外部系统没有 ACL Client"。本 ADR 在不破坏上述硬规则的前提下，
引入一个新 batch `MARKETPLACE-CONSUMER-01`：
- **新增硬规则 14**：市场资产 digest → 本地 instance 一致性（install 完成时 `marketplace_instance.registered_digest` 必须 == `manifest.digest.sha256`，否则自动回滚并审计告警）。
- **新增豁免点**：13 hard rule #3 在 `marketplace_install` 表上**有意豁免**——install 是平台级资源（跨租户可见），但仍由 `tenant_id` 字段留痕"拉取发起人"。豁免需 SEC-TENANT-01 owner 在 `MARKETPLACE-CONSUMER-ACCEPTANCE.md` 显式签字。

---

## 2. Decision

私有化版实现"云服务市场"消费侧，统一外壳 + 3 类独立注册路径：

### 2.1 双仓双部署（强约束）

- **`mate-cloud-marketplace`（独立仓）**：SaaS 端，提供 MCP / Agent / Ontology 资产发布、版本管理、license 颁发、Billing。本 ADR 不覆盖。
- **`mate-platform`（本仓 on-prem）**：作为 Marketplace Consumer，提供 browse / license activate / install / uninstall / events。本 ADR **唯一覆盖范围**。

两个仓通过稳定的 HTTP API + OCI Distribution Spec v2 通信：
- 控制面：SaaS HTTP API（检索 / 元数据 / license check）。
- 数据面：OCI Distribution Spec（拉 bundle，强 sha256 校验）。

### 2.2 资产分类与入口

- 一级菜单"云服务市场"新增，落地页顶部 3 个 Tab：共用 MCP / 开放 Agent / 本体行业库。
- 平铺单层（无二级），分类即 kind。
- 资产进入 on-prem 后落入"共享资产池"，**跨租户可见、可调用**（与 SaaS license 的"租户级"语义分层）。

### 2.3 拉取链 + 注册链

3 类资产走统一外壳（MarketplaceClient + OCI pull + digest verify），但解压 + 注册按 kind 分发到 3 个本地 service：

| 资产 | 拉取链（统一） | 注册链（独立） |
|---|---|---|
| 共用 MCP | `MarketplaceClient.get_artifact` → `OCIPuller.stream_blob` → sha256 verify | `mate-tech-mcp` `POST /servers` |
| 开放 Agent | 同上 | `mate-tech-agent` `POST /agents` |
| 本体行业库 | 同上 | `mate-tech-ont` `POST /ontologies` |

3 个 `POST /servers|agents|ontologies` 端点是硬阻塞前置 — 必须由子 spec `MP-MCP-REGISTER-01 / MP-AGENT-REGISTER-01 / MP-ONT-REGISTER-01` 实现并签字后方可实施本 ADR。

### 2.4 鉴权与租户分层

- 所有 `/api/v1/marketplace/*` 强制 `bearerAuth + tenantHeader`。
- 写操作（install / license activate）额外要求 OAuth scope `platform.marketplace.write`。
- `GET /marketplace/installed` 是平台级路由：admin 全平台视图 / 租户管理员仅看本租户发起（不强制 db_filter，由 OAuth scope 区分）。
- `GET /marketplace/subscriptions` 走标准 db_filter（租户级）。

### 2.5 异步安装 + 硬规则 14

`POST /install` 立刻返回 202 + install_id；orchestrator 在 worker 中按状态机推进：

```
license_check → fetch_manifest → minPlatformVersion check → 
fetch_blob + sha256 verify → dispatch by kind → 
registered_digest vs manifest.digest (硬规则 14) → state=installed
```

任一失败立即 `state=failed` + 写审计 + publish outbox `marketplace.install.failed`。

### 2.6 CI 门禁 13+1（沿用 v3.0 GA + 新增 14）

| # | 硬规则 | 本 ADR 落地 |
|---|---|---|
| 1-13 | 见 GA-ACCEPTANCE.md | 全部沿用 + 在 `MARKETPLACE-CONSUMER-ACCEPTANCE.md` 逐项打勾 |
| **14** | 市场资产 digest → 本地 instance 一致 | installer 内 `registered_digest == expected_digest` 校验 + 失败回滚 + 审计告警 |

---

## 3. Consequences

### 3.1 积极

- 用户在 on-prem 门户可直接发现、安装 SaaS 上的资产，无需手动 wget + scp + 重启。
- license 与 digest 强校验保障资产完整性 + 商业合规。
- 3 类资产独立路径降低耦合；新增资产类型（如 RAG 模板）只需追加一个 installer。
- 共享资产池语义统一：拉下的资产 = 平台级资源；租户通过 license / scope 区分使用权限。

### 3.2 消极

- 引入一个非标准的"平台级但有 tenant_id 留痕"资源类型，**13 硬规则 #3 的豁免点必须由 SEC-TENANT-01 owner 签字**。
- orchestrator + 异步 SSE 增加了 on-prem 端的部署复杂度（新增 `mate-marketplace-worker` pod + Redis pubsub）。
- 私有化版断网环境下无法使用（v1.1 followup）。

### 3.3 拒绝的方案

- **完全单仓双 deployment profile**：拒绝 — 把 SaaS 与 on-prem 揉到同一服务会引入大量条件分支，违反 KISS。
- **抽象统一 installer**：拒绝 — 3 类资产的注册语义差异大（`POST /servers` vs `/agents` vs `/ontologies`），强行抽象会让 installer 退化为"判 kind 后再分发"的二段式，反而更绕。
- **仅控制面协议，不走 OCI**：拒绝 — 控制面承载 blob 流会让 SaaS 端性能陡降；OCI Distribution Spec 是 Docker 生态现成的、复用度高的方案。

---

## 4. 不在本 ADR 范围

| 项 | 原因 |
|---|---|
| `mate-cloud-marketplace` SaaS 端任何代码 | 独立仓、独立 spec |
| `MP-MCP-REGISTER-01` / `MP-AGENT-REGISTER-01` / `MP-ONT-REGISTER-01` | 前置子 spec，必须先签字 |
| 离线模式（断网环境） | v1.1 followup |
| 资产评论 / 评分 / 用户上传 | v2 规划 |
| 自动联动依赖（agent 必须绑定 mcp） | v1.1 |
| 多 marketplace 注册中心 | v2 规划 |

---

## 5. 退出标准

- 全部 13 个 Task 在 `docs/superpowers/plans/2026-08-05-marketplace-consumer.md` 实施完成
- 38 tests pass,0 skipped（13 hard rule #7）
- `MARKETPLACE-CONSUMER-ACCEPTANCE.md` 中 13+1 硬规则全部打勾
- ADR-0018 + ADR-0019 owner（你 + 团队）签字

---

## 6. 参考

- 实施计划：[docs/superpowers/plans/2026-08-05-marketplace-consumer.md](../plans/2026-08-05-marketplace-consumer.md)
- 设计稿：[docs/superpowers/specs/2026-08-05-marketplace-consumer-design.md](../specs/2026-08-05-marketplace-consumer-design.md)
- v3.0 GA 硬规则基线：[docs/active/specs/2026-07-30-backend-production-readiness-design.md §13](../specs/2026-07-30-backend-production-readiness-design.md)
- SEC-IAM-01 复用：`packages/mate-platform/auth/`
- SEC-TENANT-01 复用：`packages/mate-platform/tenancy/`
- PLATFORM-EVENT-01 复用：outbox + idempotent consumer + DLQ