import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockTestCases } from "@/lib/mock-data";
import { TestTube, Bot, Play, CheckCircle2, XCircle, Loader2, Bug, FileText, Plus, Gauge, Sparkles, GitBranch, AlertCircle, Zap, FlaskConical, BarChart3 } from "lucide-react";

const statusConfig = {
  passed: { label: "通过", variant: "default" as const, icon: CheckCircle2 },
  failed: { label: "失败", variant: "destructive" as const, icon: XCircle },
  running: { label: "运行中", variant: "secondary" as const, icon: Loader2 },
  skipped: { label: "跳过", variant: "outline" as const, icon: null },
  draft: { label: "草稿", variant: "outline" as const, icon: null },
};

const priorityConfig = {
  P0: { label: "P0", variant: "destructive" as const },
  P1: { label: "P1", variant: "default" as const },
  P2: { label: "P2", variant: "outline" as const },
};

// 缺陷跟踪
const BUGS = [
  { id: "BUG-1284", title: "客户详情页加载慢（>3s）", module: "客户管理", severity: "P0", status: "open", assignee: "张伟", createdAt: "今天 09:42" },
  { id: "BUG-1283", title: "审批流加签功能不可用", module: "报销审批", severity: "P0", status: "fixed", assignee: "李娜", createdAt: "昨天 16:20" },
  { id: "BUG-1282", title: "销售看板图表数据缺失 7/1", module: "销售看板", severity: "P1", status: "verifying", assignee: "王强", createdAt: "昨天 14:30" },
  { id: "BUG-1281", title: "智能体回答错乱（中英文混排）", module: "智能体助手", severity: "P1", status: "open", assignee: "刘敏", createdAt: "2 天前" },
  { id: "BUG-1280", title: "导出 PDF 中文乱码", module: "销售看板", severity: "P2", status: "closed", assignee: "陈红", createdAt: "3 天前" },
];

// 性能测试结果
const PERF_TESTS = [
  { name: "首屏加载", p50: 0.8, p95: 1.4, target: 1.5, status: "passed" },
  { name: "页面切换", p50: 0.2, p95: 0.5, target: 0.8, status: "passed" },
  { name: "表单提交", p50: 1.2, p95: 2.1, target: 2.0, status: "warning" },
  { name: "报表查询", p50: 2.4, p95: 4.8, target: 5.0, status: "passed" },
  { name: "并发 1000 用户", p50: 1.8, p95: 3.5, target: 4.0, status: "passed" },
];

// AI 用例生成
const AI_GENERATED = [
  { name: "客户编号为空的保存场景", type: "边界测试", source: "AI 根据对象生成", confidence: 92 },
  { name: "订单金额为负的校验", type: "边界测试", source: "AI 根据对象生成", confidence: 88 },
  { name: "审批流超时自动通过", type: "流程测试", source: "AI 根据流程生成", confidence: 85 },
  { name: "大屏看板 1 万条数据渲染", type: "性能测试", source: "AI 根据页面生成", confidence: 79 },
];

