import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Pagination,
  Rating,
  Space,
  Table,
  Tag,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import {
  Eye,
  Plus,
  RefreshCw,
  Search as SearchIcon,
} from 'lucide-react';
import { SyncOutlined } from '@ant-design/icons';
import { discoverAgents, listDelegations } from '@/api/dw/a2a';
import ExternalAgentCard from './ExternalAgentCard';
import DelegationForm from './DelegationForm';
import DelegationDetailDrawer from './DelegationDetailDrawer';
import type { Delegation, ExternalAgent } from '@/api/dw/a2a';
import { SearchInput } from '@mate/shared';

const { Text } = Typography;

export default function ExternalAgentsPanel() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
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

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(keyword.toLowerCase()) ||
      (a.description || '').toLowerCase().includes(keyword.toLowerCase()),
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleDelegationSuccess = (d: Delegation) => {
    setDelegations((prev) => [d, ...prev]);
    setDetailId(d.taskId);
  };

  const handleDelegationChange = (d: Delegation) => {
    setDelegations((prev) => prev.map((item) => (item.taskId === d.taskId ? d : item)));
  };

  const columns = [
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
      width: 110,
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
      ellipsis: true,
      render: (v?: Record<string, unknown>) =>
        v ? <code>{JSON.stringify(v).slice(0, 60)}</code> : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, d: Delegation) => (
        <Button
          theme="borderless"
          type="primary"
          icon={<Eye size={14} />}
          onClick={() => setDetailId(d.taskId)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <>
      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="tertiary" style={{ fontSize: 12 }}>
          基于 A2A 协议注册：共 {filtered.length} 个外部 Agent
        </Text>
        <Space>
          <SearchInput placeholder="搜索外部 Agent" width={240} onSearch={setKeyword} />
          <Button icon={<SyncOutlined />} onClick={handleDiscover} loading={loading}>
            发现外部 Agent
          </Button>
        </Space>
      </div>

      {/* Agent 卡片 */}
      {filtered.length === 0 && !loading ? (
        <Card bodyStyle={{ padding: 48 }}>
          <Empty description="尚未发现外部 Agent">
            <Button theme="solid" type="primary" icon={<Plus size={14} />} onClick={handleDiscover}>
              开始发现
            </Button>
          </Empty>
        </Card>
      ) : (
        <Card
          bodyStyle={{ padding: 16 }}
          bordered={false}
          style={{ border: '1px solid var(--border)', borderRadius: 8 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {paged.map((a) => (
              <ExternalAgentCard
                key={a.agentId}
                agent={a}
                onDelegate={(ag) => setDelegatingAgent(ag)}
                onViewDetail={(ag) => setViewingAgent(ag)}
              />
            ))}
          </div>
          {filtered.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
              <Pagination
                total={filtered.length}
                currentPage={page}
                pageSize={pageSize}
                showSizeChanger
                showTotal
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            </div>
          )}
        </Card>
      )}

      {/* 委托历史 */}
      <Card
        title="委托历史"
        bordered={false}
        bodyStyle={{ padding: 0 }}
        style={{ border: '1px solid var(--border)', borderRadius: 8 }}
      >
        {delegations.length === 0 ? (
          <div style={{ padding: 48 }}>
            <Empty description="暂无委托记录" />
          </div>
        ) : (
          <Table
            rowKey="taskId"
            dataSource={delegations}
            columns={columns}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
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
                <Tag
                  color={
                    viewingAgent.status === 'online'
                      ? 'green'
                      : viewingAgent.status === 'error'
                      ? 'red'
                      : 'grey'
                  }
                >
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
            <Button
              theme="solid"
              type="primary"
              onClick={() => {
                setDelegatingAgent(viewingAgent);
                setViewingAgent(null);
              }}
            >
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
    </>
  );
}
