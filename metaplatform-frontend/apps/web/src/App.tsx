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

// 懒加载各模块页面

const SuperAIPage = lazy(() => import('./pages/superai/SuperAIPage'));


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
          {/* 工作台(Phase 4.2: from apps/dashboard) */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardDashboardPage />} />
          <Route path="dashboard/notifications" element={<DashboardNotificationsPage />} />
          <Route path="dashboard/deliverables" element={<DashboardDeliverablesPage />} />
          <Route path="dashboard/aiops" element={<DashboardAiOpsPage />} />
          <Route path="dashboard/settings" element={<DashboardSettingsPage />} />

          {/* 后台管理(Phase 4.2: from apps/dashboard) */}
          <Route path="admin" element={<DashboardAdminOverviewPage />} />
          <Route path="admin/users" element={<DashboardAdminUsersPage />} />
          <Route path="admin/permissions" element={<DashboardAdminPermissionsPage />} />
          <Route path="admin/orgs" element={<DashboardAdminOrgsPage />} />
          <Route path="admin/logs" element={<DashboardAdminLogsPage />} />
          <Route path="admin/configs" element={<DashboardAdminConfigsPage />} />
          <Route path="admin/operations" element={<DashboardAdminOperationsPage />} />
          <Route path="superai" element={<SuperAIPage />} />

          {/* 架构中心(Phase 4: from apps/arch) */}
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

          {/* 搴旂敤涓績(Phase 2: from apps/apphub) */}
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

          {/* 本体引擎 */}
          <Route path="ontology" element={<OntologyModelingPage />} />
          <Route path="ontology/datacenter" element={<OntologyDatacenterPage />} />
          <Route path="ontology/action" element={<OntologyActionPage />} />
          <Route path="ontology/graph" element={<OntologyGraphPage />} />

          {/* 知识库 */}
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="knowledge/docs" element={<KnowledgeDocsPage />} />
          <Route path="knowledge/test" element={<KnowledgeTestPage />} />
          <Route path="knowledge/config" element={<KnowledgeConfigPage />} />

          {/* MCP 中心 */}
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
          {/* 数字员工 */}
          <Route path="agents" element={<AgentsListPage />} />
          <Route path="agents/detail" element={<AgentsDetailPage />} />
          <Route path="agents/knowledge" element={<AgentsKnowledgePage />} />
          <Route path="agents/tasks" element={<AgentsTasksPage />} />
          <Route path="agents/collab" element={<AgentsCollabPage />} />
          <Route path="agents/evaluation" element={<AgentsEvaluationPage />} />

          {/* 后台管理 */}
          <Route path="admin" element={<AdminUsersPage />} />
          <Route path="admin/permissions" element={<AdminPermissionsPage />} />
          <Route path="admin/org" element={<AdminOrgPage />} />
          <Route path="admin/logs" element={<AdminLogsPage />} />
          <Route path="admin/config" element={<AdminConfigPage />} />
          <Route path="admin/components" element={<AdminComponentsPage />} />
          <Route path="admin/operations" element={<AdminOperationsPage />} />
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
