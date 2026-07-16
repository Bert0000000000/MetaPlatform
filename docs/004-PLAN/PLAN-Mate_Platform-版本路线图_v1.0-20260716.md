# Mate Platform 版本路线图与任务拆解

> 本文档基于项目关键路径分析，规划平台版本推进计划，按模块拆解工作任务，确保执行推进不偏差。
>
> 版本：v1.0
>
> 日期：2026-07-16
>
> 状态跟踪规则：每个 Task 标记 `[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[!]` 阻塞

---

## 一、版本总览

| 版本 | 阶段 | 时间窗口 | 核心目标 | 里程碑 |
|---|---|---|---|---|
| v0.1-spike | Spike 验证 | M1（第1月） | 验证关键路径最底层链路端到端可行性 | IAM→ONT→RULE 联调跑通 |
| v0.5-mvp | 阶段一 | M2-M4（第2-4月） | 核心引擎层就绪，规则引擎+工作流可用 | 规则引擎+工作流可用 |
| v0.8-beta | 阶段二 | M5-M7（第5-7月） | AI 管道汇入，Agent 运行时可用，数字员工 MVP | Agent 运行时+数字员工 MVP |
| v1.0-ga | 阶段三 | M8-M10（第8-10月） | 全功能交付，调度模式上线 | 数字员工调度+全功能 |

---

## 二、Spike 验证阶段（M1）

> **目标**：验证 TECH-IAM → TECH-ONT → TECH-RULE 这条最底层链路的端到端可行性。
>
> **并行启动**：AI 管道（LLMGW）、基础设施（GW/MSG/OBS）、数据管道（DATA v0.1）

### S-01. TECH-IAM（认证地基）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| S-IAM-01 | 项目脚手架搭建（Spring Boot 3.4 + Java 21） | 无 | `[ ]` | 项目可编译运行，健康检查通过 |
| S-IAM-02 | PostgreSQL 17 + Redis 7.4 环境搭建 | S-IAM-01 | `[ ]` | 数据库连接池正常，Redis 可读写 |
| S-IAM-03 | 用户表结构设计与建表（M1 核心字段） | S-IAM-02 | `[ ]` | DDL 执行成功，CRUD 测试通过 |
| S-IAM-04 | 用户注册/登录/JWT Token 签发与验证 | S-IAM-03 | `[ ]` | 登录返回 JWT，受保护接口鉴权通过 |
| S-IAM-05 | Kafka Outbox 基础版（消息表 + Relay 投递） | S-IAM-02 | `[ ]` | 消息写入 Outbox 后成功投递到 Kafka |
| S-IAM-06 | 部门表 + 角色表基础结构（M2 最小集） | S-IAM-03 | `[ ]` | 部门树 CRUD + 角色 CRUD 通过 |

### S-02. TECH-ONT（本体引擎核心）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| S-ONT-01 | 项目脚手架搭建（Spring Boot 3.4 + Java 21） | 无 | `[ ]` | 项目可编译运行 |
| S-ONT-02 | PostgreSQL 表结构设计（concept / entity / attribute） | S-ONT-01 | `[ ]` | DDL 执行成功 |
| S-ONT-03 | 概念管理 CRUD API（`/api/v1/ont/concepts`） | S-ONT-02 | `[ ]` | 创建/查询/更新/删除概念，响应符合统一规范 |
| S-ONT-04 | 实体管理 CRUD API（`/api/v1/ont/entities`） | S-ONT-03 | `[ ]` | 基于概念创建实体实例 |
| S-ONT-05 | 属性管理 CRUD API（`/api/v1/ont/attributes`） | S-ONT-03 | `[ ]` | 为概念添加属性，支持多数据类型 |
| S-ONT-06 | 与 TECH-IAM 鉴权集成 | S-IAM-04, S-ONT-03 | `[ ]` | 所有 API 需携带 JWT，权限校验通过 |
| S-ONT-07 | Spike 联调验证：创建 Customer 概念→添加属性→创建实体 | S-ONT-06, S-IAM-04 | `[ ]` | 端到端创建 Customer 概念含 tags 属性，创建实体实例 |

### S-03. TECH-RULE（规则引擎核心）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| S-RULE-01 | 项目脚手架搭建（Spring Boot 3.4 + Java 21） | 无 | `[ ]` | 项目可编译运行 |
| S-RULE-02 | 规则集 + 规则定义表结构设计 | S-RULE-01 | `[ ]` | DDL 执行成功 |
| S-RULE-03 | 规则集 CRUD API（`/api/v1/rule/rulesets`） | S-RULE-02 | `[ ]` | 创建/查询/更新/删除规则集 |
| S-RULE-04 | 规则定义 CRUD API（`/api/v1/rule/rules`） | S-RULE-03 | `[ ]` | 创建规则含条件+动作配置 |
| S-RULE-05 | Ontology 属性引用与校验（引用 TECH-ONT 概念属性） | S-RULE-04, S-ONT-05 | `[ ]` | 规则条件可引用 Customer.tags 等本体属性 |
| S-RULE-06 | 规则集同步执行 API（`/api/v1/rule/rulesets/{id}/execute`） | S-RULE-05 | `[ ]` | 执行规则集返回匹配结果 |
| S-RULE-07 | Spike 联调验证：定义"订单总额≥10万→VIP"规则并执行 | S-RULE-06, S-ONT-07 | `[ ]` | 创建规则→执行→返回匹配的客户列表 |

