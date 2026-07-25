# TECH-AGENT - Agent 框架服务

> 创建于 2026-07-24，对应 v1.2 全 Java + SAA 重写基线（替代 v1.1 的 Python/LangChain 实现）。
> 对应 commit：`75fc43be refactor: cleanup project, restore PRD docs to docs/prd/` + R3 重写期。

## 模块类型

TECH 模块（AI 中间层）

## 作用

Mate Platform 的 Agent 框架服务，提供**数字员工运行时 + 单 Agent 定义管理 + 多 Agent 协作（A2A）+ 评估与学习**。向上承接 `APP-DW`（数字员工）与 `APP-COPILOT`（超级 AI）的 Agent 调度需求，向下通过 `TECH-LLMGW` 统一调用大模型、通过 `TECH-RAG` 实现知识检索、通过 `TECH-ACTION` 执行业务动作。

## 上游依赖

- `TECH-LLMGW`：所有 LLM 调用通过 LLM Gateway（`clients/LLMGWClient`）
- `TECH-RAG`：Agent 知识检索（`clients/RAGClient`）
- `TECH-ACTION`：业务动作执行（`clients/ActionClient`）
- `TECH-ONT`：本体概念引用（计划）
- `TECH-IAM`：用户/租户/权限校验（白名单 + JWT）
- `TECH-MSG`：Kafka 事件基础设施（计划，Outbox 模式）
- **Nacos 3.0+ Discovery/Config**（`@EnableDiscoveryClient`）

## 下游消费

- `APP-DW`：数字员工管理、Agent 执行调度
- `APP-COPILOT`：超级 AI 对话 + Plan 执行
- `TECH-A2A`：跨系统 Agent 协作（基于 `collaboration/*` 域）
- `APP-DASHBOARD`：Agent 运行统计
- `APP-APPHUB`：低代码应用嵌入 Agent 能力

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言 | **Java** | **25 LTS** | 唯一后端语言（v1.2 强制） |
| 框架 | Spring Boot | 3.5.0 | 微服务基础 |
| 框架 | Spring Cloud | 2025.1.2 | 微服务治理 |
| 框架 | Spring Cloud Alibaba | 2025.0.0.0 | Nacos Discovery/Config |
| AI | **Spring AI Alibaba** | **1.1.2.2** | **AI 编排统一底座**（BOM 管理） |
| AI | SAA Agent Framework | 1.1.2.2 | ReAct / Plan-and-Solve |
| AI | SAA Graph Core | 1.1.2.2 | 状态图 / DAG 编排 |
| AI | SAA DashScope | 1.1.2.2 | 阿里云模型接入 |
| AI | SAA Graph Observation | 1.1.2.2 | OpenTelemetry 链路埋点 |
| AI | SAA Nacos MCP Client | 1.1.2.2 | MCP 工具发现 |
| 数据 | Spring Data JPA | — | 替换 SQLAlchemy |
| Web | Spring MVC + 虚拟线程 | — | `Thread.startVirtualThread` 用于 SSE 流式执行 |
| 安全 | JJWT | 0.12.6 | JWT 鉴权 |
| 消息 | Spring Kafka | — | 事件发布（Outbox 计划中） |
| 校验 | Jakarta Validation | — | `@Valid` + DTO |
| DB | PostgreSQL / H2 | 17 / 2.x | 持久化（开发可走 H2） |
| 迁移 | Flyway | — | schema 演进（计划中） |
| 链路 | OpenTelemetry | 1.45+ | `X-Trace-Id` 透传（`TraceFilter`） |

## 端口

```
HTTP: 8401
gRPC: — (纯 HTTP / SSE)
Nacos Service Name: mate-agent-tech-agent-server
```

## 目录结构（实际 90+ 文件）

