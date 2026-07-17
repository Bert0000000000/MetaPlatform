import { Card, Empty, Typography, Steps, Tabs } from 'antd';

export default function ExecutionDetailPage() {
  return (
    <div>
      <Typography.Title level={4}>执行详情</Typography.Title>
      <Card>
        <Tabs
          items={[
            {
              key: 'detail',
              label: '步骤详情',
              children: (
                <Steps
                  direction="vertical"
                  current={2}
                  items={[
                    { title: '查询员工数据', description: '已完成 - 5s' },
                    { title: '汇总工资', description: '已完成 - 8s' },
                    { title: '生成报表', description: '执行中...' },
                    { title: '邮件通知', description: '待执行' },
                  ]}
                />
              ),
            },
            {
              key: 'logs',
              label: '日志',
              children: <Empty description="无日志" />,
            },
            {
              key: 'metrics',
              label: '指标',
              children: <Empty description="尚无指标" />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
