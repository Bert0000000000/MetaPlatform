/**
 * PublicDashboard.tsx — 公开仪表盘只读视图 (P8-3 品牌化重设)
 * 调 /api/public/dashboards/:dashId 拉配置, 然后批量拉 widgetData
 * 显示 widget title / data rows 数 / 简单表格 — 不引 recharts (开销大)
 * 视觉: 渐变 hero + KPI 卡片 + 数据表格统一
 */
import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertCircle, BarChart3, PieChart, TrendingUp, Activity,
  Layers, Database, Hash, Calendar, Globe, Sparkles,
} from "lucide-react";

const PUBLIC_BASE = (import.meta.env?.VITE_API_BASE || "/api").replace(/\/$/, "");

async function fetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    credentials: "omit",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

// 数值列求和
function sumAmount(rows: any[]): number {
  let s = 0;
  for (const r of rows) {
    for (const k of Object.keys(r || {})) {
      const v = r[k];
      if (typeof v === "number") s += v;
      if (typeof v === "string") {
        const n = Number(v);
        if (!Number.isNaN(n)) s += n;
      }
    }
  }
  return s;
}

function groupByDim(rows: any[], dimKey: string, metricKey: string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const dim = String(r?.[dimKey] ?? "—");
    const v = r?.[metricKey];
    const n = typeof v === "number" ? v : Number(v) || 0;
    map.set(dim, (map.get(dim) ?? 0) + n);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

const PALETTE = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

export default function PublicDashboard() {
  const { appId } = useParams<{ appId: string }>();
  const [params] = useSearchParams();
  const dashboardId = params.get("dashboardId");
  const [dashboard, setDashboard] = useState<any>(null);
  const [widgetData, setWidgetData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dashboardId) { setError("Missing dashboardId"); setLoading(false); return; }
    (async () => {
      try {
        const data = await fetchPublic<any>(`/public/dashboards/${encodeURIComponent(dashboardId)}`);
        setDashboard(data);
        // 拉 widget data
        const widgets = Array.isArray(data.widgets) ? data.widgets : [];
        if (widgets.length === 0) {
          setWidgetData([]);
          setLoading(false);
          return;
        }
        const r = await fetchPublic<{ widgets: any[] }>(`/public/dashboards/${encodeURIComponent(dashboardId)}/widgets/data`, {
          method: "POST",
          body: JSON.stringify({ widgets }),
        });
        setWidgetData(r?.widgets || []);
      } catch (e) {
        setError((e as Error).message);
      } finally { setLoading(false); }
    })();
  }, [dashboardId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">正在加载仪表盘…</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-8">
        <Card className="max-w-md shadow-xl border-rose-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <AlertCircle className="size-5" /> 仪表盘加载失败
            </CardTitle>
            <CardDescription className="text-rose-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const widgets = Array.isArray(dashboard?.widgets) ? dashboard.widgets : [];
  const dataByWidget = new Map<string, any>();
  for (const w of widgetData) dataByWidget.set(w.widgetId, w);

  // 决定 widget 显示尺寸 (KPI 占满 col-span, 其他按类型)
  const widgetClass = (type: string) => {
    if (type === "kpi") return "col-span-1 sm:col-span-2 lg:col-span-2";
    if (type === "table") return "col-span-1 sm:col-span-2 lg:col-span-2";
    return "col-span-1";
  };

  return (
    <div className="min-h-screen bg-primary py-8 px-4">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* P8-3 品牌 Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-xl">
          <div className="absolute -top-12 -right-12 size-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 mb-2">
                <Globe className="size-3.5" />
                公开只读视图 · 来自 MetaPlatform
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{dashboard?.name || "仪表盘"}</h1>
              {dashboard?.description && (
                <p className="text-sm text-white/85 mt-1 max-w-prose">{dashboard.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                  <Layers className="size-3 mr-1" />
                  {widgets.length} 个部件
                </Badge>
                <Badge variant="secondary" className="bg-white/15 text-white border-white/25 hover:bg-white/25">
                  <Database className="size-3 mr-1" />
                  实时数据
                </Badge>
              </div>
            </div>
            <div className="size-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-lg shrink-0">
              <BarChart3 className="size-8 text-white" />
            </div>
          </div>
        </div>

        {widgets.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Sparkles className="size-10 mx-auto mb-2 text-violet-300" />
              此仪表盘未配置部件
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgets.map((w: any, idx: number) => {
              const id = w.id || w.widgetId || `w_${idx}`;
              const d = dataByWidget.get(id);
              const type = String(w.type || w.kind || "").toLowerCase();
              const rows = (d?.status === "success" && Array.isArray(d.rows)) ? d.rows : [];
              const dimKey = w.dim || "status";
              const metricKey = w.metric || "amount";
              const grouped = type === "pie" || type === "bar" || type === "line" || type === "area" || type === "funnel"
                ? groupByDim(rows, dimKey, metricKey) : [];
              const total = type === "kpi" ? sumAmount(rows) : 0;

              return (
                <Card key={id} className={`${widgetClass(type)} hover:shadow-lg transition-shadow border-slate-200`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">
                        {w.title || w.label || `部件 #${idx + 1}`}
                      </CardTitle>
                      <span className="size-6 rounded bg-primary text-violet-600 flex items-center justify-center shrink-0">
                        {type === "kpi" ? <Hash className="size-3.5" /> :
                         type === "pie" ? <PieChart className="size-3.5" /> :
                         type === "bar" ? <BarChart3 className="size-3.5" /> :
                         type === "line" ? <TrendingUp className="size-3.5" /> :
                         type === "area" ? <Activity className="size-3.5" /> :
                         type === "gauge" ? <Hash className="size-3.5" /> :
                         type === "funnel" ? <Layers className="size-3.5" /> :
                         type === "table" ? <Database className="size-3.5" /> :
                         <Sparkles className="size-3.5" />}
                      </span>
                    </div>
                    <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wider">
                      <Badge variant="outline" className="text-xs py-0 px-1.5 border-slate-200">{type || "widget"}</Badge>
                      {d?.status === "success" && (
                        <span className="text-emerald-600">{rows.length} 行</span>
                      )}
                      {d?.status === "failed" && (
                        <span className="text-rose-600">失败: {d.error}</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {d?.status === "failed" ? (
                      <div className="text-rose-600 py-4 text-center">{d.error}</div>
                    ) : rows.length === 0 ? (
                      <div className="text-muted-foreground py-6 text-center text-xs">
                        <Calendar className="size-5 mx-auto mb-1 text-slate-300" />
                        暂无数据
                      </div>
                    ) : type === "kpi" ? (
                      <div>
                        <div className="text-3xl font-bold bg-primary bg-clip-text text-transparent">
                          {total.toLocaleString("zh-CN")}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          基于 {rows.length} 行数据合计 ({metricKey})
                        </div>
                      </div>
                    ) : type === "table" ? (
                      <div className="overflow-auto max-h-56 -mx-2">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-white">
                            <tr className="text-left text-xs text-muted-foreground border-b">
                              {Object.keys(rows[0] || {}).slice(0, 4).map((k) => (
                                <th key={k} className="px-2 py-1 font-medium uppercase tracking-wider">{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 12).map((r: any, i: number) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-primary/30 transition-colors">
                                {Object.keys(rows[0] || {}).slice(0, 4).map((k) => (
                                  <td key={k} className="px-2 py-1 truncate max-w-[120px]">{String(r[k] ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {rows.length > 12 && <div className="mt-1 text-xs text-muted-foreground">+{rows.length - 12} 行</div>}
                      </div>
                    ) : type === "pie" ? (
                      <div className="space-y-1.5">
                        {grouped.slice(0, 6).map((g, i) => {
                          const pct = total > 0 ? (g.value / sumAmount(grouped as any) * 100) : 0;
                          return (
                            <div key={g.name}>
                              <div className="flex justify-between text-xs">
                                <span className="flex items-center gap-1">
                                  <span className="size-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                                  {g.name}
                                </span>
                                <span className="font-mono text-slate-700">{g.value.toLocaleString("zh-CN")}</span>
                              </div>
                              <div className="h-1 bg-slate-100 rounded-full mt-0.5 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : type === "bar" || type === "funnel" ? (
                      <div className="space-y-1.5">
                        {grouped.slice(0, 6).map((g, i) => {
                          const max = Math.max(...grouped.map(x => x.value), 1);
                          const pct = (g.value / max) * 100;
                          return (
                            <div key={g.name}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="truncate">{g.name}</span>
                                <span className="font-mono text-slate-700 ml-2">{g.value.toLocaleString("zh-CN")}</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded overflow-hidden">
                                <div
                                  className="h-full rounded transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(to right, ${PALETTE[i % PALETTE.length]}, ${PALETTE[(i + 1) % PALETTE.length]})`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : type === "line" || type === "area" ? (
                      <div>
                        <SparkLine data={grouped.map(g => g.value)} labels={grouped.map(g => g.name)} />
                        <div className="mt-2 text-xs text-muted-foreground">
                          {grouped.length} 个数据点, 峰值 {Math.max(...grouped.map(g => g.value), 0).toLocaleString("zh-CN")}
                        </div>
                      </div>
                    ) : type === "gauge" ? (
                      <Gauge value={total} max={Math.max(total * 1.5, 100)} />
                    ) : (
                      <div className="overflow-auto max-h-48">
                        <table className="w-full text-xs">
                          <tbody>
                            {rows.slice(0, 10).map((r: any, i: number) => (
                              <tr key={i} className="border-b last:border-0">
                                {Object.keys(r).slice(0, 4).map((k) => (
                                  <td key={k} className="px-1 py-0.5">{String(r[k] ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {rows.length > 10 && <div className="mt-1 text-muted-foreground">+{rows.length - 10} 行</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <footer className="text-center text-xs text-muted-foreground pt-4 pb-2">
          Powered by <span className="font-semibold bg-primary bg-clip-text text-transparent">MetaPlatform</span> · 实时仪表盘
        </footer>
      </div>
    </div>
  );
}

/** 简易 SVG sparkline (no recharts dep) */
function SparkLine({ data, labels }: { data: number[]; labels: string[] }) {
  if (!data.length) return <div className="text-muted-foreground">无数据</div>;
  const w = 280, h = 60;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => [i * stepX, h - ((v - min) / range) * h]);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${path} L${w},${h} L0,${h} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spark-grad)" />
        <path d={path} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="2" fill="#8b5cf6" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span className="truncate">{labels[0]}</span>
        <span className="truncate">{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/** SVG 圆环 gauge */
function Gauge({ value, max }: { value: number; max: number }) {
  const pct = Math.min(1, Math.max(0, value / (max || 1)));
  const r = 36, cx = 50, cy = 50;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="size-28">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="url(#gauge-grad)" strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0f172a">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div className="text-xs text-muted-foreground mt-1">
        {value.toLocaleString("zh-CN")} / {max.toLocaleString("zh-CN")}
      </div>
    </div>
  );
}
