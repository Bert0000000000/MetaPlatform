import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button, Grid, Drawer } from 'antd';
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const menu = <PlatformMenu currentModule="dw" />;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMenuOpen(true)}
              style={{ marginRight: 8 }}
            />
          )}
          <Typography.Title
            level={4}
            style={{
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            数字员工工作台
          </Typography.Title>
        </div>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          {!isMobile && '退出'}
        </Button>
      </Header>
      <Layout>
        {!isMobile && (
          <Sider width={240} style={{ background: colorBgContainer }}>
            {menu}
          </Sider>
        )}
        <Layout className="mate-page-layout">
          <Content
            style={{
              background: colorBgContainer,
              padding: 'var(--mate-content-padding)',
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
      <Drawer
        placement="left"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        width={240}
        styles={{ body: { padding: 0 } }}
      >
        {menu}
      </Drawer>
    </Layout>
  );
}
