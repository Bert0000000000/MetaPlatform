import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  BarChart3, LineChart, PieChart, Activity, Table2,
  Gauge, Filter, AreaChart, Trash2, Settings,
  LayoutDashboard, Plus,
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

// ── SVG chart placeholder renderers ──
function BarChartPlaceholder() {
  const bars = [60, 80, 45, 90, 70, 55, 85, 40];
  return (
    <svg viewBox="0 0 200 80" className="w-full h-full">
      {bars.map((h, i) => (
        <rect key={i} x={i * 24 + 4} y={80 - h} width="18" height={h}
          fill="hsl(var(--primary))" fillOpacity={0.6 + i * 0.05} rx="2" />
      ))}
    </svg>
  );
}

function LineChartPlaceholder() {
  const points = "10,60 35,40 60,55 85,25 110,35 135,20 160,30 185,15";
  const areaPoints = points + " 185,80 10,80";
  return (
    <svg viewBox="0 0 200 80" className="w-full h-full">
      <polygon points={areaPoints} fill="hsl(var(--primary))" fillOpacity="0.1" />
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((p, i) => {
        const [cx, cy] = p.split(",").map(Number);
        return <circle key={i} cx={cx} cy={cy} r="3" fill="hsl(var(--primary))" />;
      })}
    </svg>
  );
}

function PieChartPlaceholder() {
  const segments = [
    { pct: 35, color: "hsl(var(--primary))" },
    { pct: 25, color: "hsl(220, 70%, 60%)" },
    { pct: 20, color: "hsl(150, 60%, 50%)" },
    { pct: 20, color: "hsl(30, 80%, 55%)" },
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
        <path key={i} d={d} fill={segments[i].color} fillOpacity="0.7" stroke="white" strokeWidth="1" />
      ))}
    </svg>
  );
}

function AreaChartPlaceholder() {
  const points = "10,55 35,35 60,50 85,20 110,30 135,15 160,25 185,10";
  const areaPoints = points + " 185,80 10,80";
  return (
    <svg viewBox="0 0 200 80" className="w-full h-full">
      <polygon points={areaPoints} fill="hsl(var(--primary))" fillOpacity="0.15" />
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
    </svg>
  );
}

function GaugePlaceholder() {
  return (
    <svg viewBox="0 0 100 60" className="w-full h-full">
      <path d="M10,55 A40,40 0 0,1 90,55" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
      <path d="M10,55 A40,40 0 0,1 70,18" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" />
      <text x="50" y="50" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">72%</text>
    </svg>
  );
}

function TablePlaceholder() {
  return (
    <div className="w-full text-[9px]">
      <table className="w-full border">
        <thead><tr className="bg-muted/50">
          <th className="border p-1 text-left">项目</th>
          <th className="border p-1 text-right">数值</th>
          <th className="border p-1 text-right">同比</th>
        </tr></thead>
        <tbody>
          {[1, 2, 3].map((r) => (
            <tr key={r}><td className="border p-1">--</td><td className="border p-1 text-right">--</td><td className="border p-1 text-right">--</td></tr>
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
          fill="hsl(var(--primary))" fillOpacity={1 - i * 0.2} />
      ))}
    </svg>
  );
}

const CHART_RENDERERS: Record<string, () => React.ReactNode> = {
  kpi: () => (
    <div className="flex flex-col items-center justify-center h-full">
      <span className="text-2xl font-bold text-primary">--</span>
      <span className="text-[10px] text-muted-foreground mt-1">待配置数据源</span>
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
 * ReportEditor -- dashboard / report editor
 *
 * Enhancements over PageEditor.tsx:
 * - Proper 12-column grid with SpanSelector
 * - SVG chart placeholders instead of plain text
 * - Widget title editing
 * - Delete / span-change per widget
 * - Proper TypeScript types
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
        className={`border rounded-lg p-3 cursor-pointer transition-all min-h-[120px] flex flex-col ${
          selectedWidget === w.id
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-dashed hover:border-primary/30"
        }`}
        onClick={() => setSelectedWidget(w.id)}
      >
        {/* Widget header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">{w.title}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-muted-foreground px-1">
              {w.span === 12 ? "全行" : w.span === 6 ? "1/2" : w.span === 4 ? "1/3" : "1/4"}
            </span>
            <select
              value={w.span}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                changeWidgetSpan(w.id, Number(e.target.value) as GridSpan);
              }}
              className="text-[10px] bg-transparent border-none cursor-pointer"
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
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        {/* Chart placeholder */}
        <div className="flex-1 bg-muted/30 rounded p-2 flex items-center justify-center overflow-hidden">
          {CHART_RENDERERS[w.type]?.() || (
            <span className="text-xs text-muted-foreground">{w.type}</span>
          )}
        </div>
      </div>
    ),
  }));

  return (
    <div className="flex gap-0 h-[calc(100vh-200px)] min-h-[400px]">
      {/* Left: Widget Palette */}
      <div className="w-40 border-r pr-3 shrink-0 overflow-y-auto">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">
          组件库
        </h4>
        <div className="space-y-1">
          {WIDGET_PALETTE.map((w) => {
            const Icon = w.icon;
            return (
              <button
                key={w.type}
                onClick={() => addWidget(w.type)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors text-left"
              >
                <Icon className="size-3.5 text-muted-foreground" />
                <span>{w.label}</span>
              </button>
            );
          })}
        </div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mt-4 mb-2">
          新增宽度
        </h4>
        <SpanSelector onSelect={setAddSpan} />
        <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground">
          {widgets.length} 个组件
        </div>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 overflow-y-auto p-4">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
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
      <div className="w-48 border-l pl-3 shrink-0">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
          <Settings className="size-3" /> 属性
        </h4>
        {selected ? (
          <div className="space-y-3">
            <Badge variant="outline" className="text-[10px]">
              {selected.type}
            </Badge>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                标题
              </Label>
              <Input
                value={selected.title}
                onChange={(e) =>
                  updateWidgetTitle(selected.id, e.target.value)
                }
                className="h-7 text-xs mt-0.5"
                placeholder="输入标题..."
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                宽度
              </Label>
              <div className="flex gap-1 mt-1">
                {([12, 6, 4, 3] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeWidgetSpan(selected.id, s)}
                    className={`px-2 py-1 text-[10px] border rounded ${
                      selected.span === s
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {s === 12 ? "全" : s === 6 ? "1/2" : s === 4 ? "1/3" : "1/4"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => removeWidget(selected.id)}
              className="w-full text-xs py-1 border border-destructive/50 text-destructive rounded hover:bg-destructive/5"
            >
              删除组件
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground py-4 text-center">
            点击组件查看属性
          </p>
        )}
      </div>
    </div>
  );
}
