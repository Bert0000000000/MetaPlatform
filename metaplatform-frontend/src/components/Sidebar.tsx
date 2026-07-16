import { NavLink, useLocation } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { getMenusByRole, ROLES } from "@/config/menu";
import { Separator } from "@/components/ui/separator";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Settings, Hexagon } from "lucide-react";

/**
 * Sidebar — 严格匹配 .design_library/metaplatform/components/sidebar.json
 *
 *   - width: var(--sidebar-width) = 220px
 *   - background: var(--color-sidebar-bg) = #0f172a 深色
 *   - brandIconSize: 32px
 *   - navItemRadius: var(--radius-md) = 4px
 *   - navItemPadding: 6px 10px
 *   - activeBg / activeText: rgba(59,130,246,0.15) / #60a5fa
 *
 * 解剖:
 *   - brandArea: logo + name
 *   - navList: vertical nav items, tight gap
 *   - navItem: icon + label, 4px radius
 *   - userArea: avatar + name at bottom
 *
 * doNotInvent: 不能 collapsible / multi-level / submenu
 */
export function Sidebar() {
  const { role } = useRole();
  const menus = getMenusByRole(role);
  const location = useLocation();
  const user = getUser();
  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? role;

  // 头像首字 (中文/英文取首字符)
  const initial =
    user?.name?.trim().charAt(0) ||
    user?.email?.trim().charAt(0)?.toUpperCase() ||
    "U";

  return (
    <aside
      className="hidden md:flex shrink-0 sticky top-0 h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      style={{ width: "220px" }}
    >
      {/* brandArea — 32px logo icon + name */}
      <div className="flex h-14 items-center gap-2 px-3 border-b border-sidebar-border">
        <div className="size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <Hexagon className="size-5" />
        </div>
        <span className="text-base font-semibold tracking-tight text-sidebar-accent-foreground truncate">
          MetaPlatform
        </span>
      </div>

      {/* navList — 一级菜单 */}
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
                    // navItemRadius: 4px, navItemPadding: 6px 10px
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    // active: sidebar-accent bg + accent-foreground text + font-medium
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

        {/* 设置 — 不属于 12 个一级菜单, 但 sidebar 必须可访问 */}
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

      {/* userArea — avatar + name + role, bottom */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          {/* avatar — 32px circle with initial */}
          <div
            className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0"
            aria-label="用户头像"
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-accent-foreground truncate leading-tight">
              {user?.name || user?.email || "未登录"}
            </div>
            <div className="text-xs text-sidebar-foreground truncate opacity-80 leading-tight">
              {roleLabel}
            </div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-sidebar-border opacity-60 text-xs">
          v1.2 · 本体论驱动 AI 平台
        </div>
      </div>
    </aside>
  );
}