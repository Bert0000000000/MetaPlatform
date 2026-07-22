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
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
  DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { listTrusts, createTrust, updateTrust, deleteTrust } from '@/api/trusts';
import { listExternalAgents } from '@/api/external-agents';
import type { AgentTrust, AgentTrustCreateRequest, ExternalAgent, PageResponse } from '@/types';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const TRUST_LEVEL_OPTIONS = [
  { label: '已信任', value: 'TRUSTED' },
  { label: '未信任', value: 'UNTRUSTED' },
  { label: '已屏蔽', value: 'BLOCKED' },
];

const TRUST_MAP: Record<AgentTrust['trustLevel'], { label: string; color: string }> = {
  TRUSTED: { label: '已信任', color: 'green' },
  UNTRUSTED: { label: '未信任', color: 'orange' },
  BLOCKED: { label: '已屏蔽', color: 'red' },
};

export default function TrustManagementPage() {
  const [data, setData] = useState<PageResponse<AgentTrust> | null>(null);
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AgentTrust | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    agentId: undefined as string | undefined,
    trustLevel: undefined as string | undefined,
    keyword: '',
    page: 1,
    size: 10,
  });
  const [form] = Form.useForm<AgentTrustCreateRequest & { expiresAt?: Dayjs }>();

  const loadAgents = async () => {
    try {
      const res = await listExternalAgents({ size: 1000 });
      setAgents(res.items);
    } catch {
      // ignore
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await listTrusts(filters);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
    load();
  }, []);

  useEffect(() => {
    load();
  }, [filters]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ trustLevel: 'UNTRUSTED' });
    setEditorOpen(true);
  };

  const openEdit = (record: AgentTrust) => {
    setEditing(record);
    form.setFieldsValue({
      agentId: record.agentId,
      trustLevel: record.trustLevel,
      reason: record.reason,
      allowedOperations: record.allowedOperations,
      expiresAt: record.expiresAt ? dayjs(record.expiresAt) : undefined,
    });
    setEditorOpen(true);
  };

  const handleSubmit = async (
    values: AgentTrustCreateRequest & { expiresAt?: Dayjs },
  ) => {
    const payload: AgentTrustCreateRequest = {
      ...values,
      expiresAt: values.expiresAt?.toISOString(),
    };
    setSubmitting(true);
    try {
      if (editing) {
        await updateTrust(editing.id, payload);
        message.success('已更新');
      } else {
        await createTrust(payload);
        message.success('已创建');
      }
      setEditorOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: AgentTrust) => {
    await deleteTrust(record.id);
    message.success('已删除');
    load();
  };

  const columns: ColumnsType<AgentTrust> = [
    {
      title: '信任关系',
      key: 'agent',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <SafetyOutlined /> {record.agentName || record.agentId}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.agentId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '信任等级',
      dataIndex: 'trustLevel',
      render: (v: AgentTrust['trustLevel']) => (
        <Tag color={TRUST_MAP[v].color}>{TRUST_MAP[v].label}</Tag>
      ),
    },
    {
      title: '允许操作',
      dataIndex: 'allowedOperations',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '原因',
      dataIndex: 'reason',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '不限'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
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
          信任管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加信任关系
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="选择 Agent"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 240 }}
          value={filters.agentId}
          options={agents.map((a) => ({ label: a.name, value: a.id }))}
          onChange={(v) => setFilters((prev) => ({ ...prev, agentId: v, page: 1 }))}
        />
        <Select
          placeholder="信任等级"
          allowClear
          options={TRUST_LEVEL_OPTIONS}
          style={{ width: 140 }}
          value={filters.trustLevel}
          onChange={(v) => setFilters((prev) => ({ ...prev, trustLevel: v, page: 1 }))}
        />
        <Input.Search
          placeholder="搜索原因/允许操作"
          allowClear
          onSearch={(v) => setFilters((prev) => ({ ...prev, keyword: v, page: 1 }))}
          style={{ width: 240 }}
        />
      </Space>

      <Card>
        {data?.items.length === 0 && !loading ? (
          <Empty description="还没有信任关系" />
        ) : (
          <Table
            rowKey="id"
            dataSource={data?.items || []}
            columns={columns}
            loading={loading}
            pagination={{
              current: data?.page || 1,
              pageSize: data?.size || 10,
              total: data?.total || 0,
              showSizeChanger: true,
              onChange: (page, size) => setFilters((prev) => ({ ...prev, page, size })),
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      <Modal
        open={editorOpen}
        title={editing ? '编辑信任关系' : '添加信任关系'}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={() => form.validateFields().then(handleSubmit)}
        confirmLoading={submitting}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="agentId" label="Agent" rules={[{ required: true }]}>
            <Select
              placeholder="选择外部 Agent"
              showSearch
              optionFilterProp="label"
              disabled={!!editing}
              options={agents.map((a) => ({ label: a.name, value: a.id }))}
            />
          </Form.Item>
          <Form.Item name="trustLevel" label="信任等级" rules={[{ required: true }]}>
            <Select options={TRUST_LEVEL_OPTIONS} />
          </Form.Item>
          <Form.Item name="allowedOperations" label="允许操作">
            <Input.TextArea rows={2} placeholder="例如：read,invoke" />
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="不限" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
