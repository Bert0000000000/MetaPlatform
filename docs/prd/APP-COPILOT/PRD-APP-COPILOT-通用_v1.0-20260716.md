# PRD - APP-SUPERAI 超级AI

> **版本**: v1.0 | **日期**: 2026-07-16 | **模块**: APP-SUPERAI | **状态**: 草案

---

## 1. 模块概述

### 1.1 模块定位

APP-SUPERAI 是 Mate Platform 的智能交互核心，为用户提供基于自然语言的统一交互入口。融合 RAG 知识检索、NL2SQL 数据分析、Action 执行、Ontology 语义探索、代码生成和任务编排能力，实现"用自然语言驱动企业运营"的愿景。

### 1.2 核心价值

- **自然语言交互**：用户通过对话式界面完成查询、分析、操作等复杂任务
- **知识增强**：基于企业知识库的 RAG 检索，确保回答准确、可溯源
- **数据驱动**：NL2SQL 将自然语言转为 SQL 查询，实现自助式数据分析
- **行动闭环**：通过 Action 执行和任务编排，从"对话"到"执行"闭环
- **语义理解**：基于 Ontology 本体引擎，理解企业业务语义

### 1.3 目标用户

| 角色 | 使用场景 |
|------|----------|
| 业务用户 | 通过自然语言查询知识库、获取业务洞察 |
| 数据分析师 | 用自然语言进行数据分析、生成图表 |
| 管理者 | 通过对话了解运营状况、执行管理操作 |
| 开发者 | AI 辅助代码生成、流程编排 |

---

## 2. 功能需求列表

### 2.1 智能问答 RAG (FR-AI-001)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-001-01 | 对话界面 | P0 | 基于 Ant Design X 2.0 的对话式交互界面，支持多轮对话 |
| FR-AI-001-02 | 知识库检索 | P0 | 基于用户问题检索企业知识库，结合上下文生成回答 |
| FR-AI-001-03 | 引用溯源 | P0 | 回答中标注知识来源，支持点击查看原文 |
| FR-AI-001-04 | 多模态输入 | P1 | 支持文本、图片、文件上传作为输入 |
| FR-AI-001-05 | 对话历史 | P0 | 保存对话历史，支持查看、搜索、继续对话 |
| FR-AI-001-06 | 对话分享 | P2 | 支持将对话记录分享给其他用户 |
| FR-AI-001-07 | 反馈评价 | P1 | 用户可对回答进行点赞/踩，反馈用于优化检索 |

### 2.2 数据分析 NL2SQL (FR-AI-002)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-002-01 | 自然语言转SQL | P0 | 用户用自然语言描述分析需求，AI 自动生成 SQL 查询 |
| FR-AI-002-02 | SQL 预览与编辑 | P0 | 展示生成的 SQL，用户可手动编辑修改后执行 |
| FR-AI-002-03 | 结果可视化 | P0 | 查询结果自动推荐图表类型（表格/柱状图/折线图/饼图） |
| FR-AI-002-04 | 数据表语义映射 | P1 | 基于 Ontology 的数据表语义映射，提升 SQL 生成准确率 |
| FR-AI-002-05 | 多数据源支持 | P1 | 支持 PostgreSQL、StarRocks、ClickHouse 等数据源 |
| FR-AI-002-06 | 分析报告生成 | P1 | 将分析结果自动总结为文字报告 |
| FR-AI-002-07 | SQL 安全审计 | P0 | 生成的 SQL 需通过安全审计（防注入、权限校验、只读限制） |

### 2.3 Action 执行 (FR-AI-003)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-003-01 | 意图识别 | P0 | 识别用户指令中需要执行的操作意图 |
| FR-AI-003-02 | Action 匹配 | P0 | 根据 Ontology 中定义的 Action 自动匹配可执行操作 |
| FR-AI-003-03 | 参数填充 | P0 | AI 自动从对话中提取参数，缺失参数时交互式补充 |
| FR-AI-003-04 | 执行确认 | P0 | 执行前向用户确认操作内容，展示参数和预期结果 |
| FR-AI-003-05 | 执行结果反馈 | P0 | 展示 Action 执行结果，支持重试和回滚（如可回滚） |
| FR-AI-003-06 | 批量操作 | P1 | 支持一个指令触发多个关联 Action 的批量执行 |
| FR-AI-003-07 | 操作审计 | P0 | 所有 Action 执行记录审计日志 |

