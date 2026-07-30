import { useMemo, useState, type ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@mate/shared";
import { Link, useLocation, useNavigate } from "react-router-dom";

const NAV_SECTIONS: Array<{
  title: string;
  items: Array<{ key: string; label: string; path: string; description?: string }>;
}> = [
  { title: "概览", items: [{ key: "overview", label: "后台首页", path: "/admin" }] },
  {
    title: "用户与权限",
    items: [
      { key: "users", label: "用户管理", path: "/admin/users", description: "用户 CRUD / 启停 / 密码重置 / 批量导入" },
      { key: "permissions", label: "权限管理", path: "/admin/permissions", description: "角色 / 权限矩阵 / 用户绑定" },
    ],
  },
  { title: "组织架构", items: [{ key: "orgs", label: "组织管理", path: "/admin/orgs", description: "组织树 / 岗位 / 调岗" }] },
  {
    title: "审计与配置",
    items: [
      { key: "logs", label: "日志管理", path: "/admin/logs", description: "审计日志 / 导出 CSV" },
      { key: "configs", label: "系统配置", path: "/admin/configs", description: "SSO / LICENSE / 消息渠道 / 限流" },
    ],
  },
  { title: "运维", items: [{ key: "operations", label: "运营监控", path: "/admin/operations", description: "健康大盘 / 容量 / 告警" }] },
];

interface AdminLayoutProps {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function AdminLayout({ title, extra, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const breadcrumb: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [{ label: "后台管理", href: "/admin" }];
    const match = NAV_SECTIONS.flatMap((s) => s.items).find(
      (i) => i.path === location.pathname || location.pathname.startsWith(i.path + "/"),
    );
    if (match && match.path !== "/admin") {
      items.push({ label: match.label });
    }
    return items;
  }, [location.pathname]);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 16 }}>
      <aside
        style={{
          width: collapsed ? 64 : 224,
          flexShrink: 0,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: collapsed ? "12px 6px" : "12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          transition: "width 0.2s ease",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--muted-foreground)",
            cursor: "pointer",
            padding: "4px 8px",
            fontSize: 12,
            marginBottom: 6,
          }}
          title={collapsed ? "展开菜单" : "收起菜单"}
        >
          {collapsed ? "›" : "‹ 收起"}
        </button>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 8 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                  padding: "4px 8px",
                  textTransform: "uppercase",
                  letterSpacing: 0.05,
                }}
              >
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive =
                item.path === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <a
                  key={item.key}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(item.path);
                  }}
                  href={item.path}
                  style={{
                    display: "block",
                    padding: collapsed ? "8px 6px" : "8px 10px",
                    borderRadius: 6,
                    fontSize: 13,
                    color: isActive ? "var(--primary-foreground)" : "var(--foreground)",
                    background: isActive ? "var(--primary)" : "transparent",
                    textDecoration: "none",
                    marginBottom: 2,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  {collapsed ? item.label.charAt(0) : item.label}
                </a>
              );
            })}
          </div>
        ))}
        {!collapsed && (
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <Link
              to="/dashboard"
              style={{
                display: "block",
                padding: "6px 10px",
                fontSize: 12,
                color: "var(--muted-foreground)",
                textDecoration: "none",
              }}
            >
              ← 返回工作台
            </Link>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <Breadcrumb items={breadcrumb} />
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: "8px 0 4px" }}>{title}</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>{extra}</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
      </main>
    </div>
  );
}
