import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  LinkOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { listClients, deleteClient, discoverClientTools } from '@/api/clients';
import type { McpClient } from '@/types';

function normalizeStatus(status: string): McpClient['status'] {
  const s = status.toLowerCase();
  if (s === 'connected') return 'connected';
  if (s === 'error') return 'error';
  return 'disconnected';
}

const STATUS_MAP: Record<McpClient['status'], { label: string; color: string }> = {
  connected: { label: '已连接', color: 'success' },
  disconnected: { label: '未连接', color: 'default' },
  error: { label: '异常', color: 'error' },
};

export default function ClientListPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<McpClient[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listClients();
      setClients(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (c: McpClient) => {
    await deleteClient(c.id);
    message.success('Client 已删除');
    load();
  };

  const handleSync = async (c: McpClient) => {
    const tools = await discoverClientTools(c.id);
    message.success(`已发现 ${tools.length} 个工具`);
    load();
  };

  const columns: ColumnsType<McpClient> = [
    {
      title: 'Client',
      key: 'name',
      render: (_, c) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <LinkOutlined /> {c.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {c.endpoint}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'clientType',
      render: (v) => <Tag>{v || 'custom'}</Tag>,
    },
    {
      title: '认证',
      dataIndex: 'authType',
      render: (v) => <Tag>{v || 'none'}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, c) => {
        const s = normalizeStatus(c.status);
        return <Tag color={STATUS_MAP[s].color}>{STATUS_MAP[s].label}</Tag>;
      },
    },
    {
      title: '发现工具',
      key: 'tools',
      render: (_, c) => <Tag color="blue">{c.discoveredTools}</Tag>,
    },
    {
      title: '最后同步',
      key: 'lastSync',
      render: (_, c) => (c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, c) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/clients/${c.id}`)}>
            详情
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/clients/${c.id}/edit`)}>
            编辑
          </Button>
          <Button type="link" icon={<SyncOutlined />} onClick={() => handleSync(c)}>
            发现工具
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(c)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          MCP Client 管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clients/new')}>
          添加 Client
        </Button>
      </div>

      <Card>
        {clients.length === 0 && !loading ? (
          <Empty description="还没有 MCP Client" />
        ) : (
          <Table
            rowKey="id"
            dataSource={clients}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        )}
      </Card>
    </div>
  );
}
