# Ontology-Native DeerFlow · Phase 1 工程代工交接清单

> 版本：v1.0 · 2026-07-26
> 阅读对象：**AI 实施助手**（生成 Java entity / repository / service / controller 的下一棒）
> 输入文档：
> - 主文档：`docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces.md`
> - 勘误补丁：`docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces-errata.md`
> 战略背景：
> - `docs/superpowers/specs/2026-07-26-ontology-native-deerflow-integration-and-migration-plan.md`
> - `docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md`
> - `docs/superpowers/specs/2026-07-26-deerflow-production-integration-design.md`

## 0. 本轮已完成的产物

| # | 产物 | 路径 | 行 / 字节 | 状态 |
|---|---|---|---|---|
| 1 | OpenAPI spec | `TECH-ONT/openapi/v1/ontology-deerflow-phase1.yaml` | 853 行 / 30 KB | ✓ YAML 解析通过（python yaml.safe_load） |
| 2 | TECH-ONT migration | `TECH-ONT/src/main/resources/db/migration/V14__init_envelope_store.sql` | 34 行 / 1.7 KB | ✓ 新表 envelope_store |
| 3 | TECH-AGENT migration | `TECH-AGENT/src/main/resources/db/migration/V4__init_agent_run.sql` | 55 行 / 2.5 KB | ✓ 新表 agent_runs + tasks |
| 4 | TECH-AGENT migration | `TECH-AGENT/src/main/resources/db/migration/V5__init_run_events.sql` | 48 行 / 2.2 KB | ✓ 新表 run_events |
| 5 | TECH-AGENT migration | `TECH-AGENT/src/main/resources/db/migration/V6__init_action_proposals.sql` | 40 行 / 2.3 KB | ✓ 新表 action_proposals |
| 6 | TECH-AGENT migration | `TECH-AGENT/src/main/resources/db/migration/V7__init_claim_records.sql` | 35 行 / 1.6 KB | ✓ 新表 claim_records |
| 7 | TECH-AGENT migration | `TECH-AGENT/src/main/resources/db/migration/V8__init_agent_artifacts.sql` | 48 行 / 改写 | ✓ 重写为 ALTER agent_artifact，向后兼容 |

合计：1 OpenAPI + 6 Flyway migration。

---

## 1. 待办任务：Java 实体层生成

### 1.1 总体策略

**绝对不可**与仓库已有 entity 命名/语义冲突。所有新增 entity **必须在 §1.4 指定的命名空间下**，表名必须与 §0.2 的 Flyway migration 一致。

### 1.2 必须新建的 entity（6 个）

#### ERR-3 AgentRun 实体

| 字段 | 类型 | JPA 注解 | 备注 |
|---|---|---|---|
| `runId` | String | `@Id @Column(name="run_id", length=64)` | 主键 |
| `tenantId` | String | `@Column(name="tenant_id", nullable=false, length=64)` | — |
| `userId` | String | `@Column(name="user_id", nullable=false, length=64)` | — |
| `agentId` | String | `@Column(name="agent_id", nullable=false, length=128)` | — |
| `runtimeType` | String | `@Column(name="runtime_type", nullable=false, length=32)` | CHECK 约束 `DEERFLOW \| FAST_QUERY`（Phase 1） |
| `contextEnvelopeId` | String | `@Column(name="context_envelope_id", length=64)` | 引用 envelope_store.envelope_id |
| `status` | String | `@Column(nullable=false, length=32)` | CHECK 约束 |
| `goal` | String | `@Column(nullable=false, columnDefinition="TEXT")` | — |
| `parentRunId` | String | `@Column(name="parent_run_id", length=64)` | — |
| `budget` | String | `@Lob @JdbcTypeCode(SqlTypes.JSON) columnDefinition="jsonb"` | JSON 字符串 |
| `traceId` | String | `@Column(name="trace_id", nullable=false, length=64)` | — |
| `deerflowThreadId` | String | `@Column(name="deerflow_thread_id", length=64)` | 唯一约束 (deerflow_thread_id, deerflow_run_id) |
| `deerflowRunId` | String | `@Column(name="deerflow_run_id", length=64)` | — |
| `startedAt` | Instant | `@Column(name="started_at")` | 可空 |
| `finishedAt` | Instant | `@Column(name="finished_at")` | 可空 |
| `errorCode` | String | `@Column(name="error_code", length=64)` | 见附录 A 错误码 |
| `errorMessage` | String | `@Column(name="error_message", columnDefinition="TEXT")` | ≤1024 |
| `revokedAt` | Instant | `@Column(name="revoked_at")` | 软删除 |
| `revokedBy` | String | `@Column(name="revoked_by", length=64)` | — |
| `createdAt` | Instant | `@Column(name="created_at", nullable=false, updatable=false)` | DB 默认 |
| `updatedAt` | Instant | `@Column(name="updated_at", nullable=false)` | @PreUpdate |

