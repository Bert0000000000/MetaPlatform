import { Fragment, useMemo, type ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@mate/shared";
import { Link, useLocation, useNavigate } from "react-router-dom";

const ADMIN_TABS: Array<{ key: string; label: string; path: string }> = [
  { key: "users", label: "用户管理", path: "/admin/users" },
  { key: "permissions", label: "权限管理", path: "/admin/permissions" },
  { key: "orgs", label: "组织管理", path: "/admin/orgs" },
  { key: "logs", label: "日志管理", path: "/admin/logs" },
  { key: "configs", label: "系统配置", path: "/admin/configs" },
  { key: "ai-providers", label: "AI 提供方", path: "/admin/ai-providers" },
  { key: "operations", label: "运营数据", path: "/admin/operations" },
  { key: "analytics", label: "访问看板", path: "/admin/analytics" },
];

interface AdminLayoutProps {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function AdminLayout({ title, extra, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumb: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [{ label: "后台管理", href: "/admin" }];
    const match = ADMIN_TABS.find(
      (t) => location.pathname === t.path || location.pathname.startsWith(t.path + "/"),
    );
    if (match) {
      items.push({ label: match.label });
    }
    return items;
  }, [location.pathname]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Breadcrumb items={breadcrumb} />
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "8px 0 4px" }}>{title}</h1>
        </div>
        {extra && <div style={{ display: "flex", gap: 8 }}>{extra}</div>}
      </div>

      {/* Tab 栏 */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 12,
        }}
      >
        {ADMIN_TABS.map((tab) => {
          const isActive =
            location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(tab.path)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                background: isActive ? "var(--muted)" : "transparent",
                border: "none",
                fontFamily: "var(--font-sans)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto" }}>
          <Link
            to="/dashboard"
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              textDecoration: "none",
              padding: "6px 8px",
            }}
          >
            ← 返回工作台
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
    </div>
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}
