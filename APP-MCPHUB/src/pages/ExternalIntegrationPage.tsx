import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
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
  GlobalOutlined,
} from '@ant-design/icons';
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  updateIntegration,
} from '@/api/integrations';
import ApiKeyGenerator from '@/components/ApiKeyGenerator';
import IntegrationDocViewer from '@/components/IntegrationDocViewer';
import OnlineTester from '@/components/OnlineTester';
import type { Integration, IntegrationCreateRequest } from '@/types';

const PLATFORMS: { label: string; value: Integration['platform'] }[] = [
  { label: 'Cursor', value: 'cursor' },
  { label: 'GitHub Copilot', value: 'copilot' },
  { label: 'Claude Desktop', value: 'claude-desktop' },
  { label: 'Cline', value: 'cline' },
  { label: 'Windsurf', value: 'windsurf' },
  { label: 'Custom', value: 'custom' },
];

export default function ExternalIntegrationPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<IntegrationCreateRequest>();

  const load = async () => {
    setLoading(true);
    try {
      const list = await listIntegrations();
      setIntegrations(list);
      if (!selected && list.length > 0) setSelected(list[0]!);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        const updated = await updateIntegration(editing.id, values);
        message.success('已更新');
        setSelected(updated);
      } else {
        const created = await createIntegration(values);
        message.success('已创建');
        setSelected(created);
      }
      setEditorOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Integration> = [
    {
      title: '集成',
      key: 'name',
      render: (_, i) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <GlobalOutlined /> {i.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {i.platform}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '端点', dataIndex: 'endpoint', ellipsis: true },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, i) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              setSelected(i);
            }}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(i);
              form.setFieldsValue(i);
              setEditorOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deleteIntegration(i.id);
              message.success('已删除');
              load();
            }}
          >
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
          外部应用集成
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ platform: 'cursor', enabled: true, endpoint: '/api/v1/mcp/sse/main' });
            setEditorOpen(true);
          }}
        >
          新建集成
        </Button>
      </div>

      <Tabs
        items={[
          {
            key: 'list',
            label: '集成列表',
            children: (
              <Card>
                {integrations.length === 0 && !loading ? (
                  <Empty description="还没有外部集成" />
                ) : (
                  <Table rowKey="id" dataSource={integrations} columns={columns} loading={loading} />
                )}
              </Card>
            ),
          },
          {
            key: 'docs',
            label: '集成文档',
            children: selected ? <IntegrationDocViewer integration={selected} /> : <Empty />,
          },
          {
            key: 'test',
            label: '在线测试',
            children: selected ? <OnlineTester integration={selected} /> : <Empty />,
          },
          {
            key: 'keys',
            label: 'API Key',
            children: <ApiKeyGenerator />,
          },
        ]}
      />

      <Modal
        open={editorOpen}
        title={editing ? '编辑集成' : '新建集成'}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="platform" label="平台" rules={[{ required: true }]}>
            <Select options={PLATFORMS} />
          </Form.Item>
          <Form.Item name="endpoint" label="端点" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="configSnippet"
            label="配置片段 (JSON)"
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={6}
              placeholder={`{
  "mcpServers": {
    "mate-platform": {
      "url": "https://your-host/api/v1/mcp/sse/main",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
