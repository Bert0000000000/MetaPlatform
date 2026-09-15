import { type ReactNode } from "react";
import { PageRoot, ModuleTabsLayout, type ModuleTab } from "@mate/shared";
import './admin.css';

/** 后台管理 11 个 tab（侧边栏只保留一级「后台管理」，二级移到内容区） */
const ADMIN_TABS: ModuleTab[] = [
  { key: "overview", label: "总览", path: "/admin" },
  { key: "users", label: "用户管理", path: "/admin/users" },
  { key: "permissions", label: "权限管理", path: "/admin/permissions" },
  { key: "orgs", label: "组织管理", path: "/admin/orgs" },
  { key: "logs", label: "日志管理", path: "/admin/logs" },
  { key: "configs", label: "系统配置", path: "/admin/configs" },
  { key: "ai-providers", label: "AI 提供方", path: "/admin/ai-providers" },
  { key: "operations", label: "运维", path: "/admin/operations" },
  { key: "analytics", label: "分析", path: "/admin/analytics" },
  { key: "components", label: "组件", path: "/admin/components" },
  { key: "flowgram", label: "Flowgram", path: "/admin/flowgram" },
];

interface AdminLayoutProps {
  /** 兼容旧调用；ModuleTabsLayout 的 tab 已标示页面，不再单独渲染大标题 */
  title?: string;
  /** 页面级操作按钮（新建/刷新等），渲染在内容区顶部右侧 */
  extra?: ReactNode;
  children: ReactNode;
}

export function AdminLayout({ extra, children }: AdminLayoutProps) {
  return (
    <PageRoot>
      <ModuleTabsLayout tabs={ADMIN_TABS}>
        {extra && (
          <div className="mp-flex mp-justify-end mp-mb-3 mp-gap-2">
            {extra}
          </div>
        )}
        {children}
      </ModuleTabsLayout>
    </PageRoot>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  color?: "default" | "success" | "warning" | "destructive";
}

export function StatCard({ label, value, color = "default" }: StatCardProps) {
  const colorCls: Record<string, string> = {
    default: "mp-text-1",
    success: "mp-text-success",
    warning: "mp-text-warning",
    destructive: "mp-text-danger",
  };
  return (
    <div
      className="mp-border mp-rounded mp-flex-col mp-gap-1 mp-py-4 mp-px-5 mp-bg-1" 
    >
      <span className="mp-fw-500 mp-text-sm mp-text-2">{label}</span>
      <span className={`mp-fw-600 mp-text-xl mp-admin-stat ${colorCls[color]}`}>
        {value}
      </span>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mp-mb-5 mp-gap-3 mp-grid mp-admin-stat-grid">
      {children}
    </div>
  );
}
