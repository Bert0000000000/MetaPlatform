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
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { createRule, deleteRule, listRules, updateRule } from '@/api/rules';
import {
  listDecisionTables,
  createDecisionTable,
  updateDecisionTable,
  deleteDecisionTable,
  executeDecisionTable,
} from '@/api/decision-tables';
import ConditionEditor from '@/components/ConditionEditor';
import ActionEditor from '@/components/ActionEditor';
import TestRunner from '@/components/TestRunner';
import DecisionTableEditor from '@/components/DecisionTableEditor';
import TestCaseManager from '@/components/TestCaseManager';
import type { OntologyRule, RuleAction, RuleCondition } from '@/api/rules';
import type { DecisionTable, HitPolicy, DecisionTableColumn, DecisionTableRow } from '@/types';

const HIT_POLICY_DEFAULT: HitPolicy = 'first';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function RuleManagementPage() {
  const [rules, setRules] = useState<OntologyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<OntologyRule | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState<OntologyRule | null>(null);
  const [form] = Form.useForm();

  // 决策表状态
  const [decisionTables, setDecisionTables] = useState<DecisionTable[]>([]);
  const [decisionTablesLoading, setDecisionTablesLoading] = useState(false);
  const [currentTableId, setCurrentTableId] = useState<string | undefined>();
  const [tableForm] = Form.useForm();
  const [tableEditorOpen, setTableEditorOpen] = useState(false);

  // 测试用例 Tab：用例关联目标
  const [testCaseTarget, setTestCaseTarget] = useState<{ ruleId?: string; decisionTableId?: string }>(
    {},
  );

  // ============ 规则 ============
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

  // ============ 决策表 ============
  const loadDecisionTables = async () => {
    setDecisionTablesLoading(true);
    try {
      const data = await listDecisionTables();
      setDecisionTables(data);
      if (!currentTableId && data.length > 0) {
        setCurrentTableId(data[0]!.id);
      }
    } finally {
      setDecisionTablesLoading(false);
    }
  };

  useEffect(() => {
    loadDecisionTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTable = decisionTables.find((t) => t.id === currentTableId);

  const handleTableChange = (next: DecisionTable) => {
    setDecisionTables((prev) => prev.map((t) => (t.id === next.id ? next : t)));
  };

  const handleSaveTable = async () => {
    if (!currentTable) return;
    try {
      await updateDecisionTable(currentTable.id, {
        code: currentTable.code,
        name: currentTable.name,
        description: currentTable.description,
        conceptId: currentTable.conceptId,
        hitPolicy: currentTable.hitPolicy,
        columns: currentTable.columns,
        rows: currentTable.rows,
        enabled: currentTable.enabled,
      });
      message.success('决策表已保存');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleExecTable = async (input: Record<string, unknown>) => {
    if (!currentTable) return;
    try {
      const result = await executeDecisionTable(currentTable.id, input);
      if (result.outputs.length === 0) {
        message.info('未命中任何规则行');
      } else {
        message.success(`命中 ${result.matchedRows.length} 行，输出：${JSON.stringify(result.outputs)}`);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '执行失败');
    }
  };

  const handleOpenCreateTable = () => {
    tableForm.resetFields();
    tableForm.setFieldsValue({
      code: '',
      name: '',
      description: '',
      conceptId: '',
      hitPolicy: HIT_POLICY_DEFAULT,
    });
    setTableEditorOpen(true);
  };

  const handleCreateTableSubmit = async () => {
    const v = await tableForm.validateFields();
    const inputCol: DecisionTableColumn = {
      id: newId('col'),
      name: '输入1',
      field: 'inputField',
      columnType: 'input',
      operator: 'eq',
    };
    const outputCol: DecisionTableColumn = {
      id: newId('col'),
      name: '输出1',
      field: 'outputField',
      columnType: 'output',
    };
    const row: DecisionTableRow = {
      id: newId('row'),
      enabled: true,
      priority: 1,
      description: '示例规则行',
      cells: {
        [inputCol.id]: { value: '-' , isEmpty: true },
        [outputCol.id]: { value: '' },
      },
    };
    const payload = {
      code: v.code as string,
      name: v.name as string,
      description: v.description as string,
      conceptId: (v.conceptId as string) || undefined,
      hitPolicy: (v.hitPolicy as HitPolicy) ?? HIT_POLICY_DEFAULT,
      columns: [inputCol, outputCol],
      rows: [row],
      enabled: true,
    };
    const created = await createDecisionTable(payload);
    setDecisionTables((prev) => [...prev, created]);
    setCurrentTableId(created.id);
    setTableEditorOpen(false);
    message.success('已创建');
  };

  const handleDeleteTable = async (id: string) => {
    await deleteDecisionTable(id);
    setDecisionTables((prev) => prev.filter((t) => t.id !== id));
    if (currentTableId === id) {
      const remaining = decisionTables.filter((t) => t.id !== id);
      setCurrentTableId(remaining[0]?.id);
    }
    message.success('已删除');
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
          {
            key: 'decision-table',
            label: (
              <Space size={4}>
                <TableOutlined />
                决策表
              </Space>
            ),
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Card size="small">
                  <Space wrap>
                    <Typography.Text strong>当前决策表：</Typography.Text>
                    <Select
                      style={{ width: 320 }}
                      placeholder="选择一个决策表"
                      loading={decisionTablesLoading}
                      value={currentTableId}
                      onChange={(v) => setCurrentTableId(v)}
                      options={decisionTables.map((t) => ({
                        label: `${t.name} (${t.code})`,
                        value: t.id,
                      }))}
                    />
                    <Button icon={<PlusOutlined />} onClick={handleOpenCreateTable}>
                      新建决策表
                    </Button>
                    {currentTable && (
                      <>
                        <Button type="primary" onClick={handleSaveTable}>
                          保存
                        </Button>
                        <Popconfirm
                          title="确定删除该决策表？"
                          onConfirm={() => handleDeleteTable(currentTable.id)}
                        >
                          <Button danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                </Card>
                {currentTable ? (
                  <DecisionTableEditor
                    key={currentTable.id}
                    table={currentTable}
                    onChange={handleTableChange}
                    onExecute={handleExecTable}
                  />
                ) : (
                  <Empty description="暂无决策表，请点击「新建决策表」" />
                )}
              </Space>
            ),
          },
          {
            key: 'test-cases',
            label: '测试用例',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Card size="small">
                  <Space wrap>
                    <Typography.Text strong>用例关联：</Typography.Text>
                    <Select
                      allowClear
                      placeholder="选择关联规则"
                      style={{ width: 240 }}
                      value={testCaseTarget.ruleId}
                      onChange={(v) =>
                        setTestCaseTarget((prev) => ({
                          ...prev,
                          ruleId: v,
                          decisionTableId: prev.decisionTableId && v ? undefined : prev.decisionTableId,
                        }))
                      }
                      options={rules.map((r) => ({
                        label: `${r.name} (${r.code})`,
                        value: r.ruleId,
                      }))}
                    />
                    <Select
                      allowClear
                      placeholder="选择关联决策表"
                      style={{ width: 240 }}
                      value={testCaseTarget.decisionTableId}
                      onChange={(v) =>
                        setTestCaseTarget((prev) => ({
                          ...prev,
                          decisionTableId: v,
                          ruleId: prev.ruleId && v ? undefined : prev.ruleId,
                        }))
                      }
                      options={decisionTables.map((t) => ({
                        label: `${t.name} (${t.code})`,
                        value: t.id,
                      }))}
                    />
                    <Alert
                      type="info"
                      showIcon
                      style={{ padding: '4px 12px' }}
                      message={
                        testCaseTarget.ruleId || testCaseTarget.decisionTableId
                          ? `当前过滤：${testCaseTarget.ruleId ? `规则 ${testCaseTarget.ruleId}` : ''} ${
                              testCaseTarget.decisionTableId ? `决策表 ${testCaseTarget.decisionTableId}` : ''
                            }`
                          : '未选择过滤，展示全部用例'
                      }
                    />
                  </Space>
                </Card>
                <TestCaseManager
                  ruleId={testCaseTarget.ruleId}
                  decisionTableId={testCaseTarget.decisionTableId}
                />
              </Space>
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

      <Modal
        open={tableEditorOpen}
        title="新建决策表"
        onCancel={() => setTableEditorOpen(false)}
        onOk={handleCreateTableSubmit}
        width={640}
        destroyOnClose
      >
        <Form form={tableForm} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}>
            <Input placeholder="例如 ORDER_DISCOUNT" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="conceptId" label="关联概念 (可选)">
            <Input placeholder="conceptId" />
          </Form.Item>
          <Form.Item name="hitPolicy" label="命中策略" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '首次命中', value: 'first' },
                { label: '全部命中', value: 'all' },
                { label: '优先级', value: 'priority' },
                { label: '唯一命中', value: 'unique' },
                { label: '聚合', value: 'collect' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