**命名空间**：`com.metaplatform.agent.runs.AgentRunEntity`
**表名**：`@Table(name = "agent_runs")`

---

#### ERR-3 Task 实体

字段仿照 AgentRun，参考主文档附录 B / ERR-3.4。

**命名空间**：`com.metaplatform.agent.runs.TaskEntity`
**表名**：`@Table(name = "tasks")`

---

#### ERR-2 RunEvent 实体

| 字段 | 类型 | 备注 |
|---|---|---|
| `eventId` | String | 主键 |
| `runId` | String | 外键 |
| `taskId` | String | 可空 |
| `subAgentId` | String | 新加字段 |
| `parentRunId` | String | 新加字段 |
| `type` | enum `RunEventType` | 21 种枚举 |
| `ts` | Instant | — |
| `traceId` | String | — |
| `tenantId` | String | — |
| `envelopeId` | String | 可空 |
| `payload` | String | JSON 字符串 |
| `errorCode` | String | 13 种错误码枚举 |
| `seq` | Long | 单调递增；建 UNIQUE(run_id, seq) 索引（已有） |

**新增 enum 类**：`com.metaplatform.agent.events.RunEventType`（21 个值见 ERR-2）；`com.metaplatform.agent.events.RunErrorCode`（13 个值见 OpenAPI ErrorResponse）

**命名空间**：`com.metaplatform.agent.events.RunEventEntity`
**表名**：`@Table(name = "run_events")`

---

#### 主文档 §5.2 ClaimRecord 实体

| 字段 | 类型 | 备注 |
|---|---|---|
| `claimId` | String | 主键 |
| `runId` | String | 外键 |
| `taskId` | String | 可空 |
| `type` | enum `ClaimType` | FACT / INFERENCE / RECOMMENDATION |
| `content` | String | TEXT |
| `confidence` | BigDecimal | CHECK ∈ [0,1] |
| `evidenceRefs` | String | JSON 数组 |
| `generatedByAgentId` | String | — |
| `generatedByModel` | String | — |
| `toolCallIds` | String | JSON 数组，可空 |
| `promptSnapshotId` | String | 可空 |
| `createdAt` | Instant | DB 默认 |

**命名空间**：`com.metaplatform.agent.evidence.ClaimEntity`
**表名**：`@Table(name = "claim_records")`

---

#### 主文档 §5.3 Evidence 实体

| 字段 | 类型 | 备注 |
|---|---|---|
| `evidenceId` | String | 主键 |
| `type` | enum `EvidenceType` | 7 种枚举 |
| `ref` | String | `'order:1234'` |
| `fragment` | String | 可空 |
| `sourceUri` | String | 可空 |
| `capturedAt` | Instant | — |
| `capturedBy` | String | `'agent.runId'` 等 |
| `concept` | String | 可空 |
| `objectId` | String | 可空 |
| `toolCallId` | String | 可空 |
| `envelopeId` | String | 引用 envelope_store |

**命名空间**：`com.metaplatform.agent.evidence.EvidenceEntity`
**表名**：建议新建 `evidence` 表（同 schema 字段），新增 Flyway migration V9__init_evidence.sql。

> 注：本轮 V8 之前未生成 Evidence 表的 SQL migration。如果 AI 助手认为 Evidence 也应持久化（除了 Claim 内的 evidence_refs），请生成 V9 migration 创建 evidence 表。

---

#### ERR-4 ActionProposal 实体

字段与 §1.4 ERR-4 数据库 schema 一致。

**命名空间**：`com.metaplatform.agent.action.ActionProposalEntity`
**表名**：`@Table(name = "action_proposals")`

---

### 1.3 仓库已有 entity — **不要重写也不要新增**

