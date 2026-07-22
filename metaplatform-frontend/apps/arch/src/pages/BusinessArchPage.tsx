import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Space } from 'antd';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { listCapabilities } from '@/api/capabilities';
import { listApplications as listApps } from '@/api/applications';
import { listProcesses as listProcs } from '@/api/businessProcesses';
import { getOrgTree } from '@/api/roles';

export default function BusinessArchPage() {
  const [stats, setStats] = useState({ capabilities: 0, applications: 0, processes: 0, orgs: 0 });

  useEffect(() => {
    Promise.all([listCapabilities(), listApps(), listProcs(), getOrgTree()])
      .then(([caps, apps, procs, orgs]) => {
        setStats({
          capabilities: caps.total,
          applications: apps.total,
          processes: procs.total,
          orgs: orgs.length,
        });
      })
      .catch(() => {});
  }, []);

  const cards = [
    { title: '业务能力', value: stats.capabilities, icon: <ApartmentOutlined />, color: '#1677ff' },
    { title: '应用系统', value: stats.applications, icon: <AppstoreOutlined />, color: '#52c41a' },
    { title: '业务流程', value: stats.processes, icon: <NodeIndexOutlined />, color: '#722ed1' },
    { title: '组织单元', value: stats.orgs, icon: <DeploymentUnitOutlined />, color: '#fa8c16' },
  ];

  return (
    <div>
      <Typography.Title level={4}>业务架构总览</Typography.Title>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col span={6} key={c.title}>
            <Card>
              <Statistic title={c.title} value={c.value} prefix={<span style={{ color: c.color }}>{c.icon}</span>} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="架构导航" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>📋 <Typography.Link href="#/arch/capabilities">能力地图</Typography.Link> — 管理企业业务能力层级</Typography.Text>
          <Typography.Text>📱 <Typography.Link href="#/arch/applications">应用系统</Typography.Link> — 注册应用系统并关联能力</Typography.Text>
          <Typography.Text>🔀 <Typography.Link href="#/arch/value-streams">价值流</Typography.Link> — 管理端到端价值交付流</Typography.Text>
          <Typography.Text>📊 <Typography.Link href="#/arch/processes">业务流程</Typography.Link> — 业务流程与能力关联</Typography.Text>
          <Typography.Text>👥 <Typography.Link href="#/arch/org-roles">组织与角色</Typography.Link> — 组织架构与角色管理</Typography.Text>
        </Space>
      </Card>
    </div>
  );
}
