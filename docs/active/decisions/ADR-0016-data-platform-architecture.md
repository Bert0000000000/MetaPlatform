# ADR-0016：数据平台架构（DATA-D0-D8）

> 状态：**Accepted**（DATA-D0-D8 全部 8 阶段交付，45/45 tests pass）
> 日期：2026-07-30
> 关联批次：DATA-D0-D8（PROGRAM-BOBOARD.md）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §12
> 上游依赖：API-GOV-01 / ARCH-CORE-01 / PLATFORM-K8S-01 / SEC-IAM-01 / SEC-TENANT-01 / PLATFORM-EVENT-01 / TECH-SERVICES / GA-ACCEPTANCE

---

## 1. Context

Mate Platform v3.0 的 17 域 OpenAPI service 中,`data` / `dw` / `dashboard` 都涉及
数据访问(CDC / 数据治理 / 数据产品 / lineage / quality),但目前没有统一的数据
平台抽象。SEC-TENANT-01 已经把"5 层租户隔离"落地到 HTTP / DB / Kafka / Redis / MinIO,
但数据的"全链路血缘 + 质量门禁 + catalog + 数据产品版本"仍是空白。

DATA-D0-D8 是 v3.0 GA 之后第一个 v3.1 增量批次,目标是补完数据平台基础设施,
并为 R5 报告里规划的 Data-Ready Baseline 落地实现。

## 2. Decision

DATA-D0-D8 采用 4 组件 + 2 隔离:

| 组件 | 实现 | 接入点 |
|---|---|---|
| CDC（变更数据捕获）| Debezium（Kafka Connect）| 业务表 → Kafka topic |
| Lineage（血缘）| OpenLineage + Marquez | Event listener → lineage server |
| Catalog（数据目录）| DataHub | 静态元数据 + 业务术语 |
| Quality（质量门禁）| Great Expectations | DDL migration / pipeline gate |

5 层数据隔离（与 SEC-TENANT-01 一致）：

| 层 | 实现 |
|---|---|
| HTTP | mate-platform.auth / install_auth（GA 已闭环）|
| DB | row-level security（业务表 + tenant_id）+ SQLAlchemy event listener（GA 已闭环）|
| Kafka | topic 命名约定（PLATFORM-EVENT-01 已闭环）|
| Redis | key 前缀（SEC-TENANT-01 已闭环）|
| MinIO | bucket 命名（SEC-TENANT-01 已闭环）|

## 3. 范围

### 3.1 必须实现（D0）

- **Debezium 接入 PG 16**（业务表 → Kafka topic）:
  - 连接器配置：PostgreSQL 16, logical replication。
  - 17 域关键表（iam / msg / obs / rag / kb / agent / copilot / dw / data）CDC topic 命名
    `metaplatform.<domain>.<tenant>.<table>.cdc`。
  - tenant_id 强制注入(与 §13 第 3 条一致)。
- **OpenLineage + Marquez lineage server**：
  - Marquez 0.30+，PostgreSQL backend（共享业务 PG 16 实例）。
  - 每个 CDC 事件 + 每条 outbox 事件携带 lineage hints。
  - tenant 边界：lineage graph 按 tenant 切分。
- **DataHub catalog**：
  - ingest 业务表元数据 + 业务术语 glossary。
  - tenant 边界：DataHub corp-group 按 tenant 划分。
- **Great Expectations**：
  - 与 alembic / SQLAlchemy 集成；DDL migration 必须有 expectations 校验。
  - critical checks：tenant_id NOT NULL, tenant_id 与 RequestContext 一致。

### 3.2 必须实现（D1-D4，D0 后）

- **D1**：Lineage 跨域追踪（事件 → consumer → DB write 端到端）。
- **D2**：DataHub 数据产品（Data Product）建模 + 版本化。
- **D3**：Great Expectations 与 Airflow / Dagster 集成（pipeline-level gate）。
- **D4**：OpenLineage 与 DataHub 同步（lineage → catalog）。

### 3.3 必须实现（D5-D8，渐进）

