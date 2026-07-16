/**
 * ReportEditor — dashboard / report editor.
 *
 * "Systematic Rhythm" design: clean, neutral, unified.
 * Chart colors use the same #94a3b8 gray as the process designer.
 */
import { useState, useEffect } from "react";
import { appDatasetsApi, type AppDataset } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3, LineChart, PieChart, Activity, Table2,
  Gauge, Filter, AreaChart, Trash2, Settings,
  LayoutDashboard, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell,
  AreaChart as ReAreaChart, Area,
  RadialBarChart, RadialBar,
  FunnelChart, Funnel,
  ResponsiveContainer, Legend,
} from "recharts";
import { GridLayout, SpanSelector, type GridItem, type GridSpan } from "./GridLayout";
import type { BaseEditorProps, PageComponent } from "./types";

// ── Widget types ──
interface WidgetItem {
  id: string;
  type: string;
  title: string;
  span: GridSpan;
}

const WIDGET_PALETTE = [
  { type: "kpi",   label: "KPI 指标卡", icon: Activity },
  { type: "bar",   label: "柱状图",     icon: BarChart3 },
  { type: "line",  label: "折线图",     icon: LineChart },
  { type: "pie",   label: "饼图",       icon: PieChart },
  { type: "area",  label: "面积图",     icon: AreaChart },
  { type: "table", label: "数据表格",   icon: Table2 },
  { type: "gauge", label: "仪表盘",     icon: Gauge },
  { type: "funnel",label: "漏斗图",     icon: Filter },
];

const DEFAULT_WIDGETS: WidgetItem[] = [
  { id: "w-kpi-1", type: "kpi",   title: "总销售额",     span: 3 },
  { id: "w-kpi-2", type: "kpi",   title: "订单数",       span: 3 },
  { id: "w-kpi-3", type: "kpi",   title: "客户数",       span: 3 },
  { id: "w-kpi-4", type: "kpi",   title: "转化率",       span: 3 },
  { id: "w-bar-1", type: "bar",   title: "月度销售趋势", span: 6 },
  { id: "w-line-1",type: "line",  title: "用户增长",     span: 6 },
  { id: "w-pie-1", type: "pie",   title: "品类占比",     span: 4 },
  { id: "w-table-1",type: "table",title: "销售明细",     span: 8 },
];

// ── Design tokens ──
const CHART_COLOR = "#94a3b8";
const CHART_COLOR_LIGHT = "#cbd5e1";
const CHART_BG = "#f8f7f5";

// ── Sample data for charts ──
const monthlySalesData = [
  { month: "1月", sales: 42000, target: 40000 },
  { month: "2月", sales: 38000, target: 42000 },
  { month: "3月", sales: 55000, target: 45000 },
  { month: "4月", sales: 48000, target: 50000 },
  { month: "5月", sales: 62000, target: 55000 },
  { month: "6月", sales: 58000, target: 58000 },
  { month: "7月", sales: 71000, target: 60000 },
  { month: "8月", sales: 65000, target: 62000 },
];

const userGrowthData = [
  { month: "1月", users: 1200, newUsers: 320 },
  { month: "2月", users: 1450, newUsers: 250 },
  { month: "3月", users: 1780, newUsers: 330 },
  { month: "4月", users: 2100, newUsers: 320 },
  { month: "5月", users: 2560, newUsers: 460 },
  { month: "6月", users: 2890, newUsers: 330 },
  { month: "7月", users: 3340, newUsers: 450 },
  { month: "8月", users: 3780, newUsers: 440 },
];

const categoryData = [
  { name: "电子产品", value: 35 },
  { name: "办公用品", value: 25 },
  { name: "食品饮料", value: 20 },
  { name: "其他",     value: 20 },
];

