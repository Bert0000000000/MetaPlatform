import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Button } from 'antd';
import { AppstoreOutlined, LogoutOutlined } from '@ant-design/icons';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/apps',
      icon: <AppstoreOutlined />,
      label: '应用管理',
    },
  ];

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

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
        <Typography.Title level={4} style={{ margin: 0 }}>
          应用中心
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname.startsWith('/apps') ? '/apps' : location.pathname]}
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
