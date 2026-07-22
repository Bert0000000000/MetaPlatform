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

const AppsListPage = lazy(() => import('./pages/apps/AppsListPage'));
const AppDetailPage = lazy(() => import('./pages/apps/AppDetailPage'));
const AppModelingPage = lazy(() => import('./pages/apps/AppModelingPage'));
const FormDesignerPage = lazy(() => import('./pages/apps/FormDesignerPage'));
const ProcessDesignerPage = lazy(() => import('./pages/apps/ProcessDesignerPage'));
const AppConfigPage = lazy(() => import('./pages/apps/AppConfigPage'));
const AppPublishPage = lazy(() => import('./pages/apps/AppPublishPage'));
const AppVersionPage = lazy(() => import('./pages/apps/AppVersionPage'));

const OntologyModelingPage = lazy(() => import('./pages/ontology/OntologyModelingPage'));
const OntologyDatacenterPage = lazy(() => import('./pages/ontology/OntologyDatacenterPage'));
const OntologyActionPage = lazy(() => import('./pages/ontology/OntologyActionPage'));
const OntologyGraphPage = lazy(() => import('./pages/ontology/OntologyGraphPage'));

const KnowledgeBasePage = lazy(() => import('./pages/knowledge/KnowledgeBasePage'));

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

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>加载中...</span>
    </div>
  );
}

function AppRoutes() {
  return (
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

          {/* 应用中心 */}
          <Route path="apps" element={<AppsListPage />} />
          <Route path="apps/detail" element={<AppDetailPage />} />
          <Route path="apps/modeling" element={<AppModelingPage />} />
          <Route path="apps/formdesigner" element={<FormDesignerPage />} />
          <Route path="apps/processdesigner" element={<ProcessDesignerPage />} />
          <Route path="apps/config" element={<AppConfigPage />} />
          <Route path="apps/publish" element={<AppPublishPage />} />
          <Route path="apps/version" element={<AppVersionPage />} />

          {/* 本体引擎 */}
          <Route path="ontology" element={<OntologyModelingPage />} />
          <Route path="ontology/datacenter" element={<OntologyDatacenterPage />} />
          <Route path="ontology/action" element={<OntologyActionPage />} />
          <Route path="ontology/graph" element={<OntologyGraphPage />} />

          {/* 知识库 */}
          <Route path="knowledge" element={<KnowledgeBasePage />} />

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
        </Route>
      </Routes>
    </Suspense>
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
