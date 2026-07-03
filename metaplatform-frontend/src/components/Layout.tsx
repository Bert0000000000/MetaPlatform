import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { MenuTabsBar } from "@/components/MenuTabsBar";
import { AppDetailTabs } from "@/components/AppDetailTabs";
import { CommandPalette } from "@/components/CommandPalette";

export function Layout() {
  const location = useLocation();
  const pathname = location.pathname;

  // 应用详情页（应用中心内）：用 AppDetailTabs
  const isAppDetail = /^\/apps\/[^/]+\/(overview|datamodeling|pages|workflows|config|publish|export)/.test(pathname) || /^\/apps\/[^/]+$/.test(pathname);

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        {isAppDetail ? (
          <AppDetailTabs />
        ) : !isInternalTab ? (
          <MenuTabsBar />
        ) : (
          <div className="h-px" />
        )}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}