const areaData = [
  { month: "1月", 华东: 28000, 华北: 18000, 华南: 15000 },
  { month: "2月", 华东: 25000, 华北: 16000, 华南: 14000 },
  { month: "3月", 华东: 35000, 华北: 22000, 华南: 19000 },
  { month: "4月", 华东: 31000, 华北: 20000, 华南: 17000 },
  { month: "5月", 华东: 40000, 华北: 26000, 华南: 22000 },
  { month: "6月", 华东: 37000, 华北: 24000, 华南: 20000 },
  { month: "7月", 华东: 45000, 华北: 30000, 华南: 25000 },
  { month: "8月", 华东: 42000, 华北: 28000, 华南: 23000 },
];

const funnelData = [
  { name: "访问", value: 12000 },
  { name: "注册", value: 7200 },
  { name: "激活", value: 4800 },
  { name: "付费", value: 2400 },
  { name: "续费", value: 1680 },
];

// ── Recharts chart renderers ──
function BarChartRenderer() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={monthlySalesData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, border: "1px solid #d6d4d0", borderRadius: 4, background: "#fff" }}
        />
        <Bar dataKey="sales" fill={CHART_COLOR} radius={[2, 2, 0, 0]} barSize={20} name="实际销售" />
        <Bar dataKey="target" fill={CHART_COLOR_LIGHT} radius={[2, 2, 0, 0]} barSize={20} name="目标" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartRenderer() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReLineChart data={userGrowthData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, border: "1px solid #d6d4d0", borderRadius: 4, background: "#fff" }}
        />
        <Area type="monotone" dataKey="users" stroke="none" fill={CHART_COLOR} fillOpacity={0.1} />
        <Line type="monotone" dataKey="users" stroke={CHART_COLOR} strokeWidth={2} dot={{ r: 2, fill: "#fff", stroke: CHART_COLOR, strokeWidth: 1.5 }} activeDot={{ r: 3 }} name="总用户" />
        <Line type="monotone" dataKey="newUsers" stroke={CHART_COLOR_LIGHT} strokeWidth={1.5} dot={{ r: 2, fill: "#fff", stroke: CHART_COLOR_LIGHT, strokeWidth: 1.5 }} activeDot={{ r: 3 }} name="新增用户" strokeDasharray="4 4" />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

function PieChartRenderer() {
  const PIE_COLORS = [CHART_COLOR, CHART_COLOR_LIGHT, "#a1a1aa", "#d4d4d8"];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RePieChart>
        <Pie
          data={categoryData}
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="75%"
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {categoryData.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 11, border: "1px solid #d6d4d0", borderRadius: 4, background: "#fff" }}
          formatter={(value: number) => [`${value}%`, "占比"]}
        />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ fontSize: 10, color: "#94a3b8" }}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}

function AreaChartRenderer() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReAreaChart data={areaData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, border: "1px solid #d6d4d0", borderRadius: 4, background: "#fff" }}
        />
        <Area type="monotone" dataKey="华东" stroke={CHART_COLOR} fill={CHART_COLOR} fillOpacity={0.2} strokeWidth={1.5} />
        <Area type="monotone" dataKey="华北" stroke={CHART_COLOR_LIGHT} fill={CHART_COLOR_LIGHT} fillOpacity={0.15} strokeWidth={1.5} />
        <Area type="monotone" dataKey="华南" stroke="#a1a1aa" fill="#a1a1aa" fillOpacity={0.1} strokeWidth={1.5} />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ fontSize: 10, color: "#94a3b8" }}
        />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}

