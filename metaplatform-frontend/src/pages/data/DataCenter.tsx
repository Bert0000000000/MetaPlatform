import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dataApi, type DataSource, type DataMetric } from "@/lib/api";
import { Database, Plus, Sparkles, MessageSquare, Activity, AlertTriangle, Terminal, BarChart3, GitMerge, ShieldCheck, Clock, Send, FileBarChart, Leaf, Zap, Rocket, Mail, Globe, FileSpreadsheet, Users, Package, Megaphone, HardDrive, RefreshCw, Circle, Handshake, Trash2, Plug, Bell, CheckCircle2, Warehouse, Layers, Search, BookOpen, Ruler, Briefcase, ScrollText, Download, Server, Eye, Star, Bookmark, History, ChevronRight, ChevronDown, PieChart, TrendingUp, Table as TableIcon, Filter, Copy, MoreHorizontal, ArrowRight, Printer, Columns, Split, Merge, Fingerprint, Target, ArrowRightLeft, Lock, GripVertical, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/stat";

const statusMap: Record<DataSource["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  online: { label: "在线", variant: "default" },
  offline: { label: "离线", variant: "destructive" },
  syncing: { label: "同步中", variant: "secondary" },
  error: { label: "错误", variant: "destructive" },
};

const sourceTypeIcons: Record<string, React.ElementType> = {
  MySQL: Database,
  PostgreSQL: Database,
  Oracle: Database,
  MongoDB: Leaf,
  ClickHouse: Zap,
  Doris: Rocket,
  Kafka: Mail,
  API: Globe,
  CSV: FileSpreadsheet,
};

// ETL 任务
const ETL_TASKS = [
  { id: 1, name: "订单 → DWD 同步", source: "MySQL 订单库", target: "DWD 层", schedule: "每小时", status: "running", duration: "2 分钟", lastRun: "12 分钟前" },
  { id: 2, name: "客户主数据抽取", source: "PostgreSQL CRM", target: "DWS 层", schedule: "每天 02:00", status: "completed", duration: "38 分钟", lastRun: "8 小时前" },
  { id: 3, name: "销售指标汇总", source: "DWS 销售", target: "ADS 销售看板", schedule: "每天 06:00", status: "completed", duration: "12 分钟", lastRun: "3 小时前" },
  { id: 4, name: "日志清洗", source: "Kafka 行为日志", target: "DWD 用户行为", schedule: "实时", status: "running", duration: "实时", lastRun: "正在运行" },
  { id: 5, name: "财务报表合并", source: "ERP", target: "ADS 财务报表", schedule: "每月 1 日", status: "failed", duration: "失败", lastRun: "失败" },
];

// 数据质量规则
const QUALITY_RULES = [
  { id: 1, table: "customer", rule: "客户编号 NOT NULL", severity: "error", status: "passed", coverage: 100 },
  { id: 2, table: "order", rule: "订单金额 > 0", severity: "error", status: "passed", coverage: 100 },
  { id: 3, table: "order", rule: "订单日期 ≤ 当前日期", severity: "warning", status: "failed", coverage: 98.2 },
  { id: 4, table: "product", rule: "SKU 唯一", severity: "error", status: "passed", coverage: 100 },
  { id: 5, table: "employee", rule: "邮箱格式校验", severity: "warning", status: "passed", coverage: 99.8 },
  { id: 6, table: "contract", rule: "合同金额 = 累计订单金额", severity: "warning", status: "warning", coverage: 95.4 },
];

// 实时监控
const REAL_TIME = [
  { time: "12:48:32", event: "订单 #20260703-482 创建", source: "MySQL" },
  { time: "12:48:18", event: "客户 客户编号=8392 信息更新", source: "PostgreSQL" },
  { time: "12:48:05", event: "合同 #CT-2026-778 审批通过", source: "MongoDB" },
  { time: "12:47:55", event: "库存预警：SKU-P008 库存 < 10", source: "ERP" },
  { time: "12:47:42", event: "支付回调 #PAY-9981 成功", source: "Payment API" },
  { time: "12:47:30", event: "数据同步任务 #ETL-021 完成", source: "Doris" },
];

export function DataSourceList() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "MySQL", host: "", port: "3306", database_name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataApi.listSources();
      setSources(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      setSubmitting(true);
      await dataApi.createSource({
        name: form.name,
        type: form.type,
        host: form.host,
        port: parseInt(form.port) || 3306,
        database_name: form.database_name,
        description: form.description,
      });
      setDialogOpen(false);
      setForm({ name: "", type: "MySQL", host: "", port: "3306", database_name: "", description: "" });
      await loadSources();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该数据源？")) return;
    try {
      await dataApi.deleteSource(id);
      await loadSources();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  async function handleTest(id: string) {
    try {
      const result = await dataApi.testConnection(id);
      setTestResult((prev) => ({ ...prev, [id]: result.message || result.status }));
      setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[id]; return n; }), 3000);
    } catch (e: unknown) {
      setTestResult((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "测试失败" }));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="size-4" /> 数据源列表
          </CardTitle>
          <CardDescription>连接外部数据源（{sources.length} 个）</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新增数据源
        </Button>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-center py-8 text-muted-foreground">加载中...</div>}
        {error && <div className="text-center py-8 text-destructive">{error}</div>}
        {!loading && !error && sources.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">暂无数据源，点击上方按钮新增</div>
        )}
        {!loading && !error && sources.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>主机</TableHead>
                <TableHead>数据库</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((ds) => (
                <TableRow key={ds.id}>
                  <TableCell className="font-medium">{ds.name}</TableCell>
                  <TableCell>
                    {(() => { const Icon = sourceTypeIcons[ds.type]; return Icon ? <Icon className="size-4 mr-1 inline" /> : null; })()}
                    {ds.type}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{ds.host}{ds.port ? `:${ds.port}` : ""}</TableCell>
                  <TableCell className="text-xs">{ds.database_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[ds.status]?.variant || "outline"}>
                      {statusMap[ds.status]?.label || ds.status}
                    </Badge>
                    {testResult[ds.id] && (
                      <span className="ml-2 text-xs text-muted-foreground">{testResult[ds.id]}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => handleTest(ds.id)} title="测试连接">
                      <Plug className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDelete(ds.id)} title="删除">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增数据源</DialogTitle>
            <DialogDescription>配置新的数据库连接</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：订单库 MySQL" />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["MySQL", "PostgreSQL", "Oracle", "MongoDB", "ClickHouse", "Doris", "Kafka", "API", "CSV"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>主机</Label>
                <Input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="localhost" />
              </div>
              <div className="space-y-2">
                <Label>端口</Label>
                <Input value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} placeholder="3306" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>数据库名</Label>
              <Input value={form.database_name} onChange={(e) => setForm((f) => ({ ...f, database_name: e.target.value }))} placeholder="mydb" />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="数据源说明" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={submitting || !form.name.trim()}>
              {submitting ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function AskData() {
  const [q, setQ] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showSQL, setShowSQL] = useState(true);
  const [drillDown, setDrillDown] = useState("");
  const [selectedChartType, setSelectedChartType] = useState<string>("auto");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [history, setHistory] = useState<{
    q: string;
    sql: string;
    result: string;
    chartType: string;
    data: { label: string; value: number }[];
    timestamp: string;
  }[]>([
    {
      q: "上个月的订单总额是多少？",
      sql: "SELECT SUM(amount) as total FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH);",
      result: "¥12,486,329（共 4,231 笔订单）",
      chartType: "bar",
      data: [
        { label: "电子产品", value: 4523800 },
        { label: "服装鞋帽", value: 3128400 },
        { label: "食品饮料", value: 2156800 },
        { label: "家居用品", value: 1845200 },
        { label: "其他", value: 832129 },
      ],
      timestamp: "2026-07-03 12:30",
    },
    {
      q: "本周各地区销售额趋势",
      sql: "SELECT region, DATE(created_at) as date, SUM(amount) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY region, date ORDER BY date;",
      result: "本周销售额数据，包含 5 个地区 7 天数据",
      chartType: "line",
      data: [
        { label: "周一", value: 1850000 },
        { label: "周二", value: 2120000 },
        { label: "周三", value: 1980000 },
        { label: "周四", value: 2350000 },
        { label: "周五", value: 2680000 },
        { label: "周六", value: 1560000 },
        { label: "周日", value: 1280000 },
      ],
      timestamp: "2026-07-03 14:20",
    },
  ]);

  // Mock SQL generation based on keywords
  function generateSQL(query: string): { sql: string; result: string; chartType: string; data: { label: string; value: number }[] } {
    const lowerQ = query.toLowerCase();
    let sql = "";
    let result = "";
    let chartType = "table";
    let data: { label: string; value: number }[] = [];

    if (lowerQ.includes("销售") || lowerQ.includes("金额") || lowerQ.includes("总额")) {
      sql = `SELECT category, SUM(amount) as total_sales\nFROM orders\nWHERE created_at >= '2026-06-01'\nGROUP BY category\nORDER BY total_sales DESC;`;
      result = "查询完成，返回 5 条分类销售数据";
      chartType = "bar";
      data = [
        { label: "电子产品", value: 4523800 },
        { label: "服装鞋帽", value: 3128400 },
        { label: "食品饮料", value: 2156800 },
        { label: "家居用品", value: 1845200 },
        { label: "其他", value: 832129 },
      ];
    } else if (lowerQ.includes("客户") || lowerQ.includes("用户")) {
      sql = `SELECT COUNT(*) as total_customers,\n       COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_customers\nFROM customers;`;
      result = "总客户数: 89,234，本月新增: 2,845";
      chartType = "pie";
      data = [
        { label: "活跃客户", value: 45230 },
        { label: "潜在客户", value: 28450 },
        { label: "流失客户", value: 15554 },
      ];
    } else if (lowerQ.includes("趋势") || lowerQ.includes("增长")) {
      sql = `SELECT DATE(created_at) as date, SUM(amount) as daily_total\nFROM orders\nWHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)\nGROUP BY date\nORDER BY date;`;
      result = "返回最近 30 天销售趋势数据";
      chartType = "line";
      data = Array.from({ length: 12 }, (_, i) => ({
        label: `${i + 1}月`,
        value: Math.floor(Math.random() * 2000000) + 3000000,
      }));
    } else if (lowerQ.includes("top") || lowerQ.includes("排名") || lowerQ.includes("排行")) {
      sql = `SELECT product_name, SUM(quantity) as total_sold\nFROM order_items\nGROUP BY product_name\nORDER BY total_sold DESC\nLIMIT 10;`;
      result = "返回 Top 10 热销商品";
      chartType = "bar";
      data = [
        { label: "iPhone 15", value: 12580 },
        { label: "MacBook Pro", value: 8920 },
        { label: "AirPods", value: 15680 },
        { label: "iPad", value: 6540 },
        { label: "Apple Watch", value: 4320 },
      ];
    } else if (lowerQ.includes("分布") || lowerQ.includes("占比")) {
      sql = `SELECT region, COUNT(*) as order_count\nFROM orders\nGROUP BY region;`;
      result = "返回各地区订单分布数据";
      chartType = "pie";
      data = [
        { label: "华东", value: 35 },
        { label: "华南", value: 25 },
        { label: "华北", value: 20 },
        { label: "西南", value: 12 },
        { label: "其他", value: 8 },
      ];
    } else {
      sql = `SELECT *\nFROM orders\nWHERE status = 'completed'\nORDER BY created_at DESC\nLIMIT 20;`;
      result = "查询完成，返回 20 条记录";
      chartType = "table";
      data = [];
    }

    return { sql, result, chartType, data };
  }

  function ask(query: string) {
    if (!query.trim()) return;
    const { sql, result, chartType, data } = generateSQL(query);
    setHistory((h) => [
      ...h,
      {
        q: query,
        sql,
        result,
        chartType,
        data,
        timestamp: new Date().toLocaleString("zh-CN"),
      },
    ]);
    setQ("");
    setDrillDown("");
  }

  function toggleFavorite(query: string) {
    setFavorites((prev) =>
      prev.includes(query) ? prev.filter((f) => f !== query) : [...prev, query]
    );
  }

  function handleExport(format: string) {
    alert(`导出为 ${format} 格式（模拟）`);
    setShowExportMenu(false);
  }

  const currentQuery = history[history.length - 1];
  const displayChartType = selectedChartType === "auto" ? currentQuery?.chartType || "table" : selectedChartType;

  // SVG Chart Renderers
  function renderBarChart(data: { label: string; value: number }[]) {
    if (!data.length) return null;
    const maxVal = Math.max(...data.map((d) => d.value));
    const chartWidth = 400;
    const chartHeight = 200;
    const barWidth = chartWidth / data.length - 10;

    return (
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="overflow-visible">
        {data.map((item, i) => {
          const barHeight = (item.value / maxVal) * chartHeight;
          const x = i * (barWidth + 10) + 5;
          const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
          return (
            <g key={i}>
              <rect
                x={x}
                y={chartHeight - barHeight}
                width={barWidth}
                height={barHeight}
                fill={colors[i % colors.length]}
                rx={4}
              />
              <text x={x + barWidth / 2} y={chartHeight + 15} textAnchor="middle" className="text-[10px] fill-muted-foreground">
                {item.label}
              </text>
              <text x={x + barWidth / 2} y={chartHeight - barHeight - 5} textAnchor="middle" className="text-[9px] fill-foreground font-medium">
                {(item.value / 10000).toFixed(1)}万
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  function renderLineChart(data: { label: string; value: number }[]) {
    if (!data.length) return null;
    const maxVal = Math.max(...data.map((d) => d.value));
    const minVal = Math.min(...data.map((d) => d.value));
    const chartWidth = 400;
    const chartHeight = 200;
    const padding = 30;

    const points = data.map((item, i) => {
      const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((item.value - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);
      return { x, y, ...item };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`;

    return (
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} className="overflow-visible">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartHeight - padding - ratio * (chartHeight - padding * 2);
          return (
            <g key={ratio}>
              <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="currentColor" strokeOpacity={0.1} />
              <text x={padding - 5} y={y + 4} textAnchor="end" className="text-[9px] fill-muted-foreground">
                {((minVal + ratio * (maxVal - minVal)) / 10000).toFixed(0)}万
              </text>
            </g>
          );
        })}
        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" />
            <text x={p.x} y={chartHeight - padding + 15} textAnchor="middle" className="text-[9px] fill-muted-foreground">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  function renderPieChart(data: { label: string; value: number }[]) {
    if (!data.length) return null;
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    const cx = 120;
    const cy = 100;
    const r = 80;

    let startAngle = -Math.PI / 2;
    const slices = data.map((item, i) => {
      const angle = (item.value / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const largeArc = angle > Math.PI ? 1 : 0;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const midAngle = startAngle + angle / 2;
      const labelR = r * 0.65;
      const labelX = cx + labelR * Math.cos(midAngle);
      const labelY = cy + labelR * Math.sin(midAngle);

      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      startAngle = endAngle;

      return { path, color: colors[i % colors.length], labelX, labelY, item, percent: ((item.value / total) * 100).toFixed(1) };
    });

    return (
      <svg width="100%" viewBox="0 0 320 200" className="overflow-visible">
        {slices.map((slice, i) => (
          <g key={i}>
            <path d={slice.path} fill={slice.color} stroke="white" strokeWidth="2" />
            <text x={slice.labelX} y={slice.labelY} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-white font-medium">
              {slice.percent}%
            </text>
          </g>
        ))}
        {/* Legend */}
        {data.map((item, i) => (
          <g key={i} transform={`translate(230, ${20 + i * 24})`}>
            <rect width="12" height="12" fill={colors[i % colors.length]} rx="2" />
            <text x="16" y="10" className="text-[10px] fill-foreground">{item.label}</text>
          </g>
        ))}
      </svg>
    );
  }

  function renderDataTable(data: { label: string; value: number }[]) {
    if (!data.length) return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>订单号</TableHead>
            <TableHead>客户</TableHead>
            <TableHead>金额</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>日期</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { id: "ORD-20260701", customer: "北京科技", amount: "¥128,500", status: "已完成", date: "2026-07-01" },
            { id: "ORD-20260702", customer: "上海贸易", amount: "¥89,200", status: "已完成", date: "2026-07-02" },
            { id: "ORD-20260703", customer: "深圳电子", amount: "¥256,800", status: "处理中", date: "2026-07-03" },
            { id: "ORD-20260704", customer: "广州制造", amount: "¥45,600", status: "已完成", date: "2026-07-04" },
            { id: "ORD-20260705", customer: "杭州网络", amount: "¥178,900", status: "待审核", date: "2026-07-05" },
          ].map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.id}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell className="font-medium">{row.amount}</TableCell>
              <TableCell>
                <Badge variant={row.status === "已完成" ? "default" : row.status === "处理中" ? "secondary" : "outline"}>
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{row.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  function renderChart() {
    if (!currentQuery?.data?.length && displayChartType !== "table") {
      return renderDataTable([]);
    }
    switch (displayChartType) {
      case "bar":
        return renderBarChart(currentQuery?.data || []);
      case "line":
        return renderLineChart(currentQuery?.data || []);
      case "pie":
        return renderPieChart(currentQuery?.data || []);
      default:
        return renderDataTable(currentQuery?.data || []);
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* History Sidebar */}
      {showHistory && (
        <Card className="w-64 shrink-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="size-4" /> 查询历史
              </span>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => setShowHistory(false)}>
                <ChevronRight className="size-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto" style={{ maxHeight: "calc(100% - 60px)" }}>
            <div className="space-y-1 p-2">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setQ(h.q)}
                  className="w-full text-left p-2 rounded hover:bg-muted text-xs"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="line-clamp-2 flex-1">{h.q}</span>
                    {favorites.includes(h.q) && <Star className="size-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                  </div>
                  <div className="text-muted-foreground mt-1">{h.timestamp}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Chat Area */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="size-4" /> 智能问数（NL2SQL）
              </CardTitle>
              <div className="flex items-center gap-2">
                {!showHistory && (
                  <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
                    <History className="size-3 mr-1" />
                    历史
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowSQL(!showSQL)}>
                  <Terminal className="size-3 mr-1" />
                  {showSQL ? "隐藏 SQL" : "显示 SQL"}
                </Button>
              </div>
            </div>
            <CardDescription>用自然语言查询数据库，AI 自动生成 SQL</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {history.map((h, i) => (
              <div key={i} className="space-y-2">
                {/* User Question */}
                <div className="flex items-start gap-2">
                  <div className="size-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">Q</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{h.q}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{h.timestamp}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => toggleFavorite(h.q)}
                    >
                      <Star className={`size-3 ${favorites.includes(h.q) ? "text-yellow-500 fill-yellow-500" : ""}`} />
                    </Button>
                  </div>
                </div>

                {/* SQL Preview */}
                {showSQL && (
                  <div className="flex items-start gap-2">
                    <div className="size-7 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">
                      <Terminal className="size-3" />
                    </div>
                    <div className="flex-1">
                      <pre className="text-xs font-mono bg-background border rounded p-2 overflow-x-auto">
                        {h.sql}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Answer */}
                <div className="flex items-start gap-2">
                  <div className="size-7 rounded-full bg-green-500 text-white text-xs flex items-center justify-center shrink-0">A</div>
                  <div className="flex-1">
                    <div className="text-sm">{h.result}</div>
                    {h.data.length > 0 && (
                      <div className="mt-2 border rounded p-2 bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {h.chartType === "bar" ? "柱状图" : h.chartType === "line" ? "折线图" : h.chartType === "pie" ? "饼图" : "数据表"}
                          </Badge>
                        </div>
                        <div className="h-48">
                          {i === history.length - 1 ? renderChart() : (
                            h.chartType === "bar" ? renderBarChart(h.data) :
                            h.chartType === "line" ? renderLineChart(h.data) :
                            h.chartType === "pie" ? renderPieChart(h.data) :
                            renderDataTable(h.data)
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>

          {/* Input Area */}
          <div className="border-t p-4 space-y-3">
            {/* Quick Questions */}
            <div className="flex gap-2 flex-wrap">
              {["上个月销售额是多少？", "本周新增客户有多少？", "各地区销售 Top 5 城市", "客户分布占比"].map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="bg-background border rounded px-3 py-1.5 text-xs hover:border-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Chart Type Selector & Actions */}
            <div className="flex items-center gap-2">
              <Select value={selectedChartType} onValueChange={setSelectedChartType}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">自动选择</SelectItem>
                  <SelectItem value="bar">柱状图</SelectItem>
                  <SelectItem value="line">折线图</SelectItem>
                  <SelectItem value="pie">饼图</SelectItem>
                  <SelectItem value="table">数据表</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <Download className="size-3 mr-1" />
                  导出
                </Button>
                {showExportMenu && (
                  <div className="absolute bottom-full left-0 mb-1 bg-background border rounded shadow-lg p-1 z-10">
                    <button onClick={() => handleExport("CSV")} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted rounded">导出 CSV</button>
                    <button onClick={() => handleExport("Excel")} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted rounded">导出 Excel</button>
                    <button onClick={() => handleExport("JSON")} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted rounded">导出 JSON</button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(q)}
                placeholder="问我任何数据问题..."
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <Button onClick={() => ask(q)}>
                <Send className="size-3 mr-1" />
                提问
              </Button>
            </div>

            {/* Drill Down Input */}
            {currentQuery && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={drillDown}
                  onChange={(e) => setDrillDown(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ask(drillDown)}
                  placeholder="追问：在此基础上继续深入分析..."
                  className="flex-1 border rounded px-3 py-2 text-xs text-muted-foreground"
                />
                <Button variant="outline" size="sm" onClick={() => ask(drillDown)}>
                  <ArrowRight className="size-3 mr-1" />
                  追问
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function MetricCenter() {
  const [metrics, setMetrics] = useState<DataMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataApi.listMetrics().then((data) => {
      setMetrics(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {loading && <div className="text-center py-4 text-muted-foreground">加载中...</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <StatCard
            key={m.id}
            label={m.name}
            value={m.value}
            unit={m.unit}
            trend={m.trend}
            icon={BarChart3}
          />
        ))}
        {!loading && metrics.length === 0 && (
          <div className="col-span-full text-center py-4 text-muted-foreground">暂无指标数据</div>
        )}
      </div>

      <Tabs defaultValue="def">
        <TabsList>
          <TabsTrigger value="def">指标定义</TabsTrigger>
          <TabsTrigger value="dimension">维度</TabsTrigger>
          <TabsTrigger value="atom">原子指标</TabsTrigger>
          <TabsTrigger value="derive">派生指标</TabsTrigger>
        </TabsList>
        <TabsContent value="def" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>指标名</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>计算公式</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>日销售额</TableCell>
                    <TableCell>销售</TableCell>
                    <TableCell><Badge>原子</Badge></TableCell>
                    <TableCell className="font-mono text-xs">SUM(订单.金额)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>月环比</TableCell>
                    <TableCell>销售</TableCell>
                    <TableCell><Badge variant="secondary">派生</Badge></TableCell>
                    <TableCell className="font-mono text-xs">(本月-上月)/上月</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>客单价</TableCell>
                    <TableCell>销售</TableCell>
                    <TableCell><Badge variant="secondary">派生</Badge></TableCell>
                    <TableCell className="font-mono text-xs">销售额/订单数</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>复购率</TableCell>
                    <TableCell>客户</TableCell>
                    <TableCell><Badge variant="secondary">派生</Badge></TableCell>
                    <TableCell className="font-mono text-xs">复购客户/总客户</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dimension" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">维度管理</CardTitle>
              <CardDescription>时间 / 地域 / 客户 / 产品 / 渠道</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { name: "时间维度", count: 8, icon: Clock },
                  { name: "地域维度", count: 32, icon: Globe },
                  { name: "客户维度", count: 12, icon: Handshake },
                  { name: "产品维度", count: 24, icon: Package },
                  { name: "渠道维度", count: 6, icon: Megaphone },
                ].map((d) => (
                  <div key={d.name} className="rounded-lg border p-3 text-center">
                    <div className="text-2xl"><d.icon className="size-6" /></div>
                    <div className="font-medium text-sm mt-1">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.count} 项</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="atom" className="mt-4">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              原子指标是不可再分的基础指标（如 SUM、COUNT、AVG 等聚合运算）。示例：销售额、订单数、用户数。
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="derive" className="mt-4">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              派生指标由原子指标 + 维度 + 修饰词 计算得出。示例：华东区 7 月新客销售额、30 日复购率。
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────── DecisionPush ─────────────────── */
const DECISION_RULES = [
  { id: 1, name: "库存预警自动补货", condition: "库存 < 安全库存 * 0.3", target: "采购审批", status: "active", hits: 320 },
  { id: 2, name: "大额订单审批通知", condition: "订单金额 > 50万", target: "高管审批", status: "active", hits: 48 },
  { id: 3, name: "客户流失预警", condition: "30天无订单 + 账期逾期", target: "销售跟进", status: "active", hits: 156 },
  { id: 4, name: "合同到期提醒", condition: "合同到期 < 30天", target: "法务提醒", status: "paused", hits: 23 },
];

export function DecisionPush() {
  const [rules, setRules] = useState(DECISION_RULES);

  function toggleRule(id: number) {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, status: r.status === "active" ? "paused" : "active" } : r));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="决策推送"
        description="基于数据指标的自动化决策规则与消息推送"
        action={
          <Button className="gap-2">
            <Plus className="size-4" /> 新建规则
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="规则总数" value={rules.length} icon={Zap} />
        <StatCard label="已启用" value={rules.filter((r) => r.status === "active").length} icon={Activity} />
        <StatCard label="本月触发" value="2,480" icon={Bell} />
        <StatCard label="推送成功率" value="99.2%" icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4" /> 决策规则
          </CardTitle>
          <CardDescription>当指标满足条件时自动触发推送</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则名称</TableHead>
                <TableHead>触发条件</TableHead>
                <TableHead>推送目标</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">本月触发</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.condition}</TableCell>
                  <TableCell><Badge variant="outline">{r.target}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {r.status === "active" ? "已启用" : "已暂停"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{r.hits}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleRule(r.id)}>
                      {r.status === "active" ? "暂停" : "启用"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── DataLakehouse ─────────────────── */
const LAKE_TABLES = [
  { name: "ods_orders", layer: "ODS", rows: "12,480,000", size: "4.2 GB", updated: "2 分钟前", format: "Parquet" },
  { name: "dwd_order_detail", layer: "DWD", rows: "12,480,000", size: "3.8 GB", updated: "5 分钟前", format: "Parquet" },
  { name: "dws_sales_daily", layer: "DWS", rows: "365,000", size: "128 MB", updated: "1 小时前", format: "Parquet" },
  { name: "ads_dashboard_metrics", layer: "ADS", rows: "2,400", size: "2.1 MB", updated: "1 小时前", format: "Parquet" },
  { name: "dim_customer", layer: "DIM", rows: "89,200", size: "56 MB", updated: "每天 02:00", format: "ORC" },
  { name: "raw_behavior_log", layer: "RAW", rows: "520,000,000", size: "128 GB", updated: "实时", format: "JSON" },
];

export function DataLakehouse() {
  const [filter, setFilter] = useState("all");
  const layers = ["all", "RAW", "ODS", "DWD", "DWS", "ADS", "DIM"];
  const filtered = filter === "all" ? LAKE_TABLES : LAKE_TABLES.filter((t) => t.layer === filter);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="数据湖仓"
        description="统一存储 Raw / ODS / DWD / DWS / ADS 分层数据"
        action={
          <Button variant="outline" className="gap-2">
            <Plus className="size-4" /> 新建表
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="表总数" value={LAKE_TABLES.length} icon={Database} />
        <StatCard label="总存储" value="136.2 GB" icon={HardDrive} />
        <StatCard label="总行数" value="5.33 亿" icon={BarChart3} />
        <StatCard label="存储层" value={6} icon={Layers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Warehouse className="size-4" /> 湖仓表管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {layers.map((l) => (
              <Button key={l} variant={filter === l ? "default" : "outline"} size="sm" onClick={() => setFilter(l)}>
                {l === "all" ? "全部" : l}
              </Button>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>表名</TableHead>
                <TableHead>层级</TableHead>
                <TableHead>行数</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>格式</TableHead>
                <TableHead>最后更新</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="font-mono text-xs font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="outline">{t.layer}</Badge></TableCell>
                  <TableCell className="text-xs">{t.rows}</TableCell>
                  <TableCell className="text-xs">{t.size}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{t.format}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.updated}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8"><Eye className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── DataKnowledge ─────────────────── */
const DATA_DOCS = [
  { id: 1, title: "订单数据字典", category: "数据字典", objects: 12, lastUpdate: "2 天前", status: "published" },
  { id: 2, title: "客户主数据模型", category: "数据模型", objects: 8, lastUpdate: "1 周前", status: "published" },
  { id: 3, title: "ETL 调度手册", category: "运维手册", objects: 0, lastUpdate: "3 天前", status: "draft" },
  { id: 4, title: "指标计算口径说明", category: "业务文档", objects: 24, lastUpdate: "今天", status: "published" },
  { id: 5, title: "数据质量规则清单", category: "质量规范", objects: 56, lastUpdate: "昨天", status: "published" },
];

export function DataKnowledge() {
  const [docs] = useState(DATA_DOCS);
  const [search, setSearch] = useState("");

  const filtered = docs.filter((d) => d.title.includes(search) || d.category.includes(search));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="数据知识库"
        description="数据字典、模型文档与业务口径说明"
        action={
          <Button className="gap-2">
            <Plus className="size-4" /> 新建文档
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="文档总数" value={docs.length} icon={BookOpen} />
        <StatCard label="已发布" value={docs.filter((d) => d.status === "published").length} icon={CheckCircle2} />
        <StatCard label="覆盖对象" value={docs.reduce((s, d) => s + d.objects, 0)} icon={Database} />
        <StatCard label="分类数" value={new Set(docs.map((d) => d.category)).size} icon={Layers} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="size-4" /> 数据文档
            </CardTitle>
            <CardDescription>{filtered.length} 篇文档</CardDescription>
          </div>
          <div className="relative">
            <Search className="size-3 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索文档..." className="pl-7 h-8 w-48 text-sm" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((d) => (
              <div key={d.id} className="rounded-lg border p-4 hover:border-primary cursor-pointer transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{d.category}</div>
                  </div>
                  <Badge variant={d.status === "published" ? "default" : "secondary"}>
                    {d.status === "published" ? "已发布" : "草稿"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  {d.objects > 0 && <span>{d.objects} 个对象</span>}
                  <span>更新于 {d.lastUpdate}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DataQuality() {
  const [rules, setRules] = useState(QUALITY_RULES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ table: "", rule: "", severity: "warning" });

  function handleAddRule() {
    if (!form.table.trim() || !form.rule.trim()) return;
    setRules((prev) => [...prev, { id: prev.length + 1, table: form.table, rule: form.rule, severity: form.severity, status: "passed", coverage: 100 }]);
    setDialogOpen(false);
    setForm({ table: "", rule: "", severity: "warning" });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4" /> 数据质量监控
          </CardTitle>
          <CardDescription>{rules.length} 条规则，覆盖 6 张表</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新增规则
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>表名</TableHead>
              <TableHead>规则</TableHead>
              <TableHead>级别</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">覆盖率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.table}</TableCell>
                <TableCell>{r.rule}</TableCell>
                <TableCell>
                  <Badge variant={r.severity === "error" ? "destructive" : "outline"}>{r.severity === "error" ? "错误" : "警告"}</Badge>
                </TableCell>
                <TableCell>
                  {r.status === "passed" && <Badge variant="secondary" className="text-green-600">通过</Badge>}
                  {r.status === "failed" && <Badge variant="destructive">失败</Badge>}
                  {r.status === "warning" && <Badge variant="outline" className="text-orange-500">警告</Badge>}
                </TableCell>
                <TableCell className="text-right">{r.coverage}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增质量规则</DialogTitle>
            <DialogDescription>定义数据质量校验规则</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>表名</Label>
              <Input value={form.table} onChange={(e) => setForm((f) => ({ ...f, table: e.target.value }))} placeholder="如：customer" />
            </div>
            <div className="space-y-2">
              <Label>规则</Label>
              <Input value={form.rule} onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value }))} placeholder="如：客户编号 NOT NULL" />
            </div>
            <div className="space-y-2">
              <Label>级别</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">错误</SelectItem>
                  <SelectItem value="warning">警告</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddRule}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ETLTasks() {
  const [tasks, setTasks] = useState(ETL_TASKS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", source: "", target: "", schedule: "" });

  function handleAddTask() {
    if (!form.name.trim()) return;
    setTasks((prev) => [...prev, {
      id: prev.length + 1,
      name: form.name,
      source: form.source,
      target: form.target,
      schedule: form.schedule || "手动",
      status: "running",
      duration: "-",
      lastRun: "刚刚创建",
    }]);
    setDialogOpen(false);
    setForm({ name: "", source: "", target: "", schedule: "" });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <GitMerge className="size-4" /> ETL 任务
          </CardTitle>
          <CardDescription>数据抽取-转换-加载任务编排</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新建 ETL
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>任务名</TableHead>
              <TableHead>源 → 目标</TableHead>
              <TableHead>调度</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>上次运行</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-mono">{t.source}</span>
                    <span>→</span>
                    <span className="font-mono">{t.target}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{t.schedule}</TableCell>
                <TableCell className="text-xs">{t.duration}</TableCell>
                <TableCell className="text-xs">{t.lastRun}</TableCell>
                <TableCell>
                  {t.status === "running" && <Badge className="bg-blue-500">运行中</Badge>}
                  {t.status === "completed" && <Badge variant="secondary" className="text-green-600">完成</Badge>}
                  {t.status === "failed" && <Badge variant="destructive">失败</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 ETL 任务</DialogTitle>
            <DialogDescription>配置数据抽取-转换-加载任务</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>任务名</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：订单同步" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>数据源</Label>
                <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="如：MySQL 订单库" />
              </div>
              <div className="space-y-2">
                <Label>目标</Label>
                <Input value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="如：DWD 层" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>调度</Label>
              <Input value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} placeholder="如：每小时 / 每天 02:00 / 手动" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddTask}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function RealTimeMonitor() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4 text-green-500 animate-pulse" /> 实时数据流
        </CardTitle>
        <CardDescription>实时同步事件（每 5 秒刷新）</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {REAL_TIME.map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-2 border rounded text-sm">
              <Clock className="size-3 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{e.time}</span>
              <span className="flex-1 truncate">{e.event}</span>
              <Badge variant="outline" className="text-xs">{e.source}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────── ChartGallery (Advanced BI Charts) ─────────────────── */
interface ChartType {
  id: string;
  name: string;
  description: string;
  icon: typeof BarChart3;
  category: string;
}

const CHART_TYPES: ChartType[] = [
  { id: "bar", name: "柱状图", description: "比较不同类别的数值大小", icon: BarChart3, category: "基础" },
  { id: "line", name: "折线图", description: "展示数据随时间的变化趋势", icon: TrendingUp, category: "基础" },
  { id: "pie", name: "饼图", description: "展示各部分占整体的比例", icon: PieChart, category: "基础" },
  { id: "area", name: "面积图", description: "强调数据变化的趋势和累积", icon: TrendingUp, category: "基础" },
  { id: "scatter", name: "散点图", description: "展示两个变量之间的关系", icon: Circle, category: "统计" },
  { id: "radar", name: "雷达图", description: "多维度数据对比分析", icon: Activity, category: "统计" },
  { id: "funnel", name: "漏斗图", description: "展示各阶段的转化率", icon: Filter, category: "业务" },
  { id: "heatmap", name: "热力图", description: "用颜色深浅表示数据密度", icon: Layers, category: "统计" },
  { id: "sankey", name: "桑基图", description: "展示数据流向和转化", icon: GitMerge, category: "高级" },
  { id: "gauge", name: "仪表盘", description: "展示单一指标的完成度", icon: Ruler, category: "业务" },
  { id: "waterfall", name: "水球图", description: "展示指标的完成比例", icon: Droplets, category: "业务" },
  { id: "candlestick", name: "K线图", description: "展示金融数据的开盘收盘", icon: Activity, category: "金融" },
  { id: "treemap", name: "矩形树图", description: "展示层次结构数据", icon: Layers, category: "高级" },
  { id: "boxplot", name: "箱线图", description: "展示数据分布和异常值", icon: BarChart3, category: "统计" },
];

export function ChartGallery() {
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");

  const categories = ["all", ...new Set(CHART_TYPES.map((c) => c.category))];
  const filteredCharts = filterCategory === "all" ? CHART_TYPES : CHART_TYPES.filter((c) => c.category === filterCategory);

  // Mini chart preview renderers
  function renderMiniBarChart() {
    const data = [30, 50, 40, 60, 45, 55, 35];
    const max = Math.max(...data);
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        {data.map((v, i) => (
          <rect key={i} x={i * 15 + 2} y={60 - (v / max) * 50} width="10" height={(v / max) * 50} fill="#3b82f6" rx="2" />
        ))}
      </svg>
    );
  }

  function renderMiniLineChart() {
    const data = [20, 35, 25, 45, 30, 50, 40];
    const max = Math.max(...data);
    const points = data.map((v, i) => `${i * 16 + 2},${60 - (v / max) * 50}`).join(" ");
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" />
        {data.map((v, i) => (
          <circle key={i} cx={i * 16 + 2} cy={60 - (v / max) * 50} r="2" fill="#10b981" />
        ))}
      </svg>
    );
  }

  function renderMiniPieChart() {
    const data = [35, 25, 20, 20];
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
    const total = data.reduce((a, b) => a + b, 0);
    let startAngle = -Math.PI / 2;
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        {data.map((v, i) => {
          const angle = (v / total) * Math.PI * 2;
          const endAngle = startAngle + angle;
          const x1 = 50 + 25 * Math.cos(startAngle);
          const y1 = 30 + 25 * Math.sin(startAngle);
          const x2 = 50 + 25 * Math.cos(endAngle);
          const y2 = 30 + 25 * Math.sin(endAngle);
          const largeArc = angle > Math.PI ? 1 : 0;
          const path = `M 50 30 L ${x1} ${y1} A 25 25 0 ${largeArc} 1 ${x2} ${y2} Z`;
          startAngle = endAngle;
          return <path key={i} d={path} fill={colors[i]} />;
        })}
      </svg>
    );
  }

  function renderMiniAreaChart() {
    const data = [20, 35, 25, 45, 30, 50, 40];
    const max = Math.max(...data);
    const points = data.map((v, i) => `${i * 16 + 2},${60 - (v / max) * 50}`).join(" ");
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <polygon points={`2,60 ${points} 98,60`} fill="#8b5cf6" fillOpacity="0.3" />
        <polyline points={points} fill="none" stroke="#8b5cf6" strokeWidth="2" />
      </svg>
    );
  }

  function renderMiniScatterChart() {
    const points = [[15, 20], [25, 35], [35, 15], [45, 45], [55, 30], [65, 50], [75, 25], [85, 40]];
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#f59e0b" fillOpacity="0.7" />
        ))}
      </svg>
    );
  }

  function renderMiniRadarChart() {
    const cx = 50, cy = 30, r = 22;
    const angles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5 - Math.PI / 2);
    const data = [0.8, 0.6, 0.9, 0.7, 0.5];
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        {angles.map((a, i) => {
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />;
        })}
        <polygon
          points={data.map((v, i) => `${cx + r * v * Math.cos(angles[i])},${cy + r * v * Math.sin(angles[i])}`).join(" ")}
          fill="#ef4444"
          fillOpacity="0.3"
          stroke="#ef4444"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  function renderMiniFunnelChart() {
    const data = [100, 80, 60, 40, 20];
    const colors = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#c084fc"];
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        {data.map((v, i) => {
          const w = v * 0.8;
          const x = (100 - w) / 2;
          return <rect key={i} x={x} y={i * 12 + 2} width={w} height="10" fill={colors[i]} rx="2" />;
        })}
      </svg>
    );
  }

  function renderMiniHeatmapChart() {
    const colors = ["#dbeafe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb"];
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 7 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={col * 14 + 2}
              y={row * 12 + 2}
              width="12"
              height="10"
              fill={colors[Math.floor(Math.random() * 5)]}
              rx="1"
            />
          ))
        )}
      </svg>
    );
  }

  function renderMiniGaugeChart() {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round" />
        <path d="M 15 50 A 35 35 0 0 1 65 20" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
        <circle cx="50" cy="50" r="4" fill="#1f2937" />
        <line x1="50" y1="50" x2="65" y2="25" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  function renderMiniChart(chartId: string) {
    switch (chartId) {
      case "bar": return renderMiniBarChart();
      case "line": return renderMiniLineChart();
      case "pie": return renderMiniPieChart();
      case "area": return renderMiniAreaChart();
      case "scatter": return renderMiniScatterChart();
      case "radar": return renderMiniRadarChart();
      case "funnel": return renderMiniFunnelChart();
      case "heatmap": return renderMiniHeatmapChart();
      case "gauge": return renderMiniGaugeChart();
      default: return renderMiniBarChart();
    }
  }

  // Full chart renderers for demo
  function renderFullBarChart() {
    const data = [
      { label: "电子产品", value: 4523800 },
      { label: "服装鞋帽", value: 3128400 },
      { label: "食品饮料", value: 2156800 },
      { label: "家居用品", value: 1845200 },
      { label: "其他", value: 832129 },
    ];
    const maxVal = Math.max(...data.map((d) => d.value));
    const barWidth = 60;
    return (
      <svg width="100%" viewBox="0 0 500 300" className="overflow-visible">
        {data.map((item, i) => {
          const barHeight = (item.value / maxVal) * 220;
          const x = i * (barWidth + 20) + 50;
          const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
          return (
            <g key={i}>
              <rect x={x} y={260 - barHeight} width={barWidth} height={barHeight} fill={colors[i]} rx="4" />
              <text x={x + barWidth / 2} y={275} textAnchor="middle" className="text-[10px] fill-muted-foreground">{item.label}</text>
              <text x={x + barWidth / 2} y={255 - barHeight} textAnchor="middle" className="text-[9px] fill-foreground font-medium">{(item.value / 10000).toFixed(0)}万</text>
            </g>
          );
        })}
      </svg>
    );
  }

  function renderFullLineChart() {
    const data = [
      { label: "1月", value: 185 }, { label: "2月", value: 212 }, { label: "3月", value: 198 },
      { label: "4月", value: 235 }, { label: "5月", value: 268 }, { label: "6月", value: 245 },
    ];
    const maxVal = Math.max(...data.map((d) => d.value));
    const minVal = Math.min(...data.map((d) => d.value));
    const points = data.map((d, i) => ({
      x: 50 + i * 80,
      y: 240 - ((d.value - minVal) / (maxVal - minVal)) * 180,
      ...d,
    }));
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return (
      <svg width="100%" viewBox="0 0 500 280" className="overflow-visible">
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
            <text x={p.x} y={260} textAnchor="middle" className="text-[10px] fill-muted-foreground">{p.label}</text>
            <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[9px] fill-foreground">{p.value}万</text>
          </g>
        ))}
      </svg>
    );
  }

  function renderFullPieChart() {
    const data = [
      { label: "华东", value: 35 }, { label: "华南", value: 25 }, { label: "华北", value: 20 },
      { label: "西南", value: 12 }, { label: "其他", value: 8 },
    ];
    const total = data.reduce((a, b) => a + b.value, 0);
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    let startAngle = -Math.PI / 2;
    return (
      <svg width="100%" viewBox="0 0 500 280" className="overflow-visible">
        {data.map((item, i) => {
          const angle = (item.value / total) * Math.PI * 2;
          const endAngle = startAngle + angle;
          const largeArc = angle > Math.PI ? 1 : 0;
          const x1 = 180 + 100 * Math.cos(startAngle);
          const y1 = 140 + 100 * Math.sin(startAngle);
          const x2 = 180 + 100 * Math.cos(endAngle);
          const y2 = 140 + 100 * Math.sin(endAngle);
          const midAngle = startAngle + angle / 2;
          const lx = 180 + 65 * Math.cos(midAngle);
          const ly = 140 + 65 * Math.sin(midAngle);
          const path = `M 180 140 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`;
          startAngle = endAngle;
          return (
            <g key={i}>
              <path d={path} fill={colors[i]} stroke="white" strokeWidth="2" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="text-[11px] fill-white font-medium">{item.value}%</text>
            </g>
          );
        })}
        {data.map((item, i) => (
          <g key={i} transform={`translate(320, ${40 + i * 28})`}>
            <rect width="14" height="14" fill={colors[i]} rx="3" />
            <text x="20" y="12" className="text-[11px] fill-foreground">{item.label}</text>
          </g>
        ))}
      </svg>
    );
  }

  function renderFullRadarChart() {
    const categories = ["销售", "技术", "市场", "运营", "客服"];
    const data = [85, 70, 90, 65, 80];
    const cx = 200, cy = 140, r = 100;
    const angles = categories.map((_, i) => (i * Math.PI * 2) / categories.length - Math.PI / 2);
    return (
      <svg width="100%" viewBox="0 0 500 280" className="overflow-visible">
        {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={angles.map((a) => `${cx + r * ratio * Math.cos(a)},${cy + r * ratio * Math.sin(a)}`).join(" ")}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="0.5"
          />
        ))}
        {angles.map((a, i) => (
          <g key={i}>
            <line x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={cx + (r + 15) * Math.cos(a)} y={cy + (r + 15) * Math.sin(a)} textAnchor="middle" className="text-[11px] fill-foreground">{categories[i]}</text>
          </g>
        ))}
        <polygon
          points={data.map((v, i) => `${cx + r * (v / 100) * Math.cos(angles[i])},${cy + r * (v / 100) * Math.sin(angles[i])}`).join(" ")}
          fill="#3b82f6"
          fillOpacity="0.3"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        {data.map((v, i) => (
          <circle key={i} cx={cx + r * (v / 100) * Math.cos(angles[i])} cy={cy + r * (v / 100) * Math.sin(angles[i])} r="4" fill="#3b82f6" />
        ))}
      </svg>
    );
  }

  function renderFullGaugeChart() {
    const value = 72;
    const startAngle = -210;
    const endAngle = 30;
    const range = endAngle - startAngle;
    const valueAngle = startAngle + (value / 100) * range;
    const cx = 200, cy = 160, r = 120;
    return (
      <svg width="100%" viewBox="0 0 500 300" className="overflow-visible">
        <path
          d={`M ${cx + r * Math.cos((startAngle * Math.PI) / 180)} ${cy + r * Math.sin((startAngle * Math.PI) / 180)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos((endAngle * Math.PI) / 180)} ${cy + r * Math.sin((endAngle * Math.PI) / 180)}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx + r * Math.cos((startAngle * Math.PI) / 180)} ${cy + r * Math.sin((startAngle * Math.PI) / 180)} A ${r} ${r} 0 ${valueAngle - startAngle > 180 ? 1 : 0} 1 ${cx + r * Math.cos((valueAngle * Math.PI) / 180)} ${cy + r * Math.sin((valueAngle * Math.PI) / 180)}`}
          fill="none"
          stroke="#10b981"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <text x={cx} y={cy + 20} textAnchor="middle" className="text-[36px] font-bold fill-foreground">{value}%</text>
        <text x={cx} y={cy + 45} textAnchor="middle" className="text-[14px] fill-muted-foreground">完成率</text>
      </svg>
    );
  }

  function renderFullChart(chartId: string) {
    switch (chartId) {
      case "bar": return renderFullBarChart();
      case "line": return renderFullLineChart();
      case "pie": return renderFullPieChart();
      case "radar": return renderFullRadarChart();
      case "gauge": return renderFullGaugeChart();
      default: return renderFullBarChart();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4" /> 图表库
              </CardTitle>
              <CardDescription>{CHART_TYPES.length} 种可视化图表类型</CardDescription>
            </div>
            <div className="flex gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={filterCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat === "all" ? "全部" : cat}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredCharts.map((chart) => {
              const Icon = chart.icon;
              return (
                <button
                  key={chart.id}
                  onClick={() => setSelectedChart(chart)}
                  className={`p-4 border rounded-lg text-left hover:border-primary transition-all ${
                    selectedChart?.id === chart.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : ""
                  }`}
                >
                  <div className="h-24 mb-3 bg-muted/30 rounded flex items-center justify-center">
                    {renderMiniChart(chart.id)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <span className="font-medium text-sm">{chart.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{chart.description}</div>
                  <Badge variant="outline" className="mt-2 text-[10px]">{chart.category}</Badge>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Chart Demo */}
      {selectedChart && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {(() => { const Icon = selectedChart.icon; return <Icon className="size-4" />; })()}
                  {selectedChart.name} - 交互演示
                </CardTitle>
                <CardDescription>{selectedChart.description}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedChart(null)}>
                关闭演示
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-white">
              {renderFullChart(selectedChart.id)}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Badge variant="secondary">图表类型: {selectedChart.name}</Badge>
              <Badge variant="outline">分类: {selectedChart.category}</Badge>
              <span className="text-xs text-muted-foreground">点击其他图表类型切换演示</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Droplets icon for water ball chart (inline since not in lucide)
function Droplets(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </svg>
  );
}

/* ─────────────────── DataLineage ─────────────────── */
type LineageNodeType = "source" | "etl" | "table" | "metric" | "dashboard";

interface LineageNode {
  id: string;
  name: string;
  type: LineageNodeType;
  description: string;
  status: "active" | "inactive" | "error";
}

interface LineageEdge {
  from: string;
  to: string;
}

const LINEAGE_NODES: LineageNode[] = [
  { id: "src-mysql", name: "MySQL 订单库", type: "source", description: "主订单数据库", status: "active" },
  { id: "src-pg", name: "PostgreSQL CRM", type: "source", description: "客户关系管理系统", status: "active" },
  { id: "src-kafka", name: "Kafka 行为日志", type: "source", description: "用户行为日志流", status: "active" },
  { id: "src-erp", name: "ERP 系统", type: "source", description: "企业资源规划系统", status: "active" },
  { id: "etl-order", name: "订单 ETL", type: "etl", description: "订单数据抽取转换", status: "active" },
  { id: "etl-customer", name: "客户 ETL", type: "etl", description: "客户数据清洗", status: "active" },
  { id: "etl-behavior", name: "行为 ETL", type: "etl", description: "行为日志解析", status: "active" },
  { id: "tbl-dwd", name: "DWD 订单明细", type: "table", description: "明细数据层", status: "active" },
  { id: "tbl-dws", name: "DWS 销售汇总", type: "table", description: "汇总数据层", status: "active" },
  { id: "tbl-dim", name: "DIM 客户维度", type: "table", description: "维度表", status: "active" },
  { id: "metric-sales", name: "销售指标", type: "metric", description: "销售额、客单价等", status: "active" },
  { id: "metric-customer", name: "客户指标", type: "metric", description: "客户数、复购率等", status: "active" },
  { id: "dash-sales", name: "销售看板", type: "dashboard", description: "销售数据可视化", status: "active" },
  { id: "dash-customer", name: "客户看板", type: "dashboard", description: "客户数据分析", status: "active" },
];

const LINEAGE_EDGES: LineageEdge[] = [
  { from: "src-mysql", to: "etl-order" },
  { from: "src-pg", to: "etl-customer" },
  { from: "src-kafka", to: "etl-behavior" },
  { from: "src-erp", to: "etl-order" },
  { from: "etl-order", to: "tbl-dwd" },
  { from: "etl-customer", to: "tbl-dim" },
  { from: "etl-behavior", to: "tbl-dwd" },
  { from: "tbl-dwd", to: "tbl-dws" },
  { from: "tbl-dim", to: "tbl-dws" },
  { from: "tbl-dws", to: "metric-sales" },
  { from: "tbl-dws", to: "metric-customer" },
  { from: "tbl-dim", to: "metric-customer" },
  { from: "metric-sales", to: "dash-sales" },
  { from: "metric-customer", to: "dash-customer" },
];

const NODE_COLORS: Record<LineageNodeType, { bg: string; border: string; text: string; icon: typeof Database }> = {
  source: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", icon: Database },
  etl: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", icon: GitMerge },
  table: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700", icon: TableIcon },
  metric: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", icon: BarChart3 },
  dashboard: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", icon: Eye },
};

export function DataLineage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [filterType, setFilterType] = useState<LineageNodeType | "all">("all");

  const filteredNodes = LINEAGE_NODES.filter((node) => {
    const matchesSearch = node.name.includes(searchTerm) || node.description.includes(searchTerm);
    const matchesType = filterType === "all" || node.type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Calculate node positions for SVG layout
  const getNodePosition = (node: LineageNode, index: number) => {
    const typeOrder: LineageNodeType[] = ["source", "etl", "table", "metric", "dashboard"];
    const col = typeOrder.indexOf(node.type);
    const nodesOfType = LINEAGE_NODES.filter((n) => n.type === node.type);
    const row = nodesOfType.findIndex((n) => n.id === node.id);
    const totalRows = nodesOfType.length;

    const x = 80 + col * 160;
    const y = 80 + (row - (totalRows - 1) / 2) * 80 + 200;

    return { x, y };
  };

  const nodePositions = new Map(LINEAGE_NODES.map((node, i) => [node.id, getNodePosition(node, i)]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GitMerge className="size-4" /> 数据血缘
              </CardTitle>
              <CardDescription>追踪数据从源头到应用的完整链路</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索节点..."
                  className="pl-7 h-8 w-48 text-sm"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as LineageNodeType | "all")}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="source">数据源</SelectItem>
                  <SelectItem value="etl">ETL 任务</SelectItem>
                  <SelectItem value="table">数据表</SelectItem>
                  <SelectItem value="metric">指标</SelectItem>
                  <SelectItem value="dashboard">看板</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* SVG Graph */}
            <div className="flex-1 border rounded-lg bg-gray-50 overflow-auto" style={{ minHeight: "500px" }}>
              <svg width="100%" height="500" viewBox="0 0 900 500">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                  </marker>
                </defs>

                {/* Edges */}
                {LINEAGE_EDGES.map((edge, i) => {
                  const fromPos = nodePositions.get(edge.from);
                  const toPos = nodePositions.get(edge.to);
                  if (!fromPos || !toPos) return null;

                  const fromNode = LINEAGE_NODES.find((n) => n.id === edge.from);
                  const toNode = LINEAGE_NODES.find((n) => n.id === edge.to);
                  const isFiltered = filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to);

                  return (
                    <g key={i} opacity={isFiltered ? 1 : 0.2}>
                      <path
                        d={`M ${fromPos.x + 60} ${fromPos.y + 20} C ${fromPos.x + 110} ${fromPos.y + 20}, ${toPos.x - 50} ${toPos.y + 20}, ${toPos.x} ${toPos.y + 20}`}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        markerEnd="url(#arrowhead)"
                      />
                    </g>
                  );
                })}

                {/* Nodes */}
                {LINEAGE_NODES.map((node) => {
                  const pos = nodePositions.get(node.id);
                  if (!pos) return null;
                  const colors = NODE_COLORS[node.type];
                  const Icon = colors.icon;
                  const isFiltered = filteredNodeIds.has(node.id);
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => setSelectedNode(node)}
                      className="cursor-pointer"
                      opacity={isFiltered ? 1 : 0.3}
                    >
                      <rect
                        width="120"
                        height="40"
                        rx="6"
                        fill={isSelected ? "#dbeafe" : "white"}
                        stroke={isSelected ? "#3b82f6" : "#d1d5db"}
                        strokeWidth={isSelected ? "2" : "1"}
                      />
                      <foreignObject x="8" y="8" width="24" height="24">
                        <Icon className={`size-6 ${colors.text}`} />
                      </foreignObject>
                      <text x="36" y="16" className="text-[11px] font-medium fill-foreground" dominantBaseline="middle">
                        {node.name.length > 10 ? node.name.substring(0, 10) + "..." : node.name}
                      </text>
                      <text x="36" y="30" className="text-[9px] fill-muted-foreground" dominantBaseline="middle">
                        {node.type === "source" ? "数据源" : node.type === "etl" ? "ETL" : node.type === "table" ? "数据表" : node.type === "metric" ? "指标" : "看板"}
                      </text>
                      {node.status === "error" && (
                        <circle cx="112" cy="8" r="4" fill="#ef4444" />
                      )}
                    </g>
                  );
                })}

                {/* Legend */}
                <g transform="translate(20, 460)">
                  {Object.entries(NODE_COLORS).map(([type, colors], i) => (
                    <g key={type} transform={`translate(${i * 120}, 0)`}>
                      <rect width="12" height="12" rx="2" fill={colors.bg} stroke={colors.border} />
                      <text x="16" y="10" className="text-[10px] fill-foreground">
                        {type === "source" ? "数据源" : type === "etl" ? "ETL 任务" : type === "table" ? "数据表" : type === "metric" ? "指标" : "看板"}
                      </text>
                    </g>
                  ))}
                </g>
              </svg>
            </div>

            {/* Node Detail Panel */}
            {selectedNode && (
              <Card className="w-64 shrink-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {(() => { const Icon = NODE_COLORS[selectedNode.type].icon; return <Icon className="size-4" />; })()}
                      节点详情
                    </span>
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => setSelectedNode(null)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">名称</Label>
                    <div className="font-medium">{selectedNode.name}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">类型</Label>
                    <div>
                      <Badge variant="outline" className={NODE_COLORS[selectedNode.type].text}>
                        {selectedNode.type === "source" ? "数据源" : selectedNode.type === "etl" ? "ETL 任务" : selectedNode.type === "table" ? "数据表" : selectedNode.type === "metric" ? "指标" : "看板"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">描述</Label>
                    <div className="text-sm">{selectedNode.description}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">状态</Label>
                    <div>
                      <Badge variant={selectedNode.status === "active" ? "default" : "destructive"}>
                        {selectedNode.status === "active" ? "正常" : "异常"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">上游节点</Label>
                    <div className="text-sm">
                      {LINEAGE_EDGES.filter((e) => e.to === selectedNode.id).map((e) => {
                        const node = LINEAGE_NODES.find((n) => n.id === e.from);
                        return node ? (
                          <Badge key={e.from} variant="secondary" className="mr-1 mb-1">{node.name}</Badge>
                        ) : null;
                      }) || "无"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">下游节点</Label>
                    <div className="text-sm">
                      {LINEAGE_EDGES.filter((e) => e.from === selectedNode.id).map((e) => {
                        const node = LINEAGE_NODES.find((n) => n.id === e.to);
                        return node ? (
                          <Badge key={e.to} variant="secondary" className="mr-1 mb-1">{node.name}</Badge>
                        ) : null;
                      }) || "无"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Node List */}
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">节点列表 ({filteredNodes.length})</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {filteredNodes.map((node) => {
                const colors = NODE_COLORS[node.type];
                const Icon = colors.icon;
                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-2 border rounded-lg text-left text-xs hover:border-primary transition-colors ${
                      selectedNode?.id === node.id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`size-3.5 ${colors.text}`} />
                      <span className="font-medium truncate">{node.name}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate">{node.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── Chinese-style Reports (F6.8.6) ─────────────────── */
interface ReportTemplate {
  id: string;
  name: string;
  desc: string;
  icon: typeof FileBarChart;
  category: string;
  frequency: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  { id: "sales-daily", name: "销售日报", desc: "每日销售数据汇总，含区域对比", icon: TrendingUp, category: "销售", frequency: "每日" },
  { id: "inventory-monthly", name: "库存月报", desc: "月度库存变动与周转分析", icon: Warehouse, category: "供应链", frequency: "每月" },
  { id: "finance-quarterly", name: "财务季报", desc: "季度财务三表合并分析", icon: FileBarChart, category: "财务", frequency: "每季" },
  { id: "hr-annual", name: "人事年报", desc: "年度人力资源盘点报告", icon: Users, category: "人事", frequency: "每年" },
  { id: "project-weekly", name: "项目周报", desc: "每周项目进度与风险跟踪", icon: Clock, category: "项目", frequency: "每周" },
];

/* Sales Daily Report Data */
const SALES_DAILY_DATA = {
  headers: [
    [{ label: "区域", rowSpan: 2 }, { label: "销售额", colSpan: 3 }, { label: "订单", colSpan: 2 }],
    [{ label: "今日" }, { label: "昨日" }, { label: "环比" }, { label: "今日" }, { label: "累计" }],
  ],
  rows: [
    { region: "华东区", today: "¥1,286,400", yesterday: "¥1,198,200", growth: "+7.4%", ordersToday: 342, ordersTotal: "12,846", growthColor: "text-green-600" },
    { region: "华南区", today: "¥896,200", yesterday: "¥912,100", growth: "-1.7%", ordersToday: 231, ordersTotal: "8,923", growthColor: "text-red-600" },
    { region: "华北区", today: "¥756,800", yesterday: "¥698,400", growth: "+8.4%", ordersToday: 198, ordersTotal: "7,654", growthColor: "text-green-600" },
    { region: "西南区", today: "¥423,100", yesterday: "¥445,600", growth: "-5.1%", ordersToday: 112, ordersTotal: "4,312", growthColor: "text-red-600" },
    { region: "华中区", today: "¥312,500", yesterday: "¥298,700", growth: "+4.6%", ordersToday: 86, ordersTotal: "3,456", growthColor: "text-green-600" },
  ],
  totals: { region: "合计", today: "¥3,675,000", yesterday: "¥3,553,000", growth: "+3.4%", ordersToday: 969, ordersTotal: "37,191", growthColor: "text-green-600" },
};

/* Inventory Monthly Report Data */
const INVENTORY_DATA = {
  headers: [
    [{ label: "品类", rowSpan: 2 }, { label: "库存", colSpan: 3 }, { label: "周转", colSpan: 2 }],
    [{ label: "月初" }, { label: "月末" }, { label: "变动" }, { label: "周转天数" }, { label: "同比" }],
  ],
  rows: [
    { category: "电子产品", start: "45,230", end: "38,920", change: "-14.0%", turnover: "28天", yoy: "改善 3天", changeColor: "text-red-600" },
    { category: "服装鞋帽", start: "128,450", end: "142,100", change: "+10.6%", turnover: "45天", yoy: "恶化 5天", changeColor: "text-orange-600" },
    { category: "食品饮料", start: "67,800", end: "52,300", change: "-22.9%", turnover: "15天", yoy: "改善 2天", changeColor: "text-green-600" },
    { category: "家居用品", start: "89,600", end: "91,200", change: "+1.8%", turnover: "52天", yoy: "恶化 8天", changeColor: "text-orange-600" },
  ],
  totals: { category: "合计", start: "331,080", end: "324,520", change: "-2.0%", turnover: "35天", yoy: "改善 1天", changeColor: "text-green-600" },
};

export function ReportCenter() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (toast) {
    setTimeout(() => setToast(null), 2500);
  }

  function handleExport() {
    setToast("正在导出 Excel 文件...");
    setTimeout(() => setToast("Excel 导出完成"), 1500);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>}

      {/* Template Gallery */}
      {!selectedTemplate && !showCustomBuilder && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">报表模板</h2>
              <p className="text-xs text-muted-foreground">选择模板快速生成标准报表</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowCustomBuilder(true)}>
              <Plus className="size-3 mr-1" /> 自定义报表
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {REPORT_TEMPLATES.map((t) => (
              <Card key={t.id} className="hover:border-primary cursor-pointer transition-colors" onClick={() => setSelectedTemplate(t.id)}>
                <CardHeader className="pb-2">
                  <t.icon className="size-8 text-primary" />
                  <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                  <CardDescription>{t.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline">{t.category}</Badge>
                    <span>{t.frequency}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Custom Report Builder */}
      {showCustomBuilder && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">自定义报表构建器</CardTitle>
              <CardDescription>拖拽字段到行/列/值区域构建报表</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowCustomBuilder(false)}>返回</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {/* Available fields */}
              <div className="border rounded-lg p-3">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">可用字段</h4>
                <div className="space-y-1">
                  {["客户名称", "订单日期", "产品类别", "销售额", "数量", "地区", "销售渠道", "利润率"].map((f) => (
                    <div key={f} className="flex items-center gap-2 px-2 py-1.5 rounded border text-xs hover:bg-muted cursor-grab">
                      <GripVertical className="size-3 text-muted-foreground" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              {/* Row zone */}
              <div className="border-2 border-dashed rounded-lg p-3 min-h-[200px]">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">行 (行标签)</h4>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">地区</Badge>
                  <Badge variant="secondary">客户名称</Badge>
                </div>
              </div>
              {/* Column zone */}
              <div className="border-2 border-dashed rounded-lg p-3 min-h-[200px]">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">列 (列标签)</h4>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">产品类别</Badge>
                </div>
              </div>
              {/* Values zone */}
              <div className="border-2 border-dashed rounded-lg p-3 min-h-[200px]">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">值 (度量)</h4>
                <div className="flex flex-wrap gap-1">
                  <Badge>SUM(销售额)</Badge>
                  <Badge>COUNT(订单数)</Badge>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setToast("报表预览已生成"); }}>
                <Eye className="size-3 mr-1" /> 预览
              </Button>
              <Button size="sm" onClick={() => { setSelectedTemplate("custom"); setShowCustomBuilder(false); }}>
                生成报表
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Daily Report */}
      {selectedTemplate === "sales-daily" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">销售日报 - 2026年7月3日</CardTitle>
              <CardDescription>各区域销售数据汇总</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>返回</Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-3 mr-1" /> 导出 Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="size-3 mr-1" /> 打印
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead>
                  {SALES_DAILY_DATA.headers.map((row, ri) => (
                    <tr key={ri} className="bg-muted/50">
                      {row.map((h, ci) => (
                        <th
                          key={ci}
                          className="px-3 py-2 text-left font-medium border text-xs"
                          rowSpan={(h as { rowSpan?: number }).rowSpan}
                          colSpan={(h as { colSpan?: number }).colSpan}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {SALES_DAILY_DATA.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 border font-medium">{r.region}</td>
                      <td className="px-3 py-2 border text-right">{r.today}</td>
                      <td className="px-3 py-2 border text-right">{r.yesterday}</td>
                      <td className={`px-3 py-2 border text-right font-medium ${r.growthColor}`}>{r.growth}</td>
                      <td className="px-3 py-2 border text-right">{r.ordersToday}</td>
                      <td className="px-3 py-2 border text-right">{r.ordersTotal}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-bold">
                    <td className="px-3 py-2 border">{SALES_DAILY_DATA.totals.region}</td>
                    <td className="px-3 py-2 border text-right">{SALES_DAILY_DATA.totals.today}</td>
                    <td className="px-3 py-2 border text-right">{SALES_DAILY_DATA.totals.yesterday}</td>
                    <td className={`px-3 py-2 border text-right ${SALES_DAILY_DATA.totals.growthColor}`}>{SALES_DAILY_DATA.totals.growth}</td>
                    <td className="px-3 py-2 border text-right">{SALES_DAILY_DATA.totals.ordersToday}</td>
                    <td className="px-3 py-2 border text-right">{SALES_DAILY_DATA.totals.ordersTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Monthly Report */}
      {selectedTemplate === "inventory-monthly" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">库存月报 - 2026年6月</CardTitle>
              <CardDescription>各品类库存变动与周转分析</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>返回</Button>
              <Button variant="outline" size="sm" onClick={handleExport}><Download className="size-3 mr-1" /> 导出 Excel</Button>
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="size-3 mr-1" /> 打印</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead>
                  {INVENTORY_DATA.headers.map((row, ri) => (
                    <tr key={ri} className="bg-muted/50">
                      {row.map((h, ci) => (
                        <th key={ci} className="px-3 py-2 text-left font-medium border text-xs" rowSpan={(h as { rowSpan?: number }).rowSpan} colSpan={(h as { colSpan?: number }).colSpan}>{h.label}</th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {INVENTORY_DATA.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 border font-medium">{r.category}</td>
                      <td className="px-3 py-2 border text-right">{r.start}</td>
                      <td className="px-3 py-2 border text-right">{r.end}</td>
                      <td className={`px-3 py-2 border text-right font-medium ${r.changeColor}`}>{r.change}</td>
                      <td className="px-3 py-2 border text-right">{r.turnover}</td>
                      <td className="px-3 py-2 border text-right">{r.yoy}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-bold">
                    <td className="px-3 py-2 border">{INVENTORY_DATA.totals.category}</td>
                    <td className="px-3 py-2 border text-right">{INVENTORY_DATA.totals.start}</td>
                    <td className="px-3 py-2 border text-right">{INVENTORY_DATA.totals.end}</td>
                    <td className={`px-3 py-2 border text-right ${INVENTORY_DATA.totals.changeColor}`}>{INVENTORY_DATA.totals.change}</td>
                    <td className="px-3 py-2 border text-right">{INVENTORY_DATA.totals.turnover}</td>
                    <td className="px-3 py-2 border text-right">{INVENTORY_DATA.totals.yoy}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generic template preview for other templates */}
      {selectedTemplate && selectedTemplate !== "sales-daily" && selectedTemplate !== "inventory-monthly" && selectedTemplate !== "custom" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{REPORT_TEMPLATES.find((t) => t.id === selectedTemplate)?.name} - 模板预览</CardTitle>
              <CardDescription>该报表模板的预览效果</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>返回</Button>
              <Button variant="outline" size="sm" onClick={handleExport}><Download className="size-3 mr-1" /> 导出 Excel</Button>
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="size-3 mr-1" /> 打印</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium border text-xs" rowSpan={2}>项目</th>
                    <th className="px-3 py-2 text-center font-medium border text-xs" colSpan={4}>数据明细</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 text-left font-medium border text-xs">指标 A</th>
                    <th className="px-3 py-2 text-left font-medium border text-xs">指标 B</th>
                    <th className="px-3 py-2 text-left font-medium border text-xs">指标 C</th>
                    <th className="px-3 py-2 text-left font-medium border text-xs">合计</th>
                  </tr>
                </thead>
                <tbody>
                  {["维度一", "维度二", "维度三", "维度四"].map((dim, i) => {
                    const vals = [`${(1234 + i * 234).toLocaleString()}`, `${(567 + i * 89).toLocaleString()}`, `${(890 + i * 123).toLocaleString()}`, `${(2691 + i * 446).toLocaleString()}`];
                    return (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-2 border font-medium">{dim}</td>
                        {vals.map((v, vi) => <td key={vi} className={`px-3 py-2 border text-right ${vi === 3 ? "font-bold bg-muted/20" : ""}`}>{v}</td>)}
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-bold">
                    <td className="px-3 py-2 border">合计</td>
                    <td className="px-3 py-2 border text-right">{(6170).toLocaleString()}</td>
                    <td className="px-3 py-2 border text-right">{(2923).toLocaleString()}</td>
                    <td className="px-3 py-2 border text-right">{(4382).toLocaleString()}</td>
                    <td className="px-3 py-2 border text-right bg-primary/10">{(13475).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────── Master Data Management (F6.6.8-10) ─────────────────── */
interface MasterRecord {
  id: string;
  name: string;
  type: string;
  source: string;
  fields: Record<string, string>;
  confidence: number;
  status: "golden" | "candidate" | "duplicate";
  mergedFrom?: string[];
}

const INITIAL_MASTER_RECORDS: MasterRecord[] = [
  { id: "MD-001", name: "华为技术有限公司", type: "客户", source: "CRM+ERP", fields: { "统一社会信用代码": "914403001922038216", "法人": "梁华", "地址": "深圳市龙岗区" }, confidence: 98.5, status: "golden" },
  { id: "MD-002", name: "华为技术有限公 司", type: "客户", source: "CRM", fields: { "统一社会信用代码": "914403001922038216", "法人": "梁华", "地址": "深圳龙岗" }, confidence: 98.5, status: "duplicate", mergedFrom: ["CRM-8821"] },
  { id: "MD-003", name: "阿里巴巴集团", type: "客户", source: "ERP", fields: { "统一社会信用代码": "91330000799210547T", "法人": "张勇", "地址": "杭州市余杭区" }, confidence: 96.2, status: "golden" },
  { id: "MD-004", name: "阿里巴巴（中国）", type: "客户", source: "CRM", fields: { "统一社会信用代码": "91330000799210547T", "法人": "张勇", "地址": "杭州余杭" }, confidence: 96.2, status: "duplicate", mergedFrom: ["CRM-3302"] },
  { id: "MD-005", name: "腾讯科技", type: "客户", source: "CRM+ERP", fields: { "统一社会信用代码": "914403007708833548", "法人": "马化腾", "地址": "深圳市南山区" }, confidence: 97.8, status: "golden" },
  { id: "MD-006", name: "腾讯科技（深圳）有限公司", type: "客户", source: "ERP", fields: { "统一社会信用代码": "914403007708833548", "法人": "马化腾", "地址": "深圳南山" }, confidence: 97.8, status: "candidate" },
  { id: "MD-007", name: "字节跳动有限公司", type: "客户", source: "CRM", fields: { "统一社会信用代码": "91110108MA004YPN8A", "法人": "张利东", "地址": "北京市海淀区" }, confidence: 95.1, status: "golden" },
  { id: "MD-008", name: "北京字节跳动", type: "客户", source: "ERP", fields: { "统一社会信用代码": "91110108MA004YPN8A", "法人": "张利东", "地址": "北京海淀" }, confidence: 95.1, status: "candidate" },
];

const MATCH_RULES = [
  { id: 1, name: "统一社会信用代码精确匹配", method: "exact", field: "统一社会信用代码", threshold: 100, status: "active", matches: 1248 },
  { id: 2, name: "企业名称模糊匹配", method: "fuzzy", field: "name", threshold: 85, status: "active", matches: 356 },
  { id: 3, name: "法人+地址组合匹配", method: "fuzzy", field: "法人+地址", threshold: 90, status: "active", matches: 89 },
  { id: 4, name: "电话号码匹配", method: "exact", field: "phone", threshold: 100, status: "paused", matches: 42 },
];

export function MasterData() {
  const [records, setRecords] = useState<MasterRecord[]>(INITIAL_MASTER_RECORDS);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [matching, setMatching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (toast) {
    setTimeout(() => setToast(null), 2500);
  }

  function toggleSelect(id: string) {
    setSelectedRecords((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);
  }

  function handleAutoMatch() {
    setMatching(true);
    setTimeout(() => {
      setMatching(false);
      setToast("自动匹配完成，发现 4 组疑似重复记录");
    }, 2500);
  }

  function handleManualMerge() {
    if (selectedRecords.length < 2) {
      setToast("请至少选择 2 条记录进行合并");
      return;
    }
    const golden = records.find((r) => selectedRecords.includes(r.id) && r.status === "golden");
    if (golden) {
      setRecords((prev) =>
        prev.map((r) =>
          selectedRecords.includes(r.id) && r.id !== golden.id
            ? { ...r, status: "duplicate" as const, mergedFrom: [...(r.mergedFrom || []), r.id] }
            : r
        )
      );
      setToast(`已将 ${selectedRecords.length - 1} 条记录合并到「${golden.name}」`);
    } else {
      setToast("请确保选择中包含一条黄金记录");
    }
    setSelectedRecords([]);
  }

  function handleSplitRecord(id: string) {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "candidate" as const, mergedFrom: undefined } : r
      )
    );
    setToast("记录已拆分为独立候选记录");
  }

  const goldenRecords = records.filter((r) => r.status === "golden");
  const candidateRecords = records.filter((r) => r.status === "candidate");
  const duplicateRecords = records.filter((r) => r.status === "duplicate");

  function getConfidenceColor(c: number) {
    if (c >= 95) return "text-green-600 bg-green-50";
    if (c >= 85) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="size-5 text-primary" /> 主数据管理
          </h2>
          <p className="text-xs text-muted-foreground">黄金记录管理、数据匹配与合并拆分</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRules(!showRules)}>
            <Target className="size-3 mr-1" /> 匹配规则
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutoMatch} disabled={matching}>
            {matching ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Fingerprint className="size-3 mr-1" />}
            自动匹配
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualMerge}>
            <Merge className="size-3 mr-1" /> 手动合并
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="黄金记录" value={goldenRecords.length} icon={Star} />
        <StatCard label="候选记录" value={candidateRecords.length} icon={Target} />
        <StatCard label="疑似重复" value={duplicateRecords.length} icon={Copy} />
        <StatCard label="匹配规则" value={MATCH_RULES.filter((r) => r.status === "active").length} icon={Fingerprint} />
      </div>

      {/* Match Rules Panel */}
      {showRules && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> 数据匹配规则</CardTitle>
              <CardDescription>配置数据匹配策略和阈值</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowRules(false)}>关闭</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>规则名称</TableHead>
                  <TableHead>匹配方式</TableHead>
                  <TableHead>匹配字段</TableHead>
                  <TableHead>阈值</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">匹配数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MATCH_RULES.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><Badge variant={r.method === "exact" ? "default" : "secondary"}>{r.method === "exact" ? "精确匹配" : "模糊匹配"}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.field}</TableCell>
                    <TableCell>{r.threshold}%</TableCell>
                    <TableCell><Badge variant={r.status === "active" ? "default" : "outline"}>{r.status === "active" ? "已启用" : "已暂停"}</Badge></TableCell>
                    <TableCell className="text-right">{r.matches}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Master Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="size-4" /> 主数据记录
          </CardTitle>
          <CardDescription>
            {records.length} 条记录，已选择 {selectedRecords.length} 条
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedRecords.length === records.length}
                    onChange={(e) => setSelectedRecords(e.target.checked ? records.map((r) => r.id) : [])}
                  />
                </TableHead>
                <TableHead>记录名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>数据源</TableHead>
                <TableHead>信用代码</TableHead>
                <TableHead>匹配置信度</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id} className={r.status === "duplicate" ? "opacity-60" : ""}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRecords.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                  <TableCell className="text-xs">{r.source}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fields["统一社会信用代码"]?.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(r.confidence)}`}>
                      {r.confidence}%
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.status === "golden" && <Badge className="bg-yellow-500"><Star className="size-3 mr-1 fill-white" /> 黄金</Badge>}
                    {r.status === "candidate" && <Badge variant="secondary"><Target className="size-3 mr-1" /> 候选</Badge>}
                    {r.status === "duplicate" && <Badge variant="outline"><Copy className="size-3 mr-1" /> 重复</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status !== "golden" && (
                      <Button variant="ghost" size="icon" className="size-7" title="设为黄金记录" onClick={() => setRecords((prev) => prev.map((rec) => rec.id === r.id ? { ...rec, status: "golden" } : rec))}>
                        <Star className="size-3" />
                      </Button>
                    )}
                    {r.status === "duplicate" && (
                      <Button variant="ghost" size="icon" className="size-7" title="拆分记录" onClick={() => handleSplitRecord(r.id)}>
                        <Split className="size-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-7" title="查看详情">
                      <Eye className="size-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function DataDashboard() {
  const [sourceCount, setSourceCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [metricCount, setMetricCount] = useState(0);

  useEffect(() => {
    dataApi.listSources().then((data) => {
      setSourceCount(data.length);
      setOnlineCount(data.filter((d) => d.status === "online").length);
    }).catch(() => {});
    dataApi.listMetrics().then((data) => {
      setMetricCount(data.length);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="size-5 text-primary" />
            数据中心
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            数据源接入、ETL、指标建模、实时监控与 Ask Data
          </p>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          新增数据源
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="数据源总数" value={sourceCount} icon={HardDrive} />
        <StatCard label="在线数据源" value={onlineCount} icon={Circle} />
        <StatCard label="指标总数" value={metricCount} icon={BarChart3} />
        <StatCard label="ETL 任务" value={ETL_TASKS.length} icon={RefreshCw} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="sources">数据源</TabsTrigger>
          <TabsTrigger value="etl">ETL 任务</TabsTrigger>
          <TabsTrigger value="quality">数据质量</TabsTrigger>
          <TabsTrigger value="lineage">数据血缘</TabsTrigger>
          <TabsTrigger value="charts">图表库</TabsTrigger>
          <TabsTrigger value="reports">报表</TabsTrigger>
          <TabsTrigger value="masterdata">主数据</TabsTrigger>
          <TabsTrigger value="realtime">实时监控</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <DataSourceList />
          <RealTimeMonitor />
        </TabsContent>
        <TabsContent value="sources" className="mt-4">
          <DataSourceList />
        </TabsContent>
        <TabsContent value="etl" className="mt-4">
          <ETLTasks />
        </TabsContent>
        <TabsContent value="quality" className="mt-4">
          <DataQuality />
        </TabsContent>
        <TabsContent value="lineage" className="mt-4">
          <DataLineage />
        </TabsContent>
        <TabsContent value="charts" className="mt-4">
          <ChartGallery />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportCenter />
        </TabsContent>
        <TabsContent value="masterdata" className="mt-4">
          <MasterData />
        </TabsContent>
        <TabsContent value="realtime" className="mt-4">
          <RealTimeMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}