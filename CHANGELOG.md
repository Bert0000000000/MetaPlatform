# 变更日志 (CHANGELOG)

本文件记录 MetaPlatform 项目的所有重要变更。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [v0.6.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 5：业务规则引擎 + AI 增强 + OLAP 分析 + 集成深层能力 + OpenAPI 文档
- 业务规则公式引擎（Aviator 表达式求值、自动编号生成、条件评估）
- 数据质量评估服务（完整性评分、唯一性评分）
- OLAP 分析能力（维度建模、聚合查询）
- 集成适配器深层对接（Webhook、消息队列、文件传输）
- OpenAPI / Swagger UI 配置（springdoc-openapi 2.3.0）

### 变更 (Changed)
- 增强平台 API 文档，支持在线测试接口

---

## [v0.5.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 4：版本管理 + 主数据管理 + 数据血缘 + 适配器 + 管理面板
- 本体版本管理服务（OntologyVersionService）
- 主数据管理模块（MdmService）：黄金记录、匹配、去重
- 数据血缘追踪（LineageService）：血缘事件记录和查询
- 文件存储服务（FileStorageService）
- 多模态处理服务（MultimodalService）

---

## [v0.4.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 3：关系管理 + 流程引擎 + Agent 运行时 + 计费系统
- 对象关系管理（RelationshipService）：一对一、一对多、多对多关系
- 流程引擎（ProcessEngine）：流程定义、实例、任务、事件
- 流程 DSL 解析（ProcessDsl）
- Agent 运行时（AgentController）
- Token 计费服务（BillingController）
- 流程补偿服务（CompensationService）
- 流程触发器服务（TriggerService）

---

## [v0.3.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 2：RAG 知识库 + 对话系统 + 能力库 + 集成中枢 + 安全模块
- 知识库服务（KnowledgeService）：文档摄入、分块、向量嵌入、语义搜索
- 对话系统（DialogueController）：多轮对话管理
- 能力注册与管道编排（CapabilityRegistry、PipelineService）
- 集成中枢（IntegrationController）：外部系统对接
- 安全服务（SecurityService）：RBAC 权限、行级过滤、字段级控制
- 审计日志（AuditService）
- 数据同步服务（DataSyncController）

---

## [v0.2.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 1：业务对象 + AI 能力 + 页面生成
- 业务对象类型定义（ObjectType）：字段定义、校验规则、生命周期
- 对象实例管理（ObjectInstanceService）：CRUD + 校验
- 视图配置自动生成（ViewConfigService）：TABLE、FORM 视图
- AI 字段建议（AiFieldService）
- AI 校验规则建议（RuleSuggestionService）
- 自然语言建模（NlModelingService）
- 校验引擎（ValidationEngine）：Aviator 表达式引擎 + 自定义规则

---

## [v0.1.0] - 2026-07-02

### 新增 (Added)
- Spike：本体引擎骨架搭建
- 项目基础架构（Spring Boot 3.2.5 + Java 21）
- 本体元数据管理（EntityType、Property、RelationType）
- Neo4j 图数据库适配器
- PostgreSQL 关系数据库适配器
- Kafka 事件总线
- Flyway 数据库迁移
- 基础 REST API（EntityTypeController）
- TraceId 日志追踪
- Outbox 模式事件发布