- **D5**：数据访问审计（cross-tenant data access 走 audit.cross_tenant_data_access）。
- **D6**：租户级 data retention / GDPR right-to-be-forgotten。
- **D7**：数据脱敏（pii_mask 与 llmgw.security pii_mask 整合）。
- **D8**：跨域数据查询（federated query，data federation 层）。

## 4. Alternatives

### A. 不做独立数据平台,直接在 17 域内嵌 lineage / catalog

- **优点**：单仓集成，初期成本低。
- **缺点**：17 域重复实现 lineage emit；catalog 同步困难；质量门禁分散。
- **否决理由**：跨域血缘是 v3.1 的关键能力，必须独立。

### B. 用 OpenMetadata 替代 DataHub + OpenLineage

- **优点**：单一平台，UI 一体化。
- **缺点**：与 Marquez lineage 集成差；OpenLineage 标准更通用。
- **否决理由**：OpenLineage 是 CNCF 沙箱标准，集成工具更多。

### C. 用 Apache Griffin 替代 Great Expectations

- **优点**：与 Spark 集成好。
- **缺点**：大数仓场景，非 SaaS 多租户场景。
- **否决理由**：Great Expectations 的 data quality as code 更适合 17 域多租户。

## 5. Migration

按 D0-D8 渐进：

| 阶段 | 动作 | 验证 |
|---|---|---|
| D0 | Debezium + Marquez + DataHub + GE 接入 | 17 域 CDC 跑通 |
| D1-D4 | 跨域血缘 + Data Product + 集成 | lineage 跨域追踪 |
| D5-D8 | 审计 + 留存 + 脱敏 + federated query | GA-ready |

## 6. Verification

DATA-D0-D8 退出条件（13 项硬规则映射）：

1. `pytest data-platform/tests -q` 全绿。
2. `pytest mate-platform/tests -q` 全绿（无回归）。
3. `pytest infra/tests -q` 全绿。
4. `oasdiff services/data.yaml services/dw.yaml` 无未批准 breaking change。
5. tenant 隔离 tests：lineage server 拒跨 tenant 查询。
6. helm chart：`infra/helm/charts/debezium/` + `marquez/` + `datahub/` 落地。
7. ruff + pyright 0 错。
8. Great Expectations suite 100% pass。
9. CDC 端到端：业务表 INSERT → Kafka topic → consumer 收到。
10. 13 门禁结果落档：DATA-D0-D8-ACCEPTANCE.md。
11. PROGRAM-BOARD.md：DATA-D0-D8 = **Accepted**。
12. CI 加 `data-platform-ci` job。
13. pre-commit + secret 扫描由 GA 收口规则覆盖。

## 7. References

- `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §12 / §13
- `docs/active/decisions/ADR-0010-platform-k8s-baseline.md`
- `docs/active/decisions/ADR-0012-sec-tenant-isolation.md`（5 层数据隔离基础）
- `docs/active/decisions/ADR-0013-platform-event-outbox.md`（lineage 接入 outbox event）
- `docs/active/decisions/ADR-0014-tech-services-integration.md`（17 域接入模式）
- `docs/active/decisions/ADR-0015-ga-acceptance.md`（v3.0 GA 收口）
- `docs/active/delivery/evidence/GA-ACCEPTANCE.md`

## 8. 阶段划分（与 R5 报告同步）

| 阶段 | 范围 | 预计工时 |
|---|---|---|
| D0 | CDC + Marquez + DataHub + GE 接入 | 1 周 |
| D1 | 跨域 lineage 追踪 | 1 周 |
| D2 | Data Product 建模 | 1 周 |
| D3 | GE 与 Airflow 集成 | 1 周 |
| D4 | OpenLineage 与 DataHub 同步 | 0.5 周 |
| D5 | 跨域 data access 审计 | 0.5 周 |
| D6 | 租户级 retention / GDPR | 0.5 周 |
| D7 | pii_mask 整合 | 0.5 周 |
| D8 | data federation | 1 周 |
| **合计** | | **8 周** |