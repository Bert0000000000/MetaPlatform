import type { ReactNode } from 'react';
import { Card, Empty, Spin, Typography } from 'antd';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ZAxis,
} from 'recharts';
import type { DashboardWidget } from '@/api/pages';
import { useDataSource } from '@/components/DashboardCanvas';

interface ChartWidgetProps {
  widget: DashboardWidget;
}

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

interface ChartRow {
  name?: string;
  value?: number;
  x?: number;
  y?: number;
}

function toChartRows(data: unknown[]): ChartRow[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((item) => {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        name: typeof obj.name === 'string' ? obj.name : String(obj.name ?? ''),
        value: typeof obj.value === 'number' ? obj.value : Number(obj.value ?? 0),
        x: typeof obj.x === 'number' ? obj.x : Number(obj.x ?? 0),
        y: typeof obj.y === 'number' ? obj.y : Number(obj.y ?? 0),
      };
    }
    return { name: String(item), value: 0 };
  });
}

function GaugeView({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, value));
  const cx = 100;
  const cy = 100;
  const radius = 80;
  const angle = 180 - (safeValue / 100) * 180;
  const needleX = cx + radius * Math.cos((angle * Math.PI) / 180);
  const needleY = cy - radius * Math.sin((angle * Math.PI) / 180);
  const arcLength = Math.PI * radius;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
      <svg width={200} height={120} viewBox="0 0 200 120">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#1677ff"
          strokeWidth={12}
          strokeLinecap="round"
          style={{
            strokeDasharray: `${(safeValue / 100) * arcLength} ${arcLength}`,
          }}
        />
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#333" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={4} fill="#333" />
        <text x={cx} y={cy + 24} textAnchor="middle" fontSize={20} fontWeight={700} fill="#1677ff">
          {safeValue}
        </text>
        <text x={20} y={115} textAnchor="middle" fontSize={10} fill="#999">0</text>
        <text x={180} y={115} textAnchor="middle" fontSize={10} fill="#999">100</text>
      </svg>
    </div>
  );
}

export default function ChartWidget({ widget }: ChartWidgetProps) {
  const { data, loading, error } = useDataSource(widget.dataSource);
  const rows = toChartRows(data);
  const hasDataSource = !!widget.dataSource;

  const renderChart = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      );
    }

    let errorBanner: ReactNode = null;
    if (error) {
      errorBanner = (
        <Typography.Text type="warning" style={{ display: 'block', padding: '4px 0' }}>
          {error}
        </Typography.Text>
      );
    }

    let chart: ReactNode;
    switch (widget.type) {
      case 'chart-bar':
        chart = (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1677ff" />
            </BarChart>
          </ResponsiveContainer>
        );
        break;
      case 'chart-line':
        chart = (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#52c41a" />
            </LineChart>
          </ResponsiveContainer>
        );
        break;
      case 'chart-pie':
        chart = (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie data={rows} dataKey="value" nameKey="name" outerRadius={80} label>
                {rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
        break;
      case 'chart-area':
        chart = (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#1677ff" fill="#1677ff" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        );
        break;
      case 'chart-scatter':
        chart = (
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="x" />
              <YAxis dataKey="y" name="y" />
              <ZAxis range={[60, 60]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={rows} fill="#722ed1" />
            </ScatterChart>
          </ResponsiveContainer>
        );
        break;
      case 'gauge': {
        const first = rows[0];
        const value = first?.value ?? 0;
        chart = <GaugeView value={value} />;
        break;
      }
      default:
        chart = <Empty description="未知图表类型" />;
    }

    return (
      <div>
        {errorBanner}
        {chart}
      </div>
    );
  };

  return (
    <Card title={widget.title} size="small">
      {hasDataSource ? renderChart() : <Empty description="未配置数据源" />}
    </Card>
  );
}
