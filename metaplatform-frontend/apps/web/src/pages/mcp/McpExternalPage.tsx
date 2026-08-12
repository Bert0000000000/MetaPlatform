import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Toast,
  Popconfirm,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
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
} from '@/api/mcphub/integrations';
import ApiKeyGenerator from './components/ApiKeyGenerator';
import IntegrationDocViewer from './components/IntegrationDocViewer';
import OnlineTester from './components/OnlineTester';
import type { Integration, IntegrationCreateRequest } from '@/api/mcphub/types';

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
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (editing) {
        const updated = await updateIntegration(editing.id, values);
        Toast.success('已更新');
        setSelected(updated);
      } else {
        const created = await createIntegration(values);
        Toast.success('已创建');
        setSelected(created);
      }
      setEditorOpen(false);
      setEditing(null);
      form.reset();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnProps<Integration>[] = [
    {
      title: '集成',
      key: 'name',
      render: (_, i) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <GlobalOutlined /> {i.name}
          </Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
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
            theme="borderless"
            onClick={() => {
              setSelected(i);
            }}
          >
            查看
          </Button>
          <Button
            theme="borderless"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(i);
              form.setValues(i);
              setEditorOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deleteIntegration(i.id);
              Toast.success('已删除');
              load();
            }}
          >
            <Button theme="borderless" type="danger" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          外部应用集成
        </Typography.Title>
        <Button
          theme="solid"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.reset();
            form.setValues({ platform: 'cursor', enabled: true, endpoint: '/api/v1/mcp/sse/main' });
            setEditorOpen(true);
          }}
        >
          新建集成
        </Button>
      </div>

      <Tabs>
        <Tabs.TabPane itemKey="list" tab="集成列表">
          <Card>
            {integrations.length === 0 && !loading ? (
              <Empty description="还没有外部集成" />
            ) : (
              <Table rowKey="id" dataSource={integrations} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
            )}
          </Card>
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="docs" tab="集成文档">
          {selected ? <IntegrationDocViewer integration={selected} /> : <Empty />}
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="test" tab="在线测试">
          {selected ? <OnlineTester integration={selected} /> : <Empty />}
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="keys" tab="API Key">
          <ApiKeyGenerator />
        </Tabs.TabPane>
      </Tabs>

      <Modal
        visible={editorOpen}
        title={editing ? '编辑集成' : '新建集成'}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={640}
      >
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Select field="platform" label="平台" rules={[{ required: true }]} optionList={PLATFORMS} />
          <Form.Input field="endpoint" label="端点" rules={[{ required: true }]} />
          <Form.TextArea
            field="configSnippet"
            label="配置片段 (JSON)"
            rules={[{ required: true }]}
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
          <Form.Switch field="enabled" label="启用" />
        </Form>
      </Modal>
    </div>
  );
}
