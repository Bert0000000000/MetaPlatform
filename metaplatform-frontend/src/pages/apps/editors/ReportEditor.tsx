/**
 * ReportEditor — dashboard / report editor.
 *
 * "Systematic Rhythm" design: clean, neutral, unified.
 * Chart colors use the same #94a3b8 gray as the process designer.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3, LineChart, PieChart, Activity, Table2,
  Gauge, Filter, AreaChart, Trash2, Settings,
  LayoutDashboard,
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
    <div className="w-full text-[9px]">
      <table className="w-full border border-[#d6d4d0]">
        <thead><tr className="bg-[#f8f7f5]">
          <th className="border border-[#d6d4d0] p-1 text-left font-medium text-[#64748b]">项目</th>
          <th className="border border-[#d6d4d0] p-1 text-right font-medium text-[#64748b]">数值</th>
          <th className="border border-[#d6d4d0] p-1 text-right font-medium text-[#64748b]">同比</th>
        </tr></thead>
        <tbody>
          {[1, 2, 3].map((r) => (
            <tr key={r}>
              <td className="border border-[#d6d4d0] p-1 text-[#94a3b8]">--</td>
              <td className="border border-[#d6d4d0] p-1 text-right text-[#94a3b8]">--</td>
              <td className="border border-[#d6d4d0] p-1 text-right text-[#94a3b8]">--</td>
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
      <span className="text-2xl font-semibold text-[#64748b]">--</span>
      <span className="text-[10px] text-[#94a3b8] mt-1">待配置数据源</span>
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
 * ReportEditor — dashboard / report editor.
 *
 * Matches "Systematic Rhythm" design:
 * - Left panel: widget palette (same width/style as NodePalette)
 * - Center: 12-column grid canvas
 * - Right panel: widget properties
 * - All neutral gray tones, no colored accents
 */
export function ReportEditor({ components, setComponents, setDirty }: BaseEditorProps) {
  const existingWidgets = components?.[0]?.props?.widgets;
  const [widgets, setWidgets] = useState<WidgetItem[]>(
    existingWidgets || DEFAULT_WIDGETS
  );
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
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
            ? "border border-[#94a3b8] bg-[#f8f7f5]"
            : "border border-[#d6d4d0] bg-white hover:border-[#94a3b8]"
        }`}
        onClick={() => setSelectedWidget(w.id)}
      >
        {/* Widget header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#2c2a26]">{w.title}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-[#94a3b8] px-1">
              {w.span === 12 ? "全行" : w.span === 6 ? "1/2" : w.span === 4 ? "1/3" : "1/4"}
            </span>
            <select
              value={w.span}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                changeWidgetSpan(w.id, Number(e.target.value) as GridSpan);
              }}
              className="text-[10px] bg-transparent border-none cursor-pointer text-[#64748b]"
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
              className="p-0.5 rounded hover:bg-[#fee2e2] text-[#94a3b8] hover:text-[#ef4444] transition-colors"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        {/* Chart placeholder */}
        <div className="flex-1 bg-[#f8f7f5] rounded p-2 flex items-center justify-center overflow-hidden">
          {CHART_RENDERERS[w.type]?.() || (
            <span className="text-xs text-[#94a3b8]">{w.type}</span>
          )}
        </div>
      </div>
    ),
  }));

  return (
    <div className="flex gap-0 h-full min-h-[400px]">
      {/* Left: Widget Palette — matches NodePalette style exactly */}
      <div className="w-52 border-r border-[#e2e0dc] shrink-0 overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-[#e2e0dc]">
          <h3 className="text-sm font-semibold text-[#2c2a26]">组件库</h3>
          <p className="text-[10px] text-[#94a3b8] mt-0.5">
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
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-transparent hover:border-[#d6d4d0] hover:bg-[#f8f7f5] cursor-pointer transition-all group"
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
                <span className="text-xs text-[#2c2a26] group-hover:text-[#2c2a26]">
                  {w.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="px-2 py-2 border-t border-[#e2e0dc]">
          <h3 className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-wider mb-2">新增宽度</h3>
          <SpanSelector onSelect={setAddSpan} />
          <div className="mt-3 pt-2 border-t border-[#e2e0dc] text-[10px] text-[#94a3b8]">
            {widgets.length} 个组件
          </div>
        </div>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#faf9f7]">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#94a3b8]">
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
      <div className="w-52 border-l border-[#e2e0dc] pl-3 shrink-0 overflow-y-auto">
        <h3 className="text-sm font-semibold text-[#2c2a26] mb-3 flex items-center gap-1">
          <Settings className="size-3.5 text-[#94a3b8]" /> 属性
        </h3>
        {selected ? (
          <div className="space-y-3">
            <div className="px-2 py-1 rounded bg-[#f3f1ee] border border-[#d6d4d0] text-[10px] text-[#94a3b8]">
              {selected.type}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748b]">标题</Label>
              <Input
                value={selected.title}
                onChange={(e) => updateWidgetTitle(selected.id, e.target.value)}
                className="h-8 text-xs border-[#d6d4d0]"
                placeholder="输入标题..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748b]">宽度</Label>
              <div className="flex gap-1">
                {([12, 6, 4, 3] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeWidgetSpan(selected.id, s)}
                    className={`px-2 py-1 text-[10px] border rounded transition-colors ${
                      selected.span === s
                        ? "bg-[#94a3b8] text-white border-[#94a3b8]"
                        : "border-[#d6d4d0] text-[#64748b] hover:bg-[#f8f7f5]"
                    }`}
                  >
                    {s === 12 ? "全" : s === 6 ? "1/2" : s === 4 ? "1/3" : "1/4"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => removeWidget(selected.id)}
              className="w-full text-xs py-1.5 border border-[#d6d4d0] text-[#94a3b8] rounded hover:bg-[#fef2f2] hover:text-[#ef4444] hover:border-[#fecaca] transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 className="size-3" /> 删除组件
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-[#94a3b8] py-4 text-center">
            点击组件查看属性
          </p>
        )}
      </div>
    </div>
  );
}
