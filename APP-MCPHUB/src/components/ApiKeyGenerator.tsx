import { useState } from 'react';
import { Button, Card, Form, Input, Modal, Space, Select, Table, Tag, Typography, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, CopyOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { createApiKey, deleteApiKey, listApiKeys } from '@/api/integrations';
import type { ApiKey } from '@/types';

const SCOPE_OPTIONS = [
  { label: 'tools:invoke', value: 'tools:invoke' },
  { label: 'tools:read', value: 'tools:read' },
  { label: 'resources:read', value: 'resources:read' },
  { label: 'prompts:read', value: 'prompts:read' },
  { label: 'admin', value: 'admin' },
];

export default function ApiKeyGenerator() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [revealed, setRevealed] = useState<{ key: string; prefix: string } | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setKeys(await listApiKeys());
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const k = await createApiKey(values.name, values.scopes);
      setRevealed({ key: k.key, prefix: k.prefix });
      form.resetFields();
      setModalOpen(false);
      load();
      message.success('API Key 已创建');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<ApiKey> = [
    {
      title: 'Key',
      key: 'key',
      render: (_, k) => (
        <Space>
          <KeyOutlined />
          <Typography.Text strong>{k.prefix}...</Typography.Text>
        </Space>
      ),
    },
    { title: '名称', dataIndex: 'name' },
    {
      title: '权限范围',
      dataIndex: 'scopes',
      render: (v: string[]) => v.map((s) => <Tag key={s}>{s}</Tag>),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, k) => (
        <Popconfirm title="确定删除？" onConfirm={async () => {
          await deleteApiKey(k.id);
          message.success('已删除');
          load();
        }}>
          <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title="API Key 管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          生成 API Key
        </Button>
      }
    >
      {revealed && (
        <Card type="inner" style={{ marginBottom: 16, background: '#fffbe6' }}>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            ⚠️ 请立即复制保存，新生成的 Key 只会完整显示一次：
          </Typography.Paragraph>
          <Space>
            <Typography.Text code copyable={{ text: revealed.key }}>
              {revealed.key}
            </Typography.Text>
            <Button
              icon={<CopyOutlined />}
              onClick={() => navigator.clipboard?.writeText(revealed.key)}
            >
              复制
            </Button>
            <Button onClick={() => setRevealed(null)}>知道了</Button>
          </Space>
        </Card>
      )}

      <Table
        rowKey="id"
        dataSource={keys}
        columns={columns}
        loading={loading}
        pagination={false}
        size="small" scroll={{ x: 'max-content' }} />

      <Modal
        open={modalOpen}
        title="生成 API Key"
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="例如：cursor-ide" />
          </Form.Item>
          <Form.Item name="scopes" label="权限范围" rules={[{ required: true }]}>
            <Select mode="multiple" options={SCOPE_OPTIONS} placeholder="选择权限" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
