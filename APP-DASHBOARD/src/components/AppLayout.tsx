import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button, Space, Avatar, Grid, Drawer } from 'antd';
import { UserOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken, getUser } from '@/utils/auth';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const user = getUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const {
    token: { colorBgContainer, borderRadiusLG, colorBorderSecondary },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const displayName = user?.username || 'Guest';
  const initials = displayName.charAt(0).toUpperCase();
  const menu = <PlatformMenu currentModule="dashboard" />;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: `1px solid ${colorBorderSecondary}`,
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
          <Space style={{ flex: 1, minWidth: 0 }}>
            <Typography.Title
              level={4}
              style={{
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Mate 工作台
            </Typography.Title>
            {!isMobile && <GlobalSearch />}
          </Space>
        </div>
        <Space size="middle" style={{ flexShrink: 0 }}>
          <NotificationBell />
          <Space
            size="small"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/settings')}
          >
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }}>
              {initials}
            </Avatar>
            {!isMobile && <Typography.Text>{displayName}</Typography.Text>}
          </Space>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
            {!isMobile && '退出'}
          </Button>
        </Space>
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
