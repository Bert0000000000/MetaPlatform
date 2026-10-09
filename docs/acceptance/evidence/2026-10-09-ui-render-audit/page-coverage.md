# 页面检查清单

来源为当前前端路由和页面源码。每行有 1440 px、390 px 两次最终观察；原始历史失败仍保留在 JSONL 中。

“稳定”表示当前页面或前景抽屉已结束加载、没有全局渲染错误、文档横向溢出或未包含在滚动容器中的越界控件。HTTP 403/404 会单列，不能据此宣称接口全部成功。

| 类型 | 路由 / 实际上下文 | 源码 | 1440 px | 390 px | 最终记录中的 HTTP 错误 |
| --- | --- | --- | --- | --- | --- |
| 静态 | `/home` | `src/pages/dashboard/DashboardPage.tsx` | 稳定 [02:14:17 UTC](completion-1440.jsonl#L1) | 稳定 [02:26:36 UTC](completion-390.jsonl#L1) | 未记录错误响应 |
| 静态 | `/home/todos` | `src/pages/dashboard/NotificationsPage.tsx` | 稳定 [02:14:18 UTC](completion-1440.jsonl#L2) | 稳定 [02:26:38 UTC](completion-390.jsonl#L2) | 未记录错误响应 |
| 静态 | `/home/messages` | `src/pages/dashboard/MessagesPage.tsx` | 稳定 [02:14:20 UTC](completion-1440.jsonl#L3) | 稳定 [02:26:39 UTC](completion-390.jsonl#L3) | 未记录错误响应 |
| 静态 | `/home/deliverables` | `src/pages/dashboard/DeliverablesPage.tsx` | 稳定 [02:14:22 UTC](completion-1440.jsonl#L4) | 稳定 [02:26:41 UTC](completion-390.jsonl#L4) | 未记录错误响应 |
| 静态 | `/home/apps` | `src/pages/dashboard/MyAppsPage.tsx` | 稳定 [02:14:23 UTC](completion-1440.jsonl#L5) | 稳定 [02:26:42 UTC](completion-390.jsonl#L5) | 未记录错误响应 |
| 静态 | `/home/me` | `src/pages/dashboard/SettingsPage.tsx` | 稳定 [02:14:25 UTC](completion-1440.jsonl#L6) | 稳定 [02:26:44 UTC](completion-390.jsonl#L6) | 未记录错误响应 |
| 静态 | `/home/portal` | `src/pages/dashboard/PortalPage.tsx` | 稳定 [02:14:26 UTC](completion-1440.jsonl#L7) | 稳定 [02:26:45 UTC](completion-390.jsonl#L7) | 未记录错误响应 |
| 静态 | `/home/aiops` | `src/pages/dashboard/AiOpsPage.tsx` | 稳定 [02:14:27 UTC](completion-1440.jsonl#L8) | 稳定 [02:26:46 UTC](completion-390.jsonl#L8) | 未记录错误响应 |
| 静态 | `/agents` | `src/pages/agents/EmployeeListPage.tsx` | 稳定 [02:14:29 UTC](completion-1440.jsonl#L9) | 稳定 [02:26:48 UTC](completion-390.jsonl#L9) | 403 /api/v1/admin/ai/models |
| 静态 | `/agents/create` | `src/pages/agents/EmployeeCreatePage.tsx` | 稳定 [02:14:30 UTC](completion-1440.jsonl#L10) | 稳定 [02:26:49 UTC](completion-390.jsonl#L10) | 403 /api/v1/admin/ai/models |
| 静态 | `/agents/external` | `src/pages/agents/ExternalAgentsPage.tsx` | 稳定 [02:14:32 UTC](completion-1440.jsonl#L11) | 稳定 [02:26:50 UTC](completion-390.jsonl#L11) | 未记录错误响应 |
| 静态 | `/agents/tasks` | `src/pages/agents/TaskListPage.tsx` | 稳定 [02:14:33 UTC](completion-1440.jsonl#L12) | 稳定 [02:26:52 UTC](completion-390.jsonl#L12) | 未记录错误响应 |
| 静态 | `/agents/collab` | `src/pages/agents/CollaborationListPage.tsx` | 稳定 [02:14:35 UTC](completion-1440.jsonl#L13) | 稳定 [02:26:53 UTC](completion-390.jsonl#L13) | 未记录错误响应 |
| 静态 | `/agents/collab/create` | `src/pages/agents/CollaborationCreatePage.tsx` | 稳定 [02:14:36 UTC](completion-1440.jsonl#L14) | 稳定 [02:26:54 UTC](completion-390.jsonl#L14) | 未记录错误响应 |
| 静态 | `/agents/evaluation` | `src/pages/agents/EvaluationPage.tsx` | 稳定 [02:14:38 UTC](completion-1440.jsonl#L15) | 稳定 [02:26:56 UTC](completion-390.jsonl#L15) | 未记录错误响应 |
| 静态 | `/agents/documents` | `src/pages/dw/DocumentsPage.tsx` | 稳定 [02:14:39 UTC](completion-1440.jsonl#L16) | 稳定 [02:26:57 UTC](completion-390.jsonl#L16) | 未记录错误响应 |
| 静态 | `/agents/employees` | `src/pages/dw/EmployeesPage.tsx` | 稳定 [02:14:41 UTC](completion-1440.jsonl#L17) | 稳定 [02:26:58 UTC](completion-390.jsonl#L17) | 未记录错误响应 |
| 静态 | `/agents/dw-tasks` | `src/pages/dw/TasksPage.tsx` | 稳定 [02:14:42 UTC](completion-1440.jsonl#L18) | 稳定 [02:26:59 UTC](completion-390.jsonl#L18) | 未记录错误响应 |
| 静态 | `/agents/dw-collaborations` | `src/pages/dw/CollaborationsPage.tsx` | 稳定 [02:15:04 UTC](completion-1440.jsonl#L19) | 稳定 [02:27:06 UTC](completion-390.jsonl#L19) | 未记录错误响应 |
| 静态 | `/agents/dw-evaluations` | `src/pages/dw/EvaluationsPage.tsx` | 稳定 [02:15:05 UTC](completion-1440.jsonl#L20) | 稳定 [02:27:07 UTC](completion-390.jsonl#L20) | 未记录错误响应 |
| 静态 | `/agents/learning` | `src/pages/dw/LearningPage.tsx` | 稳定 [02:15:06 UTC](completion-1440.jsonl#L21) | 稳定 [02:27:08 UTC](completion-390.jsonl#L21) | 未记录错误响应 |
| 静态 | `/agents/extraction` | `src/pages/dw/ExtractionPage.tsx` | 稳定 [02:15:08 UTC](completion-1440.jsonl#L22) | 稳定 [02:27:10 UTC](completion-390.jsonl#L22) | 未记录错误响应 |
| 静态 | `/agents/obs` | `src/pages/dw/ObsPage.tsx` | 稳定 [02:15:09 UTC](completion-1440.jsonl#L23) | 稳定 [02:27:11 UTC](completion-390.jsonl#L23) | 未记录错误响应 |
| 静态 | `/superai/chat` | `src/pages/superai/ChatPage.tsx` | 稳定 [02:15:10 UTC](completion-1440.jsonl#L24) | 稳定 [02:27:12 UTC](completion-390.jsonl#L24) | 未记录错误响应 |
| 静态 | `/superai/plans` | `src/pages/superai/ExecutionPlanPage.tsx` | 稳定 [02:15:12 UTC](completion-1440.jsonl#L25) | 稳定 [02:27:14 UTC](completion-390.jsonl#L25) | 未记录错误响应 |
| 静态 | `/superai/plans/a2a` | `src/pages/superai/A2ACollaborationPage.tsx` | 稳定 [02:15:13 UTC](completion-1440.jsonl#L26) | 稳定 [02:27:15 UTC](completion-390.jsonl#L26) | 未记录错误响应 |
| 静态 | `/superai/plans/orchestration` | `src/pages/superai/OrchestrationConsolePage.tsx` | 稳定 [02:15:15 UTC](completion-1440.jsonl#L27) | 稳定 [02:27:16 UTC](completion-390.jsonl#L27) | 404 /api/v1/orchestrator/sessions/emp-console-1/evolution |
| 静态 | `/superai/plans/manual-select` | `src/pages/superai/ManualSelectEmployeePage.tsx` | 稳定 [02:15:16 UTC](completion-1440.jsonl#L28) | 稳定 [02:27:18 UTC](completion-390.jsonl#L28) | 未记录错误响应 |
| 静态 | `/superai/plans/parallel` | `src/pages/superai/ParallelExecutionPage.tsx` | 稳定 [02:15:17 UTC](completion-1440.jsonl#L29) | 稳定 [02:27:19 UTC](completion-390.jsonl#L29) | 未记录错误响应 |
| 静态 | `/superai/plans/result-aggregation` | `src/pages/superai/ResultAggregationPage.tsx` | 稳定 [02:15:18 UTC](completion-1440.jsonl#L30) | 稳定 [02:27:20 UTC](completion-390.jsonl#L30) | 未记录错误响应 |
| 静态 | `/superai/plans/result-summary` | `src/pages/superai/ResultSummaryPage.tsx` | 稳定 [02:15:19 UTC](completion-1440.jsonl#L31) | 稳定 [02:27:21 UTC](completion-390.jsonl#L31) | 未记录错误响应 |
| 静态 | `/superai/plans/employee-match` | `src/pages/superai/EmployeeMatchingPage.tsx` | 稳定 [02:15:20 UTC](completion-1440.jsonl#L32) | 稳定 [02:27:22 UTC](completion-390.jsonl#L32) | 未记录错误响应 |
| 静态 | `/superai/schedules` | `src/pages/superai/ScheduleIntentPage.tsx` | 稳定 [02:15:21 UTC](completion-1440.jsonl#L33) | 稳定 [02:27:23 UTC](completion-390.jsonl#L33) | 未记录错误响应 |
| 静态 | `/superai/schedules/execute` | `src/pages/superai/ScheduleExecutionPage.tsx` | 稳定 [02:15:22 UTC](completion-1440.jsonl#L34) | 稳定 [02:27:24 UTC](completion-390.jsonl#L34) | 未记录错误响应 |
| 静态 | `/superai/schedules/plan` | `src/pages/superai/SchedulePlanCardPage.tsx` | 稳定 [02:15:23 UTC](completion-1440.jsonl#L35) | 稳定 [02:27:25 UTC](completion-390.jsonl#L35) | 未记录错误响应 |
| 静态 | `/superai/cost` | `src/pages/superai/CostOptimizationPage.tsx` | 稳定 [02:15:24 UTC](completion-1440.jsonl#L36) | 稳定 [02:27:26 UTC](completion-390.jsonl#L36) | 未记录错误响应 |
| 静态 | `/superai/cost/data` | `src/pages/superai/DataAnalysisPage.tsx` | 稳定 [02:16:18 UTC](completion-1440.jsonl#L37) | 稳定 [02:28:44 UTC](completion-390.jsonl#L37) | 未记录错误响应 |
| 静态 | `/superai/cost/report` | `src/pages/superai/ReportExportPage.tsx` | 稳定 [02:16:19 UTC](completion-1440.jsonl#L38) | 稳定 [02:28:45 UTC](completion-390.jsonl#L38) | 未记录错误响应 |
| 静态 | `/superai/templates` | `src/pages/superai/TaskTemplatePage.tsx` | 稳定 [02:16:23 UTC](completion-1440.jsonl#L39) | 稳定 [02:28:46 UTC](completion-390.jsonl#L39) | 未记录错误响应 |
| 静态 | `/superai/team` | `src/pages/superai/AgentTeamRunPage.tsx` | 稳定 [02:16:25 UTC](completion-1440.jsonl#L40) | 稳定 [02:28:48 UTC](completion-390.jsonl#L40) | 未记录错误响应 |
| 静态 | `/ki/kb` | `src/pages/knowledge/KnowledgeBasePage.tsx` | 稳定 [02:16:26 UTC](completion-1440.jsonl#L41) | 稳定 [02:28:49 UTC](completion-390.jsonl#L41) | 未记录错误响应 |
| 静态 | `/ki/kb/docs` | `src/pages/knowledge/KnowledgeDocsPage.tsx` | 稳定 [02:16:27 UTC](completion-1440.jsonl#L42) | 稳定 [02:28:51 UTC](completion-390.jsonl#L42) | 未记录错误响应 |
| 静态 | `/ki/kb/config` | `src/pages/knowledge/KnowledgeConfigPage.tsx` | 稳定 [02:16:28 UTC](completion-1440.jsonl#L43) | 稳定 [02:28:53 UTC](completion-390.jsonl#L43) | 未记录错误响应 |
| 静态 | `/ki/kb/test` | `src/pages/knowledge/KnowledgeTestPage.tsx` | 稳定 [02:16:29 UTC](completion-1440.jsonl#L44) | 稳定 [02:28:54 UTC](completion-390.jsonl#L44) | 未记录错误响应 |
| 静态 | `/ki/test` | `src/pages/knowledge/KnowledgeTestPage.tsx` | 稳定 [02:16:30 UTC](completion-1440.jsonl#L45) | 稳定 [02:28:55 UTC](completion-390.jsonl#L45) | 未记录错误响应 |
| 静态 | `/ki/mcp/overview` | `src/pages/mcp/OverviewPage.tsx` | 稳定 [02:16:31 UTC](completion-1440.jsonl#L46) | 稳定 [02:29:01 UTC](completion-390.jsonl#L46) | 未记录错误响应 |
| 静态 | `/ki/mcp/skill-hub` | `src/pages/mcp/SkillHubPage.tsx` | 稳定 [02:16:32 UTC](completion-1440.jsonl#L47) | 稳定 [02:29:08 UTC](completion-390.jsonl#L47) | 未记录错误响应 |
| 静态 | `/ki/mcp/tools` | `src/pages/mcp/McpToolsPage.tsx` | 稳定 [02:16:34 UTC](completion-1440.jsonl#L48) | 稳定 [02:29:19 UTC](completion-390.jsonl#L48) | 未记录错误响应 |
| 静态 | `/ki/mcp/tools/new` | `src/pages/mcp/McpToolsPage.tsx` | 稳定 [02:16:35 UTC](completion-1440.jsonl#L49) | 稳定 [03:04:23 UTC](completion-390.jsonl#L131) | 未记录错误响应 |
| 静态 | `/ki/mcp/resources` | `src/pages/mcp/ResourceListPage.tsx` | 稳定 [02:16:36 UTC](completion-1440.jsonl#L50) | 稳定 [02:29:37 UTC](completion-390.jsonl#L50) | 未记录错误响应 |
| 静态 | `/ki/mcp/resources/new` | `src/pages/mcp/ResourceListPage.tsx` | 稳定 [02:16:37 UTC](completion-1440.jsonl#L51) | 稳定 [02:30:52 UTC](completion-390.jsonl#L51) | 未记录错误响应 |
| 静态 | `/ki/mcp/prompts` | `src/pages/mcp/PromptTemplatePage.tsx` | 稳定 [02:16:38 UTC](completion-1440.jsonl#L52) | 稳定 [02:32:49 UTC](completion-390.jsonl#L52) | 未记录错误响应 |
| 静态 | `/ki/mcp/debugger` | `src/pages/mcp/McpDebuggerPage.tsx` | 稳定 [02:16:39 UTC](completion-1440.jsonl#L53) | 稳定 [02:32:56 UTC](completion-390.jsonl#L53) | 未记录错误响应 |
| 静态 | `/ki/mcp/ide-config` | `src/pages/mcp/IdeConfigPage.tsx` | 稳定 [02:16:41 UTC](completion-1440.jsonl#L54) | 稳定 [02:33:03 UTC](completion-390.jsonl#L54) | 未记录错误响应 |
| 静态 | `/ki/mcp/servers` | `src/pages/mcp/McpServerPage.tsx` | 稳定 [02:16:49 UTC](completion-1440.jsonl#L55) | 稳定 [02:33:14 UTC](completion-390.jsonl#L55) | 未记录错误响应 |
| 静态 | `/ki/mcp/servers/new` | `src/pages/mcp/McpServerPage.tsx` | 稳定 [02:16:50 UTC](completion-1440.jsonl#L56) | 稳定 [02:33:26 UTC](completion-390.jsonl#L56) | 未记录错误响应 |
| 静态 | `/ki/mcp/clients` | `src/pages/mcp/McpClientPage.tsx` | 稳定 [02:16:51 UTC](completion-1440.jsonl#L57) | 稳定 [02:33:32 UTC](completion-390.jsonl#L57) | 未记录错误响应 |
| 静态 | `/ki/mcp/clients/new` | `src/pages/mcp/McpClientPage.tsx` | 稳定 [02:16:52 UTC](completion-1440.jsonl#L58) | 稳定 [02:33:38 UTC](completion-390.jsonl#L58) | 未记录错误响应 |
| 静态 | `/ki/mcp/permissions` | `src/pages/mcp/McpPermissionsPage.tsx` | 稳定 [02:16:53 UTC](completion-1440.jsonl#L59) | 稳定 [02:33:42 UTC](completion-390.jsonl#L59) | 未记录错误响应 |
| 静态 | `/ki/mcp/permissions/rules` | `src/pages/mcp/PermissionRulePage.tsx` | 稳定 [02:16:55 UTC](completion-1440.jsonl#L60) | 稳定 [02:40:03 UTC](completion-390.jsonl#L62) | 未记录错误响应 |
| 静态 | `/ki/mcp/policies` | `src/pages/mcp/PolicyManagementPage.tsx` | 稳定 [02:16:56 UTC](completion-1440.jsonl#L61) | 稳定 [02:40:09 UTC](completion-390.jsonl#L63) | 未记录错误响应 |
| 静态 | `/ki/mcp/matrix` | `src/pages/mcp/PolicyManagementPage.tsx` | 稳定 [02:16:57 UTC](completion-1440.jsonl#L62) | 稳定 [02:40:16 UTC](completion-390.jsonl#L64) | 未记录错误响应 |
| 静态 | `/ki/mcp/audit` | `src/pages/mcp/McpAuditPage.tsx` | 稳定 [02:16:58 UTC](completion-1440.jsonl#L63) | 稳定 [02:40:22 UTC](completion-390.jsonl#L65) | 未记录错误响应 |
| 静态 | `/ki/mcp/audit/stats` | `src/pages/mcp/AuditStatisticsPage.tsx` | 稳定 [03:01:13 UTC](completion-1440.jsonl#L132) | 稳定 [02:39:57 UTC](completion-390.jsonl#L61) | 未记录错误响应 |
| 静态 | `/ki/mcp/connection-monitor` | `src/pages/mcp/ConnectionMonitorPage.tsx` | 稳定 [02:17:05 UTC](completion-1440.jsonl#L65) | 稳定 [02:40:28 UTC](completion-390.jsonl#L66) | 未记录错误响应 |
| 静态 | `/ki/a2a/external-agents` | `src/pages/mcp/ExternalAgentListPage.tsx` | 稳定 [02:17:06 UTC](completion-1440.jsonl#L66) | 稳定 [02:40:35 UTC](completion-390.jsonl#L67) | 未记录错误响应 |
| 静态 | `/ki/a2a/trusts` | `src/pages/mcp/TrustManagementPage.tsx` | 稳定 [02:17:07 UTC](completion-1440.jsonl#L67) | 稳定 [02:40:41 UTC](completion-390.jsonl#L68) | 未记录错误响应 |
| 静态 | `/ki/a2a/internal-agents` | `src/pages/mcp/A2aInternalAgentsPage.tsx` | 稳定 [02:17:08 UTC](completion-1440.jsonl#L68) | 稳定 [02:40:47 UTC](completion-390.jsonl#L69) | 未记录错误响应 |
| 静态 | `/ki/a2a/a2a-guide` | `src/pages/mcp/A2aIntegrationGuidePage.tsx` | 稳定 [02:17:09 UTC](completion-1440.jsonl#L69) | 稳定 [02:43:07 UTC](completion-390.jsonl#L70) | 未记录错误响应 |
| 静态 | `/gov/business` | `src/pages/arch/BusinessArchPage.tsx` | 稳定 [03:02:01 UTC](completion-1440.jsonl#L133) | 稳定 [02:43:09 UTC](completion-390.jsonl#L71) | 未记录错误响应 |
| 静态 | `/gov/business/capabilities` | `src/pages/arch/CapabilityManagementPage.tsx` | 稳定 [02:17:12 UTC](completion-1440.jsonl#L71) | 稳定 [02:43:10 UTC](completion-390.jsonl#L72) | 未记录错误响应 |
| 静态 | `/gov/business/applications` | `src/pages/arch/ApplicationManagementPage.tsx` | 稳定 [02:17:14 UTC](completion-1440.jsonl#L72) | 稳定 [02:43:11 UTC](completion-390.jsonl#L73) | 未记录错误响应 |
| 静态 | `/gov/business/value-streams` | `src/pages/arch/ValueStreamPage.tsx` | 稳定 [02:19:54 UTC](completion-1440.jsonl#L73) | 稳定 [02:43:12 UTC](completion-390.jsonl#L74) | 未记录错误响应 |
| 静态 | `/gov/business/processes` | `src/pages/arch/BusinessProcessPage.tsx` | 稳定 [02:19:56 UTC](completion-1440.jsonl#L74) | 稳定 [02:43:13 UTC](completion-390.jsonl#L75) | 未记录错误响应 |
| 静态 | `/gov/business/org-roles` | `src/pages/arch/OrgRolePage.tsx` | 稳定 [02:19:57 UTC](completion-1440.jsonl#L75) | 稳定 [02:43:15 UTC](completion-390.jsonl#L76) | 未记录错误响应 |
| 静态 | `/gov/data` | `src/pages/arch/DataArchPage.tsx` | 稳定 [02:19:59 UTC](completion-1440.jsonl#L76) | 稳定 [02:43:16 UTC](completion-390.jsonl#L77) | 未记录错误响应 |
| 静态 | `/gov/data/flows` | `src/pages/arch/DataFlowPage.tsx` | 稳定 [02:20:01 UTC](completion-1440.jsonl#L77) | 稳定 [02:43:17 UTC](completion-390.jsonl#L78) | 未记录错误响应 |
| 静态 | `/gov/data/standards` | `src/pages/arch/DataStandardPage.tsx` | 稳定 [02:20:02 UTC](completion-1440.jsonl#L78) | 稳定 [02:43:18 UTC](completion-390.jsonl#L79) | 未记录错误响应 |
| 静态 | `/gov/data/assets` | `src/pages/arch/DataAssetCatalogPage.tsx` | 稳定 [02:20:06 UTC](completion-1440.jsonl#L79) | 稳定 [02:43:20 UTC](completion-390.jsonl#L80) | 未记录错误响应 |
| 静态 | `/gov/tech` | `src/pages/arch/TechArchPage.tsx` | 稳定 [02:20:08 UTC](completion-1440.jsonl#L80) | 稳定 [02:43:22 UTC](completion-390.jsonl#L81) | 未记录错误响应 |
| 静态 | `/gov/tech/components` | `src/pages/arch/TechComponentPage.tsx` | 稳定 [02:20:09 UTC](completion-1440.jsonl#L81) | 稳定 [02:43:53 UTC](completion-390.jsonl#L82) | 未记录错误响应 |
| 静态 | `/gov/tech/stacks` | `src/pages/arch/TechStackPage.tsx` | 稳定 [02:20:11 UTC](completion-1440.jsonl#L82) | 稳定 [02:43:54 UTC](completion-390.jsonl#L83) | 未记录错误响应 |
| 静态 | `/gov/tech/topologies` | `src/pages/arch/DeploymentTopologyPage.tsx` | 稳定 [02:20:12 UTC](completion-1440.jsonl#L83) | 稳定 [02:43:55 UTC](completion-390.jsonl#L84) | 未记录错误响应 |
| 静态 | `/gov/tech/radar` | `src/pages/arch/TechRadarPage.tsx` | 稳定 [02:20:14 UTC](completion-1440.jsonl#L84) | 稳定 [02:43:57 UTC](completion-390.jsonl#L85) | 未记录错误响应 |
| 静态 | `/gov/governance` | `src/pages/arch/PrinciplesPage.tsx` | 稳定 [02:20:16 UTC](completion-1440.jsonl#L85) | 稳定 [02:43:59 UTC](completion-390.jsonl#L86) | 未记录错误响应 |
| 静态 | `/gov/governance/principles` | `src/pages/arch/PrinciplesPage.tsx` | 稳定 [02:20:17 UTC](completion-1440.jsonl#L86) | 稳定 [02:44:00 UTC](completion-390.jsonl#L87) | 未记录错误响应 |
| 静态 | `/gov/governance/reviews` | `src/pages/arch/ReviewPage.tsx` | 稳定 [02:20:19 UTC](completion-1440.jsonl#L87) | 稳定 [02:44:01 UTC](completion-390.jsonl#L88) | 未记录错误响应 |
| 静态 | `/gov/governance/review-templates` | `src/pages/arch/ReviewTemplatePage.tsx` | 稳定 [02:20:20 UTC](completion-1440.jsonl#L88) | 稳定 [02:44:02 UTC](completion-390.jsonl#L89) | 未记录错误响应 |
| 静态 | `/gov/governance/tech-debt` | `src/pages/arch/TechDebtPage.tsx` | 稳定 [02:20:22 UTC](completion-1440.jsonl#L89) | 稳定 [02:44:03 UTC](completion-390.jsonl#L90) | 未记录错误响应 |
| 静态 | `/gov/governance/ontology-mapping` | `src/pages/arch/OntologyMappingPage.tsx` | 稳定 [02:20:23 UTC](completion-1440.jsonl#L90) | 稳定 [02:44:04 UTC](completion-390.jsonl#L91) | 未记录错误响应 |
| 静态 | `/admin/org/users` | `src/pages/dashboard/admin/UsersPage.tsx` | 稳定 [02:21:34 UTC](completion-1440.jsonl#L91) | 稳定 [02:44:06 UTC](completion-390.jsonl#L92) | 403 /api/v1/admin/permissions/roles; 403 /api/v1/admin/users |
| 静态 | `/admin/org/roles` | `src/pages/dashboard/admin/PermissionsPage.tsx` | 稳定 [02:21:35 UTC](completion-1440.jsonl#L92) | 稳定 [02:44:07 UTC](completion-390.jsonl#L93) | 403 /api/v1/admin/permissions/catalog; 403 /api/v1/admin/permissions/matrix; 403 /api/v1/admin/permissions/roles |
| 静态 | `/admin/org/tenants` | `src/pages/dashboard/admin/OrgsPage.tsx` | 稳定 [02:21:37 UTC](completion-1440.jsonl#L93) | 稳定 [02:44:37 UTC](completion-390.jsonl#L94) | 403 /api/v1/admin/orgs; 403 /api/v1/admin/orgs/tree |
| 静态 | `/admin/platform/configs` | `src/pages/dashboard/admin/ConfigsPage.tsx` | 稳定 [02:21:38 UTC](completion-1440.jsonl#L94) | 稳定 [02:44:38 UTC](completion-390.jsonl#L95) | 403 /api/v1/admin/configs |
| 静态 | `/admin/platform/ai-providers` | `src/pages/dashboard/admin/AIProvidersPage.tsx` | 稳定 [02:21:40 UTC](completion-1440.jsonl#L95) | 稳定 [02:44:39 UTC](completion-390.jsonl#L96) | 403 /api/v1/admin/ai/models; 403 /api/v1/admin/configs |
| 静态 | `/admin/platform/components` | `src/routes/demo/index.tsx` | 稳定 [02:21:41 UTC](completion-1440.jsonl#L96) | 稳定 [02:44:40 UTC](completion-390.jsonl#L97) | 未记录错误响应 |
| 静态 | `/admin/ops/logs` | `src/pages/dashboard/admin/LogsPage.tsx` | 稳定 [02:21:43 UTC](completion-1440.jsonl#L97) | 稳定 [02:44:42 UTC](completion-390.jsonl#L98) | 403 /api/v1/admin/logs/audit; 403 /api/v1/admin/logs/modules |
| 静态 | `/admin/ops/operations` | `src/pages/dashboard/admin/OperationsPage.tsx` | 稳定 [02:21:47 UTC](completion-1440.jsonl#L98) | 稳定 [02:44:46 UTC](completion-390.jsonl#L99) | 未记录错误响应 |
| 静态 | `/admin/ops/analytics` | `src/pages/dashboard/admin/AnalyticsPage.tsx` | 稳定 [02:21:48 UTC](completion-1440.jsonl#L99) | 稳定 [02:44:47 UTC](completion-390.jsonl#L100) | 未记录错误响应 |
| 静态 | `/admin/flowgram` | `src/pages/dashboard/admin/FlowgramDemoPage.tsx` | 稳定 [02:21:52 UTC](completion-1440.jsonl#L100) | 稳定 [02:44:48 UTC](completion-390.jsonl#L101) | 未记录错误响应 |
| 静态 | `/admin/demo` | `src/routes/demo/index.tsx` | 稳定 [02:21:54 UTC](completion-1440.jsonl#L101) | 稳定 [02:44:49 UTC](completion-390.jsonl#L102) | 未记录错误响应 |
| 静态 | `/ontology` | `src/routes/ontology.tsx → src/pages/ontology/overview/OverviewPage.tsx` | 稳定 [02:24:43 UTC](completion-1440.jsonl#L103) | 稳定 [02:44:50 UTC](completion-390.jsonl#L103) | 未记录错误响应 |
| 静态 | `/ontology/model/object-types` | `src/pages/ontology/model/object-types/ObjectTypesPage.tsx` | 稳定 [02:24:44 UTC](completion-1440.jsonl#L104) | 稳定 [02:44:51 UTC](completion-390.jsonl#L104) | 未记录错误响应 |
| 静态 | `/ontology/model/link-types` | `src/pages/ontology/model/link-types/LinkTypesPage.tsx` | 稳定 [02:24:45 UTC](completion-1440.jsonl#L105) | 稳定 [02:44:52 UTC](completion-390.jsonl#L105) | 未记录错误响应 |
| 静态 | `/ontology/model/interfaces` | `src/pages/ontology/model/interfaces/InterfacesPage.tsx` | 稳定 [02:24:47 UTC](completion-1440.jsonl#L106) | 稳定 [02:44:58 UTC](completion-390.jsonl#L106) | 未记录错误响应 |
| 静态 | `/ontology/model/axioms` | `src/pages/ontology/model/axioms/AxiomsPage.tsx` | 稳定 [02:24:48 UTC](completion-1440.jsonl#L107) | 稳定 [02:44:59 UTC](completion-390.jsonl#L107) | 未记录错误响应 |
| 静态 | `/ontology/model/graph` | `src/pages/ontology/model/graph/OntologyGraphPage.tsx` | 稳定 [02:24:49 UTC](completion-1440.jsonl#L108) | 稳定 [02:45:00 UTC](completion-390.jsonl#L108) | 未记录错误响应 |
| 静态 | `/ontology/model/validation` | `src/pages/ontology/model/validation/ModelValidationPage.tsx` | 稳定 [02:24:50 UTC](completion-1440.jsonl#L109) | 稳定 [02:45:01 UTC](completion-390.jsonl#L109) | 未记录错误响应 |
| 静态 | `/ontology/data/mappings` | `src/pages/ontology/data/mappings/ObjectMappingsPage.tsx` | 稳定 [03:04:35 UTC](completion-1440.jsonl#L134) | 稳定 [02:45:02 UTC](completion-390.jsonl#L110) | 未记录错误响应 |
| 静态 | `/ontology/data/sync` | `src/pages/ontology/data/sync/SyncJobsPage.tsx` | 稳定 [02:24:52 UTC](completion-1440.jsonl#L111) | 稳定 [02:45:04 UTC](completion-390.jsonl#L111) | 未记录错误响应 |
| 静态 | `/ontology/data/lineage` | `src/pages/ontology/data/lineage/OntologyLineagePage.tsx` | 稳定 [02:24:53 UTC](completion-1440.jsonl#L112) | 稳定 [02:45:05 UTC](completion-390.jsonl#L112) | 未记录错误响应 |
| 静态 | `/ontology/explore/analysis` | `src/pages/ontology/AnalysisPage.tsx` | 稳定 [02:25:06 UTC](completion-1440.jsonl#L113) | 稳定 [02:45:06 UTC](completion-390.jsonl#L113) | 未记录错误响应 |
| 静态 | `/ontology/explore/map` | `src/pages/ontology/MapPage.tsx` | 稳定 [02:25:07 UTC](completion-1440.jsonl#L114) | 稳定 [02:45:07 UTC](completion-390.jsonl#L114) | 未记录错误响应 |
| 静态 | `/ontology/explore/objectset` | `src/pages/ontology/explore/objectset/ObjectSetBuilderPage.tsx` | 稳定 [02:25:09 UTC](completion-1440.jsonl#L115) | 稳定 [02:45:08 UTC](completion-390.jsonl#L115) | 未记录错误响应 |
| 静态 | `/ontology/logic/actions` | `src/pages/ontology/logic/actions/ActionTypesPage.tsx` | 稳定 [02:25:10 UTC](completion-1440.jsonl#L116) | 稳定 [02:45:13 UTC](completion-390.jsonl#L116) | 未记录错误响应 |
| 静态 | `/ontology/logic/functions` | `src/pages/ontology/logic/functions/FunctionsPage.tsx` | 稳定 [02:25:12 UTC](completion-1440.jsonl#L117) | 稳定 [02:45:14 UTC](completion-390.jsonl#L117) | 未记录错误响应 |
| 静态 | `/ontology/logic/designer` | `src/pages/ontology/logic/designer/ActionDesignerPage.tsx` | 稳定 [02:25:13 UTC](completion-1440.jsonl#L118) | 稳定 [02:45:32 UTC](completion-390.jsonl#L118) | 404 /api/v1/ont/v2/action-types/ont.tenant-default.act.core-e2e-tag.v1/flow |
| 静态 | `/ontology/logic/runs` | `src/pages/ontology/logic/runs/ActionRunsPage.tsx` | 稳定 [02:25:14 UTC](completion-1440.jsonl#L119) | 稳定 [02:45:33 UTC](completion-390.jsonl#L119) | 未记录错误响应 |
| 静态 | `/ontology/governance/drafts` | `src/pages/ontology/governance/drafts/DraftsPage.tsx` | 稳定 [02:25:15 UTC](completion-1440.jsonl#L120) | 稳定 [02:45:34 UTC](completion-390.jsonl#L120) | 未记录错误响应 |
| 静态 | `/ontology/governance/releases` | `src/pages/ontology/governance/releases/ReleasesPage.tsx` | 稳定 [02:25:16 UTC](completion-1440.jsonl#L121) | 稳定 [02:45:35 UTC](completion-390.jsonl#L121) | 未记录错误响应 |
| 静态 | `/ontology/governance/usage` | `src/pages/ontology/governance/usage/UsagePage.tsx` | 稳定 [02:25:17 UTC](completion-1440.jsonl#L122) | 稳定 [02:45:37 UTC](completion-390.jsonl#L122) | 未记录错误响应 |
| 静态 | `/ontology/governance/security` | `src/pages/ontology/governance/security/SecurityPage.tsx` | 稳定 [02:25:19 UTC](completion-1440.jsonl#L123) | 稳定 [02:45:40 UTC](completion-390.jsonl#L123) | 未记录错误响应 |
| 静态 | `/ontology/governance/import-export` | `src/pages/ontology/governance/import-export/ImportExportPage.tsx` | 稳定 [02:25:20 UTC](completion-1440.jsonl#L124) | 稳定 [02:45:41 UTC](completion-390.jsonl#L124) | 未记录错误响应 |
| 静态 | `/ontology/governance/audit` | `src/pages/ontology/governance/audit/AuditPage.tsx` | 稳定 [02:25:21 UTC](completion-1440.jsonl#L125) | 稳定 [02:45:45 UTC](completion-390.jsonl#L125) | 未记录错误响应 |
| 静态 | `/apps/mine` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:25:22 UTC](completion-1440.jsonl#L126) | 稳定 [02:45:46 UTC](completion-390.jsonl#L126) | 未记录错误响应 |
| 静态 | `/apps/market` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:25:23 UTC](completion-1440.jsonl#L127) | 稳定 [02:45:48 UTC](completion-390.jsonl#L127) | 未记录错误响应 |
| 静态 | `/apps/templates` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:25:25 UTC](completion-1440.jsonl#L128) | 稳定 [02:45:49 UTC](completion-390.jsonl#L128) | 未记录错误响应 |
| 静态 | `/apps/designer` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:25:25 UTC](completion-1440.jsonl#L129) | 稳定 [02:45:50 UTC](completion-390.jsonl#L129) | 未记录错误响应 |
| 静态 | `/apps/order-review` | `src/pages/superai/OrderReviewPage.tsx` | 稳定 [02:25:27 UTC](completion-1440.jsonl#L130) | 稳定 [02:45:51 UTC](completion-390.jsonl#L130) | 未记录错误响应 |
| 真实记录 | `/agents/tasks/:taskId → /agents/tasks/dw-task-1` | `src/pages/agents/TaskDetailPage.tsx` | 稳定 [01:53:00 UTC](contexts-1440.jsonl#L10) | 稳定 [02:02:30 UTC](contexts-390.jsonl#L1) | 404 /api/v1/dw/traces/dw-task-1 |
| 不存在状态 | `/agents/collab/:id → /agents/collab/ui-audit-absent-20261009` | `src/pages/agents/CollaborationMonitorPage.tsx` | 稳定 [01:53:04 UTC](contexts-1440.jsonl#L11) | 稳定 [02:02:32 UTC](contexts-390.jsonl#L2) | 404 /api/v1/dw/collaborations/ui-audit-absent-20261009 |
| 真实记录 | `/agents/:employeeId → /agents/dw-emp-default-3` | `src/pages/agents/EmployeeDetailPage.tsx` | 稳定 [03:00:53 UTC](context-1440.jsonl#L1) | 稳定 [03:01:24 UTC](context-390.jsonl#L1) | 未记录错误响应 |
| 真实记录 | `/agents/:employeeId/capabilities → /agents/dw-emp-default-3/capabilities` | `src/pages/agents/CapabilityConfigPage.tsx` | 稳定 [01:55:17 UTC](contexts-1440.jsonl#L15) | 稳定 [02:02:37 UTC](contexts-390.jsonl#L4) | 403 /api/v1/admin/ai/models |
| 不存在状态 | `/superai/plans/:definitionId → /superai/plans/ui-audit-absent-20261009` | `src/pages/wfe/ActionOrchestrationPage.tsx` | 稳定 [01:55:19 UTC](contexts-1440.jsonl#L16) | 稳定 [02:46:32 UTC](contexts-390.jsonl#L24) | 404 /api/v1/workflow-definitions/ui-audit-absent-20261009 |
| 真实记录 | `/ki/kb/:kbId → /ki/kb/kb-ops` | `src/pages/knowledge/KnowledgeKbDetailPage.tsx` | 稳定 [03:00:56 UTC](context-1440.jsonl#L2) | 稳定 [02:46:39 UTC](contexts-390.jsonl#L25) | 未记录错误响应 |
| 真实记录 | `/ki/mcp/tools/:id → /ki/mcp/tools/kb_search` | `src/pages/mcp/ToolDetailPage.tsx` | 稳定 [01:55:21 UTC](contexts-1440.jsonl#L18) | 稳定 [02:46:45 UTC](contexts-390.jsonl#L26) | 未记录错误响应 |
| 真实记录 | `/ki/mcp/tools/:id/edit → /ki/mcp/tools/kb_search/edit` | `src/pages/mcp/McpToolsPage.tsx` | 稳定 [01:55:23 UTC](contexts-1440.jsonl#L19) | 稳定 [03:04:20 UTC](context-390.jsonl#L2) | 未记录错误响应 |
| 未支持 | `/ki/mcp/resources/:id → /ki/mcp/resources/ui-audit-absent-20261009` | `src/pages/mcp/ResourceListPage.tsx` | 稳定 [02:01:39 UTC](contexts-1440.jsonl#L27) | 稳定 [02:47:03 UTC](contexts-390.jsonl#L28) | 未记录错误响应 |
| 真实记录 | `/ki/mcp/servers/:id → /ki/mcp/servers/srv-ontology-engine` | `src/pages/mcp/ServerDetailPage.tsx` | 稳定 [03:00:57 UTC](context-1440.jsonl#L3) | 稳定 [02:53:01 UTC](contexts-390.jsonl#L31) | 未记录错误响应 |
| 真实记录 | `/ki/mcp/servers/:id/edit → /ki/mcp/servers/srv-ontology-engine/edit` | `src/pages/mcp/McpServerPage.tsx` | 稳定 [03:01:07 UTC](context-1440.jsonl#L4) | 稳定 [02:53:08 UTC](contexts-390.jsonl#L32) | 未记录错误响应 |
| 不存在状态 | `/ki/mcp/clients/:id → /ki/mcp/clients/ui-audit-absent-20261009` | `src/pages/mcp/ClientDetailPage.tsx` | 稳定 [01:58:11 UTC](contexts-1440.jsonl#L23) | 稳定 [02:07:34 UTC](contexts-390.jsonl#L12) | 404 /api/v1/mcp/clients/ui-audit-absent-20261009; 404 /api/v1/mcp/clients/ui-audit-absent-20261009/tools |
| 不存在状态 | `/ki/mcp/clients/:id/edit → /ki/mcp/clients/ui-audit-absent-20261009/edit` | `src/pages/mcp/McpClientPage.tsx` | 稳定 [03:01:08 UTC](context-1440.jsonl#L5) | 稳定 [02:53:15 UTC](contexts-390.jsonl#L33) | 404 /api/v1/mcp/clients/ui-audit-absent-20261009 |
| 不存在状态 | `/ki/mcp/audit/detail/:id → /ki/mcp/audit/detail/ui-audit-absent-20261009` | `src/pages/mcp/AuditDetailPage.tsx` | 稳定 [01:58:22 UTC](contexts-1440.jsonl#L25) | 稳定 [02:07:44 UTC](contexts-390.jsonl#L14) | 404 /api/v1/mcp/audit/logs/ui-audit-absent-20261009 |
| 真实记录 | `/gov/data/entities/:id → /gov/data/entities/de-order-detail` | `src/pages/arch/DataEntityDetailPage.tsx` | 稳定 [01:58:23 UTC](contexts-1440.jsonl#L26) | 稳定 [02:07:46 UTC](contexts-390.jsonl#L15) | 未记录错误响应 |
| 真实记录 | `/ontology/model/object-types/:rid → /ontology/model/object-types/ont.tenant-default.obj.builder.builder-e2e-1791480073118.v1` | `src/pages/ontology/model/object-types/ObjectTypeDetailPage.tsx` | 稳定 [02:01:48 UTC](contexts-1440.jsonl#L28) | 稳定 [02:07:47 UTC](contexts-390.jsonl#L16) | 未记录错误响应 |
| 真实记录 | `/ontology/model/object-types/:rid/:tab → /ontology/model/object-types/ont.tenant-default.obj.builder.builder-e2e-1791480073118.v1/properties` | `src/pages/ontology/model/object-types/ObjectTypeDetailPage.tsx` | 稳定 [02:01:49 UTC](contexts-1440.jsonl#L29) | 稳定 [02:08:50 UTC](contexts-390.jsonl#L17) | 未记录错误响应 |
| 基础入口 | `/ontology/explore/objects/:rid? → /ontology/explore/objects` | `src/pages/ontology/explorer/ObjectExplorerPage.tsx` | 稳定 [03:04:34 UTC](context-1440.jsonl#L7) | 稳定 [03:04:21 UTC](context-390.jsonl#L3) | 未记录错误响应 |
| 真实记录 | `/ontology/logic/actions/:rid → /ontology/logic/actions/ont.tenant-default.act.core-e2e-tag.v1` | `src/pages/ontology/logic/actions/ActionTypeDetailPage.tsx` | 稳定 [02:01:54 UTC](contexts-1440.jsonl#L31) | 稳定 [02:08:52 UTC](contexts-390.jsonl#L19) | 未记录错误响应 |
| 真实记录 | `/ontology/logic/actions/:rid/:tab → /ontology/logic/actions/ont.tenant-default.act.core-e2e-tag.v1/parameters` | `src/pages/ontology/logic/actions/ActionTypeDetailPage.tsx` | 稳定 [02:01:55 UTC](contexts-1440.jsonl#L32) | 稳定 [02:08:53 UTC](contexts-390.jsonl#L20) | 未记录错误响应 |
| 不存在状态 | `/ontology/logic/functions/:rid → /ontology/logic/functions/ont.tenant-default.fn.ui-audit-absent-20261009.v1` | `src/pages/ontology/logic/functions/FunctionDetailPage.tsx` | 稳定 [03:01:11 UTC](context-1440.jsonl#L6) | 稳定 [02:08:54 UTC](contexts-390.jsonl#L21) | 未记录错误响应 |
| 不存在状态 | `/ontology/logic/functions/:rid/:tab → /ontology/logic/functions/ont.tenant-default.fn.ui-audit-absent-20261009.v1/signatures` | `src/pages/ontology/logic/functions/FunctionDetailPage.tsx` | 稳定 [02:02:01 UTC](contexts-1440.jsonl#L34) | 稳定 [02:08:55 UTC](contexts-390.jsonl#L22) | 未记录错误响应 |
| 真实记录 | `/apps/mine?app=app-arch` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:11:25 UTC](app-views-1440.jsonl#L1) | 稳定 [02:10:51 UTC](app-views-390.jsonl#L7) | 未记录错误响应 |
| 真实记录 | `/apps/mine?app=app-arch&tab=lifecycle` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:11:26 UTC](app-views-1440.jsonl#L2) | 稳定 [02:09:04 UTC](app-views-390.jsonl#L2) | 未记录错误响应 |
| 真实记录 | `/apps/mine?app=app-arch&tab=versions` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:11:28 UTC](app-views-1440.jsonl#L3) | 稳定 [02:09:05 UTC](app-views-390.jsonl#L3) | 未记录错误响应 |
| 仅元数据 | `/apps/mine?app=app-arch&module=mod-arch-apps&tab=form-designer` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:11:29 UTC](app-views-1440.jsonl#L4) | 稳定 [02:09:06 UTC](app-views-390.jsonl#L4) | 未记录错误响应 |
| 仅元数据 | `/apps/mine?app=app-arch&module=mod-arch-apps&tab=flow-designer` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:11:30 UTC](app-views-1440.jsonl#L5) | 稳定 [02:10:52 UTC](app-views-390.jsonl#L8) | 未记录错误响应 |
| 真实记录 | `/apps/market?tid=tpl-approval-multi` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:11:31 UTC](app-views-1440.jsonl#L6) | 稳定 [02:09:08 UTC](app-views-390.jsonl#L6) | 未记录错误响应 |
| 真实记录 | `/apps/market?mp=1` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:12:29 UTC](app-views-1440.jsonl#L7) | 稳定 [02:10:53 UTC](app-views-390.jsonl#L9) | 未记录错误响应 |
| 不存在状态 | `/apps/market?mp=1&tid=ui-audit-absent-20261009` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:14:07 UTC](app-views-1440.jsonl#L11) | 稳定 [02:10:54 UTC](app-views-390.jsonl#L10) | 未记录错误响应 |
| 未提交表单 | `/apps/templates?submit=1` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:12:35 UTC](app-views-1440.jsonl#L9) | 稳定 [02:10:55 UTC](app-views-390.jsonl#L11) | 未记录错误响应 |
| 不存在状态 | `/apps/mine?tab=page&page=ui-audit-absent-20261009` | `src/pages/apphub/ApphubShellPage.tsx` | 稳定 [02:14:08 UTC](app-views-1440.jsonl#L12) | 稳定 [02:10:56 UTC](app-views-390.jsonl#L12) | 404 /api/v1/apphub/pages/ui-audit-absent-20261009 |
