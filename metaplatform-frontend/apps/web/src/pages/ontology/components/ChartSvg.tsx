// ChartSvg - 纯 SVG 图表（L6：分析工作台 / 仪表盘共用渲染，零第三方库）。
//
// 三种形态：
//   bar  柱状图 —— 维度为 X 轴、度量值映射条高；<title> hover 精确值
//   pie  饼图   —— 维度占比（SVG arc path）；扇区 <title> + 精简图例
//   line 趋势线 —— 折线 + 数据点（date/timestamp 维度由调用方排序）
//
// viewBox + width:100% 自适应：分析工作台大图与仪表盘迷你卡片共用一套渲染。
// 纪律：只用 CSS 变量 + 固定色板（明暗主题均可读），不引第三方图表库。

import type { ReactElement } from 'react';

export type ChartType = 'bar' | 'pie' | 'line';

export interface ChartDatum {
  /** 维度值（字符串化）。 */
  label: string;
  /** 度量值。 */
  value: number;
  /** hover 精确值文本（缺省用 value 格式化）。 */
  exact?: string;
}

/** 明暗主题均可读的分类色板。 */
export const CHART_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
  '#ef4444', '#f97316', '#ec4899', '#84cc16', '#6366f1',
  '#14b8a6', '#eab308',
];

/** 图表数值格式化（大数缩写，小数最多 2 位）。 */
export function formatChartNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function fmtValue(d: ChartDatum): string {
  return d.exact ?? formatChartNumber(d.value);
}

function placeholder(W: number, H: number, text: string): ReactElement {
  return (
    <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle"
      fontSize={12} fill="var(--muted-foreground)">
      {text}
    </text>
  );
}

interface SubProps {
  data: ChartDatum[];
  W: number;
  H: number;
  mini: boolean;
}

// ── 柱状图 ──

function BarChart({ data, W, H, mini }: SubProps): ReactElement {
  const padL = mini ? 36 : 48;
  const padR = mini ? 8 : 12;
  const padT = mini ? 8 : 14;
  const padB = mini ? 30 : 46;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const max = Math.max(...data.map((d) => d.value), 0);
  if (max <= 0) return placeholder(W, H, '全部为 0');

  const slot = iw / data.length;
  const barW = Math.min(slot * 0.62, mini ? 16 : 44);
  const ticks = 4;
  const labelEvery = Math.max(1, Math.ceil(data.length / (mini ? 6 : 16)));
  const rotate = slot < (mini ? 28 : 46);
  const els: ReactElement[] = [];

  // 横向网格 + 纵轴刻度
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = padT + ih - (ih * i) / ticks;
    els.push(
      <line key={`grid${i}`} x1={padL} y1={y} x2={W - padR} y2={y}
        stroke="var(--border)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 3'} />,
    );
    els.push(
      <text key={`tick${i}`} x={padL - 6} y={y} textAnchor="end" dominantBaseline="middle"
        fontSize={mini ? 8 : 10} fill="var(--muted-foreground)">
        {formatChartNumber(v)}
      </text>,
    );
  }

  // 条形 + X 轴标签（labelEvery 抽稀；slot 窄时旋转）
  data.forEach((d, i) => {
    const h = (d.value / max) * ih;
    const x = padL + slot * i + (slot - barW) / 2;
    const y = padT + ih - h;
    els.push(
      <rect key={`bar${i}`} x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 1 : 0)}
        fill={CHART_PALETTE[i % CHART_PALETTE.length]} rx={mini ? 2 : 3}>
        <title>{`${d.label}：${fmtValue(d)}`}</title>
      </rect>,
    );
    if (i % labelEvery === 0) {
      const lx = padL + slot * i + slot / 2;
      const ly = padT + ih + (mini ? 10 : 14);
      if (rotate) {
        els.push(
          <text key={`lab${i}`} x={lx - 3} y={ly} fontSize={mini ? 8 : 10}
            fill="var(--muted-foreground)" textAnchor="end"
            transform={`rotate(-32 ${lx - 3} ${ly})`}>
            {trunc(d.label, mini ? 6 : 10)}
          </text>,
        );
      } else {
        els.push(
          <text key={`lab${i}`} x={lx} y={ly} fontSize={mini ? 8 : 10}
            fill="var(--muted-foreground)" textAnchor="middle">
            {trunc(d.label, mini ? 6 : 12)}
          </text>,
        );
      }
    }
  });
  return <>{els}</>;
}

// ── 饼图 ──

function polar(cx: number, cy: number, r: number, ang: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
}

