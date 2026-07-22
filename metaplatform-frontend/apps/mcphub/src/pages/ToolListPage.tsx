import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
  Switch,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CodeOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { listTools, listCategories, deleteTool, updateTool } from '@/api/tools';
import ToolForm from '@/components/ToolForm';
import ToolCategoryTree from '@/components/ToolCategoryTree';
import CategoryManagementModal from '@/components/CategoryManagementModal';
import type { McpTool, McpToolCategory } from '@/types';

export default function ToolListPage() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<McpTool[]>([]);
  const [categories, setCategories] = useState<McpToolCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<McpTool | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listTools({ keyword, category });
      setTools(res.items);
      const cs = await listCategories();
      setCategories(cs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, category]);

  const handleDelete = async (tool: McpTool) => {
    await deleteTool(tool.id);
    message.success('工具已删除');
    load();
  };

  const handleToggle = async (tool: McpTool, enabled: boolean) => {
    await updateTool(tool.id, {
      name: tool.name,
      code: tool.code,
      category: tool.category,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputType: tool.outputType,
      enabled,
      tags: tool.tags,
    });
    message.success(enabled ? '已启用' : '已停用');
    load();
  };

  const columns: ColumnsType<McpTool> = [
    {
      title: '工具',
      key: 'name',
      render: (_, t) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{t.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <CodeOutlined /> {t.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '参数',
      key: 'params',
      render: (_, t) => `${t.inputSchema.length} 个`,
    },
    {
      title: '输出类型',
      dataIndex: 'outputType',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      render: (v) => <Tag color="purple">v{v}</Tag>,
    },
    {
      title: '启用',
      key: 'enabled',
      render: (_, t) => (
        <Switch checked={t.enabled} onChange={(v) => handleToggle(t, v)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, t) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/tools/${t.id}`)}
          >
            详情
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(t)}>
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
          工具注册中心
        </Typography.Title>
        <Space>
          <Button icon={<FolderOutlined />} onClick={() => setCategoryModalOpen(true)}>
            分类管理
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/tools/new')}
          >
            创建工具
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索工具名称/编码"
          allowClear
          onSearch={setKeyword}
          style={{ width: 240 }}
        />
        <Select
          placeholder="分类"
          allowClear
          style={{ width: 160 }}
          value={category}
          onChange={setCategory}
          options={categories.map((c) => ({ label: c.name, value: c.code }))}
        />
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        <Card title="按分类浏览" bodyStyle={{ padding: 8 }}>
          {tools.length === 0 ? (
            <Empty description="暂无工具" />
          ) : (
            <ToolCategoryTree tools={tools} onSelect={(id) => navigate(`/tools/${id}`)} />
          )}
        </Card>
        <Card>
          {tools.length === 0 && !loading ? (
            <Empty description="还没有工具，点击右上角创建" />
          ) : (
            <Table
              rowKey="id"
              dataSource={tools}
              columns={columns}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle" scroll={{ x: 'max-content' }} />
          )}
        </Card>
      </div>

      <ToolForm
        open={formOpen}
        initial={editing}
        categories={categories.map((c) => c.name)}
        onOk={async (values) => {
          if (editing) {
            setSubmitting(true);
            try {
              await updateTool(editing.id, values);
              message.success('已更新');
            } finally {
              setSubmitting(false);
            }
          }
          setFormOpen(false);
          setEditing(null);
          load();
        }}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
      />

      <CategoryManagementModal
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
      />
    </div>
  );
}
