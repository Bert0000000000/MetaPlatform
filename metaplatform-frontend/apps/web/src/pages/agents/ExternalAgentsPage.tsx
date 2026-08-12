import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Rating,
  Space,
  Table,
  Tag,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlusOutlined, SyncOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { discoverAgents, listDelegations } from '@/api/dw/a2a';
import ExternalAgentCard from './components/ExternalAgentCard';
import DelegationForm from './components/DelegationForm';
import DelegationDetailDrawer from './components/DelegationDetailDrawer';
import type { Delegation, ExternalAgent } from '@/api/dw/a2a';

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

export default function ExternalAgentsPage() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [delegatingAgent, setDelegatingAgent] = useState<ExternalAgent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<ExternalAgent | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [a, d] = await Promise.all([discoverAgents(), listDelegations({ pageSize: 100 })]);
      setAgents(a);
      setDelegations(d.items);
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
      Toast.success('已发现外部 Agent');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(keyword.toLowerCase()) ||
    (a.description || '').toLowerCase().includes(keyword.toLowerCase())
  );

  const handleDelegationSuccess = (d: Delegation) => {
    setDelegations((prev) => [d, ...prev]);
    setDetailId(d.taskId);
  };

  const handleDelegationChange = (d: Delegation) => {
    setDelegations((prev) =>
      prev.map((item) => (item.taskId === d.taskId ? d : item))
    );
  };

  const columns: SemiColumns<Delegation> = [
    {
      title: '委托任务',
      key: 'task',
      render: (_: unknown, d: Delegation) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            {typeof d.payload?.task === 'string' ? d.payload.task : d.taskType}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            目标: {d.targetAgentId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: Delegation['status']) => (
        <Tag
          color={
            v === 'COMPLETED'
              ? 'green'
              : v === 'FAILED' || v === 'CANCELED' || v === 'CANCELLED'
              ? 'red'
              : v === 'WORKING'
              ? 'blue'
              : v === 'INPUT_REQUIRED'
              ? 'orange'
              : 'grey'
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: '结果摘要',
      dataIndex: 'result',
      render: (v?: Record<string, unknown>) =>
        v ? <code>{JSON.stringify(v).slice(0, 60)}</code> : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, d: Delegation) => (
        <Button
          theme="borderless"
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => setDetailId(d.taskId)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          A2A 外部协作
        </Typography.Title>
        <Space>
          <Input
            placeholder="搜索外部 Agent"
            showClear
            prefix={<SearchOutlined style={{ color: 'var(--muted-foreground)' }} />}
            style={{ width: 240 }}
            value={searchInput}
            onChange={(v: string) => setSearchInput(v)}
            onEnterPress={() => setKeyword(searchInput)}
          />
          <Button icon={<SyncOutlined />} onClick={handleDiscover} loading={loading}>
            发现外部 Agent
          </Button>
        </Space>
      </div>

      {filteredAgents.length === 0 && !loading ? (
        <Empty description="尚未发现外部 Agent">
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={handleDiscover}>
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
          {filteredAgents.map((a) => (
            <ExternalAgentCard
              key={a.agentId}
              agent={a}
              onDelegate={(ag) => setDelegatingAgent(ag)}
              onViewDetail={(ag) => setViewingAgent(ag)}
            />
          ))}
        </div>
      )}

      <Card title="委托历史">
        {delegations.length === 0 ? (
          <Empty description="暂无委托记录" />
        ) : (
          <Table
            rowKey="taskId"
            dataSource={delegations}
            columns={columns}
            pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      {delegatingAgent && (
        <DelegationForm
          open={!!delegatingAgent}
          agent={delegatingAgent}
          onCancel={() => setDelegatingAgent(null)}
          onSuccess={handleDelegationSuccess}
        />
      )}

      <Modal
        title="外部 Agent 详情"
        visible={!!viewingAgent}
        onCancel={() => setViewingAgent(null)}
        footer={null}
        width={560}
      >
        {viewingAgent && (
          <Space vertical style={{ width: '100%' }}>
            <Typography.Title heading={5}>{viewingAgent.name}</Typography.Title>
            <Typography.Paragraph type="secondary">
              {viewingAgent.description || '暂无描述'}
            </Typography.Paragraph>
            <Descriptions column={1} size="small">
              <Descriptions.Item itemKey="Agent ID">{viewingAgent.agentId}</Descriptions.Item>
              <Descriptions.Item itemKey="Endpoint">{viewingAgent.endpoint}</Descriptions.Item>
              <Descriptions.Item itemKey="认证方式">{viewingAgent.authType}</Descriptions.Item>
              <Descriptions.Item itemKey="状态">
                <Tag color={viewingAgent.status === 'online' ? 'green' : viewingAgent.status === 'error' ? 'red' : 'grey'}>
                  {viewingAgent.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item itemKey="评分">
                <Rating disabled defaultValue={viewingAgent.rating} allowHalf />
              </Descriptions.Item>
              <Descriptions.Item itemKey="委托次数">{viewingAgent.totalDelegations}</Descriptions.Item>
            </Descriptions>
            <Space wrap>
              {viewingAgent.capabilities.map((c) => (
                <Tag key={c} color="blue">{c}</Tag>
              ))}
            </Space>
            <Button theme="solid" type="primary" onClick={() => { setDelegatingAgent(viewingAgent); setViewingAgent(null); }}>
              委托任务
            </Button>
          </Space>
        )}
      </Modal>

      <DelegationDetailDrawer
        delegationId={detailId}
        onClose={() => setDetailId(null)}
        onChange={handleDelegationChange}
      />
    </div>
  );
}