### 2.4 Ontology 探索 (FR-AI-004)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-004-01 | 语义查询 | P0 | 用自然语言查询 Ontology 中定义的概念、实体、关系 |
| FR-AI-004-02 | 知识图谱导航 | P1 | 以可视化方式展示查询结果的关联关系（AntV X6） |
| FR-AI-004-03 | 概念溯源 | P1 | 展示概念的来源、属性、关联实体、引用此概念的流程 |
| FR-AI-004-04 | 关系推理 | P2 | 基于推理引擎（HermiT/ELK）进行关系推理，回答隐含关系问题 |
| FR-AI-004-05 | Ontology 搜索 | P1 | 全文搜索本体库中的概念和实体 |

### 2.5 代码生成 (FR-AI-005)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-005-01 | 代码片段生成 | P0 | 根据自然语言描述生成代码片段（Java/Python/TypeScript/SQL） |
| FR-AI-005-02 | API 调用示例 | P1 | 根据选定 API 生成调用示例代码 |
| FR-AI-005-03 | 流程模板生成 | P1 | 根据描述生成 BPMN 流程模板或 Agent 编排模板 |
| FR-AI-005-04 | 代码解释 | P1 | 对用户提供的代码进行解释说明 |
| FR-AI-005-05 | 代码审查 | P2 | 对代码进行审查，提出改进建议 |

### 2.6 任务编排 (FR-AI-006)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-006-01 | 任务分解 | P0 | AI 将复杂需求自动分解为多个子任务 |
| FR-AI-006-02 | 执行计划生成 | P0 | 生成任务执行计划，展示任务依赖关系和执行顺序 |
| FR-AI-006-03 | 任务执行监控 | P0 | 实时展示各子任务的执行状态和进度 |
| FR-AI-006-04 | 结果聚合 | P0 | 将各子任务结果聚合为最终答案 |
| FR-AI-006-05 | 异常处理 | P1 | 子任务失败时自动重试或请求用户决策 |
| FR-AI-006-06 | 任务模板 | P2 | 将常用任务编排保存为模板，支持复用 |

---

## 3. 用户故事

### US-01: 业务用户查询知识库
> 作为业务用户，我希望用自然语言提问，AI 能从企业知识库中检索相关信息并给出带引用来源的回答。

**验收标准**:
- 支持中英文自然语言提问
- 回答准确率 > 85%（基于 RAG 评测基准）
- 每条回答附带 1-3 条知识来源引用
- 支持多轮追问，上下文保持连贯
- 首字响应时间 < 2s

### US-02: 数据分析师自助分析
> 作为数据分析师，我希望输入"上个月各区域销售额排名前五"，AI 能自动生成 SQL、执行查询、展示图表。

**验收标准**:
- SQL 生成准确率 > 80%
- 支持自动选择合适图表类型
- SQL 可编辑修改后重新执行
- 执行结果可导出为 CSV/Excel
- 生成自然语言分析总结

### US-03: 管理者执行操作
> 作为管理者，我希望说"给所有待审批超过3天的工单发催办通知"，AI 能识别意图、匹配 Action、确认参数后执行。

**验收标准**:
- 意图识别准确率 > 90%
- 执行前必须用户确认
- 执行结果即时反馈
- 执行过程可追溯（审计日志）
- 支持操作回滚（如适用）

### US-04: 开发者生成代码
> 作为开发者，我希望描述需求后 AI 生成符合平台规范的 API 调用代码或流程模板。

**验收标准**:
- 支持生成 Java/Python/TypeScript/SQL 代码
- 代码符合平台命名规范和架构约束
- 生成的 API 调用代码可直接运行
- 支持代码解释和优化建议

