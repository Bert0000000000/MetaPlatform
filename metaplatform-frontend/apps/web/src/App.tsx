import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import {
  AppLayout,
  AuthProvider,
  AuthGuard,
  useThemeMode,
  getAntdTheme,
   ScrollbarAutoHide,
} from '@mate/shared';
import LoginPage from './pages/LoginPage';

// 閹虫帒濮炴潪钘夋倗濡€虫健妞ょ敻娼?

const SuperaiOverviewPage = lazy(() => import('./pages/superai/ChatPage'));
const SuperaiChatPage = lazy(() => import('./pages/superai/SuperAIChatPage'));
const SuperaiA2ACollaborationPage = lazy(() => import('./pages/superai/A2ACollaborationPage'));
const SuperaiAgentCopilotPage = lazy(() => import('./pages/superai/AgentCopilotPage'));
const SuperaiCostOptimizationPage = lazy(() => import('./pages/superai/CostOptimizationPage'));
const SuperaiDataAnalysisPage = lazy(() => import('./pages/superai/DataAnalysisPage'));
const SuperaiEmployeeMatchingPage = lazy(() => import('./pages/superai/EmployeeMatchingPage'));
const SuperaiExecutionDetailPage = lazy(() => import('./pages/superai/ExecutionDetailPage'));
const SuperaiExecutionPlanPage = lazy(() => import('./pages/superai/ExecutionPlanPage'));
const SuperaiManualSelectEmployeePage = lazy(() => import('./pages/superai/ManualSelectEmployeePage'));
const SuperaiParallelExecutionPage = lazy(() => import('./pages/superai/ParallelExecutionPage'));
const SuperaiReportExportPage = lazy(() => import('./pages/superai/ReportExportPage'));
const SuperaiResultAggregationPage = lazy(() => import('./pages/superai/ResultAggregationPage'));
const SuperaiResultSummaryPage = lazy(() => import('./pages/superai/ResultSummaryPage'));
const SuperaiScheduleExecutionPage = lazy(() => import('./pages/superai/ScheduleExecutionPage'));
const SuperaiScheduleIntentPage = lazy(() => import('./pages/superai/ScheduleIntentPage'));
const SuperaiSchedulePlanCardPage = lazy(() => import('./pages/superai/SchedulePlanCardPage'));
const SuperaiTaskOrchestrationPage = lazy(() => import('./pages/superai/TaskOrchestrationPage'));
const SuperaiTaskTemplatePage = lazy(() => import('./pages/superai/TaskTemplatePage'));

const ApphubAppListPage = lazy(() => import('./pages/apphub/AppListPage'));
const ApphubAppDetailPage = lazy(() => import('./pages/apphub/AppDetailPage'));
const ApphubAppLifecyclePage = lazy(() => import('./pages/apphub/AppLifecyclePage'));
const ApphubVersionManagementPage = lazy(() => import('./pages/apphub/VersionManagementPage'));
const ApphubReleaseRecordPage = lazy(() => import('./pages/apphub/ReleaseRecordPage'));
const ApphubFormDesignerPage = lazy(() => import('./pages/apphub/FormDesignerPage'));
const ApphubFlowDesignerPage = lazy(() => import('./pages/apphub/FlowDesignerPage'));
const ApphubPageDesignerPage = lazy(() => import('./pages/apphub/PageDesignerPage'));
const ApphubMarketplacePage = lazy(() => import('./pages/apphub/MarketplacePage'));
const ApphubMarketplaceDetailPage = lazy(() => import('./pages/apphub/MarketplaceDetailPage'));
const ApphubMarketPage = lazy(() => import('./pages/apphub/MarketPage'));
const ApphubTemplateDetailPage = lazy(() => import('./pages/apphub/TemplateDetailPage'));
const ApphubMyTemplatesPage = lazy(() => import('./pages/apphub/MyTemplatesPage'));
const ApphubTemplateSubmitPage = lazy(() => import('./pages/apphub/TemplateSubmitPage'));
const ApphubAIDesignerPage = lazy(() => import('./pages/apphub/AIDesignerPage'));

