import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import type { ReactNode } from 'react';
import { ErrorBoundary, useThemeMode, useAsyncError, getAntdTheme } from '@mate/shared';
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
import MarketPage from '@/pages/MarketPage';
import TemplateDetailPage from '@/pages/TemplateDetailPage';
import MyTemplatesPage from '@/pages/MyTemplatesPage';
import TemplateSubmitPage from '@/pages/TemplateSubmitPage';
import AIDesignerPage from '@/pages/AIDesignerPage';
import { isLoggedIn } from '@/utils/auth';

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
                <Route path="market" element={<MarketPage />} />
                <Route path="market/:templateId" element={<TemplateDetailPage />} />
                <Route path="my-templates" element={<MyTemplatesPage />} />
                <Route path="my-templates/submit" element={<TemplateSubmitPage />} />
                <Route path="ai-designer" element={<AIDesignerPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