export function TestCases() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">测试用例</CardTitle>
          <CardDescription>所有测试用例（按模块分组）</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Sparkles className="size-3 mr-1" />
            AI 生成
          </Button>
          <Button size="sm">
            <Plus className="size-3 mr-1" />
            新建用例
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用例名</TableHead>
              <TableHead>模块</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>优先级</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>最近运行</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTestCases.map((t) => {
              const s = statusConfig[t.status];
              const p = priorityConfig[t.priority];
              const StatusIcon = s.icon;
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.module}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.variant}>{p.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {StatusIcon && <StatusIcon className={`size-3 ${t.status === "failed" ? "text-red-500" : t.status === "running" ? "animate-spin" : "text-green-500"}`} />}
                      <span>{s.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>{t.duration}</TableCell>
                  <TableCell className="text-xs">{t.lastRun}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8">
                      <Play className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function BugTracker() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="size-4" /> 缺陷跟踪
          </CardTitle>
          <CardDescription>{BUGS.length} 个缺陷，P0 优先级 2 个</CardDescription>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          上报缺陷
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>模块</TableHead>
              <TableHead>级别</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>负责人</TableHead>
              <TableHead className="text-right">创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BUGS.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.id}</TableCell>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell>{b.module}</TableCell>
                <TableCell>
                  <Badge variant={priorityConfig[b.severity as keyof typeof priorityConfig].variant}>{b.severity}</Badge>
                </TableCell>
                <TableCell>
                  {b.status === "open" && <Badge variant="destructive">待处理</Badge>}
                  {b.status === "fixed" && <Badge variant="secondary" className="text-green-600">已修复</Badge>}
                  {b.status === "verifying" && <Badge className="bg-blue-500">验证中</Badge>}
                  {b.status === "closed" && <Badge variant="outline">已关闭</Badge>}
                </TableCell>
                <TableCell>{b.assignee}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{b.createdAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function PerfMonitor() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="size-4" /> 性能监控
        </CardTitle>
        <CardDescription>基于真实用户监控（RUM）的性能指标</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>指标</TableHead>
              <TableHead>P50</TableHead>
              <TableHead>P95</TableHead>
              <TableHead>目标</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERF_TESTS.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.p50}s</TableCell>
                <TableCell>{p.p95}s</TableCell>
                <TableCell className="text-muted-foreground">≤ {p.target}s</TableCell>
                <TableCell>
                  {p.status === "passed" && <Badge variant="secondary" className="text-green-600">通过</Badge>}
                  {p.status === "warning" && <Badge variant="outline" className="text-orange-500">接近阈值</Badge>}
                  {p.status === "failed" && <Badge variant="destructive">超时</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AIGenerateCases() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> AI 自动生成用例
        </CardTitle>
        <CardDescription>根据对象/流程/页面 AI 自动推荐测试用例</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {AI_GENERATED.map((g, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <Sparkles className="size-4 text-primary shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-sm">{g.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {g.type} · {g.source}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">置信度 {g.confidence}%</Badge>
              <Button size="sm" variant="outline">采纳</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function QualityDashboard() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <TestTube className="size-5 text-primary" />
            质量中心
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            测试用例、缺陷跟踪、性能监控与 AI 自动生成
          </p>
        </div>
        <Button size="sm">
          <Sparkles className="size-3 mr-1" />
          AI 生成用例
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="用例总数" value={148} icon={FlaskConical} />
        <StatCard label="通过率" value="92.5%" trend={2.1} icon={CheckCircle2} />
        <StatCard label="失败用例" value={8} icon={XCircle} />
        <StatCard label="覆盖率" value="78.3%" trend={5.6} icon={BarChart3} />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">概览</TabsTrigger>
          <TabsTrigger value="cases">测试用例</TabsTrigger>
          <TabsTrigger value="bugs">缺陷跟踪</TabsTrigger>
          <TabsTrigger value="perf">性能监控</TabsTrigger>
          <TabsTrigger value="ai">AI 生成</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube className="size-4" /> 单元测试
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">68 / 73</div>
                <p className="text-xs text-muted-foreground mt-1">93.2% 通过</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="size-4" /> AI UI 自动化
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">24 / 28</div>
                <p className="text-xs text-muted-foreground mt-1">85.7% 通过</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4" /> 流程测试
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">12 / 12</div>
                <p className="text-xs text-muted-foreground mt-1">100% 通过</p>
              </CardContent>
            </Card>
          </div>
          <AIGenerateCases />
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <TestCases />
        </TabsContent>

        <TabsContent value="bugs" className="mt-4">
          <BugTracker />
        </TabsContent>

        <TabsContent value="perf" className="mt-4">
          <PerfMonitor />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AIGenerateCases />
        </TabsContent>
      </Tabs>
    </div>
  );
}