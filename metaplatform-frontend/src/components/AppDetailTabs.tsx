import { NavLink, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

const appTabs = [
  { key: "overview", label: "概览" },
  { key: "datamodeling", label: "业务数据建模" },
  { key: "pages", label: "页面" },
  { key: "workflows", label: "流程" },
  { key: "config", label: "应用配置" },
  { key: "publish", label: "应用发布" },
  { key: "export", label: "应用导出" },
];

/**
 * 应用详情页的二级 Tab 导航（应用中心用）
 */
export function AppDetailTabs() {
  const { appId } = useParams();
  if (!appId) return null;
  const basePath = `/apps/${appId}`;

  return (
    <div className="border-b bg-background px-4">
      <nav className="flex h-11 items-center gap-0 overflow-x-auto">
        {/* 返回应用列表 */}
        <NavLink
          to="/apps"
          className="inline-flex h-11 items-center px-2 text-sm font-medium whitespace-nowrap transition-colors text-muted-foreground hover:text-foreground mr-1"
        >
          <ChevronLeft className="size-4 mr-0.5" />
          应用列表
        </NavLink>
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
        {appTabs.map((t) => (
          <NavLink
            key={t.key}
            to={`${basePath}/${t.key}`}
            className={({ isActive }) =>
              cn(
                "inline-flex h-11 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}