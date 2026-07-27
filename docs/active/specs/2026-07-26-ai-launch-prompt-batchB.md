# AI 助手启动 Prompt 模板（批次 B · 后端 Controller / Service）

> 版本：v1.0 · 2026-07-26
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头
> 出处：`docs/superpowers/specs/2026-07-26-ontology-deerflow-engineering-handoff.md §0` 的扩展
> 注意：**批次 B 强依赖批次 A**（6 个 entity + 6 个 repository 必须先生成）

---

## 🚀 启动 Prompt（可直接复制使用）

```text
你是一名 Java 25 + Spring Boot 3.5 + Spring AI Alibaba 实施专家，正在为 MetaPlatform
执行 "Ontology-Native DeerFlow Phase 1 批次 B"。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform

## 任务总览

按 OpenAPI spec 实施 13 个 endpoint（详见 §1）。
spec 文件：docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1.yaml

## 必须读完的文档（按顺序）

1. docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces.md
2. docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces-errata.md
3. docs/superpowers/specs/2026-07-26-ontology-deerflow-engineering-handoff.md
4. docs/superpowers/specs/2026-07-26-ai-launch-prompt.md（批次 A 启动 prompt）
5. docs/superpowers/specs/2026-07-26-ontology-deerflow-fullstack-e2e-roadmap.md §2
6. docs/superpowers/specs/2026-07-26-ai-launch-prompt-batchB.md（即本文档）
7. SQL migration（不要修改）：
   - TECH-ONT/src/main/resources/db/migration/V14__init_envelope_store.sql
   - TECH-AGENT/src/main/resources/db/migration/V4__init_agent_run.sql
   - TECH-AGENT/src/main/resources/db/migration/V5__init_run_events.sql
   - TECH-AGENT/src/main/resources/db/migration/V6__init_action_proposals.sql
   - TECH-AGENT/src/main/resources/db/migration/V7__init_claim_records.sql
   - TECH-AGENT/src/main/resources/db/migration/V8__init_agent_artifacts.sql
8. OpenAPI spec：TECH-ONT/openapi/v1/ontology-deerflow-phase1.yaml

## 前置任务：批次 A 必须完成

6 个 entity 已被另一轮 AI 助手生成（按 ai-launch-prompt.md）。批次 B 开始前请确认：
- [ ] com.metaplatform.agent.runs.AgentRunEntity 存在
- [ ] com.metaplatform.agent.runs.TaskEntity 存在
- [ ] com.metaplatform.agent.events.RunEventEntity 存在
- [ ] com.metaplatform.agent.evidence.ClaimEntity 存在
- [ ] com.metaplatform.agent.evidence.EvidenceEntity 存在
- [ ] com.metaplatform.agent.action.ActionProposalEntity 存在
- [ ] 6 个对应 Repository 接口（findByRunId 等方法）

如果批次 A 没完成，先执行批次 A！

## 13 个 Endpoint 实施清单

### TECH-ONT（2 个）
[ ] POST /ontology/context/build — OntologyContextController 已有，补全验证逻辑
[ ] GET  /ontology/context/{envelopeId} — 同上 Controller 加 GET

### TECH-AGENT 主路径（5 个）
[ ] POST /agent/runs — 新建 AgentRunController.run（创建 AgentRun，落 PENDING）
[ ] GET  /agent/runs — AgentRunController.list（按 tenantId / status / limit 过滤）
[ ] GET  /agent/runs/{runId} — AgentRunController.get
[ ] POST /agent/runs/{runId}/cancel — AgentRunController.cancel
[ ] GET  /agent/runs/{runId}/events — 新建 RunEventController.events（返回 seq > afterSeq 的事件列表）

### TECH-AGENT 子路径（4 个）
[ ] GET  /agent/runs/{runId}/claims — 新建 ClaimController.list
[ ] GET  /agent/runs/{runId}/evidence — 新建 EvidenceController.list
[ ] GET  /agent/runs/{runId}/artifacts — 已有 ArtifactController 补强（或新建）
[ ] POST /agent/artifacts/{artifactId}/signed-url — 新建或补强

### TECH-AGENT Action 路径（2 个）
[ ] POST /agent/action-proposals — 新建 ActionProposalController.create
[ ] GET  /agent/action-proposals/{proposalId} — 同 controller 加 GET

### TECH-AGENT Ground Tool（1 个 — internal use）
[ ] POST /agent/ground-tools/{toolName} — 新建 GroundToolController.invoke（DeerFlow middleware 内部用，前端不直接调）

## 命名空间与文件位置

| Endpoint 模块 | Controller 位置 |
|---|---|
| Ontology | TECH-ONT/.../controller/OntologyContextController.java（已有） |
| Agent Run | TECH-AGENT/.../runs/AgentRunController.java |
| Run Event | TECH-AGENT/.../events/RunEventController.java |
| Claim | TECH-AGENT/.../evidence/ClaimController.java |
| Evidence | TECH-AGENT/.../evidence/EvidenceController.java |
| Artifact | TECH-AGENT/.../artifact/ArtifactController.java（已有） |
| Action Proposal | TECH-AGENT/.../action/ActionProposalController.java |
| Ground Tool | TECH-AGENT/.../tools/GroundToolController.java |

## 关键技术约束（必须遵守）

- @RestController / @RequestMapping 与 OpenAPI 路径严格一致
- @RequestMapping 路径前缀：TECH-ONT 用 /ontology/*，TECH-AGENT 用 /agent/*
- 所有 POST 端点的 @RequestBody 接收 OpenAPI schema 对应的 Java DTO（参考工程代工清单 §1.4 与 OpenAPI spec）
- DTO 用 lombok @Data @Builder，字段严格对应 OpenAPI schema properties
- 错误响应统一用 ErrorResponse schema，对照主文档附录 A 错误码速查表
- HTTP 状态码映射：200/201 成功、400 校验失败、403 权限、404 未找到、409 状态冲突、410 已销毁、500 服务错误
- @Transactional 在 Service 层标注（不要在 Controller）
- Repository 全部走 Spring Data JPA

## 主文档契约映射（必须遵守）

- 主文档 §3：Envelope 注入协议 — POST /ontology/context/build 实施依据
- 主文档 §4：Tool × Action 绑定 — POST /agent/ground-tools/{name} 实施依据
- 主文档 §5：Evidence / Artifact — Claim / Evidence / Artifact 3 个 Controller 实施依据
- 主文档 §6：跨域任务路由 — 暂不在 Phase 1 实施范围（Plan 后续）
- 主文档 §7：Memory × Commit — 暂不在 Phase 1 实施范围
- 补丁 ERR-3：AgentRun / Task 最小字段集
- 补丁 ERR-4：ActionProposal 占位 Schema
- 补丁 ERR-6：Phase 1 不支持 NATIVE fallback，runtimeType 仅 DEERFLOW / FAST_QUERY

## 关键不变量（必须测试覆盖）

- A2：Tool 名 ∈ allowedTools（不在 Phase 1 实施，仅 Service 层校验 Envelope）
- AR-1：RUN_STARTED 入仓先于事件发出
- RE-4：单 run id 下事件 seq 严格单调递增
- C8（artifact）：scanStatus=BLOCKED 必撤销
- AP-1（proposal）：evidenceRefs 长度 ≥ 1
- FB-1（fallback）：Phase 1 不实现 NATIVE fallback

## Service 类职责

| Service | 职责 |
|---|---|
| OntologyContextService | 已存在，补验签 / 注入 / 销毁逻辑 |
| AgentRunService | 落 PENDING → 启动 DeerFlow → 回填 runId → RUNNING |
| RunEventService | 持久化事件 + 推送（phase 1 不实现 SSE 推送） |
| ClaimService | 列出 Run 的 Claim |
| EvidenceService | 列出 Run 的 Evidence |
| AttestationWorker | 已存在接口，补 Attestation Service 触发 |
| ActionProposalService | 落候选事实到 draft |

## 验收 checklist（必须自检）

- [ ] 13 个 endpoint 在 swagger-ui 可见
- [ ] 错误码映射正确（ENVELOPE_EXPIRED → 410 等）
- [ ] AgentRun 创建时落 PENDING → RUNNING 状态机可走
- [ ] RunEvent 先持久化再 forward（RE-2）
- [ ] single run seq 自增（RE-4）
- [ ] 跑 mvn compile / test-compile 通过
- [ ] 不要引入新依赖

## 完成报告输出

所有文件写完后，assistant 最后一条消息必须包含：
1. 创建的新文件相对路径列表（含 Controller / Service / DTO / 单元测试）
2. 任何对 §1.4 命名空间 / §1.5 repository 方法 / §4 约束的偏离 + 偏离理由
3. 跑 mvn test-compile 输出（确认 BUILD SUCCESS）
4. 任何未实现的需求 + 原因

## 不要做的事

- 不要修改任何已有 entity / 已写 migration
- 不要 Flyway clean / repair
- 不要 git commit / push（生成完成后告知用户，由人类决策）
- 不要引入新依赖（如果需要立即告知并在完成报告说明）
- 不要写真实 DeerFlow Adapter（Adapter 接口允许先返回 mock）

开始执行。
```

---

## 启动 prompt 执行后的后续

下一个 AI 完成批次 B 后，应当追加：
1. **批次 C 启动 prompt**（路径 `docs/superpowers/specs/2026-07-26-ai-launch-prompt-batchC.md`）—— K8s/MinIO/DeerFlow Gateway 部署
2. **批次 D 启动 prompt**（路径 `docs/superpowers/specs/2026-07-26-ai-launch-prompt-batchD.md`）—— E2E 测试

每个批次完成后，更新：
- `docs/superpowers/specs/2026-07-26-ontology-deerflow-fullstack-e2e-roadmap.md` 状态
- 工程代工清单的"完成情况"表