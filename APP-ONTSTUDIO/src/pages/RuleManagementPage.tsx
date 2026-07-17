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
  Switch,
  Table,
  Tabs,
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
  ExperimentOutlined,
} from '@ant-design/icons';
import { createRule, deleteRule, listRules, updateRule } from '@/api/rules';
import ConditionEditor from '@/components/ConditionEditor';
import ActionEditor from '@/components/ActionEditor';
import TestRunner from '@/components/TestRunner';
import type { OntologyRule, RuleAction, RuleCondition } from '@/api/rules';

export default function RuleManagementPage() {
  const [rules, setRules] = useState<OntologyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<OntologyRule | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState<OntologyRule | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await listRules();
      setRules(r.items);
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
      const payload = {
        ...v,
        conditions: form.getFieldValue('conditions') as RuleCondition[],
        actions: form.getFieldValue('actions') as RuleAction[],
      };
      if (editing) {
        await updateRule(editing.ruleId, payload);
        message.success('已更新');
      } else {
        await createRule(payload);
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

  const columns: ColumnsType<OntologyRule> = [
    {
      title: '规则',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <ExperimentOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.code} - {r.trigger}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '概念', dataIndex: 'conceptId' },
    { title: '触发', dataIndex: 'trigger', render: (v) => <Tag color="blue">{v}</Tag> },
    {
      title: '条件/动作',
      key: 'count',
      render: (_, r) => (
        <Space>
          <Tag color="purple">{r.conditions.length} 条件</Tag>
          <Tag color="cyan">{r.actions.length} 动作</Tag>
        </Space>
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
          <Button
            type="link"
            onClick={() => {
              setEditing(r);
              form.setFieldsValue({
                code: r.code,
                name: r.name,
                description: r.description,
                conceptId: r.conceptId,
                trigger: r.trigger,
                enabled: r.enabled,
                conditions: r.conditions,
                actions: r.actions,
              });
              setEditorOpen(true);
            }}
            icon={<EditOutlined />}
          >
            编辑
          </Button>
          <Button type="link" onClick={() => setTesting(r)}>
            测试
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deleteRule(r.ruleId);
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
          规则管理
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ trigger: 'manual', enabled: true, conditions: [], actions: [] });
            setEditorOpen(true);
          }}
        >
          创建规则
        </Button>
      </div>

      <Tabs
        items={[
          {
            key: 'list',
            label: '规则列表',
            children: (
              <Card>
                {rules.length === 0 && !loading ? (
                  <Empty description="还没有规则" />
                ) : (
                  <Table rowKey="ruleId" dataSource={rules} columns={columns} loading={loading} />
                )}
              </Card>
            ),
          },
          {
            key: 'test',
            label: '规则测试',
            children: testing ? (
              <TestRunner rule={testing} />
            ) : (
              <Empty description="从规则列表选择一个规则进行测试" />
            ),
          },
        ]}
      />

      <Modal
        open={editorOpen}
        title={editing ? '编辑规则' : '创建规则'}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="conceptId" label="概念" rules={[{ required: true }]}>
            <Input placeholder="conceptId 或概念编码" />
          </Form.Item>
          <Form.Item name="trigger" label="触发时机" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '创建', value: 'create' },
                { label: '更新', value: 'update' },
                { label: '删除', value: 'delete' },
                { label: '手动', value: 'manual' },
              ]}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="conditions" label="触发条件">
            <ConditionEditor value={[]} onChange={() => {}} />
          </Form.Item>
          <Form.Item name="actions" label="执行动作">
            <ActionEditor value={[]} onChange={() => {}} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
