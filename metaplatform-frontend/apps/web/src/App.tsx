import { ConfigProvider as SemiConfigProvider } from '@douyinfe/semi-ui';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, AuthGuard, ScrollbarAutoHide, type ModuleTab } from '@mate/shared';
import LoginPage from './pages/LoginPage';
import { SettingsProvider } from './contexts/SettingsContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppShell from './components/shell/AppShell';
import { legacyRedirectRoutes } from './routes/legacy-redirects';
import { ontologyRoutes } from './routes/ontology';
import { adminRoutes } from './routes/admin';
import { homeRoutes } from './routes/home';
import { agentsRoutes } from './routes/agents';

/**
 * 新信息架构（11 域 → 8 域，DESIGN-SPEC §2）。
 * 本文件只负责「新 IA 路由注册」；旧路径 301 全部集中在 src/routes/legacy-redirects.tsx。
 * 页内 tab 的定义在 src/components/shell/domains.tsx（单一事实源）。
 */

// ---------- 平台管理 ----------

// ---------- 数字员工 ----------

// DW API consumption routes (GOVERN-08)

// ---------- SuperAI ----------
const SuperaiChatPage = lazy(() => import('./pages/superai/ChatPage'));
const SuperaiA2ACollaborationPage = lazy(() => import('./pages/superai/A2ACollaborationPage'));
const SuperaiAgentCopilotPage = lazy(() => import('./pages/superai/AgentCopilotPage'));
const SuperaiCostOptimizationPage = lazy(() => import('./pages/superai/CostOptimizationPage'));
const SuperaiDataAnalysisPage = lazy(() => import('./pages/superai/DataAnalysisPage'));
const SuperaiEmployeeMatchingPage = lazy(() => import('./pages/superai/EmployeeMatchingPage'));
const SuperaiExecutionDetailPage = lazy(() => import('./pages/superai/ExecutionDetailPage'));
const SuperaiExecutionPlanPage = lazy(() => import('./pages/superai/ExecutionPlanPage'));
const SuperaiManualSelectEmployeePage = lazy(() => import('./pages/superai/ManualSelectEmployeePage'));
const SuperaiParallelExecutionPage = lazy(() => import('./pages/superai/ParallelExecutionPage'));
const SuperaiReportExportPage = lazy(() => import('./pages/superai/ReportExportPage'));
const SuperaiResultAggregationPage = lazy(() => import('./pages/superai/ResultAggregationPage'));
const SuperaiResultSummaryPage = lazy(() => import('./pages/superai/ResultSummaryPage'));
const SuperaiScheduleExecutionPage = lazy(() => import('./pages/superai/ScheduleExecutionPage'));
const SuperaiScheduleIntentPage = lazy(() => import('./pages/superai/ScheduleIntentPage'));
const SuperaiSchedulePlanCardPage = lazy(() => import('./pages/superai/SchedulePlanCardPage'));
const SuperaiTaskTemplatePage = lazy(() => import('./pages/superai/TaskTemplatePage'));
const SuperaiOrderReviewPage = lazy(() => import('./pages/superai/OrderReviewPage'));
const SuperaiOrchestrationConsolePage = lazy(() => import('./pages/superai/OrchestrationConsolePage'));
const ActionOrchestrationPage = lazy(() => import('./pages/wfe/ActionOrchestrationPage'));

// ---------- 应用中心 ----------
const ApphubShellPage = lazy(() => import('./pages/apphub/ApphubShellPage'));
const ApphubRuntimePage = lazy(() => import('./pages/apphub/runtime/AppRuntimePage'));

// ---------- 知识与集成 ----------
const KnowledgeLayout = lazy(() => import('./pages/knowledge/KnowledgeLayout'));
const KnowledgeBasePage = lazy(() => import('./pages/knowledge/KnowledgeBasePage'));
const KnowledgeDocsPage = lazy(() => import('./pages/knowledge/KnowledgeDocsPage'));
const KnowledgeTestPage = lazy(() => import('./pages/knowledge/KnowledgeTestPage'));
const KnowledgeConfigPage = lazy(() => import('./pages/knowledge/KnowledgeConfigPage'));
const KnowledgeKbDetailPage = lazy(() => import('./pages/knowledge/KnowledgeKbDetailPage'));