### S-04. TECH-LLMGW（AI 管道启动，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| S-LLMGW-01 | 项目脚手架搭建（Python 3.13 + FastAPI） | 无 | `[ ]` | 项目可运行，健康检查通过 |
| S-LLMGW-02 | 模型供应商管理 CRUD（OpenAI/Anthropic/火山方舟） | S-LLMGW-01 | `[ ]` | 供应商配置 CRUD，API Key AES-256 加密存储 |
| S-LLMGW-03 | 同步对话 API（`/api/v1/llmgw/chat/completions`） | S-LLMGW-02 | `[ ]` | 发送消息返回模型响应 |
| S-LLMGW-04 | 流式对话 SSE API（`/api/v1/llmgw/chat/stream`） | S-LLMGW-03 | `[ ]` | SSE 流式输出，首字延迟 < 2s |
| S-LLMGW-05 | Embedding API（`/api/v1/llmgw/embeddings`） | S-LLMGW-02 | `[ ]` | 输入文本返回向量 |
| S-LLMGW-06 | 与 TECH-IAM 鉴权集成 | S-IAM-04, S-LLMGW-03 | `[ ]` | 所有 API 需 JWT 鉴权 |

### S-05. TECH-GW + TECH-MSG + TECH-OBS（基础设施，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| S-GW-01 | Spring Cloud Gateway 脚手架 + 路由管理 CRUD | S-IAM-04 | `[ ]` | 网关启动，路由转发正常 |
| S-GW-02 | JWT 认证集成 + 白名单配置 | S-GW-01, S-IAM-04 | `[ ]` | 受保护路由需 JWT，白名单路由放行 |
| S-MSG-01 | Kafka 3.9 + RabbitMQ 4.x 环境搭建 | 无 | `[ ]` | 集群启动，Topic/Queue 创建正常 |
| S-MSG-02 | Outbox Relay 核心投递实现 | S-MSG-01 | `[ ]` | Outbox 消息轮询投递到 Kafka 成功 |
| S-MSG-03 | 消费者组管理 + 消费确认 | S-MSG-01 | `[ ]` | 消费者组 CRUD，消费偏移量正常推进 |
| S-OBS-01 | OpenTelemetry Collector + Prometheus + Grafana 部署 | 无 | `[ ]` | 指标采集可见，Grafana 仪表盘可访问 |
| S-OBS-02 | Java Agent 注入 + trace_id 传播验证 | S-OBS-01 | `[ ]` | 跨服务调用 trace_id 一致 |

### S-06. TECH-DATA（数据管道启动，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| S-DATA-01 | 项目脚手架搭建（Python 3.13 + FastAPI） | 无 | `[ ]` | 项目可运行 |
| S-DATA-02 | 数据源管理 CRUD（MySQL/PostgreSQL 连接） | S-DATA-01 | `[ ]` | 创建数据源→连接测试→返回 Schema |
| S-DATA-03 | Schema 发现 API（库/表/字段自动发现） | S-DATA-02 | `[ ]` | 连接数据源后返回表结构 |

---

## 三、阶段一：核心引擎层（M2-M4）

> **目标**：Ontology 关系/图查询就绪，规则引擎完整，工作流引擎可用，AI 管道 RAG 基础就绪。
>
> **关键路径**：ONT P2 → RULE P1 → WFE S1-S2
>
> **并行**：RAG P0-P1、AGENT S1 前期、ONTSTUDIO P1、APPHUB P1

### P1-01. TECH-ONT（Phase 2: 关系与图查询）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P1-ONT-01 | 关系类型管理 API（`/api/v1/ont/relations/types`） | S-ONT-07 | `[ ]` | 关系类型 CRUD，支持基数配置 |
| P1-ONT-02 | 关系实例管理 API（`/api/v1/ont/relations/instances`） | P1-ONT-01 | `[ ]` | 实体间关系创建/查询/删除 |
| P1-ONT-03 | Neo4j 5.x 图模型设计与初始化 | P1-ONT-01 | `[ ]` | Neo4j 节点/边模型与 PG 概念/实体对齐 |
| P1-ONT-04 | PG → Neo4j 同步（Outbox 模式） | P1-ONT-03, S-MSG-02 | `[ ]` | PG 写入实体关系后 Neo4j 同步更新 |
| P1-ONT-05 | 知识图谱查询 API（`/api/v1/ont/graph/query`） | P1-ONT-04 | `[ ]` | Cypher 查询返回图谱节点和边 |
| P1-ONT-06 | 图谱统计 API（`/api/v1/ont/graph/stats`） | P1-ONT-05 | `[ ]` | 返回节点数/边数/关系类型分布 |

### P1-02. TECH-RULE（Phase 1 完整版: MVP 核心规则引擎）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P1-RULE-01 | 规则优先级与启用/禁用管理 | S-RULE-07 | `[ ]` | 规则按优先级排序执行 |
| P1-RULE-02 | 规则集同步执行引擎（Drools 集成） | S-RULE-06 | `[ ]` | 规则集执行返回匹配结果列表 |
| P1-RULE-03 | 规则执行事件发布（Kafka Outbox） | P1-RULE-02, S-MSG-02 | `[ ]` | 规则命中后发布 RULE_EXECUTED 事件 |
| P1-RULE-04 | Ontology 关系引用支持（条件引用关系路径） | P1-RULE-02, P1-ONT-02 | `[ ]` | 规则条件可引用 Customer→Order 关系路径 |

### P1-03. TECH-WFE（Sprint 1-2: 流程定义与任务审批）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P1-WFE-01 | 项目脚手架搭建（Spring Boot 3.4 + Java 21） | 无 | `[ ]` | 项目可编译运行 |
| P1-WFE-02 | 流程定义部署/列表/详情/状态管理 API | P1-WFE-01 | `[ ]` | BPMN XML 部署成功，流程定义列表可查 |
| P1-WFE-03 | 流程实例发起/列表/详情/终止 API | P1-WFE-02 | `[ ]` | 发起流程实例，状态流转正常 |
| P1-WFE-04 | 待办/已办任务查询 API | P1-WFE-03 | `[ ]` | 用户待办列表正确返回 |
| P1-WFE-05 | 审批操作 API（同意/拒绝/转交/退回） | P1-WFE-04 | `[ ]` | 审批操作后任务流转到下一节点 |
| P1-WFE-06 | TECH-IAM 集成（审批人解析、权限校验） | P1-WFE-05, S-IAM-06 | `[ ]` | 审批人按角色/部门正确解析 |
| P1-WFE-07 | TECH-RULE 集成（网关条件路由） | P1-WFE-05, P1-RULE-02 | `[ ]` | 排他网关按规则引擎结果路由 |
| P1-WFE-08 | TECH-ONT 集成（流程变量绑定业务对象） | P1-WFE-03, P1-ONT-02 | `[ ]` | 流程变量可引用 Ontology 实体 |
| P1-WFE-09 | Kafka 任务事件发布（Outbox） | P1-WFE-05, S-MSG-02 | `[ ]` | 任务状态变更发布 TASK_* 事件 |

