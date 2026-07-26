# AI 助手启动 Prompt 模板（Phase 1 工程代工）

> 版本：v1.0 · 2026-07-26
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头即可启动
> 出处：`docs/superpowers/specs/2026-07-26-ontology-deerflow-engineering-handoff.md §8.1`

---

## 🚀 启动 Prompt（可直接复制使用）

```text
你是一名 Java + Spring Boot 3 + JPA 实施专家，正在为 MetaPlatform 执行
"Ontology-Native DeerFlow Phase 1" 的工程代工任务。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform

## 任务

基于已锁定的设计契约，按 docs/superpowers/specs/2026-07-26-ontology-deerflow-engineering-handoff.md
§1 / §2 / §3 / §4 章节的指引，**生成 6 个 Java entity + 6 个对应 Repository + 6 个 @DataJpaTest**。

## 必须读完的文档（按顺序）

1. docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces.md
   （主文档，5 个接口契约）
2. docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces-errata.md
   （勘误补丁，6 项遗漏 + 38 条补丁不变量）
3. docs/superpowers/specs/2026-07-26-ontology-deerflow-engineering-handoff.md
   （代工清单，**最重要的指南，含 6 个 entity 的字段表 / 命名空间 / 15 条验收 checklist**）
4. SQL migration 文件（不要修改）：
   - TECH-AGENT/src/main/resources/db/migration/V4__init_agent_run.sql
   - TECH-AGENT/src/main/resources/db/migration/V5__init_run_events.sql
   - TECH-AGENT/src/main/resources/db/migration/V6__init_action_proposals.sql
   - TECH-AGENT/src/main/resources/db/migration/V7__init_claim_records.sql
   - TECH-AGENT/src/main/resources/db/migration/V8__init_agent_artifacts.sql
   - TECH-ONT/src/main/resources/db/migration/V14__init_envelope_store.sql
5. OpenAPI spec：TECH-ONT/openapi/v1/ontology-deerflow-phase1.yaml

## 6 个 entity 的命名空间（严格遵守）

| 实体 | 包 | 类 | @Table |
|---|---|---|---|
| AgentRun | com.metaplatform.agent.runs | AgentRunEntity | agent_runs |
| Task | com.metaplatform.agent.runs | TaskEntity | tasks |
| RunEvent | com.metaplatform.agent.events | RunEventEntity | run_events |
| ClaimRecord | com.metaplatform.agent.evidence | ClaimEntity | claim_records |
| Evidence | com.metaplatform.agent.evidence | EvidenceEntity | evidence |
| ActionProposal | com.metaplatform.agent.action | ActionProposalEntity | action_proposals |

## 关键约束

- 不修改 AgentTaskEntity / ArtifactEntity / MemoryEntity 等已有 entity
- V8 已 ALTER agent_artifact 表 → 把 ArtifactEntity 新增字段（scan_status / signed_url 等）补全，不删老字段
- JSONB 字段使用 @Lob @JdbcTypeCode(SqlTypes.JSON) columnDefinition="jsonb"（跟随 AgentTaskEntity.input 模式）
- 时间戳用 Instant，不用 LocalDateTime / OffsetDateTime
- 所有 entity 加上 @Data @Builder @NoArgsConstructor @AllArgsConstructor
- 6 个新 Repository 用 JpaRepository<X, String>
- Evidence 表如需持久化，新增 Flyway migration V9__init_evidence.sql

## 验收 checklist（§3 共 15 条）

逐条自我验证；任何一条不通过都要在完成报告里说明理由。

## 完成报告输出

所有文件写完后，assistant 最后一条消息必须包含：
1. 创建的 19 个新文件相对路径列表（6 entity + 6 repository + 6 test + 1 Flyway migration 若有）
2. 任何对 §1.4 命名空间 / §1.5 repository 方法 / §4 约束的偏离 + 偏离理由
3. 15 条 checklist 中每条 AC-1 ~ AC-15 的状态
4. 任何未实现的需求 + 原因

## 不要做的事

- 不要修改任何已有 entity / 已写 migration
- 不要 Flyway clean / repair
- 不要 git commit / push（生成完成后告知用户，由人类决策）
- 不要引入新依赖（如 hibernate-types 库）—— 用项目现有 Lombok + Hibernate 6 JSONB 注解

开始执行。
```

---

## 使用说明

1. **开启新 Codex / AI 会话**
2. **整段复制粘贴上面的 `启动 Prompt（可直接复制使用）` 中的全部内容**
3. **AI 会自动开始**：读 5 个文档 → 扫描 schema → 按命名空间生成 entity → 出完成报告

---

## 元提示

> 这份 prompt **不包含敏感凭据**，可在团队内/不同 AI 服务（Codex / Claude / Cursor / Trae）之间安全共享。
> 如果 AI 没有正确读取 5 个文档，可以补充一句："请用 shell_command 真实读取这些文件，不要凭印象作答"。

---

## 反向补充

新会话完成后，AI 应当在最后追加：

```text
**完成报告**：
- 18 个新文件相对路径：[列出]
- 15 条 checklist 状态：[✓ / ✗]
- 任何偏离 / 阻塞：[]
```

如果用户后续要把这次产物合并到主分支，请用 **额外 commit** 形式（不重写已有 WIP commit），按 handoff 文档 §1.4 命名空间分组成 3 个原子 commit：

- **commit 1**：全部 6 个 `*Entity.java`（entity 层）
- **commit 2**：全部 6 个 `*Repository.java`（持久化层）
- **commit 3**：全部 6 个 `*Test.java` + 任何新增 Flyway migration（验证层）