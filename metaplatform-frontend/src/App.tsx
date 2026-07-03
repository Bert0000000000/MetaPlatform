import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RoleProvider } from "@/contexts/RoleContext";
import { Layout } from "@/components/Layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardPage } from "@/pages/Dashboard";
import { SuperAIPage } from "@/pages/SuperAI";
import { AppsListPage } from "@/pages/AppsList";
import { MenuPage, PlaceholderContent } from "@/pages/MenuPage";

/**
 * 根据 URL pathname 自动推断当前 Tab 的 key（用于高亮）
 */
function getActiveTabFromPath(
  pathname: string,
  basePath: string,
  tabs: { key: string; path: string }[],
): string {
  // 优先匹配最长 path
  const sorted = [...tabs].sort((a, b) => b.path.length - a.path.length);
  for (const t of sorted) {
    if (t.path === "") continue;
    if (pathname === `${basePath}${t.path}` || pathname.startsWith(`${basePath}${t.path}/`)) {
      return t.key;
    }
  }
  return tabs.find((t) => t.path === "")?.key ?? tabs[0]?.key ?? "";
}

import { useLocation } from "react-router-dom";
import { MENU_TABS } from "@/config/menu";

function MenuPageWrapper({
  menuKey,
  basePath,
  defaultActiveKey,
}: {
  menuKey: keyof typeof MENU_TABS;
  basePath: string;
  defaultActiveKey?: string;
}) {
  const location = useLocation();
  const tabs = MENU_TABS[menuKey];
  const activeKey =
    defaultActiveKey ?? getActiveTabFromPath(location.pathname, basePath, tabs);
  return (
    <MenuPage menuKey={menuKey} basePath={basePath} activeKey={activeKey}>
      <PlaceholderContent
        title={`${menuKey.toUpperCase()} - ${activeKey}`}
        description={`Tab 内容待实现。当前 active key: ${activeKey} (path: ${location.pathname})`}
      />
    </MenuPage>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <TooltipProvider>
          <Routes>
            <Route element={<Layout />}>
              {/* 默认重定向到工作台 */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* 1. Dashbaord */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/*" element={<DashboardPage />} />

              {/* 2. SuperAI */}
              <Route path="/superai" element={<SuperAIPage />} />
              <Route path="/superai/*" element={<SuperAIPage />} />

              {/* 3. 架构中心 */}
              <Route
                path="/architecture"
                element={
                  <MenuPageWrapper menuKey="architecture" basePath="/architecture" />
                }
              />
              <Route
                path="/architecture/*"
                element={
                  <MenuPageWrapper menuKey="architecture" basePath="/architecture" />
                }
              />

              {/* 4. 应用中心 */}
              <Route path="/apps" element={<AppsListPage />} />
              <Route
                path="/apps/:appId/*"
                element={
                  <PlaceholderContent
                    title="应用详情"
                    description="应用详情页（概览 / 业务数据建模 / 页面 / 流程 / 配置 / 发布 / 导出）"
                  />
                }
              />
              <Route
                path="/apps/new"
                element={
                  <PlaceholderContent
                    title="新建应用向导"
                    description="4 步向导：选择创建方式 → 应用基本信息 → 选择数据源 → 确认创建"
                  />
                }
              />

              {/* 5. 流程中心 */}
              <Route
                path="/process"
                element={<MenuPageWrapper menuKey="process" basePath="/process" />}
              />
              <Route
                path="/process/*"
                element={<MenuPageWrapper menuKey="process" basePath="/process" />}
              />

              {/* 6. 数据中心 */}
              <Route
                path="/data"
                element={<MenuPageWrapper menuKey="data" basePath="/data" />}
              />
              <Route
                path="/data/*"
                element={<MenuPageWrapper menuKey="data" basePath="/data" />}
              />

              {/* 7. 本体引擎 */}
              <Route
                path="/ontology"
                element={<MenuPageWrapper menuKey="ontology" basePath="/ontology" />}
              />
              <Route
                path="/ontology/*"
                element={<MenuPageWrapper menuKey="ontology" basePath="/ontology" />}
              />

              {/* 8. 质量中心 */}
              <Route
                path="/quality"
                element={<MenuPageWrapper menuKey="quality" basePath="/quality" />}
              />
              <Route
                path="/quality/*"
                element={<MenuPageWrapper menuKey="quality" basePath="/quality" />}
              />

              {/* 9. 知识库 */}
              <Route
                path="/knowledge"
                element={
                  <MenuPageWrapper menuKey="knowledge" basePath="/knowledge" />
                }
              />
              <Route
                path="/knowledge/*"
                element={
                  <MenuPageWrapper menuKey="knowledge" basePath="/knowledge" />
                }
              />

              {/* 10. 云市场 */}
              <Route
                path="/market"
                element={<MenuPageWrapper menuKey="market" basePath="/market" />}
              />
              <Route
                path="/market/*"
                element={<MenuPageWrapper menuKey="market" basePath="/market" />}
              />

              {/* 11. 数字员工 */}
              <Route
                path="/agents"
                element={<MenuPageWrapper menuKey="agents" basePath="/agents" />}
              />
              <Route
                path="/agents/*"
                element={<MenuPageWrapper menuKey="agents" basePath="/agents" />}
              />

              {/* 12. 后台管理 */}
              <Route
                path="/admin"
                element={<MenuPageWrapper menuKey="admin" basePath="/admin" />}
              />
              <Route
                path="/admin/*"
                element={<MenuPageWrapper menuKey="admin" basePath="/admin" />}
              />

              {/* 设置 */}
              <Route
                path="/settings"
                element={
                  <PlaceholderContent
                    title="设置"
                    description="个人设置 + 偏好"
                  />
                }
              />

              {/* 兜底 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </TooltipProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}