# AI 助手启动 Prompt 模板（批次 F · Phase 4 平台 - 事件）

> 版本：v1.0 · 2026-07-30
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头
> 出处：`docs/active/specs/2026-07-30-backend-production-readiness-design.md §12` 后续首阶段批次
> 状态：**本批次为待启动**（PLATFORM-EVENT-01 = Not Started，依赖 SEC-TENANT-01 已完成）

---

## 🚀 启动 Prompt（可直接复制使用）

```text
你是一名 Python + 事件驱动架构专家，正在为 MetaPlatform 执行
"Phase 4 平台 - 事件"批次（PLATFORM-EVENT-01）。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
当前分支：main（HEAD = dc7f865e；已含 SEC-IAM-01 + SEC-TENANT-01）

## 前置批次（已 Accepted）

- API-GOV-01（commit 1fa521fd）：OpenAPI 单一契约源
- ARCH-CORE-01（commit eeaab5c5）：mate-kernel / mate-platform / 
  mate-clients / app-* 四层结构
- PLATFORM-K8S-01（commit 4d0b73d6）：K8s 运行时 + Keycloak + OTel
- SEC-IAM-01（commit 4d3d894e）：Keycloak 身份迁移 + JWKS
- SEC-TENANT-01（commit 026ce4a8）：5 层租户隔离 + cross_tenant_admin

## 必须读完的文档（按顺序）

1. docs/README.md
2. docs/active/specs/2026-07-27-mate-platform-technical-architecture.md
   — THE ONE DOC（v3.0 Plan D Polyglot Microservice）
3. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — §12 后续首阶段批次 + §13 硬规则（尤其第 8 条：K8s readiness + 回滚；
   第 9 条：审计/指标/trace 闭环）
4. docs/active/decisions/ADR-0012-sec-tenant-isolation.md
   — Kafka topic 命名约定（PLATFORM-EVENT-01 复用）
5. docs/active/specs/2026-07-30-ai-launch-prompt-batchE-sec-tenant-01.md
   — 接续前的批次上下文
6. docs/active/delivery/PROGRAM-BOARD.md
7. docs/active/delivery/evidence/SEC-TENANT-01-ACCEPTANCE.md
8. mate-platform-backend/contracts/openapi/services/msg.yaml
   — outbox event contract（17 域共用的 event 模式）
9. mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/
   — outbox.py (399 bytes, 当前是 placeholder)
10. infra/helm/charts/kafka/  # 复用 PLATFORM-K8S-01 的 KRaft chart

## 你的任务：PLATFORM-EVENT-01

### 范围（production-readiness §12 第 5 项）

> Outbox、事件、幂等消费者、retry 和 DLQ。

具体落地点：

1. ADR-0013：Outbox 模式决策（transactional outbox vs CDC vs dual-write）。
2. mate-platform/messaging/ 完整化（当前是 placeholder）：
   - outbox.py：OutboxEvent dataclass + OutboxWriter（写业务事务
     同事务写入 outbox 表）+ OutboxRelay（后台拉表 → Kafka）。
   - events.py：Event envelope（id / type / tenant_id / occurred_at
     / payload / trace_id / producer）。
   - schemas.py：Avro/JSON schema 注册（Confluent Schema Registry）。
3. Kafka producer：复用 SEC-TENANT-01 的 topic_name() 命名约定。
4. Consumer 框架：
   - IdempotentConsumer：deduplicate by event.id + tenant_id
     (Redis SET NX with TTL)。
   - RetryConsumer：指数退避 + 死信 (DLQ) on max retries。
   - DLQ topic: metaplatform.<domain>.<tenant>.dlq.
5. mate-clients/kafka/：封装 client，含 producer / consumer 工厂。
6. 集成测试：outbox 写入 → relay → consumer → 幂等去重 → DLQ。
7. PLATFORM-K8S-01 chart 扩展：
   - kafka chart（已占位 enabled=false）：开箱即用 KRaft 模式。
   - schema-registry chart：Confluent 7.6。
   - 监控：consumer lag / DLQ depth alert rules。
8. PLATFORM-EVENT-01-ACCEPTANCE.md 13 门禁。
9. 更新 PROGRAM-BOARD.md 标 Accepted。

## 提交顺序（强约束）

```
docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance
```

每个 PR 必须：
- ADR-0013 引用
- 业务 operationId 引用
- event schema（Confluent Schema Registry 路径）引用
- 幂等 / DLQ 单元测试引用

## 13 条硬规则（特别关注）

- **§13 第 1 条**：Swagger 没有接口，不写 route。所有 outbox / consumer
  在 OpenAPI 中显式定义。
- **§13 第 8 条**：K8s readiness + 回滚 = 生产完成。Outbox 写入成功 +
  consumer DLQ 监控 + 0 message loss = DoD。
- **§13 第 9 条**：审计/指标/trace 闭环。Consumer 入口强制 trace_id 注入。
- **§13 第 3 条**：复用 SEC-TENANT-01 的 tenant 隔离；consumer 必须
  assert_message_tenant(expected_tenant, ctx) 才能进业务。

## 启动方式

1. 新建 worktree：
   `git worktree add .worktrees/platform-event-01 -b codex/platform-event-01 main`
2. 第一步：**先写 ADR-0013**，把 outbox / CDC / dual-write 决策写完再动代码。
3. 切到 ST 粒度（0.5-4h / 单文件）执行。
4. 任何 PR 必须包含 ADR 引用 + operationId 引用 + 验收证据链接。
5. 复用 mate-platform/tenancy + messaging/kafka_tenant 的现有契约。

## 已知遗留（来自前置批次）

1. mate-tech-iam 旧表 tenant_id 列回填：本批 DDL migration 同步做。
2. pre-commit raw-SQL / secret 扫描未实施：CI 阶段统一。
3. SEC-IAM-01 待补：6 client Keycloak realm 配置。
4. SEC-TENANT-01 待补：17 app 接入 TenantScopedRepository。
5. PLATFORM-K8S-01 待补：Bitnami / Confluent chart 外部依赖引入。

## 不允许的快捷方式

- ❌ 不许 dual-write（业务事务 + Kafka 写入）—— 一旦业务事务成功、
  Kafka 失败，消息就丢了。Outbox 模式是强制要求。
- ❌ 不许 at-most-once（无幂等）—— 任何 consumer 必须能处理
  重复消息。IdempotentConsumer 是默认契约。
- ❌ 不许无 DLQ —— 重试 N 次后必须入 DLQ，operator 手动处理。
- ❌ 不许 skip failing tests 阶段 —— contract / unit / integration
  三层测试齐全才能 merge。
- ❌ 不许绕过 SEC-TENANT-01 隔离 —— consumer 必须
  assert_message_tenant(expected_tenant, ctx) 才能进业务代码。
```

## 关联文档

- 后续批次接力：
  - batchC PLATFORM-K8S-01（已 Accepted）
  - batchD SEC-IAM-01（已 Accepted）
  - batchE SEC-TENANT-01（已 Accepted）
- 当前批次文档（待写）：
  - ADR-0013 Outbox 模式决策
  - PLATFORM-EVENT-01-ACCEPTANCE.md
  - PROGRAM-BOARD.md（更新）