import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import NotificationsPage from '@/pages/NotificationsPage';
import DeliverablesPage from '@/pages/DeliverablesPage';
import SettingsPage from '@/pages/SettingsPage';
import { isLoggedIn } from '@/utils/auth';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function ThemedApp() {
  const { settings } = useSettings();
  const locale = settings.language === 'en-US' ? enUS : zhCN;
  const isDark = settings.theme === 'dark';

  return (
    <ConfigProvider
      locale={locale}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
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
              <Route index element={<Navigate to={settings.defaultPage || '/dashboard'} replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="deliverables" element={<DeliverablesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  );
}
