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
import type { McpResource } from '@/api/mcphub/types';

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
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
            <code>{r.uri}</code>
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'MIME',
      dataIndex: 'mimeType',
      render: (v) => <Tag color={MIME_COLORS[v] || 'grey'}>{v}</Tag>,
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
          <Button theme="borderless" icon={<EditOutlined />} onClick={() => navigate(`/resources/${r.id}`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r)}>
            <Button theme="borderless" type="danger" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          MCP Resources
        </Typography.Title>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/resources/new')}>
          添加资源
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索名称/URI"
          showClear
          value={searchText}
          onChange={(v) => setSearchText(v)}
          onEnterPress={() => setKeyword(searchText)}
          style={{ width: 240 }}
        />
      </Space>

      <Card>
        {resources.length === 0 && !loading ? (
          <Empty description="还没有 MCP 资源" />
        ) : (
          <Table rowKey="id" dataSource={resources} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
        )}
      </Card>
    </div>
  );
}
