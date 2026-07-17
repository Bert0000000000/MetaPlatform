import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Button } from 'antd';
import {
  RobotOutlined,
  UnorderedListOutlined,
  StarOutlined,
  TeamOutlined,
  GlobalOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/dw/employees', icon: <RobotOutlined />, label: '数字员工' },
  { key: '/dw/tasks', icon: <UnorderedListOutlined />, label: '任务中心' },
  { key: '/dw/evaluation', icon: <StarOutlined />, label: '效果评估' },
  { key: '/dw/collaborations', icon: <TeamOutlined />, label: '多员工协作' },
  { key: '/dw/external-agents', icon: <GlobalOutlined />, label: 'A2A 外部协作' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey =
    menuItems.find((m) => location.pathname.startsWith(m.key))?.key || '/dw/employees';

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
          数字员工工作台
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={220} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
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
