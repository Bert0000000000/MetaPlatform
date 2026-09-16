import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  SideSheet,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
  Popconfirm,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlusOutlined, CopyOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { IconAlertTriangle } from '@douyinfe/semi-icons';
import { createApiKey, deleteApiKey, listApiKeys } from '@/api/mcphub/integrations';
import type { ApiKey } from '@/api/mcphub/types';
import '../mcp.css';

const FORM_DRAWER_W = 420;

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
    const values = await form.validate();
    setLoading(true);
    try {
      const k = await createApiKey(values.name, values.scopes);
      setRevealed({ key: k.key, prefix: k.prefix });
      form.reset();
      setModalOpen(false);
      load();
      Toast.success('API Key 已创建');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnProps<ApiKey>[] = [
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
      render: (v: string[]) => v.map((s) => <Tag size="small" key={s}>{s}</Tag>),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag size="small" color="green">是</Tag> : <Tag size="small">否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, k) => (
        <Popconfirm title="确定删除？" onConfirm={async () => {
          await deleteApiKey(k.id);
          Toast.success('已删除');
          load();
        }}>
          <Button size="small" theme="borderless" type="danger" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title="API Key 管理"
      headerExtraContent={
        <Button
          theme="solid"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          生成 API Key
        </Button>
      }
    >
      {revealed && (
        <Card
          className="mp-mb-4 mp-mcp-warn-card"
        >
          <Typography.Paragraph className="mp-mb-2 mp-flex-center mp-gap-1" >
            <IconAlertTriangle size="small" /> 请立即复制保存，新生成的 Key 只会完整显示一次：
          </Typography.Paragraph>
          <Space>
            <Typography.Text code copyable={{ content: revealed.key }}>
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
      />

      <SideSheet
        visible={modalOpen}
        title="生成 API Key"
        width={FORM_DRAWER_W}
        onCancel={() => setModalOpen(false)}
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={loading} onClick={() => void handleCreate()}>
              生成
            </Button>
          </>
        }
      >
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} placeholder="例如：cursor-ide" />
          <Form.Select
            field="scopes"
            label="权限范围"
            rules={[{ required: true }]}
            multiple
            optionList={SCOPE_OPTIONS}
            placeholder="选择权限"
          />
        </Form>
      </SideSheet>
    </Card>
  );
}
