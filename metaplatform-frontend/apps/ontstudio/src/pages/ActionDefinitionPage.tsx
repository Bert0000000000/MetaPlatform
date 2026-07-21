import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { createAction, deleteAction, listActions } from '@/api/actions';
import type { ActionDefinition } from '@/api/actions';

export default function ActionDefinitionPage() {
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listActions();
      setActions(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await createAction({
        code: v.code,
        name: v.name,
        description: v.description,
        category: v.category,
        inputSchema: [],
        outputSchema: [],
        steps: [],
        enabled: v.enabled,
      });
      message.success('已创建');
      setEditorOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ActionDefinition> = [
    {
      title: 'Action',
      key: 'name',
      render: (_, a) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <ThunderboltOutlined /> {a.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {a.code}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '分类', dataIndex: 'category', render: (v) => <Tag>{v}</Tag> },
    { title: '版本', dataIndex: 'version', render: (v) => <Tag color="purple">v{v}</Tag> },
    {
      title: '步骤',
      dataIndex: 'steps',
      render: (v) => <Tag color="blue">{v.length} 步</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, a) => (
        <Popconfirm title="确定删除？" onConfirm={async () => {
          await deleteAction(a.actionId);
          message.success('已删除');
          load();
        }}>
          <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Action 定义
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          form.resetFields();
          form.setFieldsValue({ enabled: true });
          setEditorOpen(true);
        }}>
          新建 Action
        </Button>
      </div>

      <Card>
        {actions.length === 0 && !loading ? (
          <Empty description="还没有 Action" />
        ) : (
          <Table rowKey="actionId" dataSource={actions} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Modal
        open={editorOpen}
        title="新建 Action"
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
