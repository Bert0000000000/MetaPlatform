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
import { isLoggedIn } from '@/utils/auth';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';

function ProtectedRoute({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function ThemedApp() {
  const { settings } = useSettings();
  const locale = settings.language === 'en-US' ? enUS : zhCN;
  // V12-08: 统一使用 @mate/shared 的 getAntdTheme('dark')，确保全平台暗色主题一致。
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
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  );
}
