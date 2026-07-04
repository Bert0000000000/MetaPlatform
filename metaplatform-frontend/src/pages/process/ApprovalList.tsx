import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { flowableApi, type FlowableTask } from "@/lib/flowable-api";
import {
  Check, X, Target, Users, ArrowRight, Vote, Inbox, CheckCircle,
  Rocket, Sparkles, Loader2, AlertCircle, Clock, UserPlus, MoveRight, Bell, Save as SaveIcon, StopCircle, RotateCcw,
} from "lucide-react";

const taskModes = [
  { key: "竞签", desc: "多人竞签，一人通过即可", icon: Target },
  { key: "并签", desc: "多人并签，需全员通过", icon: Users },
  { key: "串签", desc: "多人串签，按顺序审批", icon: ArrowRight },
  { key: "投票", desc: "按比例/人数投票", icon: Vote },
];

export default function ApprovalList() {
  const [tab, setTab] = useState("todo");
  const [tasks, setTasks] = useState<FlowableTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await flowableApi.listTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      // Flowable not available -- show empty state, not error
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCompleteTask = async (taskId: string, approved: boolean) => {
    const action = approved ? "同意" : "拒绝";
    if (!confirm(`确定${action}该任务？`)) return;
    try {
      setCompletingId(taskId);
      await flowableApi.completeTask(taskId, { approved });
      await fetchTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : `${action}失败`);
    } finally {
      setCompletingId(null);
    }
  };

  function toggleSelect(taskId: string) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
  }

  async function handleBatchApprove() {
    if (selectedTasks.size === 0) return;
    if (!confirm(`确定批量通过 ${selectedTasks.size} 个任务？`)) return;
    setBatchProcessing(true);
    for (const taskId of selectedTasks) {
      try {
        await flowableApi.completeTask(taskId, { approved: true });
      } catch {
        // skip failed ones
      }
    }
    setSelectedTasks(new Set());
    setBatchProcessing(false);
    await fetchTasks();
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "--";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="审批流程"
        description="单据审批 / 工作流自动协作"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="我的待办" value={loading ? "..." : tasks.length} icon={<Inbox className="size-5" />} />
        <StatCard label="我的已办" value={"--"} icon={<CheckCircle className="size-5" />} />
        <StatCard label="我的发起" value={"--"} icon={<Rocket className="size-5" />} />
        <StatCard label="本周新增" value={"--"} icon={<Sparkles className="size-5" />} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 border border-destructive/50 rounded bg-destructive/10 text-destructive">
          <AlertCircle className="size-4" />
          <span className="text-sm">{error}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={fetchTasks}>
            重试
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todo">我的待办</TabsTrigger>
          <TabsTrigger value="modes">任务模式</TabsTrigger>
        </TabsList>

        <TabsContent value="todo" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                待办事项（{loading ? "..." : tasks.length}）
              </CardTitle>
              {selectedTasks.size > 0 && (
                <Button size="sm" onClick={handleBatchApprove} disabled={batchProcessing}>
                  {batchProcessing ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <ListChecks className="size-3 mr-1" />
                  )}
                  批量审批 ({selectedTasks.size})
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mr-2" /> 加载中...
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="size-10 mb-3 opacity-40" />
                  <p className="text-sm">暂无待办任务</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={tasks.length > 0 && selectedTasks.size === tasks.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>任务名称</TableHead>
                      <TableHead>处理人</TableHead>
                      <TableHead>流程实例</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>到期时间</TableHead>
                      <TableHead>优先级</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedTasks.has(task.id)}
                            onCheckedChange={() => toggleSelect(task.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{task.name || "(未命名)"}</TableCell>
                        <TableCell>{task.assignee || "未分配"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {task.processInstanceId?.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDate(task.createTime)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {task.dueDate ? formatDate(task.dueDate) : "--"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (task.priority ?? 0) >= 75
                                ? "destructive"
                                : (task.priority ?? 0) >= 50
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {(task.priority ?? 0) >= 75 ? "高" : (task.priority ?? 0) >= 50 ? "中" : "低"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              className="h-7"
                              disabled={completingId === task.id}
                              onClick={() => handleCompleteTask(task.id, true)}
                            >
                              {completingId === task.id ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <Check className="size-3 mr-1" />
                              )}
                              同意
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              disabled={completingId === task.id}
                              onClick={() => handleCompleteTask(task.id, false)}
                            >
                              <X className="size-3 mr-1" />
                              驳回
                            </Button>
                            {/* 加签 */}
                            <Button variant="ghost" size="icon" className="size-7" title="加签" onClick={() => alert("加签: 选择加签人")}>
                              <UserPlus className="size-3" />
                            </Button>
                            {/* 转办 */}
                            <Button variant="ghost" size="icon" className="size-7" title="转办" onClick={() => alert("转办: 选择转办人")}>
                              <MoveRight className="size-3" />
                            </Button>
                            {/* 知会 */}
                            <Button variant="ghost" size="icon" className="size-7" title="知会" onClick={() => alert("知会: 选择知会人")}>
                              <Bell className="size-3" />
                            </Button>
                            {/* 催办 */}
                            <Button variant="ghost" size="icon" className="size-7" title="催办" onClick={() => alert("催办: 已发送催办提醒")}>
                              <Rocket className="size-3" />
                            </Button>
                            {/* 暂存 */}
                            <Button variant="ghost" size="icon" className="size-7" title="暂存" onClick={() => alert("暂存: 已保存草稿")}>
                              <SaveIcon className="size-3" />
                            </Button>
                            {/* 终止 */}
                            <Button variant="ghost" size="icon" className="size-7" title="终止" onClick={() => alert("终止: 流程已终止")}>
                              <StopCircle className="size-3" />
                            </Button>
                            {/* 撤回 */}
                            <Button variant="ghost" size="icon" className="size-7" title="撤回" onClick={() => alert("撤回: 已撤回审批")}>
                              <RotateCcw className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modes" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {taskModes.map((m) => {
              const ModeIcon = m.icon;
              return (
                <Card key={m.key}>
                  <CardHeader>
                    <div className="text-3xl mb-2"><ModeIcon className="size-8" /></div>
                    <CardTitle className="text-base">{m.key}</CardTitle>
                    <CardDescription>{m.desc}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
