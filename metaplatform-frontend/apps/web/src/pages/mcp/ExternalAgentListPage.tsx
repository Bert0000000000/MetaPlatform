import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Popconfirm,
  Toast,
  useFormState,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  RobotOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  listExternalAgents,
  createExternalAgent,
  updateExternalAgent,
  deleteExternalAgent,
  testExternalAgentConnection,
} from '@/api/mcphub/external-agents';
import type { ExternalAgent, ExternalAgentCreateRequest, PageResponse } from '@/api/mcphub/types';
import { searchAgentCards, type ExternalAgent as A2ACard } from '@/api/dw/a2a';

const PROTOCOL_OPTIONS = [
  { label: 'MCP', value: 'MCP' },
  { label: 'A2A', value: 'A2A' },
  { label: 'BOTH', value: 'BOTH' },
];

const STATUS_OPTIONS = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
  { label: 'ERROR', value: 'ERROR' },
];

const TRUST_LEVEL_OPTIONS = [
  { label: 'TRUSTED', value: 'TRUSTED' },
  { label: 'UNTRUSTED', value: 'UNTRUSTED' },
  { label: 'BLOCKED', value: 'BLOCKED' },
];

const AUTH_OPTIONS = [
  { label: '无认证', value: 'none' },
  { label: 'API Key', value: 'apikey' },
  { label: 'Bearer Token', value: 'bearer' },
  { label: 'OAuth 2.0', value: 'oauth2' },
];

const STATUS_MAP: Record<ExternalAgent['status'], { label: string; color: TagColor }> = {
  ACTIVE: { label: '活跃', color: 'green' },
  INACTIVE: { label: '未激活', color: 'grey' },
  ERROR: { label: '异常', color: 'red' },
};

const TRUST_MAP: Record<ExternalAgent['trustLevel'], { label: string; color: TagColor }> = {
  TRUSTED: { label: '已信任', color: 'green' },
  UNTRUSTED: { label: '未信任', color: 'orange' },
  BLOCKED: { label: '已屏蔽', color: 'red' },
};

/**
 * 认证配置字段：仅当 authType 非空且不为 none 时渲染（antd shouldUpdate render-prop 的 Semi 等价实现）。
 */
function AuthConfigField() {
  const { values } = useFormState<ExternalAgentCreateRequest>();
  const authType = values?.authType;
  if (!authType || authType === 'none') {
    return null;
  }
  return (
    <Form.TextArea
      field="authConfig"
      label="认证配置 (JSON)"
      rows={3}
      placeholder='{"apiKey":"sk-..."}'
      validator={(value) => {
        if (!value) return '';
        try {
          JSON.parse(value);
          return '';
        } catch {
          return '请输入合法 JSON';
        }
      }}
    />
  );
}

