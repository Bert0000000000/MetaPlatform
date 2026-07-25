# PRD - APP-COPILOT 超级AI对话（子文件）

> **版本**: v2.1 | **日期**: 2026-07-22 | **关联主 PRD**: [`PRD-APP-COPILOT_v2.2-20260722.md`](./PRD-APP-COPILOT_v2.2-20260722.md) | **状态**: 正式版候选
>
> 本文件是 APP-COPILOT 的**子文件**，专门描述 SuperAI 顶层对话窗口的详细功能设计（FR-AI-001/002/003/004/005/006）。
>
> 其他子文件：[调度与总结](./PRD-APP-COPILOT-调度与总结_v1.0-20260722.md)

---

## 1. 顶层对话窗口

### 1.1 窗口形态

| 维度 | 描述 |
|------|------|
| 入口 | 顶部导航 `nav-superai` → 跳转独立对话页 `/superai/dialogue` |
| 形态 | 全屏独立页面（不覆盖业务页面） |
| 框架 | React 19 + Ant Design X 2.0 |
| 主题 | Dark theme（设计稿唯一对应页 `superai-dialogue.html`） |

### 1.2 与页面内 Agent 的区别

| 维度 | SuperAI 顶层对话 | 页面内 Agent |
|------|----------------|------------|
| 入口 | 全平台唯一（顶部导航） | 各业务页面内嵌 |
| 上下文 | 全局会话 | 页面状态 |
| 调度能力 | 多 Agent 调度 | 单 Agent 响应 |
| 适用场景 | 跨域/全局问题 | 页面内操作辅助 |

---

## 2. 智能问答 RAG (FR-AI-001)

### 2.1 功能列表

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-001-01 | 对话界面 | P0 | 基于 Ant Design X 2.0 的对话式交互界面，支持多轮对话 |
| FR-AI-001-02 | 知识库检索 | P0 | COPILOT 通过 A2A 协议调用业务 RAG 知识库数字员工，由数字员工绑定 APP-KB 完成检索 |
| FR-AI-001-02a | A2A 调度业务 RAG 知识库数字员工 | P0 | **核心场景**：通过 Nacos A2A Registry 发现并调用数字员工，支持单域与跨域协同 |
| FR-AI-001-03 | 引用溯源 | P0 | 回答中标注知识来源（数字员工 → 知识库 → 文档 → 段落），支持点击查看原文 |
| FR-AI-001-04 | 多模态输入 | P1 | 支持文本、图片、文件上传作为输入 |
| FR-AI-001-05 | 对话历史 | P0 | 保存对话历史，支持查看、搜索、继续对话 |
| FR-AI-001-06 | 对话分享 | P2 | 支持将对话记录分享给其他用户 |
| FR-AI-001-07 | 反馈评价 | P1 | 用户可对回答进行点赞/踩，反馈通过 A2A 反馈链路回传数字员工 |

### 2.2 用户故事：业务用户查询知识库

**验收标准**：
- 支持中英文自然语言提问
- 回答准确率 > 85%（基于 RAG 评测基准）
- 每条回答附带 1-3 条知识来源引用
- 支持多轮追问，上下文保持连贯
- 首字响应时间 < 2s

---

## 3. 数据分析 NL2SQL (FR-AI-002)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-002-01 | 自然语言转SQL | P0 | 用户用自然语言描述分析需求，AI 自动生成 SQL 查询 |
| FR-AI-002-02 | SQL 预览与编辑 | P0 | 展示生成的 SQL，用户可手动编辑修改后执行 |
| FR-AI-002-03 | 结果可视化 | P0 | 查询结果自动推荐图表类型（表格/柱状图/折线图/饼图） |
| FR-AI-002-04 | 数据表语义映射 | P1 | 基于 Ontology 的数据表语义映射，提升 SQL 生成准确率 |
| FR-AI-002-05 | 多数据源支持 | P1 | 支持 PostgreSQL、StarRocks、ClickHouse 等（通过 TECH-DATA 统一访问） |
| FR-AI-002-06 | 分析报告生成 | P1 | 将分析结果自动总结为文字报告 |
| FR-AI-002-07 | SQL 安全审计 | P0 | 生成的 SQL 需通过安全审计（防注入、权限校验、只读限制） |

