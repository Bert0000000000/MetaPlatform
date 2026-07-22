import { Card, Tag, Typography, Space, Empty } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

interface TraceLinkViewerProps {
  traceId?: string;
}

interface Span {
  spanId: string;
  name: string;
  service: string;
  duration: number;
  status: 'ok' | 'error';
  startTime: number;
}

const MOCK_SPANS: Span[] = [
  { spanId: 's1', name: 'POST /v1/agent/tasks', service: 'tech-agent', duration: 1500, status: 'ok', startTime: 0 },
  { spanId: 's2', name: 'plan.generate', service: 'tech-agent', duration: 200, status: 'ok', startTime: 100 },
  { spanId: 's3', name: 'tool.invoke', service: 'tech-action', duration: 800, status: 'ok', startTime: 300 },
  { spanId: 's4', name: 'db.query', service: 'postgresql', duration: 400, status: 'ok', startTime: 500 },
  { spanId: 's5', name: 'llm.call', service: 'tech-llmgw', duration: 600, status: 'ok', startTime: 900 },
  { spanId: 's6', name: 'notify.send', service: 'tech-msg', duration: 100, status: 'error', startTime: 1500 },
];

export default function TraceLinkViewer({ traceId }: TraceLinkViewerProps) {
  if (!traceId) return <Empty description="无 Trace ID" />;
  return (
    <Card title={`Trace 链路 - ${traceId}`}>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary">
          完整分布式追踪日志请前往{' '}
          <a href="#" target="_blank" rel="noreferrer">
            <LinkOutlined /> TECH-OBS
          </a>{' '}
          查看。
        </Typography.Text>
      </Space>
      <div>
        {MOCK_SPANS.map((s) => (
          <div
            key={s.spanId}
            style={{
              padding: 8,
              marginBottom: 4,
              borderLeft: `4px solid ${s.status === 'ok' ? '#52c41a' : '#f5222d'}`,
              background: '#fafafa',
              borderRadius: 4,
            }}
          >
            <Space>
              <Tag color="blue">{s.service}</Tag>
              <Typography.Text strong>{s.name}</Typography.Text>
              <Tag color={s.status === 'ok' ? 'success' : 'error'}>{s.status}</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {s.duration}ms
              </Typography.Text>
            </Space>
          </div>
        ))}
      </div>
    </Card>
  );
}
