/**
 * 通用分布条形图（来源 / 地域 / 设备）
 * Recharts BarChart + layout="vertical" 实现横向条形图，
 * 显示前 N 项，并在右侧展示占比和绝对值。
 */
import { Space, Tag, Typography } from '@douyinfe/semi-ui';
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
import '../admin.css';

const { Text } = Typography;

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
      className="mp-border mp-text-sm mp-text-1 mp-py-2 mp-px-3 mp-bg-1 mp-rounded mp-admin-tooltip"
    >
      <div className="mp-fw-600 mp-mb-1">{item.label}</div>
      <div className="mp-flex mp-justify-between mp-admin-min-w-140">
        <span className="mp-text-2">数值</span>
        <span className="mp-fw-600">{item.value.toLocaleString()}</span>
      </div>
      <div className="mp-flex mp-justify-between">
        <span className="mp-text-2">占比</span>
        <span className="mp-fw-600">{(item.ratio * 100).toFixed(1)}%</span>
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
    <Space vertical className="mp-w-full" spacing={8}>
      <div className="mp-justify-between mp-flex-center">
        <Text strong className="mp-text-md">
          {title}
        </Text>
        <Tag color="grey">Top {sliced.length}</Tag>
      </div>
      {loading ? (
        <div className="mp-flex-center mp-justify-center" style={{ height }}>
          <Text type="secondary" className="mp-text-sm">
            加载中…
          </Text>
        </div>
      ) : sliced.length === 0 ? (
        <div className="mp-flex-center mp-justify-center" style={{ height }}>
          <Text type="secondary" className="mp-text-sm">
            暂无数据
          </Text>
        </div>
      ) : (
        <>
          <div className="mp-w-full" style={{ height }}>
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
                  tick={{ fontSize: 12, fill: 'var(--semi-color-text-2)' }}
                  stroke="var(--semi-color-border)"
                />
                <Tooltip
                  content={<BarTip />}
                  cursor={{ fill: 'var(--semi-color-fill-0)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {sliced.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Space spacing={6} wrap>
            {sliced.map((it, idx) => (
              <Tag key={it.key} color="grey" className="mp-text-xs">
                <span
                  className="mp-mr-1 mp-icon-12 mp-rounded-sm" style={{ display: 'inline-block', background: COLORS[idx % COLORS.length], verticalAlign: 'middle' }}
                />
                {it.label}{' '}
                <span className="mp-text-2">
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
