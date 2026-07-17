import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
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
import { isLoggedIn } from '@/utils/auth';

function ProtectedRoute({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
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
  );
}
