import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Button, Space } from 'antd';
import {
  DashboardOutlined,
  BellOutlined,
  FileSearchOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { removeToken } from '@/utils/auth';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息中心' },
    { key: '/deliverables', icon: <FileSearchOutlined />, label: '历史交付物' },
    { key: '/settings', icon: <SettingOutlined />, label: '个性化设置' },
  ];

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const activeKey = menuItems.find((m) => location.pathname.startsWith(m.key))?.key || '/dashboard';

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
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Mate 工作台
          </Typography.Title>
          <GlobalSearch />
        </Space>
        <Space>
          <NotificationBell />
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
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
    </Layout>
  );
}
