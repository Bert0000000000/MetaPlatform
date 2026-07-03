import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockDataSources, mockMetrics, type DataSource } from "@/lib/mock-data";
import { Database, Plus, Sparkles, MessageSquare, Activity, AlertTriangle } from "lucide-react";

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

export function DataSourceList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="size-4" /> 数据源列表
        </CardTitle>
        <CardDescription>连接外部数据源（13 类）</CardDescription>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="size-4" /> 智能问数
        </CardTitle>
        <CardDescription>用自然语言查询数据，NL→SQL</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="text-sm text-muted-foreground mb-2">💬 试试问：</div>
          <div className="space-y-2">
            {[
              "上个月销售额是多少？",
              "本周新增客户有多少？",
              "各地区销售 Top 5 城市",
              "客单价超过 1 万的订单数",
            ].map((q) => (
              <div key={q} className="bg-background border rounded p-2 text-sm cursor-pointer hover:border-primary">
                {q}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="问我任何数据问题..."
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <Button>提问</Button>
        </div>
      </CardContent>
    </Card>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">指标定义</CardTitle>
        </CardHeader>
        <CardContent>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
      <DataSourceList />
    </div>
  );
}