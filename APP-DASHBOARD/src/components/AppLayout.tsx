import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Button, Space, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import {
  DashboardOutlined,
  MessageOutlined,
  RobotOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  PartitionOutlined,
  ApiOutlined,
  BellOutlined,
  FileSearchOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { removeToken, getUser } from '@/utils/auth';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';

const { Header, Sider, Content } = Layout;

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
  { key: 'http://localhost:9301', icon: <MessageOutlined />, label: '超级 AI', external: true },
  { key: 'http://localhost:9401', icon: <RobotOutlined />, label: '数字员工', external: true },
  { key: 'http://localhost:9201', icon: <AppstoreOutlined />, label: '应用中心', external: true },
  { key: 'http://localhost:9101', icon: <ApartmentOutlined />, label: '本体论引擎', external: true },
  { key: 'http://localhost:9206', icon: <PartitionOutlined />, label: '架构中心', external: true },
  { key: 'http://localhost:9501', icon: <ApiOutlined />, label: 'MCP 服务中心', external: true },
  { key: '/notifications', icon: <BellOutlined />, label: '消息中心' },
  { key: '/deliverables', icon: <FileSearchOutlined />, label: '历史交付物' },
  { key: '/settings', icon: <SettingOutlined />, label: '个性化设置' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const {
    token: { colorBgContainer, borderRadiusLG, colorBorderSecondary },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const activeKey =
    MENU_ITEMS.find((m) => !m.external && location.pathname.startsWith(m.key))?.key || '/dashboard';
  const displayName = user?.username || 'Guest';
  const initials = displayName.charAt(0).toUpperCase();

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = MENU_ITEMS.find((m) => m.key === key);
    if (item?.external) {
      window.open(item.key, '_blank', 'noopener,noreferrer');
    } else {
      navigate(key);
    }
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
          borderBottom: `1px solid ${colorBorderSecondary}`,
        }}
      >
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Mate 工作台
          </Typography.Title>
          <GlobalSearch />
        </Space>
        <Space size="middle">
          <NotificationBell />
          <Space size="small" style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }}>
              {initials}
            </Avatar>
            <Typography.Text>{displayName}</Typography.Text>
          </Space>
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
            items={MENU_ITEMS}
            onClick={handleMenuClick}
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