### US-05: 复杂任务编排
> 作为用户，我希望给出一个复杂任务（如"分析上个季度的客户流失原因并生成报告"），AI 能自动分解、编排、执行并汇总结果。

**验收标准**:
- 任务分解为合理的子任务序列
- 展示任务依赖关系图
- 各子任务并行执行（无依赖时）
- 异常时自动重试或请求用户决策
- 最终生成结构化报告

---

## 4. API 接口定义

### 4.1 对话接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/superai/chat/sessions` | 创建对话会话 |
| GET | `/api/v1/superai/chat/sessions` | 获取会话列表 |
| GET | `/api/v1/superai/chat/sessions/{sessionId}` | 获取会话详情 |
| DELETE | `/api/v1/superai/chat/sessions/{sessionId}` | 删除会话 |
| POST | `/api/v1/superai/chat/sessions/{sessionId}/messages` | 发送消息 |
| GET | `/api/v1/superai/chat/sessions/{sessionId}/messages` | 获取消息历史 |
| POST | `/api/v1/superai/chat/sessions/{sessionId}/messages/{messageId}/feedback` | 消息反馈 |
| POST | `/api/v1/superai/chat/stream` | 流式对话（SSE） |

### 4.2 数据分析接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/superai/analysis/query` | 自然语言转SQL并执行 |
| POST | `/api/v1/superai/analysis/sql/generate` | 仅生成SQL（不执行） |
| POST | `/api/v1/superai/analysis/sql/execute` | 执行SQL（需用户确认） |
| GET | `/api/v1/superai/analysis/history` | 获取分析历史 |
| GET | `/api/v1/superai/analysis/history/{analysisId}` | 获取分析详情 |
| POST | `/api/v1/superai/analysis/history/{analysisId}/export` | 导出分析结果 |

### 4.3 Action 执行接口

| 方法 | 路径 | 描述 |
|------|--------|------|
| POST | `/api/v1/superai/actions/parse` | 解析用户意图，匹配 Action |
| POST | `/api/v1/superai/actions/execute` | 执行 Action |
| GET | `/api/v1/superai/actions/history` | 获取 Action 执行历史 |
| GET | `/api/v1/superai/actions/history/{executionId}` | 获取执行详情 |
| POST | `/api/v1/superai/actions/history/{executionId}/retry` | 重试执行 |
| POST | `/api/v1/superai/actions/history/{executionId}/rollback` | 回滚执行（如支持） |

### 4.4 Ontology 探索接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/superai/ontology/query` | 自然语言查询 Ontology |
| GET | `/api/v1/superai/ontology/search` | 全文搜索本体 |
| GET | `/api/v1/superai/ontology/concepts/{conceptId}/relations` | 获取概念关联关系 |
| POST | `/api/v1/superai/ontology/reasoning` | 关系推理 |
| GET | `/api/v1/superai/ontology/graph` | 获取知识图谱数据（可视化用） |

### 4.5 代码生成接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/superai/code/generate` | 生成代码 |
| POST | `/api/v1/superai/code/explain` | 解释代码 |
| POST | `/api/v1/superai/code/review` | 审查代码 |
| GET | `/api/v1/superai/code/templates` | 获取代码模板列表 |

### 4.6 任务编排接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/superai/tasks/decompose` | 任务分解 |
| POST | `/api/v1/superai/tasks/plan` | 生成执行计划 |
| POST | `/api/v1/superai/tasks/execute` | 执行任务编排 |
| GET | `/api/v1/superai/tasks/executions` | 获取任务执行列表 |
| GET | `/api/v1/superai/tasks/executions/{executionId}` | 获取执行详情 |
| GET | `/api/v1/superai/tasks/executions/{executionId}/status` | 获取执行状态 |
| POST | `/api/v1/superai/tasks/templates` | 保存任务模板 |
| GET | `/api/v1/superai/tasks/templates` | 获取任务模板列表 |

---

## 5. 数据模型