### P1-04. TECH-RAG（P0-P1: MVP 检索 + 混合检索，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P1-RAG-01 | 项目脚手架搭建（Python 3.13 + FastAPI） | 无 | `[ ]` | 项目可运行 |
| P1-RAG-02 | 知识库 CRUD API + 文档上传（MinIO 存储） | P1-RAG-01 | `[ ]` | 创建知识库→上传文档→存储到 MinIO |
| P1-RAG-03 | 文档分块 + Embedding 生成（调用 TECH-LLMGW） | P1-RAG-02, S-LLMGW-05 | `[ ]` | 文档分块后生成向量写入 Milvus |
| P1-RAG-04 | Milvus 2.5 向量检索 API | P1-RAG-03 | `[ ]` | 输入查询返回 Top-K 相关文档块 |
| P1-RAG-05 | 关键词检索（BM25）+ 混合检索（RRF 融合） | P1-RAG-04 | `[ ]` | 多路召回融合排序，检索质量优于纯向量 |
| P1-RAG-06 | 检索参数配置 + Rerank 模型集成 | P1-RAG-05 | `[ ]` | 可配置 Top-K/相似度阈值，Rerank 提升精度 |
| P1-RAG-07 | Kafka 检索事件发布（Outbox） | P1-RAG-04, S-MSG-02 | `[ ]` | 检索请求发布事件含 trace_id |

### P1-05. APP-ONTSTUDIO（Phase 1: 本体建模 UI，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P1-ONTUI-01 | 前端脚手架搭建（React 19 + Vite 6 + Ant Design 6.0） | 无 | `[ ]` | 项目可运行，路由配置完成 |
| P1-ONTUI-02 | 概念管理页面（列表/创建/编辑/删除） | P1-ONTUI-01, S-ONT-03 | `[ ]` | 概念 CRUD 页面功能完整 |
| P1-ONTUI-03 | 属性管理面板（概念下属性 CRUD） | P1-ONTUI-02, S-ONT-05 | `[ ]` | 为概念添加/编辑属性 |
| P1-ONTUI-04 | 实体管理页面（基于概念创建实体实例） | P1-ONTUI-02, S-ONT-04 | `[ ]` | 选择概念→创建实体→填写属性值 |
| P1-ONTUI-05 | 基础搜索（按名称/编码搜索概念和实体） | P1-ONTUI-02 | `[ ]` | 搜索结果正确高亮 |

### P1-06. APP-APPHUB（Phase 1: 基础表单设计器，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P1-APPHUB-01 | 前端脚手架搭建（React 19 + Vite 6 + Ant Design 6.0） | 无 | `[ ]` | 项目可运行 |
| P1-APPHUB-02 | 应用管理 CRUD（创建/列表/编辑/删除应用） | P1-APPHUB-01 | `[ ]` | 应用 CRUD 完整 |
| P1-APPHUB-03 | 模块管理（应用下创建表单类型模块） | P1-APPHUB-02 | `[ ]` | 创建模块并关联到应用 |
| P1-APPHUB-04 | 表单设计器基础组件（文本/数字/单选/多选/下拉/日期/附件） | P1-APPHUB-03 | `[ ]` | 拖拽组件到画布，配置属性，预览表单 |
| P1-APPHUB-05 | 表单属性配置（标签/占位符/必填校验） | P1-APPHUB-04 | `[ ]` | 组件属性面板配置完整 |
| P1-APPHUB-06 | 表单预览与基础发布（无校验） | P1-APPHUB-05 | `[ ]` | 预览表单→发布→生成访问链接 |

### P1-07. TECH-OBS（P0-P1: 基础设施 + 日志，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P1-OBS-01 | Loki 3.x + Vector 部署 | S-OBS-01 | `[ ]` | 日志采集可见 |
| P1-OBS-02 | 日志查询 API（`/api/v1/obs/logs/query`） | P1-OBS-01 | `[ ]` | 按服务/级别/时间范围查询日志 |
| P1-OBS-03 | 日志全文搜索 | P1-OBS-02 | `[ ]` | 关键词搜索日志内容 |
| P1-OBS-04 | 指标管理 API（自定义指标注册 + PromQL 查询） | S-OBS-01 | `[ ]` | 注册自定义指标并查询 |

### 阶段一里程碑验证

| 验证项 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|
| M1-VERIFY-01: Ontology 建模链路 | P1-ONT-06, P1-ONTUI-05 | `[ ]` | 前端创建概念→属性→实体→关系，Neo4j 图谱同步可见 |
| M1-VERIFY-02: 规则引擎链路 | P1-RULE-04 | `[ ]` | 定义引用关系路径的规则→执行→返回匹配结果 |
| M1-VERIFY-03: 工作流链路 | P1-WFE-09 | `[ ]` | 部署审批流程→发起实例→审批流转→任务事件发布 |
| M1-VERIFY-04: RAG 检索链路 | P1-RAG-06 | `[ ]` | 上传文档→分块向量化→混合检索→返回带高亮的结果 |

---

## 四、阶段二：AI 管道汇入与 Agent 运行时（M5-M7）

