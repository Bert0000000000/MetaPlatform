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

// ── SVG chart placeholder renderers ──
function BarChartPlaceholder() {
  const bars = [60, 80, 45, 90, 70, 55, 85, 40];
  return (
    <svg viewBox="0 0 200 80" className="w-full h-full">
      {bars.map((h, i) => (
        <rect key={i} x={i * 24 + 4} y={80 - h} width="18" height={h}
          fill={CHART_COLOR} fillOpacity={0.3 + i * 0.08} rx="2" />
      ))}
    </svg>
  );
}

function LineChartPlaceholder() {
  const points = "10,60 35,40 60,55 85,25 110,35 135,20 160,30 185,15";
  const areaPoints = points + " 185,80 10,80";
  return (
    <svg viewBox="0 0 200 80" className="w-full h-full">
      <polygon points={areaPoints} fill={CHART_COLOR} fillOpacity="0.08" />
      <polyline points={points} fill="none" stroke={CHART_COLOR} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((p, i) => {
        const [cx, cy] = p.split(",").map(Number);
        return <circle key={i} cx={cx} cy={cy} r="2.5" fill="#fff" stroke={CHART_COLOR} strokeWidth="1.5" />;
      })}
    </svg>
  );
}

function PieChartPlaceholder() {
  const segments = [
    { pct: 35, color: CHART_COLOR },
    { pct: 25, color: CHART_COLOR_LIGHT },
    { pct: 20, color: "#a1a1aa" },
    { pct: 20, color: "#d4d4d8" },
  ];
  let cum = 0;
  const paths = segments.map((seg) => {
    const start = cum;
    cum += seg.pct;
    const r = 32;
    const cx = 45;
    const cy = 45;
    const startAngle = (start / 100) * Math.PI * 2 - Math.PI / 2;
    const endAngle = (cum / 100) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = seg.pct > 50 ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
  });
  return (
    <svg viewBox="0 0 90 90" className="w-full h-full">
      {paths.map((d, i) => (
        <path key={i} d={d} fill={segments[i].color} fillOpacity="0.6" stroke="#fff" strokeWidth="1" />
      ))}
    </svg>
  );
}

function AreaChartPlaceholder() {
  const points = "10,55 35,35 60,50 85,20 110,30 135,15 160,25 185,10";
  const areaPoints = points + " 185,80 10,80";
  return (
    <svg viewBox="0 0 200 80" className="w-full h-full">
      <polygon points={areaPoints} fill={CHART_COLOR} fillOpacity="0.1" />
      <polyline points={points} fill="none" stroke={CHART_COLOR} strokeWidth="1.5" />
    </svg>
  );
}

function GaugePlaceholder() {
  return (
    <svg viewBox="0 0 100 60" className="w-full h-full">
      <path d="M10,55 A40,40 0 0,1 90,55" fill="none" stroke={CHART_LIGHT} strokeWidth="6" strokeLinecap="round" />
      <path d="M10,55 A40,40 0 0,1 70,18" fill="none" stroke={CHART_COLOR} strokeWidth="6" strokeLinecap="round" />
      <text x="50" y="50" textAnchor="middle" fontSize="12" fontWeight="500" fill="#64748b">72%</text>
    </svg>
  );
}

const CHART_LIGHT = "#e2e0dc";

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

function FunnelPlaceholder() {
  const steps = [100, 75, 50, 30];
  return (
    <svg viewBox="0 0 200 80" className="w-full h-full">
      {steps.map((w, i) => (
        <rect key={i} x={(200 - w * 1.6) / 2} y={i * 19 + 2} width={w * 1.6} height="16" rx="2"
          fill={CHART_COLOR} fillOpacity={0.6 - i * 0.12} />
      ))}
    </svg>
  );
}

const CHART_RENDERERS: Record<string, () => React.ReactNode> = {
  kpi: () => (
    <div className="flex flex-col items-center justify-center h-full">
      <span className="text-2xl font-semibold text-[#64748b]">--</span>
      <span className="text-[10px] text-[#94a3b8] mt-1">待配置数据源</span>
    </div>
  ),
  bar: BarChartPlaceholder,
  line: LineChartPlaceholder,
  pie: PieChartPlaceholder,
  area: AreaChartPlaceholder,
  gauge: GaugePlaceholder,
  table: TablePlaceholder,
  funnel: FunnelPlaceholder,
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
