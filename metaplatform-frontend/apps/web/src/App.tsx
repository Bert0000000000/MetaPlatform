import { ConfigProvider as SemiConfigProvider } from '@douyinfe/semi-ui';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import {
  AppLayout,
  AuthProvider,
  AuthGuard,
  ScrollbarAutoHide,
} from '@mate/shared';
import LoginPage from './pages/LoginPage';
import ArchLayout from './pages/arch/ArchLayout';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// 閹虫帒濮炴潪钘夋倗濡€虫健妞ょ敻娼?

const SuperaiOverviewPage = lazy(() => import('./pages/superai/ChatPage'));
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
const SuperaiTaskOrchestrationPage = lazy(() => import('./pages/superai/TaskOrchestrationPage'));
const SuperaiTaskTemplatePage = lazy(() => import('./pages/superai/TaskTemplatePage'));

const ApphubAppListPage = lazy(() => import('./pages/apphub/AppListPage'));
const ApphubAppDetailPage = lazy(() => import('./pages/apphub/AppDetailPage'));
const ApphubAppLifecyclePage = lazy(() => import('./pages/apphub/AppLifecyclePage'));
const ApphubVersionManagementPage = lazy(() => import('./pages/apphub/VersionManagementPage'));
const ApphubReleaseRecordPage = lazy(() => import('./pages/apphub/ReleaseRecordPage'));
const ApphubFormDesignerPage = lazy(() => import('./pages/apphub/FormDesignerPage'));
const ApphubFlowDesignerPage = lazy(() => import('./pages/apphub/FlowDesignerPage'));
const ApphubPageDesignerPage = lazy(() => import('./pages/apphub/PageDesignerPage'));
const ApphubMarketplacePage = lazy(() => import('./pages/apphub/MarketplacePage'));
const ApphubMarketplaceDetailPage = lazy(() => import('./pages/apphub/MarketplaceDetailPage'));
const ApphubMarketPage = lazy(() => import('./pages/apphub/MarketPage'));
const ApphubTemplateDetailPage = lazy(() => import('./pages/apphub/TemplateDetailPage'));
const ApphubMyTemplatesPage = lazy(() => import('./pages/apphub/MyTemplatesPage'));
const ApphubTemplateSubmitPage = lazy(() => import('./pages/apphub/TemplateSubmitPage'));
const ApphubAIDesignerPage = lazy(() => import('./pages/apphub/AIDesignerPage'));
const ApphubRuntimePage = lazy(() => import('./pages/apphub/runtime/AppRuntimePage'));

const OntologyModelingPage = lazy(() => import('./pages/ontology/OntologyModelingPage'));
const OntologyDatacenterPage = lazy(() => import('./pages/ontology/OntologyDatacenterPage'));
const OntologyActionPage = lazy(() => import('./pages/ontology/OntologyActionPage'));
const OntologyGraphPage = lazy(() => import('./pages/ontology/OntologyGraphPage'));
const RelationshipTypeListPage = lazy(() => import('./pages/ontology/relationship-types/RelationshipTypeListPage'));
const ActionTypeListPage = lazy(() => import('./pages/ontology/actions/ActionTypeListPage'));

const DashboardDashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const DashboardMyAppsPage = lazy(() => import('./pages/dashboard/MyAppsPage'));
const DashboardMyAgentsPage = lazy(() => import('./pages/dashboard/MyAgentsPage'));
const DashboardMessagesPage = lazy(() => import('./pages/dashboard/MessagesPage'));
const DashboardPortalPage = lazy(() => import('./pages/dashboard/PortalPage'));
const DashboardNotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const DashboardAiOpsPage = lazy(() => import('./pages/dashboard/AiOpsPage'));
const DashboardSettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const DashboardAdminOverviewPage = lazy(() => import('./pages/dashboard/admin/OverviewPage'));
const DashboardAdminUsersPage = lazy(() => import('./pages/dashboard/admin/UsersPage'));
const DashboardAdminPermissionsPage = lazy(() => import('./pages/dashboard/admin/PermissionsPage'));
const DashboardAdminOrgsPage = lazy(() => import('./pages/dashboard/admin/OrgsPage'));
const DashboardAdminLogsPage = lazy(() => import('./pages/dashboard/admin/LogsPage'));
const DashboardAdminConfigsPage = lazy(() => import('./pages/dashboard/admin/ConfigsPage'));
const DashboardAdminAIProvidersPage = lazy(() => import('./pages/dashboard/admin/AIProvidersPage'));
const DashboardAdminOperationsPage = lazy(() => import('./pages/dashboard/admin/OperationsPage'));
const DashboardAdminAnalyticsPage = lazy(() => import('./pages/dashboard/admin/AnalyticsPage'));
const DashboardAdminComponentDemoPage = lazy(() => import('./pages/dashboard/admin/ComponentDemoPage'));
const DashboardAdminFlowgramDemoPage = lazy(() => import('./pages/dashboard/admin/FlowgramDemoPage'));
const DashboardDeliverablesPage = lazy(() => import('./pages/dashboard/DeliverablesPage'));
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
const KnowledgeBasePage = lazy(() => import('./pages/knowledge/KnowledgeBasePage'));
const KnowledgeDocsPage = lazy(() => import('./pages/knowledge/KnowledgeDocsPage'));
const KnowledgeTestPage = lazy(() => import('./pages/knowledge/KnowledgeTestPage'));
const KnowledgeConfigPage = lazy(() => import('./pages/knowledge/KnowledgeConfigPage'));

const McpToolsPage = lazy(() => import('./pages/mcp/McpToolsPage'));
const McpServerPage = lazy(() => import('./pages/mcp/McpServerPage'));
const McpClientPage = lazy(() => import('./pages/mcp/McpClientPage'));
const McpDebuggerPage = lazy(() => import('./pages/mcp/McpDebuggerPage'));
const McpPermissionsPage = lazy(() => import('./pages/mcp/McpPermissionsPage'));
const McpExternalPage = lazy(() => import('./pages/mcp/McpExternalPage'));
const McpAuditPage = lazy(() => import('./pages/mcp/McpAuditPage'));
const McpOverviewPage = lazy(() => import('./pages/mcp/OverviewPage'));
const McpCenterLayout = lazy(() => import('./pages/mcp/McpCenterLayout'));
const McpSkillHubPage = lazy(() => import('./pages/mcp/SkillHubPage'));
const A2aInternalAgentsPage = lazy(() => import('./pages/mcp/A2aInternalAgentsPage'));
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
const EmployeeListPage = lazy(() => import('./pages/agents/EmployeeListPage'));
const EmployeeCreatePage = lazy(() => import('./pages/agents/EmployeeCreatePage'));
const EmployeeDetailPage = lazy(() => import('./pages/agents/EmployeeDetailPage'));
const TaskListPage = lazy(() => import('./pages/agents/TaskListPage'));
const TaskDetailPage = lazy(() => import('./pages/agents/TaskDetailPage'));
const CollaborationListPage = lazy(() => import('./pages/agents/CollaborationListPage'));
const CollaborationCreatePage = lazy(() => import('./pages/agents/CollaborationCreatePage'));
const CollaborationMonitorPage = lazy(() => import('./pages/agents/CollaborationMonitorPage'));
const EvaluationPage = lazy(() => import('./pages/agents/EvaluationPage'));
const CapabilityConfigPage = lazy(() => import('./pages/agents/CapabilityConfigPage'));
const ExternalAgentsPage = lazy(() => import('./pages/agents/ExternalAgentsPage'));

// DW API consumption routes (GOVERN-08)
const DwEmployeesPage = lazy(() => import('./pages/dw/EmployeesPage'));
const DwEvaluationsPage = lazy(() => import('./pages/dw/EvaluationsPage'));
const DwCollaborationsPage = lazy(() => import('./pages/dw/CollaborationsPage'));
const DwA2APage = lazy(() => import('./pages/dw/A2APage'));
const DwTasksPage = lazy(() => import('./pages/dw/TasksPage'));
const DwLearningPage = lazy(() => import('./pages/dw/LearningPage'));
const DwDocumentsPage = lazy(() => import('./pages/dw/DocumentsPage'));
const DwExtractionPage = lazy(() => import('./pages/dw/ExtractionPage'));
const DwObsPage = lazy(() => import('./pages/dw/ObsPage'));


