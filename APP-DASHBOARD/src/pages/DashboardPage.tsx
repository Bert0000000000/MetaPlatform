import { Row, Col, Card, Typography, Space, Avatar } from 'antd';
import { getUser } from '@/utils/auth';
import ApprovalCard from '@/components/ApprovalCard';
import WorkerStatusCard from '@/components/WorkerStatusCard';
import MetricsPanel from '@/components/MetricsPanel';
import ShortcutPanel from '@/components/ShortcutPanel';

export default function DashboardPage() {
  const user = getUser();

  return (
    <div>
      <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', border: 'none' }}>
        <Space size="large">
          <Avatar size={64} style={{ background: 'rgba(255,255,255,0.3)' }}>
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <div>
            <Typography.Title level={3} style={{ color: '#fff', margin: 0 }}>
              欢迎回来，{user?.username || '用户'} 👋
            </Typography.Title>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.8)' }}>
              今天是 {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </Typography.Text>
          </div>
        </Space>
      </Card>

      <ShortcutPanel />

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <MetricsPanel />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <ApprovalCard />
        </Col>
        <Col span={12}>
          <WorkerStatusCard />
        </Col>
      </Row>
    </div>
  );
}
