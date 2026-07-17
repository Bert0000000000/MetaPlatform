import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Segmented, Spin } from 'antd';
import {
  TeamOutlined,
  ApartmentOutlined,
  ApiOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getMetricCards, getMetricTrend } from '@/api/metrics';
import type { MetricCard, MetricTrendPoint, TimeRange } from '@/types';

const ICON_MAP: Record<string, React.ReactNode> = {
  team: <TeamOutlined />,
  workflow: <ApartmentOutlined />,
  api: <ApiOutlined />,
  error: <WarningOutlined />,
};

export default function MetricsPanel() {
  const [cards, setCards] = useState<MetricCard[]>([]);
  const [trend, setTrend] = useState<MetricTrendPoint[]>([]);
  const [range, setRange] = useState<TimeRange>('24h');
  const [loading, setLoading] = useState(false);

  const load = async (r: TimeRange) => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([getMetricCards(), getMetricTrend(r)]);
      setCards(c);
      setTrend(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
  }, [range]);

  const chartData = trend.map((p) => ({
    time: new Date(p.time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'short' }),
    apiCalls: p.apiCalls,
    errors: p.errors,
    value: p.value,
  }));

  return (
    <Card
      title="平台指标"
      extra={
        <Segmented
          options={[
            { label: '1小时', value: '1h' },
            { label: '24小时', value: '24h' },
            { label: '7天', value: '7d' },
            { label: '30天', value: '30d' },
          ]}
          value={range}
          onChange={(v) => setRange(v as TimeRange)}
        />
      }
    >
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {cards.map((card) => (
            <Col span={6} key={card.key}>
              <Card size="small">
                <Statistic
                  title={card.label}
                  value={card.value}
                  suffix={card.unit}
                  prefix={ICON_MAP[card.icon]}
                  valueStyle={{ fontSize: 28 }}
                />
                <div style={{ fontSize: 12, color: card.trendUp ? '#52c41a' : '#f5222d' }}>
                  {card.trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {card.trend}% 较上期
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="apiCalls" stroke="#1677ff" name="API 调用" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="errors" stroke="#f5222d" name="错误数" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Spin>
    </Card>
  );
}