const OntologyModelingPage = lazy(() => import('./pages/ontology/OntologyModelingPage'));
const OntologyDatacenterPage = lazy(() => import('./pages/ontology/OntologyDatacenterPage'));
const OntologyActionPage = lazy(() => import('./pages/ontology/OntologyActionPage'));
const OntologyGraphPage = lazy(() => import('./pages/ontology/OntologyGraphPage'));

const DashboardDashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const DashboardMyAppsPage = lazy(() => import('./pages/dashboard/MyAppsPage'));
const DashboardMyAgentsPage = lazy(() => import('./pages/dashboard/MyAgentsPage'));
const DashboardMessagesPage = lazy(() => import('./pages/dashboard/MessagesPage'));
const DashboardPortalPage = lazy(() => import('./pages/dashboard/PortalPage'));
const DashboardNotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const DashboardAiOpsPage = lazy(() => import('./pages/dashboard/AiOpsPage'));
const DashboardSettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const DashboardAdminOverviewPage = lazy(() => import('./pages/dashboard/admin/OverviewPage'));
const DashboardAdminUsersPage = lazy(() => import('./pages/dashboard/admin/UsersPage'));
const DashboardAdminPermissionsPage = lazy(() => import('./pages/dashboard/admin/PermissionsPage'));
const DashboardAdminOrgsPage = lazy(() => import('./pages/dashboard/admin/OrgsPage'));
const DashboardAdminLogsPage = lazy(() => import('./pages/dashboard/admin/LogsPage'));
const DashboardAdminConfigsPage = lazy(() => import('./pages/dashboard/admin/ConfigsPage'));
const DashboardAdminOperationsPage = lazy(() => import('./pages/dashboard/admin/OperationsPage'));
const DashboardDeliverablesPage = lazy(() => import('./pages/dashboard/DeliverablesPage'));
const ArchBusinessArchPage = lazy(() => import('./pages/arch/BusinessArchPage'));
const ArchApplicationManagementPage = lazy(() => import('./pages/arch/ApplicationManagementPage'));
const ArchCapabilityManagementPage = lazy(() => import('./pages/arch/CapabilityManagementPage'));
const ArchValueStreamPage = lazy(() => import('./pages/arch/ValueStreamPage'));
const ArchBusinessProcessPage = lazy(() => import('./pages/arch/BusinessProcessPage'));
const ArchOrgRolePage = lazy(() => import('./pages/arch/OrgRolePage'));
const ArchDataArchPage = lazy(() => import('./pages/arch/DataArchPage'));
const ArchDataEntityDetailPage = lazy(() => import('./pages/arch/DataEntityDetailPage'));
const ArchDataFlowPage = lazy(() => import('./pages/arch/DataFlowPage'));
const ArchDataStandardPage = lazy(() => import('./pages/arch/DataStandardPage'));
const ArchDataAssetCatalogPage = lazy(() => import('./pages/arch/DataAssetCatalogPage'));
const ArchTechArchPage = lazy(() => import('./pages/arch/TechArchPage'));
const ArchTechComponentPage = lazy(() => import('./pages/arch/TechComponentPage'));
const ArchTechStackPage = lazy(() => import('./pages/arch/TechStackPage'));
const ArchDeploymentTopologyPage = lazy(() => import('./pages/arch/DeploymentTopologyPage'));
const ArchTechRadarPage = lazy(() => import('./pages/arch/TechRadarPage'));
const ArchPrinciplesPage = lazy(() => import('./pages/arch/PrinciplesPage'));
const ArchReviewTemplatePage = lazy(() => import('./pages/arch/ReviewTemplatePage'));
const ArchReviewPage = lazy(() => import('./pages/arch/ReviewPage'));
const ArchTechDebtPage = lazy(() => import('./pages/arch/TechDebtPage'));
const ArchOntologyMappingPage = lazy(() => import('./pages/arch/OntologyMappingPage'));
const KnowledgeBasePage = lazy(() => import('./pages/knowledge/KnowledgeBasePage'));
const KnowledgeDocsPage = lazy(() => import('./pages/knowledge/KnowledgeDocsPage'));
const KnowledgeTestPage = lazy(() => import('./pages/knowledge/KnowledgeTestPage'));
const KnowledgeConfigPage = lazy(() => import('./pages/knowledge/KnowledgeConfigPage'));

