# Ontology-Native DeerFlow：Phase 1 接口契约（勘误补丁）

> 版本：v1.0 · 2026-07-26
> 主文档：`docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1-interfaces.md`
> 本补丁定位：纠偏主文档相对 `integration-and-migration-plan` / `rollout-roadmap` / `deerflow-production-integration-design` 的 6 项遗漏与范围空白。
> 阅读建议：先读主文档，再读本补丁；本补丁章节编号以 `ERR-` 前缀与主文档 §-编号并行。

## 目录

- [ERR-1. InteractionContext 完整 Schema](#err-1-interactioncontext-完整-schema)
- [ERR-2. RunEvent 完整 21 事件清单](#err-2-runevent-完整-21-事件清单)
- [ERR-3. Phase 1 MVP 最小 AgentRun / Task 字段表](#err-3-phase-1-mvp-最小-agentrun--task-字段表)
- [ERR-4. ActionProposal 占位 Schema](#err-4-actionproposal-占位-schema)
- [ERR-5. Middleware 对应映射表](#err-5-middleware-对应映射表)
- [ERR-6. Phase 1 fallback 策略声明](#err-6-phase-1-fallback-策略声明)
- [附录 A：补丁 ↔ 主文档章节对应表](#附录-a补丁--主文档章节对应表)
- [附录 B：补丁不变量一览](#附录-b补丁不变量一览)

---

## ERR-1. InteractionContext 完整 Schema

### 上下文

原 `integration-and-migration-plan §4.1` 给过 JSON 示例，但未给严格 JSON Schema；`phase1-interfaces §3.3` 仅把它作为 Envelope build 的请求体提及，未独立章节。本节补全 Phase 1 MVP 必需的 InteractionContext 完整 Schema。

### 用途

前端（apps/superai）在调用 SuperAI 时携带，用户当前所在**应用上下文**（AppCode / PageCode / 选中实体 / 视图状态）。该对象由前端按页面统一生成，不可信字段必须经服务端二次校验。

### 完整 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://metaplatform.local/schemas/interaction-context/v1",
  "title": "InteractionContext",
  "type": "object",
  "required": ["message", "interaction"],
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4096,
      "description": "用户原始输入消息"
    },
    "interaction": {
      "type": "object",
      "required": ["appCode", "pageCode", "pageUrl"],
      "properties": {
        "appCode":     { "type": "string", "pattern": "^[a-z][a-z0-9_-]{2,32}$" },
        "pageCode":    { "type": "string", "pattern": "^[a-z][a-z0-9_.-]{2,64}$" },
        "pageUrl":     { "type": "string", "format": "uri-reference", "maxLength": 2048 },
        "selectedText": {
          "type": ["string", "null"],
          "maxLength": 8192,
          "description": "用户在页面选中的文本片段，可选"
        },
        "tenantId":    { "type": "string" }
      }
    },
    "subject": {
      "type": ["object", "null"],
      "description": "当前页面聚焦的 Ontology 对象（若有）",
      "required": ["conceptCode", "objectId"],
      "properties": {
        "conceptCode": { "type": "string", "description": "Ontology ConceptCode" },
        "objectId":    { "type": "string" }
      }
    },
    "viewState": {
      "type": "object",
      "description": "页面视图状态，用于 Envelope 提示 LLM 当前可见范围",
      "properties": {
        "activeTab":       { "type": "string" },
        "filters":         { "type": "object", "additionalProperties": true },
        "selectedMetrics": { "type": "array", "items": { "type": "string" } }
      }
    },
    "clientHints": {
      "type": "object",
      "description": "前端能力声明，用于路由选择",
      "properties": {
        "supportsStreaming": { "type": "boolean" },
        "supportsArtifacts": { "type": "boolean" },
        "uiLocale":          { "type": "string", "pattern": "^[a-z]{2}(-[A-Z]{2})?$" }
      }
    }
  },
  "additionalProperties": false
}
```

### 字段语义表

| 字段 | 必填 | Phase 1 来源 | 说明 |
|---|---|---|---|
| `message` | ✓ | 用户输入 | 与 §3 Envelope.build() 一起传给 OntologyContextService |
| `interaction.appCode` | ✓ | 应用脚手架 | 例如 `crm` / `erp` / `bi` |
| `interaction.pageCode` | ✓ | 应用脚手架 | 例如 `customer-detail` |
| `interaction.pageUrl` | ✓ | 浏览器 | 用作审计与回溯锚点，不是身份凭据 |
| `interaction.selectedText` | — | 用户框选 | 进入 Envelope 后作为附加 context 注入 Ground Tool 结果 |
| `interaction.tenantId` | — | 应用脚手架（JWT 推断优先） | 与 JWT 字段冲突时，以 JWT 为准 |
| `subject.conceptCode` / `subject.objectId` | — | 应用脚手架 | 用于 Envelope.subject 字段 |
| `viewState` | — | 应用脚手架 | 用于 Envelope 的语义化提示（不影响权限） |
| `clientHints` | — | 应用脚手架 | 路由选择辅助输入；运行时不参与权限决策 |

### 服务端二次校验规则

Phase 1 服务端必须在 Envelope.build() 前完成：

1. **`tenantId` 权威性**：以 JWT 中的 tenantId 为准；与 `interaction.tenantId` 不一致时拒绝并发出 `INTERACTION_TENANT_MISMATCH` 事件。
2. **`subject` 权限**：如果 `subject.conceptCode / objectId` 在 PermissionSnapshot 的 `dataScopes.objectDenied` 列表中，将 `subject` 置为 null（而不是拒绝请求）。
3. **`message` 长度**：超过 4096 字符拒绝；包含明显 PII（如身份证正则）触发 PII 警告事件，但不拒绝。
4. **`selectedText` 长度**：超过 8192 字符截断。

### 不变量

- **IC-1**：`message` 与 `interaction` 必填；缺一返回 `INTERACTION_INVALID`。
- **IC-2**：`subject.conceptCode` 必须存在于 Ontology Concept Registry（TECH-ONT 维护）；不存在返回 `INTERACTION_UNKNOWN_CONCEPT`。
- **IC-3**：服务端**永远不信任**前端传入的 `tenantId`、`userId`、`roles`——这些字段从 JWT 派生，与 InteractionContext 无关。
- **IC-4**：`message` 进入 Envelope.build 后被规范化（trim、折叠连续空格、剔除控制字符）；规范化前后差异写入审计事件。
- **IC-5**：`viewState.filters` 中的 `timeRange` 若包含在 Envelope `dataScopes.regions` 之外，覆盖为 `dataScopes.regions` 的并集。
- **IC-6**：`additionalProperties: false`——前端任意字段扩展被服务端拒绝，避免未来 schema 漂移。

### 与主文档的衔接

主文档 §3.3 调用 `POST /ontology/context/build` 的请求体应更新为：

```typescript
interface BuildEnvelopeRequest {
  interactionContext: InteractionContext;   // ← 引用 ERR-1 Schema
  userJwt: string;                          // 用于 tenantId / userId / roles 推断
}
```

---

## ERR-2. RunEvent 完整 21 事件清单

### 上下文

原 `integration-and-migration-plan §4.5` 列了 21 种 RunEvent 事件，但未给完整 payload Schema。主文档零散引用了若干事件。本节给出 21 种事件的完整 enum + payload Schema + 触发条件。

### 事件枚举

```typescript
type RunEventType =
  // Run 生命周期
  | 'RUN_STARTED'              // AgentRun 启动
  | 'RUN_PAUSED'               // 暂停（等待外部恢复）
  | 'RUN_RESUMED'              // 恢复
  | 'RUN_FAILED'               // 失败终止
  | 'RUN_COMPLETED'            // 正常完成

  // Plan / Task
  | 'PLAN_CREATED'             // 主 AgentRun 派生 Plan
  | 'TASK_CREATED'             // 主或子 AgentRun 派生 Task
  | 'CHECKPOINT_SAVED'         // 持久化 Checkpoint

  // Sub-Agent
  | 'SUBAGENT_STARTED'         // 子 AgentRun 启动

  // Model
  | 'MODEL_STARTED'            // LLM 调用开始
  | 'MODEL_COMPLETED'          // LLM 调用完成（含输出 token 数）

  // Tool
  | 'TOOL_STARTED'             // tool_call 触发
  | 'TOOL_COMPLETED'           // tool_call 完成（含 result 或 error）

  // Evidence / Claim / Artifact
  | 'EVIDENCE_ATTACHED'        // 一条 Evidence 注册
  | 'CLAIM_PRODUCED'           // 一条 Claim 派生
  | 'ARTIFACT_CREATED'         // 一个 Artifact 入仓

  // Action
  | 'APPROVAL_REQUIRED'        // Action Guard 决策需要审批
  | 'ACTION_PROPOSED'          // ActionProposal 创建
  | 'ACTION_GUARD_DECIDED'     // ActionGuard.decide() 返回 ALLOW|REQUIRE_APPROVAL|DENY
  | 'ACTION_EXECUTED'          // Action 真正执行（含 idempotencyKey 命中信息）
  | 'ACTION_FAILED'            // Action 执行失败

  // Ontology Event
  | 'ONTOLOGY_EVENT_RECEIVED'; // Ontology Event Bus 收到外部事件
```

总 21 种。

### 每种事件 Payload

```typescript
interface RunEventBase {
  eventId: string;             // EVT-<uuid>
  runId: string;               // 必填
  taskId?: string;             // 当前 task id（如适用）
  type: RunEventType;
  ts: ISODateTime;
  traceId: string;
  tenantId: string;
  envelopeId?: string;
}

interface RunStartedPayload    extends RunEventBase { type: 'RUN_STARTED';    agentId: string; goal: string; envelopeId: string; runtimeType: 'DEERFLOW' | 'NATIVE' | 'METAFLOW' | 'FAST_QUERY'; budget: Budget; }
interface RunPausedPayload     extends RunEventBase { type: 'RUN_PAUSED';     reason: 'APPROVAL_PENDING' | 'CHECKPOINT' | 'TIMEOUT_WAIT'; resumeToken: string; }
interface RunResumedPayload    extends RunEventBase { type: 'RUN_RESUMED';    resumeToken: string; }
interface RunFailedPayload     extends RunEventBase { type: 'RUN_FAILED';     errorCode: string; errorMessage: string; recoverable: boolean; }
interface RunCompletedPayload  extends RunEventBase { type: 'RUN_COMPLETED';  totalClaims: number; totalEvidence: number; totalArtifacts: number; durationMs: number; }

interface PlanCreatedPayload   extends RunEventBase { type: 'PLAN_CREATED';   planId: string; subAgentCount: number; strategy: 'SEQUENTIAL' | 'PARALLEL' | 'DAG'; }
interface TaskCreatedPayload   extends RunEventBase { type: 'TASK_CREATED';   taskId: string; assigneeAgent: string; objective: string; parentTaskId?: string; }
interface CheckpointSavedPayload extends RunEventBase { type: 'CHECKPOINT_SAVED'; checkpointId: string; bytes: number; }

interface SubAgentStartedPayload extends RunEventBase { type: 'SUBAGENT_STARTED'; subAgentId: string; parentRunId: string; derivedEnvelopeId: string; }

interface ModelStartedPayload  extends RunEventBase { type: 'MODEL_STARTED';  modelId: string; promptTokens: number; }
interface ModelCompletedPayload extends RunEventBase { type: 'MODEL_COMPLETED'; modelId: string; completionTokens: number; latencyMs: number; finishReason: 'stop' | 'length' | 'tool_calls' | 'error'; }

interface ToolStartedPayload   extends RunEventBase { type: 'TOOL_STARTED';   toolName: string; toolCallId: string; inputJson: JsonNode; }
interface ToolCompletedPayload extends RunEventBase { type: 'TOOL_COMPLETED'; toolName: string; toolCallId: string; outputJson: JsonNode; latencyMs: number; errorCode?: string; }

interface EvidenceAttachedPayload extends RunEventBase { type: 'EVIDENCE_ATTACHED'; evidenceId: string; evidenceType: EvidenceType; ref: string; toolCallId?: string; }
interface ClaimProducedPayload    extends RunEventBase { type: 'CLAIM_PRODUCED';    claimId: string; claimType: ClaimType; confidence: number; contentPreview: string; evidenceRefCount: number; }
interface ArtifactCreatedPayload  extends RunEventBase { type: 'ARTIFACT_CREATED';  artifactId: string; contentType: string; sizeBytes: number; scanStatus: 'CLEAN' | 'FLAGGED' | 'BLOCKED'; }

interface ApprovalRequiredPayload  extends RunEventBase { type: 'APPROVAL_REQUIRED'; proposalId: string; actionCode: string; riskLevel: RiskLevel; }
interface ActionProposedPayload    extends RunEventBase { type: 'ACTION_PROPOSED';   proposalId: string; actionCode: string; targetObjects: string[]; parameters: JsonNode; }
interface ActionGuardDecidedPayload extends RunEventBase { type: 'ACTION_GUARD_DECIDED'; proposalId: string; decision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY'; reason: string; }
interface ActionExecutedPayload    extends RunEventBase { type: 'ACTION_EXECUTED';   proposalId: string; idempotencyKey: string; durationMs: number; }
interface ActionFailedPayload      extends RunEventBase { type: 'ACTION_FAILED';     proposalId: string; errorCode: string; errorMessage: string; }

interface OntologyEventReceivedPayload extends RunEventBase { type: 'ONTOLOGY_EVENT_RECEIVED'; ontologyEventType: string; concept?: string; objectId?: string; payload: JsonNode; }
```

### 事件触发矩阵

| 事件 | 触发方 | 触发位置 |
|---|---|---|
| RUN_STARTED | `AgentRuntimeOrchestrator.apply()` | 创建 AgentRun 持久化时 |
| RUN_PAUSED | Temporal/WFE 等待接口 | 等待外部恢复 |
| RUN_RESUMED | Temporal/WFE 恢复接口 | 收到外部事件 |
| RUN_FAILED | 任一 typed_error 不可恢复时 | — |
| RUN_COMPLETED | `AgentRuntimeOrchestrator.complete()` | 主 AgentRun 收尾 |
| PLAN_CREATED | 主 AgentRun 在 LLM 输出 plan 后 | 持久化 Plan |
| TASK_CREATED | 主或子 AgentRun 派生 Task | 持久化 Task |
| CHECKPOINT_SAVED | Checkpoint Worker | 调度定期 / 关键节点 |
| SUBAGENT_STARTED | `SubAgentRuntime.invoke()` | 见主文档 §6.4 |
| MODEL_STARTED / MODEL_COMPLETED | LLM Gateway 客户端 | 每次 LLM 调用 |
| TOOL_STARTED / TOOL_COMPLETED | OntologyToolProvider | 每次 tool_call |
| EVIDENCE_ATTACHED | EvidenceExtractor | 每次 extraction 后 |
| CLAIM_PRODUCED | ClaimExtractor | 每次 extraction 后 |
| ARTIFACT_CREATED | AttestationWorker | artifact 入仓后 |
| APPROVAL_REQUIRED | ActionGuard.decide() 返回 REQUIRE_APPROVAL | 立即 |
| ACTION_PROPOSED | Proposal 持久化后 | Phase 3 才发 |
| ACTION_GUARD_DECIDED | ActionGuard.decide() | 每次判断 |
| ACTION_EXECUTED | TECH-ACTION 执行回执 | Phase 3 才发 |
| ACTION_FAILED | TECH-ACTION 错误回执 | Phase 3 才发 |
| ONTOLOGY_EVENT_RECEIVED | Event Bus Consumer | Phase 7 才发 |

**Phase 1 MVP 必发事件**：RUN_STARTED / RUN_FAILED / RUN_COMPLETED / MODEL_STARTED / MODEL_COMPLETED / TOOL_STARTED / TOOL_COMPLETED / EVIDENCE_ATTACHED / CLAIM_PRODUCED / CHECKPOINT_SAVED / ARTIFACT_CREATED。

其余事件在 Phase 1 必须存在 payload Schema（type 值合法）但可暂不发出——这是 schema-first 原则。

### 不变量

- **RE-1**：每种事件的 payload 必须**完整匹配**对应 interface，CI 校验 schema 不漂移。
- **RE-2**：事件持久化与转发顺序：**先 persist 到 `run_events` 表，再 forward 给前端**。颠倒触发 C6 不变量违反。
- **RE-3**：`eventId` 全局唯一，由 Snowflake / UUIDv7 生成；缺字段的 event 不入仓。
- **RE-4**：同 `runId` 下事件 `ts` 严格单调递增（不允许回拨）；乱序事件写"out-of-order"审计标记但不丢弃。
- **RE-5**：`traceId` 与 `runId` 1:1 映射（每个 Run 一个 trace）；同 trace 下所有事件必须共享 traceId。
- **RE-6**：Phase 1 暂不发的事件（见 §"事件触发矩阵"）也必须能收到——即 EventType 校验器**必须接受**所有 21 种 type 值。
- **RE-7**：`tool_call.arguments` 中含 PII 字段（`bankAccount` / `legalIdentityNumber` / `password`）的事件必须在 persist 前剥离，主文档 §5.4 已规定。
- **RE-8**：`CLAIM_PRODUCED` 事件必带 `evidenceRefCount`；`evidenceRefCount === 0` 时 type 必为 INFERENCE 或 RECOMMENDATION，绝不能是 FACT。

### DB Schema（run_events 表）

```sql
CREATE TABLE run_events (
    event_id        VARCHAR(64) PRIMARY KEY,
    run_id          VARCHAR(64) NOT NULL,
    task_id         VARCHAR(64),
    sub_agent_id    VARCHAR(64),
    parent_run_id   VARCHAR(64),
    type            VARCHAR(64) NOT NULL,
    ts              TIMESTAMP WITH TIME ZONE NOT NULL,
    trace_id        VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,
    envelope_id     VARCHAR(64),
    payload         JSONB NOT NULL,
    seq             BIGINT NOT NULL,           -- 单调递增序号（同 run 下）
    CONSTRAINT chk_event_type CHECK (type IN (
        'RUN_STARTED','RUN_PAUSED','RUN_RESUMED','RUN_FAILED','RUN_COMPLETED',
        'PLAN_CREATED','TASK_CREATED','CHECKPOINT_SAVED',
        'SUBAGENT_STARTED',
        'MODEL_STARTED','MODEL_COMPLETED',
        'TOOL_STARTED','TOOL_COMPLETED',
        'EVIDENCE_ATTACHED','CLAIM_PRODUCED','ARTIFACT_CREATED',
        'APPROVAL_REQUIRED','ACTION_PROPOSED','ACTION_GUARD_DECIDED',
        'ACTION_EXECUTED','ACTION_FAILED',
        'ONTOLOGY_EVENT_RECEIVED'
    ))
);
CREATE INDEX idx_run_events_run_ts ON run_events(run_id, ts);
CREATE UNIQUE INDEX idx_run_events_run_seq ON run_events(run_id, seq);
```

### 与主文档的衔接

- 主文档 §3.7、§5.4、§7.9 内的"事件子类型"应改为引用本节对应 payload。
- 主文档 §8.4 第一个验收场景要求"RUN_STARTED 与 RUN_COMPLETED 都被发出"——本节给出规范定义。
---

## ERR-3. Phase 1 MVP 最小 AgentRun / Task 字段表

### 上下文

原 `integration-and-migration-plan §4.3` / `§4.4` 给完整 AgentRun / Task 模型，共 30+ 字段。主文档中假定由 `agent_runs` / `tasks` 表承载，但未给 Phase 1 最小字段集。本节做"Phase 1 MVP 最小必需"的精简表，供 AI 实施助手生成 DDL 与 Java entity。

### AgentRun 字段精简

| 字段 | 类型 | 必填 | Phase 1 来源 | 与原 §4.3 对齐 | 备注 |
|---|---|---|---|---|---|
| `runId` | string (RUN-...) | ✓ | 由 AgentRuntimeOrchestrator 颁发 | ✓ 等价 | 主键 |
| `tenantId` | string | ✓ | JWT | ✓ 等价 | — |
| `userId` | string | ✓ | JWT | ✓ 等价 | — |
| `agentId` | string | ✓ | 调用方传入 | ✓ 等价 | 例如 `superai.object_copilot` |
| `runtimeType` | enum | ✓ | Orchestrator 决策 | ✓ 等价 | Phase 1 MVP 仅用 `DEERFLOW` / `FAST_QUERY` |
| `contextEnvelopeId` | string (ENV-...) | ✓ | OntologyContextService | ✓ 等价 | — |
| `status` | enum | ✓ | Orchestrator | ✓ 等价 | PENDING / RUNNING / PAUSED / COMPLETED / FAILED / CANCELED / DEGRADED |
| `goal` | text | ✓ | 前端 message | ✓ 等价 | 截断到 4096 字符 |
| `parentRunId` | string | — | Sub-Agent 派生 | ✓ 等价 | Phase 1 暂不用 |
| `budget` | jsonb | ✓ | Orchestrator | ✓ 等价 | `{tokens: 8000, cost: 1.00, wallTimeMs: 60000}` |
| `traceId` | string | ✓ | 全链路 | ✓ 等价 | 与 run 1:1 |
| `deerflowThreadId` | string | — | Adapter 回填 | 🆕 新增 | 见 ERR-3.2 |
| `deerflowRunId` | string | — | Adapter 回填 | 🆕 新增 | 见 ERR-3.2 |
| `startedAt` | timestamp | ✓ | RUN_STARTED 触发 | ✓ 等价 | — |
| `finishedAt` | timestamp | — | RUN_COMPLETED/FAILED 触发 | ✓ 等价 | — |
| `errorCode` | string | — | 失败时回填 | ✓ 等价 | 见附录 A 错误码速查 |
| `errorMessage` | text | — | 失败时回填 | ✓ 等价 | 截断到 1024 |
| `createdAt` | timestamp | ✓ | DB default | 🆕 新增 | DB 维护 |
| `updatedAt` | timestamp | ✓ | DB trigger | 🆕 新增 | DB 维护 |

**Phase 1 不在 AgentRun 出现的原 §4.3 字段**：`agentVersion`、`policy`、`checkpointId`、`parentTaskId`（移到 Task）——这些推后到 Phase 1.5。

#### ERR-3.1 AgentRun DDL

```sql
CREATE TABLE agent_runs (
    run_id              VARCHAR(64) PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL,
    user_id             VARCHAR(64) NOT NULL,
    agent_id            VARCHAR(128) NOT NULL,
    runtime_type        VARCHAR(32) NOT NULL,
    context_envelope_id VARCHAR(64),
    status              VARCHAR(32) NOT NULL,
    goal                TEXT NOT NULL,
    parent_run_id       VARCHAR(64),
    budget              JSONB NOT NULL,
    trace_id            VARCHAR(64) NOT NULL,
    deerflow_thread_id  VARCHAR(64),
    deerflow_run_id     VARCHAR(64),
    started_at          TIMESTAMP WITH TIME ZONE,
    finished_at         TIMESTAMP WITH TIME ZONE,
    error_code          VARCHAR(64),
    error_message       TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_runtime_type CHECK (runtime_type IN ('DEERFLOW','NATIVE','METAFLOW','FAST_QUERY')),
    CONSTRAINT chk_status CHECK (status IN ('PENDING','RUNNING','PAUSED','COMPLETED','FAILED','CANCELED','DEGRADED'))
);
CREATE INDEX idx_agent_runs_tenant_user ON agent_runs(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_agent_runs_trace ON agent_runs(trace_id);
CREATE INDEX idx_agent_runs_envelope ON agent_runs(context_envelope_id);
```

#### ERR-3.2 DeerFlow 标识字段的设计意图

`deerflow_thread_id` / `deerflow_run_id` 是 Adapter 层标识，用于：

- 重连：DeerFlow 不可达时用 `deerflow_thread_id + deerflow_run_id` 调用 `join` 端点恢复流
- 审计：RunEvent 全链路可反查 DeerFlow workspace 中的同 thread 所有 runs

迁移策略：原 production-integration-design §7 给出"先持久化 PENDING、再持久化 deterministic thread id、再启动 upstream、再回填 run id"。本字段在 PENDING 阶段为 null，RUNNING 后非空。

#### ERR-3.3 Status 自动转换矩阵

| 当前 → 目标 | 触发事件 | Orchestrator 操作 |
|---|---|---|
| (new) → PENDING | POST /agent/run | INSERT 入仓 |
| PENDING → RUNNING | DeerFlow run started | 回填 deerflow_run_id |
| RUNNING → PAUSED | RUN_PAUSED | 设置 finished_at = null |
| PAUSED → RUNNING | RUN_RESUMED | 重新计时 |
| RUNNING → COMPLETED | RUN_COMPLETED | 设置 finished_at |
| RUNNING → FAILED | RUN_FAILED | 设置 finished_at + error_code |
| RUNNING → CANCELED | 用户取消 | 设置 finished_at |
| RUNNING → DEGRADED | 任一 Sub-Agent FAILED（D10） | 设置 finished_at（仍记录产出） |

### Task 字段精简

| 字段 | 类型 | 必填 | Phase 1 来源 | 与原 §4.4 对齐 | 备注 |
|---|---|---|---|---|---|
| `taskId` | string (TSK-...) | ✓ | Orchestrator | ✓ 等价 | 主键 |
| `runId` | string | ✓ | Orchestrator | ✓ 等价 | 外键 |
| `parentTaskId` | string | — | 嵌套 task | ✓ 等价 | Phase 1 暂不用 |
| `assigneeAgent` | string | ✓ | Orchestrator | ✓ 等价 | — |
| `objective` | text | ✓ | Plan 派生 | ✓ 等价 | — |
| `input` | jsonb | ✓ | Plan 派生 | ✓ 等价 | — |
| `outputSchema` | jsonb | — | Plan 派生 | ✓ 等价 | — |
| `permissionsRef` | string (PERM-...) | ✓ | Envelope 引用 | ✓ 等价 | — |
| `budget` | jsonb | ✓ | Plan 派生 | ✓ 等价 | 子预算，不超出 run 级预算 |
| `status` | enum | ✓ | Orchestrator | ✓ 等价 | PENDING / RUNNING / COMPLETED / FAILED |
| `createdAt` | timestamp | ✓ | DB default | 🆕 新增 | — |
| `updatedAt` | timestamp | ✓ | DB trigger | 🆕 新增 | — |

**Phase 1 不在 Task 出现的原 §4.4 字段**：`output`、`errorCode`、`errorMessage`——这些推到 Phase 1.5。

#### ERR-3.4 Task DDL

```sql
CREATE TABLE tasks (
    task_id        VARCHAR(64) PRIMARY KEY,
    run_id         VARCHAR(64) NOT NULL REFERENCES agent_runs(run_id),
    parent_task_id VARCHAR(64),
    assignee_agent VARCHAR(128) NOT NULL,
    objective      TEXT NOT NULL,
    input          JSONB NOT NULL,
    output_schema  JSONB,
    permissions_ref VARCHAR(64) NOT NULL,
    budget         JSONB NOT NULL,
    status         VARCHAR(32) NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_status CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED'))
);
CREATE INDEX idx_tasks_run ON tasks(run_id);
```

### 不变量

- **AR-1**：每个 `RUN_STARTED` 对应一行 `agent_runs` INSERT 在事件发出**之前**持久化。
- **AR-2**：`deerflow_run_id` 仅在状态 `PENDING → RUNNING` 时回填；回填后**永不修改**。
- **AR-3**：`status` 转换仅能按 §ERR-3.3 矩阵进行；非法转换被 DB trigger 拒绝。
- **AR-4**：每个 AgentRun 在 Run 终止后**30 天**不可硬删除（软删除 `revoked_at` + `revoked_by`），用于审计回放。
- **AR-5**：`context_envelope_id` 在 status = COMPLETED / FAILED / CANCELED / DEGRADED 后允许为 null（表示 Envelope 已销毁）；但 `revoked_at` 字段会保留 Envelope 销毁记录。
- **TSK-1**：每个 `TASK_CREATED` 对应一行 `tasks` INSERT；同理先 persist 后 emit。
- **TSK-2**：`Task.status = COMPLETED / FAILED` 后**不可修改**回 RUNNING。
- **TSK-3**：`runId` 外键删除策略为 `RESTRICT`（不能单独删 AgentRun）。

### 与主文档的衔接

主文档 §8.1 MVP-1 / MVP-9 的 description 应增加"按 ERR-3 章节定义 DDL"。

---

## ERR-4. ActionProposal 占位 Schema

### 上下文

原 `integration-and-migration-plan §4.8` 给完整 Proposal Schema（proposalId/runId/actionCode/targetObjects/parameters/reason/evidenceRefs/riskLevel/approvalRequired/idempotencyKey/status）。主文档 §4.8 只简略提及 idempotencyKey / approvalRequired。本节给 Phase 1 stub，但**锁定字段集**——Phase 3 一上线就基于此扩。

### Phase 1 MVP Stub Schema

```typescript
interface ActionProposal {
  // 标识
  proposalId: string;            // PROP-<uuid>
  runId: string;                 // 必填
  taskId?: string;

  // 动作语义
  actionCode: string;            // 必填，引用 OntologyAction.actionCode

  // 目标
  targetObjects: string[];       // 例如 ["CUST-10086", "CUST-10087"]

  // 参数
  parameters: JsonNode;

  // 来源与依据
  reason: string;                // ≤ 1024 字符
  evidenceRefs: string[];        // Phase 1 stub 必填项（即使还没启用动作）

  // 风险与策略
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  approvalRequired: boolean;

  // 幂等
  idempotencyKey: string;        // 由 runId + actionCode + targetObjects + parameters 哈希派生

  // 生命周期
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED' | 'EXPIRED';
  decidedBy?: string;            // 审批人 userId 或 'SYSTEM'
  decisionAt?: ISODateTime;
  decisionReason?: string;

  // 时间
  proposedAt: ISODateTime;
  expiresAt: ISODateTime;        // 默认 now + 7 day，超期自动 EXPIRED
}
```

### Phase 1 stub 与 Phase 3 完整版的差异

| 字段 | Phase 1 stub | Phase 3 完整 | 差异说明 |
|---|---|---|---|
| `proposalId` | ✓ | ✓ | 一致 |
| `runId` / `taskId` | ✓ | ✓ | 一致 |
| `actionCode` | ✓ | ✓ | 一致 |
| `targetObjects` | ✓ | ✓ | 一致 |
| `parameters` | ✓ | ✓ | 一致 |
| `reason` | ✓ | ✓ | 一致 |
| `evidenceRefs` | ✓ 必有 | ✓ 必有 | Phase 1 即使只读场景也要填 |
| `riskLevel` | ✓ | ✓ | 一致 |
| `approvalRequired` | ✓ | ✓ | 一致 |
| `idempotencyKey` | ✓ 必有（写 Tool） | ✓ 必有 | 一致 |
| `status` | ✓ 仅 6 个值 | ✓ + 'EXECUTING' / 'EXECUTING_PARTIAL' | Phase 3 扩展 |
| `decidedBy` | ✓ | ✓ | 一致 |
| `decisionAt` | ✓ | ✓ | 一致 |
| `decisionReason` | ✓ | ✓ | 一致 |
| `proposedAt` / `expiresAt` | ✓ | ✓ | 一致 |
| **🆕 approvalChain** | — | ✓ 多签链 | Phase 3 新增 |
| **🆕 rollbackPlan** | — | ✓ 补偿逻辑 | Phase 3 新增 |
| **🆕 preConditions** | — | ✓ 前提检查列表 | Phase 3 新增 |
| **🆕 postConditions** | — | ✓ 后置断言列表 | Phase 3 新增 |
| **🆕 auditFieldsSnapshot** | — | ✓ Action 执行时的字段快照 | Phase 3 新增 |

### DB Schema（action_proposals 表）

```sql
CREATE TABLE action_proposals (
    proposal_id        VARCHAR(64) PRIMARY KEY,
    run_id             VARCHAR(64) NOT NULL REFERENCES agent_runs(run_id),
    task_id            VARCHAR(64),
    action_code        VARCHAR(128) NOT NULL,
    target_objects     JSONB NOT NULL,
    parameters         JSONB NOT NULL,
    reason             TEXT NOT NULL,
    evidence_refs      JSONB NOT NULL,
    risk_level         VARCHAR(16) NOT NULL,
    approval_required  BOOLEAN NOT NULL,
    idempotency_key    VARCHAR(128) NOT NULL,
    status             VARCHAR(32) NOT NULL,
    decided_by         VARCHAR(128),
    decision_at        TIMESTAMP WITH TIME ZONE,
    decision_reason    TEXT,
    proposed_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_risk_level CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_status CHECK (status IN ('PROPOSED','APPROVED','REJECTED','EXECUTED','FAILED','EXPIRED')),
    CONSTRAINT uq_idempotency UNIQUE (idempotency_key)
);
CREATE INDEX idx_action_proposals_run ON action_proposals(run_id);
CREATE INDEX idx_action_proposals_status_expires ON action_proposals(status, expires_at) WHERE status NOT IN ('EXECUTED','FAILED','EXPIRED');
```

### 不变量

- **AP-1**：`evidenceRefs` 长度 ≥ 1，DB CHECK 强制（`jsonb_array_length(evidence_refs) >= 1`）。
- **AP-2**：`idempotency_key` 全局唯一；DB UNIQUE 约束；重复插入返回 `IDEMPOTENCY_KEY_CONFLICT`。
- **AP-3**：`riskLevel = LOW` 时 `approvalRequired = false`；`MEDIUM` 时 `approvalRequired = true`；`HIGH` / `CRITICAL` 时强制多签（Phase 3 决策矩阵）。DB 触发器校验。
- **AP-4**：`status` 转换仅能按 `PROPOSED → (APPROVED | REJECTED) → (EXECUTED | FAILED)` 或 `PROPOSED → EXPIRED`。
- **AP-5**：`expires_at` 默认 `proposed_at + 7 day`；超期自动 `EXPIRED`（后台 Worker 每小时扫描）。
- **AP-6**：Phase 1 MVP 不写 Action，所以此表 Phase 1 MVP 期间为只写不读；Phase 1 必须落 DDL 但不发出 `ACTION_PROPOSED` 事件。
- **AP-7**：`target_objects` 中每个对象 ID **必须**经过 `dataScopes.objectDenied` 校验——任意 target 在黑名单里则 proposal 创建失败。

### 与主文档的衔接

- 主文档 §4.8 "Phase 3 写入 Tool 的占位" 应改为引用本节 ERR-4。
- 主文档 §6.5 CONFLICT_CLAIM 处理时，若冲突来自两个 proposal，则 Errata 补充章节"Proposal 冲突解决" 推 Phase 3。
---

## ERR-5. Middleware 对应映射表

### 上下文

原 `integration-and-migration-plan §6` 列 5 个 Ontology Middleware：

1. OntologyContextMiddleware
2. OntologyGroundingMiddleware
3. OntologyPermissionMiddleware
4. OntologyEvidenceMiddleware
5. OntologyObservationMiddleware

主文档对 Middleware 设计意图保留一致，但**重新组织**为更明确的组件 + 守门员形态。本表说清楚 5 个原 Middleware 与主文档组件的**对应关系**，方便原读者无缝切换。

### 对应矩阵

| 原 migration-plan §6 Middleware | 主文档 §-对应组件 | 对应形态 | 备注 |
|---|---|---|---|
| **OntologyContextMiddleware** | §3 OntologyContextMiddleware | **1:1** | 命名不变、职责不变 |
| **OntologyGroundingMiddleware** | §3.6 4 个 Ground Tool + §4 OntologyToolProvider | **重组** | 把"注入 Concept / Metric 到 prompt / tool schema"拆成"4 个固定的 Ground Tool + Tool Provider 暴露"。等价：Grounding 数据通过 `before_model_call` 钩注入 Tool schema；Tool Provider 校验 LLM 调用权限。 |
| **OntologyPermissionMiddleware** | §3.2 Envelope.dataScopes + §3.7 redact_fields + §4.6 ActionGuard.decide() | **重组** | 把"运行时权限校验"分散到 3 个点：Envelope 内置 dataScopes；Tool Provider 的 redact_fields 后置过滤；ActionGuard 的决策调用。等价：每条 tool_call 都经过这 3 个守门。 |
| **OntologyEvidenceMiddleware** | §5.3 EvidenceExtractor + §5.4 EventTranslator.extractEvidence() | **1:1** | 命名变化、职责不变 |
| **OntologyObservationMiddleware** | §5.4 EventTranslator + §3.7 typed_error + ERR-2 run_events 表 | **重组** | 把"运行时观测"扩展为：Event Translator 转换 + typed_error 协议 + 21 种 RunEvent 表覆盖。等价：所有 tool_call 与 model_call 都产生观测事件入仓。 |

### 重组的设计意图

为什么把 5 Middleware 重组为"组件 + 守门员"？

1. **原 Middleware 是按"AI 视角"切分**——每个 Middleware 都跟 DeerFlow 的 LangGraph 钩子耦合（before_model_call / after_tool_call）。
2. **新组织按"治理层级"切分**——分成 3 层：
   - **接入层（Middleware）**：Envelop、Instruction Segment 的注入
   - **决策层（Guard）**：ActionGuard、MemoryGate 的策略执行
   - **观测层（Translator）**：Event Translator 与 RunEvent 持久化

3. **好处**：
   - 守门员（Guard）不依赖 DeerFlow 的 Middleware 钩顺序，可以独立测试
   - 观测层与决策层解耦后，未来替换 DeerFlow Runtime（SAA / Native）时只动接入层
   - 与 Phase 8 的"原生吸收"路线对齐（Phase 8 把 Middleware 改为 Java/SAA 原生实现，但守门员与观测层不需要重写）

### 等价性证明（每条 Middleware 的核心能力都被新组织满足）

```text
原 OntologyContextMiddleware
  ↔ 核心能力：Inject Context before_model_call
  ↔ 新组织：§3 OntologyContextMiddleware.before_model_call(state, envelope) → 同能力

原 OntologyGroundingMiddleware
  ↔ 核心能力：把 Concept / Metric schema 暴露给 LLM
  ↔ 新组织：§3.6 4 个 Ground Tool + ToolProvider.listAllowed(envelope)
  ↔ 同能力：tool schema 等价于 Concept schema 暴露

原 OntologyPermissionMiddleware
  ↔ 核心能力：拦截 tool_call 越权
  ↔ 新组织：3 重守门 = Envelope.dataScopes + ToolProvider.redact_fields + ActionGuard.decide()
  ↔ 同能力：所有 tool_call 都经过 3 重校验

原 OntologyEvidenceMiddleware
  ↔ 核心能力：所有 tool_result 包成 Evidence
  ↔ 新组织：§5.4 EventTranslator.extractEvidence(toolResult) 注册到 run_events
  ↔ 同能力：每条 tool_result 都产生 EVIDENCE_ATTACHED 事件

原 OntologyObservationMiddleware
  ↔ 核心能力：生成 RunEvent
  ↔ 新组织：§5.4 EventTranslator.persistAndForward() + ERR-2 21 种事件
  ↔ 同能力：所有关键节点产生 RunEvent
```

### 主文档的对应章节修改建议

| 主文档章节 | 当前内容 | 建议修改 |
|---|---|---|
| §6 主文档（设计上未单独叫"5 Middleware"） | 列出 Envelope + Tool + Skill + Sub-Agent 等层 | 在 §3.9 之前加一段： "本主文档对 Middleware 设计按以下重组：Context (1:1) / Grounding (→4 Ground Tools + ToolProvider) / Permission (→Envelope.dataScopes + ToolProvider.redact_fields + ActionGuard) / Evidence (1:1) / Observation (→EventTranslator + RunEvent)——见 ERR-5。" |

### 不变量

- **MW-1**：原 5 Middleware 的核心能力都被新组织满足，证明见 ERR-5 §"等价性证明"。
- **MW-2**：原 Middleware 设计文档（migration-plan §6）的具体调用流程图，可作为新组织实现的对照参考——不是要被替换的设计，而是要被**复现**的功能。
- **MW-3**：Phase 8 把 Middleware 改 Java/SAA 原生实现时，本表 §"对应矩阵" 必须保持映射不变——除非显式发起 ERR 修订。

### 与主文档的衔接

主文档的 §6 / §7 等章节以"概念"为单位展开，未按"Middleware"维度。本表提供"读者从原 §6 切换到主文档"的导航。

---

## ERR-6. Phase 1 fallback 策略声明

### 上下文

原 `deerflow-production-integration-design §2.2` 给出 Native / DeerFlow / hybrid 三种 runtime 策略，并规定：

> "Normal explanation or single-object summary: NATIVE"
> "Cross-domain analysis: DEERFLOW"
> "DeerFlow 不可用 → MetaPlatform provides circuit breaking / Native fallback"

主文档完全未涉及此层（因为 Phase 1 MVP 范围聚焦 DeerFlow）。本节明确 Phase 1 MVP **不实现 fallback**，作为范围决策。

### Phase 1 MVP 范围决策

| 项 | 决策 | 原因 |
|---|---|---|
| 运行时策略 | **仅支持 DEERFLOW + FAST_QUERY** | 与"DeerFlow 是 AI 载体"战略对齐，Phase 1 不引入 NATIVE 概念 |
| runtimeType 枚举值 | Phase 1 仅 `DEERFLOW` / `FAST_QUERY` | `NATIVE` / `METAFLOW` 推后 |
| DeerFlow 不可用 | **返回 typed_error `ENVELOPE_CARRIER_UNAVAILABLE`** | 不自动降级到 NATIVE |
| 前端处理 | 显示"AI 服务暂时不可用，请稍后再试" | 由前端捕获特定错误码 |
| Circuit Breaker | Phase 1 **不实现** | 推 Phase 1.5，2 周内可补 |
| Read timeout | 30s（与 AgentRun budget.wallTimeMs 对齐） | 单 Run 内可重试 |
| Stream timeout | 60s 无事件 | 触发 reconnect，断流超过 5 分钟失败 |

### 错误码定义

新增枚举值：

| 错误码 | 含义 | 处理 |
|---|---|---|
| `ENVELOPE_CARRIER_UNAVAILABLE` | DeerFlow Gateway 不可达 / 不健康 / 配置缺失 | 前端显示降级提示；用户可重试 |

DB Schema 追加（`run_events.payload` 的 errorCode 字段允许此值）：

```sql
ALTER TABLE run_events
    ADD CONSTRAINT chk_error_code_valid CHECK (
        error_code IS NULL OR error_code IN (
            'ENVELOPE_NOT_FOUND','ENVELOPE_EXPIRED','ENVELOPE_INVALID',
            'INSTRUCTION_TAMPERED','TOOL_NOT_IN_ALLOWLIST','TOOL_RESULT_LEAKED_FIELD',
            'OBJECT_ACCESS_DENIED','CONFLICT_CLAIM','MEMORY_WRITE_DENIED',
            'CANDIDATE_REJECTED','ARTIFACT_BLOCKED','ARTIFACT_REVOKED',
            'ENVELOPE_CARRIER_UNAVAILABLE'
        )
    );
```

注：错误码 CHECK 约束应同步到主文档附录 A 错误码速查表（追加 `ENVELOPE_CARRIER_UNAVAILABLE`）。

### 前端契约

```typescript
interface SuperAIErrorResponse {
  errorCode: 'ENVELOPE_CARRIER_UNAVAILABLE' | string;
  errorMessage: string;
  retryAfterSeconds?: number;
  userActionHint?: string;     // 例如：'AI 服务暂时不可用，请稍后再试'
  metadata?: { carrier?: 'DEERFLOW'; reason?: string };
}
```

前端路由表（apps/superai/errors.ts）：

| errorCode | UI 行为 |
|---|---|
| `ENVELOPE_CARRIER_UNAVAILABLE` | 顶部 Banner："AI 服务暂时不可用，请稍后再试"；按钮"重试" |
| `ENVELOPE_EXPIRED` | 提示重新提问；自动重 build envelope |
| `TOOL_NOT_IN_ALLOWLIST` / `OBJECT_ACCESS_DENIED` | 提示"无权限"；不可重试 |
| 其它 5xx-style | 通用错误提示 |

### Phase 1.5 启动后的 fallback 计划

满足以下条件再考虑引入 Native fallback：

1. §8.4 第一个验收场景连续 14 天稳定（无 DeerFlow 单点事故）
2. SAA Graph Runtime（MVP 16 项中的部分准备工作）已就绪
3. ActionGuard 与 ToolProvider 不需要重写

引入时按以下顺序：

| 阶段 | 工作量 | 内容 |
|---|---|---|
| Phase 1.5-a | 2 周 | runtimeType 新增 `NATIVE`；为 cross-domain 场景增加"运行时决策"逻辑 |
| Phase 1.5-b | 1 周 | Circuit Breaker：DeerFlow 失败超阈值自动切到 `NATIVE` |
| Phase 1.5-c | 1 周 | Native Runtime 实现 `customer-detail` 路径的 NLG 模板（用户接受降级体验） |

### 不变量

- **FB-1**：Phase 1 MVP **绝不能**自动 fallback 到 NATIVE——这是契约违反。
- **FB-2**：DeerFlow 不可达时**必须**返回 `ENVELOPE_CARRIER_UNAVAILABLE`，而不是默默失败或 5xx。
- **FB-3**：前端**必须**为此错误码提供专属 UI（不是通用 5xx 提示）。
- **FB-4**：Adapter 客户端**必须**记录"DeerFlow 不可达"次数与最近原因，写入 TECH-OBS，为 Phase 1.5 启动 fallback 决策提供数据。
- **FB-5**：Phase 1 MVP 没有 `NATIVE` runtimeType；如果人为传入，应返回 `RUNTIME_TYPE_NOT_SUPPORTED`。

### 与主文档的衔接

- 主文档 §2 5 个契约概览表内 runtimeType 列已隐含"支持 DEERFLOW"；本节明确 Phase 1 仅 DEERFLOW + FAST_QUERY。
- 主文档 §8 第一个验收场景的 Gate D 验证（deerflow 不可用时的行为）：与本节对齐——验证 `ENVELOPE_CARRIER_UNAVAILABLE` 而非 fallback。

---

## 附录 A：补丁 ↔ 主文档章节对应表

| 补丁章节 | 主文档待补/待改章节 | 动作 |
|---|---|---|
| **ERR-1** §InteractionContext | 主文档缺独立章节 | **新增 §2.5** InteractionContext |
| ERR-1 服务端校验 | 主文档 §3.2 / §3.7 | 加入 4 条校验规则 + PII 行为 |
| **ERR-2** §21 事件清单 | 主文档 §3.7、§5.4、§7.9、附录 A | **重写** 引用 ERR-2 对应 payload Schema |
| ERR-2 DB Schema | 主文档 §8.1 MVP-9 | 加入 `run_events` 表 DDL 到 MVP-9 |
| **ERR-3** §AgentRun 字段 | 主文档 §8.1 MVP-1 / MVP-16 | 加入 DDL（§ERR-3.1 + §ERR-3.4） |
| ERR-3.3 Status 转换矩阵 | 主文档 §8 / 验收 AC | 加入状态转换触发事件与 Orchestrator 操作 |
| **ERR-4** §ActionProposal | 主文档 §4.8 占位 | **替换** §4.8 "Phase 3 写入 Tool 占位"为 ERR-4 |
| ERR-4 DB Schema | 主文档 §8.1（Phase 6 任务） | 加入 DDL；Phase 1 MVP 期间只写 DDL 不发事件 |
| **ERR-5** §Middleware 对应 | 主文档 §6 设计意图段 | 在 §3.9 之前加"Middleware 对应声明"小段 |
| **ERR-6** §Fallback 策略 | 主文档 §2 概览表 runtimeType 列；§8 Gate D | 明确"仅 DEERFLOW + FAST_QUERY"；Gate D 验证 `ENVELOPE_CARRIER_UNAVAILABLE` |

### 实施顺序建议

1. **第一步：补 ERR-1 到主文档 §2.5**（最高优先，AI 实施助手起步就缺）
2. **第二步：补 ERR-3 到主文档 §8.1**（MVP 启动需要 DDL）
3. **第三步：补 ERR-2 + ERR-4 到附录**（Schema 稳定后才好让 AI review 检查）
4. **第四步：补 ERR-5 + ERR-6 到主文档 §3.9 / §8 Gate D**（设计意图与验收对齐）

---

## 附录 B：补丁不变量一览

| 补丁 | 编号 | 摘要 |
|---|---|---|
| ERR-1 | IC-1 | message 与 interaction 必填 |
| ERR-1 | IC-2 | subject.conceptCode 必须在 Ontology Concept Registry |
| ERR-1 | IC-3 | 服务端永不信任前端 tenantId / userId / roles |
| ERR-1 | IC-4 | message 进入 envelope.build 前规范化 |
| ERR-1 | IC-5 | viewState.filters.timeRange 与 dataScopes.regions 取交集 |
| ERR-1 | IC-6 | additionalProperties 严格 false |
| ERR-2 | RE-1 | payload 必须严格匹配 interface，CI 校验 |
| ERR-2 | RE-2 | 事件先 persist 后 forward |
| ERR-2 | RE-3 | eventId 全局唯一，缺字段不入仓 |
| ERR-2 | RE-4 | 同 run_id 下事件 ts 严格单调 |
| ERR-2 | RE-5 | traceId 与 runId 1:1 |
| ERR-2 | RE-6 | 21 种事件 type 全部允许（暂不发也算合法） |
| ERR-2 | RE-7 | PII 字段事件 persist 前剥离 |
| ERR-2 | RE-8 | CLAIM_PRODUCED 事件 evidenceRefCount = 0 时 type 不能是 FACT |
| ERR-3 | AR-1 | RUN_STARTED 入仓先于事件发出 |
| ERR-3 | AR-2 | deerflow_run_id 仅 PENDING → RUNNING 回填，永久不变 |
| ERR-3 | AR-3 | status 转换只能按矩阵 |
| ERR-3 | AR-4 | AgentRun 软删除 30 天保留 |
| ERR-3 | AR-5 | Envelope 销毁不影响 AgentRun 表 |
| ERR-3 | TSK-1 | TASK_CREATED 入仓先于事件发出 |
| ERR-3 | TSK-2 | Task 终态不可回 RUNNING |
| ERR-3 | TSK-3 | AgentRun 删除策略 RESTRICT |
| ERR-4 | AP-1 | evidenceRefs 长度 ≥ 1 |
| ERR-4 | AP-2 | idempotency_key 全局唯一 |
| ERR-4 | AP-3 | riskLevel / approvalRequired 联动约束 |
| ERR-4 | AP-4 | status 转换只能按矩阵 |
| ERR-4 | AP-5 | 超期自动 EXPIRED |
| ERR-4 | AP-6 | Phase 1 只写 DDL 不发 ACTION_PROPOSED 事件 |
| ERR-4 | AP-7 | target_objects 受 dataScopes.objectDenied 校验 |
| ERR-5 | MW-1 | 原 5 Middleware 能力被新组织完整复现 |
| ERR-5 | MW-2 | 原 §6 设计文档作为功能参照 |
| ERR-5 | MW-3 | Phase 8 改原生实现时映射不变 |
| ERR-6 | FB-1 | Phase 1 不自动 fallback 到 NATIVE |
| ERR-6 | FB-2 | DeerFlow 不可达必返回 ENVELOPE_CARRIER_UNAVAILABLE |
| ERR-6 | FB-3 | 前端必为 ENVELOPE_CARRIER_UNAVAILABLE 提供专属 UI |
| ERR-6 | FB-4 | Adapter 客户端记录不可达计数与原因 |
| ERR-6 | FB-5 | Phase 1 runtimeType 仅有 DEERFLOW / FAST_QUERY |

合计 38 条补丁不变量（含主文档 37 条 = 总计 75 条不变量体系）。

---

> 文档完。后续补丁修订需同步更新主文档相应章节；主文档对应章节若重写，补丁条目自动过期，CI 应做交叉校验。