| 已有 entity | 路径 | 表 | 备注 |
|---|---|---|---|
| `AgentTaskEntity` | `…/agent/entity/AgentTaskEntity.java` | `agent_tasks` | **agent_tasks 与新建 tasks 表语义不同**——agent_tasks 是 AgentDefinition 关联的任务，本任务表是 AgentRun 子实体 |
| `ArtifactEntity` | `…/agent/artifact/ArtifactEntity.java` | `agent_artifact` | V8 已 ALTER 增加 attestation 字段；**不要新增 entity 直接扩展现有 ArtifactEntity 类** |
| `MemoryEntity` | `…/agent/memory/MemoryEntity.java` | `agent_memory` | 已有；本任务不涉及修改 |
| `AgentCheckpointEntity` | `…/agent/entity/AgentCheckpointEntity.java` | `agent_checkpoints` | 已有；CHECKPOINT_SAVED 事件可以用 |
| `MemoryMessageEntity` / `MemorySessionEntity` | `…/agent/memory/` | `agent_memory_*` | 已有 |
| `OntologyContextEnvelope` | `…/ont/context/OntologyContextEnvelope.java` | (envelope_store 在 §0.2 已建表) | 已有；不重写；**可选**：补全字段（principal / dataScopes 嵌套 / signature 嵌套），但**不要删除**现有字段以免破坏 build() 调用链 |

### 1.4 命名空间建议（**严格遵守**，避免冲突）

| 实体 | 包名 | 类名 |
|---|---|---|
| AgentRun | `com.metaplatform.agent.runs` | `AgentRunEntity` |
| Task | `com.metaplatform.agent.runs` | `TaskEntity` |
| RunEvent | `com.metaplatform.agent.events` | `RunEventEntity` |
| RunEventType | `com.metaplatform.agent.events` | `RunEventType`（enum） |
| RunErrorCode | `com.metaplatform.agent.events` | `RunErrorCode`（enum） |
| ClaimRecord | `com.metaplatform.agent.evidence` | `ClaimEntity` |
| Evidence | `com.metaplatform.agent.evidence` | `EvidenceEntity` |
| ClaimType | `com.metaplatform.agent.evidence` | `ClaimType`（enum） |
| EvidenceType | `com.metaplatform.agent.evidence` | `EvidenceType`（enum） |
| ActionProposal | `com.metaplatform.agent.action` | `ActionProposalEntity` |
| ActionProposalStatus | `com.metaplatform.agent.action` | `ActionProposalStatus`（enum） |
| RiskLevel | `com.metaplatform.agent.action` | `RiskLevel`（enum） |

### 1.5 必须生成的 Repository（6 个）

每个 entity 对应一个 Spring Data JPA Repository：

```
AgentRunRepository        extends JpaRepository<AgentRunEntity, String>
TaskRepository            extends JpaRepository<TaskEntity, String>
RunEventRepository        extends JpaRepository<RunEventEntity, String>
ClaimRepository           extends JpaRepository<ClaimEntity, String>
EvidenceRepository        extends JpaRepository<EvidenceEntity, String>
ActionProposalRepository  extends JpaRepository<ActionProposalEntity, String>
```

每个 Repository 必须包含以下定制方法：

```java
// AgentRunRepository
List<AgentRunEntity> findByTenantIdAndUserIdAndCreatedAtAfterOrderByCreatedAtDesc(...);
Optional<AgentRunEntity> findByRunIdAndStatusIn(...);
@Query("SELECT a FROM AgentRunEntity a WHERE a.status IN ('PENDING','RUNNING') AND a.createdAt < :beforeTs")
List<AgentRunEntity> findStaleRuns(@Param("beforeTs") Instant beforeTs);

// TaskRepository
List<TaskEntity> findByRunIdOrderByCreatedAtAsc(String runId);

// RunEventRepository
List<RunEventEntity> findByRunIdAndSeqGreaterThanOrderBySeqAsc(String runId, Long afterSeq);
List<RunEventEntity> findByRunIdOrderBySeqAsc(String runId);
Optional<RunEventEntity> findByEventId(String eventId);

// ClaimRepository
List<ClaimEntity> findByRunIdOrderByCreatedAtAsc(String runId);

// EvidenceRepository
List<EvidenceEntity> findByEnvelopeId(String envelopeId);

// ActionProposalRepository
Optional<ActionProposalEntity> findByIdempotencyKey(String key);
List<ActionProposalEntity> findByStatusAndExpiresAtBefore(String status, Instant before);
```

---

## 2. 与已有 entity 的冲突规避指南

### 2.1 表名冲突检查（已完成）

详见本轮 §0.2 的 6 个 migration 表：

```
agent_runs        ← 新增
tasks             ← 新增（不与 agent_tasks 冲突）
run_events        ← 新增
action_proposals  ← 新增
claim_records     ← 新增
agent_artifact    ← 已有（V8 ALTER）
```

