# A2A 协议层规范(技术能力)

> 版本:v1.0 · 2026-07-31
> 类型:**技术能力规范**(与 `architecture-implementation.md` / `production-readiness-design.md` 同级)
> 关联:`PRD-APP-COPILOT_v2.3-20260727.md` §3.5(A2A 委托)+ §3.6(外部 agent-cards)+ `ADR-0014` + `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.1 §4.3
> 状态:**Active**(供 P2-W3 真实实现参考)

---

## 1. 范围与定位

A2A(Agent-to-Agent)是 Mate Platform 中 SuperAI 域(copilot)与外部 AI Agent 系统对接的协议层。**它不是面向终端用户的独立业务模块**,而是技术能力,被 copilot 通过 HTTP API 调用。

### 1.1 设计目标

- **统一代理协议**:SuperAI 域可以调用企业内任何符合 A2A 协议的 Agent,无需定制集成。
- **能力发现**:SuperAI 域可以在调用前查询 agent 的能力清单(`capabilities`),避免误调。
- **任务委托**:SuperAI 域可以把任务委托给合适的 Agent,等待结果返回。
- **可观测性**:每次委托都有 trace_id + audit,接入 OTel 与 audit.log。

### 1.2 与已有 PRD / Spec 的关系

| 文档 | 关系 |
|---|---|
| `PRD-APP-COPILOT_v2.3` §3.5 A2A 委托 | 业务方需求来源(用户场景) |
| `ADR-0014` §2.2 集成三层 | 集成模式(auth / tenant / event) |
| `architecture-implementation.md` §1.2 服务全景 | A2A 在服务矩阵中的位置 |
| **本文** | A2A 协议层技术规范(API + 数据模型 + 安全) |
| `PRD-APP-MCPHUB-MCP服务中心_v2.2` | 与 A2A 的区别:MCP 是工具调用,A2A 是 Agent 间任务委托 |

---

## 2. 数据模型

### 2.1 Agent Card

```yaml
AgentCard:
  id: string           # agent_id,UUID
  name: string         # 人类可读名,如 "kpi-analysis-bot"
  description: string  # 一句话描述
  capabilities:
    - id: string       # 能力 ID,如 "kpi.compute"
      description: string
      input_schema: JSONSchema
      output_schema: JSONSchema
  endpoint: string     # agent HTTP endpoint,如 "http://kpi-bot.internal/agent"
  auth:                # agent 服务身份
    client_id: string
    scopes: [string]
  metadata: object
  created_at: datetime
  updated_at: datetime
```

### 2.2 A2A Task

```yaml
A2ATask:
  id: string             # task_id,UUID
  source_agent_id: string # 调用方(copilot 子任务)
  target_agent_id: string # 被委托方
  capability_id: string  # 调用的能力 ID
  status:
    - pending          # 已创建未发
    - submitted        # 已发到 target
    - running          # target 正在处理
    - completed        # 成功
    - failed           # 失败,带 error_code
    - cancelled        # 调用方取消
    - timeout          # target 超时未响应
  input: object         # 输入 payload,匹配 capability input_schema
  output: object        # 输出 payload,匹配 capability output_schema
  trace_id: string      # OTel trace_id,跨服务追踪
  tenant_id: string     # 强制 tenant 隔离
  created_at: datetime
  started_at: datetime
  completed_at: datetime
  error_code: string    # 失败时的标准化错误码
  error_message: string
```

### 2.3 A2A Delegation Record(audit)

```yaml
A2ADelegationRecord:
  id: string
  tenant_id: string
  source_agent: string
  target_agent: string
  capability: string
  task_id: string
  trace_id: string
  outcome: success | failure | cancelled | timeout
  latency_ms: int
  timestamp: datetime
  user_id: string  # 触发该委托的最终用户