### 5.1 核心实体

```
ChatSession（对话会话）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── title: String  // 会话标题（AI自动生成或用户命名）
├── mode: Enum [CHAT, ANALYSIS, ACTION, EXPLORATION, CODE, TASK]
├── context: JSON  // 上下文信息
├── status: Enum [ACTIVE, ARCHIVED, DELETED]
├── messageCount: Integer
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── lastMessageAt: Timestamp

ChatMessage（对话消息）
├── id: UUID (PK)
├── sessionId: String (FK -> ChatSession.id)
├── role: Enum [USER, ASSISTANT, SYSTEM]
├── content: Text
├── contentType: Enum [TEXT, MARKDOWN, CODE, CHART, CARD]
├── attachments: JSON  // 附件列表
├── citations: JSON  // 引用来源 [{source, title, url, snippet}]
├── metadata: JSON  // 元数据（模型、token消耗等）
├── feedback: Enum [NONE, LIKE, DISLIKE]
├── feedbackComment: String
├── createdAt: Timestamp
└── parentMessageId: String  // 用于追问关联

AnalysisRecord（分析记录）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── sessionId: String (FK -> ChatSession.id)
├── naturalLanguageQuery: Text  // 用户原始自然语言查询
├── generatedSQL: Text  // AI生成的SQL
├── editedSQL: Text  // 用户编辑后的SQL
├── finalSQL: Text  // 最终执行的SQL
├── dataSourceId: String  // 数据源ID
├── resultData: JSON  // 查询结果
├── chartConfig: JSON  // 图表配置
├── summary: Text  // AI生成的分析总结
├── rowCount: Integer
├── executionTime: Long  // 执行耗时(ms)
├── status: Enum [DRAFT, EXECUTED, FAILED, EXPORTED]
├── createdAt: Timestamp
└── executedAt: Timestamp

ActionExecution（Action执行记录）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── sessionId: String (FK -> ChatSession.id)
├── actionId: String  // Action定义ID
├── actionName: String
├── intentText: Text  // 用户原始意图描述
├── parameters: JSON  // 执行参数
├── status: Enum [PENDING_CONFIRMATION, EXECUTING, SUCCESS, FAILED, ROLLED_BACK]
├── result: JSON  // 执行结果
├── errorMessage: Text
├── retryCount: Integer
├── traceId: String  // 追踪ID
├── createdAt: Timestamp
├── executedAt: Timestamp
└── completedAt: Timestamp

OntologyQuery（Ontology查询记录）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── sessionId: String (FK -> ChatSession.id)
├── queryText: Text  // 自然语言查询
├── queryType: Enum [CONCEPT_SEARCH, RELATION_QUERY, REASONING, FULLTEXT]
├── results: JSON  // 查询结果
├── graphData: JSON  // 图谱可视化数据
├── createdAt: Timestamp
└── responseTime: Long

CodeGeneration（代码生成记录）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── sessionId: String (FK -> ChatSession.id)
├── type: Enum [GENERATE, EXPLAIN, REVIEW]
├── language: Enum [JAVA, PYTHON, TYPESCRIPT, SQL]
├── prompt: Text  // 用户描述
├── generatedCode: Text
├── templateId: String  // 使用的模板ID
├── createdAt: Timestamp
└── responseTime: Long

TaskExecution（任务执行）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── sessionId: String (FK -> ChatSession.id)
├── description: Text  // 任务描述
├── plan: JSON  // 执行计划（任务分解树）
├── status: Enum [PLANNING, EXECUTING, COMPLETED, FAILED, CANCELLED]
├── subTasks: JSON  // 子任务列表 [{id, name, type, status, result, dependencies}]
├── finalResult: JSON  // 聚合结果
├── templateId: String  // 使用的模板ID
├── traceId: String
├── createdAt: Timestamp
├── startedAt: Timestamp
└── completedAt: Timestamp
```

---

## 6. 非功能需求

### 6.1 性能需求

