import PageHeader from '@/components/skeleton/PageHeader';
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
  startServer,
  stopServer,
  restartServer,
  deleteServer,
  getServerStatus,
  SERVER_MANAGEMENT_AVAILABLE,
} from '@/api/mcphub/servers';
import { listTools } from '@/api/mcphub/tools';
import type { McpServer, McpTool, McpServerStatus } from '@/api/mcphub/types';

const STATUS_MAP: Record<McpServer['status'], { label: string; color: TagColor }> = {
  online: { label: '在线', color: 'green' },
  offline: { label: '离线', color: 'grey' },
  error: { label: '异常', color: 'red' },
};

const CONNECTION_STATUS_MAP: Record<
  NonNullable<McpServerStatus['connectionStatus']>,
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
      <div className="mp-text-md mp-text-2">{title}</div>
      <div className="mp-fw-600 mp-text-1 mp-text-xl" >{value}</div>
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
    return <Banner type="danger" description={error} className="mp-m-6" />;
  }

  if (loading || !server) {
    return (
      <div className="mp-text-center mp-p-8">
        <Spin />
      </div>
    );
  }

  const handleStart = async () => {
    if (!SERVER_MANAGEMENT_AVAILABLE) return;
    await startServer(server.id);
    Toast.success('已启动');
    load();
  };

  const handleStop = async () => {
    if (!SERVER_MANAGEMENT_AVAILABLE) return;
    await stopServer(server.id);
    Toast.success('已停止');
    load();
  };

  const handleRestart = async () => {
    if (!SERVER_MANAGEMENT_AVAILABLE) return;
    await restartServer(server.id);
    Toast.success('已重启');
    load();
  };

  const handleDelete = async () => {
    if (!SERVER_MANAGEMENT_AVAILABLE) return;
    await deleteServer(server.id);
    Toast.success('已删除');
    navigate('/ki/mcp/servers');
  };

  const toolColumns: ColumnProps<McpTool>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    { title: '分类', dataIndex: 'category' },
    { title: '输出类型', dataIndex: 'outputType' },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag size="small" color="green">启用</Tag> : <Tag size="small">禁用</Tag>),
    },
  ];

  const toolIds = Array.isArray(server.toolIds) ? server.toolIds : null;
  const assignedTools = toolIds ? tools.filter((t) => toolIds.includes(t.id)) : null;
  const serverStatus = STATUS_MAP[server.status] ?? { label: '未提供', color: 'grey' as TagColor };
  const connectionStatus = status?.connectionStatus
    ? CONNECTION_STATUS_MAP[status.connectionStatus]
    : undefined;

  return (
    <div>
      <Space wrap className="mp-mb-4">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ki/mcp/servers')}>
          返回
        </Button>
        <PageHeader title={server.name} />
        <Tag color={serverStatus.color}>{serverStatus.label}</Tag>
      </Space>
      {!SERVER_MANAGEMENT_AVAILABLE && (
        <Banner type="info" title="服务目录管理未接入"
          description="当前服务目录仅提供读取，编辑保存、启停、重启和删除尚未接入。" className="mp-mb-4" />
      )}

      <Space wrap className="mp-mb-4">
        <Button icon={<EditOutlined />} onClick={() => navigate(`/ki/mcp/servers/${server.id}/edit`)}>
          编辑
        </Button>
        {server.status === 'offline' ? (
          <Button theme="solid" type="primary" icon={<PlayCircleOutlined />} disabled={!SERVER_MANAGEMENT_AVAILABLE} onClick={handleStart}>
            启动
          </Button>
        ) : (
          <Button icon={<PauseCircleOutlined />} disabled={!SERVER_MANAGEMENT_AVAILABLE} onClick={handleStop}>
            停止
          </Button>
        )}
        {SERVER_MANAGEMENT_AVAILABLE ? (
          <>
            <Popconfirm title="确定重启该 Server？" onConfirm={handleRestart}>
              <Button icon={<ReloadOutlined />}>重启</Button>
            </Popconfirm>
            <Popconfirm title="确定删除？" onConfirm={handleDelete}>
              <Button type="danger" icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </>
        ) : (
          <>
            <Button icon={<ReloadOutlined />} disabled>重启</Button>
            <Button type="danger" icon={<DeleteOutlined />} disabled>删除</Button>
          </>
        )}
      </Space>

      <Tabs>
        <TabPane tab="基本信息" itemKey="info">
          <Card>
            <Descriptions
              column={2}
              size="small"
              data={[
                { key: '名称', value: server.name },
                { key: '编码', value: server.code ?? '未提供' },
                { key: server.transport ? '传输' : '目录协议', value: server.transport ?? server.transportType ?? '未提供' },
                { key: '端点', value: <code>{server.endpoint}</code> },
                { key: '监听地址', value: server.host || '-' },
                { key: '监听端口', value: server.port ?? '-' },
                { key: 'SSE 端点', value: server.sseEndpoint || '-' },
                { key: '认证方式', value: server.authType ?? '未提供' },
                { key: '超时（ms）', value: server.timeoutMs ?? '-' },
                { key: '最大并发', value: server.maxConcurrentCalls ?? '-' },
                { key: '健康检查 URL', value: server.healthCheckUrl || '-' },
                { key: '工具数量', value: toolIds?.length ?? server.toolCount ?? '未提供' },
                {
                  key: '启用',
                  value: typeof server.enabled === 'boolean'
                    ? server.enabled ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>
                    : '未提供',
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
            {assignedTools ? (
              <Table
                rowKey="id"
                dataSource={assignedTools}
                columns={toolColumns}
                pagination={false}
                empty={toolIds?.length === 0 ? '该 Server 未暴露任何工具' : '已关联工具未在工具目录中返回'}
              />
            ) : (
              <Banner type="info" title="工具关联未提供" description="服务目录没有返回工具关联，暂无法展示该 Server 的工具列表。" />
            )}
          </Card>
        </TabPane>
        <TabPane tab="连接状态 / 日志" itemKey="status">
          <Card>
            {status ? (
              <>
                {status.status === 'unknown' && (
                  <Banner type="info" title="实时连接状态未知" description="服务目录尚未提供实时连接状态与心跳数据。" className="mp-mb-4" />
                )}
                <Row gutter={16}>
                  <Col span={8}>
                    <StatCard
                      title="连接状态"
                      value={
                        connectionStatus
                          ? <Tag color={connectionStatus.color}>{connectionStatus.label}</Tag>
                          : '未提供'
                      }
                    />
                  </Col>
                  <Col span={8}>
                    <StatCard
                      title="最后心跳"
                      value={
                        status.lastHeartbeatAt
                          ? new Date(status.lastHeartbeatAt).toLocaleString()
                          : '未提供'
                      }
                    />
                  </Col>
                  <Col span={8}>
                    <StatCard title="响应耗时（ms）" value={status.responseTimeMs ?? '未提供'} />
                  </Col>
                </Row>
                <Descriptions
                  column={1}
                  size="small"
                  className="mp-mt-4"
                  data={[
                    { key: '内部状态', value: status.status },
                    { key: '健康检查 URL', value: status.healthCheckUrl || '-' },
                    { key: '最后错误信息', value: status.lastErrorMessage || '-' },
                  ]}
                />
                <Button icon={<ReloadOutlined />} onClick={load} className="mp-mt-4">
                  刷新状态
                </Button>
              </>
            ) : (
              <Spin />
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
