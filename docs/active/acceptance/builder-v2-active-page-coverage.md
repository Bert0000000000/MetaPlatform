# Builder V2 active 页面模式覆盖清单

范围：当前 Task 8 单一注册表解析的 **151 个 active 路由模式 / 132 个直接解析唯一页面源**；150 条直接解析，另人工核对 `/ontology` 本地总览/redirect wrapper。123 个 redirect 声明属于兼容矩阵，未计作额外页面。RID、tab 与 query 参数实例不无限展开。

本表是当前源码与页面模式归类，不宣称逐个渲染了 151 个页面，也不宣称后端健康或正式交付。浏览器代表覆盖七入口、SuperAI、六组、历史路径、四宽、普通 Tab/Escape、主题/导航偏好；builder 配置显式收集三个文件共 21 项，保留原 20 项并增加真实写入链。该链在独立非特权 PG 目标的唯一测试来源上通过 UI 保存 WIP、五步发布、保存映射、同步与样本/对象查询；没有接口替身。非本体域采用人工编写的当前 DTO HTTP 边界，未知调用显式 503；身份/设置与 Ont 使用独立真实服务。mandatory core/migration/PG 结果独立登记。

共享样式：`components/skeleton/skeleton.css` 的页头、表格局部滚动、状态与窄屏筛选；保留自有列表/卡片/画布操作。ResourceDetailLayout、KernelPrimitiveListPage 与 ExternalAgentsPanel 已实际使用 PageHeader；ApphubShell 依据现有 query 分发 15 个子页，无额外平台事实。Flowgram 原有演示仍明确是演示。