const McpCenterLayout = lazy(() => import('./pages/mcp/McpCenterLayout'));
const McpToolsPage = lazy(() => import('./pages/mcp/McpToolsPage'));
const McpServerPage = lazy(() => import('./pages/mcp/McpServerPage'));
const McpClientPage = lazy(() => import('./pages/mcp/McpClientPage'));
const McpDebuggerPage = lazy(() => import('./pages/mcp/McpDebuggerPage'));
const McpPermissionsPage = lazy(() => import('./pages/mcp/McpPermissionsPage'));
const McpAuditPage = lazy(() => import('./pages/mcp/McpAuditPage'));
const McpOverviewPage = lazy(() => import('./pages/mcp/OverviewPage'));
const McpSkillHubPage = lazy(() => import('./pages/mcp/SkillHubPage'));
const A2aInternalAgentsPage = lazy(() => import('./pages/mcp/A2aInternalAgentsPage'));
const A2aIntegrationGuidePage = lazy(() => import('./pages/mcp/A2aIntegrationGuidePage'));
const McpConnectionMonitorPage = lazy(() => import('./pages/mcp/ConnectionMonitorPage'));
const McpToolDetailPage = lazy(() => import('./pages/mcp/ToolDetailPage'));
const McpToolEditPage = lazy(() => import('./pages/mcp/ToolEditPage'));
const McpServerDetailPage = lazy(() => import('./pages/mcp/ServerDetailPage'));
const McpClientDetailPage = lazy(() => import('./pages/mcp/ClientDetailPage'));
const McpClientFormPage = lazy(() => import('./pages/mcp/ClientFormPage'));
const McpResourceListPage = lazy(() => import('./pages/mcp/ResourceListPage'));
const McpResourceEditPage = lazy(() => import('./pages/mcp/ResourceEditPage'));
const McpPromptTemplatePage = lazy(() => import('./pages/mcp/PromptTemplatePage'));
const McpPermissionRulePage = lazy(() => import('./pages/mcp/PermissionRulePage'));
const McpPolicyManagementPage = lazy(() => import('./pages/mcp/PolicyManagementPage'));
const McpIdeConfigPage = lazy(() => import('./pages/mcp/IdeConfigPage'));
const McpExternalAgentListPage = lazy(() => import('./pages/mcp/ExternalAgentListPage'));
const McpTrustManagementPage = lazy(() => import('./pages/mcp/TrustManagementPage'));
const McpAuditDetailPage = lazy(() => import('./pages/mcp/AuditDetailPage'));
const McpAuditStatisticsPage = lazy(() => import('./pages/mcp/AuditStatisticsPage'));

// ---------- 数据与治理 ----------
const ArchLayout = lazy(() => import('./pages/arch/ArchLayout'));
const ArchBusinessArchPage = lazy(() => import('./pages/arch/BusinessArchPage'));
const ArchApplicationManagementPage = lazy(() => import('./pages/arch/ApplicationManagementPage'));
const ArchCapabilityManagementPage = lazy(() => import('./pages/arch/CapabilityManagementPage'));
const ArchValueStreamPage = lazy(() => import('./pages/arch/ValueStreamPage'));
const ArchBusinessProcessPage = lazy(() => import('./pages/arch/BusinessProcessPage'));
const ArchOrgRolePage = lazy(() => import('./pages/arch/OrgRolePage'));
const ArchDataArchPage = lazy(() => import('./pages/arch/DataArchPage'));
const ArchDataEntityDetailPage = lazy(() => import('./pages/arch/DataEntityDetailPage'));
const ArchDataFlowPage = lazy(() => import('./pages/arch/DataFlowPage'));
const ArchDataStandardPage = lazy(() => import('./pages/arch/DataStandardPage'));
const ArchDataAssetCatalogPage = lazy(() => import('./pages/arch/DataAssetCatalogPage'));
const ArchTechArchPage = lazy(() => import('./pages/arch/TechArchPage'));
const ArchTechComponentPage = lazy(() => import('./pages/arch/TechComponentPage'));
const ArchTechStackPage = lazy(() => import('./pages/arch/TechStackPage'));
const ArchDeploymentTopologyPage = lazy(() => import('./pages/arch/DeploymentTopologyPage'));
const ArchTechRadarPage = lazy(() => import('./pages/arch/TechRadarPage'));
const ArchPrinciplesPage = lazy(() => import('./pages/arch/PrinciplesPage'));
const ArchReviewTemplatePage = lazy(() => import('./pages/arch/ReviewTemplatePage'));
const ArchReviewPage = lazy(() => import('./pages/arch/ReviewPage'));
const ArchTechDebtPage = lazy(() => import('./pages/arch/TechDebtPage'));
const ArchOntologyMappingPage = lazy(() => import('./pages/arch/OntologyMappingPage'));

