import { useState, type ReactNode } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { User, LogOut, ChevronsLeft, ChevronsRight } from './icons';
import PlatformMenu from './PlatformMenu';
import { useAuth } from './auth/AuthProvider';
import MateLogo from './components/MateLogo';

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
    <Layout className="v-app-layout" style={{ height: '100vh', background: 'var(--background)' }}>
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
        {/* Logo — 侧边栏品牌：放大六边形 + MetaPlatform / Ontology 双行标题 */}
        <div
          className="v-sidebar-logo"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            marginBottom: 20,
            padding: collapsed ? '0' : '0 4px',
            gap: 10,
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
          {/* 折叠/展开按钮（放在底部） */}
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

          {/* 用户信息（折叠后只显示头像） */}
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

          {/* 退出登录 */}
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
      </aside>

      <Layout
        className="v-main-layout"
        style={{
          marginLeft: SIDEBAR_W,
          height: '100vh',
          background: 'var(--background)',
          transition: 'margin-left 0.2s ease',
        }}
      >
        <Content
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
        </Content>
      </Layout>
    </Layout>
  );
}
