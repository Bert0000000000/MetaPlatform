import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  listTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  runTestCases,
} from '@/api/test-cases';
import type { TestCase, TestCaseStatus, TestRun } from '@/types';

interface TestCaseManagerProps {
  ruleId?: string;
  decisionTableId?: string;
}

const STATUS_LABELS: Record<TestCaseStatus, { text: string; color: string }> = {
  pending: { text: '未执行', color: 'default' },
  pass: { text: '通过', color: 'success' },
  fail: { text: '失败', color: 'error' },
  error: { text: '错误', color: 'warning' },
};

function newId(): string {
  return `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function safeStringify(v: unknown): string {
  if (v === undefined || v === null) return '-';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function tryParse(text: string): Record<string, unknown> | undefined {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export default function TestCaseManager({ ruleId, decisionTableId }: TestCaseManagerProps) {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<TestRun | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await listTestCases(ruleId, decisionTableId);
      setCases(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setLastRun(null);
    setSelectedIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleId, decisionTableId]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      name: '',
      description: '',
      input: '{\n  \n}',
      expectedOutput: '{\n  \n}',
    });
    setEditorOpen(true);
  };

  const openEdit = (c: TestCase) => {
    setEditing(c);
    form.setFieldsValue({
      name: c.name,
      description: c.description ?? '',
      input: safeStringify(c.input),
      expectedOutput: c.expectedOutput ? safeStringify(c.expectedOutput) : '',
    });
    setEditorOpen(true);
  };

  const handleSubmit = async () => {
    const v = await form.validateFields();
    const inputParsed = tryParse(v.input as string);
    if (!inputParsed) {
      message.warning('输入 JSON 不合法');
      return;
    }
    const expectedParsed = (v.expectedOutput as string)?.trim()
      ? tryParse(v.expectedOutput as string)
      : undefined;
    if ((v.expectedOutput as string)?.trim() && !expectedParsed) {
      message.warning('期望输出 JSON 不合法');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: v.name as string,
        description: v.description as string,
        input: inputParsed,
        expectedOutput: expectedParsed,
        ruleId,
        decisionTableId,
      };
      if (editing) {
        await updateTestCase(editing.id, payload);
        message.success('已更新');
      } else {
        await createTestCase(payload);
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

  const handleRunSelected = async (ids: string[]) => {
    if (ids.length === 0) {
      message.warning('请选择要执行的用例');
      return;
    }
    setRunning(true);
    try {
      const run = await runTestCases({
        ruleId,
        decisionTableId,
        testCaseIds: ids,
      });
      setLastRun(run);
      message.success(`执行完成：通过 ${run.passedCount}/${run.totalCases}`);
      load();
    } finally {
      setRunning(false);
    }
  };

  const handleRunAll = async () => {
    if (cases.length === 0) {
      message.warning('暂无用例可执行');
      return;
    }
    setRunning(true);
    try {
      const run = await runTestCases({
        ruleId,
        decisionTableId,
      });
      setLastRun(run);
      message.success(`执行完成：通过 ${run.passedCount}/${run.totalCases}`);
      load();
    } finally {
      setRunning(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      message.warning('请选择要删除的用例');
      return;
    }
    await Promise.all(selectedIds.map((id) => deleteTestCase(id)));
    message.success(`已删除 ${selectedIds.length} 条用例`);
    setSelectedIds([]);
    load();
  };

  const columns: ColumnsType<TestCase> = [
    {
      title: '用例',
      key: 'name',
      render: (_, c) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{c.name}</Typography.Text>
          {c.description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {c.description}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '输入',
      key: 'input',
      width: 220,
      render: (_, c) => (
        <Typography.Text
          code
          style={{ fontSize: 12, display: 'block', maxHeight: 80, overflow: 'auto' }}
        >
          {safeStringify(c.input)}
        </Typography.Text>
      ),
    },
    {
      title: '期望输出',
      key: 'expected',
      width: 200,
      render: (_, c) =>
        c.expectedOutput ? (
          <Typography.Text code style={{ fontSize: 12 }}>
            {safeStringify(c.expectedOutput)}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: '实际输出',
      key: 'actual',
      width: 200,
      render: (_, c) =>
        c.actualOutput ? (
          <Typography.Text code style={{ fontSize: 12 }}>
            {safeStringify(c.actualOutput)}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: TestCaseStatus) => {
        const meta = STATUS_LABELS[v] ?? STATUS_LABELS.pending;
        const icon =
          v === 'pass' ? (
            <CheckCircleOutlined />
          ) : v === 'fail' ? (
            <CloseCircleOutlined />
          ) : v === 'error' ? (
            <ExclamationCircleOutlined />
          ) : null;
        return (
          <Tag color={meta.color} icon={icon ?? undefined}>
            {meta.text}
          </Tag>
        );
      },
    },
    {
      title: '执行时间',
      dataIndex: 'executedAt',
      width: 160,
      render: (v?: string) =>
        v ? new Date(v).toLocaleString() : <Typography.Text type="secondary">-</Typography.Text>,
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      width: 200,
      render: (v?: string) =>
        v ? (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            {v}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: '操作',
      key: 'ops',
      width: 120,
      fixed: 'right',
      render: (_, c) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(c)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该用例？"
            onConfirm={async () => {
              await deleteTestCase(c.id);
              message.success('已删除');
              load();
            }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card size="small">
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建用例
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            loading={running}
            onClick={handleRunAll}
            disabled={cases.length === 0}
          >
            批量执行全部
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            loading={running}
            onClick={() => handleRunSelected(selectedIds)}
            disabled={selectedIds.length === 0}
          >
            执行选中 ({selectedIds.length})
          </Button>
          <Popconfirm
            title={`确定删除选中的 ${selectedIds.length} 条用例？`}
            onConfirm={handleBatchDelete}
            disabled={selectedIds.length === 0}
          >
            <Button danger icon={<DeleteOutlined />} disabled={selectedIds.length === 0}>
              批量删除
            </Button>
          </Popconfirm>
          <Typography.Text type="secondary" style={{ marginLeft: 'auto' }}>
            共 {cases.length} 条用例
            {ruleId && ` · 关联规则 ${ruleId}`}
            {decisionTableId && ` · 关联决策表 ${decisionTableId}`}
          </Typography.Text>
        </Space>
      </Card>

      {lastRun && (
        <Card size="small" title="最近一次执行结果">
          <Space size="large" wrap>
            <Statistic title="总数" value={lastRun.totalCases} />
            <Statistic title="通过" value={lastRun.passedCount} valueStyle={{ color: '#52c41a' }} />
            <Statistic title="失败" value={lastRun.failedCount} valueStyle={{ color: '#ff4d4f' }} />
            <Statistic title="错误" value={lastRun.errorCount} valueStyle={{ color: '#faad14' }} />
            <Statistic
              title="通过率"
              value={
                lastRun.totalCases === 0
                  ? '0%'
                  : `${((lastRun.passedCount / lastRun.totalCases) * 100).toFixed(1)}%`
              }
            />
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                开始：{new Date(lastRun.startedAt).toLocaleString()}
              </Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                结束：
                {lastRun.finishedAt ? new Date(lastRun.finishedAt).toLocaleString() : '-'}
              </Typography.Text>
            </div>
          </Space>
          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>差异明细：</Typography.Text>
            <Table<TestCase>
              rowKey="id"
              dataSource={lastRun.results}
              columns={[
                {
                  title: '用例',
                  dataIndex: 'name',
                  width: 200,
                },
                {
                  title: '期望',
                  key: 'expected',
                  render: (_, c) => (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 12,
                        maxHeight: 160,
                        overflow: 'auto',
                        background: '#f6f8fa',
                        padding: 6,
                      }}
                    >
                      {safeStringify(c.expectedOutput)}
                    </pre>
                  ),
                },
                {
                  title: '实际',
                  key: 'actual',
                  render: (_, c) => (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 12,
                        maxHeight: 160,
                        overflow: 'auto',
                        background:
                          c.status === 'pass' ? '#f6ffed' : c.status === 'fail' ? '#fff1f0' : '#fffbe6',
                        padding: 6,
                      }}
                    >
                      {c.status === 'error' ? `ERROR: ${c.errorMessage ?? ''}` : safeStringify(c.actualOutput)}
                    </pre>
                  ),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 80,
                  render: (v: TestCaseStatus) => {
                    const meta = STATUS_LABELS[v] ?? STATUS_LABELS.pending;
                    return <Tag color={meta.color}>{meta.text}</Tag>;
                  },
                },
              ]}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>
        </Card>
      )}

      <Card size="small">
        {cases.length === 0 && !loading ? (
          <Empty description="暂无测试用例，点击「新建用例」开始" />
        ) : (
          <Table<TestCase>
            rowKey="id"
            dataSource={cases}
            columns={columns}
            loading={loading}
            size="small"
            scroll={{ x: 'max-content' }}
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys.map(String)),
            }}
          />
        )}
      </Card>

      <Modal
        open={editorOpen}
        title={editing ? '编辑测试用例' : '新建测试用例'}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="用例名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：VIP 大单应享 8 折" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item
            name="input"
            label="输入数据 (JSON)"
            rules={[{ required: true, message: '请输入输入数据' }]}
          >
            <Input.TextArea
              rows={6}
              style={{ fontFamily: 'Menlo, Consolas, monospace' }}
              placeholder='{"amount": 15000, "isVip": true}'
            />
          </Form.Item>
          <Form.Item name="expectedOutput" label="期望输出 (JSON, 可选)">
            <Input.TextArea
              rows={6}
              style={{ fontFamily: 'Menlo, Consolas, monospace' }}
              placeholder='{"discountRate": "0.8"}'
            />
          </Form.Item>
          {(ruleId || decisionTableId) && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              关联：{ruleId ? `规则 ${ruleId}` : ''} {decisionTableId ? `决策表 ${decisionTableId}` : ''}
            </Typography.Text>
          )}
        </Form>
      </Modal>
    </Space>
  );
}
