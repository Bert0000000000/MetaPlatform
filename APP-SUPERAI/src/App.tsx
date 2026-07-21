import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import type { ReactNode } from 'react';
import { ErrorBoundary, useThemeMode, useAsyncError, getAntdTheme } from '@mate/shared';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import ChatPage from '@/pages/ChatPage';
import TaskOrchestrationPage from '@/pages/TaskOrchestrationPage';
import ExecutionPlanPage from '@/pages/ExecutionPlanPage';
import ParallelExecutionPage from '@/pages/ParallelExecutionPage';
import ResultAggregationPage from '@/pages/ResultAggregationPage';
import TaskTemplatePage from '@/pages/TaskTemplatePage';
import ScheduleIntentPage from '@/pages/ScheduleIntentPage';
import EmployeeMatchingPage from '@/pages/EmployeeMatchingPage';
import SchedulePlanCardPage from '@/pages/SchedulePlanCardPage';
import ScheduleExecutionPage from '@/pages/ScheduleExecutionPage';
import ExecutionDetailPage from '@/pages/ExecutionDetailPage';
import ResultSummaryPage from '@/pages/ResultSummaryPage';
import ReportExportPage from '@/pages/ReportExportPage';
import ManualSelectEmployeePage from '@/pages/ManualSelectEmployeePage';
import A2ACollaborationPage from '@/pages/A2ACollaborationPage';
import DataAnalysisPage from '@/pages/DataAnalysisPage';
import CostOptimizationPage from '@/pages/CostOptimizationPage';
import { isLoggedIn } from '@/utils/auth';

function ProtectedRoute({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  // V12-08: 统一主题壳 —— 与 APP-DASHBOARD 共享同一份 localStorage 设置（mate_platform_settings）。
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
                <Route index element={<Navigate to="/chat" replace />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="schedule/orchestration" element={<TaskOrchestrationPage />} />
                <Route path="schedule/plan" element={<ExecutionPlanPage />} />
                <Route path="schedule/parallel" element={<ParallelExecutionPage />} />
                <Route path="schedule/aggregate" element={<ResultAggregationPage />} />
                <Route path="schedule/templates" element={<TaskTemplatePage />} />
                <Route path="schedule/intent" element={<ScheduleIntentPage />} />
                <Route path="schedule/match" element={<EmployeeMatchingPage />} />
                <Route path="schedule/plan-card" element={<SchedulePlanCardPage />} />
                <Route path="schedule/execution" element={<ScheduleExecutionPage />} />
                <Route path="schedule/execution/detail" element={<ExecutionDetailPage />} />
                <Route path="schedule/result" element={<ResultSummaryPage />} />
                <Route path="schedule/export" element={<ReportExportPage />} />
                <Route path="schedule/manual-select" element={<ManualSelectEmployeePage />} />
                <Route path="schedule/a2a" element={<A2ACollaborationPage />} />
                <Route path="analysis" element={<DataAnalysisPage />} />
                <Route path="cost-optimization" element={<CostOptimizationPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
