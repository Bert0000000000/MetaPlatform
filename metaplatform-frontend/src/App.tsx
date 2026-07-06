import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { RoleProvider } from "@/contexts/RoleContext";
import { Layout } from "@/components/Layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDetailTabs } from "@/components/AppDetailTabs";
import { Package } from "lucide-react";

// Published app (public, no platform layout)
import PublishedApp from "@/pages/PublishedApp";

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
import NewAppWizard from "@/pages/apps/NewAppWizard";
import VibeCoding from "@/pages/apps/VibeCoding";
import WebIDE from "@/pages/apps/WebIDE";
import FormDesigner from "@/pages/apps/FormDesigner";
import FDEWorkbench from "@/pages/apps/FDEWorkbench";
import PageEditor from "@/pages/apps/PageEditor";

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

// 数据中心
import { DataDashboard, DataSourceList, AskData, MetricCenter, DataQuality, ETLTasks, RealTimeMonitor, DecisionPush, DataLakehouse, DataKnowledge, ReportCenter, MasterData } from "@/pages/data/DataCenter";

// 质量中心
import { QualityDashboard, TestCases, BugTracker, PerfMonitor, AIGenerateCases, OntologyTesting, AIUITesting, ProcessTesting, AIBugFix, TestReport } from "@/pages/quality/QualityCenter";

// 知识库
import { KnowledgeDashboard, DocumentList, Categories, KnowledgeGraph, SmartQA, VersionHistory, KnowledgeProcessing, KnowledgeSearch, KnowledgeSubscribe } from "@/pages/knowledge/Knowledge";

// 云市场
import { MarketDashboard, OntologyTemplatesPage, AgentMarketPage, MySubscriptionsPage, DeveloperRankPage, SkillMarketPage, WorkflowTemplatesPage, KnowledgePackagesPage, APILibraryPage } from "@/pages/market/Market";

// 数字员工
import { AgentList, AgentCollaboration, AgentSkills, AgentMonitor, AgentCenter, AgentIdentity, AgentWorkspace, AgentPermissions, AgentModel } from "@/pages/agents/AgentCenter";

// 架构中心
import { BusinessArchitecture, ApplicationArchitecture, DataArchitecture, TechArchitecture } from "@/pages/architecture/Architecture";

// 后台管理
import { AdminDashboard, UserList, RoleList, DepartmentList, MenuConfig, DictionaryList, OperationLog, SystemSettings, OrgStructure, AdminMonitor, AdminBackup, AdminDeploy, AdminBilling, AdminPlugins } from "@/pages/admin/Admin";

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

export default function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <TooltipProvider>
          <Routes>
            {/* Published apps (outside Layout — no sidebar/topbar) */}
            <Route path="/app/:slug" element={<PublishedApp />} />
            <Route path="/app/:slug/page/:pageId" element={<PublishedApp />} />

            {/* Platform routes (with Layout sidebar/topbar) */}
            <Route element={<Layout />}>
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
              <Route path="/apps/new" element={<NewAppWizard />} />
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
              <Route path="/ontology/security" element={<OntologySecurity />} />
              <Route path="/ontology/governance" element={<OntologyGovernance />} />
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
              <Route path="/admin/departments" element={<DepartmentList />} />
              <Route path="/admin/menus" element={<MenuConfig />} />
              <Route path="/admin/dictionary" element={<DictionaryList />} />
              <Route path="/admin/logs" element={<OperationLog />} />
              <Route path="/admin/settings" element={<SystemSettings />} />
              <Route path="/admin/*" element={<AdminDashboard />} />

              {/* 设置快捷路由 → 后台管理设置页 */}
              <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />

              {/* 兜底 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </TooltipProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}