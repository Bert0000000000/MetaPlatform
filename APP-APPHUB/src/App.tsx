import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import AppListPage from '@/pages/AppListPage';
import AppDetailPage from '@/pages/AppDetailPage';
import AppLifecyclePage from '@/pages/AppLifecyclePage';
import FormDesignerPage from '@/pages/FormDesignerPage';
import FlowDesignerPage from '@/pages/FlowDesignerPage';
import PageDesignerPage from '@/pages/PageDesignerPage';
import VersionManagementPage from '@/pages/VersionManagementPage';
import MarketplacePage from '@/pages/MarketplacePage';
import MarketplaceDetailPage from '@/pages/MarketplaceDetailPage';
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
          <Route index element={<Navigate to="/apps" replace />} />
          <Route path="apps" element={<AppListPage />} />
          <Route path="apps/:appId" element={<AppDetailPage />} />
          <Route path="apps/:appId/lifecycle" element={<AppLifecyclePage />} />
          <Route path="apps/:appId/versions" element={<VersionManagementPage />} />
          <Route path="apps/:appId/modules/:moduleId/form-designer" element={<FormDesignerPage />} />
          <Route path="apps/:appId/modules/:moduleId/flow-designer" element={<FlowDesignerPage />} />
          <Route path="pages/:pageId" element={<PageDesignerPage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="marketplace/:templateId" element={<MarketplaceDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