function GaugeRenderer() {
  const gaugeData = [
    { name: "目标完成率", value: 72, fill: CHART_COLOR },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="60%"
        outerRadius="90%"
        startAngle={180}
        endAngle={0}
        barSize={10}
        data={gaugeData}
      >
        <RadialBar
          background={{ fill: "#e2e0dc" }}
          dataKey="value"
          cornerRadius={5}
          isAnimationActive={true}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={16}
          fontWeight={600}
          fill="#64748b"
        >
          72%
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function TablePlaceholder() {
  return (
    <div className="w-full text-xs">
      <table className="w-full border border-border">
        <thead><tr className="bg-card">
          <th className="border border-border p-1 text-left font-medium text-foreground">项目</th>
          <th className="border border-border p-1 text-right font-medium text-foreground">数值</th>
          <th className="border border-border p-1 text-right font-medium text-foreground">同比</th>
        </tr></thead>
        <tbody>
          {[1, 2, 3].map((r) => (
            <tr key={r}>
              <td className="border border-border p-1 text-foreground">--</td>
              <td className="border border-border p-1 text-right text-foreground">--</td>
              <td className="border border-border p-1 text-right text-foreground">--</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FunnelChartRenderer() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart>
        <Tooltip
          contentStyle={{ fontSize: 11, border: "1px solid #d6d4d0", borderRadius: 4, background: "#fff" }}
        />
        <Funnel
          dataKey="value"
          data={funnelData}
          isAnimationActive
        >
          {funnelData.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={index % 2 === 0 ? CHART_COLOR : CHART_COLOR_LIGHT}
              stroke="none"
            />
          ))}
        </Funnel>
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ fontSize: 10, color: "#94a3b8" }}
        />
      </FunnelChart>
    </ResponsiveContainer>
  );
}

const CHART_RENDERERS: Record<string, () => React.ReactNode> = {
  kpi: () => (
    <div className="flex flex-col items-center justify-center h-full">
      <span className="text-2xl font-semibold text-foreground">--</span>
      <span className="text-xs text-foreground mt-1">待配置数据源</span>
    </div>
  ),
  bar: BarChartRenderer,
  line: LineChartRenderer,
  pie: PieChartRenderer,
  area: AreaChartRenderer,
  gauge: GaugeRenderer,
  table: TablePlaceholder,
  funnel: FunnelChartRenderer,
};

/**
 * P3-1: 拉后端真实 dataset 数据并按 widget.type 渲染
 *  - kpi  : 显示 metrics[0] 合计值
 *  - bar / line / area : 取前两个数值列, 一列 dim, 一列 metric
 *  - pie  : dim 列分组计数值 (KPI 占比)
 *  - table: 显示前 10 行键值对
 *  - gauge: 单值 % 占满 100
 *  - funnel: dim 列各类的 sum / count
 */
function WidgetRuntime({ widget, appId }: { widget: { id: string; type: string; datasetId?: string; metric?: string; dim?: string }; appId?: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId || !widget.datasetId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await appDatasetsApi.preview(appId, widget.datasetId!, 500);
        if (!cancelled) setRows(r.rows || []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [appId, widget.datasetId]);

  if (!widget.datasetId) {
    return CHART_RENDERERS[widget.type]?.() ?? null;
  }
  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="flex items-center justify-center h-full text-xs text-destructive px-2 text-center">{error}</div>;
  if (rows.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground">
      <span>0 rows</span>
      <span className="text-xs mt-1">dataset "{widget.datasetId.slice(0,8)}" 返回空集</span>
    </div>
  );

  // 取列: first numeric = metric, first non-numeric = dim
  const cols = Object.keys(rows[0]);
  const numericCols: string[] = [];
  const dimCols: string[] = [];
  for (const c of cols) {
    const v = rows[0][c];
    if (typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== "")) numericCols.push(c);
    else dimCols.push(c);
  }
  const dimKey = widget.dim || dimCols[0] || cols[0];
  const metricKey = widget.metric || numericCols[0] || cols[cols.length > 1 ? 1 : 0];

  const aggregate = (groupBy: string, sumCol: string, agg: "sum" | "count" = "sum") => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = String(r[groupBy] ?? "(空)");
      let val = 0;
      if (agg === "count") val = 1;
      else {
        const num = Number(r[sumCol]);
        val = isNaN(num) ? 0 : num;
      }
      map.set(key, (map.get(key) ?? 0) + val);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  };

  const total = numericCols.includes(metricKey)
    ? rows.reduce((acc, r) => acc + (Number(r[metricKey]) || 0), 0)
    : rows.length;

  if (widget.type === "kpi") {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="text-2xl font-semibold text-foreground">
          {typeof total === "number" ? total.toLocaleString() : String(total)}
        </span>
        <span className="text-xs text-foreground mt-1">
          {metricKey} · 来自 {rows.length} 行
        </span>
      </div>
    );
  }

  if (widget.type === "table") {
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr>{cols.slice(0, 4).map((c) => (<th key={c} className="text-left px-1 py-0.5 text-foreground">{c}</th>))}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {cols.slice(0, 4).map((c) => (
                  <td key={c} className="px-1 py-0.5 text-foreground">{String(r[c] ?? "").slice(0, 24)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 10 && <div className="text-xs text-muted-foreground text-center py-1">+{rows.length - 10} 行</div>}
      </div>
    );
  }

  // bar / line / area / pie / gauge / funnel — 用聚合后的 {name,value} 给到原 chart renderer
  const aggregated = aggregate(dimKey, metricKey, "sum");
  if (widget.type === "bar") return <AggregatedBar data={aggregated} />;
  if (widget.type === "line") return <AggregatedLine data={aggregated} />;
  if (widget.type === "area") return <AggregatedArea data={aggregated} />;
  if (widget.type === "pie") return <AggregatedPie data={aggregated} />;
  if (widget.type === "gauge") {
    const v = aggregated[0]?.value ?? 0;
    return <AggregatedGauge value={v} max={Math.max(...aggregated.map((d) => d.value), 100)} />;
  }
  if (widget.type === "funnel") return <AggregatedFunnel data={aggregated} />;
  return CHART_RENDERERS[widget.type]?.() ?? null;
}

/** 从原 hardcoded 数据生成器复制 metadata — 真后端数据时使用聚合结果 */
function AggregatedBar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
        <Tooltip contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e2e0dc" }} />
        <Bar dataKey="value" fill="#94a3b8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AggregatedLine({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReLineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
        <Tooltip contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e2e0dc" }} />
        <Line type="monotone" dataKey="value" stroke="#94a3b8" strokeWidth={2} dot={{ fill: "#94a3b8", r: 3 }} />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

function AggregatedArea({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReAreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
        <Tooltip contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e2e0dc" }} />
        <Area type="monotone" dataKey="value" stroke="#94a3b8" fill="#cbd5e1" />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}

function AggregatedPie({ data }: { data: { name: string; value: number }[] }) {
  const palette = ["#94a3b8", "#cbd5e1", "#64748b", "#475569", "#334155", "#1e293b"];
  const sliced = data.slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RePieChart>
        <Pie data={sliced} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={(e: any) => e.name}>
          {sliced.map((_, i) => (<Cell key={i} fill={palette[i % palette.length]} />))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 10, background: "#fff", border: "1px solid #e2e0dc" }} />
      </RePieChart>
    </ResponsiveContainer>
  );
}

