import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockProcesses } from "@/lib/mock-data";
import { Plus, GitBranch, GitMerge, Zap, Eye } from "lucide-react";

export default function ProcessList() {
  const business = mockProcesses.filter((p) => p.category === "业务流程");
  const approval = mockProcesses.filter((p) => p.category === "审批流程");
  const orchestration = mockProcesses.filter((p) => p.category === "服务编排");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="业务流程"
        description="企业级业务流程图（与架构中心 L3 联动）"
        action={
          <Button className="gap-2">
            <Plus className="size-4" /> 新建业务流程
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="业务流程总数" value={business.length} icon="🌊" />
        <StatCard label="运行中实例" value={3210} trend={8.2} icon="▶️" />
        <StatCard label="平均耗时" value="5.6h" icon="⏱️" />
        <StatCard label="SLA 达成率" value="98.5%" trend={2.1} icon="✅" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="size-4" /> 业务流程列表
          </CardTitle>
          <CardDescription>所有业务流程定义（BPMN 2.0）</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>版本</TableHead>
                <TableHead className="text-right">实例数</TableHead>
                <TableHead>平均耗时</TableHead>
                <TableHead>所有者</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {business.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.key}</TableCell>
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
    </div>
  );
}