# ADR-0013：Outbox + 幂等消费者 + DLQ（PLATFORM-EVENT-01）

> 状态：**Proposed**（待 PLATFORM-EVENT-01 验收通过后转 Accepted）
> 日期：2026-07-30
> 关联批次：PLATFORM-EVENT-01（PROGRAM-BOARD.md）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §12 / §13
> 上游依赖：API-GOV-01 ✅、ARCH-CORE-01 ✅、PLATFORM-K8S-01 ✅、SEC-IAM-01 ✅、SEC-TENANT-01 ✅
> 下游影响：TECH-SERVICES、BUSINESS-SLICES、DATA-D0-D8、GA-ACCEPTANCE

---

## 1. Context

Mate Platform v3.0 是事件驱动的多租户平台：业务事务会触发跨域副作用
（订单创建 → 触发 copilot agent / 通知 apphub / 记录 OBS）。一旦没有可靠的事件
管道，要么丢消息（dual-write 在业务事务成功、Kafka 写入失败时丢），要么重复
处理（at-most-once consumer 不能容忍重投递），要么阻塞业务（事务内同步 publish）。

§13 硬规则第 8 条（K8s readiness + 回滚 = 生产完成）和第 9 条（审计/指标/trace 闭环）
要求每条事件必须能定位、可追溯、有死信兜底。

SEC-TENANT-01 已经把 Kafka topic 命名约定和 consumer tenant 校验落地（commit
026ce4a8），本 ADR 锁定 Outbox 模式、幂等键设计、DLQ 命名三件配套基础设施。

## 2. Decision

PLATFORM-EVENT-01 采用 **Transactional Outbox + 幂等消费 + DLQ 死信** 三件套。

### 2.1 Outbox 模式（vs CDC / dual-write）

| 方案 | 一致性 | 复杂度 | 选 / 弃 |
|---|---|---|---|
| **Transactional Outbox** | 强（业务事务同事务写 outbox）| 中 | ✅ 选 |
| CDC（Debezium 等）| 强（基于 WAL）| 高（需 Debezium + Kafka Connect）| ❌ 弃，与 PG 强绑定 |
| Dual-write | 弱 | 低 | ❌ 禁（§13 第 8 条禁止丢消息）|
| Event sourcing | 强 | 极高 | ❌ 弃（重写所有业务）|

Outbox 表 schema：

```sql
CREATE TABLE outbox_event (
    event_id      UUID PRIMARY KEY,
    tenant_id     TEXT NOT NULL,
    aggregate_id  TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    payload       JSONB NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at  TIMESTAMPTZ,
    attempts      INT NOT NULL DEFAULT 0,
    trace_id      TEXT
);
CREATE INDEX idx_outbox_unpublished ON outbox_event (occurred_at)
    WHERE published_at IS NULL;
```

- 业务事务：`INSERT INTO domain_table ... ; INSERT INTO outbox_event ...; COMMIT`
- Relay 进程：`SELECT ... WHERE published_at IS NULL ORDER BY occurred_at FOR UPDATE SKIP LOCKED LIMIT 100`
  → 发送 Kafka → `UPDATE outbox_event SET published_at = now() WHERE event_id = ?`
- §13 第 3 条：outbox 行必须带 `tenant_id`（与 SEC-TENANT-01 对齐）。

### 2.2 幂等键设计

幂等键 = `(tenant_id, event_id)` 复合键：

- 写入侧：业务事务同事务生成 `event_id = uuid4()`，写入 outbox。
- 消费侧：`SET NX d:<tenant>:dedup:<event_id> 1 EX 86400`（Redis 24h 锁）。
  - 命中已存在 → skip（已处理过）
  - 未命中 → 处理 + SET NX
- 业务自身还要做"业务幂等"：例如 `orders.idempotency_key` 唯一索引。
  Redis 锁只是"防重投递"，业务表上的约束是最后一道。

为什么 24h TTL？
- 默认 event 处理窗口 < 1h，24h 留 24 倍冗余足以覆盖 Kafka retention + consumer 重启。
- 大于 24h 仍未消费成功的事件应进 DLQ；幂等键只防"正常重投"，DLQ 处理另算。

### 2.3 DLQ 死信队列

每个 topic `metaplatform.<domain>.<tenant>.<event>` 对应一个 DLQ
`metaplatform.<domain>.<tenant>.dlq.<event>`。

重试策略：
- 第 1 次：消费失败，立即重试一次。
- 第 2 次：等 1s 重试。
- 第 3 次：等 5s 重试。
- 第 4 次：等 30s 重试。
- 第 5 次：等 2min 重试。
- 第 6 次（max_retries=5 全部失败）：写入 DLQ + audit.log `event.dlq`。

DLQ consumer 单独部署（operator 维护），处理：
- 业务代码 bug 修复后重投。
- 数据修复后跳过（手动 ack）。
- 永久失败（schema 不兼容等）→ 数据归档到 S3 冷存 + 关闭。

### 2.4 复用 SEC-TENANT-01 的 tenant 约定

- Producer：`topic_name(ctx, domain=..., event=...)` 计算 topic。
- Consumer：入口强制 `assert_message_tenant(expected_tenant, ctx)`。
- Redis dedup key：`mate_clients.redis.k(ctx, "dedup", event_id)` —— 复用
  `t:<tenant>:` 前缀。

### 2.5 提交顺序（强约束）