const McpToolsPage = lazy(() => import('./pages/mcp/McpToolsPage'));
const McpServerPage = lazy(() => import('./pages/mcp/McpServerPage'));
const McpClientPage = lazy(() => import('./pages/mcp/McpClientPage'));
const McpDebuggerPage = lazy(() => import('./pages/mcp/McpDebuggerPage'));
const McpPermissionsPage = lazy(() => import('./pages/mcp/McpPermissionsPage'));
const McpExternalPage = lazy(() => import('./pages/mcp/McpExternalPage'));
const McpAuditPage = lazy(() => import('./pages/mcp/McpAuditPage'));
const McpOverviewPage = lazy(() => import('./pages/mcp/OverviewPage'));
const McpConnectionMonitorPage = lazy(() => import('./pages/mcp/ConnectionMonitorPage'));
const McpToolDetailPage = lazy(() => import('./pages/mcp/ToolDetailPage'));
const McpToolEditPage = lazy(() => import('./pages/mcp/ToolEditPage'));
const McpServerDetailPage = lazy(() => import('./pages/mcp/ServerDetailPage'));
const McpClientDetailPage = lazy(() => import('./pages/mcp/ClientDetailPage'));
const McpClientFormPage = lazy(() => import('./pages/mcp/ClientFormPage'));
const McpResourceListPage = lazy(() => import('./pages/mcp/ResourceListPage'));
const McpResourceEditPage = lazy(() => import('./pages/mcp/ResourceEditPage'));
const McpPromptTemplatePage = lazy(() => import('./pages/mcp/PromptTemplatePage'));
const McpPermissionRulePage = lazy(() => import('./pages/mcp/PermissionRulePage'));
const McpPolicyManagementPage = lazy(() => import('./pages/mcp/PolicyManagementPage'));
const McpIdeConfigPage = lazy(() => import('./pages/mcp/IdeConfigPage'));
const McpExternalAgentListPage = lazy(() => import('./pages/mcp/ExternalAgentListPage'));
const McpTrustManagementPage = lazy(() => import('./pages/mcp/TrustManagementPage'));
const McpAuditDetailPage = lazy(() => import('./pages/mcp/AuditDetailPage'));
const McpAuditStatisticsPage = lazy(() => import('./pages/mcp/AuditStatisticsPage'));
const AgentsListPage = lazy(() => import('./pages/agents/AgentsListPage'));
const AgentsDetailPage = lazy(() => import('./pages/agents/AgentsDetailPage'));
const AgentsKnowledgePage = lazy(() => import('./pages/agents/AgentsKnowledgePage'));
const AgentsTasksPage = lazy(() => import('./pages/agents/AgentsTasksPage'));
const AgentsCollabPage = lazy(() => import('./pages/agents/AgentsCollabPage'));
const AgentsEvaluationPage = lazy(() => import('./pages/agents/AgentsEvaluationPage'));


