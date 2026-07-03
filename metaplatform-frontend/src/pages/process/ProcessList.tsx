import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockProcesses } from "@/lib/mock-data";
import { Plus, GitBranch, Eye, Activity, BarChart3, AlertTriangle, Waves, Play, Timer, CheckCircle } from "lucide-react";

const ALL_PROCESSES = mockProcesses;

export default function ProcessList() {
  const business = ALL_PROCESSES.filter((p) => p.category === "业务流程");
  const approval = ALL_PROCESSES.filter((p) => p.category === "审批流程");
  const orchestration = ALL_PROCESSES.filter((p) => p.category === "服务编排");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="流程中心"
        description="业务流程 + 审批流程 + 服务编排（BPMN 2.0 规范）"
        action={
          <Button className="gap-2">
            <Plus className="size-4" /> 新建流程
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="流程总数" value={ALL_PROCESSES.length} icon={<Waves className="size-5" />} />
        <StatCard label="运行中实例" value={3210} trend={8.2} icon={<Play className="size-5" />} />
        <StatCard label="平均耗时" value="5.6h" icon={<Timer className="size-5" />} />
        <StatCard label="SLA 达成率" value="98.5%" trend={2.1} icon={<CheckCircle className="size-5" />} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全部 ({ALL_PROCESSES.length})</TabsTrigger>
          <TabsTrigger value="business">业务流程 ({business.length})</TabsTrigger>
          <TabsTrigger value="approval">审批流程 ({approval.length})</TabsTrigger>
          <TabsTrigger value="orchestration">服务编排 ({orchestration.length})</TabsTrigger>
          <TabsTrigger value="monitor">实例监控</TabsTrigger>
          <TabsTrigger value="analytics">流程分析</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ProcessTable processes={ALL_PROCESSES} />
        </TabsContent>
        <TabsContent value="business" className="mt-4">
          <ProcessTable processes={business} />
        </TabsContent>
        <TabsContent value="approval" className="mt-4">
          <ProcessTable processes={approval} />
        </TabsContent>
        <TabsContent value="orchestration" className="mt-4">
          <ProcessTable processes={orchestration} />
        </TabsContent>

        <TabsContent value="monitor" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-4" /> 流程实例实时监控
              </CardTitle>
              <CardDescription>所有运行中/暂停/失败的流程实例</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "运行中", count: 186, color: "text-blue-500" },
                  { label: "已完成", count: 1248, color: "text-green-500" },
                  { label: "暂停", count: 8, color: "text-orange-500" },
                  { label: "失败", count: 3, color: "text-red-500" },
                ].map((s) => (
                  <div key={s.label} className="rounded border p-3 text-center">
                    <div className={`text-xl font-semibold ${s.color}`}>{s.count}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">详细实例监控请到「流程设计器 → 实例监控」标签</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4" /> 流程效率排名
                </CardTitle>
                <CardDescription>按平均耗时排名</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {business.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="size-6 rounded bg-muted flex items-center justify-center text-xs">#{i + 1}</div>
                      <span className="text-sm flex-1">{p.name}</span>
                      <span className="text-sm text-muted-foreground">{p.avgDuration}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4" /> 流程瓶颈
                </CardTitle>
                <CardDescription>识别最长耗时节点</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="p-2 border rounded">
                    <div className="font-medium">采购审批 - 法务审核</div>
                    <div className="text-xs text-muted-foreground">平均耗时 38 小时（瓶颈）</div>
                  </div>
                  <div className="p-2 border rounded">
                    <div className="font-medium">合同审批 - 总经理签字</div>
                    <div className="text-xs text-muted-foreground">平均耗时 24 小时（瓶颈）</div>
                  </div>
                  <div className="p-2 border rounded">
                    <div className="font-medium">报销审批 - 财务复核</div>
                    <div className="text-xs text-muted-foreground">平均耗时 8 小时</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProcessTable({ processes }: { processes: typeof ALL_PROCESSES }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="size-4" /> 流程列表
        </CardTitle>
        <CardDescription>共 {processes.length} 个流程定义</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>类别</TableHead>
              <TableHead>版本</TableHead>
              <TableHead className="text-right">实例数</TableHead>
              <TableHead>平均耗时</TableHead>
              <TableHead>所有者</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-xs">{p.key}</TableCell>
                <TableCell>
                  <Badge variant="outline">{p.category}</Badge>
                </TableCell>
                <TableCell>{p.version}</TableCell>
                <TableCell className="text-right">{p.instances.toLocaleString()}</TableCell>
                <TableCell>{p.avgDuration}</TableCell>
                <TableCell>{p.owner}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "published" ? "default" : "secondary"}>
                    {p.status === "published" ? "已发布" : p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8">
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}