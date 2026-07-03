import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MENU_TABS, MENU_ITEMS, type MenuKey } from "@/config/menu";

/**
 * 根据当前 URL 自动判断所属菜单并渲染 Tab 导航条
 * - 直接基于 MENU_ITEMS 全量匹配，不受角色限制
 */
export function MenuTabsBar() {
  const location = useLocation();

  // 找到当前路径对应的 menu key 和 basePath
  const sortedMenus = [...MENU_ITEMS].sort((a, b) => b.path.length - a.path.length);

  let activeMenu: MenuKey | null = null;
  let activeBasePath = "";

  for (const m of sortedMenus) {
    if (location.pathname === m.path || location.pathname.startsWith(m.path + "/")) {
      activeMenu = m.key;
      activeBasePath = m.path;
      break;
    }
  }

  if (!activeMenu) return null;

  const tabs = MENU_TABS[activeMenu];
  if (!tabs || tabs.length === 0) return null;

  // 应用中心特殊处理：在应用详情页时，激活 "list" tab
  let activeKey: string;
  if (activeMenu === "apps") {
    if (location.pathname === "/apps" || location.pathname === "/apps/new" || location.pathname === "/apps/vibe") {
      activeKey = "list";
    } else if (location.pathname === "/apps/form") {
      activeKey = "pages";
    } else {
      activeKey = "overview";
    }
  } else if (activeMenu === "process") {
    if (location.pathname.startsWith("/process/designer")) {
      activeKey = "business";
    } else if (location.pathname.startsWith("/process/approval")) {
      activeKey = "approval";
    } else if (location.pathname.startsWith("/process/orchestration")) {
      activeKey = "orchestration";
    } else if (location.pathname === "/process" || location.pathname.startsWith("/process/business")) {
      activeKey = "business";
    } else {
      const matched = tabs.find((t) => location.pathname === activeBasePath + t.path);
      activeKey = matched?.key ?? "business";
    }
  } else if (activeMenu === "ontology") {
    if (location.pathname.startsWith("/ontology/object/")) {
      activeKey = "objects";
    } else {
      const matched = tabs.find((t) => location.pathname === activeBasePath + t.path);
      activeKey = matched?.key ?? (location.pathname === "/ontology" ? "objects" : "objects");
    }
  } else {
    const matched = tabs.find((t) => location.pathname === activeBasePath + t.path);
    activeKey = matched?.key ?? (tabs[0]?.key ?? "");
  }

  const activeMenuDef = MENU_ITEMS.find((m) => m.key === activeMenu);

  return (
    <div className="border-b bg-background px-4 sticky top-14 z-20" role="navigation" aria-label="菜单 Tab">
      <div className="flex h-11 items-center gap-0 overflow-x-auto">
        <span className="text-xs text-muted-foreground mr-2.5 shrink-0 flex items-center gap-1.5">
          {activeMenuDef && <activeMenuDef.icon className="size-3.5" />}
          {activeMenuDef?.label}
        </span>
        {tabs.map((t) => {
          const fullPath = `${activeBasePath}${t.path}`;
          const isActive = activeKey === t.key;
          return (
            <NavLink
              key={t.key}
              to={fullPath}
              className={cn(
                "inline-flex h-11 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}