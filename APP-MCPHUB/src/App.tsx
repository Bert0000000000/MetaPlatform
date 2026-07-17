import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import ToolListPage from '@/pages/ToolListPage';
import ToolEditPage from '@/pages/ToolEditPage';
import ServerListPage from '@/pages/ServerListPage';
import ServerDetailPage from '@/pages/ServerDetailPage';
import DebuggerPage from '@/pages/DebuggerPage';
import ClientListPage from '@/pages/ClientListPage';
import ClientFormPage from '@/pages/ClientFormPage';
import PermissionRulePage from '@/pages/PermissionRulePage';
import ResourceListPage from '@/pages/ResourceListPage';
import ResourceEditPage from '@/pages/ResourceEditPage';
import PromptTemplatePage from '@/pages/PromptTemplatePage';
import AuditLogPage from '@/pages/AuditLogPage';
import AuditDetailPage from '@/pages/AuditDetailPage';
import ExternalIntegrationPage from '@/pages/ExternalIntegrationPage';
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
          <Route index element={<Navigate to="/tools" replace />} />
          <Route path="tools" element={<ToolListPage />} />
          <Route path="tools/new" element={<ToolEditPage />} />
          <Route path="tools/:id" element={<ToolEditPage />} />
          <Route path="servers" element={<ServerListPage />} />
          <Route path="servers/:id" element={<ServerDetailPage />} />
          <Route path="debugger" element={<DebuggerPage />} />
          <Route path="clients" element={<ClientListPage />} />
          <Route path="clients/new" element={<ClientFormPage />} />
          <Route path="clients/:id" element={<ClientFormPage />} />
          <Route path="permissions" element={<PermissionRulePage />} />
          <Route path="resources" element={<ResourceListPage />} />
          <Route path="resources/new" element={<ResourceEditPage />} />
          <Route path="resources/:id" element={<ResourceEditPage />} />
          <Route path="prompts" element={<PromptTemplatePage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="audit/:id" element={<AuditDetailPage />} />
          <Route path="integrations" element={<ExternalIntegrationPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
