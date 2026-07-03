import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RoleProvider } from "@/contexts/RoleContext";
import { Layout } from "@/components/Layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDetailTabs } from "@/components/AppDetailTabs";

// 通用页面
import { DashboardPage } from "@/pages/Dashboard";
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

// 流程中心
import ProcessList from "@/pages/process/ProcessList";
import ApprovalList from "@/pages/process/ApprovalList";
import Orchestration from "@/pages/process/Orchestration";

// 本体引擎
import Objects from "@/pages/ontology/Objects";
import { OntologyElement } from "@/pages/ontology/OntologyTab";

// 数据中心
import { DataDashboard, DataSourceList, AskData, MetricCenter } from "@/pages/data/DataCenter";

// 质量中心
import { QualityDashboard, TestCases } from "@/pages/quality/QualityCenter";

// 知识库
import { KnowledgeDashboard, DocumentList } from "@/pages/knowledge/Knowledge";

// 云市场
import { MarketDashboard, OntologyTemplates } from "@/pages/market/Market";

// 数字员工
import { AgentList, AgentCollaboration } from "@/pages/agents/AgentCenter";

// 架构中心
import { BusinessArchitecture, ApplicationArchitecture, DataArchitecture, TechArchitecture } from "@/pages/architecture/Architecture";

// 后台管理
import { AdminDashboard, UserList } from "@/pages/admin/Admin";

function NewAppPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-4">📝</div>
      <h2 className="text-lg font-semibold">新建应用向导</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        4 步向导：选择创建方式 → 应用基本信息 → 选择数据源 → 确认创建
      </p>
    </div>
  );
}

function AppDetailPlaceholder() {
  return (
    <div className="flex flex-col h-full">
      <AppDetailTabs />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📦</div>
          <h2 className="text-lg font-semibold">应用详情</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            请选择上方 Tab 访问应用详情
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <TooltipProvider>
          <Routes>
            <Route element={<Layout />}>
              {/* 默认 */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* 1. Dashbaord */}
              <Route path="/dashboard" element={<DashboardPage />} />
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
              <Route path="/apps/new" element={<NewAppPlaceholder />} />
              <Route path="/apps/:appId" element={<AppDetailPlaceholder />} />
              <Route path="/apps/:appId/overview" element={<AppOverview />} />
              <Route path="/apps/:appId/datamodeling" element={<DataModeling />} />
              <Route path="/apps/:appId/pages" element={<Pages />} />
              <Route path="/apps/:appId/workflows" element={<Workflows />} />
              <Route path="/apps/:appId/config" element={<AppConfig />} />
              <Route path="/apps/:appId/publish" element={<AppPublish />} />
              <Route path="/apps/:appId/export" element={<AppExport />} />

              {/* 5. 流程中心 */}
              <Route path="/process" element={<ProcessList />} />
              <Route path="/process/business" element={<ProcessList />} />
              <Route path="/process/approval" element={<ApprovalList />} />
              <Route path="/process/orchestration" element={<Orchestration />} />
              <Route path="/process/*" element={<ProcessList />} />

              {/* 6. 数据中心 */}
              <Route path="/data" element={<DataDashboard />} />
              <Route path="/data/dashboard" element={<DataDashboard />} />
              <Route path="/data/ask" element={<AskData />} />
              <Route path="/data/metrics" element={<MetricCenter />} />
              <Route path="/data/sources" element={<DataSourceList />} />
              <Route path="/data/*" element={<DataDashboard />} />

              {/* 7. 本体引擎 */}
              <Route path="/ontology" element={<Objects />} />
              <Route path="/ontology/objects" element={<Objects />} />
              <Route path="/ontology/properties" element={<OntologyElement elementKey="2-properties" />} />
              <Route path="/ontology/links" element={<OntologyElement elementKey="3-links" />} />
              <Route path="/ontology/actions" element={<OntologyElement elementKey="4-actions" />} />
              <Route path="/ontology/functions" element={<OntologyElement elementKey="5-functions" />} />
              <Route path="/ontology/rules" element={<OntologyElement elementKey="6-rules" />} />
              <Route path="/ontology/security" element={<OntologyElement elementKey="7-security" />} />
              <Route path="/ontology/governance" element={<OntologyElement elementKey="8-governance" />} />
              <Route path="/ontology/*" element={<Objects />} />

              {/* 8. 质量中心 */}
              <Route path="/quality" element={<QualityDashboard />} />
              <Route path="/quality/cases" element={<TestCases />} />
              <Route path="/quality/*" element={<QualityDashboard />} />

              {/* 9. 知识库 */}
              <Route path="/knowledge" element={<KnowledgeDashboard />} />
              <Route path="/knowledge/documents" element={<DocumentList />} />
              <Route path="/knowledge/*" element={<KnowledgeDashboard />} />

              {/* 10. 云市场 */}
              <Route path="/market" element={<MarketDashboard />} />
              <Route path="/market/ontology-templates" element={<OntologyTemplates />} />
              <Route path="/market/*" element={<MarketDashboard />} />

              {/* 11. 数字员工 */}
              <Route path="/agents" element={<AgentList />} />
              <Route path="/agents/mine" element={<AgentList />} />
              <Route path="/agents/collaboration" element={<AgentCollaboration />} />
              <Route path="/agents/*" element={<AgentList />} />

              {/* 12. 后台管理 */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserList />} />
              <Route path="/admin/*" element={<AdminDashboard />} />

              {/* 兜底 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </TooltipProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}