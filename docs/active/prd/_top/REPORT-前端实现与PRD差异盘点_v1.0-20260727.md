=== METAPLATFORM FRONTEND ↔ PRD DIFFERENCE INVENTORY ===

扫描日期: 2026-07-27
前端代码位置: metaplatform-frontend/
现有PRD位置: docs/prd/APP-*/

============================================================

## 一、前端 Apps 实际结构

| 前端 app | 独立 pages | Portal pages | API 文件数 | 状态 |
|---|---|---|---|---|
| apphub | 15 | 8 | 12 | ✅ 完整 |
| arch | 22 | 5 | 14 | ✅ 完整 |
| dashboard | 6 | 6 | 12 | ✅ 完整 |
| dw | 13 | 6 | 11 | ✅ 完整 |
| kb | 2 | 4 | 1 | ⚠️ 不一致，portal 实现更完整 |
| mcphub | 24 | 7 | 18 | ✅ 完整 |
| ontstudio | 0 (无 src) | 5 | 0 | ❌ 缺源码，仅 portal 实现 |
| portal | - | 49 | 1 (dashboard.ts) | ✅ 总门户 |
| superai | 20 | 1 | 16 | ✅ 完整（COPILOT 后端）|

## 二、PRD ↔ 前端 app 映射关系

| PRD 模块 | PRD 文档 | 前端对应 app | 映射偏差 |
|---|---|---|---|
| APP-DASHBOARD | PRD-APP-DASHBOARD-仪表盘_v2.2 + 后台管理_v1.0 + 按钮手册_v1.0 | dashboard + portal/dashboard + portal/admin | 完整 |
| APP-APPHUB | PRD-APP-APPHUB-应用中心_v2.1 + 按钮手册_v1.0 | apphub + portal/apps | 完整 |
| APP-ARCH | PRD-APP-ARCH-架构中心_v2.1 | arch + portal/arch | 完整 |
| APP-KB | PRD-APP-KB-知识库_v1.1 + 按钮手册_v1.0 | portal/knowledge（kb 仅 2 页） | ⚠️ 应统一以 portal 为准 |
| APP-MCPHUB | PRD-APP-MCPHUB-MCP服务中心_v2.1 + 按钮手册_v1.0 | mcphub + portal/mcp | 完整 |
| APP-ONTSTUDIO | PRD-APP-ONTSTUDIO-本体论引擎_v2.1 + 按钮手册_v1.0 + 改进规划_v2.1 | portal/ontology（独立 ontstudio 无源码） | ⚠️ 独立 app 缺源码 |
| APP-DW | PRD-APP-DW-数字员工_v2.3 + 业务RAG_v1.0 + 页面专属Agent_v1.0 + 按钮手册_v1.0 | dw + portal/agents | 完整 |
| APP-COPILOT | PRD-APP-COPILOT_v2.2 + 超级AI对话_v2.1 + 调度与总结_v1.0 | superai + portal/superai | 完整 |
| **APP-PORTAL (无 PRD)** | ❌ 缺失 | portal | ❗ **需新增 PRD** |

## 三、后端接口预留清单（从前端 API 反推）

前端通过 15+ 个服务前缀调用后端，需在后端就绪前固定以下路径与契约。

### 3.1 已配置的后端服务（packages/shared/src/config/apiConfig.ts）

| 服务名 | 端口 | API 前缀 | 对应 TECH-* | 当前前端使用 |
|---|---|---|---|---|
| iam | 8101 | /api/v1/iam | TECH-IAM | ✅ |
| agent | 8511 | /api/v1/agent | MATE-AGENT | 🟡 |
| mcp | 8105 | /api/v1/mcp | TECH-MCP | ✅ |
| rag | 8901 | /api/v1/rag | TECH-RAG | ✅ |
| ont | 8301 | /api/v1/ont | TECH-ONT | ✅ |
| wfe | 8311 | /api/v1/wfe | TECH-WFE | ✅ |
| ea | 8321 | /api/v1/ea | TECH-EA | ✅ |
| rule | 8331 | /api/v1/rule | TECH-RULE | 🟡 |
| action | 8341 | /api/v1/action | TECH-ACTION | 🟡 |
| data | 8701 | /api/v1/data | MATE-DATA | 🟡 |
| llmgw | 8210 | /api/v1/llmgw | TECH-LLMGW | ✅ |
| obs | 8401 | /api/v1/obs | TECH-OBS | 🟡 |
| msg | 8411 | /api/v1/msg | TECH-MSG | 🟡 |
| a2a | 8502 | /api/v1/a2a | MATE-A2A | ✅ |
| gw | 8000 | /api/v1 | TECH-GW | 🟡 |

### 3.2 前端已使用但未在 apiConfig 声明的服务（需补登记）