/* ---------- 域内二级 tab 定义（/gov、/ki、/agents 交给旧布局承载，但路径换新 IA） ---------- */
const GOV_TABS: ModuleTab[] = [
  {
    key: 'business',
    label: '业务架构',
    path: '/gov/business',
    matchPaths: [
      '/gov/business/capabilities',
      '/gov/business/applications',
      '/gov/business/value-streams',
      '/gov/business/processes',
      '/gov/business/org-roles',
    ],
  },
  {
    key: 'data',
    label: '数据架构',
    path: '/gov/data',
    matchPaths: ['/gov/data/flows', '/gov/data/standards', '/gov/data/assets', '/gov/data/entities'],
  },
  {
    key: 'tech',
    label: '技术架构',
    path: '/gov/tech',
    matchPaths: ['/gov/tech/components', '/gov/tech/stacks', '/gov/tech/topologies', '/gov/tech/radar'],
  },
  {
    key: 'governance',
    label: '治理',
    path: '/gov/governance',
    matchPaths: [
      '/gov/governance/principles',
      '/gov/governance/reviews',
      '/gov/governance/review-templates',
      '/gov/governance/tech-debt',
      '/gov/governance/ontology-mapping',
    ],
  },
];

const KI_TABS: ModuleTab[] = [
  { key: 'kb', label: '知识库', path: '/ki/kb', matchPaths: ['/ki/kb/docs', '/ki/kb/config'] },
  {
    key: 'mcp',
    label: 'MCP 工具',
    path: '/ki/mcp',
    matchPaths: [
      '/ki/mcp/tools',
      '/ki/mcp/servers',
      '/ki/mcp/clients',
      '/ki/mcp/debugger',
      '/ki/mcp/permissions',
      '/ki/mcp/audit',
      '/ki/mcp/connection-monitor',
    ],
  },
  { key: 'a2a', label: 'A2A', path: '/ki/a2a', matchPaths: ['/ki/a2a/external-agents', '/ki/a2a/trusts'] },
  { key: 'test', label: '检索测试', path: '/ki/test' },
];


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

            {/* ---------- 4. SuperAI ---------- */}
            <Route path="superai" element={<Navigate to="/superai/chat" replace />} />
            <Route path="superai/chat" element={<SuperaiChatPage />} />
            <Route path="superai/chat/copilot" element={<SuperaiAgentCopilotPage />} />
            <Route path="superai/plans" element={<SuperaiExecutionPlanPage />} />
            <Route path="superai/plans/exec/:id" element={<SuperaiExecutionDetailPage />} />
            <Route path="superai/plans/a2a" element={<SuperaiA2ACollaborationPage />} />
            <Route path="superai/plans/orchestration" element={<SuperaiOrchestrationConsolePage />} />
            <Route path="superai/plans/manual-select" element={<SuperaiManualSelectEmployeePage />} />
            <Route path="superai/plans/parallel" element={<SuperaiParallelExecutionPage />} />
            <Route path="superai/plans/result-aggregation" element={<SuperaiResultAggregationPage />} />
            <Route path="superai/plans/result-summary" element={<SuperaiResultSummaryPage />} />
            <Route path="superai/plans/employee-match" element={<SuperaiEmployeeMatchingPage />} />
            {/* 参数名保持 definitionId：ActionOrchestrationPage 以该 key 读取路由参数 */}
            <Route path="superai/plans/:definitionId" element={<ActionOrchestrationPage />} />
            <Route path="superai/schedules" element={<SuperaiScheduleIntentPage />} />
            <Route path="superai/schedules/execute" element={<SuperaiScheduleExecutionPage />} />
            <Route path="superai/schedules/plan" element={<SuperaiSchedulePlanCardPage />} />
            <Route path="superai/cost" element={<SuperaiCostOptimizationPage />} />
            <Route path="superai/cost/data" element={<SuperaiDataAnalysisPage />} />
            <Route path="superai/cost/report" element={<SuperaiReportExportPage />} />
            <Route path="superai/templates" element={<SuperaiTaskTemplatePage />} />

            {/* ---------- 5. 应用中心 ---------- */}
            <Route path="apps/mine" element={<ApphubShellPage defaultTab="list" />} />
            <Route path="apps/market" element={<ApphubShellPage defaultTab="market" />} />
            <Route path="apps/templates" element={<ApphubShellPage defaultTab="my-templates" />} />
            <Route path="apps/designer" element={<ApphubShellPage defaultTab="ai-designer" />} />
            <Route path="apps/order-review" element={<SuperaiOrderReviewPage />} />

            {/* ---------- 6. 知识与集成 ---------- */}
            <Route path="ki" element={<Navigate to="/ki/kb" replace />} />
            <Route
              path="ki/kb"
              element={
                <KnowledgeLayout tabs={KI_TABS}>
                  <KnowledgeBasePage />
                </KnowledgeLayout>
              }
            />
            <Route
              path="ki/kb/docs"
              element={
                <KnowledgeLayout tabs={KI_TABS}>
                  <KnowledgeDocsPage />
                </KnowledgeLayout>
              }
            />
            <Route
              path="ki/kb/config"
              element={
                <KnowledgeLayout tabs={KI_TABS}>
                  <KnowledgeConfigPage />
                </KnowledgeLayout>
              }
            />
            <Route
              path="ki/kb/test"
              element={
                <KnowledgeLayout tabs={KI_TABS}>
                  <KnowledgeTestPage />
                </KnowledgeLayout>
              }
            />
            <Route
              path="ki/kb/:kbId"
              element={
                <KnowledgeLayout tabs={KI_TABS}>
                  <KnowledgeKbDetailPage />
                </KnowledgeLayout>
              }
            />
            <Route
              path="ki/test"
              element={
                <KnowledgeLayout tabs={KI_TABS}>
                  <KnowledgeTestPage />
                </KnowledgeLayout>
              }
            />

            <Route path="ki/mcp" element={<McpCenterLayout basePath="/ki/mcp" />}>
              <Route index element={<Navigate to="/ki/mcp/tools" replace />} />
              <Route path="overview" element={<McpOverviewPage />} />
              <Route path="skill-hub" element={<McpSkillHubPage />} />
              <Route path="tools" element={<McpToolsPage />} />
              <Route path="tools/:id" element={<McpToolDetailPage />} />
              <Route path="tools/:id/edit" element={<McpToolEditPage />} />
              <Route path="resources" element={<McpResourceListPage />} />
              <Route path="resources/:id" element={<McpResourceEditPage />} />
              <Route path="prompts" element={<McpPromptTemplatePage />} />
              <Route path="debugger" element={<McpDebuggerPage />} />
              <Route path="ide-config" element={<McpIdeConfigPage />} />
              <Route path="servers" element={<McpServerPage />} />
              <Route path="servers/:id" element={<McpServerDetailPage />} />
              <Route path="clients" element={<McpClientPage />} />
              <Route path="clients/new" element={<McpClientFormPage />} />
              <Route path="clients/:id" element={<McpClientDetailPage />} />
              <Route path="permissions" element={<McpPermissionsPage />} />
              <Route path="permissions/rules" element={<McpPermissionRulePage />} />
              <Route path="policies" element={<McpPolicyManagementPage />} />
              <Route path="matrix" element={<McpPolicyManagementPage />} />
              <Route path="audit" element={<McpAuditPage />} />
              <Route path="audit/detail/:id" element={<McpAuditDetailPage />} />
              <Route path="audit/stats" element={<McpAuditStatisticsPage />} />
              <Route path="connection-monitor" element={<McpConnectionMonitorPage />} />
            </Route>

            <Route path="ki/a2a" element={<McpCenterLayout basePath="/ki/a2a" initialHub="a2a" />}>
              <Route index element={<Navigate to="/ki/a2a/internal-agents" replace />} />
              <Route path="internal-agents" element={<A2aInternalAgentsPage />} />
              <Route path="external-agents" element={<McpExternalAgentListPage />} />
              <Route path="trusts" element={<McpTrustManagementPage />} />
              <Route path="a2a-guide" element={<A2aIntegrationGuidePage />} />
              <Route path="overview" element={<Navigate to="/ki/mcp/overview" replace />} />
              <Route path="skill-hub" element={<Navigate to="/ki/mcp/skill-hub" replace />} />
            </Route>

            {/* ---------- 7. 数据与治理 ---------- */}
            <Route
              path="gov/business"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchBusinessArchPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/business/capabilities"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchCapabilityManagementPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/business/applications"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchApplicationManagementPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/business/value-streams"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchValueStreamPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/business/processes"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchBusinessProcessPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/business/org-roles"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchOrgRolePage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/data"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchDataArchPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/data/entities/:id"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchDataEntityDetailPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/data/flows"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchDataFlowPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/data/standards"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchDataStandardPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/data/assets"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchDataAssetCatalogPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/tech"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchTechArchPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/tech/components"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchTechComponentPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/tech/stacks"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchTechStackPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/tech/topologies"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchDeploymentTopologyPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/tech/radar"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchTechRadarPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/governance"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchPrinciplesPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/governance/principles"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchPrinciplesPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/governance/reviews"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchReviewPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/governance/review-templates"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchReviewTemplatePage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/governance/tech-debt"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchTechDebtPage />
                </ArchLayout>
              }
            />
            <Route
              path="gov/governance/ontology-mapping"
              element={
                <ArchLayout tabs={GOV_TABS}>
                  <ArchOntologyMappingPage />
                </ArchLayout>
              }
            />

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