---

## 4. Action 执行 (FR-AI-003)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-003-01 | 意图识别 | P0 | 识别用户指令中需要执行的操作意图 |
| FR-AI-003-02 | Action 匹配 | P0 | 根据 Ontology 中定义的 Action（APP-ONTSTUDIO）自动匹配可执行操作 |
| FR-AI-003-03 | 参数填充 | P0 | AI 自动从对话中提取参数，缺失参数时交互式补充 |
| FR-AI-003-04 | 执行确认 | P0 | 执行前向用户确认操作内容，展示参数和预期结果 |
| FR-AI-003-05 | 执行结果反馈 | P0 | 展示 Action 执行结果，支持重试和回滚（如可回滚） |
| FR-AI-003-06 | 批量操作 | P1 | 支持一个指令触发多个关联 Action 的批量执行 |
| FR-AI-003-07 | 操作审计 | P0 | 所有 Action 执行记录审计日志（TECH-OBS） |

---

## 5. Ontology 探索 (FR-AI-004)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-004-01 | 语义查询 | P0 | 用自然语言查询 Ontology 中定义的概念、实体、关系 |
| FR-AI-004-02 | 知识图谱导航 | P1 | 以可视化方式展示查询结果的关联关系（AntV X6） |
| FR-AI-004-03 | 概念溯源 | P1 | 展示概念的来源、属性、关联实体、引用此概念的流程 |
| FR-AI-004-04 | 关系推理 | P2 | 基于推理引擎（HermiT/ELK）进行关系推理 |
| FR-AI-004-05 | Ontology 搜索 | P1 | 全文搜索本体库中的概念和实体 |

---

## 6. 代码生成 (FR-AI-005)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-005-01 | 代码片段生成 | P0 | 根据自然语言描述生成代码片段（Java/TypeScript/SQL） |
| FR-AI-005-02 | API 调用示例 | P1 | 根据选定 API 生成调用示例代码 |
| FR-AI-005-03 | 流程模板生成 | P1 | 根据描述生成 BPMN 流程模板或 Agent 编排模板 |
| FR-AI-005-04 | 代码解释 | P1 | 对用户提供的代码进行解释说明 |
| FR-AI-005-05 | 代码审查 | P2 | 对代码进行审查，提出改进建议 |

> **v2.0 变更**：移除 Python 语言支持（v1.2 决策：Java 25 唯一后端）。

---

## 7. 任务编排 (FR-AI-006)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-006-01 | 任务分解 | P0 | AI 将复杂需求自动分解为多个子任务（Spring AI Alibaba Graph Core） |
| FR-AI-006-02 | 执行计划生成 | P0 | 生成任务执行计划，展示任务依赖关系和执行顺序 |
| FR-AI-006-03 | 任务执行监控 | P0 | 实时展示各子任务的执行状态和进度 |
| FR-AI-006-04 | 结果聚合 | P0 | 将各子任务结果聚合为最终答案 |
| FR-AI-006-05 | 异常处理 | P1 | 子任务失败时自动重试或请求用户决策 |
| FR-AI-006-06 | 任务模板 | P2 | 将常用任务编排保存为模板，支持复用 |
| FR-AI-006-07 | A2A 调用业务 RAG 数字员工 | P0 | **核心场景**（v2.0 强化）：通过 SAA Graph Core 调度多个业务 RAG 知识库数字员工协同完成任务 |

> **v2.0 变更**：底层从 LangGraph 切换到 Spring AI Alibaba Graph Core。

---

## 8. API 接口（对话相关）

### 8.1 对话接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/copilot/chat/sessions` | 创建对话会话 |
| GET | `/api/v1/copilot/chat/sessions` | 获取会话列表 |
| GET | `/api/v1/copilot/chat/sessions/{sessionId}` | 获取会话详情 |
| DELETE | `/api/v1/copilot/chat/sessions/{sessionId}` | 删除会话 |
| POST | `/api/v1/copilot/chat/sessions/{sessionId}/messages` | 发送消息 |
| GET | `/api/v1/copilot/chat/sessions/{sessionId}/messages` | 获取消息历史 |
| POST | `/api/v1/copilot/chat/sessions/{sessionId}/messages/{messageId}/feedback` | 消息反馈 |
| POST | `/api/v1/copilot/chat/stream` | 流式对话（SSE） |