function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>閸旂姾娴囨稉?..</span>
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <ScrollbarAutoHide />
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          {/* 瀹搞儰缍旈崣?Phase 4.2: from apps/dashboard) */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardDashboardPage />} />
          <Route path="dashboard/my-apps" element={<DashboardMyAppsPage />} />
          <Route path="dashboard/my-agents" element={<DashboardMyAgentsPage />} />
          <Route path="dashboard/messages" element={<DashboardMessagesPage />} />
          <Route path="dashboard/portal" element={<DashboardPortalPage />} />
          <Route path="dashboard/notifications" element={<DashboardNotificationsPage />} />
          <Route path="dashboard/deliverables" element={<DashboardDeliverablesPage />} />
          <Route path="dashboard/aiops" element={<DashboardAiOpsPage />} />
          <Route path="dashboard/settings" element={<DashboardSettingsPage />} />

          {/* 閸氬骸褰寸粻锛勬倞(Phase 4.2: from apps/dashboard) */}
          <Route path="admin" element={<DashboardAdminOverviewPage />} />
          <Route path="admin/users" element={<DashboardAdminUsersPage />} />
          <Route path="admin/permissions" element={<DashboardAdminPermissionsPage />} />
          <Route path="admin/orgs" element={<DashboardAdminOrgsPage />} />
          <Route path="admin/logs" element={<DashboardAdminLogsPage />} />
          <Route path="admin/configs" element={<DashboardAdminConfigsPage />} />
          <Route path="admin/operations" element={<DashboardAdminOperationsPage />} />
          {/* SuperAI 鐎电鐦芥稉顓炵妇(Phase 4.5: from apps/superai) */}
          <Route path="superai" element={<SuperaiOverviewPage />} />
          <Route path="superai/chat" element={<SuperaiChatPage />} />
          <Route path="superai/a2a" element={<SuperaiA2ACollaborationPage />} />
          <Route path="superai/copilot" element={<SuperaiAgentCopilotPage />} />
          <Route path="superai/cost" element={<SuperaiCostOptimizationPage />} />
          <Route path="superai/data" element={<SuperaiDataAnalysisPage />} />
          <Route path="superai/employee-match" element={<SuperaiEmployeeMatchingPage />} />
          <Route path="superai/execution" element={<SuperaiExecutionPlanPage />} />
          <Route path="superai/execution/:id" element={<SuperaiExecutionDetailPage />} />
          <Route path="superai/manual-select" element={<SuperaiManualSelectEmployeePage />} />
          <Route path="superai/parallel" element={<SuperaiParallelExecutionPage />} />
          <Route path="superai/report" element={<SuperaiReportExportPage />} />
          <Route path="superai/result-aggregation" element={<SuperaiResultAggregationPage />} />
          <Route path="superai/result-summary" element={<SuperaiResultSummaryPage />} />
          <Route path="superai/schedule" element={<SuperaiScheduleIntentPage />} />
          <Route path="superai/schedule/execute" element={<SuperaiScheduleExecutionPage />} />
          <Route path="superai/schedule/plan" element={<SuperaiSchedulePlanCardPage />} />
          <Route path="superai/tasks" element={<SuperaiTaskOrchestrationPage />} />
          <Route path="superai/templates" element={<SuperaiTaskTemplatePage />} />
          {/* 閺嬭埖鐎稉顓炵妇(Phase 4: from apps/arch) */}
          <Route path="arch" element={<ArchBusinessArchPage />} />
          <Route path="arch/capabilities" element={<ArchCapabilityManagementPage />} />
          <Route path="arch/applications" element={<ArchApplicationManagementPage />} />
          <Route path="arch/value-streams" element={<ArchValueStreamPage />} />
          <Route path="arch/processes" element={<ArchBusinessProcessPage />} />
          <Route path="arch/org-roles" element={<ArchOrgRolePage />} />
          <Route path="arch/data" element={<ArchDataArchPage />} />
          <Route path="arch/data/entities/:id" element={<ArchDataEntityDetailPage />} />
          <Route path="arch/data/flows" element={<ArchDataFlowPage />} />
          <Route path="arch/data/standards" element={<ArchDataStandardPage />} />
          <Route path="arch/data/assets" element={<ArchDataAssetCatalogPage />} />
          <Route path="arch/tech" element={<ArchTechArchPage />} />
          <Route path="arch/tech-components" element={<ArchTechComponentPage />} />
          <Route path="arch/tech-stacks" element={<ArchTechStackPage />} />
          <Route path="arch/deployment-topologies" element={<ArchDeploymentTopologyPage />} />
          <Route path="arch/tech-radar" element={<ArchTechRadarPage />} />
          <Route path="arch/principles" element={<ArchPrinciplesPage />} />
          <Route path="arch/review-templates" element={<ArchReviewTemplatePage />} />
          <Route path="arch/reviews" element={<ArchReviewPage />} />
          <Route path="arch/tech-debt" element={<ArchTechDebtPage />} />
          <Route path="arch/ontology-mapping" element={<ArchOntologyMappingPage />} />

          {/* 閹煎瓨姊婚弫銈嗙▔椤撶偟濡?Phase 2: from apps/apphub) */}
          <Route path="apps" element={<ApphubAppListPage />} />
          <Route path="apps/:appId" element={<ApphubAppDetailPage />} />
          <Route path="apps/:appId/lifecycle" element={<ApphubAppLifecyclePage />} />
          <Route path="apps/:appId/versions" element={<ApphubVersionManagementPage />} />
          <Route path="apps/:appId/versions/:versionId" element={<ApphubReleaseRecordPage />} />
          <Route path="apps/:appId/modules/:moduleId/form-designer" element={<ApphubFormDesignerPage />} />
          <Route path="apps/:appId/modules/:moduleId/flow-designer" element={<ApphubFlowDesignerPage />} />
          <Route path="pages/:pageId" element={<ApphubPageDesignerPage />} />
          <Route path="marketplace" element={<ApphubMarketplacePage />} />
          <Route path="marketplace/:templateId" element={<ApphubMarketplaceDetailPage />} />
          <Route path="market" element={<ApphubMarketPage />} />
          <Route path="market/:templateId" element={<ApphubTemplateDetailPage />} />
          <Route path="my-templates" element={<ApphubMyTemplatesPage />} />
          <Route path="my-templates/submit" element={<ApphubTemplateSubmitPage />} />
          <Route path="ai-designer" element={<ApphubAIDesignerPage />} />

          {/* 閺堫兛缍嬪鏇熸惛 */}
          <Route path="ontology" element={<OntologyModelingPage />} />
          <Route path="ontology/datacenter" element={<OntologyDatacenterPage />} />
          <Route path="ontology/action" element={<OntologyActionPage />} />
          <Route path="ontology/graph" element={<OntologyGraphPage />} />

          {/* 閻儴鐦戞惔?*/}
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="knowledge/docs" element={<KnowledgeDocsPage />} />
          <Route path="knowledge/test" element={<KnowledgeTestPage />} />
          <Route path="knowledge/config" element={<KnowledgeConfigPage />} />

          {/* MCP 娑擃厼绺?*/}
          <Route path="mcp" element={<McpToolsPage />} />
          <Route path="mcp/server" element={<McpServerPage />} />
          <Route path="mcp/client" element={<McpClientPage />} />
          <Route path="mcp/debugger" element={<McpDebuggerPage />} />
          <Route path="mcp/permissions" element={<McpPermissionsPage />} />
          <Route path="mcp/external" element={<McpExternalPage />} />
          <Route path="mcp/audit" element={<McpAuditPage />} />
          <Route path="mcp/audit/detail/:id" element={<McpAuditDetailPage />} />
          <Route path="mcp/audit/stats" element={<McpAuditStatisticsPage />} />
          <Route path="mcp/overview" element={<McpOverviewPage />} />
          <Route path="mcp/connection-monitor" element={<McpConnectionMonitorPage />} />
          <Route path="mcp/tools/:id" element={<McpToolDetailPage />} />
          <Route path="mcp/tools/:id/edit" element={<McpToolEditPage />} />
          <Route path="mcp/servers/:id" element={<McpServerDetailPage />} />
          <Route path="mcp/clients" element={<McpClientPage />} />
          <Route path="mcp/clients/new" element={<McpClientFormPage />} />
          <Route path="mcp/clients/:id" element={<McpClientDetailPage />} />
          <Route path="mcp/resources" element={<McpResourceListPage />} />
          <Route path="mcp/resources/:id" element={<McpResourceEditPage />} />
          <Route path="mcp/prompts" element={<McpPromptTemplatePage />} />
          <Route path="mcp/permissions/rules" element={<McpPermissionRulePage />} />
          <Route path="mcp/policies" element={<McpPolicyManagementPage />} />
          <Route path="mcp/ide-config" element={<McpIdeConfigPage />} />
          <Route path="mcp/external-agents" element={<McpExternalAgentListPage />} />
          <Route path="mcp/trusts" element={<McpTrustManagementPage />} />
          {/* 閺佹澘鐡ч崨妯轰紣 */}
          <Route path="agents" element={<AgentsListPage />} />
          <Route path="agents/detail" element={<AgentsDetailPage />} />
          <Route path="agents/knowledge" element={<AgentsKnowledgePage />} />
          <Route path="agents/tasks" element={<AgentsTasksPage />} />
          <Route path="agents/collab" element={<AgentsCollabPage />} />
          <Route path="agents/evaluation" element={<AgentsEvaluationPage />} />          {/* 鍚庡彴绠＄悊锛氱粺涓€浣跨敤 dashboard/admin 椤甸潰锛岄伩鍏嶉噸澶嶈矾鐢卞拰鏈畾涔夌粍浠?*/}
        </Route>
      </Routes>
    </Suspense>
    </>
  );
}

function App() {
  const { resolvedTheme } = useThemeMode();
  const { theme } = getAntdTheme(resolvedTheme, zhCN);

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
