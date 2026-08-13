import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Table,
  Tag,
  Toast,
  TreeSelect,
  Typography,
  withField,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import dayjs from 'dayjs';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getConditionSyntax,
} from '@/api/mcphub/policies';
import { listTools } from '@/api/mcphub/tools';
import type { Policy, PolicyCreateRequest, PolicyUpdateRequest, McpTool, ConditionSyntax } from '@/api/mcphub/types';

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

const MonacoField = withField(Editor);

type PolicyFormValues = Omit<PolicyCreateRequest, 'effectiveStartAt' | 'effectiveEndAt'> & {
  version?: number;
  effectiveStartAt?: Date;
  effectiveEndAt?: Date;
};

type PolicyTreeSelectNode = NonNullable<ComponentProps<typeof TreeSelect>['treeData']>[number];

export default function PolicyManagementPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PolicyFormValues>();
  const [syntax, setSyntax] = useState<ConditionSyntax | null>(null);

  const treeData = useMemo<PolicyTreeSelectNode[]>(() => {
    const grouped = tools.reduce<Record<string, McpTool[]>>((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category]!.push(t);
      return acc;
    }, {});
    return Object.keys(grouped).map((cat) => ({
      label: `${cat} (${grouped[cat]!.length})`,
      key: `cat-${cat}`,
      value: `cat-${cat}`,
      children: grouped[cat]!.map((t) => ({
        label: t.name,
        key: t.id,
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
    form.reset();
    form.setValues({
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
    form.setValues({
      ...record,
      version: record.version,
      effectiveStartAt: record.effectiveStartAt ? new Date(record.effectiveStartAt) : undefined,
      effectiveEndAt: record.effectiveEndAt ? new Date(record.effectiveEndAt) : undefined,
    });
    setEditorOpen(true);
  };

  const handleSubmit = async (values: PolicyFormValues) => {
    const { effectiveStartAt, effectiveEndAt, version, ...rest } = values;
    const basePayload: PolicyCreateRequest = {
      ...rest,
      effectiveStartAt: effectiveStartAt?.toISOString(),
      effectiveEndAt: effectiveEndAt?.toISOString(),
    };
    setSubmitting(true);
    try {
      if (editing) {
        const payload: PolicyUpdateRequest = {
          ...basePayload,
          version: version ?? editing.version,
        };
        await updatePolicy(editing.id, payload);
        Toast.success('已更新');
      } else {
        await createPolicy(basePayload);
        Toast.success('已创建');
      }
      setEditorOpen(false);
      setEditing(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnProps<Policy>[] = [
    {
      title: '策略',
      key: 'name',
      render: (_, r) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <SafetyOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
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
        <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
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
          <Button theme="borderless" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deletePolicy(r.id);
              Toast.success('已删除');
              load();
            }}
          >
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
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          ABAC 权限策略
        </Typography.Title>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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
        visible={editorOpen}
        width={720}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
        onOk={() => form.submitForm()}
      >
        <Form
          form={form}
          onSubmit={handleSubmit}
          initValues={
            {
              resourceType: 'tool',
              action: 'invoke',
              effect: 'ALLOW',
              priority: 0,
              enabled: true,
            } as PolicyFormValues
          }
        >
          <Form.Input
            field="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
            placeholder="例如：销售部工作时间可调用报价工具"
          />

          <Space style={{ display: 'flex' }}>
            <Form.Select
              field="subjectType"
              label="主体类型"
              rules={[{ required: true, message: '请选择主体类型' }]}
              optionList={SUBJECT_TYPE_OPTIONS}
              style={{ width: 120 }}
            />
            <Form.Input
              field="subjectId"
              label="主体 ID"
              rules={[{ required: true, message: '请输入主体 ID' }]}
              fieldStyle={{ flex: 1 }}
              placeholder="用户 ID 或应用 ID"
            />
          </Space>

          <Space style={{ display: 'flex' }}>
            <Form.Select
              field="resourceType"
              label="资源类型"
              rules={[{ required: true, message: '请选择资源类型' }]}
              optionList={RESOURCE_TYPE_OPTIONS}
              style={{ width: 120 }}
            />
            <Form.Select
              field="action"
              label="操作"
              rules={[{ required: true, message: '请选择操作' }]}
              optionList={ACTION_OPTIONS}
              style={{ width: 160 }}
            />
            <Form.RadioGroup
              field="effect"
              label="效果"
              rules={[{ required: true, message: '请选择效果' }]}
            >
              <Radio value="ALLOW" type="button">允许</Radio>
              <Radio value="DENY" type="button">拒绝</Radio>
            </Form.RadioGroup>
          </Space>

          <Form.TreeSelect
            field="resourceIds"
            label="工具范围"
            rules={[{ required: true, message: '请选择至少一个资源' }]}
            treeData={treeData}
            multiple
            leafOnly
            defaultExpandAll
            placeholder="请选择工具（按分类）"
            style={{ width: '100%' }}
            showClear
          />

          <MonacoField
            field="conditionExpression"
            label="条件表达式"
            height={160}
            defaultLanguage="javascript"
            options={{ minimap: { enabled: false }, lineNumbers: 'on' }}
          />

          {syntax && (
            <Typography.Paragraph type="tertiary" style={{ fontSize: 12 }}>
              语法：{syntax.syntax}；可用变量：{syntax.variables.join(', ')}
              <br />
              示例：{syntax.examples[0]}
            </Typography.Paragraph>
          )}

          <Space style={{ display: 'flex' }}>
            <Form.DatePicker
              field="effectiveStartAt"
              label="生效开始时间"
              type="dateTime"
              placeholder="开始时间"
            />
            <Form.DatePicker
              field="effectiveEndAt"
              label="生效结束时间"
              type="dateTime"
              placeholder="结束时间"
            />
          </Space>

          <Space style={{ display: 'flex' }}>
            <Form.InputNumber
              field="priority"
              label="优先级"
              rules={[{ required: true, message: '请输入优先级' }]}
              min={0}
              max={9999}
            />
            <Form.Switch field="enabled" label="启用" />
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