```
TECH-AGENT/
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/agent/
│   │   │   ├── AgentApplication.java             # 启动类（@EnableDiscoveryClient）
│   │   │   ├── agents/                            # Agent 定义域
│   │   │   │   ├── AgentController.java
│   │   │   │   ├── AgentService.java
│   │   │   │   └── dto/                           # Create/Update/Clone/Response/Version/Log
│   │   │   ├── agent_card/                        # Agent 名片（A2A 暴露）
│   │   │   │   ├── AgentCardController.java
│   │   │   │   ├── AgentCardService.java
│   │   │   │   └── dto/AgentCardResponse.java
│   │   │   ├── checkpoint/                        # 长任务 Checkpoint
│   │   │   │   ├── CheckpointController.java
│   │   │   │   ├── CheckpointService.java
│   │   │   │   ├── CheckpointResponse.java
│   │   │   │   └── SaveCheckpointRequest.java
│   │   │   ├── clients/                           # 对外 HTTP 客户端
│   │   │   │   ├── ActionClient.java              # → TECH-ACTION
│   │   │   │   ├── LLMGWClient.java               # → TECH-LLMGW
│   │   │   │   └── RAGClient.java                 # → TECH-RAG
│   │   │   ├── collaboration/                     # A2A 多 Agent 协作
│   │   │   │   ├── CollaborationController.java
│   │   │   │   ├── CollaborationService.java
│   │   │   │   ├── CollaborationTask.java
│   │   │   │   ├── CollaborationReport.java
│   │   │   │   ├── Contribution.java
│   │   │   │   ├── SubTask.java
│   │   │   │   └── CreateCollaborationRequest.java
│   │   │   ├── common/                            # 公共基座
│   │   │   │   ├── ApiResponse.java               # 统一响应 {code,message,data,traceId}
│   │   │   │   ├── ErrorCode.java                 # 错误码枚举
│   │   │   │   ├── PageResponse.java
│   │   │   │   ├── TenantContext.java             # 租户/用户/trace 上下文（ThreadLocal）
│   │   │   │   └── TraceFilter.java               # X-Trace-Id 透传
│   │   │   ├── config/
│   │   │   │   ├── AgentProperties.java           # @ConfigurationProperties
│   │   │   │   ├── ChatClientConfig.java          # SAA ChatClient 装配
│   │   │   │   ├── GraphObservationConfig.java    # SAA Graph Observation 装配
│   │   │   │   └── WebClientConfig.java           # WebClient for clients/*
│   │   │   ├── conversations/                     # 对话域
│   │   │   │   ├── ConversationController.java
│   │   │   │   ├── ConversationService.java
│   │   │   │   ├── ConversationResponse.java
│   │   │   │   ├── MessageResponse.java
│   │   │   │   ├── CreateConversationRequest.java
│   │   │   │   └── SendMessageRequest.java
│   │   │   ├── employees/                         # 数字员工（APP-DW 后端）
│   │   │   │   ├── EmployeeController.java
│   │   │   │   ├── EmployeeService.java
│   │   │   │   └── dto/
│   │   │   ├── entity/                            # 14 张 JPA 实体
│   │   │   │   ├── AgentDefinitionEntity.java     # Agent 定义
│   │   │   │   ├── AgentVersionEntity.java        # Agent 版本快照
│   │   │   │   ├── AgentOperationLogEntity.java   # 操作审计
│   │   │   │   ├── AgentTaskEntity.java           # 任务
│   │   │   │   ├── AgentStepEntity.java           # 执行步骤
│   │   │   │   ├── AgentToolCallEntity.java       # 工具调用记录
│   │   │   │   ├── AgentToolEntity.java           # MCP 工具注册
│   │   │   │   ├── AgentCheckpointEntity.java     # Checkpoint 状态
│   │   │   │   ├── AgentConversationEntity.java   # 对话主表
│   │   │   │   ├── AgentMessageEntity.java        # 对话消息
│   │   │   │   ├── AgentEvaluationEntity.java     # 评估记录
│   │   │   │   ├── MemorySessionEntity.java       # 记忆会话
│   │   │   │   └── MemoryMessageEntity.java       # 记忆消息
│   │   │   ├── evaluation/                        # 自动 + 人工评估
│   │   │   │   ├── EvaluationController.java
│   │   │   │   ├── EvaluationService.java
│   │   │   │   ├── EvaluationReport.java
│   │   │   │   ├── EvaluationReportDetail.java
│   │   │   │   ├── ScoringRubric.java
│   │   │   │   ├── AutoScoreRequest/Result.java
│   │   │   │   ├── BatchAutoScoreRequest.java
│   │   │   │   ├── ManualScoreRequest.java
│   │   │   │   ├── AggregateReportRequest/Response.java
│   │   │   │   ├── GenerateReportRequest.java
│   │   │   │   ├── GenerateSuggestionsRequest.java
│   │   │   │   ├── Suggestion.java
│   │   │   │   └── ConversationRecord.java
│   │   │   ├── exception/
│   │   │   │   ├── AgentException.java
│   │   │   │   └── GlobalExceptionHandler.java    # @RestControllerAdvice
│   │   │   ├── execution/                         # Agent 执行引擎（SAA ReAct/Plan）
│   │   │   │   ├── ExecutionController.java       # /execute + /execute/stream
│   │   │   │   ├── ExecutionService.java
│   │   │   │   ├── ExecutionEngine.java           # 接口
│   │   │   │   ├── SaAgentExecutionEngine.java    # SAA 实现
│   │   │   │   ├── ExecuteRequest/Response.java
│   │   │   │   ├── ExecuteContext.java
│   │   │   │   ├── ExecutionResult.java
│   │   │   │   ├── ExecutionStatus.java
│   │   │   │   ├── ExecutionStep.java
│   │   │   │   ├── ExecutionStepType.java
│   │   │   │   ├── ExecutionMetrics.java
│   │   │   │   ├── OutputContent.java
│   │   │   │   └── TokenUsage.java
│   │   │   ├── learning/                          # 反馈 + 知识提炼
│   │   │   │   ├── LearningController.java
│   │   │   │   ├── LearningService.java
│   │   │   │   ├── LearningStats.java
│   │   │   │   ├── FeedbackCreateRequest.java
│   │   │   │   ├── FeedbackRecord.java
│   │   │   │   ├── KnowledgeExtractRequest.java
│   │   │   │   ├── KnowledgeSyncResult.java
│   │   │   │   └── LearnedKnowledge.java
│   │   │   ├── memory/                            # 短期/长期记忆
│   │   │   │   ├── MemoryService.java
│   │   │   │   ├── MemorySessionResponse.java
│   │   │   │   └── MemoryMessageResponse.java
│   │   │   ├── plans/                             # Plan-and-Resolve
│   │   │   │   ├── PlanController.java
│   │   │   │   ├── PlanService.java
│   │   │   │   ├── Plan.java
│   │   │   │   ├── PlanStep.java
│   │   │   │   └── CreatePlanRequest.java
│   │   │   ├── repository/                        # 14 个 Spring Data Repository
│   │   │   │   ├── AgentDefinitionRepository.java
│   │   │   │   ├── AgentVersionRepository.java
│   │   │   │   ├── AgentOperationLogRepository.java
│   │   │   │   ├── AgentTaskRepository.java
│   │   │   │   ├── AgentStepRepository.java
│   │   │   │   ├── AgentToolCallRepository.java
│   │   │   │   ├── AgentToolRepository.java
│   │   │   │   ├── AgentCheckpointRepository.java
│   │   │   │   ├── AgentConversationRepository.java
│   │   │   │   ├── AgentMessageRepository.java
│   │   │   │   ├── AgentEvaluationRepository.java
│   │   │   │   ├── MemorySessionRepository.java
│   │   │   │   └── MemoryMessageRepository.java
│   │   │   ├── steps/                             # 执行步骤管理
│   │   │   │   ├── StepController.java
│   │   │   │   ├── StepService.java
│   │   │   │   ├── StepResponse.java
│   │   │   │   ├── EvaluationResponse.java
│   │   │   │   ├── ToolCallResponse.java
│   │   │   │   └── SubmitEvaluationRequest.java
│   │   │   ├── tasks/                             # 任务管理
│   │   │   │   ├── TaskController.java
│   │   │   │   ├── TaskService.java
│   │   │   │   ├── TaskResponse.java
│   │   │   │   ├── TaskStatistics.java
│   │   │   │   ├── CreateTaskRequest.java
│   │   │   │   ├── AssignTaskRequest.java
│   │   │   │   └── UpdateTaskStatusRequest.java
│   │   │   └── tools/                             # MCP 工具域
│   │   │       ├── ToolController.java
│   │   │       ├── ToolService.java
│   │   │       ├── ToolResponse.java
│   │   │       ├── CreateToolRequest.java
│   │   │       ├── UpdateToolRequest.java
│   │   │       ├── InvokeToolRequest.java
│   │   │       └── McpToolCallbackAdapter.java    # SAA McpToolCallback 适配
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/                      # Flyway（计划中）
│   └── test/
│       └── java/com/metaplatform/agent/           # JUnit 5 + Mockito（待补）
├── docs/
│   └── SPEC-TECH-AGENT-Agent框架API规范_v1.0-20260716.md
├── compile.log
├── stdout.log / stderr.log
├── pom.xml                                         # Spring Boot 3.5 + SAA 1.1.2.2
└── README.md                                       # 本文件
```

