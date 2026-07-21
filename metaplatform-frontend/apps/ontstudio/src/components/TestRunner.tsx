import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  HistoryOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { testRule } from '@/api/rules';
import { createTestCase } from '@/api/test-cases';
import type { OntologyRule } from '@/api/rules';

interface TestRunnerProps {
  rule: OntologyRule;
}

interface TestHistoryEntry {
  id: string;
  ruleId: string;
  sample: Record<string, unknown>;
  result: Awaited<ReturnType<typeof testRule>>;
  executedAt: string;
}

const HISTORY_KEY_PREFIX = 'mate_platform_test_history_';
const HISTORY_LIMIT = 10;

function loadHistory(ruleId: string): TestHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY_PREFIX + ruleId);
    return raw ? (JSON.parse(raw) as TestHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(ruleId: string, entries: TestHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY_PREFIX + ruleId, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export default function TestRunner({ rule }: TestRunnerProps) {
  const [sampleInput, setSampleInput] = useState(
    '{\n  "amount": 1500,\n  "status": "pending"\n}',
  );
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof testRule>> | null>(null);
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm] = Form.useForm();
  const [submittingCase, setSubmittingCase] = useState(false);

  useEffect(() => {
    setHistory(loadHistory(rule.ruleId));
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule.ruleId]);

  const handleRun = async () => {
    let sample: Record<string, unknown> = {};
    try {
      sample = JSON.parse(sampleInput);
    } catch {
      message.warning('请输入合法 JSON');
      return;
    }
    setTesting(true);
    try {
      const r = await testRule(rule.ruleId, sample);
      setResult(r);
      const entry: TestHistoryEntry = {
        id: `th_${Date.now().toString(36)}`,
        ruleId: rule.ruleId,
        sample,
        result: r,
        executedAt: new Date().toISOString(),
      };
      const next = [entry, ...loadHistory(rule.ruleId)].slice(0, HISTORY_LIMIT);
      saveHistory(rule.ruleId, next);
      setHistory(next);
    } finally {
      setTesting(false);
    }
  };

  const handleClearHistory = () => {
    saveHistory(rule.ruleId, []);
    setHistory([]);
    message.success('已清空历史');
  };

  const handleOpenSave = () => {
    if (!result) {
      message.warning('请先运行测试');
      return;
    }
    let sample: Record<string, unknown> = {};
    try {
      sample = JSON.parse(sampleInput);
    } catch {
      message.warning('当前输入 JSON 不合法');
      return;
    }
    saveForm.resetFields();
    saveForm.setFieldsValue({
      name: `${rule.name} - 用例 ${new Date().toLocaleString()}`,
      description: `从规则测试器保存：${result.passed ? '通过' : '失败'}`,
    });
    setSaveOpen(true);
  };

  const handleSaveCase = async () => {
    const v = await saveForm.validateFields();
    let sample: Record<string, unknown> = {};
    try {
      sample = JSON.parse(sampleInput);
    } catch {
      message.warning('输入 JSON 不合法');
      return;
    }
    setSubmittingCase(true);
    try {
      await createTestCase({
        name: v.name as string,
        description: v.description as string,
        input: sample,
        ruleId: rule.ruleId,
      });
      message.success('已保存为测试用例');
      setSaveOpen(false);
    } finally {
      setSubmittingCase(false);
    }
  };

  return (
    <Card title="规则测试" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">输入测试样本（JSON）</Typography.Text>
        <Input.TextArea
          rows={6}
          value={sampleInput}
          onChange={(e) => setSampleInput(e.target.value)}
          style={{ fontFamily: 'Menlo, Consolas, monospace' }}
        />
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={testing}
            onClick={handleRun}
          >
            运行
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleOpenSave} disabled={!result}>
            保存为测试用例
          </Button>
        </Space>

        {result && (
          <Card type="inner" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                {result.passed ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    测试通过
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    测试失败
                  </Tag>
                )}
              </div>
              <div>
                <Typography.Text strong>条件评估：</Typography.Text>
                {result.conditions.map((c) => (
                  <div key={c.id}>
                    {c.passed ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>
                        {c.message}
                      </Tag>
                    ) : (
                      <Tag color="red" icon={<CloseCircleOutlined />}>
                        {c.message}
                      </Tag>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <Typography.Text strong>动作执行：</Typography.Text>
                {result.actions.map((a) => (
                  <div key={a.id}>
                    {a.executed ? (
                      <Tag color="blue">✓ {a.output || '已执行'}</Tag>
                    ) : (
                      <Tag color="red">✗ {a.error || '执行失败'}</Tag>
                    )}
                  </div>
                ))}
              </div>
            </Space>
          </Card>
        )}
        {!result && !testing && <Empty description="运行后查看测试结果" />}

        <Card
          type="inner"
          size="small"
          title={
            <Space>
              <HistoryOutlined />
              <Typography.Text strong>最近测试历史</Typography.Text>
              <Tag>{history.length}</Tag>
            </Space>
          }
          extra={
            history.length > 0 ? (
              <Button
                size="small"
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={handleClearHistory}
              >
                清空
              </Button>
            ) : null
          }
        >
          {history.length === 0 ? (
            <Empty description="暂无历史记录（本地存储，最多保留 10 条）" />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {history.map((h) => (
                <Card
                  key={h.id}
                  size="small"
                  style={{ background: '#fafafa' }}
                  bodyStyle={{ padding: 8 }}
                >
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                      {h.result.passed ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          通过
                        </Tag>
                      ) : (
                        <Tag color="error" icon={<CloseCircleOutlined />}>
                          失败
                        </Tag>
                      )}
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(h.executedAt).toLocaleString()}
                      </Typography.Text>
                    </Space>
                    <Typography.Text code style={{ fontSize: 12 }}>
                      {JSON.stringify(h.sample)}
                    </Typography.Text>
                  </Space>
                </Card>
              ))}
            </Space>
          )}
        </Card>
      </Space>

      <Modal
        open={saveOpen}
        title="保存为测试用例"
        onCancel={() => setSaveOpen(false)}
        onOk={handleSaveCase}
        confirmLoading={submittingCase}
        destroyOnClose
      >
        <Form form={saveForm} layout="vertical">
          <Form.Item name="name" label="用例名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            将保存为关联规则 <code>{rule.ruleId}</code> 的测试用例；当前样本将作为输入。
          </Typography.Text>
        </Form>
      </Modal>
    </Card>
  );
}