| active 路由模式 | 产品 / 功能组 / 页面 | 实际源（相对 apps/web） | 原型/共享模式 | 实际适配与复用 | 验证种类 |
|---|---|---|---|---|---|
| /home | home / home / /home | src/pages/dashboard/DashboardPage.tsx | 工作汇总 / 待办 / 继续工作 | PageHeader + 真实汇总卡片 + 独立审批读取状态 | HTTP 边界交互及四宽浏览器；独立失败单元 |
| /home/todos | home / home / /home/todos | src/pages/dashboard/NotificationsPage.tsx | 共享页头/卡片/业务状态 | PageHeader, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /home/messages | home / home / /home/messages | src/pages/dashboard/MessagesPage.tsx | 共享页头/卡片/业务状态 | PageHeader, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /home/deliverables | home / home / /home/deliverables | src/pages/dashboard/DeliverablesPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /home/apps | home / home / /home/apps | src/pages/dashboard/MyAppsPage.tsx | 共享页头/卡片/业务状态 | PageHeader, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /home/me | home / home / /home/me | src/pages/dashboard/SettingsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /home/portal | home / home / /home/portal | src/pages/dashboard/PortalPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /home/aiops | home / home / /home/aiops | src/pages/dashboard/AiOpsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents | agents / employees / /agents | src/pages/agents/EmployeeListPage.tsx | 员工目录 / 配置入口 | PageHeader/FilterBar/EmployeeCard；真实激活枚举 | HTTP 边界四宽浏览器；真实 client 响应单元 |
| /agents/create | agents / employees / /agents | src/pages/agents/EmployeeCreatePage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/external | agents / employees / /agents/external | src/pages/agents/ExternalAgentsPage.tsx | 资源目录 wrapper | ExternalAgentsPanel 的 PageHeader/卡片/表格 | wrapper 与子页源码核对 |
| /agents/tasks | agents / tasks / /agents/tasks | src/pages/agents/TaskListPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/tasks/:taskId | agents / tasks / /agents/tasks | src/pages/agents/TaskDetailPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/collab | agents / tasks / /agents/collab | src/pages/agents/CollaborationListPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/collab/create | agents / tasks / /agents/collab | src/pages/agents/CollaborationCreatePage.tsx | 共享页头/卡片/业务状态 | PageHeader | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/collab/:id | agents / tasks / /agents/collab | src/pages/agents/CollaborationMonitorPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/evaluation | agents / operations / /agents/evaluation | src/pages/agents/EvaluationPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/documents | agents / operations / /agents/documents | src/pages/dw/DocumentsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/employees | agents / employees / /agents/employees | src/pages/dw/EmployeesPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/dw-tasks | agents / tasks / /agents/dw-tasks | src/pages/dw/TasksPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/dw-collaborations | agents / tasks / /agents/dw-collaborations | src/pages/dw/CollaborationsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/dw-evaluations | agents / operations / /agents/dw-evaluations | src/pages/dw/EvaluationsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/learning | agents / operations / /agents/learning | src/pages/dw/LearningPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/extraction | agents / operations / /agents/extraction | src/pages/dw/ExtractionPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/obs | agents / operations / /agents/obs | src/pages/dw/ObsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/:employeeId | agents / employees / /agents | src/pages/agents/EmployeeDetailPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /agents/:employeeId/capabilities | agents / employees / /agents | src/pages/agents/CapabilityConfigPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/chat | superai / goals / /superai/chat | src/pages/superai/ChatPage.tsx | 会话列表 / 对话 / 实际上下文 | PageHeader + 自有三栏和可切换窄屏布局 | HTTP 边界会话 DTO 行为及四宽浏览器 |
| /superai/plans | superai / plans / /superai/plans | src/pages/superai/ExecutionPlanPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/a2a | superai / plans / /superai/plans/a2a | src/pages/superai/A2ACollaborationPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/orchestration | superai / plans / /superai/plans/orchestration | src/pages/superai/OrchestrationConsolePage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/manual-select | superai / plans / /superai/plans/manual-select | src/pages/superai/ManualSelectEmployeePage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/parallel | superai / plans / /superai/plans/parallel | src/pages/superai/ParallelExecutionPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/result-aggregation | superai / plans / /superai/plans/result-aggregation | src/pages/superai/ResultAggregationPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/result-summary | superai / plans / /superai/plans/result-summary | src/pages/superai/ResultSummaryPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/employee-match | superai / plans / /superai/plans/employee-match | src/pages/superai/EmployeeMatchingPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/plans/:definitionId | superai / plans / /superai/plans | src/pages/wfe/ActionOrchestrationPage.tsx | 行动编排 / 节点配置 | PageHeader + 既有 PlanCanvas/PlanInspector/发布校验 | 新增共享页头；保留版本与发布操作；源码模式核对 |
| /superai/schedules | superai / schedules / /superai/schedules | src/pages/superai/ScheduleIntentPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/schedules/execute | superai / schedules / /superai/schedules/execute | src/pages/superai/ScheduleExecutionPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/schedules/plan | superai / schedules / /superai/schedules/plan | src/pages/superai/SchedulePlanCardPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/cost | superai / cost / /superai/cost | src/pages/superai/CostOptimizationPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/cost/data | superai / cost / /superai/cost/data | src/pages/superai/DataAnalysisPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/cost/report | superai / cost / /superai/cost/report | src/pages/superai/ReportExportPage.tsx | 共享页头/卡片/业务状态 | PageHeader | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/templates | superai / goals / /superai/templates | src/pages/superai/TaskTemplatePage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /superai/team | superai / goals / /superai/team | src/pages/superai/AgentTeamRunPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/kb | ki / kb / /ki/kb | src/pages/knowledge/KnowledgeBasePage.tsx | 知识库清单 / 读取失败状态 | PageHeader/FilterBar/DataTablePro/EmptyState；失败读取不转空集合 | 知识库失败/重试单元；HTTP 503 四宽浏览器 |
| /ki/kb/docs | ki / kb / /ki/kb/docs | src/pages/knowledge/KnowledgeDocsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/kb/config | ki / kb / /ki/kb/config | src/pages/knowledge/KnowledgeConfigPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/kb/test | ki / kb / /ki/test | src/pages/knowledge/KnowledgeTestPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/kb/:kbId | ki / kb / /ki/kb | src/pages/knowledge/KnowledgeKbDetailPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/test | ki / kb / /ki/test | src/pages/knowledge/KnowledgeTestPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/overview | ki / mcp / /ki/mcp/overview | src/pages/mcp/OverviewPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/skill-hub | ki / mcp / /ki/mcp/skill-hub | src/pages/mcp/SkillHubPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState；本轮详情/SkillHub 采用共享页头 | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/tools | ki / mcp / /ki/mcp/tools | src/pages/mcp/McpToolsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/tools/new | ki / mcp / /ki/mcp/tools | src/pages/mcp/McpToolsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/tools/:id | ki / mcp / /ki/mcp/tools | src/pages/mcp/ToolDetailPage.tsx | 共享页头/卡片/业务状态 | PageHeader；本轮详情/SkillHub 采用共享页头 | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/tools/:id/edit | ki / mcp / /ki/mcp/tools | src/pages/mcp/McpToolsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/resources | ki / mcp / /ki/mcp/resources | src/pages/mcp/ResourceListPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/resources/new | ki / mcp / /ki/mcp/resources | src/pages/mcp/ResourceListPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/resources/:id | ki / mcp / /ki/mcp/resources | src/pages/mcp/ResourceListPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/prompts | ki / mcp / /ki/mcp/prompts | src/pages/mcp/PromptTemplatePage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/debugger | ki / mcp / /ki/mcp/debugger | src/pages/mcp/McpDebuggerPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/ide-config | ki / mcp / /ki/mcp/ide-config | src/pages/mcp/IdeConfigPage.tsx | 共享页头/卡片/业务状态 | PageHeader | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/servers | ki / mcp / /ki/mcp/servers | src/pages/mcp/McpServerPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/servers/new | ki / mcp / /ki/mcp/servers | src/pages/mcp/McpServerPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/servers/:id | ki / mcp / /ki/mcp/servers | src/pages/mcp/ServerDetailPage.tsx | 共享页头/卡片/业务状态 | PageHeader；本轮详情/SkillHub 采用共享页头 | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/servers/:id/edit | ki / mcp / /ki/mcp/servers | src/pages/mcp/McpServerPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/clients | ki / mcp / /ki/mcp/clients | src/pages/mcp/McpClientPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/clients/new | ki / mcp / /ki/mcp/clients | src/pages/mcp/McpClientPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/clients/:id | ki / mcp / /ki/mcp/clients | src/pages/mcp/ClientDetailPage.tsx | 共享页头/卡片/业务状态 | PageHeader；本轮详情/SkillHub 采用共享页头 | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/clients/:id/edit | ki / mcp / /ki/mcp/clients | src/pages/mcp/McpClientPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/permissions | ki / mcp / /ki/mcp/permissions | src/pages/mcp/McpPermissionsPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/permissions/rules | ki / mcp / /ki/mcp/permissions | src/pages/mcp/PermissionRulePage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/policies | ki / mcp / /ki/mcp/policies | src/pages/mcp/PolicyManagementPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/matrix | ki / mcp / /ki/mcp/policies | src/pages/mcp/PolicyManagementPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/audit | ki / mcp / /ki/mcp/audit | src/pages/mcp/McpAuditPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/audit/detail/:id | ki / mcp / /ki/mcp/audit | src/pages/mcp/AuditDetailPage.tsx | 共享页头/卡片/业务状态 | PageHeader；本轮详情/SkillHub 采用共享页头 | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/audit/stats | ki / mcp / /ki/mcp/audit/stats | src/pages/mcp/AuditStatisticsPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/mcp/connection-monitor | ki / mcp / /ki/mcp/connection-monitor | src/pages/mcp/ConnectionMonitorPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/a2a/external-agents | ki / a2a / /ki/a2a/external-agents | src/pages/mcp/ExternalAgentListPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/a2a/trusts | ki / a2a / /ki/a2a/trusts | src/pages/mcp/TrustManagementPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/a2a/internal-agents | ki / a2a / /ki/a2a/internal-agents | src/pages/mcp/A2aInternalAgentsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ki/a2a/a2a-guide | ki / a2a / /ki/a2a/a2a-guide | src/pages/mcp/A2aIntegrationGuidePage.tsx | 共享页头/卡片/业务状态 | PageHeader | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/business | gov / business / /gov/business | src/pages/arch/BusinessArchPage.tsx | 能力树 / 地图 / 详情 | PageHeader/SplitPane/DataTablePro/EmptyState；保留既有能力操作 | HTTP 503 四宽失败状态浏览器；源码模式核对 |
| /gov/business/capabilities | gov / business / /gov/business/capabilities | src/pages/arch/CapabilityManagementPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail, SplitPane | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/business/applications | gov / business / /gov/business/applications | src/pages/arch/ApplicationManagementPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/business/value-streams | gov / business / /gov/business/value-streams | src/pages/arch/ValueStreamPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/business/processes | gov / business / /gov/business/processes | src/pages/arch/BusinessProcessPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/business/org-roles | gov / business / /gov/business/org-roles | src/pages/arch/OrgRolePage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail, SplitPane | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/data | gov / data / /gov/data | src/pages/arch/DataArchPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/data/entities/:id | gov / data / /gov/data | src/pages/arch/DataEntityDetailPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/data/flows | gov / data / /gov/data/flows | src/pages/arch/DataFlowPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/data/standards | gov / data / /gov/data/standards | src/pages/arch/DataStandardPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/data/assets | gov / data / /gov/data/assets | src/pages/arch/DataAssetCatalogPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail, SplitPane | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/tech | gov / tech / /gov/tech | src/pages/arch/TechArchPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/tech/components | gov / tech / /gov/tech/components | src/pages/arch/TechComponentPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/tech/stacks | gov / tech / /gov/tech/stacks | src/pages/arch/TechStackPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/tech/topologies | gov / tech / /gov/tech/topologies | src/pages/arch/DeploymentTopologyPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/tech/radar | gov / tech / /gov/tech/radar | src/pages/arch/TechRadarPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/governance | gov / governance / /gov/governance | src/pages/arch/PrinciplesPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/governance/principles | gov / governance / /gov/governance/principles | src/pages/arch/PrinciplesPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/governance/reviews | gov / governance / /gov/governance/reviews | src/pages/arch/ReviewPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/governance/review-templates | gov / governance / /gov/governance/review-templates | src/pages/arch/ReviewTemplatePage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/governance/tech-debt | gov / governance / /gov/governance/tech-debt | src/pages/arch/TechDebtPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /gov/governance/ontology-mapping | gov / governance / /gov/governance/ontology-mapping | src/pages/arch/OntologyMappingPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/org/users | gov / org / /admin/org/users | src/pages/dashboard/admin/UsersPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/org/roles | gov / org / /admin/org/roles | src/pages/dashboard/admin/PermissionsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/org/tenants | gov / org / /admin/org/tenants | src/pages/dashboard/admin/OrgsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail, SplitPane | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/platform/configs | gov / platform / /admin/platform/configs | src/pages/dashboard/admin/ConfigsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/platform/ai-providers | gov / platform / /admin/platform/ai-providers | src/pages/dashboard/admin/AIProvidersPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/platform/components | gov / platform / /admin/platform/components | src/routes/demo/index.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/ops/logs | gov / ops / /admin/ops/logs | src/pages/dashboard/admin/LogsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/ops/operations | gov / ops / /admin/ops/operations | src/pages/dashboard/admin/OperationsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/ops/analytics | gov / ops / /admin/ops/analytics | src/pages/dashboard/admin/AnalyticsPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /admin/flowgram | gov / platform / /admin/flowgram | src/pages/dashboard/admin/FlowgramDemoPage.tsx | 显式演示画布 | __AdminLayout 的 PageHeader + FlowRunner 局部画布 | 共享页头源码核对；演示不登记为真实执行 |
| /admin/demo | gov / platform / /admin/platform/components | src/routes/demo/index.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState, SheetDetail | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology | ontology / overview / /ontology | src/routes/ontology.tsx → src/pages/ontology/overview/OverviewPage.tsx | 建设总览 / 读取阻断 / 下一步 | OntologyIndexRoute：无 tab 渲染总览；旧 tab 转发；PageHeader + 真实计数/读失败/继续建设卡片 | 失败状态单元 + 真实 IA 总览路由 |
| /ontology/model/object-types | ontology / model / /ontology/model/object-types | src/pages/ontology/model/object-types/ObjectTypesPage.tsx | 完整模型目录 / 编辑器 / WIP | PageHeader + OntologyModelingPage/ObjectTypeEditorV2Drawer；保留真实新建与属性编辑 | 真实签名 UI 保存唯一 WIP、完整请求与服务端回读；模型编辑单元 |
| /ontology/model/object-types/:rid | ontology / model / /ontology/model/object-types | src/pages/ontology/model/object-types/ObjectTypeDetailPage.tsx | 资源详情 / 局部页签 | ResourceDetailLayout 的共享 PageHeader + 既有详情操作 | 详情源码模式复用；对象详情真实浏览器/单元代表 |
| /ontology/model/object-types/:rid/:tab | ontology / model / /ontology/model/object-types | src/pages/ontology/model/object-types/ObjectTypeDetailPage.tsx | 资源详情 / 局部页签 | ResourceDetailLayout 的共享 PageHeader + 既有详情操作 | 详情源码模式复用；对象详情真实浏览器/单元代表 |
| /ontology/model/link-types | ontology / model / /ontology/model/link-types | src/pages/ontology/model/link-types/LinkTypesPage.tsx | 基元清单 | KernelPrimitiveListPage 的 PageHeader/FilterBar/DataTablePro/EmptyState | 真实 IA 路由浏览器代表 + 源码复用 |
| /ontology/model/interfaces | ontology / model / /ontology/model/interfaces | src/pages/ontology/model/interfaces/InterfacesPage.tsx | 基元清单 | KernelPrimitiveListPage 的 PageHeader/FilterBar/DataTablePro/EmptyState | 真实 IA 路由浏览器代表 + 源码复用 |
| /ontology/model/axioms | ontology / model / /ontology/model/axioms | src/pages/ontology/model/axioms/AxiomsPage.tsx | 基元清单 | KernelPrimitiveListPage 的 PageHeader/FilterBar/DataTablePro/EmptyState | 真实 IA 路由浏览器代表 + 源码复用 |
| /ontology/model/graph | ontology / model / /ontology/model/graph | src/pages/ontology/model/graph/OntologyGraphPage.tsx | 模型树 / 画布 / Inspector | OntologyGraphView、ModelResourceTree/GraphCanvas/Inspector | 真实 Ont 选择/深链浏览器 + 模型工作台单元 |
| /ontology/model/validation | ontology / operations / /ontology/model/validation | src/pages/ontology/model/validation/ModelValidationPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/data/mappings | ontology / data / /ontology/data/mappings | src/pages/ontology/data/mappings/ObjectMappingsPage.tsx | 来源声明 / 字段映射 / 独立物化 | PageHeader + SourceMappingEditor/BackingDatasourcePanel/MaterializationSamples | 真实签名 UI 保存完整 RID 映射、回读、同步与 PG 样本；四宽代表 |
| /ontology/data/sync | ontology / operations / /ontology/data/sync | src/pages/ontology/data/sync/SyncJobsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/data/lineage | ontology / data / /ontology/data/lineage | src/pages/ontology/data/lineage/OntologyLineagePage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/explore/objects/:rid? | explore / explore / /ontology/explore/objects | src/pages/ontology/explorer/ObjectExplorerPage.tsx | 对象消费两栏 / 动作抽屉 | PageHeader/SplitPane/DataTablePro/SheetDetail/Proposal | 真实同步后两条对象与完整属性查询；真实 IA 与四宽浏览；必需 core 门禁另记 |
| /ontology/explore/analysis | explore / explore / /ontology/explore/analysis | src/pages/ontology/AnalysisPage.tsx | 分析画布 | PageHeader + 既有类型/属性/聚合/SVG 图表 | 新增共享页头；保留聚合与 Pin；源码模式核对 |
| /ontology/explore/map | explore / explore / /ontology/explore/map | src/pages/ontology/MapPage.tsx | 地图画布 | PageHeader + 既有地理类型/实例/视口 | 新增共享页头；保留地图操作；源码模式核对 |
| /ontology/explore/objectset | explore / explore / /ontology/explore/objectset | src/pages/ontology/explore/objectset/ObjectSetBuilderPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/logic/actions | ontology / logic / /ontology/logic/actions | src/pages/ontology/logic/actions/ActionTypesPage.tsx | 基元清单 | KernelPrimitiveListPage 的 PageHeader/FilterBar/DataTablePro/EmptyState | 真实 IA 路由浏览器代表 + 源码复用 |
| /ontology/logic/actions/:rid | ontology / logic / /ontology/logic/actions | src/pages/ontology/logic/actions/ActionTypeDetailPage.tsx | 资源详情 / 局部页签 | ResourceDetailLayout 的共享 PageHeader + 既有详情操作 | 详情源码模式复用；对象详情真实浏览器/单元代表 |
| /ontology/logic/actions/:rid/:tab | ontology / logic / /ontology/logic/actions | src/pages/ontology/logic/actions/ActionTypeDetailPage.tsx | 资源详情 / 局部页签 | ResourceDetailLayout 的共享 PageHeader + 既有详情操作 | 详情源码模式复用；对象详情真实浏览器/单元代表 |
| /ontology/logic/functions | ontology / logic / /ontology/logic/functions | src/pages/ontology/logic/functions/FunctionsPage.tsx | 基元清单 | KernelPrimitiveListPage 的 PageHeader/FilterBar/DataTablePro/EmptyState | 真实 IA 路由浏览器代表 + 源码复用 |
| /ontology/logic/functions/:rid | ontology / logic / /ontology/logic/functions | src/pages/ontology/logic/functions/FunctionDetailPage.tsx | 资源详情 / 局部页签 | ResourceDetailLayout 的共享 PageHeader + 既有详情操作 | 详情源码模式复用；对象详情真实浏览器/单元代表 |
| /ontology/logic/functions/:rid/:tab | ontology / logic / /ontology/logic/functions | src/pages/ontology/logic/functions/FunctionDetailPage.tsx | 资源详情 / 局部页签 | ResourceDetailLayout 的共享 PageHeader + 既有详情操作 | 详情源码模式复用；对象详情真实浏览器/单元代表 |
| /ontology/logic/designer | ontology / logic / /ontology/logic/designer | src/pages/ontology/logic/designer/ActionDesignerPage.tsx | 动作资源 / 编排画布 | 既有资源选择、详情与全屏 Flowgram；局部容器滚动 | 命名源码核对；未宣称执行历史已接入 |
| /ontology/logic/runs | ontology / operations / /ontology/logic/runs | src/pages/ontology/logic/runs/ActionRunsPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, FilterBar, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/governance/drafts | ontology / governance / /ontology/governance/drafts | src/pages/ontology/governance/drafts/DraftsPage.tsx | 草稿 / 五步发布 | PageHeader + SchemaWipCard 五步审阅/校验/影响/确认/结果 | 真实签名 UI 校验、GET404 验证新目标、确认 apply、校验和与当前发布历史 |
| /ontology/governance/releases | ontology / governance / /ontology/governance/releases | src/pages/ontology/governance/releases/ReleasesPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/governance/usage | ontology / operations / /ontology/governance/usage | src/pages/ontology/governance/usage/UsagePage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/governance/security | gov / security / /ontology/governance/security | src/pages/ontology/governance/security/SecurityPage.tsx | 共享页头/卡片/业务状态 | PageHeader | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/governance/import-export | ontology / governance / /ontology/governance/import-export | src/pages/ontology/governance/import-export/ImportExportPage.tsx | 共享页头/卡片/业务状态 | PageHeader, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /ontology/governance/audit | ontology / operations / /ontology/governance/audit | src/pages/ontology/governance/audit/AuditPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
| /apps/mine | apps / apps / /apps/mine | src/pages/apphub/ApphubShellPage.tsx | 目录 / 资源详情 / 局部设计画布 | AppListPage、资源子页 PageHeader；15 个按 query 分发子页 | HTTP 边界目录浏览器；其余子页源码模式核对 |
| /apps/market | apps / apps / /apps/market | src/pages/apphub/ApphubShellPage.tsx | 目录 / 资源详情 / 局部设计画布 | AppListPage、资源子页 PageHeader；15 个按 query 分发子页 | HTTP 边界目录浏览器；其余子页源码模式核对 |
| /apps/templates | apps / apps / /apps/templates | src/pages/apphub/ApphubShellPage.tsx | 目录 / 资源详情 / 局部设计画布 | AppListPage、资源子页 PageHeader；15 个按 query 分发子页 | HTTP 边界目录浏览器；其余子页源码模式核对 |
| /apps/designer | apps / apps / /apps/designer | src/pages/apphub/ApphubShellPage.tsx | 目录 / 资源详情 / 局部设计画布 | AppListPage、资源子页 PageHeader；15 个按 query 分发子页 | HTTP 边界目录浏览器；其余子页源码模式核对 |
| /apps/order-review | apps / apps / /apps/order-review | src/pages/superai/OrderReviewPage.tsx | 共享资源清单/状态 | PageHeader, DataTablePro, EmptyState | 当前源模式核对；共享样式与代表浏览器继承 |