## 通用约定

- **路径前缀**：`/api/v1/agent/*`（多子域：`/agents` `/conversations` `/tasks` `/tools` `/memory` `/plans` `/evaluation` `/collaboration` `/card` `/checkpoint` `/learning` `/steps` `/employees`）
- **统一响应**：`ApiResponse<T> = { code, message, data, traceId }`（`code=0` 成功）
- **租户隔离**：`X-Tenant-Id` 必填；或从 `Authorization: Bearer <jwt>` 解析 `tenantId` claim；缺省 `tenant-default`
- **trace_id**：`X-Trace-Id` 透传（`TraceFilter` 注入 ThreadLocal `TenantContext`），否则服务端生成 UUID v4
- **错误码**：见 `common/ErrorCode.java`，统一由 `GlobalExceptionHandler` 输出 `ApiResponse` 错误信封
- **SSE 流式执行**：`POST /agents/{id}/execute/stream` 返回 `text/event-stream`，异常在握手前校验避免流中途抛错

## 已交付 API 清单

### Agent 定义（`/api/v1/agent/agents`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/agents` | 创建 Agent |
| GET | `/agents` | 列表（分页 + status 过滤） |
| GET | `/agents/{id}` | 详情 |
| PUT | `/agents/{id}` | 更新 |
| POST | `/agents/{id}/clone` | 克隆 |
| DELETE | `/agents/{id}` | 删除（ACTIVE 不可删） |
| GET | `/agents/{id}/versions` | 版本列表 |
| GET | `/agents/{id}/logs` | 操作日志 |
| POST | `/agents/{id}/execute` | 同步执行 |
| POST | `/agents/{id}/execute/stream` | SSE 流式执行 |