function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>閸旂姾娴囨稉?..</span>
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
              <AppLayout />
            </AuthGuard>
          }
        >
          {/* 瀹搞儰缍旈崣?Phase 4.2: from apps/dashboard) */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardDashboardPage />} />
          <Route path="dashboard/my-apps" element={<DashboardMyAppsPage />} />
          <Route path="dashboard/my-agents" element={<DashboardMyAgentsPage />} />
          <Route path="dashboard/messages" element={<DashboardMessagesPage />} />
          <Route path="dashboard/portal" element={<DashboardPortalPage />} />
          <Route path="dashboard/notifications" element={<DashboardNotificationsPage />} />
          <Route path="dashboard/deliverables" element={<DashboardDeliverablesPage />} />
          <Route path="dashboard/aiops" element={<DashboardAiOpsPage />} />
          <Route path="dashboard/settings" element={<DashboardSettingsPage />} />

          {/* 閸氬骸褰寸粻锛勬倞(Phase 4.2: from apps/dashboard) */}
          <Route path="admin" element={<DashboardAdminOverviewPage />} />
          <Route path="admin/users" element={<DashboardAdminUsersPage />} />
          <Route path="admin/permissions" element={<DashboardAdminPermissionsPage />} />
          <Route path="admin/orgs" element={<DashboardAdminOrgsPage />} />
          <Route path="admin/logs" element={<DashboardAdminLogsPage />} />
          <Route path="admin/configs" element={<DashboardAdminConfigsPage />} />
          <Route path="admin/ai-providers" element={<DashboardAdminAIProvidersPage />} />
          <Route path="admin/operations" element={<DashboardAdminOperationsPage />} />
          <Route path="admin/analytics" element={<DashboardAdminAnalyticsPage />} />
          <Route path="admin/components" element={<DashboardAdminComponentDemoPage />} />
          <Route path="admin/flowgram" element={<DashboardAdminFlowgramDemoPage />} />
          {/* SuperAI 鐎电鐦芥稉顓炵妇(Phase 4.5: from apps/superai) */}
          <Route path="superai" element={<Navigate to="/superai/chat" replace />} />
          <Route path="superai/chat" element={<SuperaiChatPage />} />
          <Route path="superai/a2a" element={<SuperaiA2ACollaborationPage />} />
          <Route path="superai/copilot" element={<SuperaiAgentCopilotPage />} />
          <Route path="superai/cost" element={<SuperaiCostOptimizationPage />} />
          <Route path="superai/data" element={<SuperaiDataAnalysisPage />} />
          <Route path="superai/employee-match" element={<SuperaiEmployeeMatchingPage />} />
          <Route path="superai/execution" element={<SuperaiExecutionPlanPage />} />
          <Route path="superai/execution/:id" element={<SuperaiExecutionDetailPage />} />
          <Route path="superai/manual-select" element={<SuperaiManualSelectEmployeePage />} />
          <Route path="superai/parallel" element={<SuperaiParallelExecutionPage />} />
          <Route path="superai/report" element={<SuperaiReportExportPage />} />
          <Route path="superai/result-aggregation" element={<SuperaiResultAggregationPage />} />
          <Route path="superai/result-summary" element={<SuperaiResultSummaryPage />} />
          <Route path="superai/schedule" element={<SuperaiScheduleIntentPage />} />
          <Route path="superai/schedule/execute" element={<SuperaiScheduleExecutionPage />} />
          <Route path="superai/schedule/plan" element={<SuperaiSchedulePlanCardPage />} />
          <Route path="superai/tasks" element={<SuperaiTaskOrchestrationPage />} />
          <Route path="superai/templates" element={<SuperaiTaskTemplatePage />} />
          {/* 閺嬭埖鐎稉顓炵妇(Phase 4: from apps/arch) */}
          <Route path="arch" element={<Navigate to="/arch/capabilities" replace />} />
          <Route path="arch/capabilities" element={<ArchLayout><ArchCapabilityManagementPage /></ArchLayout>} />
          <Route path="arch/applications" element={<ArchLayout><ArchApplicationManagementPage /></ArchLayout>} />
          <Route path="arch/value-streams" element={<ArchLayout><ArchValueStreamPage /></ArchLayout>} />
          <Route path="arch/processes" element={<ArchLayout><ArchBusinessProcessPage /></ArchLayout>} />
          <Route path="arch/org-roles" element={<ArchLayout><ArchOrgRolePage /></ArchLayout>} />
          <Route path="arch/data" element={<ArchLayout><ArchDataArchPage /></ArchLayout>} />
          <Route path="arch/data/entities/:id" element={<ArchLayout><ArchDataEntityDetailPage /></ArchLayout>} />
          <Route path="arch/data/flows" element={<ArchLayout><ArchDataFlowPage /></ArchLayout>} />
          <Route path="arch/data/standards" element={<ArchLayout><ArchDataStandardPage /></ArchLayout>} />
          <Route path="arch/data/assets" element={<ArchLayout><ArchDataAssetCatalogPage /></ArchLayout>} />
          <Route path="arch/tech" element={<ArchLayout><ArchTechArchPage /></ArchLayout>} />
          <Route path="arch/tech-components" element={<ArchLayout><ArchTechComponentPage /></ArchLayout>} />
          <Route path="arch/tech-stacks" element={<ArchLayout><ArchTechStackPage /></ArchLayout>} />
          <Route path="arch/deployment-topologies" element={<ArchLayout><ArchDeploymentTopologyPage /></ArchLayout>} />
          <Route path="arch/tech-radar" element={<ArchLayout><ArchTechRadarPage /></ArchLayout>} />
          <Route path="arch/principles" element={<ArchLayout><ArchPrinciplesPage /></ArchLayout>} />
          <Route path="arch/review-templates" element={<ArchLayout><ArchReviewTemplatePage /></ArchLayout>} />
          <Route path="arch/reviews" element={<ArchLayout><ArchReviewPage /></ArchLayout>} />
          <Route path="arch/tech-debt" element={<ArchLayout><ArchTechDebtPage /></ArchLayout>} />
          <Route path="arch/ontology-mapping" element={<ArchLayout><ArchOntologyMappingPage /></ArchLayout>} />

          {/* 閹煎瓨姊婚弫銈嗙▔椤撶偟濡?Phase 2: from apps/apphub) */}
          <Route path="apps" element={<ApphubAppListPage />} />
          <Route path="apps/:appId" element={<ApphubAppDetailPage />} />
          <Route path="apps/:appId/lifecycle" element={<ApphubAppLifecyclePage />} />
          <Route path="apps/:appId/versions" element={<ApphubVersionManagementPage />} />
          <Route path="apps/:appId/versions/:versionId" element={<ApphubReleaseRecordPage />} />
          <Route path="apps/:appId/modules/:moduleId/form-designer" element={<ApphubFormDesignerPage />} />
          <Route path="apps/:appId/modules/:moduleId/flow-designer" element={<ApphubFlowDesignerPage />} />
          <Route path="pages/:pageId" element={<ApphubPageDesignerPage />} />
          <Route path="marketplace" element={<ApphubMarketplacePage />} />
          <Route path="marketplace/:templateId" element={<ApphubMarketplaceDetailPage />} />
          <Route path="market" element={<ApphubMarketPage />} />
          <Route path="market/:templateId" element={<ApphubTemplateDetailPage />} />
          <Route path="my-templates" element={<ApphubMyTemplatesPage />} />
          <Route path="my-templates/submit" element={<ApphubTemplateSubmitPage />} />
          <Route path="ai-designer" element={<ApphubAIDesignerPage />} />

          {/* 閺堫兛缍嬪鏇熸惛 */}
          <Route path="ontology" element={<OntologyModelingPage />} />
          <Route path="ontology/datacenter" element={<OntologyDatacenterPage />} />
          <Route path="ontology/action" element={<OntologyActionPage />} />
          <Route path="ontology/graph" element={<OntologyGraphPage />} />
          {/* GOVERN-12-04 A 路径：模型编辑器拆分路由（概念模型已并入 /ontology 单页） */}
          {/* 旧 object-types 路由重定向到合并后的单页 */}
          <Route path="ontology/object-types" element={<Navigate to="/ontology" replace />} />
          <Route path="ontology/object-types/:rid" element={<Navigate to="/ontology" replace />} />
          <Route path="ontology/relationship-types" element={<RelationshipTypeListPage />} />
          <Route path="ontology/actions" element={<ActionTypeListPage />} />

          {/* 閻儴鐦戞惔?*/}
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="knowledge/docs" element={<KnowledgeDocsPage />} />
          <Route path="knowledge/test" element={<KnowledgeTestPage />} />
          <Route path="knowledge/config" element={<KnowledgeConfigPage />} />

          {/* MCP 娑擃厼绺?/ 三 HUB 布局：SKILL / MCP / A2A */}
          <Route path="mcp" element={<McpCenterLayout />}>
            <Route index element={<Navigate to="/mcp/skill-hub" replace />} />
            {/* SKILL HUB */}
            <Route path="skill-hub" element={<McpSkillHubPage />} />
            {/* MCP HUB（协议层） */}
            <Route path="overview" element={<McpOverviewPage />} />
            <Route path="tools" element={<McpToolsPage />} />
            <Route path="tools/:id" element={<McpToolDetailPage />} />
            <Route path="tools/:id/edit" element={<McpToolEditPage />} />
            <Route path="resources" element={<McpResourceListPage />} />
            <Route path="resources/:id" element={<McpResourceEditPage />} />
            <Route path="prompts" element={<McpPromptTemplatePage />} />
            <Route path="debugger" element={<McpDebuggerPage />} />
            <Route path="ide-config" element={<McpIdeConfigPage />} />
            {/* MCP 服务（协议层） */}
            <Route path="servers" element={<McpServerPage />} />
            <Route path="servers/:id" element={<McpServerDetailPage />} />
            <Route path="clients" element={<McpClientPage />} />
            <Route path="client" element={<McpClientPage />} />
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
            {/* A2A 注册中心（内外 Agent） */}
            <Route path="internal-agents" element={<A2aInternalAgentsPage />} />
            <Route path="external-agents" element={<McpExternalAgentListPage />} />
            <Route path="external" element={<McpExternalPage />} />
            <Route path="integrations" element={<McpExternalPage />} />
            <Route path="trusts" element={<McpTrustManagementPage />} />
            <Route path="collaborations" element={<McpExternalPage />} />
          </Route>
          {/* 閺佹澘鐡ч崨妯轰紣 */}
          <Route path="agents" element={<EmployeeListPage />} />
          <Route path="agents/create" element={<EmployeeCreatePage />} />
          <Route path="agents/:employeeId" element={<EmployeeDetailPage />} />
          <Route path="agents/tasks" element={<TaskListPage />} />
          <Route path="agents/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="agents/collab" element={<CollaborationListPage />} />
          <Route path="agents/collab/create" element={<CollaborationCreatePage />} />
          <Route path="agents/collab/:id" element={<CollaborationMonitorPage />} />
          <Route path="agents/evaluation" element={<EvaluationPage />} />
          <Route path="agents/:employeeId/capabilities" element={<CapabilityConfigPage />} />
          <Route path="agents/external" element={<ExternalAgentsPage />} />          {/* 鍚庡彴绠＄悊锛氱粺涓€浣跨敤 dashboard/admin 椤甸潰锛岄伩鍏嶉噸澶嶈矾鐢卞拰鏈畾涔夌粍浠?*/}

          {/* DW API consumption routes (GOVERN-08) */}
          <Route path="dw/employees" element={<DwEmployeesPage />} />
          <Route path="dw/evaluations" element={<DwEvaluationsPage />} />
          <Route path="dw/collaborations" element={<DwCollaborationsPage />} />
          <Route path="dw/a2a" element={<DwA2APage />} />
          <Route path="dw/tasks" element={<DwTasksPage />} />
          <Route path="dw/learning" element={<DwLearningPage />} />
          <Route path="dw/documents" element={<DwDocumentsPage />} />
          <Route path="dw/extraction" element={<DwExtractionPage />} />
          <Route path="dw/obs" element={<DwObsPage />} />
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
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </SettingsProvider>
    </SemiConfigProvider>
  );
}

export default App;
