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
import { Database, Plus, Sparkles, MessageSquare, Activity, AlertTriangle, Terminal, BarChart3, GitMerge, ShieldCheck, Clock, Send, FileBarChart, Leaf, Zap, Rocket, Mail, Globe, FileSpreadsheet, Users, Package, Megaphone, HardDrive, RefreshCw, Circle, Handshake, Trash2, Plug, Bell, CheckCircle2, Warehouse, Layers, Search, BookOpen, Ruler, Briefcase, ScrollText, Download, Server, Eye } from "lucide-react";
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
  const [history, setHistory] = useState<{ q: string; sql: string; result: string }[]>([
    {
      q: "上个月的订单总额是多少？",
      sql: "SELECT SUM(amount) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH);",
      result: "¥12,486,329（共 4,231 笔订单）",
    },
  ]);

  function ask(query: string) {
    if (!query.trim()) return;
    setHistory((h) => [
      ...h,
      {
        q: query,
        sql: `-- 由 AI 自动生成\nSELECT * FROM orders WHERE created_at BETWEEN '2026-06-01' AND '2026-06-30' LIMIT 10;`,
        result: "查询完成，返回 10 条记录。请查看下方表格。",
      },
    ]);
    setQ("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="size-4" /> 智能问数（Text-to-SQL）
          </CardTitle>
          <CardDescription>用自然语言查询数据库，AI 自动生成 SQL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-4">
            {history.map((h, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="size-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">Q</div>
                  <div className="text-sm font-medium">{h.q}</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="size-6 rounded-full bg-muted text-xs flex items-center justify-center shrink-0"><Terminal className="size-3" /></div>
                  <pre className="text-xs font-mono bg-background border rounded p-2 flex-1 overflow-x-auto">{h.sql}</pre>
                </div>
                <div className="flex items-start gap-2">
                  <div className="size-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center shrink-0">A</div>
                  <div className="text-sm">{h.result}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded-lg p-4 bg-muted/30 mb-3">
            <div className="text-sm text-muted-foreground mb-2"><MessageSquare className="size-4 inline mr-1" />试试问：</div>
            <div className="grid grid-cols-2 gap-2">
              {["上个月销售额是多少？", "本周新增客户有多少？", "各地区销售 Top 5 城市", "客单价超过 1 万的订单数"].map((s) => (
                <button key={s} onClick={() => ask(s)} className="bg-background border rounded p-2 text-sm text-left hover:border-primary">
                  {s}
                </button>
              ))}
            </div>
          </div>

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
        </CardContent>
      </Card>
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
        <TabsContent value="realtime" className="mt-4">
          <RealTimeMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}