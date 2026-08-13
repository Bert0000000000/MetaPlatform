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
  Toast,
  Popconfirm,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { listTrusts, createTrust, updateTrust, deleteTrust } from '@/api/mcphub/trusts';
import { listExternalAgents } from '@/api/mcphub/external-agents';
import type { AgentTrust, AgentTrustCreateRequest, ExternalAgent, PageResponse } from '@/api/mcphub/types';
import dayjs from 'dayjs';

const TRUST_LEVEL_OPTIONS = [
  { label: '已信任', value: 'TRUSTED' },
  { label: '未信任', value: 'UNTRUSTED' },
  { label: '已屏蔽', value: 'BLOCKED' },
];

const TRUST_MAP: Record<AgentTrust['trustLevel'], { label: string; color: TagColor }> = {
  TRUSTED: { label: '已信任', color: 'green' },
  UNTRUSTED: { label: '未信任', color: 'orange' },
  BLOCKED: { label: '已屏蔽', color: 'red' },
};

/** Semi DatePicker 表单值存格式化字符串（yyyy-MM-dd HH:mm:ss）。 */
type TrustFormValues = Omit<AgentTrustCreateRequest, 'expiresAt'> & {
  expiresAt?: string;
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
  const [form] = Form.useForm<TrustFormValues>();

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
    form.reset();
    form.setValues({ trustLevel: 'UNTRUSTED' });
    setEditorOpen(true);
  };

  const openEdit = (record: AgentTrust) => {
    setEditing(record);
    form.setValues({
      agentId: record.agentId,
      trustLevel: record.trustLevel,
      reason: record.reason,
      allowedOperations: record.allowedOperations,
      expiresAt: record.expiresAt
        ? dayjs(record.expiresAt).format('YYYY-MM-DD HH:mm:ss')
        : undefined,
    });
    setEditorOpen(true);
  };

  const handleSubmit = async (values: TrustFormValues) => {
    const { expiresAt, ...rest } = values;
    const payload: AgentTrustCreateRequest = {
      ...rest,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    };
    setSubmitting(true);
    try {
      if (editing) {
        await updateTrust(editing.id, payload);
        Toast.success('已更新');
      } else {
        await createTrust(payload);
        Toast.success('已创建');
      }
      setEditorOpen(false);
      setEditing(null);
      form.reset();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: AgentTrust) => {
    await deleteTrust(record.id);
    Toast.success('已删除');
    load();
  };

  const columns: ColumnProps<AgentTrust>[] = [
    {
      title: '信任关系',
      key: 'agent',
      render: (_, record) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <SafetyOutlined /> {record.agentName || record.agentId}
          </Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
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
          <Button theme="borderless" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
            <Button type="danger" theme="borderless" icon={<DeleteOutlined />}>
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
          信任管理
        </Typography.Title>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加信任关系
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="选择 Agent"
          showClear
          filter
          style={{ width: 240 }}
          value={filters.agentId}
          optionList={agents.map((a) => ({ label: a.name, value: a.id }))}
          onChange={(v) => setFilters((prev) => ({ ...prev, agentId: v as string | undefined, page: 1 }))}
        />
        <Select
          placeholder="信任等级"
          showClear
          optionList={TRUST_LEVEL_OPTIONS}
          style={{ width: 140 }}
          value={filters.trustLevel}
          onChange={(v) => setFilters((prev) => ({ ...prev, trustLevel: v as string | undefined, page: 1 }))}
        />
        <Input
          placeholder="搜索原因/允许操作"
          showClear
          onEnterPress={(e) =>
            setFilters((prev) => ({
              ...prev,
              keyword: (e.target as HTMLInputElement).value,
              page: 1,
            }))
          }
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
              currentPage: data?.page || 1,
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
        visible={editorOpen}
        title={editing ? '编辑信任关系' : '添加信任关系'}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={() => form.validate().then(handleSubmit)}
        confirmLoading={submitting}
        width={640}
      >
        <Form form={form}>
          <Form.Select
            field="agentId"
            label="Agent"
            rules={[{ required: true }]}
            placeholder="选择外部 Agent"
            filter
            disabled={!!editing}
            optionList={agents.map((a) => ({ label: a.name, value: a.id }))}
          />
          <Form.Select
            field="trustLevel"
            label="信任等级"
            rules={[{ required: true }]}
            optionList={TRUST_LEVEL_OPTIONS}
          />
          <Form.TextArea
            field="allowedOperations"
            label="允许操作"
            rows={2}
            placeholder="例如：read,invoke"
          />
          <Form.TextArea field="reason" label="原因" rows={2} />
          <Form.DatePicker
            field="expiresAt"
            label="过期时间"
            type="dateTime"
            format="yyyy-MM-dd HH:mm:ss"
            placeholder="不限"
            style={{ width: '100%' }}
          />
        </Form>
      </Modal>
    </div>
  );
}
