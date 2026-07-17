import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Button } from 'antd';
import {
  ApiOutlined,
  ClusterOutlined,
  ExperimentOutlined,
  LinkOutlined,
  SafetyOutlined,
  FileTextOutlined,
  AuditOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/tools', icon: <ApiOutlined />, label: '工具注册中心' },
  { key: '/servers', icon: <ClusterOutlined />, label: 'MCP Server' },
  { key: '/debugger', icon: <ExperimentOutlined />, label: '调试器' },
  { key: '/clients', icon: <LinkOutlined />, label: 'MCP Client' },
  { key: '/permissions', icon: <SafetyOutlined />, label: '权限控制' },
  { key: '/resources', icon: <FileTextOutlined />, label: '资源配置' },
  { key: '/prompts', icon: <AppstoreOutlined />, label: 'Prompt 模板' },
  { key: '/audit', icon: <AuditOutlined />, label: '调用审计' },
  { key: '/integrations', icon: <GlobalOutlined />, label: '外部对接' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey =
    menuItems.find((m) => location.pathname.startsWith(m.key))?.key || '/tools';

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
          MCP Hub
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
