import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Space,
  Spin,
  TabPane,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
  Popconfirm,
  Banner,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
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
} from '@/api/mcphub/servers';
import { listTools } from '@/api/mcphub/tools';
import ServerForm from './components/ServerForm';
import type { McpServer, McpServerCreateRequest, McpTool, McpServerStatus } from '@/api/mcphub/types';

const STATUS_MAP: Record<McpServer['status'], { label: string; color: TagColor }> = {
  online: { label: '在线', color: 'green' },
  offline: { label: '离线', color: 'grey' },
  error: { label: '异常', color: 'red' },
};

const CONNECTION_STATUS_MAP: Record<
  McpServerStatus['connectionStatus'],
  { label: string; color: TagColor }
> = {
  online: { label: '在线', color: 'green' },
  offline: { label: '离线', color: 'grey' },
  error: { label: '异常', color: 'red' },
};

// Semi 无 Statistic 组件，自建 label + 大数字（与 AuditStatisticsPage 的 StatCard 同款）
function StatCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--foreground)' }}>{value}</div>
    </div>
  );
}

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [status, setStatus] = useState<McpServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, t, st] = await Promise.all([
        getServer(id),
        listTools(),
        getServerStatus(id),
      ]);
      setServer(s);
      setTools(t.items);
      setStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (error) {
    return <Banner type="danger" description={error} style={{ margin: 24 }} />;
  }

  if (loading || !server) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const handleStart = async () => {
    await startServer(server.id);
    Toast.success('已启动');
    load();
  };

  const handleStop = async () => {
    await stopServer(server.id);
    Toast.success('已停止');
    load();
  };

  const handleRestart = async () => {
    await restartServer(server.id);
    Toast.success('已重启');
    load();
  };

  const handleDelete = async () => {
    await deleteServer(server.id);
    Toast.success('已删除');
    navigate('/servers');
  };

  const toolColumns: ColumnProps<McpTool>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    { title: '分类', dataIndex: 'category' },
    { title: '输出类型', dataIndex: 'outputType' },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>),
    },
  ];

  const assignedTools = tools.filter((t) => server.toolIds.includes(t.id));

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/servers')}>
          返回
        </Button>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {server.name}
        </Typography.Title>
        <Tag color={STATUS_MAP[server.status].color}>{STATUS_MAP[server.status].label}</Tag>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
          编辑
        </Button>
        {server.status === 'offline' ? (
          <Button theme="solid" type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
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
          <Button type="danger" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>

      <Tabs>
        <TabPane tab="基本信息" itemKey="info">
          <Card>
            <Descriptions
              column={2}
              size="small"
              data={[
                { key: '名称', value: server.name },
                { key: '编码', value: server.code },
                { key: '传输', value: server.transport },
                { key: '端点', value: <code>{server.endpoint}</code> },
                { key: '监听地址', value: server.host || '-' },
                { key: '监听端口', value: server.port ?? '-' },
                { key: 'SSE 端点', value: server.sseEndpoint || '-' },
                { key: '认证方式', value: server.authType || 'none' },
                { key: '超时（ms）', value: server.timeoutMs ?? '-' },
                { key: '最大并发', value: server.maxConcurrentCalls ?? '-' },
                { key: '健康检查 URL', value: server.healthCheckUrl || '-' },
                { key: '工具数量', value: server.toolIds.length },
                {
                  key: '启用',
                  value: server.enabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>,
                  span: 2,
                },
                { key: '描述', value: server.description || '-', span: 2 },
                { key: '创建时间', value: server.createdAt || '-', span: 2 },
              ]}
            />
          </Card>
        </TabPane>
        <TabPane tab="工具列表" itemKey="tools">
          <Card>
            <Table
              rowKey="id"
              dataSource={assignedTools}
              columns={toolColumns}
              pagination={false}
              empty="该 Server 未暴露任何工具"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>
        <TabPane tab="连接状态 / 日志" itemKey="status">
          <Card>
            {status ? (
              <>
                <Row gutter={16}>
                  <Col span={8}>
                    <StatCard
                      title="连接状态"
                      value={
                        <Tag color={CONNECTION_STATUS_MAP[status.connectionStatus].color}>
                          {CONNECTION_STATUS_MAP[status.connectionStatus].label}
                        </Tag>
                      }
                    />
                  </Col>
                  <Col span={8}>
                    <StatCard
                      title="最后心跳"
                      value={
                        status.lastHeartbeatAt
                          ? new Date(status.lastHeartbeatAt).toLocaleString()
                          : '无'
                      }
                    />
                  </Col>
                  <Col span={8}>
                    <StatCard title="响应耗时（ms）" value={status.responseTimeMs ?? '-'} />
                  </Col>
                </Row>
                <Descriptions
                  column={1}
                  size="small"
                  style={{ marginTop: 16 }}
                  data={[
                    { key: '内部状态', value: status.status },
                    { key: '健康检查 URL', value: status.healthCheckUrl || '-' },
                    { key: '最后错误信息', value: status.lastErrorMessage || '-' },
                  ]}
                />
                <Button icon={<ReloadOutlined />} onClick={load} style={{ marginTop: 16 }}>
                  刷新状态
                </Button>
              </>
            ) : (
              <Spin />
            )}
          </Card>
        </TabPane>
      </Tabs>

      <ServerForm
        open={editOpen}
        initial={server}
        availableTools={tools.map((t) => ({ id: t.id, name: t.name }))}
        onOk={async (values: McpServerCreateRequest) => {
          setSubmitting(true);
          try {
            await updateServer(server.id, values);
            Toast.success('已更新');
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
