import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Component, type ReactNode } from "react";
import { Toaster } from "sonner";
import { RoleProvider } from "@/contexts/RoleContext";
import { Layout } from "@/components/Layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDetailTabs } from "@/components/AppDetailTabs";
import { Package, AlertTriangle } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

/**
 * Top-level error boundary. Without this, an uncaught exception in any
 * route component (e.g. legacy data shape mismatch) tears down the
 * whole React tree and leaves the user staring at a blank page.
 * This boundary catches the error, shows a friendly recovery panel,
 * and lets the user navigate back without losing the platform shell.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Surface to the dev console so the engineer sees the same stack.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught in route tree:", error, info.componentStack);
  }
  reset = () => {
    this.setState({ error: null });
    // Hard reload to recover from corrupted in-memory state.
    if (typeof window !== "undefined") window.location.assign("/dashboard");
  };
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <AlertTriangle className="size-12 text-destructive mb-3" />
          <h1 className="text-lg font-semibold mb-1">页面加载失败</h1>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            该页面的某个组件抛出了未捕获的异常。通常由旧数据格式与新组件不兼容引起。
          </p>
          <pre className="text-[11px] text-left bg-muted/40 border rounded p-3 max-w-2xl overflow-auto mb-4">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90"
            >
              返回工作台
            </button>
            <button
              onClick={() => location.reload()}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              强制刷新
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Published app (public, no platform layout)
import PublishedApp from "@/pages/PublishedApp";
import PublicForm from "@/pages/PublicForm";
import PublicFormSubmissions from "@/pages/PublicFormSubmissions";

// Login (public, no platform layout)
import Login from "@/pages/Login";

// 通用页面
import { DashboardPage, MyApps, MyAgents, DashboardMessages, Portal, FreePage } from "@/pages/Dashboard";
import { SuperAIPage } from "@/pages/SuperAI";
import { AppsListPage } from "@/pages/AppsList";

// 应用中心
import AppOverview from "@/pages/apps/AppOverview";
import DataModeling from "@/pages/apps/DataModeling";
import Pages from "@/pages/apps/Pages";
import Workflows from "@/pages/apps/Workflows";
import AppConfig from "@/pages/apps/AppConfig";
import AppPublish from "@/pages/apps/AppPublish";
import AppExport from "@/pages/apps/AppExport";
import { NewAppWizard } from "@/pages/apps/NewAppWizard";
import VibeCoding from "@/pages/apps/VibeCoding";
import WebIDE from "@/pages/apps/WebIDE";
import FormDesigner from "@/pages/apps/FormDesigner";
import FDEWorkbench from "@/pages/apps/FDEWorkbench";
import PageEditor from "@/pages/apps/PageEditor";
import WorkflowDesignerPage from "@/pages/apps/WorkflowDesignerPage";
import TodoCenterPage from "@/pages/apps/TodoCenterPage";
import ProcessInstanceDetailPage from "@/pages/apps/ProcessInstanceDetailPage";

// 流程中心
import ProcessList, { ProcessInstances, ProcessApprovals, ProcessTriggers, ProcessAnalysis, ProcessPlatform, ProcessExport } from "@/pages/process/ProcessList";
import ApprovalList from "@/pages/process/ApprovalList";
import Orchestration from "@/pages/process/Orchestration";
import { ProcessDesigner } from "@/pages/process/ProcessDesigner";
import ProcessDesignerV2Page from "@/pages/process/ProcessDesignerV2Page";

// 本体引擎
import Objects from "@/pages/ontology/Objects";
import { OntologyElement, OntologyProperties, OntologyLinks, OntologyActions, OntologyFunctions, OntologyRules, OntologySecurity, OntologyGovernance } from "@/pages/ontology/OntologyTab";
import ObjectDetail from "@/pages/ontology/ObjectDetail";
import OntologyOrchestration from "@/pages/ontology/OntologyOrchestration";
import { Instances } from "@/pages/ontology/Instances";
import { ImpactAnalysis } from "@/pages/ontology/ImpactAnalysis";
import { VersionDiff } from "@/pages/ontology/VersionDiff";
import { OntologyLint } from "@/pages/ontology/OntologyLint";
import { EventStream } from "@/pages/ontology/EventStream";
import { KnowledgeGraph as OntologyGraph } from "@/pages/ontology/KnowledgeGraph";
import { OntologyReasoning } from "@/pages/ontology/OntologyReasoning";
import { OntologyTemplates } from "@/pages/ontology/OntologyTemplates";
import { ReverseEngineer } from "@/pages/ontology/ReverseEngineer";
import { OntologyIO } from "@/pages/ontology/OntologyIO";

// 数据中心
import { DataDashboard, DataSourceList, AskData, MetricCenter, DataQuality, ETLTasks, RealTimeMonitor, DecisionPush, DataLakehouse, DataKnowledge, ReportCenter, MasterData } from "@/pages/data/DataCenter";

// 质量中心
import { QualityDashboard, TestCases, BugTracker, PerfMonitor, AIGenerateCases, OntologyTesting, AIUITesting, ProcessTesting, AIBugFix, TestReport } from "@/pages/quality/QualityCenter";

// 知识库
import { KnowledgeDashboard, DocumentList, Categories, KnowledgeGraph, SmartQA, VersionHistory, KnowledgeProcessing, KnowledgeSearch, KnowledgeSubscribe } from "@/pages/knowledge/Knowledge";

// 云市场
import { MarketDashboard, OntologyTemplatesPage, AgentMarketPage, MySubscriptionsPage, DeveloperRankPage, SkillMarketPage, WorkflowTemplatesPage, KnowledgePackagesPage, APILibraryPage } from "@/pages/market/Market";
import PublishedMarket from "@/pages/market/PublishedMarket";

// 数字员工
import { AgentList, AgentCollaboration, AgentSkills, AgentMonitor, AgentCenter, AgentIdentity, AgentWorkspace, AgentPermissions, AgentModel } from "@/pages/agents/AgentCenter";

// 架构中心
import { BusinessArchitecture, ApplicationArchitecture, DataArchitecture, TechArchitecture } from "@/pages/architecture/Architecture";

// 后台管理
import { AdminDashboard, UserList, RoleList, DepartmentList, MenuConfig, DictionaryList, OperationLog, SystemSettings, OrgStructure, AdminMonitor, AdminBackup, AdminDeploy, AdminBilling, AdminPlugins, AdminTenants, AdminClusters, AdminAudit, AdminLicense, AdminRuntimes, AdminFlags } from "@/pages/admin/Admin";
import { AdminRuntime } from "@/pages/admin/AdminRuntime";
import { SchedulerPage } from "@/pages/admin/Scheduler";
import { WebhooksPage } from "@/pages/admin/Webhooks";
import ApiKeysPage from "@/pages/settings/ApiKeys";

function AppsListNewRedirect() {
  // /apps/new — open the wizard inline, then navigate back to the list
  // once the wizard closes. Keeping it as a real route so deep-links and
  // shareable URLs work for power-users.
  return (
    <div className="container mx-auto py-12 text-center text-sm text-muted-foreground">
      正在打开新建应用向导…
      <NewAppWizard
        open
        onOpenChange={(o: boolean) => { if (!o) window.location.href = "/apps"; }}
      />
    </div>
  );
}

function AppDetailPlaceholder() {
  return (
    <div className="flex flex-col h-full">
      <AppDetailTabs />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4"><Package className="size-10" /></div>
          <h2 className="text-lg font-semibold">应用详情</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            请选择上方 Tab 访问应用详情
          </p>
        </div>
      </div>
    </div>
  );
}

function OntologyElementWrapper() {
  const params = useParams<{ elementKey: string }>();
  return <OntologyElement elementKey={params.elementKey ?? "1-objects"} />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <TooltipProvider>
          <Toaster position="top-right" />
          <ErrorBoundary>
          <Routes>
            {/* Login (public) */}
            <Route path="/login" element={<Login />} />

            {/* Published apps (outside Layout — no sidebar/topbar) */}
            <Route path="/app/:slug" element={<PublishedApp />} />
            <Route path="/app/:slug/page/:pageId" element={<PublishedApp />} />

            {/* Public forms (outside Layout) */}
            <Route path="/public/form/:appId" element={<PublicForm />} />
            <Route path="/public/forms/:formId/submissions" element={<PublicFormSubmissions />} />

            {/* Platform routes (with Layout sidebar/topbar) */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              {/* 默认 */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* 1. Dashbaord */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/myapps" element={<MyApps />} />
              <Route path="/dashboard/myagents" element={<MyAgents />} />
              <Route path="/dashboard/messages" element={<DashboardMessages />} />
              <Route path="/dashboard/portal" element={<Portal />} />
              <Route path="/dashboard/freepage" element={<FreePage />} />
              <Route path="/dashboard/*" element={<DashboardPage />} />

              {/* 2. SuperAI */}
              <Route path="/superai" element={<SuperAIPage />} />
              <Route path="/superai/*" element={<SuperAIPage />} />

              {/* 3. 架构中心 */}
              <Route path="/architecture" element={<BusinessArchitecture />} />
              <Route path="/architecture/business" element={<BusinessArchitecture />} />
              <Route path="/architecture/application" element={<ApplicationArchitecture />} />
              <Route path="/architecture/data" element={<DataArchitecture />} />
              <Route path="/architecture/tech" element={<TechArchitecture />} />
              <Route path="/architecture/*" element={<BusinessArchitecture />} />

              {/* 4. 应用中心 */}
              <Route path="/apps" element={<AppsListPage />} />
              <Route path="/apps/new" element={<AppsListNewRedirect />} />
              <Route path="/apps/vibe" element={<VibeCoding />} />
              <Route path="/apps/form" element={<FormDesigner />} />
              <Route path="/apps/:appId" element={<AppDetailPlaceholder />} />
              <Route path="/apps/:appId/overview" element={<AppOverview />} />
              <Route path="/apps/:appId/datamodeling" element={<DataModeling />} />
              <Route path="/apps/:appId/pages" element={<Pages />} />
              <Route path="/apps/:appId/workflows" element={<Workflows />} />
              <Route path="/apps/:appId/config" element={<AppConfig />} />
              <Route path="/apps/:appId/publish" element={<AppPublish />} />
              <Route path="/apps/:appId/export" element={<AppExport />} />
              <Route path="/apps/:appId/ide" element={<WebIDE />} />
              <Route path="/apps/:appId/fde" element={<FDEWorkbench />} />
              <Route path="/apps/:appId/page-editor" element={<PageEditor />} />
              <Route path="/apps/:appId/workflow-designer" element={<WorkflowDesignerPage />} />
              <Route path="/apps/:appId/todos" element={<TodoCenterPage />} />
              <Route path="/apps/:appId/process-instances/:processInstanceId" element={<ProcessInstanceDetailPage />} />

              {/* 5. 流程中心 */}
              <Route path="/process" element={<ProcessList />} />
              <Route path="/process/business" element={<ProcessList />} />
              <Route path="/process/designer" element={<ProcessDesignerV2Page />} />
              <Route path="/process/designer/:definitionId" element={<ProcessDesignerV2Page />} />
              <Route path="/process/approval" element={<ApprovalList />} />
              <Route path="/process/orchestration" element={<Orchestration />} />
              <Route path="/process/instances" element={<ProcessInstances />} />
              <Route path="/process/approvals" element={<ProcessApprovals />} />
              <Route path="/process/triggers" element={<ProcessTriggers />} />
              <Route path="/process/analysis" element={<ProcessAnalysis />} />
              <Route path="/process/platform" element={<ProcessPlatform />} />
              <Route path="/process/export" element={<ProcessExport />} />
              <Route path="/process/*" element={<ProcessList />} />

              {/* 6. 数据中心 */}
              <Route path="/data" element={<DataDashboard />} />
              <Route path="/data/dashboard" element={<DataDashboard />} />
              <Route path="/data/ask" element={<AskData />} />
              <Route path="/data/metrics" element={<MetricCenter />} />
              <Route path="/data/sources" element={<DataSourceList />} />
              <Route path="/data/quality" element={<DataQuality />} />
              <Route path="/data/etl" element={<ETLTasks />} />
              <Route path="/data/realtime" element={<RealTimeMonitor />} />
              <Route path="/data/decision" element={<DecisionPush />} />
              <Route path="/data/lakehouse" element={<DataLakehouse />} />
              <Route path="/data/knowledge" element={<DataKnowledge />} />
              <Route path="/data/reports" element={<ReportCenter />} />
              <Route path="/data/masterdata" element={<MasterData />} />
              <Route path="/data/*" element={<DataDashboard />} />

              {/* 7. 本体引擎 */}
              <Route path="/ontology" element={<Objects />} />
              <Route path="/ontology/objects" element={<Objects />} />
              <Route path="/ontology/properties" element={<OntologyProperties />} />
              <Route path="/ontology/links" element={<OntologyLinks />} />
              <Route path="/ontology/actions" element={<OntologyActions />} />
              <Route path="/ontology/functions" element={<OntologyFunctions />} />
              <Route path="/ontology/rules" element={<OntologyRules />} />
              <Route path="/ontology/orchestration" element={<OntologyOrchestration />} />
              <Route path="/ontology/security" element={<OntologySecurity />} />
              <Route path="/ontology/governance" element={<OntologyGovernance />} />
              <Route path="/ontology/instances" element={<Instances />} />
              <Route path="/ontology/impact" element={<ImpactAnalysis />} />
              <Route path="/ontology/diff" element={<VersionDiff />} />
              <Route path="/ontology/lint" element={<OntologyLint />} />
              <Route path="/ontology/events" element={<EventStream />} />
              <Route path="/ontology/graph" element={<OntologyGraph />} />
              <Route path="/ontology/reasoning" element={<OntologyReasoning />} />
              <Route path="/ontology/templates" element={<OntologyTemplates />} />
              <Route path="/ontology/reverse" element={<ReverseEngineer />} />
              <Route path="/ontology/io" element={<OntologyIO />} />
              <Route path="/ontology/object/:objectId" element={<ObjectDetail />} />
              <Route path="/ontology/element/:elementKey" element={<OntologyElementWrapper />} />

              {/* 8. 质量中心 */}
              <Route path="/quality" element={<QualityDashboard />} />
              <Route path="/quality/cases" element={<TestCases />} />
              <Route path="/quality/ontology-test" element={<OntologyTesting />} />
              <Route path="/quality/ai-ui" element={<AIUITesting />} />
              <Route path="/quality/process-test" element={<ProcessTesting />} />
              <Route path="/quality/bug-fix" element={<AIBugFix />} />
              <Route path="/quality/report" element={<TestReport />} />
              <Route path="/quality/bugs" element={<BugTracker />} />
              <Route path="/quality/perf" element={<PerfMonitor />} />
              <Route path="/quality/ai" element={<AIGenerateCases />} />
              <Route path="/quality/*" element={<QualityDashboard />} />

              {/* 9. 知识库 */}
              <Route path="/knowledge" element={<KnowledgeDashboard />} />
              <Route path="/knowledge/documents" element={<DocumentList />} />
              <Route path="/knowledge/categories" element={<Categories />} />
              <Route path="/knowledge/graph" element={<KnowledgeGraph />} />
              <Route path="/knowledge/qa" element={<SmartQA />} />
              <Route path="/knowledge/history" element={<VersionHistory />} />
              <Route path="/knowledge/process" element={<KnowledgeProcessing />} />
              <Route path="/knowledge/search" element={<KnowledgeSearch />} />
              <Route path="/knowledge/subscribe" element={<KnowledgeSubscribe />} />
              <Route path="/knowledge/*" element={<KnowledgeDashboard />} />

              {/* 10. 云市场 */}
              <Route path="/market" element={<MarketDashboard />} />
              <Route path="/market/ontology-templates" element={<OntologyTemplatesPage />} />
              <Route path="/market/skills" element={<SkillMarketPage />} />
              <Route path="/market/agents" element={<AgentMarketPage />} />
              <Route path="/market/workflows" element={<WorkflowTemplatesPage />} />
              <Route path="/market/knowledge" element={<KnowledgePackagesPage />} />
              <Route path="/market/api" element={<APILibraryPage />} />
              <Route path="/market/public" element={<PublishedMarket />} />
              <Route path="/market/subscriptions" element={<MySubscriptionsPage />} />
              <Route path="/market/rank" element={<DeveloperRankPage />} />
              <Route path="/market/*" element={<MarketDashboard />} />

              {/* 11. 数字员工 */}
              <Route path="/agents" element={<AgentCenter />} />
              <Route path="/agents/mine" element={<AgentList />} />
              <Route path="/agents/collaboration" element={<AgentCollaboration />} />
              <Route path="/agents/identity" element={<AgentIdentity />} />
              <Route path="/agents/workspace" element={<AgentWorkspace />} />
              <Route path="/agents/permissions" element={<AgentPermissions />} />
              <Route path="/agents/model" element={<AgentModel />} />
              <Route path="/agents/list" element={<AgentList />} />
              <Route path="/agents/skills" element={<AgentSkills />} />
              <Route path="/agents/collab" element={<AgentCollaboration />} />
              <Route path="/agents/monitor" element={<AgentMonitor />} />
              <Route path="/agents/*" element={<AgentCenter />} />

              {/* 12. 后台管理 */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserList />} />
              <Route path="/admin/roles" element={<RoleList />} />
              <Route path="/admin/org" element={<OrgStructure />} />
              <Route path="/admin/monitor" element={<AdminMonitor />} />
              <Route path="/admin/backup" element={<AdminBackup />} />
              <Route path="/admin/deploy" element={<AdminDeploy />} />
              <Route path="/admin/billing" element={<AdminBilling />} />
              <Route path="/admin/plugins" element={<AdminPlugins />} />
              <Route path="/admin/runtime" element={<AdminRuntime />} />
              <Route path="/admin/api-keys" element={<ApiKeysPage />} />
              <Route path="/admin/scheduler" element={<SchedulerPage />} />
              <Route path="/admin/webhooks" element={<WebhooksPage />} />
              <Route path="/admin/departments" element={<DepartmentList />} />
              <Route path="/admin/menus" element={<MenuConfig />} />
              <Route path="/admin/dictionary" element={<DictionaryList />} />
              <Route path="/admin/logs" element={<OperationLog />} />
              <Route path="/admin/settings" element={<SystemSettings />} />
              <Route path="/admin/tenants" element={<AdminTenants />} />
              <Route path="/admin/clusters" element={<AdminClusters />} />
              <Route path="/admin/audit" element={<AdminAudit />} />
              <Route path="/admin/license" element={<AdminLicense />} />
              <Route path="/admin/runtimes" element={<AdminRuntimes />} />
              <Route path="/admin/flags" element={<AdminFlags />} />
              <Route path="/admin/*" element={<AdminDashboard />} />

              {/* 设置快捷路由 → 后台管理设置页 */}
              <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />

              {/* 兜底 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
          </ErrorBoundary>
        </TooltipProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}