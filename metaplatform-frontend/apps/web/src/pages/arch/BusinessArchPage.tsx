import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Space } from '@douyinfe/semi-ui';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { listCapabilities } from '@/api/arch/capabilities';
import { listApplications as listApps } from '@/api/arch/applications';
import { listProcesses as listProcs } from '@/api/arch/businessProcesses';
import { getOrgTree } from '@/api/arch/roles';

export default function BusinessArchPage() {
  const [stats, setStats] = useState({ capabilities: 0, applications: 0, processes: 0, orgs: 0 });

  useEffect(() => {
    Promise.all([listCapabilities(), listApps(), listProcs(), getOrgTree()])
      .then(([caps, apps, procs, orgs]) => {
        setStats({
          capabilities: caps.total,
          applications: apps.total,
          processes: procs.length,
          orgs: orgs.length,
        });
      })
      .catch(() => {});
  }, []);

  const cards = [
    { title: '业务能力', value: stats.capabilities, icon: <ApartmentOutlined />, color: 'var(--semi-color-primary)' },
    { title: '应用系统', value: stats.applications, icon: <AppstoreOutlined />, color: 'var(--semi-color-success)' },
    { title: '业务流程', value: stats.processes, icon: <NodeIndexOutlined />, color: 'var(--semi-color-violet)' },
    { title: '组织单元', value: stats.orgs, icon: <DeploymentUnitOutlined />, color: 'var(--semi-color-warning)' },
  ];

  return (
    <div>
      <Typography.Title heading={4}>业务架构总览</Typography.Title>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col span={6} key={c.title}>
            <Card>
              <div style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }}>{c.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 26, fontWeight: 600, marginTop: 4 }}>
                <span style={{ color: c.color, fontSize: 18 }}>{c.icon}</span>
                {c.value}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="架构导航" style={{ marginTop: 16 }}>
        <Space vertical spacing="medium" style={{ width: '100%' }}>
          <Typography.Text>📋 <Typography.Text link={{ href: '#/arch/capabilities' }}>能力地图</Typography.Text> — 管理企业业务能力层级</Typography.Text>
          <Typography.Text>📱 <Typography.Text link={{ href: '#/arch/applications' }}>应用系统</Typography.Text> — 注册应用系统并关联能力</Typography.Text>
          <Typography.Text>🔀 <Typography.Text link={{ href: '#/arch/value-streams' }}>价值流</Typography.Text> — 管理端到端价值交付流</Typography.Text>
          <Typography.Text>📊 <Typography.Text link={{ href: '#/arch/processes' }}>业务流程</Typography.Text> — 业务流程与能力关联</Typography.Text>
          <Typography.Text>👥 <Typography.Text link={{ href: '#/arch/org-roles' }}>组织与角色</Typography.Text> — 组织架构与角色管理</Typography.Text>
        </Space>
      </Card>
    </div>
  );
}
