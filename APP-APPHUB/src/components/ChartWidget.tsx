import { Card, Empty } from 'antd';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { DashboardWidget } from '@/api/pages';

interface ChartWidgetProps {
  widget: DashboardWidget;
}

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

const MOCK_DATA = Array.from({ length: 7 }).map((_, i) => ({
  name: `P${i + 1}`,
  value: Math.floor(Math.random() * 1000),
}));

export default function ChartWidget({ widget }: ChartWidgetProps) {
  const renderChart = () => {
    switch (widget.type) {
      case 'chart-bar':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_DATA}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1677ff" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'chart-line':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MOCK_DATA}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#52c41a" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'chart-pie':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={MOCK_DATA}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                label
              >
                {MOCK_DATA.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return <Empty description="未知图表类型" />;
    }
  };

  return (
    <Card title={widget.title} size="small">
      {widget.dataSource ? renderChart() : <Empty description="未配置数据源" />}
    </Card>
  );
}
