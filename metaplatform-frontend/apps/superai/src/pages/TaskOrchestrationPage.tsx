import { useState } from 'react';
import { Card, Form, Input, Button, Space, Tag, Typography, Steps, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { detectIntent, generatePlan } from '@/api/schedule';
import type { ScheduleIntent, ExecutionPlan } from '@/api/schedule';

export default function TaskOrchestrationPage() {
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [intent, setIntent] = useState<ScheduleIntent | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDetectIntent = async () => {
    if (!text.trim()) {
      message.warning('请输入任务描述');
      return;
    }
    setLoading(true);
    try {
      const i = await detectIntent(text);
      setIntent(i);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handlePlan = async () => {
    if (!intent) return;
    setLoading(true);
    try {
      const p = await generatePlan(intent.intentId);
      setPlan(p);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>任务编排</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Steps
          current={step}
          items={[
            { title: '任务输入' },
            { title: '意图识别' },
            { title: '执行计划' },
            { title: '执行' },
          ]}
        />
      </Card>

      <Card title="1. 输入任务" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="用一句话描述你的任务">
            <Input.TextArea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例如：每周一早上汇总本团队的销售数据并邮件通知给我"
            />
          </Form.Item>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleDetectIntent}
          >
            识别意图
          </Button>
        </Form>
      </Card>

      {intent && (
        <Card title="2. 意图识别" style={{ marginBottom: 16 }}>
          <Space direction="vertical">
            <Typography.Paragraph>
              <Tag color={intent.detectedIntent === 'scheduled' ? 'blue' : 'green'}>
                {intent.detectedIntent === 'scheduled' ? '定时任务' : '即时任务'}
              </Tag>
              <Typography.Text type="secondary">置信度：</Typography.Text>
              {(intent.confidence * 100).toFixed(1)}%
            </Typography.Paragraph>
            <div>
              <Typography.Text strong>涉及员工：</Typography.Text>
              <Space>
                {intent.detectedEmployees.map((e) => (
                  <Tag key={e} color="purple">{e}</Tag>
                ))}
              </Space>
            </div>
            <Button type="primary" onClick={handlePlan} loading={loading}>
              生成执行计划
            </Button>
          </Space>
        </Card>
      )}

      {plan && (
        <Card title="3. 执行计划">
          <Steps
            direction="vertical"
            size="small"
            current={plan.steps.length}
            items={plan.steps.map((s) => ({
              title: (
                <Space>
                  <span>{s.name}</span>
                  {s.employeeId && <Tag color="purple">{s.employeeId}</Tag>}
                  {s.tool && <Tag color="cyan">{s.tool}</Tag>}
                </Space>
              ),
              description: `预计耗时 ${s.estimatedDuration}s`,
            }))}
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            总预计耗时：{plan.totalEstimatedDuration}s
            {plan.parallelGroups && plan.parallelGroups.length > 0 && '（部分步骤可并行）'}
          </Typography.Paragraph>
          <Button type="primary">开始执行</Button>
        </Card>
      )}
    </div>
  );
}
