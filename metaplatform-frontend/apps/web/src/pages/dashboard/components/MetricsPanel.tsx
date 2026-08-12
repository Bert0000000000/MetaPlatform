import { useEffect, useState } from 'react';
import { Card, Row, Col, Radio, Spin, Modal, Button, Space, Tooltip, Typography } from '@douyinfe/semi-ui';
import {
  TeamOutlined,
  ApartmentOutlined,
  ApiOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ExpandOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from 'recharts';
import { getMetricCards, getMetricTrend } from '@/api/dashboard/metrics';
import type { MetricCard, MetricTrendPoint, TimeRange } from '@/api/dashboard/types';

const { Text } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  team: <TeamOutlined />,
  workflow: <ApartmentOutlined />,
  api: <ApiOutlined />,
  error: <WarningOutlined />,
};

interface ChartDatum {
  time: string;
  rawTime: string;
  apiCalls: number;
  errors: number;
  value: number;
}

/**
 * 自定义 Tooltip：详细展示 API 调用 / 错误数 / 指标值，并附带时间原文，
 * 满足 V14-02 "图表 Tooltip 详情展示" 要求。
 */
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const find = (key: string) => payload.find((p) => p.dataKey === key)?.value as number | undefined;
  const apiCalls = find('apiCalls');
  const errors = find('errors');
  const value = find('value');
  const errorRate = apiCalls && apiCalls > 0 ? ((errors ?? 0) / apiCalls) * 100 : 0;
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        fontSize: 12,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', marginBottom: 2 }}>
        <span>API 调用</span>
        <span style={{ fontWeight: 600 }}>{apiCalls?.toLocaleString() ?? '-'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--destructive)', marginBottom: 2 }}>
        <span>错误数</span>
        <span style={{ fontWeight: 600 }}>{errors?.toLocaleString() ?? '-'}</span>
      </div>
      {value !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', marginBottom: 2 }}>
          <span>指标值</span>
          <span style={{ fontWeight: 600 }}>{value.toLocaleString()}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', borderTop: '1px dashed var(--border)', paddingTop: 4, marginTop: 4 }}>
        <span>错误率</span>
        <span>{errorRate.toFixed(2)}%</span>
      </div>
    </div>
  );
}

function ChartContent({ data, height }: { data: ChartDatum[]; height: number | string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" fontSize={11} />
        <YAxis fontSize={11} />
        <RechartsTooltip content={<ChartTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="apiCalls" stroke="var(--primary)" name="API 调用" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="errors" stroke="var(--destructive)" name="错误数" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// 指标卡片（Statistic 无 Semi 等价物，自建 label + 大数字）
function Stat({ title, value, prefix, suffix, valueStyle }: { title: string; value: number | string; prefix?: React.ReactNode; suffix?: React.ReactNode; valueStyle?: React.CSSProperties }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8, ...valueStyle }}>
        {prefix}
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix}
      </div>
    </div>
  );
}

export default function MetricsPanel() {
  const [cards, setCards] = useState<MetricCard[]>([]);
  const [trend, setTrend] = useState<MetricTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<TimeRange>('24h');
  const [fullscreen, setFullscreen] = useState(false);

  // Guard against non-array backend responses / HMR stale state.
  const safeCards = Array.isArray(cards) ? cards : [];
  const safeTrend = Array.isArray(trend) ? trend : [];

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

  const chartData: ChartDatum[] = safeTrend.map((p) => ({
    time: new Date(p.time).toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }),
    rawTime: p.time,
    apiCalls: p.apiCalls,
    errors: p.errors,
    value: p.value,
  }));

  const rangeLabel = (() => {
    switch (range) {
      case '24h':
        return '今日';
      case '7d':
        return '近 7 天';
      case '30d':
        return '近 30 天';
      default:
        return '近 1 小时';
    }
  })();

  const headerExtra = (
    <Space spacing="tight">
      <Tooltip content="刷新">
        <Button theme="borderless" size="small" icon={<ReloadOutlined />} onClick={() => load(range)} />
      </Tooltip>
      <Radio.Group
        type="button"
        options={[
          { label: '今日', value: '24h' },
          { label: '近 7 天', value: '7d' },
          { label: '近 30 天', value: '30d' },
        ]}
        value={range === '1h' ? '24h' : range}
        onChange={(e) => setRange(e.target.value as TimeRange)}
      />
      <Tooltip content="全屏展开">
        <Button theme="borderless" size="small" icon={<ExpandOutlined />} onClick={() => setFullscreen(true)} />
      </Tooltip>
    </Space>
  );

  return (
    <>
      <Card title="平台指标" headerExtraContent={headerExtra}>
        <Spin spinning={loading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {safeCards.map((card) => (
              <Col span={6} key={card.key}>
                <Card
                  bodyStyle={{ padding: 16 }}
                  style={{ height: '100%', boxShadow: 'none', border: '1px solid var(--border)' }}
                >
                  <Stat
                    title={card.label}
                    value={card.value}
                    suffix={card.unit}
                    prefix={ICON_MAP[card.icon]}
                    valueStyle={{ fontSize: 28 }}
                  />
                  <div style={{ fontSize: 12, color: card.trendUp ? 'var(--success)' : 'var(--destructive)' }}>
                    {card.trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {card.trend}% 较上期
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          <div style={{ height: 300 }}>
            <ChartContent data={chartData} height={300} />
          </div>
        </Spin>
      </Card>

      <Modal
        title={
          <Space>
            <Text strong>平台指标趋势</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {rangeLabel} · 共 {chartData.length} 个采样点
            </Text>
          </Space>
        }
        visible={fullscreen}
        onCancel={() => setFullscreen(false)}
        footer={null}
        width="90vw"
        style={{ top: 20 }}
      >
        <Spin spinning={loading}>
          <div style={{ height: '70vh', minHeight: 360 }}>
            <ChartContent data={chartData} height="70vh" />
          </div>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            提示：在全屏视图中可观察更细致的趋势波动；悬浮数据点查看完整指标详情（API 调用 / 错误数 / 错误率）。
          </Text>
        </Spin>
      </Modal>
    </>
  );
}