| 指标 | 要求 |
|------|------|
| 对话首字响应 | < 2s（流式输出） |
| RAG 检索 | P95 < 1s |
| NL2SQL 生成 | P95 < 3s |
| Action 执行 | 依 Action 复杂度，P95 < 10s |
| 任务编排分解 | P95 < 5s |
| 并发对话 | 支持 500 并发用户 |

### 6.2 可用性需求

| 指标 | 要求 |
|------|------|
| 可用性 | 99.9% |
| LLM Gateway 降级 | 主模型不可用时自动切换备用模型 |
| 对话历史持久化 | 会话信息存储在 PostgreSQL，支持恢复 |
| 流式输出中断恢复 | 支持断线重连后继续输出 |

### 6.3 安全需求

- 所有 LLM 调用通过 TECH-LLMGW，不直接调模型 API
- NL2SQL 生成的 SQL 必须通过安全审计（防注入、只读限制）
- Action 执行需用户二次确认
- 对话内容不包含敏感信息脱敏处理
- Prompt 注入防护：输入内容过滤和转义
- 执行审计日志通过 TECH-OBS 记录

### 6.4 AI 质量需求

| 指标 | 要求 |
|------|------|
| RAG 回答准确率 | > 85% |
| NL2SQL 准确率 | > 80% |
| 意图识别准确率 | > 90% |
| 引用溯源覆盖率 | 100%（RAG 回答必须有来源） |
| 幻觉率 | < 5%（RAG 场景） |

### 6.5 可扩展性

- 支持动态注册新的 Action 和工具
- 任务编排引擎支持插件化扩展
- 代码生成支持自定义模板
- 支持多模型切换和模型版本管理

---

## 7. 上下游依赖关系

### 7.1 上游依赖

| 上游服务 | 依赖内容 | 依赖类型 |
|----------|----------|----------|
| TECH-LLMGW | LLM 推理调用、流式输出、模型路由 | 强依赖 |
| TECH-RAG | 知识库检索、文档嵌入、混合检索 | 强依赖 |
| TECH-ACTION | Action 定义查询、Action 执行 | 强依赖 |
| TECH-AGENT | Agent 框架、任务编排、多步推理 | 强依赖 |
| TECH-ONT | Ontology 概念查询、关系推理、语义映射 | 强依赖 |
| TECH-MCP | MCP 工具调用、外部资源访问 | 中等依赖 |

### 7.2 下游消费方

| 下游方 | 消费内容 |
|--------|----------|
| APP-APPHUB | AI 辅助开发能力（代码生成、流程模板） |
| APP-DW | 数字员工复用超级AI的对话和推理能力 |
| APP-DASHBOARD | 仪表盘展示 AI 使用统计指标 |

### 7.3 交互流程

```
用户输入消息 → APP-SUPERAI 前端
  ↓
意图识别 → 判断消息类型（问答/分析/操作/探索/代码/任务）
  ↓
路由到对应处理引擎:
  ├─ 问答 → TECH-RAG 检索 → TECH-LLMGW 生成回答
  ├─ 分析 → NL2SQL → 数据源执行 → 结果可视化
  ├─ 操作 → TECH-ACTION 匹配 → 用户确认 → 执行
  ├─ 探索 → TECH-ONT 查询 → 知识图谱可视化
  ├─ 代码 → TECH-LLMGW 生成代码
  └─ 任务 → TECH-AGENT 编排 → 多步执行
  ↓
结果聚合 → 流式返回前端
  ↓
TECH-OBS 记录审计日志
```

### 7.4 数据流转

```
用户消息 → 意图识别引擎
  ↓
RAG: TECH-RAG → Milvus 向量检索 + BM25 关键词检索 → 重排序
  ↓
LLM: TECH-LLMGW → 模型推理（流式） → 返回前端
  ↓
Action: TECH-ACTION → Action 执行引擎 → 结果回传
  ↓
Ontology: TECH-ONT → 概念查询/关系推理 → Neo4j 图查询
  ↓
所有执行记录 → PostgreSQL 持久化 → TECH-OBS 审计
```
