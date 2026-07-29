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
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const MyAppsPage = lazy(() => import('./pages/dashboard/MyAppsPage'));
const MyAgentsPage = lazy(() => import('./pages/dashboard/MyAgentsPage'));
const MessagesPage = lazy(() => import('./pages/dashboard/MessagesPage'));
const PortalPage = lazy(() => import('./pages/dashboard/PortalPage'));
const DeliverablesPage = lazy(() => import('./pages/dashboard/DeliverablesPage'));

const SuperAIPage = lazy(() => import('./pages/superai/SuperAIPage'));

const ArchBusinessPage = lazy(() => import('./pages/arch/ArchBusinessPage'));
const ArchAppPage = lazy(() => import('./pages/arch/ArchAppPage'));
const ArchDataPage = lazy(() => import('./pages/arch/ArchDataPage'));
const ArchTechPage = lazy(() => import('./pages/arch/ArchTechPage'));
const ArchGovernancePage = lazy(() => import('./pages/arch/ArchGovernancePage'));

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

const AgentsListPage = lazy(() => import('./pages/agents/AgentsListPage'));
const AgentsDetailPage = lazy(() => import('./pages/agents/AgentsDetailPage'));
const AgentsKnowledgePage = lazy(() => import('./pages/agents/AgentsKnowledgePage'));
const AgentsTasksPage = lazy(() => import('./pages/agents/AgentsTasksPage'));
const AgentsCollabPage = lazy(() => import('./pages/agents/AgentsCollabPage'));
const AgentsEvaluationPage = lazy(() => import('./pages/agents/AgentsEvaluationPage'));

const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminPermissionsPage = lazy(() => import('./pages/admin/AdminPermissionsPage'));
const AdminOrgPage = lazy(() => import('./pages/admin/AdminOrgPage'));
const AdminLogsPage = lazy(() => import('./pages/admin/AdminLogsPage'));
const AdminConfigPage = lazy(() => import('./pages/admin/AdminConfigPage'));
const AdminComponentsPage = lazy(() => import('./pages/admin/AdminComponentsPage'));
const AdminOperationsPage = lazy(() => import('./pages/admin/AdminOperationsPage'));

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
          {/* 工作台 */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard/my-apps" element={<MyAppsPage />} />
          <Route path="dashboard/my-agents" element={<MyAgentsPage />} />
          <Route path="dashboard/messages" element={<MessagesPage />} />
          <Route path="dashboard/portal" element={<PortalPage />} />
          <Route path="dashboard/deliverables" element={<DeliverablesPage />} />

          {/* SuperAI */}
          <Route path="superai" element={<SuperAIPage />} />

          {/* 架构中心 */}
          <Route path="arch" element={<ArchBusinessPage />} />
          <Route path="arch/app" element={<ArchAppPage />} />
          <Route path="arch/data" element={<ArchDataPage />} />
          <Route path="arch/tech" element={<ArchTechPage />} />
          <Route path="arch/governance" element={<ArchGovernancePage />} />

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
