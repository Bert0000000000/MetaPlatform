import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Button } from 'antd';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  NodeIndexOutlined,
  TeamOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  ApartmentOutlined as ArchIcon,
  LogoutOutlined,
} from '@ant-design/icons';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

const MENU_GROUPS = [
  {
    key: 'g1',
    type: 'group' as const,
    label: '业务架构',
    children: [
      { key: '/arch', icon: <ApartmentOutlined />, label: '架构总览' },
      { key: '/arch/capabilities', icon: <ArchIcon />, label: '能力地图' },
      { key: '/arch/applications', icon: <AppstoreOutlined />, label: '应用系统' },
      { key: '/arch/value-streams', icon: <DeploymentUnitOutlined />, label: '价值流' },
      { key: '/arch/processes', icon: <NodeIndexOutlined />, label: '业务流程' },
      { key: '/arch/org-roles', icon: <TeamOutlined />, label: '组织与角色' },
    ],
  },
  {
    key: 'g2',
    type: 'group' as const,
    label: '技术架构',
    children: [
      { key: '/arch/data', icon: <DatabaseOutlined />, label: '数据架构' },
      { key: '/arch/tech', icon: <CloudServerOutlined />, label: '技术架构' },
    ],
  },
  {
    key: 'g3',
    type: 'group' as const,
    label: '架构治理',
    children: [
      { key: '/arch/principles', icon: <SafetyCertificateOutlined />, label: '原则与标准' },
      { key: '/arch/reviews', icon: <AuditOutlined />, label: '评审流程' },
      { key: '/arch/tech-debt', icon: <BugOutlined />, label: '技术债务' },
    ],
  },
  {
    key: 'g4',
    type: 'group' as const,
    label: '集成',
    children: [
      { key: '/arch/ontology-mapping', icon: <DeploymentUnitOutlined />, label: '本体映射' },
    ],
  },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

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
          架构中心
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={220} style={{ background: colorBgContainer, overflow: 'auto' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={['g1', 'g2', 'g3', 'g4']}
            style={{ height: '100%', borderRight: 0 }}
            items={MENU_GROUPS}
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
