import { type ReactNode } from "react";
import { PageRoot, ModuleTabsLayout, type ModuleTab } from "@mate/shared";

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
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
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
  const colorMap: Record<string, string> = {
    default: "var(--foreground)",
    success: "var(--success)",
    warning: "var(--warning)",
    destructive: "var(--destructive)",
  };
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 600, color: colorMap[color], letterSpacing: "-0.02em" }}>
        {value}
      </span>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
      {children}
    </div>
  );
}
