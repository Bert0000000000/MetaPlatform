# PRD - APP-DW 数字员工

> **版本**: v1.0 | **日期**: 2026-07-16 | **模块**: APP-DW | **状态**: 草案

---

## 1. 模块概述

### 1.1 模块定位

APP-DW 是 Mate Platform 的数字员工管理与应用模块，为企业提供 AI 驱动的自动化劳动力。数字员工能够理解企业制度与流程、执行业务任务、与人类协作、与其他 Agent 交互。每个数字员工具备角色定义、专业知识、操作技能和协作能力，可 7x24 小时不间断工作。

### 1.2 核心价值

- **知识提炼**：自动从企业制度、流程文档、访谈记录中提炼 Ontology 知识结构
- **自主执行**：基于角色定义自主接受并执行任务，支持复杂多步操作
- **人机协作**：数字员工与人类员工协同工作，能力互补
- **多员工协作**：多个数字员工之间通过 A2A 协议协作完成复杂任务
- **效果可度量**：对话质量评估、任务完成率、效率提升等量化指标

### 1.3 目标用户

| 角色 | 使用场景 |
|------|----------|
| 数字员工管理者 | 创建/配置/监控数字员工，评估工作效果 |
| 业务团队负责人 | 分配任务给数字员工，查看执行结果 |
| 知识工程师 | 管理数字员工的知识库、优化对话策略 |
| 普通用户 | 与数字员工交互、委托任务 |

---

## 2. 功能需求列表

### 2.1 数字员工创建配置 (FR-DW-001)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DW-001-01 | 员工创建 | P0 | 创建数字员工，定义名称、角色、头像、职责描述 |
| FR-DW-001-02 | 角色定义 | P0 | 配置数字员工的角色身份（如财务助手、HR助手、法务助手） |
| FR-DW-001-03 | 知识库绑定 | P0 | 为数字员工绑定专业知识库（RAG 知识源） |
| FR-DW-001-04 | 技能配置 | P0 | 配置数字员工可执行的技能（Action 列表、工具列表） |
| FR-DW-001-05 | 对话策略 | P1 | 配置对话风格、语气、回答策略（严谨/灵活、简洁/详细） |
| FR-DW-001-06 | 工作权限 | P0 | 配置数字员工的操作权限范围（可访问的数据、可执行的 Action） |
| FR-DW-001-07 | 模型配置 | P1 | 选择 LLM 模型、设置 temperature/max_tokens 等参数 |
| FR-DW-001-08 | 员工模板 | P1 | 预置常见角色模板（客服、分析师、审批助手等），快速创建 |
| FR-DW-001-09 | 版本管理 | P2 | 配置变更版本管理，支持回滚到历史版本 |
| FR-DW-001-10 | 员工克隆 | P2 | 基于已有数字员工克隆创建新员工 |

### 2.2 制度/流程/访谈信息提炼 (FR-DW-002)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DW-002-01 | 文档上传 | P0 | 上传企业制度文档、流程说明、访谈记录（PDF/Word/TXT/Markdown） |
| FR-DW-002-02 | 自动 Ontology 抽取 | P0 | AI 自动从文档中抽取概念、实体、属性、关系，生成 Ontology 草稿 |
| FR-DW-002-03 | 抽取结果审核 | P0 | 人工审核 AI 抽取的 Ontology，支持修改、删除、补充 |
| FR-DW-002-04 | 流程识别 | P0 | 从流程文档中识别业务流程步骤、触发条件、审批节点 |
| FR-DW-002-05 | 规则提取 | P1 | 从制度文档中提取业务规则（如报销标准、审批阈值） |
| FR-DW-002-06 | 知识结构化 | P1 | 将非结构化文档转为结构化知识（FAQ、决策树、知识卡片） |
| FR-DW-002-07 | 多文档关联 | P1 | 跨文档关联相同概念和实体，构建统一知识图谱 |
| FR-DW-002-08 | 增量更新 | P2 | 文档更新后自动检测变更，增量更新 Ontology |

### 2.3 任务执行监控 (FR-DW-003)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DW-003-01 | 任务分配 | P0 | 将任务分配给数字员工，设定优先级和截止时间 |
| FR-DW-003-02 | 执行状态监控 | P0 | 实时展示数字员工的任务执行状态（待执行/执行中/已完成/失败） |
| FR-DW-003-03 | 执行过程详情 | P0 | 查看任务执行的详细步骤、中间结果、决策链路 |
| FR-DW-003-04 | 任务干预 | P1 | 管理者可暂停/恢复/取消正在执行的任务 |
| FR-DW-003-05 | 异常告警 | P0 | 数字员工执行异常时自动告警通知管理者 |
| FR-DW-003-06 | 任务重试 | P1 | 失败任务支持自动重试（配置重试策略）或手动重试 |
| FR-DW-003-07 | 执行统计 | P1 | 统计数字员工任务完成率、平均执行时间、异常率 |
| FR-DW-003-08 | 实时日志 | P1 | 查看数字员工执行过程中的实时日志输出 |

