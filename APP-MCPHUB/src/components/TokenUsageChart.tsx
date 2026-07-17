import { useEffect, useState } from 'react';
import { Card, Spin } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getTokenUsageByDay } from '@/api/audit';

export default function TokenUsageChart() {
  const [data, setData] = useState<Array<{ date: string; tokens: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTokenUsageByDay().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  return (
    <Card title="近 7 天 Token 使用" size="small">
      {loading ? (
        <Spin />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="tokens" fill="#1677ff" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