> **目标**：TECH-ACTION + TECH-AGENT 就绪，数字员工 MVP 上线，SuperAI 基础问答可用。
>
> **关键路径**：ACTION M1-M2 → AGENT S1-S2
>
> **高风险收敛点**：TECH-AGENT（3 条路径汇入：ACTION + RAG + LLMGW）
>
> **并行**：SuperAI P1-2、DW P1-2、APPHUB P2、MCP M1、EA S1

### P2-01. TECH-ACTION（M1-M2: Action 定义 + 服务编排）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P2-ACT-01 | 项目脚手架搭建（Spring Boot 3.4 + Java 21） | 无 | `[ ]` | 项目可编译运行 |
| P2-ACT-02 | Action 定义 CRUD API（`/api/v1/action/definitions`） | P2-ACT-01 | `[ ]` | Action 定义含输入/输出 Schema |
| P2-ACT-03 | Action 发布/禁用 + 版本管理 | P2-ACT-02 | `[ ]` | Action 发布后可被调用 |
| P2-ACT-04 | HTTP 执行器 + 同步执行 API | P2-ACT-02 | `[ ]` | 调用 Action 执行 HTTP 请求返回结果 |
| P2-ACT-05 | 服务编排 CRUD（串行/并行/条件节点） | P2-ACT-02 | `[ ]` | 创建编排含多节点，校验通过 |
| P2-ACT-06 | 编排异步执行 + 节点级状态追踪 | P2-ACT-05 | `[ ]` | 异步执行编排，实时返回各节点状态 |
| P2-ACT-07 | TECH-ONT 集成（Action 绑定业务对象） | P2-ACT-02, P1-ONT-02 | `[ ]` | Action 输入/输出绑定 Ontology 实体 |
| P2-ACT-08 | TECH-RULE 集成（条件分支由规则引擎求值） | P2-ACT-05, P1-RULE-02 | `[ ]` | 编排条件节点调用规则引擎决策 |
| P2-ACT-09 | 触发规则（事件驱动 + 定时 + 手动） | P2-ACT-04, S-MSG-02 | `[ ]` | Kafka 事件触发 Action 执行 |
| P2-ACT-10 | Outbox 模式 + 执行事件发布 + DLQ | P2-ACT-04, S-MSG-02 | `[ ]` | 执行事件通过 Outbox 发布，失败进 DLQ |

### P2-02. TECH-AGENT（S1-S2: Agent 运行时）— **极高风险收敛点**

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P2-AGT-01 | 项目脚手架搭建（Python 3.13 + FastAPI + LangGraph 0.2） | 无 | `[ ]` | 项目可运行 |
| P2-AGT-02 | Agent 定义 CRUD API（`/api/v1/agent/agents`） | P2-AGT-01 | `[ ]` | Agent 定义含模型/能力/知识范围配置 |
| P2-AGT-03 | 能力配置（Tools/Actions/RAG Scopes 绑定） | P2-AGT-02 | `[ ]` | Agent 可绑定 Action 和 RAG 知识库 |
| P2-AGT-04 | LangGraph 执行引擎集成（planner→agent→tool_executor→evaluator） | P2-AGT-02 | `[ ]` | Agent 执行多步推理，返回执行轨迹 |
| P2-AGT-05 | 同步执行 API（`/api/v1/agent/agents/{id}/execute`） | P2-AGT-04 | `[ ]` | 同步执行 Agent 任务返回结果 |
| P2-AGT-06 | SSE 流式执行 API（`/api/v1/agent/agents/{id}/stream`） | P2-AGT-05 | `[ ]` | SSE 流式输出执行步骤，首字 < 2s |
| P2-AGT-07 | Checkpoint 机制（PG + Redis 状态持久化） | P2-AGT-05 | `[ ]` | Agent 执行中断后可从 Checkpoint 恢复 |
| P2-AGT-08 | 短期记忆（会话上下文管理） | P2-AGT-05 | `[ ]` | 多轮对话保持上下文 |
| P2-AGT-09 | TECH-RAG 集成（Agent 检索知识库） | P2-AGT-04, P1-RAG-06 | `[ ]` | Agent 执行中调用 RAG 获取知识上下文 |
| P2-AGT-10 | TECH-ACTION 集成（Agent 调用 Action 执行工具） | P2-AGT-04, P2-ACT-04 | `[ ]` | Agent 通过 Function Calling 调用 Action |
| P2-AGT-11 | TECH-LLMGW 集成（所有 LLM 调用走网关） | P2-AGT-04, S-LLMGW-04 | `[ ]` | Agent LLM 调用通过 LLMGW 路由 |
| P2-AGT-12 | Kafka 执行事件发布（Outbox + trace_id） | P2-AGT-05, S-MSG-02 | `[ ]` | EXECUTION_* 事件发布含 trace_id |
| P2-AGT-13 | 集成验证：Agent 执行多步推理任务 | P2-AGT-12 | `[ ]` | Agent 分解任务→检索知识→调用 Action→返回结果 |

### P2-03. APP-SUPERAI（Phase 1-2: 智能问答 + 数据分析，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P2-SAI-01 | 前端脚手架搭建（React 19 + Ant Design X 2.0） | 无 | `[ ]` | 项目可运行 |
| P2-SAI-02 | 对话界面（流式输出 + 富文本 + 引用来源） | P2-SAI-01, S-LLMGW-04 | `[ ]` | 用户输入→SSE 流式回答→显示引用来源 |
| P2-SAI-03 | RAG 检索集成（调用 TECH-RAG） | P2-SAI-02, P1-RAG-06 | `[ ]` | 回答基于知识库内容，引用覆盖率 100% |
| P2-SAI-04 | 多轮对话管理（10 轮+上下文保持） | P2-SAI-02 | `[ ]` | 多轮对话上下文不丢失 |
| P2-SAI-05 | 对话历史管理（列表/删除/收藏） | P2-SAI-02 | `[ ]` | 历史对话列表可查看和恢复 |
| P2-SAI-06 | 模式切换（问答/分析/Action/探索/编排/调度 6 种模式） | P2-SAI-02 | `[ ]` | 模式切换后交互方式适配 |
| P2-SAI-07 | NL2SQL 数据分析（准确率 > 80%） | P2-SAI-06, P1-ONT-05 | `[ ]` | 自然语言生成 SQL→执行→返回结果 |
| P2-SAI-08 | SQL 安全审计 + 结果可视化（5 种图表） | P2-SAI-07 | `[ ]` | SQL 注入防护，结果自动选择图表类型 |
| P2-SAI-09 | Action 匹配与执行（准确率 > 90%） | P2-SAI-06, P2-ACT-04 | `[ ]` | 自然语言匹配 Action→参数填充→执行确认 |

