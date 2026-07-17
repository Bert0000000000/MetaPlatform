import { useState } from 'react';
import { Button, Card, Empty, Input, Space, Tag, Typography, message } from 'antd';
import { PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { testRule } from '@/api/rules';
import type { OntologyRule } from '@/api/rules';

interface TestRunnerProps {
  rule: OntologyRule;
}

export default function TestRunner({ rule }: TestRunnerProps) {
  const [sampleInput, setSampleInput] = useState(
    '{\n  "amount": 1500,\n  "status": "pending"\n}',
  );
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof testRule>> | null>(null);

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
    } finally {
      setTesting(false);
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
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={testing}
          onClick={handleRun}
        >
          运行
        </Button>

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
      </Space>
    </Card>
  );
}