export default function ExternalAgentListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PageResponse<ExternalAgent> | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalAgent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    keyword: '',
    status: undefined as string | undefined,
    trustLevel: undefined as string | undefined,
    protocolType: undefined as string | undefined,
    page: 1,
    size: 10,
  });
  const [form] = Form.useForm<ExternalAgentCreateRequest>();
  const [detail, setDetail] = useState<ExternalAgent | null>(null);
  const [internalAgents, setInternalAgents] = useState<A2ACard[]>([]);

  const loadInternal = async () => {
    try {
      const cards = await searchAgentCards();
      setInternalAgents(cards.filter((c) => c.source === 'internal'));
    } catch {
      setInternalAgents([]);
    }
  };

  useEffect(() => {
    loadInternal();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listExternalAgents(filters);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters]);

  const openCreate = () => {
    setEditing(null);
    form.reset();
    form.setValues({
      protocolType: 'MCP',
      authType: 'none',
    });
    setEditorOpen(true);
  };

  const openEdit = (record: ExternalAgent) => {
    setEditing(record);
    form.setValues({
      name: record.name,
      description: record.description,
      endpoint: record.endpoint,
      protocolType: record.protocolType,
      authType: record.authType || 'none',
      authConfig: record.authConfig,
      capabilities: record.capabilities,
    });
    setEditorOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (editing) {
        await updateExternalAgent(editing.id, values);
        Toast.success('已更新');
      } else {
        await createExternalAgent(values);
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

  const handleDelete = async (record: ExternalAgent) => {
    await deleteExternalAgent(record.id);
    Toast.success('已删除');
    load();
  };

  const handleTest = async (record: ExternalAgent) => {
    setTestingId(record.id);
    try {
      const result = await testExternalAgentConnection(record.id);
      if (result.success) {
        Toast.success(`连接成功 ${result.responseTimeMs ?? ''}ms`);
      } else {
        Toast.error(result.message || '连接失败');
      }
      load();
    } finally {
      setTestingId(null);
    }
  };

  const columns: ColumnProps<ExternalAgent>[] = [
    {
      title: 'Agent',
      key: 'name',
      render: (_, record) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <RobotOutlined /> {record.name}
          </Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
            {record.description || record.endpoint}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '协议',
      dataIndex: 'protocolType',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '端点',
      dataIndex: 'endpoint',
      ellipsis: true,
    },
    {
      title: '认证',
      dataIndex: 'authType',
      render: (v) => v || 'none',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: ExternalAgent['status']) => (
        <Tag color={STATUS_MAP[v].color}>{STATUS_MAP[v].label}</Tag>
      ),
    },
    {
      title: '信任等级',
      dataIndex: 'trustLevel',
      render: (v: ExternalAgent['trustLevel']) => (
        <Tag color={TRUST_MAP[v].color}>{TRUST_MAP[v].label}</Tag>
      ),
    },
    {
      title: '最近连接',
      dataIndex: 'lastConnectedAt',
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button theme="borderless" onClick={() => setDetail(record)}>
            详情
          </Button>
          <Button
            theme="borderless"
            icon={<ApiOutlined />}
            loading={testingId === record.id}
            onClick={() => handleTest(record)}
          >
            测试
          </Button>
          <Button theme="borderless" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
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
      <div className="mcphub-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          外部 Agent 目录
        </Typography.Title>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加 Agent
        </Button>
      </div>

      {internalAgents.length > 0 && (
        <Card title="内部数字员工" style={{ marginBottom: 16 }}>
          <Table<A2ACard>
            rowKey="agentId"
            dataSource={internalAgents}
            size="small"
            pagination={false}
            columns={[
              {
                title: '名称',
                dataIndex: 'name',
                key: 'name',
                render: (_, record) => (
                  <Space>
                    <Tag color="yellow">内部</Tag>
                    <Typography.Text strong>{record.name}</Typography.Text>
                  </Space>
                ),
              },
              { title: '角色', dataIndex: 'role', key: 'role', width: 160 },
              {
                title: '端点',
                dataIndex: 'endpoint',
                key: 'endpoint',
                render: (v: string) => <Typography.Text type="tertiary" style={{ fontSize: 12 }}>{v || '-'}</Typography.Text>,
              },
              {
                title: '操作',
                key: 'actions',
                width: 120,
                render: (_, record) => (
                  <Button theme="borderless" size="small" onClick={() => navigate(`/agents/${record.agentId}`)}>
                    查看详情
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      )}

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索名称/端点"
          showClear
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
          onEnterPress={(e) =>
            setFilters((prev) => ({ ...prev, keyword: (e.target as HTMLInputElement).value, page: 1 }))
          }
        />
        <Select
          placeholder="协议类型"
          showClear
          optionList={PROTOCOL_OPTIONS}
          style={{ width: 140 }}
          value={filters.protocolType}
          onChange={(v) => setFilters((prev) => ({ ...prev, protocolType: v as string | undefined, page: 1 }))}
        />
        <Select
          placeholder="状态"
          showClear
          optionList={STATUS_OPTIONS}
          style={{ width: 140 }}
          value={filters.status}
          onChange={(v) => setFilters((prev) => ({ ...prev, status: v as string | undefined, page: 1 }))}
        />
        <Select
          placeholder="信任等级"
          showClear
          optionList={TRUST_LEVEL_OPTIONS}
          style={{ width: 140 }}
          value={filters.trustLevel}
          onChange={(v) => setFilters((prev) => ({ ...prev, trustLevel: v as string | undefined, page: 1 }))}
        />
      </Space>

      <Card>
        {data?.items.length === 0 && !loading ? (
          <Empty description="还没有外部 Agent" />
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
        title={editing ? '编辑外部 Agent' : '添加外部 Agent'}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={640}
      >
        <Form form={form}>
          <Form.Input
            field="name"
            label="名称"
            rules={[{ required: true }]}
            placeholder="例如：外部 RAG Agent"
          />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Input
            field="endpoint"
            label="端点 URL"
            rules={[{ required: true, type: 'url', message: '请输入合法的 URL' }]}
            placeholder="https://example.com/mcp"
          />
          <Form.Select
            field="protocolType"
            label="协议类型"
            rules={[{ required: true }]}
            optionList={PROTOCOL_OPTIONS}
          />
          <Form.Select field="authType" label="认证方式" optionList={AUTH_OPTIONS} showClear />
          <AuthConfigField />
          <Form.TextArea
            field="capabilities"
            label="能力描述"
            rows={3}
            placeholder='["search","execute"]'
            validator={(value) => {
              if (!value) return '';
              try {
                JSON.parse(value);
                return '';
              } catch {
                return '请输入合法 JSON';
              }
            }}
          />
        </Form>
      </Modal>

      <Modal
        visible={!!detail}
        title="Agent 详情"
        onCancel={() => setDetail(null)}
        footer={null}
        width={640}
      >
        {detail && (
          <Space vertical style={{ width: '100%' }}>
            <Typography.Paragraph>
              <Typography.Text strong>ID: </Typography.Text>
              {detail.id}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>名称: </Typography.Text>
              {detail.name}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>描述: </Typography.Text>
              {detail.description || '-'}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>端点: </Typography.Text>
              {detail.endpoint}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>协议: </Typography.Text>
              {detail.protocolType}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>状态: </Typography.Text>
              <Tag color={STATUS_MAP[detail.status].color}>{STATUS_MAP[detail.status].label}</Tag>
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>信任等级: </Typography.Text>
              <Tag color={TRUST_MAP[detail.trustLevel].color}>
                {TRUST_MAP[detail.trustLevel].label}
              </Tag>
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>认证: </Typography.Text>
              {detail.authType || 'none'}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>能力: </Typography.Text>
              {detail.capabilities || '-'}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>最近连接: </Typography.Text>
              {detail.lastConnectedAt ? new Date(detail.lastConnectedAt).toLocaleString() : '-'}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Text strong>最近错误: </Typography.Text>
              {detail.lastErrorMessage || '-'}
            </Typography.Paragraph>
          </Space>
        )}
      </Modal>
    </div>
  );
}