### P2-04. APP-DW（Phase 1-2: 数字员工管理 + 知识提炼，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P2-DW-01 | 前端脚手架搭建（React 19 + Ant Design 6.0） | 无 | `[ ]` | 项目可运行 |
| P2-DW-02 | 数字员工列表页 + 创建向导（4 步） | P2-DW-01 | `[ ]` | 创建数字员工→配置能力→保存 |
| P2-DW-03 | 能力配置（Tool/RAG/模型绑定） | P2-DW-02, P2-AGT-03 | `[ ]` | 数字员工绑定 Agent + 知识库 + 模型 |
| P2-DW-04 | 员工详情页 + 启停管理 | P2-DW-02 | `[ ]` | 查看员工配置，启停状态切换 |
| P2-DW-05 | 对话交互（通过 SuperAI 复用） | P2-DW-03, P2-SAI-02 | `[ ]` | 在数字员工页面直接对话 |
| P2-DW-06 | 文档上传（PDF/Word/TXT） | P2-DW-02 | `[ ]` | 上传文档到知识库 |
| P2-DW-07 | AI 抽取（概念/实体/规则/Action 自动提取） | P2-DW-06, P1-RAG-04, P1-ONT-02 | `[ ]` | 文档内容抽取为 Ontology 实体写入 |
| P2-DW-08 | 审核确认（人工审核后写入 Ontology） | P2-DW-07 | `[ ]` | 抽取结果人工审核→确认写入 TECH-ONT |

### P2-05. APP-APPHUB（Phase 2: 流程设计器，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P2-APPHUB-01 | 流程设计器（FlowGram.AI fixed-layout） | P1-APPHUB-06, P1-WFE-02 | `[ ]` | 拖拽审批节点/条件分支/开始结束 |
| P2-APPHUB-02 | 审批配置（指定人员/角色/依次/会签） | P2-APPHUB-01, P1-WFE-05 | `[ ]` | 配置审批人规则 |
| P2-APPHUB-03 | 表单关联（流程节点绑定表单字段） | P2-APPHUB-01, P1-APPHUB-04 | `[ ]` | 流程节点可引用表单数据 |
| P2-APPHUB-04 | 流程测试（模拟审批） | P2-APPHUB-02 | `[ ]` | 模拟提交→审批流转→完成 |
| P2-APPHUB-05 | 发布校验（流程完整性检查） | P2-APPHUB-04 | `[ ]` | 校验通过后部署到 TECH-WFE |

### P2-06. TECH-MCP（M1: MCP Server + Tool 注册，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P2-MCP-01 | 项目脚手架搭建（Spring Boot 3.4 + spring-ai-mcp-server） | 无 | `[ ]` | 项目可运行 |
| P2-MCP-02 | MCP Server CRUD + 启停 + 能力清单 | P2-MCP-01 | `[ ]` | Server CRUD 完整 |
| P2-MCP-03 | Tool 注册中心 CRUD + Schema 校验 | P2-MCP-02 | `[ ]` | Tool 注册含输入/输出 Schema |
| P2-MCP-04 | Tool 同步执行（HTTP + BEAN 执行器） | P2-MCP-03 | `[ ]` | 调用 Tool 返回执行结果 |
| P2-MCP-05 | MCP JSON-RPC tools/call 端点 | P2-MCP-04 | `[ ]` | 外部 MCP Client 可调用 Tool |
| P2-MCP-06 | TECH-ONT 查询 Tool 暴露 | P2-MCP-04, P1-ONT-05 | `[ ]` | 本体查询作为 MCP Tool 可被调用 |
| P2-MCP-07 | TECH-RAG 检索 Tool 暴露 | P2-MCP-04, P1-RAG-04 | `[ ]` | 知识库检索作为 MCP Tool 可被调用 |
| P2-MCP-08 | TECH-ACTION 执行 Tool 暴露 | P2-MCP-04, P2-ACT-04 | `[ ]` | Action 执行作为 MCP Tool 可被调用 |

### P2-07. TECH-EA（Sprint 1: 业务架构基础，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P2-EA-01 | 项目脚手架搭建（Spring Boot 3.4 + Java 21） | 无 | `[ ]` | 项目可运行 |
| P2-EA-02 | 业务能力 CRUD + 能力层级树 | P2-EA-01 | `[ ]` | 能力地图 CRUD，层级树可展开 |
| P2-EA-03 | 组织角色 CRUD | P2-EA-01 | `[ ]` | 业务角色管理 |
| P2-EA-04 | 与 TECH-ONT 集成（能力→概念映射） | P2-EA-02, P1-ONT-03 | `[ ]` | 业务能力映射到 Ontology 概念 |

### 阶段二里程碑验证

