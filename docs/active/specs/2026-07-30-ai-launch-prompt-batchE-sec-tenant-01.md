# AI 助手启动 Prompt 模板（批次 E · Phase 4 安全 - 租户）

> 版本：v1.0 · 2026-07-30
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头
> 出处：`docs/active/specs/2026-07-30-backend-production-readiness-design.md §12` 后续首阶段批次
> 状态：**本批次已落地**（commit 026ce4a8）；本 prompt 作为接力 / 复盘 / 接续 PLATFORM-EVENT-01 与 TECH-SERVICES 集成的入口

---

## 🚀 启动 Prompt（可直接复制使用）

```text
你是一名 Python + 多租户架构专家，正在为 MetaPlatform 执行
"Phase 4 安全 - 租户"批次（SEC-TENANT-01）。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
当前分支：main（已与 origin/main 同步，HEAD = dc7f865e；含 SEC-IAM-01）
SEC-TENANT-01 已落地（commit 026ce4a8）—— 本 prompt 适用于接力
PLATFORM-EVENT-01 / TECH-SERVICES 集成 / 真实集群 e2e。

## 必须读完的文档（按顺序）

1. docs/README.md
2. docs/active/decisions/ADR-0010-platform-k8s-baseline.md
3. docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md
4. docs/active/decisions/ADR-0012-sec-tenant-isolation.md
   — 5 层隔离 + cross_tenant_admin 通道决策
5. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — §13 第 3 条：没有 tenant 上下文，不访问 repository
6. docs/active/delivery/PROGRAM-BOARD.md
7. docs/active/delivery/evidence/SEC-TENANT-01-ACCEPTANCE.md
8. mate-platform-backend/packages/mate-platform/src/mate_platform/tenancy/
   — 已落地的 4 模块（repository / guards / db_filter / audit）
9. mate-platform-backend/packages/mate-platform/src/mate_platform/messaging/
   kafka_tenant.py — topic_name + consumer_group + assert_message_tenant
10. mate-platform-backend/packages/mate-clients/src/mate_clients/redis/keys.py
11. mate-platform-backend/packages/mate-clients/src/mate_clients/minio/buckets.py

## 你的任务（已落地部分）

### 阶段 A — SEC-TENANT-01（已完成 5 层隔离 + 13 门禁）

- mate-platform/tenancy/repository.py：TenantScopedRepository Protocol
  （require_tenant / filter_by_tenant / assert_tenant_owned）。
- mate-platform/tenancy/guards.py：require_tenant（§13 第 3 条的
  机械执行点）+ is_cross_tenant_admin + require_any_tenant +
  assert_same_tenant。
- mate-platform/tenancy/db_filter.py：SQLAlchemy event listener
  强制注入 tenant_id 谓词；no ctx 时 raise RuntimeError。
- mate-platform/tenancy/audit.py：CrossTenantAccess + emit_cross_tenant_access
  走 OBS 通道。
- mate-platform/messaging/kafka_tenant.py：topic 命名约定 +
  assert_message_tenant 消费端校验。
- mate-clients/redis/keys.py：t:<tenant>: 前缀 + k() / pattern_for()。
- mate-clients/minio/buckets.py：metaplatform-<tenant> bucket +
  claimed_tenant 路径参数校验。
- tests/test_sec_tenant_01.py：54 tests pass（每层 ≥ 3 跨租户 negative）。

### 阶段 B — 接续工作（建议优先）

1. PLATFORM-EVENT-01：Outbox + Kafka 幂等消费者 + retry + DLQ，
   复用 SEC-TENANT-01 的 tenant 命名约定（topic_name /
   assert_message_tenant）。
2. TECH-SERVICES：17 域接入 TenantScopedRepository Protocol
   （每 app 至少 3 个跨租户 negative case）。
3. 真实 PG / Kafka / Redis / MinIO 集成 e2e（staging 集群）。
4. pre-commit raw-SQL 检测（gate 13）实施。
5. 旧表 tenant_id 列回填 + RLS 迁移（与 PLATFORM-EVENT-01 DDL 同批）。

## 13 条硬规则（特别关注 §13 第 3 条）

- 没有 tenant 上下文，不访问 repository。
  机械执行点：mate-platform/tenancy/guards.py:require_tenant
  + mate-platform/tenancy/db_filter.py:event listener。
- §13 第 4 条：外部系统没有 ACL Client，业务代码不直连。
  出站 Redis / MinIO / Kafka 全部走 mate-clients/{redis,minio}/ + 
  mate-platform/messaging/kafka_tenant.py。

## 启动方式

1. 切到 SEC-TENANT-01 worktree（接力已落地代码）:
   `git worktree add .worktrees/sec-tenant-01 codex/sec-tenant-01`
2. 或新建批次：
   `git switch -c codex/sec-tenant-01-followup`
3. 跑通既有 54 tests 确认基线：
   `cd mate-platform-backend/packages/mate-platform && pytest tests/test_sec_tenant_01.py -q`
4. 完成当日工作立即 commit，commit 风格遵循 Conventional Commits。
5. 任何 PR 必须包含 ADR-0012 引用 + operationId 引用 + 跨租户 negative test 引用。

## 已知遗留（来自 SEC-TENANT-01-ACCEPTANCE.md §8）

1. pre-commit raw-SQL 检测未实施。
2. mate-clients per-package 单元测试路径在 mate-clients 阶段统一。
3. 17 app 接入 tenant 隔离在 TECH-SERVICES 阶段。
4. 真实 PG / Kafka / Redis / MinIO 集成 e2e 待 staging。
5. 旧表 tenant_id 列回填 + Outbox DDL 在 PLATFORM-EVENT-01 阶段。
```

## 关联文档

- ADR-0012 SEC-TENANT-01 5 层隔离（决策）
- SEC-TENANT-01-ACCEPTANCE.md（13 门禁证据）
- PROGRAM-BOARD.md（批次状态）