```

---

## 3. API 规范

A2A 域服务 OpenAPI 文件:`contracts/openapi/services/a2a.yaml`(已签)。完整 12 个 endpoint。

### 3.1 Agent Card 管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/v1/a2a/agent-cards/search` | 按能力名 / 描述搜索 agent(spec 当前路径;P2-W3 可能调整为 `/agents`) |
| GET | `/api/v1/a2a/agents` | 列出 tenant 可见的 agent(已在 P2-W2 PR#14 实现,需要 spec 调整) |
| GET | `/api/v1/a2a/agents/{id}` | 获取单个 agent 详情 |
| GET | `/api/v1/a2a/agents/{id}/capabilities` | 获取 agent 能力清单 |
| POST | `/api/v1/a2a/register` | 注册新 agent(需 admin 角色) |

### 3.2 任务委托

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/v1/a2a/delegate` | 提交委托任务(spec 当前路径;P2-W2 已在 copilot 包内 stub) |
| GET | `/api/v1/a2a/delegations` | 列出当前 tenant 的委托记录 |

### 3.3 任务管理

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/v1/a2a/tasks` | 列出 tenant 的任务 |
| GET | `/api/v1/a2a/tasks/{id}` | 获取单个任务详情 |
| POST | `/api/v1/a2a/tasks/{id}/result` | Agent 上报任务结果(由被调方调用) |

### 3.4 健康

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/v1/a2a/health` | A2A 服务健康探针 |

> ⚠️ **P2-W2 已落地但路径错位**:当前 `mate-app-a2a` 包内有 10 个 endpoint 实现,但路径与 spec 不一致(代码用 `/agents`、spec 期望 `/agent-cards/search`)。**P2-W3 必须先解决路径对齐**(改 spec 改文档,或改代码改路径)。

---

## 4. 关键业务规则

### 4.1 Agent 注册规则

- **每个 agent 必须有至少 1 个 capability**,否则注册失败(`E_AGENT_NO_CAPABILITY`)。
- **capability.id 全局唯一**(tenant 范围内)。
- **endpoint 必须在 tenant VPC / 内网可达**(公网 endpoint 需特殊审批流程)。
- **scopes 必须从 Keycloak client_id 派生**,不支持手动写死。

### 4.2 任务委托规则

- **调用方与被调方必须同一 tenant**(TD-4 真实实现后,跨 tenant 需 `cross_tenant_admin` 角色)。
- **input 必须通过 capability.input_schema 校验**,不匹配 → 400。
- **超时默认 30 秒**,可由调用方 override(最长 5 分钟)。
- **任务状态机**:`pending → submitted → running → (completed | failed | cancelled | timeout)`,不允许逆向。

### 4.3 结果上报规则

- **result 由被调方 agent 调用 `POST /tasks/{id}/result`** 上报,不是 copilot 主动拉取(异步推送模型)。
- **result payload 必须通过 capability.output_schema 校验**。
- **同一 task_id 多次 result 仅最后一次生效**(idempotent)。
- **result 上报后,被调方保留 task_id 与 trace_id 至少 7 天**(审计要求)。

### 4.4 安全与租户

- **所有 A2A endpoint 走 §13 硬规则 3**:`require_tenant(ctx)`,无 tenant 直接拒绝。
- **agent_card 是 tenant 范围资源**,不能跨 tenant 访问。
- **能力发现**(`/agent-cards/search`)只返回当前 tenant 可见的 agent + 平台共享 agent。
- **admin 操作**(register / unregister agent)需 `platform.admin` 角色。

---

## 5. 与其他系统的集成

### 5.1 与 copilot 的关系

```
copilot /scheduling/plan/generate
   │
   │ 内部调用
   ▼
a2a /delegate (POST)
   │
   │ 转发
   ▼
外部 agent (kpi-bot / report-bot / 业务 RAG Agent)
```

### 5.2 与 mcp 的关系

- **MCP**:工具调用协议(MCP tools/resources/prompts),给 Agent 提供能力。
- **A2A**:Agent 间任务委托协议,让多个 Agent 协作。
- **可以组合**:A2A 委托一个 Agent,该 Agent 内部用 MCP 调用工具。

### 5.3 与 OTel 的关系

- 每个 task 都有 `trace_id`,在 A2A → target agent 链路全程传播。
- `A2ADelegationRecord` 写到 audit log,通过 Loki / Tempo 可查询。

### 5.4 与 IAM 的关系

- 调用方 agent 的 identity 通过 Keycloak client_credentials 颁发。
- 被调方 agent 验证调用方的 `azp` (authorized party) 字段。
- A2A 服务本身需要 `platform.a2a` scope。

---

## 6. 错误码

| Code | HTTP | 说明 |
|---|---|---|
| `E_AGENT_NOT_FOUND` | 404 | agent_id 不存在或当前 tenant 不可见 |
| `E_AGENT_NO_CAPABILITY` | 400 | 注册时 agent 无 capability |
| `E_CAPABILITY_NOT_FOUND` | 404 | 调用的 capability_id 不存在 |
| `E_INPUT_SCHEMA_INVALID` | 400 | input 不匹配 capability.input_schema |
| `E_OUTPUT_SCHEMA_INVALID` | 400 | output 不匹配 capability.output_schema |
| `E_TASK_TIMEOUT` | 504 | target agent 超时未响应 |
| `E_TASK_CANCELLED` | 410 | 任务被调用方取消 |
| `E_CROSS_TENANT_FORBIDDEN` | 403 | 调用方 / 被调方 tenant 不一致 |
| `E_AGENT_AUTH_FAILED` | 401 | 被调方 agent 拒绝调用(无权限) |
| `E_INTERNAL` | 500 | A2A 服务内部错误(应触发 trace 上报) |

---

## 7. 性能与可用性

| 指标 | 目标 |
|---|---|
| agent_card.search P95 | < 200ms |
| 任务委托 P95(同步部分) | < 500ms |
| 任务委托 P95(异步部分) | < 30s(可配置 5 分钟) |
| A2A 服务可用性 SLA | 99.9% |
| 同时进行中的 task 数(单 tenant) | ≤ 1000 |
| agent 注册数(全平台) | ≤ 10000 |

---

## 8. 安全与合规

- **认证**:所有 endpoint 走 Keycloak JWT,§13 硬规则 4 ACL Client。
- **审计**:每次委托 / 注册都写到 audit log(§13 硬规则 9)。
- **限流**:每个 tenant 每分钟 ≤ 100 次 delegate 请求。
- **数据脱敏**:capability.input/output 中敏感字段(如身份证 / 银行卡)自动脱敏(对接 `mate_clients.security.pii_mask`)。
- **网络隔离**:agent endpoint 必须用 mTLS / IP allowlist,不允许公网明文。

---

## 9. P2-W3 落地清单

| 任务 | 工作量 | 阻塞 |
|---|---|---|
| 路径对齐(spec vs 代码) | 0.5 天 | 无 |
| TD-4 真实实现(delegate/external) | 1 周 | 路径对齐 |
| 跨服务 mTLS 配置 | 0.5 周 | Keycloak realm |
| Agent 注册流程 admin 工具 | 1 周 | 前端 |
| 性能压测(1000 task 并发) | 1 周 | staging 集群 |
| ADR-0017 决策(独立 / 嵌入 copilot) | 0.5 天 | 无 |

合计 **4-5 周 / 6 个 PR**。

---

## 10. 关联文档

- `PRD-APP-COPILOT_v2.3-20260727.md` §3.5 / §3.6 — 业务方需求
- `PRD-APP-MCPHUB-MCP服务中心_v2.2-20260727.md` — MCP vs A2A 区别
- `ADR-0014-tech-services-integration.md` — 集成模式
- `docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` — 架构基线
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §13 — 硬规则
- `contracts/openapi/services/a2a.yaml` — 契约源
- `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.1 §4.3 — 接口清单

---

## 11. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-31 | v1.0 初版(技术能力规范,A2A 协议层完整定义) | TRAE 补 PRD |