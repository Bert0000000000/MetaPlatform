import { type ReactNode } from "react";
import { PageRoot } from "@mate/shared";
import PageHeader from '@/components/skeleton/PageHeader';
import './admin.css';

interface AdminLayoutProps {
  /** 兼容旧调用；ModuleTabsLayout 的 tab 已标示页面，不再单独渲染大标题 */
  title?: string;
  /** 页面级操作按钮（新建/刷新等），渲染在内容区顶部右侧 */
  extra?: ReactNode;
  children: ReactNode;
}

export function AdminLayout({ title, extra, children }: AdminLayoutProps) {
  return (
    <PageRoot>
        <PageHeader title={title ?? '治理与管理'} actions={extra} />
        {children}
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