| 验证项 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|
| M2-VERIFY-01: Agent 运行时 | P2-AGT-13 | `[ ]` | Agent 分解任务→检索知识→调用 Action→返回结果，全程 trace_id 可追踪 |
| M2-VERIFY-02: 数字员工 MVP | P2-DW-08 | `[ ]` | 创建数字员工→配置能力→上传文档→AI 抽取→审核写入 Ontology→对话交互 |
| M2-VERIFY-03: SuperAI 问答 | P2-SAI-09 | `[ ]` | 用户提问→RAG 检索→流式回答→引用来源→数据分析→Action 执行 |
| M2-VERIFY-04: 流程审批 | P2-APPHUB-05 | `[ ]` | 设计审批流程→发布→发起实例→审批流转→任务事件发布 |
| M2-VERIFY-05: MCP 协议 | P2-MCP-08 | `[ ]` | 外部 MCP Client 连接→发现 Tools→调用本体查询/知识检索/Action 执行 |

---

## 五、阶段三：全功能交付与调度模式（M8-M10）

> **目标**：A2A 协议就绪，数字员工调度上线，全部 APP 模块功能完整。
>
> **关键路径**：A2A S1-S2 → DW P3 → SuperAI P4-5
>
> **极高风险收敛点**：APP-SUPERAI Phase 5（4 条路径汇入：CP-9 + MCP + A2A + DW）
>
> **并行**：MCPHUB、ARCH、DASH、DATA v0.3-0.4

### P3-01. TECH-A2A（S1-S2: Agent 发现 + 任务委托）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-A2A-01 | 项目脚手架搭建（Python 3.13 + FastAPI） | 无 | `[ ]` | 项目可运行 |
| P3-A2A-02 | Agent Card 发布/查询/搜索 API | P3-A2A-01 | `[ ]` | Agent Card 发布后可被外部发现 |
| P3-A2A-03 | Agent Card 公开端点（`.well-known/agent.json`） | P3-A2A-02 | `[ ]` | 外部可访问 Agent Card |
| P3-A2A-04 | Agent 注册/发现/健康检查 | P3-A2A-02 | `[ ]` | Agent 注册后定时健康检查 |
| P3-A2A-05 | 任务委托（出站 JSON-RPC `tasks/send`） | P3-A2A-02 | `[ ]` | 向外部 Agent 委托任务 |
| P3-A2A-06 | 接收外部任务（A2A Server 入站） | P3-A2A-05 | `[ ]` | 外部 Agent 向平台委托任务 |
| P3-A2A-07 | 委托状态查询/结果获取/取消 | P3-A2A-05 | `[ ]` | 查询委托任务状态和结果 |
| P3-A2A-08 | SSE 进度流（`/api/v1/a2a/tasks/{id}/stream`） | P3-A2A-07 | `[ ]` | SSE 实时推送委托进度 |
| P3-A2A-09 | TECH-AGENT 集成（入站任务转 Agent 执行） | P3-A2A-06, P2-AGT-05 | `[ ]` | 外部委托任务转为内部 Agent 执行 |
| P3-A2A-10 | TECH-WFE 集成（入站任务转工作流执行） | P3-A2A-06, P1-WFE-03 | `[ ]` | 外部委托任务转为内部工作流执行 |
| P3-A2A-11 | Agent 认证（API Key/JWT） | P3-A2A-02, S-IAM-04 | `[ ]` | Agent 间通信认证通过 |
| P3-A2A-12 | Kafka AGENT_* 事件发布（Outbox + trace_id） | P3-A2A-05, S-MSG-02 | `[ ]` | 事件发布含 trace_id |

### P3-02. APP-DW（Phase 3: 任务管理与执行监控）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-DW-01 | 任务列表页 + 创建任务 | P2-DW-05 | `[ ]` | 创建任务分配给数字员工 |
| P3-DW-02 | 任务详情页 + 实时监控 | P3-DW-01, P2-AGT-06 | `[ ]` | SSE 实时展示任务执行进度 |
| P3-DW-03 | 执行轨迹（时间线 + 回放） | P3-DW-02 | `[ ]` | 可回放 Agent 执行轨迹 |
| P3-DW-04 | 日志查看（Trace 链路） | P3-DW-02, P1-OBS-02 | `[ ]` | 查看 trace_id 关联的全链路日志 |
| P3-DW-05 | 任务干预（暂停/恢复/取消/重试） | P3-DW-02 | `[ ]` | 暂停任务后可恢复，取消后可重试 |

### P3-03. APP-SUPERAI（Phase 4-5: 任务编排 + 数字员工调度）— **极高风险收敛点**

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-SAI-01 | 任务分解（复杂问题→子任务列表） | P2-SAI-09, P2-AGT-04 | `[ ]` | 输入复杂问题→自动拆分为可执行子任务 |
| P3-SAI-02 | 执行计划生成（子任务→执行顺序+并行策略） | P3-SAI-01 | `[ ]` | 生成含串行/并行节点的执行计划 |
| P3-SAI-03 | 并行执行 + 执行监控 | P3-SAI-02 | `[ ]` | 多子任务并行执行，实时展示进度 |
| P3-SAI-04 | 结果聚合 + 异常处理 | P3-SAI-03 | `[ ]` | 聚合子任务结果，异常自动重试 |
| P3-SAI-05 | 任务模板 + 报告生成 | P3-SAI-04 | `[ ]` | 保存常用任务为模板，生成执行报告 |
| P3-SAI-06 | 调度意图识别（专业领域→调度模式） | P3-SAI-04 | `[ ]` | 准确率 ≥ 85% 识别需要调度的意图 |
| P3-SAI-07 | 任务拆分 + 数字员工匹配 | P3-SAI-06, P2-DW-03 | `[ ]` | 子任务匹配到合适的数字员工 |
| P3-SAI-08 | 调度计划卡片（展示拆分+匹配结果） | P3-SAI-07 | `[ ]` | 可视化展示调度计划，支持编辑 |
| P3-SAI-09 | 确认调度 + 调度执行面板（SSE ≤ 2s） | P3-SAI-08, P2-AGT-06 | `[ ]` | 实时展示各数字员工执行状态 |
| P3-SAI-10 | 执行详情查看 + 异常处理 | P3-SAI-09 | `[ ]` | 点击查看单个员工执行详情，异常可处理 |
| P3-SAI-11 | 结果汇总（整理所有员工反馈→最终回答） | P3-SAI-09 | `[ ]` | 汇总多员工结果生成结构化最终回答 |
| P3-SAI-12 | 导出报告 + 调度模板 | P3-SAI-11 | `[ ]` | 导出调度报告，保存为模板 |
| P3-SAI-13 | 手动选择数字员工 | P3-SAI-07 | `[ ]` | 用户可手动指定数字员工 |
| P3-SAI-14 | A2A 跨系统协作（外部 Agent 发现+委派） | P3-SAI-09, P3-A2A-05 | `[ ]` | 搜索外部 Agent→委托任务→获取结果 |
| P3-SAI-15 | 调度模式集成验证 | P3-SAI-14 | `[ ]` | 端到端：专业问题→调度→多员工执行→汇总→最终回答 |