function PieChart({ data, W, H, mini }: SubProps): ReactElement {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return placeholder(W, H, '全部为 0');

  const r = Math.min(H * 0.36, W * (mini ? 0.24 : 0.2));
  const cx = W * (mini ? 0.26 : 0.24);
  const cy = H / 2;
  const legendX = cx + r + (mini ? 14 : 30);
  const legendMax = mini ? 5 : 8;

  // 图例按占比降序（超出合并「其他」），颜色跟原始索引
  const sorted = data
    .map((d, idx) => ({ d, idx }))
    .sort((a, b) => b.d.value - a.d.value);
  const legendItems: Array<{ label: string; pct: number; color: string }> = sorted
    .slice(0, legendMax)
    .map(({ d, idx }) => ({
      label: d.label,
      pct: (d.value / total) * 100,
      color: CHART_PALETTE[idx % CHART_PALETTE.length],
    }));
  if (sorted.length > legendMax) {
    const rest = sorted.slice(legendMax).reduce((s, { d }) => s + d.value, 0);
    legendItems.push({
      label: `其他 ${sorted.length - legendMax} 项`,
      pct: (rest / total) * 100,
      color: 'var(--muted-foreground)',
    });
  }
  const itemH = mini ? 15 : 20;
  const legendY0 = cy - ((legendItems.length - 1) * itemH) / 2;

  // 扇区（占比 100% 时退化为整圆）
  const els: ReactElement[] = [];
  let a0 = -Math.PI / 2;
  data.forEach((d, i) => {
    const frac = d.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    const title = `${d.label}：${fmtValue(d)}（${(frac * 100).toFixed(1)}%）`;
    if (frac >= 1) {
      els.push(<circle key={`slice${i}`} cx={cx} cy={cy} r={r} fill={color}><title>{title}</title></circle>);
    } else {
      const p0 = polar(cx, cy, r, a0);
      const p1 = polar(cx, cy, r, a1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      els.push(
        <path key={`slice${i}`}
          d={`M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`}
          fill={color} stroke="var(--card)" strokeWidth={1}>
          <title>{title}</title>
        </path>,
      );
    }
    a0 = a1;
  });

  legendItems.forEach((it, i) => {
    const ly = legendY0 + i * itemH;
    els.push(
      <g key={`legend${i}`}>
        <rect x={legendX} y={ly - (mini ? 4 : 5)} width={mini ? 8 : 10} height={mini ? 8 : 10}
          rx={2} fill={it.color} />
        <text x={legendX + (mini ? 12 : 16)} y={ly} dominantBaseline="middle"
          fontSize={mini ? 9 : 11} fill="var(--muted-foreground)">
          {trunc(it.label, mini ? 8 : 14)}
        </text>
        <text x={W - 4} y={ly} textAnchor="end" dominantBaseline="middle"
          fontSize={mini ? 9 : 11} fill="var(--foreground)" fontWeight={600}>
          {`${it.pct.toFixed(0)}%`}
        </text>
      </g>,
    );
  });
  return <>{els}</>;
}

// ── 趋势线 ──

function LineChart({ data, W, H, mini }: SubProps): ReactElement {
  const padL = mini ? 36 : 48;
  const padR = mini ? 10 : 14;
  const padT = mini ? 10 : 16;
  const padB = mini ? 28 : 40;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const vals = data.map((d) => d.value);
  let vMin = Math.min(...vals);
  let vMax = Math.max(...vals);
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const pad = (vMax - vMin) * 0.08;
  vMin -= pad;
  vMax += pad;

  const xAt = (i: number): number =>
    data.length === 1 ? padL + iw / 2 : padL + (iw * i) / (data.length - 1);
  const yAt = (v: number): number => padT + ih - ((v - vMin) / (vMax - vMin)) * ih;

  const els: ReactElement[] = [];
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = vMin + ((vMax - vMin) * i) / ticks;
    const y = yAt(v);
    els.push(
      <line key={`grid${i}`} x1={padL} y1={y} x2={W - padR} y2={y}
        stroke="var(--border)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 3'} />,
    );
    els.push(
      <text key={`tick${i}`} x={padL - 6} y={y} textAnchor="end" dominantBaseline="middle"
        fontSize={mini ? 8 : 10} fill="var(--muted-foreground)">
        {formatChartNumber(v)}
      </text>,
    );
  }

  els.push(
    <polyline key="line"
      points={data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(' ')}
      fill="none" stroke="var(--primary)" strokeWidth={mini ? 1.6 : 2}
      strokeLinejoin="round" strokeLinecap="round" />,
  );
  data.forEach((d, i) => {
    els.push(
      <circle key={`pt${i}`} cx={xAt(i)} cy={yAt(d.value)} r={mini ? 2.5 : 3.5}
        fill="var(--primary)" stroke="var(--card)" strokeWidth={1.5}>
        <title>{`${d.label}：${fmtValue(d)}`}</title>
      </circle>,
    );
  });

  // X 轴标签：首 / 中 / 尾（趋势维度通常是时间序）
  const labelIdx = data.length <= 2
    ? data.map((_, i) => i)
    : [0, Math.floor((data.length - 1) / 2), data.length - 1];
  labelIdx.forEach((i) => {
    els.push(
      <text key={`lab${i}`} x={xAt(i)} y={padT + ih + (mini ? 10 : 14)}
        fontSize={mini ? 8 : 10} fill="var(--muted-foreground)"
        textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
        {trunc(data[i].label, mini ? 7 : 12)}
      </text>,
    );
  });
  return <>{els}</>;
}

interface Props {
  type: ChartType;
  data: ChartDatum[];
  /** viewBox 逻辑宽（分析大图默认 720；迷你卡片传 320）。 */
  baseWidth?: number;
  /** viewBox 逻辑高（分析大图默认 300；迷你卡片传 190）。 */
  height?: number;
  /** 迷你模式（仪表盘卡片）：更紧凑的留白 / 字号 / 图例数。 */
  mini?: boolean;
}

export default function ChartSvg({
  type, data, baseWidth = 720, height = 300, mini = false,
}: Props): ReactElement {
  return (
    <svg viewBox={`0 0 ${baseWidth} ${height}`} width="100%" height={height}
      style={{ display: 'block' }} role="img">
      {data.length === 0
        ? placeholder(baseWidth, height, '暂无数据')
        : type === 'bar'
          ? <BarChart data={data} W={baseWidth} H={height} mini={mini} />
          : type === 'pie'
            ? <PieChart data={data} W={baseWidth} H={height} mini={mini} />
            : <LineChart data={data} W={baseWidth} H={height} mini={mini} />}
    </svg>
  );
}
