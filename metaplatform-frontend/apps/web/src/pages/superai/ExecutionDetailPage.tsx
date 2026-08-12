import { Card, Empty, Typography, Steps, Tabs, TabPane } from '@douyinfe/semi-ui';

export default function ExecutionDetailPage() {
  return (
    <div>
      <Typography.Title heading={4}>执行详情</Typography.Title>
      <Card>
        <Tabs
          tabList={[
            { itemKey: 'detail', tab: '步骤详情' },
            { itemKey: 'logs', tab: '日志' },
            { itemKey: 'metrics', tab: '指标' },
          ]}
        >
          <TabPane itemKey="detail">
            <Steps
              direction="vertical"
              current={2}
            >
              <Steps.Step title="查询员工数据" description="已完成 - 5s" />
              <Steps.Step title="汇总工资" description="已完成 - 8s" />
              <Steps.Step title="生成报表" description="执行中..." />
              <Steps.Step title="邮件通知" description="待执行" />
            </Steps>
          </TabPane>
          <TabPane itemKey="logs">
            <Empty description="无日志" />
          </TabPane>
          <TabPane itemKey="metrics">
            <Empty description="尚无指标" />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
