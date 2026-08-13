import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  SideSheet,
  Space,
  Spin,
  Tag,
  Typography,
  Table,
  Tooltip,
  Toast,
  Banner,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { getClient, listClientTools, discoverClientTools, testConnection } from '@/api/mcphub/clients';
import type { McpClient, McpDiscoveredTool } from '@/api/mcphub/types';

function normalizeStatus(status: string): McpClient['status'] {
  const s = status.toLowerCase();
  if (s === 'connected') return 'connected';
  if (s === 'error') return 'error';
  return 'disconnected';
}

const STATUS_MAP: Record<McpClient['status'], { label: string; color: TagColor }> = {
  connected: { label: '已连接', color: 'green' },
  CONNECTED: { label: '已连接', color: 'green' },
  disconnected: { label: '未连接', color: 'grey' },
  DISCONNECTED: { label: '未连接', color: 'grey' },
  error: { label: '异常', color: 'red' },
  ERROR: { label: '异常', color: 'red' },
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<McpClient | null>(null);
  const [tools, setTools] = useState<McpDiscoveredTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [schemaTool, setSchemaTool] = useState<McpDiscoveredTool | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [c, t] = await Promise.all([getClient(id), listClientTools(id)]);
      setClient(c);
      setTools(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSync = async () => {
    if (!id) return;
    setSyncing(true);
    try {
      const discovered = await discoverClientTools(id);
      setTools(discovered);
      Toast.success(`已同步 ${discovered.length} 个工具`);
      if (client) {
        const updated = await getClient(id);
        setClient(updated);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleTest = async () => {
    if (!id) return;
    setTesting(true);
    try {
      const updated = await testConnection(id);
      setClient(updated);
      const ok = updated.status.toLowerCase() === 'connected';
      Toast.success(ok ? '连接成功' : '连接失败');
    } finally {
      setTesting(false);
    }
  };

  const handleDebug = () => {
    if (!client) return;
    navigate(`/debugger?endpoint=${encodeURIComponent(client.endpoint)}`);
  };

  const formatSchema = (schema?: string) => {
    if (!schema) return '{}';
    try {
      return JSON.stringify(JSON.parse(schema), null, 2);
    } catch {
      return schema;
    }
  };

  const columns: ColumnProps<McpDiscoveredTool>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (v, t) => (
        <Space>
          <Typography.Text strong>{v}</Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
            <CodeOutlined /> {t.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '类型',
      dataIndex: 'toolType',
      render: (v) => <Tag>{v || 'MCP'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, t) => (
        <Button theme="borderless" onClick={() => setSchemaTool(t)}>
          查看 Schema
        </Button>
      ),
    },
  ];

  if (error) {
    return <Banner type="danger" description={error} style={{ margin: 24 }} />;
  }

  if (loading || !client) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const status = normalizeStatus(client.status);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>
          返回
        </Button>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {client.name}
        </Typography.Title>
        <Tag color={STATUS_MAP[status].color}>{STATUS_MAP[status].label}</Tag>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
        <Button icon={<SyncOutlined />} loading={syncing} onClick={handleSync}>
          同步工具
        </Button>
        <Button icon={<ApiOutlined />} loading={testing} onClick={handleTest}>
          测试连接
        </Button>
        <Tooltip content="跳转到 MCP 调试器并带入当前端点">
          <Button icon={<ThunderboltOutlined />} onClick={handleDebug}>
            跳转调试器
          </Button>
        </Tooltip>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item itemKey="ID">{client.id}</Descriptions.Item>
          <Descriptions.Item itemKey="名称">{client.name}</Descriptions.Item>
          <Descriptions.Item itemKey="端点">
            <code>{client.endpoint}</code>
          </Descriptions.Item>
          <Descriptions.Item itemKey="Client 类型">{client.clientType || 'custom'}</Descriptions.Item>
          <Descriptions.Item itemKey="传输协议">{client.transportType || 'HTTP'}</Descriptions.Item>
          <Descriptions.Item itemKey="认证方式">{client.authType || 'none'}</Descriptions.Item>
          <Descriptions.Item itemKey="超时（ms）">{client.timeoutMs ?? '-'}</Descriptions.Item>
          <Descriptions.Item itemKey="最后同步">
            {client.lastSyncAt ? new Date(client.lastSyncAt).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="创建时间">
            {client.createdAt ? new Date(client.createdAt).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="更新时间">
            {client.updatedAt ? new Date(client.updatedAt).toLocaleString() : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="已发现工具">
        <Table
          rowKey="id"
          dataSource={tools}
          columns={columns}
          pagination={{ pageSize: 10 }}
          empty="暂无已发现工具，点击「同步工具」获取"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <SideSheet
        title={schemaTool ? `${schemaTool.name} - Schema` : 'Schema'}
        width={560}
        visible={!!schemaTool}
        onCancel={() => setSchemaTool(null)}
      >
        <pre
          style={{
            background: 'var(--muted)',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            maxHeight: '70vh',
          }}
        >
          <code>{formatSchema(schemaTool?.inputSchema)}</code>
        </pre>
      </SideSheet>
    </div>
  );
}
