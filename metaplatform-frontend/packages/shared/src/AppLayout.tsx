import { useState, type ReactNode } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { User, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react';
import PlatformMenu from './PlatformMenu';
import { useAuth } from './auth/AuthProvider';

const { Content } = Layout;

export interface AppLayoutProps {
  module?: string;
  children?: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const SIDEBAR_W = collapsed ? 64 : 240;

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <Layout className="v-app-layout" style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <aside
        className="v-sider"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          width: SIDEBAR_W,
          zIndex: 10,
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: collapsed ? '20px 8px' : '20px 12px',
          transition: 'width 0.2s ease, padding 0.2s ease',
        }}
      >
        {/* Logo: white badge style, matches design draft */}
        <div
          className="v-sidebar-logo"
          style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', marginBottom: 16, gap: 8 }}
        >
          {collapsed ? (
            <span className="v-sidebar-logo-badge" style={{ padding: '4px 8px' }}>M</span>
          ) : (
            <span className="v-sidebar-logo-badge">Mate</span>
          )}
        </div>

        {/* 折叠/展开按钮 */}
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
            marginBottom: 12,
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

        <div className="v-sider-menu" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <PlatformMenu collapsed={collapsed} />
        </div>

        <div
          className="v-sider-footer"
          style={{
            padding: collapsed ? '16px 0 0' : '16px 12px 0',
            borderTop: '1px solid var(--sidebar-border)',
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 12,
              padding: collapsed ? '0' : '0 12px',
              borderRadius: 6,
              color: 'var(--sidebar-foreground)',
              fontSize: 14,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--muted)',
                flexShrink: 0,
              }}
            >
              <User style={{ width: 14, height: 14, color: 'var(--muted-foreground)', strokeWidth: 1.5 }} />
            </div>
            {!collapsed && <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.realName ?? user?.username ?? '当前用户'}
            </span>}
          </div>

          <button
            type="button"
            className="v-sidebar-item"
            onClick={handleLogout}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 0,
            }}
          >
            <LogOut style={{ width: 18, height: 18, strokeWidth: 1.5 }} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <Layout
        className="v-main-layout"
        style={{
          marginLeft: SIDEBAR_W,
          minHeight: '100vh',
          background: 'var(--background)',
          transition: 'margin-left 0.2s ease',
        }}
      >
        <Content
          className="v-content"
          style={{
            padding: '0 24px',
            height: '100vh',
            overflow: 'hidden',
            background: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children ?? <Outlet />}
        </Content>
      </Layout>
    </Layout>
  );
}
