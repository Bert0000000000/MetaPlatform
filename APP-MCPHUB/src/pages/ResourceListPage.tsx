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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { listResources, deleteResource } from '@/api/resources';
import type { McpResource } from '@/types';

const MIME_COLORS: Record<string, string> = {
  'text/plain': 'blue',
  'text/markdown': 'geekblue',
  'application/json': 'purple',
  'image/png': 'orange',
  'image/jpeg': 'gold',
};

export default function ResourceListPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

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
    message.success('已删除');
    load();
  };

  const columns: ColumnsType<McpResource> = [
    {
      title: '资源',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <FileTextOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <code>{r.uri}</code>
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'MIME',
      dataIndex: 'mimeType',
      render: (v) => <Tag color={MIME_COLORS[v] || 'default'}>{v}</Tag>,
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
          <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/resources/${r.id}`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          MCP Resources
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/resources/new')}>
          添加资源
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索名称/URI"
          allowClear
          onSearch={setKeyword}
          style={{ width: 240 }}
        />
      </Space>

      <Card>
        {resources.length === 0 && !loading ? (
          <Empty description="还没有 MCP 资源" />
        ) : (
          <Table rowKey="id" dataSource={resources} columns={columns} loading={loading} />
        )}
      </Card>
    </div>
  );
}