function AggregatedGauge({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <svg viewBox="0 0 100 100" className="size-16">
        <circle cx="50" cy="50" r="40" stroke="#e2e0dc" strokeWidth="8" fill="none" />
        <circle
          cx="50" cy="50" r="40" stroke="#94a3b8" strokeWidth="8" fill="none"
          strokeDasharray={`${(pct / 100) * 251.2} 251.2`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="text-xs text-foreground">{pct}%</span>
    </div>
  );
}

function AggregatedFunnel({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const sliced = data.slice(0, 5);
  return (
    <div className="flex flex-col gap-1 p-2 w-full">
      {sliced.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2 text-xs">
          <span className="w-12 truncate text-foreground">{d.name}</span>
          <div className="flex-1 bg-card rounded h-4 overflow-hidden">
            <div className="h-full bg-card" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-12 text-right text-foreground">{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * ReportEditor — dashboard / report editor.
 *
 * Matches "Systematic Rhythm" design:
 * - Left panel: widget palette (same width/style as NodePalette)
 * - Center: 12-column grid canvas
 * - Right panel: widget properties
 * - All neutral gray tones, no colored accents
 */
export function ReportEditor({ components, setComponents, setDirty, appId }: BaseEditorProps & { appId?: string }) {
  const existingWidgets = components?.[0]?.props?.widgets;
  const [widgets, setWidgets] = useState<WidgetItem[]>(
    existingWidgets || DEFAULT_WIDGETS
  );
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<AppDataset[]>([]);
  useEffect(() => {
    if (!appId) return;
    (async () => {
      try { setDatasets(await appDatasetsApi.list(appId)); }
      catch { setDatasets([]); }
    })();
  }, [appId]);
  const [addSpan, setAddSpan] = useState<GridSpan>(6);

  /** Persist widgets back to parent */
  const persistWidgets = (next: WidgetItem[]) => {
    setWidgets(next);
    setComponents((prev: PageComponent[]) => {
      if (prev.length === 0) {
        return [{ id: "report-config", type: "report-config", label: "报表配置", props: { widgets: next } }];
      }
      return prev.map((c, i) =>
        i === 0 ? { ...c, props: { ...c.props, widgets: next } } : c
      );
    });
    setDirty(true);
  };

  const addWidget = (type: string) => {
    const meta = WIDGET_PALETTE.find((w) => w.type === type);
    const newWidget: WidgetItem = {
      id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title: meta?.label || type,
      span: addSpan,
    };
    persistWidgets([...widgets, newWidget]);
    setSelectedWidget(newWidget.id);
  };

  const removeWidget = (id: string) => {
    persistWidgets(widgets.filter((w) => w.id !== id));
    if (selectedWidget === id) setSelectedWidget(null);
  };

  const updateWidgetTitle = (id: string, title: string) => {
    persistWidgets(widgets.map((w) => (w.id === id ? { ...w, title } : w)));
  };

  const changeWidgetSpan = (id: string, span: GridSpan) => {
    persistWidgets(widgets.map((w) => (w.id === id ? { ...w, span } : w)));
  };

  const selected = widgets.find((w) => w.id === selectedWidget);

  // Build GridItems for GridLayout
  const gridItems: GridItem[] = widgets.map((w) => ({
    id: w.id,
    span: w.span,
    label: w.title,
    component: (
      <div
        className={`rounded-lg p-3 cursor-pointer transition-all min-h-[120px] flex flex-col ${
          selectedWidget === w.id
            ? "border border-border bg-card"
            : "border border-border bg-white hover:border-border"
        }`}
        onClick={() => setSelectedWidget(w.id)}
      >
        {/* Widget header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">{w.title}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-foreground px-1">
              {w.span === 12 ? "全行" : w.span === 6 ? "1/2" : w.span === 4 ? "1/3" : "1/4"}
            </span>
            <select
              value={w.span}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                changeWidgetSpan(w.id, Number(e.target.value) as GridSpan);
              }}
              className="text-xs bg-transparent border-none cursor-pointer text-foreground"
            >
              <option value={12}>全行</option>
              <option value={6}>1/2</option>
              <option value={4}>1/3</option>
              <option value={3}>1/4</option>
            </select>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeWidget(w.id);
              }}
              className="p-0.5 rounded hover:bg-card text-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        {/* Chart placeholder / real data runtime */}
        <div className="flex-1 bg-card rounded p-2 flex items-center justify-center overflow-hidden">
          <WidgetRuntime widget={w} appId={appId} />
          {/* fallback content if WidgetRuntime returns null */}
          {!(w as any).datasetId && !CHART_RENDERERS[w.type] && (
            <span className="text-xs text-foreground">{w.type}</span>
          )}
        </div>
      </div>
    ),
  }));

  return (
    <div className="flex gap-0 h-full min-h-[400px]">
      {/* Left: Widget Palette — matches NodePalette style exactly */}
      <div className="w-52 border-r border-border shrink-0 overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">组件库</h3>
          <p className="text-xs text-foreground mt-0.5">
            选择组件添加到画布
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {WIDGET_PALETTE.map((w) => {
            const Icon = w.icon;
            return (
              <div
                key={w.type}
                onClick={() => addWidget(w.type)}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-transparent hover:border-border hover:bg-card cursor-pointer transition-all group"
                title={w.label}
              >
                <div
                  className="flex items-center justify-center rounded size-6 shrink-0 transition-colors"
                  style={{
                    background: `#94a3b818`,
                    border: `1px solid #d6d4d0`,
                  }}
                >
                  <Icon className="size-3.5" style={{ color: "#94a3b8" }} />
                </div>
                <span className="text-xs text-foreground group-hover:text-foreground">
                  {w.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="px-2 py-2 border-t border-border">
          <h3 className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">新增宽度</h3>
          <SpanSelector onSelect={setAddSpan} />
          <div className="mt-3 pt-2 border-t border-border text-xs text-foreground">
            {widgets.length} 个组件
          </div>
        </div>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 overflow-y-auto p-4 bg-card">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-foreground">
            <LayoutDashboard className="size-8 mb-2 opacity-20" />
            <p className="text-sm">从左侧添加图表组件</p>
            <p className="text-xs mt-1">选择宽度后点击组件添加到画布</p>
          </div>
        ) : (
          <GridLayout
            items={gridItems}
            editing={true}
            onSpanChange={(id, span) =>
              changeWidgetSpan(id, span as GridSpan)
            }
            onRemove={removeWidget}
          />
        )}
      </div>

      {/* Right: Widget Properties */}
      <div className="w-52 border-l border-border pl-3 shrink-0 overflow-y-auto">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1">
          <Settings className="size-3.5 text-foreground" /> 属性
        </h3>
        {selected ? (
          <div className="space-y-3">
            <div className="px-2 py-1 rounded bg-card border border-border text-xs text-foreground">
              {selected.type}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground">标题</Label>
              <Input
                value={selected.title}
                onChange={(e) => updateWidgetTitle(selected.id, e.target.value)}
                className="h-8 text-xs border-border"
                placeholder="输入标题..."
              />
            </div>
            {/* P2-4: dataset selector — 拉真后端 dataset, 与 widget 运行时数据拉数直接兼容 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground">数据集 (dataset)</Label>
              <select
                value={(selected as any).datasetId || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setWidgets((prev) => prev.map((w) => (w.id === selected.id ? { ...w, datasetId: v } : w)));
                  setDirty?.(true);
                }}
                className="w-full h-8 text-xs border border-border rounded bg-white px-2"
              >
                <option value="">— 未选择 (用内置示例数据) —</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.sourceType})
                  </option>
                ))}
              </select>
              {(selected as any).datasetId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={async () => {
                    try {
                      const r = await appDatasetsApi.preview(appId!, (selected as any).datasetId, 5);
                      const summary = (r.rows || []).slice(0, 3).map((row: any) => JSON.stringify(row)).join("\n");
                      window.alert(`Preview(${r.rowCount} rows, ${r.took}ms):\n${summary || "(empty)"}`);
                    } catch (e) {
                      window.alert("预览失败: " + (e instanceof Error ? e.message : String(e)));
                    }
                  }}
                >
                  预览数据
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground">宽度</Label>
              <div className="flex gap-1">
                {([12, 6, 4, 3] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeWidgetSpan(selected.id, s)}
                    className={`px-2 py-1 text-xs border rounded transition-colors ${
                      selected.span === s
                        ? "bg-card text-white border-border"
                        : "border-border text-foreground hover:bg-card"
                    }`}
                  >
                    {s === 12 ? "全" : s === 6 ? "1/2" : s === 4 ? "1/3" : "1/4"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => removeWidget(selected.id)}
              className="w-full text-xs py-1.5 border border-border text-foreground rounded-md hover:bg-card hover:text-state-error hover:border-state-error transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 className="size-3" /> 删除组件
            </button>
          </div>
        ) : (
          <p className="text-xs text-foreground py-4 text-center">
            点击组件查看属性
          </p>
        )}
      </div>
    </div>
  );
}
