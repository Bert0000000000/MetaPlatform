import { Row, Col, Card, Typography, Space, Avatar } from 'antd';
import {
  AppstoreOutlined,
  RobotOutlined,
  MessageOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { getUser } from '@/utils/auth';
import ApprovalCard from '@/components/ApprovalCard';
import WorkerStatusCard from '@/components/WorkerStatusCard';
import MetricsPanel from '@/components/MetricsPanel';

const QUICK_ACTIONS = [
  { title: '应用中心', desc: '低代码应用构建', icon: <AppstoreOutlined />, link: 'http://localhost:9201/apps', color: '#1677ff' },
  { title: '超级 AI', desc: '智能对话与分析', icon: <MessageOutlined />, link: 'http://localhost:9203/chat', color: '#722ed1' },
  { title: '数字员工', desc: 'AI 自动化任务', icon: <RobotOutlined />, link: 'http://localhost:9204/dw', color: '#52c41a' },
  { title: '本体工作室', desc: '本体论引擎', icon: <ApartmentOutlined />, link: 'http://localhost:9205/concepts', color: '#fa8c16' },
];

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

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {QUICK_ACTIONS.map((action) => (
          <Col span={6} key={action.title}>
            <Card
              hoverable
              onClick={() => window.open(action.link, '_blank')}
              style={{ height: '100%' }}
            >
              <Space direction="vertical" size="middle">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${action.color}15`,
                    color: action.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                  }}
                >
                  {action.icon}
                </div>
                <div>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {action.title}
                  </Typography.Text>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {action.desc}
                    </Typography.Text>
                  </div>
                </div>
                <Typography.Link>
                  进入 <ArrowRightOutlined />
                </Typography.Link>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

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