### 2.4 多员工协作 (FR-DW-004)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DW-004-01 | 员工编排 | P0 | 定义多个数字员工的协作流程和任务分配关系 |
| FR-DW-004-02 | 任务委派 | P0 | 数字员工可将子任务委派给其他数字员工 |
| FR-DW-004-03 | A2A 通信 | P0 | 通过 A2A 协议实现数字员工间的发现、通信和协作 |
| FR-DW-004-04 | 协作监控 | P1 | 可视化展示多员工协作过程和任务流转 |
| FR-DW-004-05 | 冲突处理 | P1 | 多员工协作中的任务冲突检测和解决策略 |
| FR-DW-004-06 | 外部 Agent 对接 | P2 | 与外部 Agent（非本平台）通过 A2A 协议协作 |
| FR-DW-004-07 | 协作模板 | P2 | 保存常用多员工协作模式为模板 |

### 2.5 对话记录与效果评估 (FR-DW-005)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DW-005-01 | 对话记录 | P0 | 记录数字员工与用户的所有对话历史 |
| FR-DW-005-02 | 对话回放 | P0 | 支持回放指定对话，查看完整交互过程 |
| FR-DW-005-03 | 质量评估 | P0 | 对对话质量进行自动评分（准确性、完整性、响应速度） |
| FR-DW-005-04 | 人工抽检 | P1 | 管理者可对对话进行人工抽检和标注 |
| FR-DW-005-05 | 效果报表 | P1 | 生成数字员工工作效果报表（任务完成率、用户满意度、错误率） |
| FR-DW-005-06 | 对比分析 | P2 | 多个数字员工效果对比分析 |
| FR-DW-005-07 | 优化建议 | P2 | 基于评估结果自动生成知识库/策略优化建议 |

---

## 3. 用户故事

### US-01: 创建财务助手数字员工
> 作为数字员工管理者，我希望创建一个"财务助手"数字员工，配置其具备报销审批、费用查询、财务报表分析等能力。

**验收标准**:
- 可定义员工角色和职责
- 可绑定财务知识库
- 可配置报销审批、费用查询等 Action 技能
- 可设置操作权限（仅可查询财务数据，不可修改）
- 创建后即可通过对话界面使用

### US-02: 从制度文档提炼知识
> 作为知识工程师，我希望上传公司的报销管理制度文档，AI 能自动提取报销规则、审批流程、金额标准等知识结构。

**验收标准**:
- 支持 PDF/Word/TXT 格式上传
- 自动识别文档中的规则和流程
- 生成结构化知识供人工审核
- 审核通过后写入 Ontology
- 支持多文档交叉关联

### US-03: 监控数字员工执行任务
> 作为业务团队负责人，我希望给数字员工分配数据分析任务，并实时查看执行进度。

**验收标准**:
- 可指定数字员工并分配任务
- 实时展示任务执行状态和进度
- 可查看执行步骤和中间结果
- 异常时自动通知
- 完成后查看最终报告

### US-04: 多数字员工协作
> 作为管理者，我希望让"数据分析师"数字员工和"报告撰写"数字员工协作完成季度分析报告。

**验收标准**:
- 可定义多员工协作流程
- 数据分析完成后自动委派给报告撰写员工
- 通过 A2A 协议实现员工间通信
- 可视化展示协作过程
- 最终结果聚合展示

### US-05: 评估数字员工效果
> 作为数字员工管理者，我希望查看数字员工本月的工作效果报表，了解任务完成率和用户满意度。

**验收标准**:
- 自动生成月度/周度效果报表
- 展示任务完成率、平均执行时间、错误率
- 展示对话质量评分趋势
- 支持人工抽检和标注
- 提供优化建议

---

## 4. API 接口定义