### 8.2 数据分析接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/copilot/analysis/query` | 自然语言转SQL并执行 |
| POST | `/api/v1/copilot/analysis/sql/generate` | 仅生成SQL（不执行） |
| POST | `/api/v1/copilot/analysis/sql/execute` | 执行SQL（需用户确认） |
| GET | `/api/v1/copilot/analysis/history` | 获取分析历史 |

### 8.3 Action 执行接口

| 方法 | 路径 | 描述 |
|------|--------|------|
| POST | `/api/v1/copilot/actions/parse` | 解析用户意图，匹配 Action |
| POST | `/api/v1/copilot/actions/execute` | 执行 Action |
| GET | `/api/v1/copilot/actions/history` | 获取 Action 执行历史 |

### 8.4 Ontology 探索接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/copilot/ontology/query` | 自然语言查询 Ontology |
| GET | `/api/v1/copilot/ontology/search` | 全文搜索本体 |
| GET | `/api/v1/copilot/ontology/concepts/{conceptId}/relations` | 获取概念关联关系 |

### 8.5 代码生成接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/copilot/code/generate` | 生成代码 |
| POST | `/api/v1/copilot/code/explain` | 解释代码 |
| POST | `/api/v1/copilot/code/review` | 审查代码 |

### 8.6 任务编排接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/copilot/tasks/decompose` | 任务分解 |
| POST | `/api/v1/copilot/tasks/plan` | 生成执行计划 |
| POST | `/api/v1/copilot/tasks/execute` | 执行任务编排 |
| GET | `/api/v1/copilot/tasks/executions` | 获取任务执行列表 |

---

## 9. 数据模型概要

```
ChatSession（对话会话）
├── id: UUID (PK)
├── userId: String
├── title: String
├── mode: Enum [CHAT, ANALYSIS, ACTION, EXPLORATION, CODE, TASK]
├── context: JSON
├── status: Enum [ACTIVE, ARCHIVED, DELETED]
├── createdAt: Timestamp
└── lastMessageAt: Timestamp

ChatMessage（对话消息）
├── id: UUID (PK)
├── sessionId: String
├── role: Enum [USER, ASSISTANT, SYSTEM]
├── content: Text
├── contentType: Enum [TEXT, MARKDOWN, CODE, CHART, CARD]
├── attachments: JSON
├── citations: JSON
├── metadata: JSON
├── feedback: Enum [NONE, LIKE, DISLIKE]
└── createdAt: Timestamp

AnalysisRecord, ActionExecution, OntologyQuery, CodeGeneration, TaskExecution
（详见 v2.0 主版历史归档 §5，本子文件不重复）
```

---

## 10. 非功能需求（对话场景）

| 指标 | 要求 |
|------|------|
| 对话首字响应 | < 2s（流式输出） |
| RAG 检索 | P95 < 1s |
| NL2SQL 生成 | P95 < 3s |
| Action 执行 | P95 < 10s |
| 任务编排分解 | P95 < 5s |
| 并发对话 | 支持 500 并发用户 |
| 可用性 | 99.9% |
| RAG 回答准确率 | > 85% |
| NL2SQL 准确率 | > 80% |
| 意图识别准确率 | > 90% |
| 引用溯源覆盖率 | 100% |
| 幻觉率 | < 5%（RAG 场景） |

---

## 附录 A：设计稿

> 数据来源：`pages/superai-dialogue.html`（**唯一对应页**）

| 维度 | 取值 |
|------|------|
| 设计库 | MetaPlatform3.0（id: `_-ZRH2U5YKIYA4`） |
| 主题 | Dark theme |
| 颜色 token | `--background:#0a0a0a`、`--card:#111111`、`--border:#262626`、`--primary:#fafafa`、`--success:#62d178`、`--destructive:#ff6166` |
| 字体 | Geist |
| 组件前缀 | `.v-card`、`.v-btn`、`.v-input`、`.v-table`、`.v-tab` |

---

**PRD 版本**: v2.1（子文件）
**PRD 日期**: 2026-07-22
**关联主 PRD**: [`PRD-APP-COPILOT_v2.2-20260722.md`](./PRD-APP-COPILOT_v2.2-20260722.md)