| 前端调用前缀 | 当前状态 | 建议归属 |
|---|---|---|
| /api/v1/apphub | 已在 apphub/src/api/* 大量使用 | 建议新增 APPHUB 服务（或纳入 TECH-EA 复用） |
| /api/v1/copilot | 已在 superai/src/api/* 大量使用 | 建议新增 COPILOT 服务（与 mate-agent 合并） |
| /api/v1/dashboard | 已在 dashboard/portal 大量使用 | 建议新增 DASHBOARD 服务（或合并到 IAM） |
| /api/v1/dw | 已在 dw/src/api/* 大量使用 | 建议新增 DW 服务（或纳入 MATE-AGENT） |
| /api/v1/superai | 已在 apphub/src/api/generate.ts 使用 | 与 /api/v1/copilot 同源 |
| /api/v1/kb | 已在 kb/src/api/kb.ts 使用 | 建议统一到 /api/v1/rag |
| /api/v1/superai | 已在 apphub/src/api/generate.ts 使用 | 同 copilot |

## 四、前端已使用的 API 端点（共 141 条，详见附录）

完整端点清单见附录 A。这里按服务分组给出主题清单。

### /v1/apphub/*（应用中心）
- /v1/apphub/apps, /v1/apphub/apps/{id}, /v1/apphub/apps/groups
- /v1/apphub/modules, /v1/apphub/modules/{id}
- /v1/apphub/pages, /v1/apphub/pages/{id}
- /v1/apphub/templates, /v1/apphub/templates/{id}, /v1/apphub/templates/{id}/install, /v1/apphub/templates/{id}/comments
- /v1/apphub/apps/{id}/versions, /v1/apphub/versions/{id}, /v1/apphub/versions/{id}/publish, /v1/apphub/versions/{id}/rollback
- /v1/apphub/apps/{id}/releases, /v1/apphub/releases/{id}, /v1/apphub/releases/{id}/logs
- /v1/wfe/forms/{id}, /v1/wfe/forms/{id}/settings, /v1/wfe/forms/{id}/linkage-rules, /v1/wfe/forms/{id}/scripts, /v1/wfe/forms/{id}/validate
- /v1/wfe/flows/{moduleId}, /v1/wfe/flows/{moduleId}/publish, /v1/wfe/flows/validate, /v1/wfe/flows/test
- /v1/wfe/release-approval/{processInstanceId}/tasks, /tasks/{taskId}/complete

### /v1/copilot/*（SuperAI/Copilot 后端）
- /v1/copilot/chat/multimodal/upload
- /v1/copilot/analysis/generate-sql, /v1/copilot/analysis/explain-sql, /v1/copilot/analysis/audit-sql, /v1/copilot/analysis/execute-sql
- /v1/copilot/queries/execute, /v1/copilot/queries/history
- /v1/copilot/datasources
- /v1/copilot/actions, /v1/copilot/actions/match, /v1/copilot/actions/execute
- /v1/copilot/knowledge-bases
- /v1/copilot/search
- /v1/copilot/generate/form, /v1/copilot/generate/process, /v1/copilot/generate/dashboard, /v1/copilot/generate/explain-code, /v1/copilot/generate/review-code
- /v1/copilot/plans/{id}, /v1/copilot/plans/{id}/steps/{id}/approve, /skip, /v1/copilot/plans/{id}/execute
- /v1/copilot/ontology/concepts/search, /v1/copilot/ontology/concepts/{id}/detail
- /v1/copilot/ontology/graph/query, /v1/copilot/ontology/graph/expand
- /v1/copilot/scheduling/intent/detect, /v1/copilot/scheduling/intents
- /v1/copilot/scheduling/employees/match, /v1/copilot/scheduling/plan/generate, /v1/copilot/scheduling/execution/start, /v1/copilot/scheduling/execution/{id}/report
- /v1/copilot/scheduling/templates
- /v1/copilot/code/* (代码生成：templates, snippets, versions, share, execute, sandbox)
- /v1/copilot/a2a/delegate, /v1/copilot/a2a/external
- /v1/copilot/models/multimodal
- /v1/copilot/conversations, /v1/copilot/auth/login

### /v1/dashboard/*（仪表盘/工作台/后台）
- /v1/dashboard/auth/login, /v1/dashboard/profile, /v1/dashboard/profile/permissions
- /v1/dashboard/metrics, /v1/dashboard/metrics/trend
- /v1/dashboard/todos, /v1/dashboard/todos/done
- /v1/dashboard/notifications, /v1/dashboard/notifications/unread-count, /v1/dashboard/notifications/settings
- /v1/dashboard/deliverables
- /v1/dashboard/workers, /v1/dashboard/api-keys
- /v1/dashboard/settings, /v1/dashboard/sessions
- /v1/dashboard/anomalies, /v1/dashboard/anomaly-rules
- /v1/dashboard/search

### /v1/dw/*（数字员工）
- /v1/dw/auth/login, /v1/dw/employees, /v1/dw/employees/{id}, /v1/dw/employees/tasks
- /v1/dw/commit, /v1/dw/tools, /v1/dw/documents, /v1/dw/documents/upload
- /v1/dw/models, /v1/dw/knowledge-bases
- /v1/dw/evaluations
- /v1/dw/collaborations, /v1/dw/collaborations/{id}
- /v1/dw/extract, /v1/dw/learning/extract, /v1/dw/learning/feedback
- /v1/dw/traces (原 /v1/obs 已重映射)

### /v1/ea/*（企业架构 APP-ARCH）
- /v1/ea/applications, /v1/ea/business-processes, /v1/ea/capabilities, /v1/ea/capabilities/tree
- /v1/ea/capability-mappings, /v1/ea/impact-analysis
- /v1/ea/data/domains, /v1/ea/data-entities, /v1/ea/data-flows, /v1/ea/data-standards, /v1/ea/data-assets, /v1/ea/data-assets/catalog
- /v1/ea/tech-stacks, /v1/ea/technology-components, /v1/ea/technology-radar, /v1/ea/technology-stacks
- /v1/ea/infrastructures, /v1/ea/deployments
- /v1/ea/governance/principles, /v1/ea/governance/principle-categories, /v1/ea/governance/review-templates, /v1/ea/governance/review-tickets, /v1/ea/governance/tech-debts
- /v1/ea/orgs, /v1/ea/orgs/tree, /v1/ea/roles
- /v1/ea/value-streams, /v1/ea/value-streams/{id}/stages/{id}
- /v1/ea/ontology-mappings/rules, /v1/ea/ontology-mappings/changes

### /v1/mcp/*（MCP 中心 APP-MCPHUB）
- /v1/mcp/servers, /v1/mcp/clients, /v1/mcp/tools, /v1/mcp/tool-categories, /v1/mcp/resources, /v1/mcp/prompts
- /v1/mcp/permissions, /v1/mcp/policies, /v1/mcp/trusts
- /v1/mcp/external-agents, /v1/mcp/integrations
- /v1/mcp/debug/execute, /v1/mcp/debug/compare, /v1/mcp/debug/history
- /v1/mcp/collaborations, /v1/mcp/collaborations/logs
- /v1/mcp/connection-monitor
- /v1/mcp/audit/logs, /v1/mcp/audit/analytics, /v1/mcp/audit/statistics, /v1/mcp/audit/trends, /v1/mcp/audit/export
- /v1/mcp/alert-rules, /v1/mcp/api-keys, /v1/mcp/overview

### /v1/ont/*（本体论引擎 APP-ONTSTUDIO）+ /v1/rag/*（知识库 APP-KB）
- /v1/ont/concepts/search, /v1/rag/search, /v1/kb/* (kb 单独前缀)

### /v1/iam/* / /v1/a2a/* / /v1/llmgw/*
- /v1/iam/auth/login, /v1/iam/policies, /v1/iam/policies/{id}, /v1/iam/policies/matrix, /v1/iam/policies/matrix/export, /v1/iam/policies/condition-syntax
- /v1/a2a/agent-cards/search, /v1/a2a/delegations
- /v1/llmgw/chat/completions

## 五、各模块差异详表

### 5.1 APP-APPHUB (应用中心)

**PRD v2.1 ↔ 前端代码 apphub + portal/apps**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| 4.1 应用管理 | AppListPage, AppDetailPage, AppLifecyclePage | ✅ | - |
| 4.2 模块管理 | 通过 AppDetailPage + updateModule API | 🟡 | UI 在应用详情中集成，未独立模块管理页 |
| 4.3 表单设计器 | FormDesignerPage + FormGlobalSettings/Linkage/Scripts | ✅ | - |
| 4.4 流程设计器 | FlowDesignerPage + AIProcessGenerate | ✅ | - |
| 4.5 页面设计器 | PageDesignerPage + DashboardCanvas/TableWidget/ChartWidget | ✅ | - |
| 4.6 应用发布 | AppLifecyclePage + release.ts API | ✅ | - |
| 4.7 版本管理 | VersionManagementPage + VersionList/Diff/Rollback | ✅ | - |
| 4.8 应用市场 | MarketplacePage, MarketPage, MyTemplatesPage, TemplateSubmitPage | ✅ | - |
| 4.9 AI 辅助开发 | AIDesignerPage + AICodeHelper/AIProcessGenerate/AIFormGenerate/AIDashboardGenerate | ✅ | - |
| 4.10 数据建模（v2.0 新增） | AppModelingPage | ✅ | - |
| 4.11 表单+流程联动视图 | FormDesignerPage 内 FormBinding + FormLinkage | 🟡 | 未单独视图页面 |
| 4.12 应用配置（v2.0 拆分） | AppConfigPage + AppPublishPage + AppVersionPage | ✅ | - |
| 灰度发布、发布审批 | release.ts 已含 GRAYSCALE 策略 + release-approval 流程 | 🟡 | 后端尚未实现 |

**关键差异**：独立 apphub app 与 portal/apps 是两套页面实现，但入口路由不同。**应以 portal/apps 作为单一门户（与 PRD 4.1.5 应用详情页路径 /apps/detail 一致）**。

### 5.2 APP-ARCH (架构中心)

**PRD v2.1 ↔ 前端代码 arch + portal/arch**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| 3.1.1 业务架构总览 | BusinessArchPage | ✅ | - |
| 3.1.2-3.1.6 业务能力 CRUD | CapabilityManagementPage + DependencyGraph | ✅ | - |
| 3.1.7 价值流管理 | ValueStreamPage | ✅ | - |
| 3.1.8 业务流程梳理 | BusinessProcessPage | ✅ | - |
| 3.1.9 组织角色管理 | OrgRolePage | ✅ | - |
| 3.2 应用架构 | ApplicationManagementPage + TechDebtPage | ✅ | - |
| 3.3 数据架构 | DataArchPage + DataEntityDetailPage + DataFlowPage + DataStandardPage + DataAssetCatalogPage | ✅ | - |
| 3.4 技术架构 | TechArchPage + TechComponentPage + TechStackPage + DeploymentTopologyPage + TechRadarPage | ✅ | - |
| 3.5 架构治理 | PrinciplesPage + ReviewPage + ReviewTemplatePage + TechDebtPage | ✅ | - |
| 3.6 Ontology 联动 | OntologyMappingPage + CapabilityGraph | ✅ | - |
| 变更影响分析 | 未独立页面（在 OntologyMappingPage 内） | 🟡 | 需在 PRD 中标注 |

**关键差异**：arch app 与 portal/arch 是两套实现，深度更深的 arch app 包含 22 个独立页面，portal/arch 仅 5 个聚合页。

### 5.3 APP-DASHBOARD (仪表盘 + 工作台 + 后台管理)

**PRD v2.2 + 后台管理 v1.0 ↔ 前端代码 dashboard + portal/dashboard + portal/admin**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| 全局工作台 | dashboard/DashboardPage + portal/dashboard/DashboardPage | ✅ | - |
| 我的应用 | portal/dashboard/MyAppsPage | ✅ | - |
| 我的数字员工 | portal/dashboard/MyAgentsPage | ✅ | - |
| 消息通知 | dashboard/NotificationsPage + portal/dashboard/MessagesPage | ✅ | - |
| 门户 | portal/dashboard/PortalPage | ✅ | - |
| 交付材料 | dashboard/DeliverablesPage + portal/dashboard/DeliverablesPage | ✅ | - |
| 个人中心 | dashboard/SettingsPage | ✅ | - |
| AI Ops | dashboard/AiOpsPage | 🆕 | PRD 未明确，需补充 |
| 后台管理 / 用户 | portal/admin/AdminUsersPage | ✅ | - |
| 后台管理 / 权限 | portal/admin/AdminPermissionsPage + portal/admin/AdminOperationsPage | ✅ | - |
| 后台管理 / 组织 | portal/admin/AdminOrgPage | ✅ | - |
| 后台管理 / 日志 | portal/admin/AdminLogsPage | ✅ | - |
| 后台管理 / 配置 | portal/admin/AdminConfigPage | ✅ | - |
| 后台管理 / 组件库 | portal/admin/AdminComponentsPage + flowgram-editor + node-render-v2 | 🆕 | PRD 未明确 |

**关键差异**：portal 含 PRD 未明确描述的 AdminComponentsPage 与 AdminOperationsPage（运维监控），需补章节。

### 5.4 APP-DW (数字员工)

**PRD v2.3 + 业务RAG + 页面专属Agent ↔ 前端代码 dw + portal/agents**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| 员工管理（列表/创建/详情/克隆） | EmployeeListPage/CreatePage/DetailPage + EmployeeCloneButton | ✅ | - |
| 能力配置 | CapabilityConfigPage + EmployeeAssignmentDialog | ✅ | - |
| 任务管理 | TaskListPage/CreatePage/DetailPage + TaskSplitter/TaskControls/DelegationForm | ✅ | - |
| 效果评估 | EvaluationPage + AutoScorePanel/DimensionScoreChart/EvaluationReport | ✅ | - |
| 多员工协作 | CollaborationListPage/CreatePage/MonitorPage | ✅ | - |
| 外部 Agent | ExternalAgentsPage | ✅ | - |
| 知识提炼 | ExtractionPanel + LearningRecordsList | ✅ | - |
| 客户 Copilot | CustomerCopilot | ✅ | - |
| 页面专属 Agent | EmbeddedChat | ✅ | 与 PRD-APP-DW-页面专属Agent 对应 |
| 版本对比 | VersionDiffPage | ✅ | - |

**关键差异**：dw + portal/agents 是两套实现，dw 含 13 个深度页面，portal/agents 含 6 个聚合页。

### 5.5 APP-KB (知识库)

**PRD v1.1 ↔ 前端代码 kb + portal/knowledge**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| 知识库列表 | portal/knowledge/KnowledgeBasePage + kb/KbListPage | ✅ | - |
| 文档管理 | portal/knowledge/KnowledgeDocsPage | 🟡 | kb 端无独立页 |
| 检索配置 | portal/knowledge/KnowledgeConfigPage | 🟡 | kb 端无独立页 |
| 检索测试 | kb/SearchTestPage + portal/knowledge/KnowledgeTestPage | ✅ | - |

**关键差异**：独立 kb app 仅有 2 页（KbListPage, SearchTestPage），其余 3 页在 portal。**建议统一以 portal/knowledge 为单一来源**。

### 5.6 APP-MCPHUB (MCP 服务中心)

**PRD v2.1 ↔ 前端代码 mcphub + portal/mcp**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| MCP Server 管理 | ServerListPage/DetailPage/ServerForm | ✅ | - |
| MCP Client 管理 | ClientListPage/FormPage/DetailPage | ✅ | - |
| 工具注册中心 | ToolListPage/DetailPage/EditPage/ToolForm/ToolAssignment/ToolDiscovery | ✅ | - |
| 工具分类 | CategoryManagement | ✅ | - |
| MCP 调试器 | DebuggerPage (三栏布局) + OnlineTester + ResponseViewer + ParameterForm | ✅ | - |
| 调用审计 | AuditStatisticsPage/AuditDetailPage + ExportButton | ✅ | - |
| Token 消耗统计 | overview.ts | ✅ | - |
| 权限控制（ABAC） | PermissionRulePage/PolicyManagementPage/PermissionMatrixPage | ✅ | - |
| 外部应用对接 | ExternalIntegrationPage/ExternalAgentListPage/TrustManagementPage/IdeConfigPage | ✅ | - |
| 连接监控 | ConnectionMonitorPage | ✅ | - |
| 告警规则 | AlertRule (api/alert-rules.ts) | 🟡 | 无独立页面（概览中查看） |
| Prompt 模板 | PromptTemplatePage | ✅ | - |
| Resource 管理 | ResourceListPage/EditPage | ✅ | - |
| API Key | ApiKeyGenerator + /v1/mcp/api-keys | ✅ | - |
| 协作审计 | CollaborationAuditPage | 🆕 | PRD 未明确，需补 |

**关键差异**：portal/mcp 仅 7 个聚合页，mcphub 含 24 个深度页面。需以 mcphub 为深度来源。

### 5.7 APP-ONTSTUDIO (本体论引擎)

**PRD v2.1 ↔ 前端代码 ontstudio (无源码) + portal/ontology**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| 3.1 本体论建模 | portal/ontology/OntologyModelingPage | 🟡 | 独立 ontstudio app 无 src 代码 |
| 3.2 数据中心 | portal/ontology/OntologyDatacenterPage | 🟡 | 同上 |
| 3.3 Action 编排 | portal/ontology/OntologyActionPage | 🟡 | 同上 |
| 3.4 知识图谱 | portal/ontology/OntologyGraphPage | 🟡 | 同上 |
| 概念/实体/关系 CRUD | 5 个 portal/ontology 页内联 | 🟡 | 需补深度 |
| 规则管理 | RuleManagementPage（在 ontstudio/ 中） | ❓ | 源码缺失，无法确认 |
| 版本管理 | VersionPage（在 ontstudio/ 中） | ❓ | 同上 |

**关键差异**：**apps/ontstudio 目录仅有 node_modules，没有 src/ 源码**。实际实现仅在 portal/ontology 共 5 个聚合页面。**PRD 描述的 3.1.1~3.4.6 章节需根据 portal/ontology 实际能力重写**。

### 5.8 APP-COPILOT (超级 AI / SuperAI)

**PRD v2.2 + 超级AI对话 v2.1 + 调度与总结 v1.0 ↔ 前端代码 superai + portal/superai**

| PRD 章节 | 前端实现 | 状态 | 备注 |
|---|---|---|---|
| 1. 顶层对话窗口 | superai/SuperAIChatPage + portal/superai/SuperAIPage | ✅ | - |
| 2. 智能问答 RAG | ChatPage + chat.ts（多轮/引用/历史/消息反馈） | ✅ | - |
| 3. 数据分析 NL2SQL | DataAnalysisPage + analysis.ts (generate/explain/audit/execute) | ✅ | - |
| 4. Action 执行 | AgentChatPanel + actions.ts (match/execute) | ✅ | - |
| 5. Ontology 探索 | ExplorePanel + ontology.ts (search/detail/graph query/expand) | ✅ | - |
| 6. 代码生成 | GeneratePanel + code.ts (templates/snippets/versions/share/execute) | ✅ | - |
| 7. 任务编排 | TaskOrchestrationPage + plans.ts (create/approve/skip/execute) | ✅ | - |
| 9. 顶层调度（FR-AI-009） | ScheduleIntentPage + EmployeeMatchingPage + SchedulePlanCard + ScheduleExecutionPage + ExecutionDetailPage + ResultSummaryPage + ReportExportPage + ManualSelectEmployeePage | ✅ | - |
| 9. 知识总结（FR-AI-010） | CostOptimizationPage + ResultAggregationPage | ✅ | - |
| 9. 顶层入口（FR-AI-011） | AgentCopilotPage + SuperAIChatPage | ✅ | - |
| 8. A2A 协作 | A2ACollaborationPage + a2a.ts (agent-cards, delegations) | ✅ | - |
| 多模态 | multimodal/upload + models/multimodal | 🟡 | 部分实现 |

**关键差异**：superai 包含 20 个独立页面（最完整），portal/superai 仅 1 个聚合页 SuperAIPage。**应以 superai 为深度来源**。

## 六、缺失/未实现交互盘点（PRD 提到但前端未完成）

以下为 PRD 提及但前端代码未完成（含 mock/骨架）的交互，**需在前端补全**或**明确归为后端预留**。

### 6.1 APP-DASHBOARD
- [ ] 工作台拖拽布局自定义（PRD 1.1）→ 仅渲染，无编辑模式
- [ ] 偏好设置（语言/时区/日期格式）实时生效（PRD 1.5）→ SettingsPage 框架在，需接通
- [ ] 主题切换亮色/暗色实时（PRD 1.5）→ useThemeMode 已实现，需确保 SSR 一致
- [ ] 会话管理（登录设备/强制下线）（PRD 1.5）→ API /v1/dashboard/sessions 已预留，UI 待补
- [ ] API Token 管理 UI（PRD 1.5）→ API /v1/dashboard/api-keys 已预留，UI 待补

### 6.2 APP-APPHUB
- [ ] 灰度发布策略（release.ts 已含 GRAYSCALE，但 UI 端未实现）→ 需补 AppPublishPage 中的灰度发布表单
- [ ] 发布审批流（release-approval 已含审批 API，UI 待补）→ AppPublishPage 需集成审批流程图
- [ ] 数据建模深度（4.10）：实体属性、关系建模 → AppModelingPage 需确认深度
- [ ] 表单+流程联动视图（4.11）：未独立页面，在 FormDesigner 中通过 FormBinding 集成
- [ ] 模板生态（分类/评分/我的模板/官方模板库）→ 已实现，需在 PRD 中描述

### 6.3 APP-ARCH
- [ ] 架构健康度仪表盘（PRD 3.5.4）→ 需新增独立页
- [ ] 变更影响分析可视化（PRD 3.5.3）→ 当前在 OntologyMappingPage，需独立
- [ ] 业务流程建模器（BPMN 拖拽）（PRD 3.1.8）→ BusinessProcessPage 是否支持拖拽需验证
- [ ] Ontology 双向联动（自动发现映射）（PRD 3.6）→ 部分实现，需加深

### 6.4 APP-KB
- [ ] 切片策略模板编辑（PRD 1.3）→ portal/knowledge/KnowledgeConfigPage 内含，需验证深度
- [ ] 知识库版本快照/回滚（PRD 1.5）→ API 已预留 /v1/dw/knowledge-bases，UI 待补
- [ ] 切片审核 UI（PRD 1.6）→ 文档预览页中可加，需前端补

### 6.5 APP-MCPHUB
- [ ] 告警规则独立页（PRD 3.5）→ alert-rules API 已预留，无独立页
- [ ] 调试器三栏布局完整（请求/响应/上下文）→ DebuggerPage 已实现，需验证
- [ ] ABAC 矩阵视图（PRD 3.6.3）→ PermissionMatrixPage 已实现

### 6.6 APP-ONTSTUDIO
- [ ] Cypher 查询控制台（PRD 3.4.2）→ KnowledgeGraphPage 内可能含，需验证
- [ ] 决策表/规则测试用例（PRD 3.1.4）→ 当前 portal/ontology/OntologyActionPage 未涉及规则
- [ ] 数据血缘可视化（PRD 3.2.4）→ 当前 portal/ontology/OntologyDatacenterPage 需验证
- [ ] 拖拽式 Action 编排（PRD 3.3.2）→ 当前 ActionPage 需验证

### 6.7 APP-DW
- [ ] A2A 委托任务异步回调与状态同步（PRD FR-A2A-1）→ ExternalAgentsPage 已实现，需验证回调
- [ ] 多员工协作最终报告聚合（PRD FR-COLLAB-3）→ ResultAggregator 已实现
- [ ] 任务执行回放对接 TECH-OBS trace（PRD FR-REPLAY-1）→ ReplayPanel/ReplayPlayer 已实现

### 6.8 APP-COPILOT
- [ ] 消息反馈（点赞/踩）（PRD FR-AI-001）→ chat.ts 未见，UI 待补
- [ ] 附件上传（PRD FR-AI-001）→ multimodal/upload 已预留，UI 待补
- [ ] SQL 编辑器深度（PRD FR-AI-002）→ DataAnalysisPage 实现状态需验证
- [ ] 代码沙箱运行（PRD FR-AI-005）→ executeCode 已预留，UI 待补

## 七、前后端边界与并行开发约定

为支持前后端并行开发，**前端所有 API 调用已统一收敛在 src/api/*.ts**，所有路径遵循以下约定：

1. **请求格式**：所有非 GET 请求均为 JSON，Content-Type: application/json
2. **响应包装**：后端需统一返回 \{ code: number, message: string, data: T, traceId: string }\ 格式，code=0 表示成功
3. **鉴权**：前端 Bearer Token 在请求头 Authorization 中，refresh token 走 /api/v1/iam/auth/refresh
4. **Trace**：前端自动注入 X-Trace-Id（16 位 hex），后端需在响应头 X-Trace-Id 回传
6. **错误码**：BizError(code, message) 由前端 code 非 0 抛出；HttpError(status) 由 HTTP 状态码抛出
7. **超时**：默认 30s，refresh 10s

### 7.1 后端已就绪可对接的最小集合（前端已有容错回退）
- /api/v1/iam/auth/{login,logout,refresh}（auth.ts）
- /api/v1/llmgw/chat/completions（llm.ts，copilot.ts）
- /api/v1/rag/search（kb.ts）
- /api/v1/a2a/*（a2a.ts）

### 7.2 需后端新增服务或调整的服务（前端已固化调用前缀）
- APPHUB 服务（/api/v1/apphub + /api/v1/wfe/*）
- COPILOT 服务（/api/v1/copilot + /api/v1/superai）
- DASHBOARD 服务（/api/v1/dashboard）
- DW 服务（/api/v1/dw）
- KB 服务（/api/v1/kb 或统一到 /api/v1/rag）

## 八、行动计划

### 8.1 PRD 文档需要做的变更
1. **新增** APP-PORTAL 主门户外挂 PRD（docs/prd/APP-PORTAL/）
2. **更新** APP-APPHUB v2.1 → v2.2：以 portal/apps 为单一门户口径，新增 4.12 中各子页的精确字段
3. **更新** APP-ARCH v2.1 → v2.2：补充 portal/arch 与独立 arch 的差异，标注独立 arch 22 页是深度来源
4. **更新** APP-DASHBOARD v2.2 → v2.3：补 AdminComponentsPage、AdminOperationsPage 章节；明确 portal/dashboard 与 dashboard app 双实现的取舍
5. **更新** APP-KB v1.1 → v1.2：明确以 portal/knowledge 为单一来源
6. **更新** APP-MCPHUB v2.1 → v2.2：补 CollaborationAuditPage、API Key、告警规则独立章节
7. **更新** APP-ONTSTUDIO v2.1 → v2.2：根据 portal/ontology 重写 3.1~3.4 章节，明确独立 ontstudio 暂未启用的状况
8. **更新** APP-DW v2.3 → v2.4：补全 dw 与 portal/agents 双实现的映射；新增 ExternalAgents/TaskSplitter/ReplayPanel 等章节
9. **更新** APP-COPILOT v2.2 → v2.3：补全 superai 20 页的实现映射，明确未完成交互清单
10. **更新** 各按钮操作手册 v1.0 → v1.1：与新 PRD 同步
11. **新增** docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md：固化所有前端 API 路径与请求/响应 schema，作为后端实现依据
12. **新增** docs/prd/_top/PLAN-Mate_Platform-前后端并行开发接口边界_v1.0-20260727.md：明确前后端各自职责、Mock 策略、就绪条件

### 8.2 前端需补全的交互（从六列出的清单中筛选 P0）
- 灰度发布与发布审批（APP-APPHUB）
- 通知中心（APP-DASHBOARD）
- 主题切换亮色（APP-DASHBOARD Settings）
- 会话管理与 API Token UI（APP-DASHBOARD）
- 工作台拖拽编辑模式（APP-DASHBOARD）
- 代码沙箱运行面板（APP-COPILOT Generate）
- 知识库版本快照/回滚（APP-KB）
- Cypher 查询控制台（APP-ONTSTUDIO）
- 告警规则独立页（APP-MCPHUB）
- 决策表/规则测试用例（APP-ONTSTUDIO）

### 8.3 后端开发优先级建议
| 优先级 | 后端服务 | 关联前端 app | 备注 |
|---|---|---|---|
| P0 | TECH-IAM | ALL | 已有完整 API |
| P0 | TECH-WFE | APP-APPHUB | 表单/流程/发布审批 |
| P0 | TECH-LLMGW | APP-COPILOT | 已有 chat/completions |
| P0 | 新增 APPHUB | APP-APPHUB | 应用/模块/页面/版本/市场 |
| P0 | 新增 COPILOT | APP-COPILOT | 分析/Action/代码/任务/调度 |
| P1 | TECH-ONT | APP-ONTSTUDIO | 概念/关系/图谱 |
| P1 | TECH-RAG | APP-KB | 文档/切片/检索 |
| P1 | 新增 DW | APP-DW | 员工/任务/评估/协作 |
| P1 | 新增 DASHBOARD | APP-DASHBOARD | 工作台/通知/待办/设置 |
| P2 | TECH-MCP | APP-MCPHUB | 工具/服务器/客户端 |
| P2 | TECH-EA | APP-ARCH | 能力/价值流/应用/数据/技术/治理 |
| P2 | TECH-A2A | APP-COPILOT, APP-DW | 委派/Agent Card |
| P2 | TECH-MSG | ALL | 消息总线 |
| P3 | TECH-OBS | APP-DW | Trace |
| P3 | TECH-RULE | APP-ONTSTUDIO | 规则 |
| P3 | TECH-ACTION | APP-ONTSTUDIO | Action |
| P3 | MATE-DATA | APP-APPHUB | 数据集成 |

## 九、附录

### 附录 A：完整 API 端点清单（141 条，按服务分组）

已保存到 \docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md\（待生成）。

### 附录 B：前端实现的完整页面清单

| 模块 | 独立 app 页面 | portal 页面 |
|---|---|---|
| APP-APPHUB | AppListPage, AppDetailPage, AppLifecyclePage, FormDesignerPage, FlowDesignerPage, PageDesignerPage, VersionManagementPage, MarketplacePage, MarketplaceDetailPage, MarketPage, TemplateDetailPage, MyTemplatesPage, TemplateSubmitPage, AIDesignerPage | AppsListPage, AppDetailPage, AppModelingPage, FormDesignerPage, ProcessDesignerPage, AppConfigPage, AppPublishPage, AppVersionPage |
| APP-ARCH | BusinessArchPage, CapabilityManagementPage, ApplicationManagementPage, ValueStreamPage, BusinessProcessPage, OrgRolePage, DataArchPage, DataEntityDetailPage, DataFlowPage, DataStandardPage, DataAssetCatalogPage, TechArchPage, TechComponentPage, TechStackPage, DeploymentTopologyPage, TechRadarPage, PrinciplesPage, ReviewTemplatePage, ReviewPage, TechDebtPage, OntologyMappingPage | ArchBusinessPage, ArchAppPage, ArchDataPage, ArchTechPage, ArchGovernancePage |
| APP-DASHBOARD | DashboardPage, NotificationsPage, DeliverablesPage, AiOpsPage, SettingsPage | DashboardPage, MyAppsPage, MyAgentsPage, MessagesPage, PortalPage, DeliverablesPage |
| APP-DW | EmployeeListPage, EmployeeCreatePage, EmployeeDetailPage, CapabilityConfigPage, TaskListPage, TaskCreatePage, TaskDetailPage, EvaluationPage, CollaborationListPage, CollaborationCreatePage, CollaborationMonitorPage, ExternalAgentsPage, VersionDiffPage | AgentsListPage, AgentsDetailPage, AgentsKnowledgePage, AgentsTasksPage, AgentsCollabPage, AgentsEvaluationPage |
| APP-KB | KbListPage, SearchTestPage | KnowledgeBasePage, KnowledgeDocsPage, KnowledgeTestPage, KnowledgeConfigPage |
| APP-MCPHUB | OverviewPage, ToolListPage, ToolDetailPage, ToolEditPage, ServerListPage, ServerDetailPage, DebuggerPage, ClientListPage, ClientFormPage, ClientDetailPage, PermissionRulePage, PolicyManagementPage, PermissionMatrixPage, ResourceListPage, ResourceEditPage, PromptTemplatePage, AuditStatisticsPage, AuditDetailPage, ExternalIntegrationPage, ExternalAgentListPage, TrustManagementPage, CollaborationAuditPage, IdeConfigPage, ConnectionMonitorPage | McpToolsPage, McpServerPage, McpClientPage, McpDebuggerPage, McpPermissionsPage, McpExternalPage, McpAuditPage |
| APP-ONTSTUDIO | （无 src 源码） | OntologyModelingPage, OntologyDatacenterPage, OntologyActionPage, OntologyGraphPage |
| APP-COPILOT | SuperAIChatPage, AgentCopilotPage, ChatPage, DataAnalysisPage, TaskOrchestrationPage, TaskTemplatePage, ExecutionPlanPage, ParallelExecutionPage, ResultAggregationPage, ScheduleIntentPage, EmployeeMatchingPage, SchedulePlanCardPage, ScheduleExecutionPage, ExecutionDetailPage, ResultSummaryPage, ReportExportPage, ManualSelectEmployeePage, CostOptimizationPage, A2ACollaborationPage, StorybookDemo | SuperAIPage |