### 4.1 数字员工管理接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/dw/employees` | 创建数字员工 |
| GET | `/api/v1/dw/employees` | 获取数字员工列表（支持筛选、分页） |
| GET | `/api/v1/dw/employees/{employeeId}` | 获取数字员工详情 |
| PUT | `/api/v1/dw/employees/{employeeId}` | 更新数字员工配置 |
| DELETE | `/api/v1/dw/employees/{employeeId}` | 删除数字员工 |
| POST | `/api/v1/dw/employees/{employeeId}/activate` | 激活数字员工 |
| POST | `/api/v1/dw/employees/{employeeId}/deactivate` | 停用数字员工 |
| POST | `/api/v1/dw/employees/{employeeId}/clone` | 克隆数字员工 |
| GET | `/api/v1/dw/employees/templates` | 获取员工模板列表 |
| GET | `/api/v1/dw/employees/{employeeId}/versions` | 获取配置版本历史 |
| PUT | `/api/v1/dw/employees/{employeeId}/versions/{versionId}/rollback` | 回滚到指定版本 |

### 4.2 知识提炼接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/dw/knowledge/upload` | 上传文档（制度/流程/访谈） |
| GET | `/api/v1/dw/knowledge/documents` | 获取文档列表 |
| GET | `/api/v1/dw/knowledge/documents/{documentId}` | 获取文档详情 |
| DELETE | `/api/v1/dw/knowledge/documents/{documentId}` | 删除文档 |
| POST | `/api/v1/dw/knowledge/documents/{documentId}/extract` | 触发 Ontology 抽取 |
| GET | `/api/v1/dw/knowledge/documents/{documentId}/extraction-result` | 获取抽取结果 |
| PUT | `/api/v1/dw/knowledge/documents/{documentId}/extraction-result` | 审核/修改抽取结果 |
| POST | `/api/v1/dw/knowledge/documents/{documentId}/extraction-result/approve` | 审核通过并写入 Ontology |
| POST | `/api/v1/dw/knowledge/batch-extract` | 批量文档抽取 |
| GET | `/api/v1/dw/knowledge/extraction-tasks` | 获取抽取任务列表及状态 |

### 4.3 任务执行接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/dw/tasks` | 创建并分配任务 |
| GET | `/api/v1/dw/tasks` | 获取任务列表（支持筛选） |
| GET | `/api/v1/dw/tasks/{taskId}` | 获取任务详情 |
| GET | `/api/v1/dw/tasks/{taskId}/status` | 获取任务执行状态 |
| GET | `/api/v1/dw/tasks/{taskId}/steps` | 获取任务执行步骤详情 |
| GET | `/api/v1/dw/tasks/{taskId}/logs` | 获取任务执行日志 |
| POST | `/api/v1/dw/tasks/{taskId}/pause` | 暂停任务 |
| POST | `/api/v1/dw/tasks/{taskId}/resume` | 恢复任务 |
| POST | `/api/v1/dw/tasks/{taskId}/cancel` | 取消任务 |
| POST | `/api/v1/dw/tasks/{taskId}/retry` | 重试任务 |
| GET | `/api/v1/dw/employees/{employeeId}/tasks` | 获取指定员工的任务列表 |
| GET | `/api/v1/dw/tasks/statistics` | 获取任务执行统计 |

### 4.4 多员工协作接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/dw/collaborations` | 创建多员工协作流程 |
| GET | `/api/v1/dw/collaborations` | 获取协作流程列表 |
| GET | `/api/v1/dw/collaborations/{collaborationId}` | 获取协作详情 |
| PUT | `/api/v1/dw/collaborations/{collaborationId}` | 更新协作配置 |
| DELETE | `/api/v1/dw/collaborations/{collaborationId}` | 删除协作流程 |
| POST | `/api/v1/dw/collaborations/{collaborationId}/execute` | 执行协作流程 |
| GET | `/api/v1/dw/collaborations/{collaborationId}/execution` | 获取协作执行状态 |
| GET | `/api/v1/dw/collaborations/{collaborationId}/execution/visualization` | 获取协作可视化数据 |
| GET | `/api/v1/dw/collaborations/templates` | 获取协作模板列表 |
| POST | `/api/v1/dw/agents/a2a/discover` | A2A 发现外部 Agent |
| POST | `/api/v1/dw/agents/a2a/delegate` | A2A 任务委派 |

### 4.5 对话与评估接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/dw/conversations` | 创建对话会话 |
| GET | `/api/v1/dw/conversations` | 获取对话列表 |
| GET | `/api/v1/dw/conversations/{conversationId}` | 获取对话详情（含消息记录） |
| GET | `/api/v1/dw/conversations/{conversationId}/replay` | 获取对话回放数据 |
| POST | `/api/v1/dw/conversations/{conversationId}/evaluation` | 提交对话质量评估 |
| GET | `/api/v1/dw/conversations/{conversationId}/evaluation` | 获取对话质量评分 |
| GET | `/api/v1/dw/employees/{employeeId}/conversations` | 获取指定员工的对话列表 |
| GET | `/api/v1/dw/evaluations/statistics` | 获取评估统计数据 |
| GET | `/api/v1/dw/evaluations/reports` | 获取效果报表 |
| POST | `/api/v1/dw/evaluations/review` | 提交人工抽检结果 |
| GET | `/api/v1/dw/evaluations/suggestions` | 获取优化建议 |

