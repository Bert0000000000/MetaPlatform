import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockProcessInstances } from "@/lib/mock-data";
import { Check, X, Clock, UserCheck, Vote, Users, GitBranch } from "lucide-react";

const taskModes = [
  { key: "竞签", desc: "多人竞签，一人通过即可", icon: "🎯" },
  { key: "并签", desc: "多人并签，需全员通过", icon: "👥" },
  { key: "串签", desc: "多人串签，按顺序审批", icon: "➡️" },
  { key: "投票", desc: "按比例/人数投票", icon: "🗳️" },
];

const approvalButtons = [
  "同意", "拒绝", "加签", "转办", "知会",
  "催办", "暂存", "终止", "撤回", "自定义",
];

export default function ApprovalList() {
  const [tab, setTab] = useState("todo");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="审批流程"
        description="单据审批 / 工作流自动协作"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="我的待办" value={12} icon="📥" />
        <StatCard label="我的已办" value={148} trend={5.6} icon="✅" />
        <StatCard label="我的发起" value={32} icon="🚀" />
        <StatCard label="本周新增" value={24} icon="🆕" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todo">我的待办</TabsTrigger>
          <TabsTrigger value="done">我的已办</TabsTrigger>
          <TabsTrigger value="started">我的发起</TabsTrigger>
          <TabsTrigger value="modes">任务模式</TabsTrigger>
          <TabsTrigger value="buttons">审批按钮</TabsTrigger>
        </TabsList>

        <TabsContent value="todo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">待办事项（{mockProcessInstances.filter((i) => i.status === "running").length}）</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>流程</TableHead>
                    <TableHead>当前节点</TableHead>
                    <TableHead>发起人</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProcessInstances.filter((i) => i.status === "running").map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.processName}</TableCell>
                      <TableCell>{i.currentNode}</TableCell>
                      <TableCell>{i.initiator}</TableCell>
                      <TableCell>{i.startTime}</TableCell>
                      <TableCell>
                        <Badge variant="default">进行中</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="mr-1">同意</Button>
                        <Button size="sm" variant="outline">拒绝</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="done" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">已办事项</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>流程</TableHead>
                    <TableHead>发起人</TableHead>
                    <TableHead>完成时间</TableHead>
                    <TableHead>耗时</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProcessInstances.filter((i) => i.status === "completed").map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.processName}</TableCell>
                      <TableCell>{i.initiator}</TableCell>
                      <TableCell>{i.startTime}</TableCell>
                      <TableCell>{i.duration}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="started" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">我发起的</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground py-8 text-center">
                暂无发起的流程
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modes" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {taskModes.map((m) => (
              <Card key={m.key}>
                <CardHeader>
                  <div className="text-3xl mb-2">{m.icon}</div>
                  <CardTitle className="text-base">{m.key}</CardTitle>
                  <CardDescription>{m.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="buttons" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">10 种审批按钮</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {approvalButtons.map((b) => (
                  <div key={b} className="border rounded-lg p-3 text-center">
                    <div className="font-medium text-sm">{b}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}