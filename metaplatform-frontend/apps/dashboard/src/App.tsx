import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import type { ReactNode } from 'react';
import { ErrorBoundary, AppLayout, useAsyncError, getAntdTheme } from '@mate/shared';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import NotificationsPage from '@/pages/NotificationsPage';
import DeliverablesPage from '@/pages/DeliverablesPage';
import AiOpsPage from '@/pages/AiOpsPage';
import SettingsPage from '@/pages/SettingsPage';
import OverviewPage from '@/pages/admin/OverviewPage';
import UsersPage from '@/pages/admin/UsersPage';
import PermissionsPage from '@/pages/admin/PermissionsPage';
import OrgsPage from '@/pages/admin/OrgsPage';
import LogsPage from '@/pages/admin/LogsPage';
import ConfigsPage from '@/pages/admin/ConfigsPage';
import OperationsPage from '@/pages/admin/OperationsPage';
import { isLoggedIn } from '@/utils/auth';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';

function ProtectedRoute({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function ThemedApp() {
  const { settings } = useSettings();
  const locale = settings.language === 'en-US' ? enUS : zhCN;
  // V12-08: 缁熶竴浣跨敤 @mate/shared 鐨?getAntdTheme('dark')锛岀‘淇濆叏骞冲彴鏆楄壊涓婚涓€鑷淬€?
  const { theme } = getAntdTheme('dark', locale);
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
                    <AppLayout module="dashboard" />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to={settings.defaultPage || '/dashboard'} replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="deliverables" element={<DeliverablesPage />} />
                <Route path="aiops" element={<AiOpsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<OverviewPage />} />
                <Route path="admin/users" element={<UsersPage />} />
                <Route path="admin/permissions" element={<PermissionsPage />} />
                <Route path="admin/orgs" element={<OrgsPage />} />
                <Route path="admin/logs" element={<LogsPage />} />
                <Route path="admin/configs" element={<ConfigsPage />} />
                <Route path="admin/operations" element={<OperationsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ThemedApp />
      </SettingsProvider>
    </AuthProvider>
  );
}

