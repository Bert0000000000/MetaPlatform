import { useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  Toast,
  Popconfirm,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  PlusOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  ClusterOutlined,
  ReloadOutlined,
  SearchOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { listServers, deleteServer, startServer, stopServer, createServer } from '@/api/mcphub/servers';
import { listTools } from '@/api/mcphub/tools';
import ServerDrawer from './components/ServerDrawer';
import type { McpServer, McpTool } from '@/api/mcphub/types';
import { EmptyState, PageHeader } from '@/components/skeleton';

const SERVERS_PATH = '/ki/mcp/servers';

const STATUS_MAP: Record<McpServer['status'], { label: string; color: TagColor }> = {
  online: { label: '在线', color: 'green' },
  offline: { label: '离线', color: 'grey' },
  error: { label: '异常', color: 'red' },
};

export default function ServerListPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');

  // 表单抽屉由路由驱动，与工具/客户端/资源三个列表页同一套写法。
  const createMatch = useMatch(`${SERVERS_PATH}/new`);
  const editMatch = useMatch(`${SERVERS_PATH}/:id/edit`);
  const editingId = createMatch ? null : (editMatch?.params.id ?? null);
  const drawerOpen = !!createMatch || editingId !== null;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listServers({ keyword });
      setServers(res.items);
      const t = await listTools();
      setTools(t.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载 Server 列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword]);

  const handleDelete = async (s: McpServer) => {
    try {
      await deleteServer(s.id);
      Toast.success('Server 已删除');
      load();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleStart = async (s: McpServer) => {
    try {
      await startServer(s.id);
      Toast.success('已启动');
      load();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '启动失败');
    }
  };

  const handleStop = async (s: McpServer) => {
    try {
      await stopServer(s.id);
      Toast.success('已停止');
      load();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '停止失败');
    }
  };

  const stats = {
    total: servers.length,
    online: servers.filter((s) => s.status === 'online').length,
    offline: servers.filter((s) => s.status === 'offline').length,
    error: servers.filter((s) => s.status === 'error').length,
  };

  const columns: ColumnProps<McpServer>[] = [
    {
      title: '名称',
      key: 'name',
      render: (_, s) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <ClusterOutlined /> {s.name}
          </Typography.Text>
          <Typography.Text type="tertiary" className="mp-text-sm">
            {s.code}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '传输', dataIndex: 'transport', render: (v) => <Tag size="small">{v}</Tag> },
    { title: '端点', dataIndex: 'endpoint', ellipsis: true },
    {
      title: '工具数',
      dataIndex: 'toolCount',
      render: (v) => <Tag size="small" color="blue">{v ?? 0}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, s) => (
        <Space vertical spacing={0}>
          <Tag size="small" color={STATUS_MAP[s.status].color}>{STATUS_MAP[s.status].label}</Tag>
          {s.lastHeartbeatAt && (
            <Typography.Text type="tertiary" className="mp-text-sm">
              心跳 {new Date(s.lastHeartbeatAt).toLocaleString()}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, s) => (
        <Space>
          <Button size="small" theme="borderless" icon={<EyeOutlined />} onClick={() => navigate(`/ki/mcp/servers/${s.id}`)}>
            详情
          </Button>
          {s.status === 'offline' ? (
            <Button size="small" theme="borderless" icon={<PlayCircleOutlined />} onClick={() => handleStart(s)}>
              启动
            </Button>
          ) : (
            <Button size="small" theme="borderless" icon={<PauseCircleOutlined />} onClick={() => handleStop(s)}>
              停止
            </Button>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(s)}>
            <Button size="small" theme="borderless" type="danger" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="MCP Server 管理"
        actions={
          <Button
            theme="solid"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(`${SERVERS_PATH}/new`)}
          >
                  创建 Server
                </Button>
        }
      />

      <Row gutter={16} className="mp-mb-4">
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">总数</div>
            <div className="mp-stat-value mp-text-xl" >{stats.total}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">在线</div>
            <div className="mp-stat-value mp-text-success mp-text-xl" >{stats.online}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">离线</div>
            <div className="mp-stat-value mp-text-2 mp-text-xl" >{stats.offline}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">异常</div>
            <div className="mp-stat-value mp-text-danger mp-text-xl" >{stats.error}</div>
          </Card>
        </Col>
      </Row>

      <Space className="mp-mb-4" wrap>
        <Input
          placeholder="搜索名称/编码"
          showClear
          value={query}
          onChange={(v) => setQuery(v)}
          onEnterPress={() => setKeyword(query)}
          suffix={<SearchOutlined className="mp-text-2 mp-clickable"  onClick={() => setKeyword(query)} />}
          className="mp-w-240"
        />
      </Space>

      <Card>
        {loading ? (
          <Table
            rowKey="id"
            dataSource={[]}
            columns={columns}
            loading
            pagination={false} />
        ) : error ? (
          <div className="mp-text-center mp-p-9">
            <ExclamationCircleFilled className="mp-text-danger mp-text-xl"  />
            <Typography.Title heading={4} className="mp-mt-4">
              加载失败
            </Typography.Title>
            <Typography.Text type="tertiary">{error.message}</Typography.Text>
            <div className="mp-mt-6">
              <Button theme="solid" type="primary" icon={<ReloadOutlined />} onClick={load}>
                重试
              </Button>
            </div>
          </div>
        ) : servers.length === 0 ? (
          <EmptyState title="还没有 MCP Server，点击右上角创建" />
        ) : (
          <Table
            rowKey="id"
            dataSource={servers}
            columns={columns}
            pagination={{ pageSize: 10 }} />
        )}
      </Card>

      <ServerDrawer
        open={drawerOpen}
        serverId={editingId}
        availableTools={tools.map((t) => ({ id: t.id, name: t.name }))}
        onClose={() => navigate(SERVERS_PATH)}
        onSaved={load}
      />
    </div>
  );
}