### 2.2 字段冲突检查（必须 review 的点）

- `tasks` 表的 `run_id` 是字符串，与 `agent_runs.run_id` 形成 FK 约束（已在 V4 SQL 里加 `FOREIGN KEY ... ON DELETE RESTRICT`）
- `run_events` 表的 `run_id` 同上
- `action_proposals` 表的 `run_id` 同上
- `claim_records` 表的 `run_id` 同上
- `envelope_store` 在 TECH-ONT schema，**跨 schema 不加 FK**（请在 entity 层 `@ManyToOne` 关联但 DB FK 仅在同 schema 内）

### 2.3 与现有 `agent_tasks` 的语义区分

- `agent_tasks`（已有）是 **Agent Definition 维度的任务**——"哪个 Agent 做哪个任务"
- `tasks`（新建）是 **AgentRun 维度的子任务**——"这次 Run 内部哪些 Task 跑"
- 字段虽然都叫 `taskId`，但语义与生命周期完全不同；**不要尝试合并表**

### 2.4 flyway_schema_history 表的影响

新建 migration 文件会被 Flyway 自动识别。**AI 助手不要执行 `flyway clean` 或 `flyway repair`**——会导致已部署环境 schema 漂移。

---

## 3. AI 助手产出验收 checklist

完成 entity/repository 后，请人类按以下 15 条 review：

- [ ] AC-1：6 个新 entity 都在 §1.4 指定的包名下
- [ ] AC-2：每个 entity 的 `@Table(name = "...")` 与 §0.2 SQL migration 表名完全一致
- [ ] AC-3：`@Id` 主键字段命名与 SQL 主键一致（`run_id` / `task_id` / `event_id` 等）
- [ ] AC-4：JSONB 字段用 `@Lob @JdbcTypeCode(SqlTypes.JSON) columnDefinition="jsonb"` 与现有 `AgentTaskEntity.input` 模式一致
- [ ] AC-5：时间戳字段用 `Instant`（不要用 `LocalDateTime` / `OffsetDateTime`）
- [ ] AC-6：6 个新 Repository 都用 `JpaRepository<X, String>`，且包含 §1.5 列出的定制方法
- [ ] AC-7：枚举类型（`RunEventType` 等）作为 `@Enumerated(EnumType.STRING)` 在 entity 中声明
- [ ] AC-8：CHECK 约束由 DB 强制，entity 字段不做 Java-side 校验（保持一致）
- [ ] AC-9：不修改 `AgentTaskEntity` / `ArtifactEntity` / `MemoryEntity` 等已有 entity
- [ ] AC-10：V8 ALTER 字段（scan_status / signed_url / revoked 等）扩展到 `ArtifactEntity.java`（在 artifact 包），**新增字段不删除老字段**
- [ ] AC-11：跨 schema FK（envelope_store ↔ agent_runs）不加 DB FK 约束，**仅在 entity 层用 `@ManyToOne` 关联**
- [ ] AC-12：所有新 entity 通过 `mvn clean compile` 无错（项目使用 Lombok，确保 Lombok 配置正确）
- [ ] AC-13：所有新 entity 通过 `mvn test-compile`，生成的 entity 不能与已有 entity 冲突（特别是名字、Repository bean 名）
- [ ] AC-14：每个 entity 配一个 `*RepositoryTest.java`（@DataJpaTest），验证基本 CRUD
- [ ] AC-15：每个 Repository 的定制方法用 1 个简单测试覆盖

---

## 4. 已知陷阱（AI 助手必读）

### 4.1 Lombok 配置

项目用 Lombok 1.18.46。所有 entity 必须有 `@Data @Builder @NoArgsConstructor @AllArgsConstructor`（与现有 `AgentTaskEntity` 一致）。

### 4.2 JSONB 序列化

项目目前 JSONB 字段模式是用 `String` 存 + `@Lob @JdbcTypeCode(SqlTypes.JSON) columnDefinition="jsonb"`（看 `AgentTaskEntity.input`）。**不要** 改用 `Map<String, Object>` + 自动序列化，那会破坏现有 migration 的结构。

### 4.3 Transactional 边界

AgentRun 创建/状态转换的 Service 必须加 `@Transactional`。RunEvent 持久化与转发由主文档 §5.4 翻译层同步，推荐"先 persist 再 forward"，由 controller 层调 Service 时**显式** `Propagation.REQUIRES_NEW`。

### 4.4 时间戳设置

