import { useState } from 'react';
import { Card, Empty, Form, Input, Button, Space, Tag, Typography, Steps, Row, Col, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { generatePlan } from '@/api/schedule';
import type { ExecutionPlan } from '@/api/schedule';

export default function ExecutionPlanPage() {
  const [intent, setIntent] = useState('intent-001');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const p = await generatePlan(intent);
      setPlan(p);
      message.success('执行计划已生成');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>执行计划生成</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item label="意图 ID">
                <Input value={intent} onChange={(e) => setIntent(e.target.value)} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Button
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
              <Steps
                direction="vertical"
                items={plan.steps.map((s) => ({
                  title: s.name,
                  description: (
                    <Space>
                      {s.employeeId && <Tag color="purple">{s.employeeId}</Tag>}
                      {s.tool && <Tag color="cyan">{s.tool}</Tag>}
                      <Tag>{s.estimatedDuration}s</Tag>
                    </Space>
                  ),
                }))}
              />
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
