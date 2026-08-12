import { Card, Rating, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import type { ExternalAgent } from '@/api/dw/a2a';

interface ExternalAgentCardProps {
  agent: ExternalAgent;
  onDelegate: (a: ExternalAgent) => void;
  onViewDetail: (a: ExternalAgent) => void;
}

const STATUS_COLOR: Record<ExternalAgent['status'], TagColor> = {
  online: 'green',
  offline: 'grey',
  error: 'red',
};

export default function ExternalAgentCard({ agent, onDelegate, onViewDetail }: ExternalAgentCardProps) {
  return (
    <Card
      shadows="hover"
      title={
        <Space>
          <Typography.Text strong>{agent.name}</Typography.Text>
          <Tag color={STATUS_COLOR[agent.status]}>{agent.status}</Tag>
        </Space>
      }
      actions={[
        <a key="delegate" onClick={() => onDelegate(agent)}>委托任务</a>,
        <a key="detail" onClick={() => onViewDetail(agent)}>详情</a>,
      ]}
    >
      <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
        {agent.description}
      </Typography.Paragraph>
      <Space wrap style={{ marginBottom: 8 }}>
        {agent.capabilities.map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
      </Space>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Rating disabled defaultValue={agent.rating} allowHalf style={{ fontSize: 14 }} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {agent.totalDelegations} 委托
        </Typography.Text>
      </div>
    </Card>
  );
}
