import { useEffect, useState } from 'react';
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
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { listResources, deleteResource } from '@/api/mcphub/resources';
import ResourceDrawer from './components/ResourceDrawer';
import type { McpResource } from '@/api/mcphub/types';
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
  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(false);
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

  const load = async () => {
    setLoading(true);
    try {
      const res = await listResources({ keyword });
      setResources(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword]);

  const handleDelete = async (r: McpResource) => {
    await deleteResource(r.id);
    Toast.success('已删除');
    load();
  };

  const columns: ColumnProps<McpResource>[] = [
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
      render: (v) => <Tag size="small" color={MIME_COLORS[v] || 'grey'}>{v}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '更新时间',
      key: 'updated',
      render: (_, r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" theme="borderless" icon={<EditOutlined />} onClick={() => navigate(`/ki/mcp/resources/${r.id}`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r)}>
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
        title="MCP Resources"
        actions={
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ki/mcp/resources/new')}>
                  添加资源
                </Button>
        }
      />

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
        {resources.length === 0 && !loading ? (
          <EmptyState title="还没有 MCP 资源" />
        ) : (
          <Table rowKey="id" dataSource={resources} columns={columns} loading={loading} />
        )}
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
