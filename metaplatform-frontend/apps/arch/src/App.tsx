import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { ErrorBoundary, useThemeMode, useAsyncError, getAntdTheme } from '@mate/shared';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import BusinessArchPage from '@/pages/BusinessArchPage';
import CapabilityManagementPage from '@/pages/CapabilityManagementPage';
import ApplicationManagementPage from '@/pages/ApplicationManagementPage';
import ValueStreamPage from '@/pages/ValueStreamPage';
import BusinessProcessPage from '@/pages/BusinessProcessPage';
import OrgRolePage from '@/pages/OrgRolePage';
import DataArchPage from '@/pages/DataArchPage';
import DataEntityDetailPage from '@/pages/DataEntityDetailPage';
import DataFlowPage from '@/pages/DataFlowPage';
import DataStandardPage from '@/pages/DataStandardPage';
import DataAssetCatalogPage from '@/pages/DataAssetCatalogPage';
import TechArchPage from '@/pages/TechArchPage';
import TechComponentPage from '@/pages/TechComponentPage';
import TechStackPage from '@/pages/TechStackPage';
import DeploymentTopologyPage from '@/pages/DeploymentTopologyPage';
import TechRadarPage from '@/pages/TechRadarPage';
import PrinciplesPage from '@/pages/PrinciplesPage';
import ReviewTemplatePage from '@/pages/ReviewTemplatePage';
import ReviewPage from '@/pages/ReviewPage';
import TechDebtPage from '@/pages/TechDebtPage';
import OntologyMappingPage from '@/pages/OntologyMappingPage';
import { isLoggedIn } from '@mate/shared';
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/arch" replace />} />
                <Route path="arch" element={<BusinessArchPage />} />
                <Route path="arch/capabilities" element={<CapabilityManagementPage />} />
                <Route path="arch/applications" element={<ApplicationManagementPage />} />
                <Route path="arch/value-streams" element={<ValueStreamPage />} />
                <Route path="arch/processes" element={<BusinessProcessPage />} />
                <Route path="arch/org-roles" element={<OrgRolePage />} />
                <Route path="arch/data" element={<DataArchPage />} />
              <Route path="arch/data/entities/:id" element={<DataEntityDetailPage />} />
              <Route path="arch/data/flows" element={<DataFlowPage />} />
              <Route path="arch/data/standards" element={<DataStandardPage />} />
              <Route path="arch/data/assets" element={<DataAssetCatalogPage />} />
              <Route path="arch/tech" element={<TechArchPage />} />
                <Route path="arch/tech-components" element={<TechComponentPage />} />
                <Route path="arch/tech-stacks" element={<TechStackPage />} />
                <Route path="arch/deployment-topologies" element={<DeploymentTopologyPage />} />
                <Route path="arch/tech-radar" element={<TechRadarPage />} />
                <Route path="arch/principles" element={<PrinciplesPage />} />
                <Route path="arch/review-templates" element={<ReviewTemplatePage />} />
                <Route path="arch/reviews" element={<ReviewPage />} />
                <Route path="arch/tech-debt" element={<TechDebtPage />} />
                <Route path="arch/ontology-mapping" element={<OntologyMappingPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
