import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, Typography, Button, SideSheet } from '@douyinfe/semi-ui';
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@mate/shared';

const { Header, Sider, Content } = Layout;

/** 移动端断点检测（与 antd Grid md = 992px 语义一致）。 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return !window.matchMedia('(min-width: 992px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 992px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function AppLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const menu = <PlatformMenu currentModule="superai" />;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card)',
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {isMobile && (
            <Button
              theme="borderless"
              icon={<MenuOutlined />}
              onClick={() => setMenuOpen(true)}
              style={{ marginRight: 8 }}
            />
          )}
          <Typography.Title
            heading={4}
            style={{
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            SuperAI
          </Typography.Title>
        </div>
        <Button theme="borderless" icon={<LogoutOutlined />} onClick={handleLogout}>
          {!isMobile && '退出'}
        </Button>
      </Header>
      <Layout>
        {!isMobile && (
          <Sider style={{ width: 240, flexShrink: 0, background: 'var(--card)' }}>
            {menu}
          </Sider>
        )}
        <Layout className="mate-page-layout">
          <Content
            style={{
              background: 'var(--card)',
              padding: 'var(--mate-content-padding)',
              margin: 0,
              borderRadius: 'var(--radius)',
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
      <SideSheet
        placement="left"
        visible={menuOpen}
        onCancel={() => setMenuOpen(false)}
        width={240}
        bodyStyle={{ padding: 0 }}
      >
        {menu}
      </SideSheet>
    </Layout>
  );
}
