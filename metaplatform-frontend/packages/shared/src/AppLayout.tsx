import { useState, type ReactNode } from 'react';
import { Nav, Layout } from '@douyinfe/semi-ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronsLeft, ChevronsRight } from './icons';
import { useAuth } from './auth/AuthProvider';
import MateLogo from './components/MateLogo';
import { MODULE_MENU, flattenMenu } from './navigation';

export interface AppLayoutProps {
  module?: string;
  children?: ReactNode;
}

const SIDEBAR_W = 240;
const SIDEBAR_W_COLLAPSED = 64;

/** 二级菜单 itemKey：moduleKey__childKey（避免跨模块重复） */
function childItemKey(moduleKey: string, childKey: string) {
  return `${moduleKey}__${childKey}`;
}

/**
 * 平台框架布局：Semi Layout 官方「侧边栏布局」模板
 * ┌────────┬──────────────────────┐
 * │ Sider  │ Content              │
 * │ Logo   │  页面路由（Outlet）   │
 * │ Nav    │                      │
 * │ footer │                      │
 * └────────┴──────────────────────┘
 */
export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // 当前路径 → 匹配的二级菜单项（最长前缀）
  const flat = flattenMenu();
  const pathname = location.pathname;
  const matched = flat
    .filter((it) => pathname === it.path || pathname.startsWith(it.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const selectedKey = matched ? childItemKey(matched.moduleKey, matched.key) : undefined;
  const currentModuleKey = matched?.moduleKey;

  const navItems = MODULE_MENU.map((m) => ({
    itemKey: m.key,
    text: m.label,
    icon: m.icon,
    items: m.children.map((c) => ({
      itemKey: childItemKey(m.key, c.key),
      text: c.label,
    })),
  }));

  return (
    <Layout hasSider className="v-app-layout" style={{ height: '100vh', background: 'var(--background)' }}>
      <Layout.Sider
        className="v-sider"
        style={{
          width,
          height: '100vh',
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Logo */}
        <div
          className="v-sidebar-logo"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '20px 0 12px' : '20px 20px 12px',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {collapsed ? (
            <MateLogo size={32} variant="color" />
          ) : (
            <>
              <MateLogo size={34} variant="color" />
              <span
                className="v-sidebar-logo-badge"
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  lineHeight: 1.15,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>MetaPlatform</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginTop: 2 }}>Ontology</span>
              </span>
            </>
          )}
        </div>

        {/* Semi Nav：一级 + 二级菜单 */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <Nav
            items={navItems}
            selectedKeys={selectedKey ? [selectedKey] : []}
            openKeys={currentModuleKey ? [currentModuleKey] : []}
            isCollapsed={collapsed}
            onClick={({ itemKey }) => {
              const target = flat.find((it) => childItemKey(it.moduleKey, it.key) === itemKey);
              if (target) {
                navigate(target.path);
                return;
              }
              // 一级模块项：导航到模块默认路由
              const module = MODULE_MENU.find((m) => m.key === itemKey);
              if (module) navigate(module.path);
            }}
            style={{ borderRight: 'none', background: 'transparent', fontSize: 13 }}
            bodyStyle={{ paddingTop: 0 }}
          />
        </div>

        {/* footer：折叠 + 用户 + 退出 */}
        <div
          className="v-sider-footer"
          style={{
            padding: collapsed ? '16px 0 0' : '16px 12px 0',
            borderTop: '1px solid var(--sidebar-border)',
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? '展开菜单' : '收起菜单'}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: collapsed ? '6px' : '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s',
            }}
          >
            {collapsed ? <ChevronsRight size={14} /> : (
              <>
                <ChevronsLeft size={14} />
                <span>收起</span>
              </>
            )}
          </button>

          <div
            style={{
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8,
              padding: '0 8px',
              borderRadius: 6,
              color: 'var(--sidebar-foreground)',
              fontSize: 13,
            }}
            title={user?.realName ?? user?.username ?? '当前用户'}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--muted)',
                flexShrink: 0,
              }}
            >
              <User style={{ width: 16, height: 16, color: 'var(--muted-foreground)', strokeWidth: 1.5 }} />
            </div>
            {!collapsed && (
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {user?.realName ?? user?.username ?? '当前用户'}
              </span>
            )}
          </div>

          <button
            type="button"
            className="v-sidebar-item"
            onClick={handleLogout}
            title="退出登录"
            style={{
              width: '100%',
              height: 36,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 0,
              padding: '0 8px',
              gap: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <LogOut style={{ width: 16, height: 16, strokeWidth: 1.5 }} />
            {!collapsed && <span>退出登录</span>}
          </button>
        </div>
      </Layout.Sider>

      <Layout style={{ height: '100vh', background: 'var(--background)' }}>
        <Layout.Content
          className="v-content"
          style={{
            padding: '0 24px',
            height: '100vh',
            overflow: 'auto',
            background: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children ?? <Outlet />}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
