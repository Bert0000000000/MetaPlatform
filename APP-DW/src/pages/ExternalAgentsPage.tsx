import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Descriptions,
} from 'antd';
import { PlusOutlined, SyncOutlined, LinkOutlined } from '@ant-design/icons';
import {
  delegateTask,
  discoverAgents,
  listDelegations,
  listExternalAgents,
} from '@/api/a2a';
import ExternalAgentCard from '@/components/ExternalAgentCard';
import DelegationForm from '@/components/DelegationForm';
import type { DelegationRequest, ExternalAgent } from '@/api/a2a';

export default function ExternalAgentsPage() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [delegations, setDelegations] = useState<DelegationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [delegatingAgent, setDelegatingAgent] = useState<ExternalAgent | null>(null);
  const [viewing, setViewing] = useState<ExternalAgent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [a, d] = await Promise.all([listExternalAgents(), listDelegations()]);
      setAgents(a);
      setDelegations(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDiscover = async () => {
    setLoading(true);
    try {
      await discoverAgents();
      message.success('已发现外部 Agent');
      load();
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '委托',
      key: 'delegation',
      render: (_, d: DelegationRequest) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{d.task}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Agent: {d.agentId}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
    {
      title: '结果',
      dataIndex: 'result',
      render: (v) => (v ? <code>{JSON.stringify(v).slice(0, 60)}</code> : '-'),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          A2A 外部协作
        </Typography.Title>
        <Space>
          <Button icon={<SyncOutlined />} onClick={handleDiscover} loading={loading}>
            发现外部 Agent
          </Button>
        </Space>
      </div>

      {agents.length === 0 && !loading ? (
        <Empty
          description="尚未发现外部 Agent"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleDiscover}>
            开始发现
          </Button>
        </Empty>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          {agents.map((a) => (
            <ExternalAgentCard
              key={a.agentId}
              agent={a}
              onDelegate={(ag) => setDelegatingAgent(ag)}
              onViewDetail={(ag) => setViewing(ag)}
            />
          ))}
        </div>
      )}

      <Card title="委托历史" style={{ marginTop: 16 }}>
        {delegations.length === 0 ? (
          <Empty description="暂无委托记录" />
        ) : (
          <Table
            rowKey="delegationId"
            dataSource={delegations}
            columns={columns}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {delegatingAgent && (
        <DelegationForm
          open={!!delegatingAgent}
          agent={delegatingAgent}
          onCancel={() => {
            setDelegatingAgent(null);
            load();
          }}
        />
      )}

      <Modal
        title={viewing?.name}
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={null}
        width={560}
      >
        {viewing && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="端点" span={2}>
              <code>{viewing.endpoint}</code>
            </Descriptions.Item>
            <Descriptions.Item label="认证">{viewing.authType}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag>{viewing.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="评分">{viewing.rating}</Descriptions.Item>
            <Descriptions.Item label="总委托">{viewing.totalDelegations}</Descriptions.Item>
            <Descriptions.Item label="能力" span={2}>
              {viewing.capabilities.map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
