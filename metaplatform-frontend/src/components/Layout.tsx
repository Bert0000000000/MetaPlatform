import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { MenuTabsBar } from "@/components/MenuTabsBar";
import { CommandPalette } from "@/components/CommandPalette";

export function Layout() {
  const location = useLocation();
  const pathname = location.pathname;

  // 应用详情页（应用中心内）的 tab 栏 / 数字员工面板统一由 AppDetailLayout 提供,
  // 此处不再渲染 AppDetailTabs, 避免重复.
  const isAppDetail = /^\/apps\/[^/]+/.test(pathname);

  // 应用列表页（不含详情子路由）：不显示 MenuTabsBar
  const isAppsList = /^\/apps\/?$/.test(pathname) || pathname === "/apps/new" || pathname === "/apps/vibe" || pathname === "/apps/form";

  // 内部 Tab 菜单（内部 Radix Tabs 已处理）
  const isInternalTab =
    pathname.startsWith("/superai") ||
    pathname.startsWith("/data") ||
    pathname.startsWith("/quality") ||
    pathname.startsWith("/knowledge") ||
    pathname.startsWith("/market") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  return (
    <div className="flex min-h-screen w-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col min-h-0">
        <Topbar />
        {!isAppDetail && !isInternalTab && !isAppsList ? (
          <MenuTabsBar />
        ) : (
          <div className="h-px shrink-0" />
        )}
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}