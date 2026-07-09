import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { TabConfig } from "@/config/menu";

/**
 * 顶部 Tab 导航（基于 URL 切换，不用 Radix Tabs 的 asChild 嵌套）
 */
export function MenuTabs({
  basePath,
  tabs,
  activeKey,
}: {
  basePath: string;
  tabs: TabConfig[];
  activeKey?: string;
}) {
  return (
    <div className="border-b bg-background px-6">
      <nav className="flex flex-wrap items-center gap-x-0 overflow-x-hidden">
        {tabs.map((t) => {
          const fullPath = `${basePath}${t.path}`;
          const isActive = activeKey === t.key;
          return (
            <NavLink
              key={t.key}
              to={fullPath}
              className={cn(
                "inline-flex h-10 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}