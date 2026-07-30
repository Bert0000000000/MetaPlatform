import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import {
  AppLayout,
  AuthProvider,
  AuthGuard,
  useThemeMode,
  getAntdTheme,
  ScrollbarAutoHide,
} from '@mate/shared';
import LoginPage from './pages/LoginPage';
import { dashboardRouteElements, dashboardIndex } from './routes/dashboard';
import { superaiRouteElements } from './routes/superai';
import { archRouteElements } from './routes/arch';
import { apphubRouteElements } from './routes/apphub';
import { ontologyRouteElements } from './routes/ontology';
import { knowledgeRouteElements } from './routes/knowledge';
import { mcpRouteElements } from './routes/mcp';
import { agentsRouteElements } from './routes/agents';

function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>加载中...</span>
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
            <Route index element={dashboardIndex} />

            {/* Dashboard workbench + admin */}
            <Route path="dashboard" element={dashboardRouteElements.DashboardDashboardPage} />
            <Route path="dashboard/notifications" element={dashboardRouteElements.DashboardNotificationsPage} />
            <Route path="dashboard/deliverables" element={dashboardRouteElements.DashboardDeliverablesPage} />
            <Route path="dashboard/aiops" element={dashboardRouteElements.DashboardAiOpsPage} />
            <Route path="dashboard/settings" element={dashboardRouteElements.DashboardSettingsPage} />

            <Route path="admin" element={dashboardRouteElements.DashboardAdminOverviewPage} />
            <Route path="admin/users" element={dashboardRouteElements.DashboardAdminUsersPage} />
            <Route path="admin/permissions" element={dashboardRouteElements.DashboardAdminPermissionsPage} />
            <Route path="admin/orgs" element={dashboardRouteElements.DashboardAdminOrgsPage} />
            <Route path="admin/logs" element={dashboardRouteElements.DashboardAdminLogsPage} />
            <Route path="admin/configs" element={dashboardRouteElements.DashboardAdminConfigsPage} />
            <Route path="admin/operations" element={dashboardRouteElements.DashboardAdminOperationsPage} />

            {/* SuperAI */}
            <Route path="superai" element={superaiRouteElements.SuperaiOverviewPage} />
            <Route path="superai/chat" element={superaiRouteElements.SuperaiChatPage} />
            <Route path="superai/a2a" element={superaiRouteElements.SuperaiA2ACollaborationPage} />
            <Route path="superai/copilot" element={superaiRouteElements.SuperaiAgentCopilotPage} />
            <Route path="superai/cost" element={superaiRouteElements.SuperaiCostOptimizationPage} />
            <Route path="superai/data" element={superaiRouteElements.SuperaiDataAnalysisPage} />
            <Route path="superai/employee-match" element={superaiRouteElements.SuperaiEmployeeMatchingPage} />
            <Route path="superai/execution" element={superaiRouteElements.SuperaiExecutionPlanPage} />
            <Route path="superai/execution/:id" element={superaiRouteElements.SuperaiExecutionDetailPage} />
            <Route path="superai/manual-select" element={superaiRouteElements.SuperaiManualSelectEmployeePage} />
            <Route path="superai/parallel" element={superaiRouteElements.SuperaiParallelExecutionPage} />
            <Route path="superai/report" element={superaiRouteElements.SuperaiReportExportPage} />
            <Route path="superai/result-aggregation" element={superaiRouteElements.SuperaiResultAggregationPage} />
            <Route path="superai/result-summary" element={superaiRouteElements.SuperaiResultSummaryPage} />
            <Route path="superai/schedule" element={superaiRouteElements.SuperaiScheduleIntentPage} />
            <Route path="superai/schedule/execute" element={superaiRouteElements.SuperaiScheduleExecutionPage} />
            <Route path="superai/schedule/plan" element={superaiRouteElements.SuperaiSchedulePlanCardPage} />
            <Route path="superai/tasks" element={superaiRouteElements.SuperaiTaskOrchestrationPage} />
            <Route path="superai/templates" element={superaiRouteElements.SuperaiTaskTemplatePage} />

            {/* Enterprise architecture */}
            <Route path="arch" element={archRouteElements.ArchBusinessArchPage} />
            <Route path="arch/capabilities" element={archRouteElements.ArchCapabilityManagementPage} />
            <Route path="arch/applications" element={archRouteElements.ArchApplicationManagementPage} />
            <Route path="arch/value-streams" element={archRouteElements.ArchValueStreamPage} />
            <Route path="arch/processes" element={archRouteElements.ArchBusinessProcessPage} />
            <Route path="arch/org-roles" element={archRouteElements.ArchOrgRolePage} />
            <Route path="arch/data" element={archRouteElements.ArchDataArchPage} />
            <Route path="arch/data/entities/:id" element={archRouteElements.ArchDataEntityDetailPage} />
            <Route path="arch/data/flows" element={archRouteElements.ArchDataFlowPage} />
            <Route path="arch/data/standards" element={archRouteElements.ArchDataStandardPage} />
            <Route path="arch/data/assets" element={archRouteElements.ArchDataAssetCatalogPage} />
            <Route path="arch/tech" element={archRouteElements.ArchTechArchPage} />
            <Route path="arch/tech-components" element={archRouteElements.ArchTechComponentPage} />
            <Route path="arch/tech-stacks" element={archRouteElements.ArchTechStackPage} />
            <Route path="arch/deployment-topologies" element={archRouteElements.ArchDeploymentTopologyPage} />
            <Route path="arch/tech-radar" element={archRouteElements.ArchTechRadarPage} />
            <Route path="arch/principles" element={archRouteElements.ArchPrinciplesPage} />
            <Route path="arch/review-templates" element={archRouteElements.ArchReviewTemplatePage} />
            <Route path="arch/reviews" element={archRouteElements.ArchReviewPage} />
            <Route path="arch/tech-debt" element={archRouteElements.ArchTechDebtPage} />
            <Route path="arch/ontology-mapping" element={archRouteElements.ArchOntologyMappingPage} />

            {/* AppHub (apps + marketplace + designers) */}
            <Route path="apps" element={apphubRouteElements.ApphubAppListPage} />
            <Route path="apps/:appId" element={apphubRouteElements.ApphubAppDetailPage} />
            <Route path="apps/:appId/lifecycle" element={apphubRouteElements.ApphubAppLifecyclePage} />
            <Route path="apps/:appId/versions" element={apphubRouteElements.ApphubVersionManagementPage} />
            <Route path="apps/:appId/versions/:versionId" element={apphubRouteElements.ApphubReleaseRecordPage} />
            <Route path="apps/:appId/modules/:moduleId/form-designer" element={apphubRouteElements.ApphubFormDesignerPage} />
            <Route path="apps/:appId/modules/:moduleId/flow-designer" element={apphubRouteElements.ApphubFlowDesignerPage} />
            <Route path="pages/:pageId" element={apphubRouteElements.ApphubPageDesignerPage} />
            <Route path="marketplace" element={apphubRouteElements.ApphubMarketplacePage} />
            <Route path="marketplace/:templateId" element={apphubRouteElements.ApphubMarketplaceDetailPage} />
            <Route path="market" element={apphubRouteElements.ApphubMarketPage} />
            <Route path="market/:templateId" element={apphubRouteElements.ApphubTemplateDetailPage} />
            <Route path="my-templates" element={apphubRouteElements.ApphubMyTemplatesPage} />
            <Route path="my-templates/submit" element={apphubRouteElements.ApphubTemplateSubmitPage} />
            <Route path="ai-designer" element={apphubRouteElements.ApphubAIDesignerPage} />

            {/* Ontology */}
            <Route path="ontology" element={ontologyRouteElements.OntologyModelingPage} />
            <Route path="ontology/datacenter" element={ontologyRouteElements.OntologyDatacenterPage} />
            <Route path="ontology/action" element={ontologyRouteElements.OntologyActionPage} />
            <Route path="ontology/graph" element={ontologyRouteElements.OntologyGraphPage} />

            {/* Knowledge base */}
            <Route path="knowledge" element={knowledgeRouteElements.KnowledgeBasePage} />
            <Route path="knowledge/docs" element={knowledgeRouteElements.KnowledgeDocsPage} />
            <Route path="knowledge/test" element={knowledgeRouteElements.KnowledgeTestPage} />
            <Route path="knowledge/config" element={knowledgeRouteElements.KnowledgeConfigPage} />

            {/* MCP */}
            <Route path="mcp" element={mcpRouteElements.McpToolsPage} />
            <Route path="mcp/server" element={mcpRouteElements.McpServerPage} />
            <Route path="mcp/client" element={mcpRouteElements.McpClientPage} />
            <Route path="mcp/debugger" element={mcpRouteElements.McpDebuggerPage} />
            <Route path="mcp/permissions" element={mcpRouteElements.McpPermissionsPage} />
            <Route path="mcp/external" element={mcpRouteElements.McpExternalPage} />
            <Route path="mcp/audit" element={mcpRouteElements.McpAuditPage} />
            <Route path="mcp/audit/detail/:id" element={mcpRouteElements.McpAuditDetailPage} />
            <Route path="mcp/audit/stats" element={mcpRouteElements.McpAuditStatisticsPage} />
            <Route path="mcp/overview" element={mcpRouteElements.McpOverviewPage} />
            <Route path="mcp/connection-monitor" element={mcpRouteElements.McpConnectionMonitorPage} />
            <Route path="mcp/tools/:id" element={mcpRouteElements.McpToolDetailPage} />
            <Route path="mcp/tools/:id/edit" element={mcpRouteElements.McpToolEditPage} />
            <Route path="mcp/servers/:id" element={mcpRouteElements.McpServerDetailPage} />
            <Route path="mcp/clients" element={mcpRouteElements.McpClientPage} />
            <Route path="mcp/clients/new" element={mcpRouteElements.McpClientFormPage} />
            <Route path="mcp/clients/:id" element={mcpRouteElements.McpClientDetailPage} />
            <Route path="mcp/resources" element={mcpRouteElements.McpResourceListPage} />
            <Route path="mcp/resources/:id" element={mcpRouteElements.McpResourceEditPage} />
            <Route path="mcp/prompts" element={mcpRouteElements.McpPromptTemplatePage} />
            <Route path="mcp/permissions/rules" element={mcpRouteElements.McpPermissionRulePage} />
            <Route path="mcp/policies" element={mcpRouteElements.McpPolicyManagementPage} />
            <Route path="mcp/ide-config" element={mcpRouteElements.McpIdeConfigPage} />
            <Route path="mcp/external-agents" element={mcpRouteElements.McpExternalAgentListPage} />
            <Route path="mcp/trusts" element={mcpRouteElements.McpTrustManagementPage} />

            {/* Agents (digital employees) */}
            <Route path="agents" element={agentsRouteElements.AgentsListPage} />
            <Route path="agents/detail" element={agentsRouteElements.AgentsDetailPage} />
            <Route path="agents/knowledge" element={agentsRouteElements.AgentsKnowledgePage} />
            <Route path="agents/tasks" element={agentsRouteElements.AgentsTasksPage} />
            <Route path="agents/collab" element={agentsRouteElements.AgentsCollabPage} />
            <Route path="agents/evaluation" element={agentsRouteElements.AgentsEvaluationPage} />
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
