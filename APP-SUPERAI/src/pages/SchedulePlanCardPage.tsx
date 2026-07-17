import { Card, Empty, Space, Steps, Tag, Typography } from 'antd';
import type { ExecutionPlan } from '@/api/schedule';

const PLAN: ExecutionPlan = {
  planId: 'demo-plan',
  intentId: 'demo-intent',
  steps: [
    { id: 's1', name: '查询员工数据', employeeId: 'hr-bot', tool: 'query_database', estimatedDuration: 5 },
    { id: 's2', name: '汇总工资总额', employeeId: 'finance-bot', estimatedDuration: 8 },
    { id: 's3', name: '生成报表', employeeId: 'default-bot', estimatedDuration: 3 },
    { id: 's4', name: '邮件通知', employeeId: 'default-bot', tool: 'send_email', estimatedDuration: 2 },
  ],
  totalEstimatedDuration: 18,
  parallelGroups: [{ groupId: 'g1', stepIds: ['s1', 's2'] }],
  createdAt: new Date().toISOString(),
};

export default function SchedulePlanCardPage() {
  return (
    <div>
      <Typography.Title level={4}>调度计划卡片</Typography.Title>
      <Card title={`计划 #${PLAN.planId}`} style={{ maxWidth: 720 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Tag color="blue">{(PLAN.parallelGroups?.length || 0) > 0 ? '混合' : '顺序'}</Tag>
            <Typography.Text type="secondary">
              预计耗时 {PLAN.totalEstimatedDuration}s · {PLAN.steps.length} 步
            </Typography.Text>
          </div>
          <Steps
            direction="vertical"
            size="small"
            items={PLAN.steps.map((s) => ({
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
        </Space>
      </Card>
      <Empty description="这是示例卡片，实际生成的计划卡可见执行计划页" style={{ marginTop: 32 }} />
    </div>
  );
}
