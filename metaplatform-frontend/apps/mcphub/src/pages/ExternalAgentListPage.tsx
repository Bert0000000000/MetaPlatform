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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import {
  listExternalAgents,
  createExternalAgent,
  updateExternalAgent,
  deleteExternalAgent,
  testExternalAgentConnection,
} from '@/api/external-agents';
import type { ExternalAgent, ExternalAgentCreateRequest, PageResponse } from '@/types';

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

const STATUS_MAP: Record<ExternalAgent['status'], { label: string; color: string }> = {
  ACTIVE: { label: '活跃', color: 'success' },
  INACTIVE: { label: '未激活', color: 'default' },
  ERROR: { label: '异常', color: 'error' },
};

const TRUST_MAP: Record<ExternalAgent['trustLevel'], { label: string; color: string }> = {
  TRUSTED: { label: '已信任', color: 'green' },
  UNTRUSTED: { label: '未信任', color: 'orange' },
  BLOCKED: { label: '已屏蔽', color: 'red' },
};

export default function ExternalAgentListPage() {
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
    form.resetFields();
    form.setFieldsValue({
      protocolType: 'MCP',
      authType: 'none',
    });
    setEditorOpen(true);
  };

  const openEdit = (record: ExternalAgent) => {
    setEditing(record);
    form.setFieldsValue({
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
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await updateExternalAgent(editing.id, values);
        message.success('已更新');
      } else {
        await createExternalAgent(values);
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

  const handleDelete = async (record: ExternalAgent) => {
    await deleteExternalAgent(record.id);
    message.success('已删除');
    load();
  };

  const handleTest = async (record: ExternalAgent) => {
    setTestingId(record.id);
    try {
      const result = await testExternalAgentConnection(record.id);
      if (result.success) {
        message.success(`连接成功 ${result.responseTimeMs ?? ''}ms`);
      } else {
        message.error(result.message || '连接失败');
      }
      load();
    } finally {
      setTestingId(null);
    }
  };

  const columns: ColumnsType<ExternalAgent> = [
    {
      title: 'Agent',
      key: 'name',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <RobotOutlined /> {record.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
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
          <Button type="link" onClick={() => setDetail(record)}>
            详情
          </Button>
          <Button
            type="link"
            icon={<ApiOutlined />}
            loading={testingId === record.id}
            onClick={() => handleTest(record)}
          >
            测试
          </Button>
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
          外部 Agent 目录
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加 Agent
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索名称/端点"
          allowClear
          onSearch={(v) => setFilters((prev) => ({ ...prev, keyword: v, page: 1 }))}
          style={{ width: 240 }}
        />
        <Select
          placeholder="协议类型"
          allowClear
          options={PROTOCOL_OPTIONS}
          style={{ width: 140 }}
          value={filters.protocolType}
          onChange={(v) => setFilters((prev) => ({ ...prev, protocolType: v, page: 1 }))}
        />
        <Select
          placeholder="状态"
          allowClear
          options={STATUS_OPTIONS}
          style={{ width: 140 }}
          value={filters.status}
          onChange={(v) => setFilters((prev) => ({ ...prev, status: v, page: 1 }))}
        />
        <Select
          placeholder="信任等级"
          allowClear
          options={TRUST_LEVEL_OPTIONS}
          style={{ width: 140 }}
          value={filters.trustLevel}
          onChange={(v) => setFilters((prev) => ({ ...prev, trustLevel: v, page: 1 }))}
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
        title={editing ? '编辑外部 Agent' : '添加外部 Agent'}
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
            <Input placeholder="例如：外部 RAG Agent" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="端点 URL"
            rules={[{ required: true, type: 'url', message: '请输入合法的 URL' }]}
          >
            <Input placeholder="https://example.com/mcp" />
          </Form.Item>
          <Form.Item name="protocolType" label="协议类型" rules={[{ required: true }]}>
            <Select options={PROTOCOL_OPTIONS} />
          </Form.Item>
          <Form.Item name="authType" label="认证方式">
            <Select options={AUTH_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.authType !== next.authType}
          >
            {({ getFieldValue }) =>
              getFieldValue('authType') && getFieldValue('authType') !== 'none' ? (
                <Form.Item
                  name="authConfig"
                  label="认证配置 (JSON)"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        try {
                          JSON.parse(value);
                          return Promise.resolve();
                        } catch {
                          return Promise.reject(new Error('请输入合法 JSON'));
                        }
                      },
                    },
                  ]}
                >
                  <Input.TextArea rows={3} placeholder='{"apiKey":"sk-..."}' />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item
            name="capabilities"
            label="能力描述"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('请输入合法 JSON'));
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={3} placeholder='["search","execute"]' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!detail}
        title="Agent 详情"
        onCancel={() => setDetail(null)}
        footer={null}
        width={640}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }}>
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
