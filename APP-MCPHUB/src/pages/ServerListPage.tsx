import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
  Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import { listServers, deleteServer, startServer, stopServer, createServer } from '@/api/servers';
import { listTools } from '@/api/tools';
import ServerForm from '@/components/ServerForm';
import type { McpServer, McpTool } from '@/types';

const STATUS_MAP: Record<McpServer['status'], { label: string; color: string }> = {
  online: { label: '在线', color: 'success' },
  offline: { label: '离线', color: 'default' },
  error: { label: '异常', color: 'error' },
};

export default function ServerListPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listServers({ keyword });
      setServers(res.items);
      const t = await listTools();
      setTools(t.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword]);

  const handleDelete = async (s: McpServer) => {
    await deleteServer(s.id);
    message.success('Server 已删除');
    load();
  };

  const handleStart = async (s: McpServer) => {
    await startServer(s.id);
    message.success('已启动');
    load();
  };

  const handleStop = async (s: McpServer) => {
    await stopServer(s.id);
    message.success('已停止');
    load();
  };

  const columns: ColumnsType<McpServer> = [
    {
      title: '名称',
      key: 'name',
      render: (_, s) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <ClusterOutlined /> {s.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {s.code}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '传输', dataIndex: 'transport', render: (v) => <Tag>{v}</Tag> },
    { title: '端点', dataIndex: 'endpoint', ellipsis: true },
    {
      title: '工具数',
      key: 'tools',
      render: (_, s) => <Tag color="blue">{s.toolIds.length}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, s) => (
        <Tag color={STATUS_MAP[s.status].color}>{STATUS_MAP[s.status].label}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, s) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/servers/${s.id}`)}>
            详情
          </Button>
          {s.status === 'offline' ? (
            <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleStart(s)}>
              启动
            </Button>
          ) : (
            <Button type="link" icon={<PauseCircleOutlined />} onClick={() => handleStop(s)}>
              停止
            </Button>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(s)}>
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
          MCP Server 管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
          创建 Server
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索名称/编码"
          allowClear
          onSearch={setKeyword}
          style={{ width: 240 }}
        />
      </Space>

      <Card>
        {servers.length === 0 && !loading ? (
          <Empty description="还没有 MCP Server，点击右上角创建" />
        ) : (
          <Table
            rowKey="id"
            dataSource={servers}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      <ServerForm
        open={formOpen}
        availableTools={tools.map((t) => ({ id: t.id, name: t.name }))}
        onOk={async (values) => {
          setSubmitting(true);
          try {
            await createServer(values);
            message.success('Server 已创建');
            setFormOpen(false);
            load();
          } finally {
            setSubmitting(false);
          }
        }}
        onCancel={() => setFormOpen(false)}
        confirmLoading={submitting}
      />
    </div>
  );
}
