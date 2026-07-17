import { Card, Empty, Typography } from 'antd';
import { aggregateResults } from '@/api/schedule';

export default function ResultAggregationPage() {
  return (
    <div>
      <Typography.Title level={4}>结果汇聚</Typography.Title>
      <Card>
        <Empty description="没有正在汇聚的执行" />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          系统会在所有子任务完成后自动汇聚，最终生成结构化报告并触发下一步操作。
        </Typography.Paragraph>
        <Typography.Paragraph>
          可用 API：<code>POST /v1/superai/schedule/aggregate</code>
        </Typography.Paragraph>
        <Typography.Paragraph code>
          {JSON.stringify({ function: 'aggregateResults', args: ['execution-id'] }, null, 2)}
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
