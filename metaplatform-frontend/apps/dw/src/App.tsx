import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import type { ReactNode } from 'react';
import { ErrorBoundary, useThemeMode, useAsyncError, getAntdTheme } from '@mate/shared';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import EmployeeListPage from '@/pages/EmployeeListPage';
import EmployeeCreatePage from '@/pages/EmployeeCreatePage';
import EmployeeDetailPage from '@/pages/EmployeeDetailPage';
import CapabilityConfigPage from '@/pages/CapabilityConfigPage';
import TaskListPage from '@/pages/TaskListPage';
import TaskCreatePage from '@/pages/TaskCreatePage';
import TaskDetailPage from '@/pages/TaskDetailPage';
import EvaluationPage from '@/pages/EvaluationPage';
import CollaborationListPage from '@/pages/CollaborationListPage';
import CollaborationCreatePage from '@/pages/CollaborationCreatePage';
import CollaborationMonitorPage from '@/pages/CollaborationMonitorPage';
import ExternalAgentsPage from '@/pages/ExternalAgentsPage';
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
                <Route index element={<Navigate to="/dw/employees" replace />} />
                <Route path="dw" element={<Navigate to="/dw/employees" replace />} />
                <Route path="dw/employees" element={<EmployeeListPage />} />
                <Route path="dw/employees/create" element={<EmployeeCreatePage />} />
                <Route path="dw/employees/:id" element={<EmployeeDetailPage />} />
                <Route path="dw/employees/:id/capability" element={<CapabilityConfigPage />} />
                <Route path="dw/tasks" element={<TaskListPage />} />
                <Route path="dw/tasks/create" element={<TaskCreatePage />} />
                <Route path="dw/tasks/:taskId" element={<TaskDetailPage />} />
                <Route path="dw/evaluation" element={<EvaluationPage />} />
                <Route path="dw/collaborations" element={<CollaborationListPage />} />
                <Route path="dw/collaborations/new" element={<CollaborationCreatePage />} />
                <Route path="dw/collaborations/:id" element={<CollaborationMonitorPage />} />
                <Route path="dw/external-agents" element={<ExternalAgentsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