### Agent 名片（`/api/v1/agent/card`）— A2A 发现

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/card/{agentId}` | 暴露 Agent Card（协议无关 JSON） |
| GET | `/card/list` | 列出可发现 Agent |

### 协作（`/api/v1/agent/collaboration`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/collaboration` | 启动 A2A 协作任务 |
| GET | `/collaboration/{id}` | 协作进度 |
| GET | `/collaboration/{id}/report` | 协作报告 |

### 对话 / 任务 / 步骤 / 工具 / 记忆 / 计划 / 评估 / Checkpoint / 员工 / 学习

每域 4-8 个端点，统一 CRUD + 业务操作模式，详见对应 Controller。

## 数据模型

14 张核心表（`entity/` 下），所有外键 `ON DELETE RESTRICT`，所有审计字段（`tenant_id` / `deleted` / `created_at` / `updated_at` / `created_by` / `updated_by`），租户隔离。

## 快速开始

### 本地运行

```bash
# 启动 Nacos 3.0+（docker compose up -d nacos）
docker compose up -d nacos

# 启动 TECH-AGENT（端口 8401）
mvn spring-boot:run -Dspring-boot.run.profiles=dev
# -> http://localhost:8401/actuator/health
```

### 数据库配置

```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/metaplatform_agent
    username: meta
    password: meta
  jpa:
    hibernate:
      ddl-auto: update  # 首次启动用 update；生产用 validate + Flyway
```

