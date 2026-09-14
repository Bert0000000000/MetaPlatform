import { Card, Typography } from '@douyinfe/semi-ui';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { EmptyState } from '@/components/skeleton';

interface TrendChartProps {
  data: Array<{ date: string; score: number }>;
  title?: string;
  dataKey?: string;
}

/**
 * 质量趋势折线图（recharts）。
 *
 * 只承载「按天的质量分」这一条真实时间序列；颜色一律取 DSM 主题令牌，
 * 不在 JSX 上写任何 inline style（几何/描边走 recharts 的组件属性）。
 * 无数据时给 EmptyState，而不是画一条空轴。
 */
export default function TrendChart({
  data,
  title = '近 7 天质量趋势',
  dataKey = 'score',
}: TrendChartProps) {
  return (
    <Card title={title}>
      {data.length === 0 ? (
        <EmptyState
          illustration="no-content"
          title="暂无质量趋势"
          desc="该员工产生评分数据后，趋势会出现在这里。"
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--semi-color-border)" />
              <XAxis dataKey="date" stroke="var(--semi-color-text-2)" />
              <YAxis domain={[0, 1]} stroke="var(--semi-color-text-2)" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="var(--semi-color-primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <Typography.Paragraph type="tertiary" size="small">
            纵轴为归一化质量分（0–1），数据来自后端 quality-trend 接口。
          </Typography.Paragraph>
        </>
      )}
    </Card>
  );
}
