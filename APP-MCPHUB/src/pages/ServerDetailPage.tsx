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
  Table,
  Statistic,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getServer,
  updateServer,
  startServer,
  stopServer,
  restartServer,
  deleteServer,
  getServerStatus,
} from '@/api/servers';
import { listTools } from '@/api/tools';
import ServerForm from '@/components/ServerForm';
import type { McpServer, McpServerCreateRequest, McpTool, McpServerStatus } from '@/types';

const STATUS_MAP: Record<McpServer['status'], { label: string; color: string }> = {
  online: { label: '在线', color: 'success' },
  offline: { label: '离线', color: 'default' },
  error: { label: '异常', color: 'error' },
};

const CONNECTION_STATUS_MAP: Record<McpServerStatus['connectionStatus'], { label: string; color: string }> = {
  online: { label: '在线', color: 'success' },
  offline: { label: '离线', color: 'default' },
  error: { label: '异常', color: 'error' },
};

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [status, setStatus] = useState<McpServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, t, st] = await Promise.all([
        getServer(id),
        listTools(),
        getServerStatus(id),
      ]);
      setServer(s);
      setTools(t.items);
      setStatus(st);
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

  const handleRestart = async () => {
    await restartServer(server.id);
    message.success('已重启');
    load();
  };

  const handleDelete = async () => {
    await deleteServer(server.id);
    message.success('已删除');
    navigate('/servers');
  };

  const toolColumns: ColumnsType<McpTool> = [
    { title: '名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    { title: '分类', dataIndex: 'category' },
    { title: '输出类型', dataIndex: 'outputType' },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>),
    },
  ];

  const assignedTools = tools.filter((t) => server.toolIds.includes(t.id));

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
        <Popconfirm title="确定重启该 Server？" onConfirm={handleRestart}>
          <Button icon={<ReloadOutlined />}>重启</Button>
        </Popconfirm>
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
                  <Descriptions.Item label="监听地址">{server.host || '-'}</Descriptions.Item>
                  <Descriptions.Item label="监听端口">{server.port ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="SSE 端点">{server.sseEndpoint || '-'}</Descriptions.Item>
                  <Descriptions.Item label="认证方式">{server.authType || 'none'}</Descriptions.Item>
                  <Descriptions.Item label="超时（ms）">{server.timeoutMs ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="最大并发">{server.maxConcurrentCalls ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="健康检查 URL">{server.healthCheckUrl || '-'}</Descriptions.Item>
                  <Descriptions.Item label="工具数量">{server.toolIds.length}</Descriptions.Item>
                  <Descriptions.Item label="启用" span={2}>
                    {server.enabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>
                    {server.description || '-'}
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
            label: '工具列表',
            children: (
              <Card>
                <Table
                  rowKey="id"
                  dataSource={assignedTools}
                  columns={toolColumns}
                  pagination={false}
                  locale={{ emptyText: '该 Server 未暴露任何工具' }} scroll={{ x: 'max-content' }} />
              </Card>
            ),
          },
          {
            key: 'status',
            label: '连接状态 / 日志',
            children: (
              <Card>
                {status ? (
                  <>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic
                          title="连接状态"
                          valueRender={() => (
                            <Tag color={CONNECTION_STATUS_MAP[status.connectionStatus].color}>
                              {CONNECTION_STATUS_MAP[status.connectionStatus].label}
                            </Tag>
                          )}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="最后心跳"
                          value={status.lastHeartbeatAt ? new Date(status.lastHeartbeatAt).toLocaleString() : '无'}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="响应耗时（ms）"
                          value={status.responseTimeMs ?? '-'}
                        />
                      </Col>
                    </Row>
                    <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
                      <Descriptions.Item label="内部状态">{status.status}</Descriptions.Item>
                      <Descriptions.Item label="健康检查 URL">
                        {status.healthCheckUrl || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="最后错误信息">
                        {status.lastErrorMessage || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                    <Button icon={<ReloadOutlined />} onClick={load} style={{ marginTop: 16 }}>
                      刷新状态
                    </Button>
                  </>
                ) : (
                  <Spin />
                )}
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
