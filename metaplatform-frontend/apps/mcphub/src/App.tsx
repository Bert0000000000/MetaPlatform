import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import type { ReactNode } from 'react';
import { ErrorBoundary, useThemeMode, useAsyncError, getAntdTheme } from '@mate/shared';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import OverviewPage from '@/pages/OverviewPage';
import ToolListPage from '@/pages/ToolListPage';
import ToolDetailPage from '@/pages/ToolDetailPage';
import ToolEditPage from '@/pages/ToolEditPage';
import ServerListPage from '@/pages/ServerListPage';
import ServerDetailPage from '@/pages/ServerDetailPage';
import DebuggerPage from '@/pages/DebuggerPage';
import ClientListPage from '@/pages/ClientListPage';
import ClientFormPage from '@/pages/ClientFormPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import PermissionRulePage from '@/pages/PermissionRulePage';
import PolicyManagementPage from '@/pages/PolicyManagementPage';
import PermissionMatrixPage from '@/pages/PermissionMatrixPage';
import ResourceListPage from '@/pages/ResourceListPage';
import ResourceEditPage from '@/pages/ResourceEditPage';
import PromptTemplatePage from '@/pages/PromptTemplatePage';
import AuditStatisticsPage from '@/pages/AuditStatisticsPage';
import AuditDetailPage from '@/pages/AuditDetailPage';
import ExternalIntegrationPage from '@/pages/ExternalIntegrationPage';
import ExternalAgentListPage from '@/pages/ExternalAgentListPage';
import TrustManagementPage from '@/pages/TrustManagementPage';
import CollaborationAuditPage from '@/pages/CollaborationAuditPage';
import IdeConfigPage from '@/pages/IdeConfigPage';
import ConnectionMonitorPage from '@/pages/ConnectionMonitorPage';
import { isLoggedIn } from '@mate/shared';
function ProtectedRoute({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  // V12-08: 统一主题壳 —— 与 APP-DASHBOARD 共享同一份 localStorage 设置。
  const { resolvedTheme, language } = useThemeMode();
  const locale = language === 'en-US' ? enUS : zhCN;
  const { theme } = getAntdTheme(resolvedTheme, locale);
  useAsyncError();

  return (
    <ErrorBoundary>
      <ConfigProvider locale={locale} theme={theme}>
        <AntApp>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<OverviewPage />} />
                <Route path="tools" element={<ToolListPage />} />
                <Route path="tools/new" element={<ToolEditPage />} />
                <Route path="tools/:id" element={<ToolDetailPage />} />
                <Route path="tools/:id/edit" element={<ToolEditPage />} />
                <Route path="servers" element={<ServerListPage />} />
                <Route path="servers/:id" element={<ServerDetailPage />} />
                <Route path="debugger" element={<DebuggerPage />} />
                <Route path="clients" element={<ClientListPage />} />
                <Route path="clients/new" element={<ClientFormPage />} />
                <Route path="clients/:id" element={<ClientDetailPage />} />
                <Route path="clients/:id/edit" element={<ClientFormPage />} />
                <Route path="permissions" element={<PermissionRulePage />} />
                <Route path="policies" element={<PolicyManagementPage />} />
                <Route path="matrix" element={<PermissionMatrixPage />} />
                <Route path="resources" element={<ResourceListPage />} />
                <Route path="resources/new" element={<ResourceEditPage />} />
                <Route path="resources/:id" element={<ResourceEditPage />} />
                <Route path="prompts" element={<PromptTemplatePage />} />
                <Route path="audit" element={<AuditStatisticsPage />} />
                <Route path="audit/:id" element={<AuditDetailPage />} />
                <Route path="integrations" element={<ExternalIntegrationPage />} />
                <Route path="external-agents" element={<ExternalAgentListPage />} />
                <Route path="trusts" element={<TrustManagementPage />} />
                <Route path="collaborations" element={<CollaborationAuditPage />} />
                <Route path="ide-config" element={<IdeConfigPage />} />
                <Route path="connection-monitor" element={<ConnectionMonitorPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
