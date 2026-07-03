import { NavLink } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { getMenusByRole } from "@/config/menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { role } = useRole();
  const menus = getMenusByRole(role);

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center px-4 border-b">
        <span className="text-lg font-semibold tracking-tight">MetaPlatform</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {menus.map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive &&
                      "bg-sidebar-primary text-sidebar-primary-foreground font-medium",
                  )
                }
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <Separator className="my-3" />
        <ul className="flex flex-col gap-1">
          <li>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive &&
                    "bg-sidebar-primary text-sidebar-primary-foreground font-medium",
                )
              }
            >
              <span className="text-base leading-none">⚙️</span>
              <span className="truncate">设置</span>
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="p-3 text-xs text-muted-foreground border-t">
        <div>v1.2 · 本体论驱动 AI 平台</div>
      </div>
    </aside>
  );
}