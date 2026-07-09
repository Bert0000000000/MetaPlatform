import { NavLink, useLocation } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { getMenusByRole } from "@/config/menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

export function Sidebar() {
  const { role } = useRole();
  const menus = getMenusByRole(role);
  const location = useLocation();

  return (
    <aside className="hidden md:flex shrink-0 sticky top-0 h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground" style={{ width: "220px" }}>
      <div className="flex h-14 items-center px-3 border-b border-sidebar-border">
        <span className="text-lg font-semibold tracking-tight text-sidebar-accent-foreground">MetaPlatform</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {menus.map((item) => {
            // 特殊处理应用中心：在应用详情页时也算激活
            const isAppDetail =
              item.key === "apps" && location.pathname.startsWith("/apps/");
            const isActive = isAppDetail
              ? false
              : location.pathname === item.path ||
                location.pathname.startsWith(item.path + "/");
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <NavLink
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive &&
                      "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
        <Separator className="my-2 opacity-10" />
        <ul className="flex flex-col gap-0.5">
          <li>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                )
              }
            >
              <Settings className="size-4 shrink-0" />
              <span className="truncate">设置</span>
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="p-3 text-xs text-sidebar-foreground border-t border-sidebar-border">
        <div>v1.2 · 本体论驱动 AI 平台</div>
      </div>
    </aside>
  );
}
