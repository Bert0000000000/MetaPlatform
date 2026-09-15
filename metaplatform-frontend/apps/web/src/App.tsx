import { ConfigProvider as SemiConfigProvider } from '@douyinfe/semi-ui';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, AuthGuard, ScrollbarAutoHide } from '@mate/shared';
import LoginPage from './pages/LoginPage';
import { SettingsProvider } from './contexts/SettingsContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppShell from './components/shell/AppShell';
import { legacyRedirectRoutes } from './routes/legacy-redirects';
import { ontologyRoutes } from './routes/ontology';
import { adminRoutes } from './routes/admin';
import { homeRoutes } from './routes/home';
import { agentsRoutes } from './routes/agents';
import { superaiRoutes } from './routes/superai';
import { govRoutes } from './routes/gov';
import { kiRoutes } from './routes/ki';
const SuperaiOrderReviewPage = lazy(() => import('./pages/superai/OrderReviewPage'));

/**
 * 新信息架构（11 域 → 8 域，DESIGN-SPEC §2）。
 * 本文件只负责「新 IA 路由注册」；旧路径 301 全部集中在 src/routes/legacy-redirects.tsx。
 * 页内 tab 的定义在 src/components/shell/domains.tsx（单一事实源）。
 */

// ---------- 平台管理 ----------

// ---------- 数字员工 ----------

// DW API consumption routes (GOVERN-08)

// ---------- SuperAI ----------

// ---------- 应用中心 ----------
const ApphubShellPage = lazy(() => import('./pages/apphub/ApphubShellPage'));
const ApphubRuntimePage = lazy(() => import('./pages/apphub/runtime/AppRuntimePage'));

// ---------- 知识与集成（域路由见 src/routes/ki.tsx） ----------

// ---------- 数据与治理 ----------

function Loading() {
  return (
    <div className="mp-loading">
      <span className="mp-loading-text">加载中…</span>
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <ScrollbarAutoHide />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/s/:code" element={<ApphubRuntimePage />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <AppShell />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/home" replace />} />

            {/* ---------- 1. 工作台（域路由见 src/routes/home.tsx） ---------- */}
            {homeRoutes}

            {/* ---------- 2. 本体（域路由见 src/routes/ontology.tsx） ---------- */}
            {ontologyRoutes}

            {/* ---------- 3. 数字员工（域路由见 src/routes/agents.tsx） ---------- */}
            {agentsRoutes}

            {/* ---------- 4. SuperAI（域路由见 src/routes/superai.tsx） ---------- */}
            {superaiRoutes}

            {/* ---------- 5. 应用中心（主 tab 由路径驱动，见 pages/apphub/ApphubShellPage.tsx） ---------- */}
            <Route path="apps/mine" element={<ApphubShellPage />} />
            <Route path="apps/market" element={<ApphubShellPage />} />
            <Route path="apps/templates" element={<ApphubShellPage />} />
            <Route path="apps/designer" element={<ApphubShellPage />} />
            <Route path="apps/order-review" element={<SuperaiOrderReviewPage />} />

            {/* ---------- 6. 知识与集成（域路由见 src/routes/ki.tsx） ---------- */}
            {kiRoutes}

            {/* ---------- 7. 数据与治理（域路由见 src/routes/gov.tsx） ---------- */}
            {govRoutes}

            {/* ---------- 8. 平台管理（域路由见 src/routes/admin.tsx） ---------- */}
            {adminRoutes}

            {/* ---------- 旧路由 301（集中在 src/routes/legacy-redirects.tsx） ---------- */}
            {legacyRedirectRoutes}

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <SemiConfigProvider locale={zh_CN}>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </SettingsProvider>
    </SemiConfigProvider>
  );
}

export default App;
