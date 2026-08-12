import { useState } from 'react';
import { Card, Empty, Form, Input, Button, Space, Tag, Typography, Steps, Toast } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { ThunderboltOutlined } from '@ant-design/icons';
import { generatePlan } from '@/api/superai/schedule';
import type { ExecutionPlan } from '@/api/superai/schedule';

export default function ExecutionPlanPage() {
  const [form] = Form.useForm();
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const intent = String(form.getValues().intent ?? 'intent-001');
      const p = await generatePlan(intent);
      setPlan(p);
      Toast.success('执行计划已生成');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography.Title heading={4}>执行计划生成</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form}>
          <Row gutter={16}>
            <Col span={18}>
              <Form.Input
                field="intent"
                label="意图 ID"
                initValue="intent-001"
                placeholder="请输入意图 ID"
              />
            </Col>
            <Col span={6}>
              <Button
                theme="solid"
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={loading}
                onClick={handleGenerate}
                block
                style={{ marginTop: 30 }}
              >
                生成计划
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      {plan ? (
        <Row gutter={16}>
          <Col span={16}>
            <Card title="计划步骤">
              <Steps direction="vertical">
                {plan.steps.map((s) => (
                  <Steps.Step
                    key={s.id}
                    title={s.name}
                    description={(
                      <Space>
                        {s.employeeId && <Tag color="purple">{s.employeeId}</Tag>}
                        {s.tool && <Tag color="cyan">{s.tool}</Tag>}
                        <Tag>{s.estimatedDuration}s</Tag>
                      </Space>
                    )}
                  />
                ))}
              </Steps>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="摘要">
              <Typography.Paragraph>
                步骤数：{plan.steps.length}
              </Typography.Paragraph>
              <Typography.Paragraph>
                预计耗时：{plan.totalEstimatedDuration}s
              </Typography.Paragraph>
              <Typography.Paragraph>
                并行组：{plan.parallelGroups?.length || 0}
              </Typography.Paragraph>
            </Card>
          </Col>
        </Row>
      ) : (
        <Empty description="生成计划后查看" />
      )}
    </div>
  );
}