`@Column(name="created_at", nullable=false, updatable=false)` 应当**由 DB DEFAULT NOW() 维护**，不要在 Java 端 `@PrePersist` 设置（避免 service 层代码遗漏）。如果项目已有 `@PrePersist` 模式，可以跟随。

### 4.5 软删除

`agent_runs.revokedAt` 与 `revokedBy` 是软删除字段。Repository 必须默认**不返回** `revoked_at IS NOT NULL` 的行——通过 `@Where(clause="revoked_at IS NULL")` 或 `@SQLRestriction` 实现。

---

## 5. 后续阶段触发条件

| 阶段 | 启动条件 |
|---|---|
| Phase 1.5 | §0 所有产物通过人类 review；§3 checklist 全绿；OpenAPI spec 通过 `swagger-cli validate` |
| Phase 2 | §8.3 15 条 AC 全绿；第一个验收场景（客户详情页 SuperAI）连续 5 天通过率 ≥ 95% |
| Phase 3 | Phase 2 完成后启动 ActionGuard / Approval / Temporal 对接 |

---

## 6. 引用

| 文档 | 用途 |
|---|---|
| 主文档 `2026-07-26-ontology-deerflow-phase1-interfaces.md` | 5 个契约的完整 Schema 与不变量 |
| 补丁 `2026-07-26-ontology-deerflow-phase1-interfaces-errata.md` | 6 项遗漏的补充 Schema + 38 条补丁不变量 |
| `2026-07-26-ontology-native-deerflow-integration-and-migration-plan.md` | 战略层（角色边界、阶段划分） |
| `2026-07-26-ontology-native-deerflow-rollout-roadmap.md` | 8 阶段实施录像 |
| `2026-07-26-deerflow-production-integration-design.md` | DeerFlow 部署与 Adapter 策略 |
| 本文档 | 工程代工任务清单与冲突规避 |

---

## 7. 文档维护

- 本文档随 §0 产出物变更同步修订
- entity/repository 生成清单由 Codex 完成人类 review 后归档
- 新增 entity 必须更新 §1.4 命名空间表
- schema 冲突必须在 §2 增补新条目

---

## 8. AI 助手消费本文档的方式

### 8.1 三种消费模式

| 模式 | 何时使用 |
|---|---|
| **完整执行**（推荐） | 用户授权后直接生成 6 个 entity + 6 个 repository |
| **逐个执行** | 人类 review 每生成一个 entity 后再下一个 |
| **审计模式** | 只产出 diff 与 ADR，不实际写文件 |

完整执行模式推荐在新 Codex / Claude 会话开启时直接发：

> **启动 prompt 模板**：`docs/superpowers/specs/2026-07-26-ai-launch-prompt.md`

### 8.2 助手必须读的文件清单

助手在新会话开启时**必须按以下顺序读**：

1. `docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces.md`（主文档，~57KB）
2. `docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces-errata.md`（补丁，~44KB）
3. `docs/superpowers/specs/2026-07-26-ontology-deerflow-engineering-handoff.md`（**本文档**）
4. 上述提到的 schema migration SQL（V4 / V5 / V6 / V7 / V8 / V14）
5. OpenAPI spec：`TECH-ONT/openapi/v1/ontology-deerflow-phase1.yaml`

### 8.3 助手必须遵守的约束（failure modes）

- **不要修改** 已有 entity（AgentTaskEntity / ArtifactEntity / MemoryEntity 等）
- **不要回退** Flyway migration —— V4-V8 编号锁定
- **不要重复** LLM 总结 —— 直接读上述文件
- **不要用 `Map<String, Object>` 存 JSONB** —— 跟随既有 `@Lob @JdbcTypeCode(SqlTypes.JSON)` 模式
- **不要删除** V8 已 ALTER 的字段（向后兼容）
- **必须用** §1.4 命名空间表给定的包名

### 8.4 助手完成度的客观证据

- `mvn clean compile` 通过
- `mvn test-compile` 通过
- 6 个新 entity 都有对应 `@DataJpaTest` 单测
- 检查文件清单：`docs/superpowers/specs/2026-07-26-ontology-deerflow-engineering-handoff.md §1.4`

### 8.5 助手完成后必须输出

- 6 个 entity + 6 个 repository + 6 个 *Test.java
- 1 份"完成报告"（贴在 assistant 消息最后）：
  - 创建的文件相对路径列表
  - 任何偏离 §1.4 / §1.5 / §4 约束的决定
  - 任何 §3 checklist 中失败的条目
