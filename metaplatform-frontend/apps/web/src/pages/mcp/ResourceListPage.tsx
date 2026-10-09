import { useCallback, useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
  Popconfirm,
  Spin,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { listResources, deleteResource, RESOURCE_MANAGEMENT_AVAILABLE, type RegisteredMcpResource } from '@/api/mcphub/resources';
import ResourceDrawer from './components/ResourceDrawer';
import { EmptyState, PageHeader } from '@/components/skeleton';

const RESOURCES_PATH = '/ki/mcp/resources';

const MIME_COLORS: Record<string, TagColor> = {
  'text/plain': 'blue',
  'text/markdown': 'indigo',
  'application/json': 'purple',
  'image/png': 'orange',
  'image/jpeg': 'yellow',
};

export default function ResourceListPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<RegisteredMcpResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasRead, setHasRead] = useState(false);
  const [keyword, setKeyword] = useState('');
  // Semi 无 Input.Search，用受控 Input + Enter 触发搜索（交互与原 onSearch 一致）
  const [searchText, setSearchText] = useState('');

  // 表单抽屉由路由驱动：/resources/new 与 /resources/:id 都渲染本列表页，只有抽屉是开的。
  // 这样深链可分享、浏览器后退能直接关掉抽屉，页面上的按钮也不必改成 setState 调用。
  // 注意 :id 也能匹配字面量 new，故静态匹配优先（createMatch 命中时不取 editMatch）。
  const createMatch = useMatch(`${RESOURCES_PATH}/new`);
  const editMatch = useMatch(`${RESOURCES_PATH}/:id`);
  const editingId = createMatch ? null : (editMatch?.params.id ?? null);
  const drawerOpen = !!createMatch || editingId !== null;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await listResources({ keyword });
      setResources(res.items);
      setHasRead(true);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (r: RegisteredMcpResource) => {
    if (!RESOURCE_MANAGEMENT_AVAILABLE || !r.id) return;
    await deleteResource(r.id);
    Toast.success('已删除');
    void load();
  };

  const columns: ColumnProps<RegisteredMcpResource>[] = [
    {
      title: '资源',
      key: 'name',
      render: (_, r) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <FileTextOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="tertiary" className="mp-text-sm">
            <code>{r.uri}</code>
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'MIME',
      dataIndex: 'mimeType',
      render: (v) => v ? <Tag size="small" color={MIME_COLORS[v] || 'grey'}>{v}</Tag> : '未提供',
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (v) => v || '未提供',
    },
    {
      title: '更新时间',
      key: 'updated',
      render: (_, r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '未提供'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" theme="borderless" icon={<EditOutlined />}
            disabled={!RESOURCE_MANAGEMENT_AVAILABLE || !r.id}
            onClick={() => {
              if (!RESOURCE_MANAGEMENT_AVAILABLE || !r.id) return;
              navigate(`${RESOURCES_PATH}/${encodeURIComponent(r.id)}`);
            }}>
            编辑
          </Button>
          {RESOURCE_MANAGEMENT_AVAILABLE && r.id ? <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r)}>
            <Button size="small" theme="borderless" type="danger" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm> : <Button size="small" theme="borderless" type="danger" icon={<DeleteOutlined />} disabled>删除</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="MCP Resources"
        actions={
          <Button theme="solid" type="primary" icon={<PlusOutlined />} disabled={!RESOURCE_MANAGEMENT_AVAILABLE}
            onClick={() => { if (RESOURCE_MANAGEMENT_AVAILABLE) navigate(`${RESOURCES_PATH}/new`); }}>
                  添加资源
                </Button>
        }
      />

      {!RESOURCE_MANAGEMENT_AVAILABLE ? <div className="mp-read-warning" role="status">
        <strong>资源管理未接入</strong><span>当前展示已注册资源的信息；创建、详情、编辑和删除尚不可用。</span>
      </div> : null}
      {loadError ? <div className="mp-read-warning" role="alert">
        <strong>资源列表加载失败</strong><span>{loadError}</span>
        {hasRead ? <span>显示上次成功读取的结果。</span> : null}
        <Button onClick={() => void load()} loading={loading}>重试资源列表</Button>
      </div> : null}

      <Space className="mp-mb-4">
        <Input
          placeholder="搜索名称/URI"
          showClear
          value={searchText}
          onChange={(v) => setSearchText(v)}
          onEnterPress={() => setKeyword(searchText)}
          className="mp-w-240"
        />
      </Space>

      <Card>
        {!hasRead ? (loadError
          ? <EmptyState illustration="failure" title="资源注册信息未读取" desc="请重试资源列表。" />
          : <div className="mp-flex mp-items-center mp-gap-3 mp-p-6" role="status"><Spin /><span>正在读取注册资源</span></div>
        ) : resources.length === 0 ? (
          <EmptyState title={loadError ? '注册信息刷新失败' : '还没有 MCP 资源'} illustration={loadError ? 'failure' : 'no-content'} />
        ) : <Table
          rowKey={(resource) => resource ? JSON.stringify([resource.name, resource.uri]) : ''}
          dataSource={resources} columns={columns} loading={loading}
        />}
      </Card>

      <ResourceDrawer
        open={drawerOpen}
        resourceId={editingId}
        onClose={() => navigate(RESOURCES_PATH)}
        onSaved={load}
      />
    </div>
  );
}
