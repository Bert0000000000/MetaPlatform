import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockDataSources, mockMetrics, type DataSource } from "@/lib/mock-data";
import { Database, Plus, Sparkles, MessageSquare, Activity, AlertTriangle, Terminal, BarChart3, GitMerge, ShieldCheck, Clock, Send, FileBarChart } from "lucide-react";

const statusMap: Record<DataSource["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  online: { label: "在线", variant: "default" },
  offline: { label: "离线", variant: "destructive" },
  syncing: { label: "同步中", variant: "secondary" },
  error: { label: "错误", variant: "destructive" },
};

const sourceTypeIcons: Record<string, string> = {
  MySQL: "🐬",
  PostgreSQL: "🐘",
  Oracle: "🔴",
  MongoDB: "🍃",
  ClickHouse: "⚡",
  Doris: "🚀",
  Kafka: "📨",
  API: "🌐",
  CSV: "📊",
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="size-4" /> 数据源列表
          </CardTitle>
          <CardDescription>连接外部数据源（13 类）</CardDescription>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          新增数据源
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>主机</TableHead>
              <TableHead className="text-right">记录数</TableHead>
              <TableHead>最后同步</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDataSources.map((ds) => (
              <TableRow key={ds.id}>
                <TableCell className="font-medium">{ds.name}</TableCell>
                <TableCell>
                  <span className="mr-1">{sourceTypeIcons[ds.type]}</span>
                  {ds.type}
                </TableCell>
                <TableCell className="font-mono text-xs">{ds.host}</TableCell>
                <TableCell className="text-right">
                  {ds.records > 0 ? ds.records.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-xs">{ds.lastSync}</TableCell>
                <TableCell>
                  <Badge variant={statusMap[ds.status].variant}>
                    {statusMap[ds.status].label}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
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
            <div className="text-sm text-muted-foreground mb-2">💬 试试问：</div>
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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockMetrics.map((m) => (
          <StatCard
            key={m.id}
            label={m.name}
            value={m.value}
            unit={m.unit}
            trend={m.trend}
            icon="📊"
          />
        ))}
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
                  { name: "时间维度", count: 8, icon: "🕐" },
                  { name: "地域维度", count: 32, icon: "🌍" },
                  { name: "客户维度", count: 12, icon: "🤝" },
                  { name: "产品维度", count: 24, icon: "📦" },
                  { name: "渠道维度", count: 6, icon: "📣" },
                ].map((d) => (
                  <div key={d.name} className="rounded-lg border p-3 text-center">
                    <div className="text-2xl">{d.icon}</div>
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

export function DataQuality() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4" /> 数据质量监控
          </CardTitle>
          <CardDescription>{QUALITY_RULES.length} 条规则，覆盖 6 张表</CardDescription>
        </div>
        <Button size="sm">
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
            {QUALITY_RULES.map((r) => (
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
    </Card>
  );
}

export function ETLTasks() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <GitMerge className="size-4" /> ETL 任务
          </CardTitle>
          <CardDescription>数据抽取-转换-加载任务编排</CardDescription>
        </div>
        <Button size="sm">
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
            {ETL_TASKS.map((t) => (
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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="总数据量" value={27320000} icon="💾" />
        <StatCard label="今日同步" value={1280000} trend={5.2} icon="🔄" />
        <StatCard label="在线数据源" value={6} icon="🟢" />
        <StatCard label="指标总数" value={148} icon="📊" />
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