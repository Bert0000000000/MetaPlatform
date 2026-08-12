import { useState } from 'react';
import { Card, Form, Input, Button, Space, Tag, Typography, Steps, Toast } from '@douyinfe/semi-ui';
import { ThunderboltOutlined } from '@ant-design/icons';
import { detectIntent, generatePlan } from '@/api/superai/schedule';
import type { ScheduleIntent, ExecutionPlan } from '@/api/superai/schedule';

export default function TaskOrchestrationPage() {
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<ScheduleIntent | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDetectIntent = async () => {
    const text = String(form.getValues().taskDesc ?? '');
    if (!text.trim()) {
      Toast.warning('请输入任务描述');
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
      <Typography.Title heading={4}>任务编排</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Steps current={step}>
          <Steps.Step title="任务输入" />
          <Steps.Step title="意图识别" />
          <Steps.Step title="执行计划" />
          <Steps.Step title="执行" />
        </Steps>
      </Card>

      <Card title="1. 输入任务" style={{ marginBottom: 16 }}>
        <Form form={form}>
          <Form.TextArea
            field="taskDesc"
            label="用一句话描述你的任务"
            rows={3}
            initValue=""
            placeholder="例如：每周一早上汇总本团队的销售数据并邮件通知给我"
          />
          <Button
            theme="solid"
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
          <Space vertical>
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
            <Button theme="solid" type="primary" onClick={handlePlan} loading={loading}>
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
          >
            {plan.steps.map((s) => (
              <Steps.Step
                key={s.id}
                title={(
                  <Space>
                    <span>{s.name}</span>
                    {s.employeeId && <Tag color="purple">{s.employeeId}</Tag>}
                    {s.tool && <Tag color="cyan">{s.tool}</Tag>}
                  </Space>
                )}
                description={`预计耗时 ${s.estimatedDuration}s`}
              />
            ))}
          </Steps>
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            总预计耗时：{plan.totalEstimatedDuration}s
            {plan.parallelGroups && plan.parallelGroups.length > 0 && '（部分步骤可并行）'}
          </Typography.Paragraph>
          <Button theme="solid" type="primary">开始执行</Button>
        </Card>
      )}
    </div>
  );
}
