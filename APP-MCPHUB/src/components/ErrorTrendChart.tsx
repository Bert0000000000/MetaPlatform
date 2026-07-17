import { useEffect, useState } from 'react';
import { Card, Spin } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getErrorTrend } from '@/api/audit';

export default function ErrorTrendChart() {
  const [data, setData] = useState<Array<{ date: string; errors: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getErrorTrend().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  return (
    <Card title="近 7 天错误趋势" size="small">
      {loading ? (
        <Spin />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="errors" stroke="#f5222d" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
