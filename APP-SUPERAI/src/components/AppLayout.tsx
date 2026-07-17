import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Button } from 'antd';
import {
  MessageOutlined,
  ScheduleOutlined,
  PartitionOutlined,
  RocketOutlined,
  MergeCellsOutlined,
  ProfileOutlined,
  AimOutlined,
  ClusterOutlined,
  PlayCircleOutlined,
  FileSearchOutlined,
  ExperimentOutlined,
  DownloadOutlined,
  UserSwitchOutlined,
  GlobalOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/chat', icon: <MessageOutlined />, label: '智能对话' },
  { key: '/schedule/orchestration', icon: <ScheduleOutlined />, label: '任务编排' },
  { key: '/schedule/plan', icon: <PartitionOutlined />, label: '执行计划' },
  { key: '/schedule/parallel', icon: <RocketOutlined />, label: '并行执行监控' },
  { key: '/schedule/aggregate', icon: <MergeCellsOutlined />, label: '结果汇聚' },
  { key: '/schedule/templates', icon: <ProfileOutlined />, label: '任务模板' },
  { key: '/schedule/intent', icon: <AimOutlined />, label: '意图识别' },
  { key: '/schedule/match', icon: <ClusterOutlined />, label: '员工匹配' },
  { key: '/schedule/plan-card', icon: <ProfileOutlined />, label: '计划卡片' },
  { key: '/schedule/execution', icon: <PlayCircleOutlined />, label: '执行面板' },
  { key: '/schedule/execution/detail', icon: <FileSearchOutlined />, label: '执行详情' },
  { key: '/schedule/result', icon: <ExperimentOutlined />, label: '结果汇总' },
  { key: '/schedule/export', icon: <DownloadOutlined />, label: '报告导出' },
  { key: '/schedule/manual-select', icon: <UserSwitchOutlined />, label: '手动选员' },
  { key: '/schedule/a2a', icon: <GlobalOutlined />, label: 'A2A 协作' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey =
    menuItems.find((m) => location.pathname.startsWith(m.key))?.key || '/chat';

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
          SuperAI
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