### 启动 Nacos 3.0+

参见 [Nacos 3.0 POC 验证清单](../../docs/NACOS-3.0-POC-CHECKLIST.md)。

### 示例调用

```bash
# 1. 创建 Agent
curl -X POST http://localhost:8401/api/v1/agent/agents \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001" \
  -H "X-Trace-Id: trace-001" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "采购助手",
    "code": "purchase-assistant",
    "description": "协助处理采购审批流程",
    "modelId": "doubao-pro-32k",
    "systemPrompt": "你是一个专业的采购助手。",
    "tools": ["tool-001"],
    "ragScopes": ["scope-001"],
    "temperature": 0.3,
    "maxTokens": 2048,
    "status": "DRAFT"
  }'

# 2. 同步执行
curl -X POST http://localhost:8401/api/v1/agent/agents/{agentId}/execute \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{"input": "采购 10 台笔记本电脑"}'

# 3. SSE 流式执行
curl -N -X POST http://localhost:8401/api/v1/agent/agents/{agentId}/execute/stream \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{"input": "采购 10 台笔记本电脑"}'
```

## 架构说明

### 执行引擎抽象

`ExecutionEngine` 是抽象接口，当前提供 `SaAgentExecutionEngine`（基于 SAA Agent Framework）：
- 同步执行：`POST /agents/{id}/execute`
- SSE 流式执行：`POST /agents/{id}/execute/stream`（虚拟线程 + SseEmitter）
- 工具调用：通过 SAA `McpToolCallback` 走 `McpToolCallbackAdapter`
- 知识检索：通过 `clients/RAGClient` 走 `TECH-RAG`
- LLM 调用：通过 `clients/LLMGWClient` 走 `TECH-LLMGW`（不直连 DashScope）

### 租户隔离

- 所有 Repository 方法强制传入 `tenant_id`
- `code` 在租户内唯一，跨租户可重复
- 列表查询严格按 `tenant_id` 过滤

### 错误流

所有业务异常继承 `AgentException`，由 `GlobalExceptionHandler`（`@RestControllerAdvice`）统一包装为 `ApiResponse`，并设置对应 HTTP 状态码。SSE 端点特殊处理：异常在流建立前抛出，避免 `emitter.completeWithError` 导致的客户端断流困惑。

### 链路追踪

- `TraceFilter` 拦截所有请求，从 `X-Trace-Id` 头读 traceId（缺省生成 UUID v4）
- 注入 `TenantContext`（ThreadLocal），下游组件（`SaAgentExecutionEngine` / `clients/*`）透传
- SAA Graph Observation 自动埋点 `StateGraph` / `ReAct` 各节点

## 迁移记录

| 日期 | 事件 | commit |
|---|---|---|
| 2026-07-16 | 初版（Python + FastAPI + LangChain） | 早期 |
| 2026-07-22 | v1.3 重构期 R0：仓库精简，目录保留 | `5f25406f` |
| 2026-07-22 | R1：Java 25 + SAA 1.1.2.2 重写骨架落地 | `75fc43be` |
| 2026-07-24 | R1：补齐 14 域 Controller / 14 Repository / 14 Entity | 后续 R3 |
| 待 | R3：补 Flyway 迁移 + JUnit 5 完整覆盖 | — |

## 相关文档

- [项目总览](../../README.md)
- [Agent 框架 API 规范](./docs/SPEC-TECH-AGENT-Agent框架API规范_v1.0-20260716.md)
- [Nacos 3.0 POC 验证清单](../../docs/NACOS-3.0-POC-CHECKLIST.md)
- [架构设计](../../docs/prd/_top/PLAN-Mate_Platform-后端服务修正与完善_v1.0-20260722.md)
