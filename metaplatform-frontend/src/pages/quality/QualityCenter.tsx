import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockTestCases } from "@/lib/mock-data";
import { TestTube, Bot, Play, CheckCircle2, XCircle, Loader2, Bug, FileText, Plus } from "lucide-react";

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

export function TestCases() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">测试用例</CardTitle>
        <CardDescription>所有测试用例（按模块分组）</CardDescription>
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

export function QualityDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="用例总数" value={148} icon="🧪" />
        <StatCard label="通过率" value="92.5%" trend={2.1} icon="✅" />
        <StatCard label="失败用例" value={8} icon="❌" />
        <StatCard label="覆盖率" value="78.3%" trend={5.6} icon="📊" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TestTube className="size-4" /> 单元测试
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">68 / 73</div>
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
            <div className="text-2xl font-semibold">24 / 28</div>
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
            <div className="text-2xl font-semibold">12 / 12</div>
            <p className="text-xs text-muted-foreground mt-1">100% 通过</p>
          </CardContent>
        </Card>
      </div>
      <TestCases />
    </div>
  );
}