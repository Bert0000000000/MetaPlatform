import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography } from 'antd';
import {
  ApartmentOutlined,
  BlockOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  PartitionOutlined,
  BellOutlined,
  MonitorOutlined,
} from '@ant-design/icons';
import GlobalSearch from './GlobalSearch';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/concepts', icon: <ApartmentOutlined />, label: '本体管理' },
  { key: '/entities', icon: <BlockOutlined />, label: '实体管理' },
  { key: '/relations', icon: <BranchesOutlined />, label: '关系类型' },
  { key: '/relation-instances', icon: <PartitionOutlined />, label: '关系实例' },
  { key: '/rules', icon: <ExperimentOutlined />, label: '规则管理' },
  { key: '/versions', icon: <HistoryOutlined />, label: '版本管理' },
  { key: '/datasources', icon: <DatabaseOutlined />, label: '数据源' },
  { key: '/mappings', icon: <PartitionOutlined />, label: '数据映射' },
  { key: '/actions', icon: <ThunderboltOutlined />, label: 'Action 定义' },
  { key: '/orchestrations', icon: <PartitionOutlined />, label: 'Action 编排' },
  { key: '/triggers', icon: <BellOutlined />, label: '触发器' },
  { key: '/executions', icon: <MonitorOutlined />, label: '执行监控' },
  { key: '/graph', icon: <NodeIndexOutlined />, label: '知识图谱' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey =
    menuItems.find((m) => location.pathname.startsWith(m.key))?.key || '/concepts';

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
          Ontology Studio
        </Typography.Title>
        <GlobalSearch />
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