```
docs/ADR → contract (events schema) → failing tests → feature → infrastructure → deploy → acceptance
```

每个 PR 必须包含：
- ADR-0013 引用
- 业务 operationId 引用
- event schema（Confluent Schema Registry 路径）引用
- 幂等 / DLQ 单元测试引用

## 3. Alternatives

### A. CDC（Debezium + Kafka Connect）

- **优点**：基于 PG WAL，业务零侵入。
- **缺点**：需 Debezium + Kafka Connect + Avro schema registry 整套；与本项目 R5 报告
  跨 DB 后端（PG + SQLite）不兼容（dev 用 SQLite 无 WAL）。
- **否决理由**：跨 DB 后端是约束。Outbox 跨 DB 都可移植。

### B. Dual-write（业务事务 + Kafka publish）

- **优点**：实现最简单。
- **缺点**：业务事务成功后 Kafka 失败 → 丢消息；Kafka 成功业务回滚 → 多余消息。
- **否决理由**：§13 第 8 条硬规则"没有 K8s readiness + 回滚不算生产完成"要求零丢失。

### C. Event sourcing

- **优点**：完整审计回放。
- **缺点**：需重写所有业务的 domain model；query 模型需另建（cqrs）；学习曲线与改造成本过高。
- **否决理由**：v3.0 多租户 SaaS 模式下，事件溯源与现有 CRUD 模型冲突，Q1 GA 不可达。

### D. at-most-once consumer

- **优点**：实现最简单。
- **缺点**：网络抖动 / consumer 重启就会丢消息。
- **否决理由**：§13 第 9 条"没有审计/指标/trace 不算业务闭环"要求零丢失。

## 4. Consequences

### 4.1 正面

- 业务事务与事件发布原子化（§13 第 8 条零丢失）。
- 幂等消费允许 Kafka 重投递（at-least-once + idempotent = exactly-once effect）。
- DLQ 提供最后一公里兜底。
- 复用 SEC-TENANT-01 的 tenant 约定（commit 026ce4a8），不增加新的隔离面。

### 4.2 负面 / 风险

- Outbox 表随业务量增长：需要定期 `VACUUM` 与分区归档。
- Relay 是单点：多实例 relay 用 `FOR UPDATE SKIP LOCKED` 互斥，但需要 ≥ 2 实例 HA。
- DLQ 需要 operator 主动处理；堆积告警必须有。
- 24h Redis 锁 TTL：处理窗口 > 24h 的长事务需要单独建模。

### 4.3 缓解

- Relay HA：≥ 2 实例 + k8s Deployment。
- DLQ depth alert → PagerDuty（§13 第 8 条 readiness）。
- 长事务：拆成 saga pattern（GA-ACCEPTANCE 前的硬规则收口）。
- Schema registry 强制：所有 producer 先注册 schema，否则启动失败。

## 5. Migration

按环境顺序推进：

```
dev → local → contract → integration → staging → pre-production → production
```

| 阶段 | 动作 | 验证 |
|---|---|---|
| dev | 单实例 Relay，SQLite outbox | 单测全绿 |
| local | PG outbox，2 实例 Relay，kafka KRaft 单 broker | 集成测试 |
| contract | 幂等 + DLQ 契约 | contract CI 全绿 |
| integration | 3 broker Kafka，2 Relay，CRDT 心跳 | 17 域端到端 |
| staging | DLQ alert 接 PagerDuty | DR + 越权矩阵 |
| pre-production | 灰度切流 | 监控 + alert |
| production | GA 切流 | 13 硬规则 + SLO 达标 |

## 6. Verification

PLATFORM-EVENT-01 退出条件（13 项硬规则映射）：

1. `pytest mate-platform/tests -q` 全绿（outbox / events / schemas）。
2. `pytest mate-clients/tests -q` 全绿（producer / consumer / idempotent / dlq）。
3. `pytest app-*/tests -q` 全绿（每 app 至少 1 个 event flow 集成测试）。
4. `oasdiff` 无未批准 breaking change；msg.yaml 加 event 端点。
5. 跨租户 negative tests：OutboxRelay 拒跨 tenant 投递、IdempotentConsumer 拒重复。
6. `helm template + kubeconform` 0 错（kafka sub-chart 集成后）。
7. `ruff check` 0 错。
8. `pyright --strict` 0 错。
9. Kafka 真实集成（local + integration）：event 端到端，重复消费去重，DLQ 触发。
10. 13 门禁结果落档：本文 + 后续 PLATFORM-EVENT-01-ACCEPTANCE.md。
11. PROGRAM-BOARD.md：PLATFORM-EVENT-01 = **Accepted**。
12. CI 工作流 `platform-k8s-ci.yml` 增加 `platform-event-ci` job（kafka contract）。
13. pre-commit hook 增加 raw-SQL 检测 + schema 注册校验（推迟到 GA-ACCEPTANCE 前的硬规则收口）。

## 7. References

- `docs/active/decisions/ADR-0010-platform-k8s-baseline.md`
- `docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md`
- `docs/active/decisions/ADR-0012-sec-tenant-isolation.md`
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md`
- `docs/active/delivery/evidence/SEC-TENANT-01-ACCEPTANCE.md`
- `docs/active/delivery/evidence/PLATFORM-K8S-01-ACCEPTANCE.md`
- `mate-platform-backend/contracts/openapi/services/msg.yaml`
- `mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/outbox.py`
- `mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/kafka_tenant.py`