import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Space,
  Spin,
  Tag,
  Typography,
  Tabs,
  message,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { getServer, updateServer, startServer, stopServer, deleteServer } from '@/api/servers';
import { listTools } from '@/api/tools';
import ToolAssignmentPanel from '@/components/ToolAssignmentPanel';
import ServerForm from '@/components/ServerForm';
import type { McpServer, McpServerCreateRequest, McpTool } from '@/types';

const STATUS_MAP: Record<McpServer['status'], { label: string; color: string }> = {
  online: { label: '在线', color: 'success' },
  offline: { label: '离线', color: 'default' },
  error: { label: '异常', color: 'error' },
};

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const s = await getServer(id);
      setServer(s);
      const t = await listTools();
      setTools(t.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading || !server) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const handleStart = async () => {
    await startServer(server.id);
    message.success('已启动');
    load();
  };

  const handleStop = async () => {
    await stopServer(server.id);
    message.success('已停止');
    load();
  };

  const handleDelete = async () => {
    await deleteServer(server.id);
    message.success('已删除');
    navigate('/servers');
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/servers')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {server.name}
        </Typography.Title>
        <Tag color={STATUS_MAP[server.status].color}>{STATUS_MAP[server.status].label}</Tag>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
          编辑
        </Button>
        {server.status === 'offline' ? (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
            启动
          </Button>
        ) : (
          <Button icon={<PauseCircleOutlined />} onClick={handleStop}>
            停止
          </Button>
        )}
        <Popconfirm title="确定删除？" onConfirm={handleDelete}>
          <Button danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>

      <Tabs
        items={[
          {
            key: 'info',
            label: '基本信息',
            children: (
              <Card>
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="名称">{server.name}</Descriptions.Item>
                  <Descriptions.Item label="编码">{server.code}</Descriptions.Item>
                  <Descriptions.Item label="传输">{server.transport}</Descriptions.Item>
                  <Descriptions.Item label="端点">
                    <code>{server.endpoint}</code>
                  </Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>
                    {server.description || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="工具数量">{server.toolIds.length}</Descriptions.Item>
                  <Descriptions.Item label="启用">
                    {server.enabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间" span={2}>
                    {server.createdAt || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'tools',
            label: '工具分配',
            children: <ToolAssignmentPanel server={server} tools={tools} />,
          },
          {
            key: 'jsonrpc',
            label: 'JSON-RPC 接口',
            children: (
              <Card>
                <Typography.Paragraph>
                  客户端通过 JSON-RPC 2.0 调用本 Server 暴露的工具：
                </Typography.Paragraph>
                <Card type="inner" style={{ background: '#fafafa' }}>
                  <pre style={{ margin: 0 }}>
                    <code>
                      {`POST ${server.endpoint}
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": { /* 工具参数 */ }
  }
}`}
                    </code>
                  </pre>
                </Card>
                <Typography.Paragraph style={{ marginTop: 16 }}>
                  <CodeOutlined /> 支持方法：<code>tools/list</code>、<code>tools/call</code>、
                  <code>resources/list</code>、<code>resources/read</code>、
                  <code>prompts/list</code>、<code>prompts/get</code>
                </Typography.Paragraph>
              </Card>
            ),
          },
        ]}
      />

      <ServerForm
        open={editOpen}
        initial={server}
        availableTools={tools.map((t) => ({ id: t.id, name: t.name }))}
        onOk={async (values: McpServerCreateRequest) => {
          setSubmitting(true);
          try {
            await updateServer(server.id, values);
            message.success('已更新');
            setEditOpen(false);
            load();
          } finally {
            setSubmitting(false);
          }
        }}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
      />
    </div>
  );
}
