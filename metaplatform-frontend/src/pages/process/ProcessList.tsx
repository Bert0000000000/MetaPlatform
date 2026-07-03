import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { processesApi, type ProcessDefinition } from "@/lib/api";
import { flowableApi, type FlowableProcessDefinition } from "@/lib/flowable-api";
import {
  Plus, GitBranch, Eye, Activity, BarChart3, AlertTriangle, Play,
  Timer, CheckCircle, Loader2, AlertCircle,
} from "lucide-react";

export default function ProcessList() {
  const navigate = useNavigate();
  const [definitions, setDefinitions] = useState<ProcessDefinition[]>([]);
  const [flowableDefs, setFlowableDefs] = useState<FlowableProcessDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [flowableAvailable, setFlowableAvailable] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Always fetch from local API (SQLite)
    try {
      const localData = await processesApi.list();
      setDefinitions(Array.isArray(localData) ? localData : []);
    } catch {
      setDefinitions([]);
    }
    // Try Flowable (optional)
    try {
      const fData = await flowableApi.listProcessDefinitions({ latest: true });
      setFlowableDefs(Array.isArray(fData) ? fData : []);
      setFlowableAvailable(true);
    } catch {
      setFlowableDefs([]);
      setFlowableAvailable(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalCount = definitions.length + flowableDefs.length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="流程中心"
        description="业务流程 + 审批流程 + 服务编排（BPMN 2.0 规范）"
        action={
          <Button className="gap-2" onClick={() => navigate("/process/designer")}>
            <Plus className="size-4" /> 新建流程
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="流程定义数" value={loading ? "..." : totalCount} icon={GitBranch} />
        <StatCard label="本地定义" value={loading ? "..." : definitions.length} icon={Play} />
        <StatCard label="Flowable" value={flowableAvailable ? flowableDefs.length : "未连接"} icon={Timer} />
        <StatCard label="SLA 达成率" value={"--"} icon={CheckCircle} />
      </div>

      {!flowableAvailable && (
        <div className="flex items-center gap-2 p-3 border rounded bg-muted/30 text-muted-foreground text-xs">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>Flowable 引擎未连接（需启动 Docker: <code className="bg-muted px-1 rounded">docker-compose up flowable-rest</code>），当前显示本地流程定义</span>
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全部 ({loading ? "..." : totalCount})</TabsTrigger>
          <TabsTrigger value="monitor">实例监控</TabsTrigger>
          <TabsTrigger value="analytics">流程分析</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="size-4" /> 流程列表
              </CardTitle>
              <CardDescription>
                {loading ? "加载中..." : `共 ${totalCount} 个流程定义`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mr-2" /> 加载中...
                </div>
              ) : totalCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <GitBranch className="size-10 mb-3 opacity-40" />
                  <p className="text-sm">暂无流程定义</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate("/process/designer")}
                  >
                    <Plus className="size-3 mr-1" /> 去创建
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>标识</TableHead>
                      <TableHead>版本</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {definitions.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name || "(未命名)"}</TableCell>
                        <TableCell className="font-mono text-xs">{p.id}</TableCell>
                        <TableCell>v{p.version || 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.type || "business"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : "secondary"}>
                            {p.status === "active" ? "已激活" : p.status || "草稿"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => navigate(`/process/designer`)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {flowableDefs.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name || "(未命名)"}</TableCell>
                        <TableCell className="font-mono text-xs">{p.key}</TableCell>
                        <TableCell>v{p.version}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Flowable</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.suspended ? "secondary" : "default"}>
                            {p.suspended ? "已挂起" : "已激活"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => navigate(`/process/designer`)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="mt-3">
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
                  { label: "运行中", count: "--", color: "text-blue-500" },
                  { label: "已完成", count: "--", color: "text-green-500" },
                  { label: "暂停", count: "--", color: "text-orange-500" },
                  { label: "失败", count: "--", color: "text-red-500" },
                ].map((s) => (
                  <div key={s.label} className="rounded border p-3 text-center">
                    <div className={`text-xl font-semibold ${s.color}`}>{s.count}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                实例监控数据将从 Flowable 引擎实时获取
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4" /> 流程效率排名
                </CardTitle>
                <CardDescription>按平均耗时排名</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <BarChart3 className="size-8 mb-2 opacity-40" />
                  <p className="text-sm">流程分析数据将由后端提供</p>
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
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertTriangle className="size-8 mb-2 opacity-40" />
                  <p className="text-sm">瓶颈分析数据将由后端提供</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
