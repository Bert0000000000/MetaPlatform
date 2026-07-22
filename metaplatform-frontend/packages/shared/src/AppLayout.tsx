import type { ReactNode } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { Hexagon, User } from 'lucide-react';
import PlatformMenu from './PlatformMenu';

const { Sider, Content } = Layout;

interface AppLayoutProps {
  currentModule: string;
  children?: ReactNode;
}

export default function AppLayout({ currentModule, children }: AppLayoutProps) {
  return (
    <Layout className="v-app-layout" style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <Sider
        className="v-sider"
        width={240}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="v-sider-header"
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            borderBottom: '1px solid var(--sidebar-border)',
            flexShrink: 0,
          }}
        >
          <Hexagon
            className="v-logo-icon"
            style={{ width: 28, height: 28, color: 'var(--foreground)', strokeWidth: 1.5 }}
          />
          <span
            className="v-logo-text"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.01em',
            }}
          >
            Mate Platform
          </span>
        </div>

        <div className="v-sider-menu" style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          <PlatformMenu currentModule={currentModule} />
        </div>

        <div
          className="v-sider-footer"
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            borderTop: '1px solid var(--sidebar-border)',
            flexShrink: 0,
          }}
        >
          <div
            className="v-avatar"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--muted)',
            }}
          >
            <User style={{ width: 16, height: 16, color: 'var(--muted-foreground)', strokeWidth: 1.5 }} />
          </div>
          <span
            className="v-user-name"
            style={{
              fontSize: 13,
              color: 'var(--sidebar-foreground)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            当前用户
          </span>
        </div>
      </Sider>

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
            padding: 24,
            minHeight: '100vh',
            background: 'var(--background)',
          }}
        >
          {children ?? <Outlet />}
        </Content>
      </Layout>
    </Layout>
  );
}
