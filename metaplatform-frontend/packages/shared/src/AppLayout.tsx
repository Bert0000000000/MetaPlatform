import type { ReactNode } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import PlatformMenu from './PlatformMenu';
import { useAuth } from './auth/AuthProvider';

const { Content } = Layout;

export interface AppLayoutProps {
  module?: string;
  children?: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();

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
          width: 240,
          zIndex: 10,
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 12px',
        }}
      >
        {/* Logo: white badge style, matches design draft */}
        <div className="v-sidebar-logo">
          <span className="v-sidebar-logo-badge">Mate</span>
        </div>

        <div className="v-sider-menu" style={{ flex: 1, overflowY: 'auto' }}>
          <PlatformMenu />
        </div>

        <div
          className="v-sider-footer"
          style={{
            padding: '16px 12px 0',
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
              gap: 12,
              padding: '0 12px',
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
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.realName ?? user?.username ?? '当前用户'}
            </span>
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
          marginLeft: 240,
          minHeight: '100vh',
          background: 'var(--background)',
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
