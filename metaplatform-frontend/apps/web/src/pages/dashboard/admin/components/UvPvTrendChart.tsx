/**
 * UV / PV / 申请数 30 天趋势折线图
 * 三条线：UV（蓝） / PV（绿） / 申请数（黄）
 * 自定义 Tooltip：同时显示三条线的当日数值。
 */
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { UvPvTrendPoint } from '@/types/analytics';

interface Props {
  data: UvPvTrendPoint[];
  height?: number;
}

interface ChartDatum extends UvPvTrendPoint {
  // 短日期 MM-DD，避免 X 轴太密
  shortDate: string;
}

const COLOR_UV = '#60a5fa'; // 蓝 (--info)
const COLOR_PV = '#62d178'; // 绿 (--success)
const COLOR_APP = '#eab308'; // 黄 (--warning)

function formatDateLabel(date: string): string {
  // YYYY-MM-DD -> MM-DD
  return date.length >= 10 ? date.slice(5) : date;
}

function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const uv = payload.find((p) => p.dataKey === 'uv')?.value as number | undefined;
  const pv = payload.find((p) => p.dataKey === 'pv')?.value as number | undefined;
  const app = payload.find((p) => p.dataKey === 'applications')?.value as number | undefined;
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.32)',
        fontSize: 12,
        minWidth: 200,
        color: 'var(--foreground)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLOR_UV, marginBottom: 2 }}>
        <span>UV</span>
        <span style={{ fontWeight: 600 }}>{(uv ?? 0).toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLOR_PV, marginBottom: 2 }}>
        <span>PV</span>
        <span style={{ fontWeight: 600 }}>{(pv ?? 0).toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLOR_APP }}>
        <span>申请数</span>
        <span style={{ fontWeight: 600 }}>{(app ?? 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function UvPvTrendChart({ data, height = 300 }: Props) {
  const chartData: ChartDatum[] = data.map((p) => ({
    ...p,
    shortDate: formatDateLabel(p.date),
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="shortDate"
            fontSize={11}
            stroke="var(--muted-foreground)"
            interval="preserveStartEnd"
          />
          <YAxis fontSize={11} stroke="var(--muted-foreground)" />
          <Tooltip content={<TrendTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
          <Line
            type="monotone"
            dataKey="uv"
            stroke={COLOR_UV}
            name="UV"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="pv"
            stroke={COLOR_PV}
            name="PV"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="applications"
            stroke={COLOR_APP}
            name="申请数"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