### P3-04. APP-MCPHUB（P0-P1: MCP 服务中心前端，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-MCPHUB-01 | 前端脚手架 + 工具注册中心页面 | P2-MCP-03 | `[ ]` | Tool 列表/注册/编辑/分类管理 |
| P3-MCPHUB-02 | MCP Server 管理页面 | P2-MCP-02 | `[ ]` | Server 列表/创建/配置 Tools/启停 |
| P3-MCPHUB-03 | MCP 调试器（连接→选 Tool→填参→执行→看响应） | P3-MCPHUB-01, P2-MCP-05 | `[ ]` | 在线调试 MCP Tool 调用 |
| P3-MCPHUB-04 | MCP Client 管理（添加连接/工具发现/同步） | P3-MCPHUB-02 | `[ ]` | 连接第三方 MCP Server 并发现 Tools |
| P3-MCPHUB-05 | 权限控制（规则列表/创建规则） | P3-MCPHUB-01 | `[ ]` | 配置用户-工具权限规则 |

### P3-05. APP-ARCH（Phase 1-2: 业务+应用架构，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-ARCH-01 | 前端脚手架 + 业务架构总览页 | P2-EA-02 | `[ ]` | 能力地图卡片展示 |
| P3-ARCH-02 | 能力地图管理（CRUD + 层级调整） | P3-ARCH-01 | `[ ]` | 能力节点 CRUD，拖拽调整层级 |
| P3-ARCH-03 | 能力可视化（AntV X6 树形布局） | P3-ARCH-02 | `[ ]` | 树形图展示能力层级 |
| P3-ARCH-04 | 应用系统注册 + 应用-能力关联 | P3-ARCH-01 | `[ ]` | 注册应用系统并关联到业务能力 |
| P3-ARCH-05 | 依赖关系管理（拓扑图可视化） | P3-ARCH-04 | `[ ]` | 应用间依赖拓扑图 |

### P3-06. APP-DASHBOARD（Phase 2-4: 审批+指标+通知，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-DASH-01 | 前端脚手架 + 基础工作台 | S-IAM-04, S-GW-02 | `[ ]` | 首页布局+待办卡片+快捷入口+通知铃铛 |
| P3-DASH-02 | 审批任务卡片 + 跳转 APP-APPHUB | P3-DASH-01, P2-APPHUB-05 | `[ ]` | 待办审批列表，点击跳转审批详情 |
| P3-DASH-03 | 数字员工状态卡片 | P3-DASH-01, P2-DW-04 | `[ ]` | 数字员工运行状态实时展示 |
| P3-DASH-04 | WebSocket 实时推送 | P3-DASH-01, S-MSG-01 | `[ ]` | 通知/待办实时推送到前端 |
| P3-DASH-05 | 指标看板（指标卡片 + 趋势图表 + 时间筛选） | P3-DASH-01 | `[ ]` | 指标卡片展示，图表交互 |
| P3-DASH-06 | 通知中心（已读未读管理 + 通知设置） | P3-DASH-04 | `[ ]` | 通知列表管理，已读未读切换 |
| P3-DASH-07 | 全局搜索 | P3-DASH-01 | `[ ]` | 搜索应用/知识/本体/任务 |

### P3-07. APP-ONTSTUDIO（Phase 2-5: 关系规则+数据中心+Action编排，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-ONTUI-01 | 关系类型管理 + 关系实例管理页面 | P1-ONTUI-05, P1-ONT-02 | `[ ]` | 关系 CRUD 页面 |
| P3-ONTUI-02 | 规则管理页面（CRUD + 条件-动作配置 + 测试运行） | P3-ONTUI-01, P1-RULE-04 | `[ ]` | 规则配置后可测试运行 |
| P3-ONTUI-03 | 版本管理（创建/发布/对比/回滚） | P3-ONTUI-01 | `[ ]` | Ontology 版本对比和回滚 |
| P3-ONTUI-04 | 知识图谱可视化（AntV X6） | P1-ONT-05, P1-ONTUI-01 | `[ ]` | 图谱浏览/节点展开/布局切换 |
| P3-ONTUI-05 | 数据源管理 + 数据映射页面 | S-DATA-03 | `[ ]` | 连接数据源→字段映射→同步策略 |
| P3-ONTUI-06 | Action 定义 + 服务编排可视化 | P2-ACT-05 | `[ ]` | 可视化编排 Action 节点 |
| P3-ONTUI-07 | 触发规则配置 + 执行监控 | P3-ONTUI-06, P2-ACT-09 | `[ ]` | 配置触发规则，查看执行记录 |

### P3-08. TECH-DATA（v0.3-v0.4: CDC + 数据湖，并行）