---

## 5. 数据模型

### 5.1 核心实体

```
DigitalEmployee（数字员工）
├── id: UUID (PK)
├── name: String
├── avatar: String  // 头像URL
├── role: String  // 角色身份
├── description: Text  // 职责描述
├── systemPrompt: Text  // 系统提示词
├── knowledgeBaseIds: JSON  // 绑定的知识库ID列表
├── skills: JSON  // 技能配置 [{actionId, params, enabled}]
├── tools: JSON  // 工具列表
├── dialogStrategy: JSON  // 对话策略 {style, tone, verbosity}
├── permissions: JSON  // 操作权限范围
├── modelConfig: JSON  // 模型配置 {model, temperature, maxTokens}
├── status: Enum [DRAFT, ACTIVE, INACTIVE, ARCHIVED]
├── version: String  // 配置版本号
├── parentId: String  // 克隆来源ID
├── templateId: String  // 模板ID
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── createdBy: String

KnowledgeDocument（知识文档）
├── id: UUID (PK)
├── employeeId: String (FK -> DigitalEmployee.id)
├── name: String
├── type: Enum [POLICY, PROCESS, INTERVIEW, REGULATION, OTHER]
├── format: Enum [PDF, WORD, TXT, MARKDOWN]
├── fileUrl: String  // 文件存储URL
├── fileSize: Long
├── content: Text  // 解析后的文本内容
├── extractionStatus: Enum [PENDING, EXTRACTING, EXTRACTED, REVIEWED, APPROVED]
├── extractionResult: JSON  // AI抽取的Ontology草稿
├── reviewResult: JSON  // 人工审核后的结果
├── ontologyRef: String  // 写入Ontology后的引用ID
├── uploadedAt: Timestamp
├── extractedAt: Timestamp
└── reviewedAt: Timestamp

Task（任务）
├── id: UUID (PK)
├── title: String
├── description: Text
├── employeeId: String (FK -> DigitalEmployee.id)
├── assignerId: String  // 分配者
├── type: Enum [ANALYSIS, EXECUTION, QUERY, NOTIFICATION, COMPOSITE]
├── priority: Enum [URGENT, HIGH, MEDIUM, LOW]
├── status: Enum [PENDING, ASSIGNED, EXECUTING, PAUSED, COMPLETED, FAILED, CANCELLED]
├── input: JSON  // 任务输入参数
├── output: JSON  // 任务输出结果
├── steps: JSON  // 执行步骤 [{id, name, status, input, output, startedAt, completedAt}]
├── errorMessage: Text
├── retryCount: Integer
├── maxRetry: Integer
├── parentTaskId: String  // 父任务（多员工协作时）
├── collaborationId: String  // 关联的协作流程ID
├── traceId: String
├── dueDate: Timestamp
├── createdAt: Timestamp
├── startedAt: Timestamp
└── completedAt: Timestamp

Collaboration（多员工协作）
├── id: UUID (PK)
├── name: String
├── description: Text
├── employees: JSON  // 参与的数字员工 [{employeeId, role, responsibilities}]
├── flow: JSON  // 协作流程定义（任务分配和流转）
├── delegationRules: JSON  // 委派规则
├── conflictResolution: JSON  // 冲突处理策略
├── status: Enum [DRAFT, ACTIVE, EXECUTING, COMPLETED, FAILED]
├── executionId: String  // 执行实例ID
├── templateId: String
├── createdAt: Timestamp
└── updatedAt: Timestamp

Conversation（对话记录）
├── id: UUID (PK)
├── employeeId: String (FK -> DigitalEmployee.id)
├── userId: String  // 交互用户
├── title: String
├── messages: JSON  // 消息列表 [{role, content, timestamp, metadata}]
├── messageCount: Integer
├── status: Enum [ACTIVE, CLOSED, ARCHIVED]
├── taskRef: String  // 关联的任务ID（如有）
├── createdAt: Timestamp
└── updatedAt: Timestamp

Evaluation（效果评估）
├── id: UUID (PK)
├── employeeId: String (FK -> DigitalEmployee.id)
├── conversationId: String (FK -> Conversation.id)
├── taskId: String  // 关联任务ID
├── evaluationType: Enum [AUTO, MANUAL]
├── scores: JSON  // 评分 {accuracy, completeness, responseTime, userSatisfaction}
├── overallScore: Float  // 综合评分
├── reviewer: String  // 人工审核者（如有）
├── reviewComment: Text
├── issues: JSON  // 发现的问题 [{type, description, severity}]
├── suggestions: JSON  // 优化建议
├── createdAt: Timestamp
└── reviewedAt: Timestamp

EmployeeStatistics（员工统计）
├── id: UUID (PK)
├── employeeId: String (FK -> DigitalEmployee.id)
├── period: String  // 统计周期 YYYY-MM
├── totalTasks: Integer
├── completedTasks: Integer
├── failedTasks: Integer
├── completionRate: Float
├── avgExecutionTime: Long  // 平均执行时间(ms)
├── totalConversations: Integer
├── avgQualityScore: Float
├── userSatisfaction: Float  // 用户满意度(0-1)
├── errorRate: Float
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

---

## 6. 非功能需求

### 6.1 性能需求

| 指标 | 要求 |
|------|------|
| 对话首字响应 | < 2s |
| 任务分配延迟 | < 1s |
| 文档抽取（单文档） | < 60s（100页以内） |
| 状态更新推送 | < 3s |
| 并发数字员工 | 支持 100 个同时在线 |
| 协作任务委派延迟 | < 2s |

### 6.2 可用性需求

| 指标 | 要求 |
|------|------|
| 可用性 | 99.9% |
| 数字员工故障恢复 | 自动重试 + 故障切换 |
| 任务持久化 | 任务状态持久化到 PostgreSQL，支持恢复 |
| A2A 通信容错 | 网络中断后自动重连 |

### 6.3 安全需求

- 数字员工操作权限通过 TECH-IAM 严格控制
- 所有 Action 执行需权限校验
- 对话内容敏感信息脱敏
- 文档上传需病毒扫描和大小限制
- A2A 外部 Agent 通信需身份验证和加密
- 操作审计日志通过 TECH-OBS 记录

### 6.4 AI 质量需求

| 指标 | 要求 |
|------|------|
| Ontology 抽取准确率 | > 75%（人工审核后 100%） |
| 任务执行成功率 | > 90% |
| 对话质量自动评分准确率 | > 80% |
| A2A 协作成功率 | > 95% |

### 6.5 可扩展性

- 支持自定义数字员工模板
- 知识抽取支持插件化文档解析器
- 协作流程支持可视化编排
- 支持 A2A 协议对接外部 Agent

---

## 7. 上下游依赖关系

### 7.1 上游依赖

| 上游服务 | 依赖内容 | 依赖类型 |
|----------|----------|----------|
| TECH-AGENT | Agent 框架、任务执行引擎、多步推理 | 强依赖 |
| TECH-RAG | 知识库检索、文档嵌入 | 强依赖 |
| TECH-ONT | Ontology 抽取写入、概念查询、知识图谱 | 强依赖 |
| TECH-LLMGW | LLM 推理、对话生成、文档理解 | 强依赖 |
| TECH-A2A | A2A 协议、Agent 发现、跨 Agent 通信 | 强依赖 |

### 7.2 下游消费方

| 下游方 | 消费内容 |
|--------|----------|
| APP-DASHBOARD | 仪表盘展示数字员工运行状态指标 |
| APP-SUPERAI | 复用数字员工的对话能力 |
| 外部系统 | 通过 A2A 协议与平台数字员工协作 |

### 7.3 交互流程

```
管理者创建数字员工 → 配置角色/知识/技能/权限
  ↓
知识工程师上传文档 → TECH-LLMGW 抽取 → TECH-ONT 写入
  ↓
用户/系统分配任务 → 数字员工通过 TECH-AGENT 执行
  ↓
执行中调用 TECH-RAG 检索知识 → TECH-LLMGW 推理 → TECH-ACTION 执行操作
  ↓
多员工协作 → TECH-A2A 通信 → 任务委派和结果汇总
  ↓
对话记录 → 自动评估 → 效果报表
  ↓
TECH-OBS 记录审计日志
```

### 7.4 数据流转

```
文档上传 → TECH-LLMGW 解析 → 知识抽取
  ↓
抽取结果 → 人工审核 → TECH-ONT 写入本体 → Neo4j 图库 + Milvus 向量库
  ↓
任务执行 → TECH-AGENT 编排 → 多步推理
  ├─ TECH-RAG: 向量检索 + 关键词检索 → 重排序
  ├─ TECH-LLMGW: 模型推理 → 生成回答/决策
  └─ TECH-ACTION: 执行业务操作
  ↓
A2A 协作 → TECH-A2A → Agent Card 交换 → 任务委派
  ↓
执行结果 → PostgreSQL 持久化 → 效果评估
```
