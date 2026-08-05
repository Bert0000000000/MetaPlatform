/**
 * 通用分布条形图（来源 / 地域 / 设备）
 * Recharts BarChart + layout="vertical" 实现横向条形图，
 * 显示前 N 项，并在右侧展示占比和绝对值。
 */
import { Space, Tag, Typography } from 'antd';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { DistributionItem } from '@/types/analytics';

interface Props {
  title: string;
  data: DistributionItem[];
  /** 前 N 项，默认全部 */
  topN?: number;
  /** 颜色：按比例从主色过渡到 success 色 */
  color?: string;
  loading?: boolean;
  height?: number;
}

const COLORS = ['#60a5fa', '#62d178', '#eab308', '#f472b6', '#a78bfa', '#34d399', '#fb923c'];

function BarTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload as DistributionItem | undefined;
  if (!item) return null;
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        color: 'var(--foreground)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.32)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', minWidth: 140 }}>
        <span style={{ color: 'var(--muted-foreground)' }}>数值</span>
        <span style={{ fontWeight: 600 }}>{item.value.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>占比</span>
        <span style={{ fontWeight: 600 }}>{(item.ratio * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function DistributionCard({
  title,
  data,
  topN = 5,
  loading = false,
  height = 220,
}: Props) {
  const safeData = Array.isArray(data) ? data : [];
  const sliced = safeData.slice(0, topN);
  const total = sliced.reduce((acc, it) => acc + it.value, 0);
  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={8}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {title}
        </Typography.Text>
        <Tag color="default">Top {sliced.length}</Tag>
      </div>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            加载中…
          </Typography.Text>
        </div>
      ) : sliced.length === 0 ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            暂无数据
          </Typography.Text>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sliced}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={70}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  stroke="var(--border)"
                />
                <Tooltip
                  content={<BarTip />}
                  cursor={{ fill: 'var(--muted)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {sliced.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Space size={6} wrap>
            {sliced.map((it, idx) => (
              <Tag key={it.key} color="default" style={{ fontSize: 11 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: COLORS[idx % COLORS.length],
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                {it.label}{' '}
                <span style={{ color: 'var(--muted-foreground)' }}>
                  {total > 0 ? ((it.value / total) * 100).toFixed(1) : 0}%
                </span>
              </Tag>
            ))}
          </Space>
        </>
      )}
    </Space>
  );
}