| Task ID | 任务 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|---|
| P3-DATA-01 | Flink 1.20 + Flink CDC 集成 | S-DATA-03 | `[ ]` | CDC 任务提交到 Flink 集群 |
| P3-DATA-02 | CDC 任务 CRUD + 启停（Savepoint） | P3-DATA-01 | `[ ]` | CDC 任务管理完整 |
| P3-DATA-03 | 实时指标监控（吞吐/延迟/Checkpoint） | P3-DATA-01 | `[ ]` | CDC 运行指标可观测 |
| P3-DATA-04 | Hudi 表 CRUD（COW/MOR） | S-DATA-02 | `[ ]` | Hudi 表创建/查询 |
| P3-DATA-05 | Hudi DeltaStreamer 入湖 | P3-DATA-04 | `[ ]` | 数据通过 DeltaStreamer 写入 Hudi |

### 阶段三里程碑验证

| 验证项 | 依赖 | 状态 | 验收标准 |
|---|---|---|---|
| M3-VERIFY-01: A2A 协议 | P3-A2A-12 | `[ ]` | 外部 Agent 发现平台→委托任务→平台执行→返回结果 |
| M3-VERIFY-02: 数字员工调度 | P3-SAI-15 | `[ ]` | 专业问题→调度模式→多数字员工执行→结果汇总→最终回答 |
| M3-VERIFY-03: 全功能集成 | All P3 | `[ ]` | Dashboard 展示所有模块状态 + 历史交付材料 + 全局搜索 |

---

## 六、版本发布检查清单

### v0.1-spike 发布检查

| 检查项 | 状态 | 验收标准 |
|---|---|---|
| IAM 认证链路 | `[ ]` | 用户注册→登录→JWT 鉴权→角色管理 |
| Ontology 建模链路 | `[ ]` | 创建概念→添加属性→创建实体→查询 |
| 规则引擎链路 | `[ ]` | 定义规则→引用本体属性→执行→返回匹配结果 |
| LLM 对话链路 | `[ ]` | 发送消息→流式回答→Embedding 生成 |
| 基础设施就绪 | `[ ]` | API 网关+消息队列+可观测性 部署完成 |
| trace_id 全链路 | `[ ]` | 跨服务 trace_id 一致 |

### v0.5-mvp 发布检查

| 检查项 | 状态 | 验收标准 |
|---|---|---|
| Ontology 关系+图谱 | `[ ]` | 关系建模→Neo4j 同步→图谱查询 |
| 规则引擎完整 | `[ ]` | 规则优先级+执行+事件发布+关系引用 |
| 工作流引擎 | `[ ]` | 流程部署→发起→审批→任务事件 |
| RAG 混合检索 | `[ ]` | 文档上传→分块向量化→混合检索→Rerank |
| 本体建模 UI | `[ ]` | 前端 CRUD 概念/属性/实体 |
| 表单设计器 | `[ ]` | 拖拽设计表单→预览→发布 |

### v0.8-beta 发布检查

| 检查项 | 状态 | 验收标准 |
|---|---|---|
| Action 引擎 | `[ ]` | Action 定义→服务编排→异步执行→触发规则 |
| Agent 运行时 | `[ ]` | LangGraph 执行→SSE 流式→Checkpoint→RAG+Action 集成 |
| 数字员工 MVP | `[ ]` | 创建员工→配置能力→文档抽取→对话交互 |
| SuperAI 问答 | `[ ]` | RAG 问答+数据分析+Action 执行 |
| 流程审批 | `[ ]` | 设计审批流→发布→发起→审批流转 |
| MCP 协议 | `[ ]` | Tool 注册→外部 Client 调用→本体/RAG/Action 暴露 |

### v1.0-ga 发布检查

| 检查项 | 状态 | 验收标准 |
|---|---|---|
| A2A 协议 | `[ ]` | Agent 发现→任务委托→SSE 进度→结果获取 |
| 数字员工调度 | `[ ]` | 专业问题→调度→多员工执行→汇总→最终回答 |
| MCP 服务中心 | `[ ]` | Server/Client 管理→调试器→权限控制 |
| 架构中心 | `[ ]` | 能力地图→应用注册→依赖拓扑 |
| Dashboard 全功能 | `[ ]` | 审批+指标+通知+全局搜索+历史交付材料 |
| 数据管道 | `[ ]` | CDC 实时同步→Hudi 入湖→数据映射 |
| 全链路可观测 | `[ ]` | trace_id 贯穿所有服务→日志/指标/链路可查 |

---

## 七、任务统计

| 阶段 | 模块数 | Task 数 | 关键路径 Task | 并行 Task | 里程碑验证 |
|---|---|---|---|---|---|
| Spike（M1） | 6 | 28 | 18 | 10 | - |
| 阶段一（M2-M4） | 7 | 40 | 22 | 18 | 4 |
| 阶段二（M5-M7） | 7 | 46 | 13 | 33 | 5 |
| 阶段三（M8-M10） | 8 | 51 | 15 | 36 | 3 |
| **合计** | - | **165** | **68** | **97** | **12** |

---

## 八、风险登记册

| 风险 ID | 风险描述 | 影响范围 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|---|---|
| R-01 | TECH-AGENT 收敛点延期（3 路径汇入） | 阶段二全部 | 高 | 高 | Spike 阶段提前验证 LangGraph 集成可行性 |
| R-02 | APP-SUPERAI Phase 5 收敛点延期（4 路径汇入） | 阶段三全功能 | 高 | 高 | 阶段二完成调度模式技术预研 |
| R-03 | Neo4j + PG 双写一致性 | TECH-ONT P2 | 中 | 中 | Outbox 模式 + 最终一致性 + 对账机制 |
| R-04 | Milvus 大规模向量检索性能 | TECH-RAG | 中 | 中 | Spike 阶段进行 100 万级向量基准测试 |
| R-05 | FlowGram.AI 与 Ant Design 6.0 兼容性 | APP-APPHUB | 中 | 中 | Spike 阶段验证组件兼容 |
| R-06 | Kafka 消息积压影响实时性 | 全平台 | 低 | 高 | DLQ + 告警 + 消费者水平扩容 |
