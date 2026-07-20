import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography } from 'antd';
import { PlatformMenu } from '@mate/shared';
import GlobalSearch from './GlobalSearch';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

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
        <Sider width={240} style={{ background: colorBgContainer }}>
          <PlatformMenu currentModule="ontstudio" />
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
