import { Card } from 'antd';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface TrendChartProps {
  data: Array<{ date: string; score: number }>;
  title?: string;
  dataKey?: string;
}

export default function TrendChart({ data, title = '近 7 天质量趋势', dataKey = 'score' }: TrendChartProps) {
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke="#1677ff" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
