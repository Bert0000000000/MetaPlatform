import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TreeSelect,
  Typography,
  message,
  DatePicker,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DefaultOptionType } from 'antd/es/select';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import dayjs from 'dayjs';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getConditionSyntax,
} from '@/api/policies';
import { listTools } from '@/api/tools';
import type { Policy, PolicyCreateRequest, McpTool, ConditionSyntax } from '@/types';

const SUBJECT_TYPE_OPTIONS = [
  { label: '用户', value: 'USER' },
  { label: '应用', value: 'APP' },
];

const RESOURCE_TYPE_OPTIONS = [
  { label: '工具', value: 'tool' },
  { label: 'Server', value: 'server' },
  { label: '资源', value: 'resource' },
  { label: 'Prompt', value: 'prompt' },
];

const ACTION_OPTIONS = [
  { label: '调用 (invoke)', value: 'invoke' },
  { label: '读取 (read)', value: 'read' },
  { label: '管理 (admin)', value: 'admin' },
];

export default function PolicyManagementPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PolicyCreateRequest>();
  const [syntax, setSyntax] = useState<ConditionSyntax | null>(null);

  const treeData = useMemo<DefaultOptionType[]>(() => {
    const grouped = tools.reduce<Record<string, McpTool[]>>((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category]!.push(t);
      return acc;
    }, {});
    return Object.keys(grouped).map((cat) => ({
      title: `${cat} (${grouped[cat]!.length})`,
      value: `cat-${cat}`,
      selectable: false,
      children: grouped[cat]!.map((t) => ({
        title: t.name,
        value: t.id,
      })),
    }));
  }, [tools]);

  const load = async () => {
    setLoading(true);
    try {
      const [p, t, s] = await Promise.all([
        listPolicies({ page: 1, size: 100 }),
        listTools({}),
        getConditionSyntax(),
      ]);
      setPolicies(p.items);
      setTools(t.items);
      setSyntax(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      resourceType: 'tool',
      action: 'invoke',
      effect: 'ALLOW',
      priority: 0,
      enabled: true,
      resourceIds: [],
    });
    setEditorOpen(true);
  };

  const openEdit = (record: Policy) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      effectiveStartAt: record.effectiveStartAt ? dayjs(record.effectiveStartAt) : undefined,
      effectiveEndAt: record.effectiveEndAt ? dayjs(record.effectiveEndAt) : undefined,
    });
    setEditorOpen(true);
  };

  const handleSubmit = async (values: PolicyCreateRequest & { effectiveStartAt?: dayjs.Dayjs; effectiveEndAt?: dayjs.Dayjs }) => {
    const payload: PolicyCreateRequest = {
      ...values,
      effectiveStartAt: values.effectiveStartAt?.toISOString(),
      effectiveEndAt: values.effectiveEndAt?.toISOString(),
    };
    setSubmitting(true);
    try {
      if (editing) {
        await updatePolicy(editing.id, payload);
        message.success('已更新');
      } else {
        await createPolicy(payload);
        message.success('已创建');
      }
      setEditorOpen(false);
      setEditing(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Policy> = [
    {
      title: '策略',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <SafetyOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            优先级 {r.priority} / 版本 {r.version}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '主体',
      key: 'subject',
      render: (_, r) => (
        <span>
          <Tag>{r.subjectType === 'USER' ? '用户' : '应用'}</Tag>
          {r.subjectId}
        </span>
      ),
    },
    {
      title: '资源',
      key: 'resource',
      render: (_, r) => (
        <span>
          <Tag color="blue">{r.resourceType}</Tag>
          {r.resourceIds.length > 3 ? `${r.resourceIds.slice(0, 3).join(', ')}...` : r.resourceIds.join(', ')}
        </span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      render: (v) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: '效果',
      dataIndex: 'effect',
      render: (v) => <Tag color={v === 'ALLOW' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '生效时间',
      key: 'effective',
      render: (_, r) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {r.effectiveStartAt ? dayjs(r.effectiveStartAt).format('YYYY-MM-DD HH:mm') : '不限'} ~{' '}
          {r.effectiveEndAt ? dayjs(r.effectiveEndAt).format('YYYY-MM-DD HH:mm') : '不限'}
        </Typography.Text>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deletePolicy(r.id);
              message.success('已删除');
              load();
            }}
          >
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
          ABAC 权限策略
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          创建策略
        </Button>
      </div>

      <Card>
        {policies.length === 0 && !loading ? (
          <Empty description="还没有 ABAC 策略" />
        ) : (
          <Table
            rowKey="id"
            dataSource={policies}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Modal
        title={editing ? '编辑策略' : '创建策略'}
        open={editorOpen}
        width={720}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            resourceType: 'tool',
            action: 'invoke',
            effect: 'ALLOW',
            priority: 0,
            enabled: true,
          }}
        >
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如：销售部工作时间可调用报价工具" />
          </Form.Item>

          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="subjectType"
              label="主体类型"
              rules={[{ required: true, message: '请选择主体类型' }]}
            >
              <Select options={SUBJECT_TYPE_OPTIONS} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item
              name="subjectId"
              label="主体 ID"
              rules={[{ required: true, message: '请输入主体 ID' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="用户 ID 或应用 ID" />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="resourceType"
              label="资源类型"
              rules={[{ required: true, message: '请选择资源类型' }]}
            >
              <Select options={RESOURCE_TYPE_OPTIONS} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item
              name="action"
              label="操作"
              rules={[{ required: true, message: '请选择操作' }]}
              style={{ width: 160 }}
            >
              <Select options={ACTION_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="effect"
              label="效果"
              rules={[{ required: true, message: '请选择效果' }]}
            >
              <Radio.Group>
                <Radio.Button value="ALLOW">允许</Radio.Button>
                <Radio.Button value="DENY">拒绝</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Space>

          <Form.Item
            name="resourceIds"
            label="工具范围"
            rules={[{ required: true, message: '请选择至少一个资源' }]}
          >
            <TreeSelect
              treeData={treeData}
              treeCheckable
              treeDefaultExpandAll
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              placeholder="请选择工具（按分类）"
              style={{ width: '100%' }}
              allowClear
            />
          </Form.Item>

          <Form.Item name="conditionExpression" label="条件表达式">
            <Editor
              height={160}
              defaultLanguage="javascript"
              options={{ minimap: { enabled: false }, lineNumbers: 'on' }}
            />
          </Form.Item>

          {syntax && (
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              语法：{syntax.syntax}；可用变量：{syntax.variables.join(', ')}
              <br />
              示例：{syntax.examples[0]}
            </Typography.Paragraph>
          )}

          <Space style={{ display: 'flex' }}>
            <Form.Item name="effectiveStartAt" label="生效开始时间">
              <DatePicker showTime placeholder="开始时间" />
            </Form.Item>
            <Form.Item name="effectiveEndAt" label="生效结束时间">
              <DatePicker showTime placeholder="结束时间" />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="priority"
              label="优先级"
              rules={[{ required: true, message: '请输入优先级' }]}
            >
              <InputNumber min={0} max={9999} />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
