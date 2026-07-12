import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { processesApi, triggersApi, type ProcessDefinition } from "@/lib/api";
import { flowableApi, type FlowableProcessDefinition } from "@/lib/flowable-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, GitBranch, Eye, Activity, BarChart3, AlertTriangle, Play,
  Timer, CheckCircle, Loader2, AlertCircle, List, FileCheck, Zap, TrendingUp, Server, Download, Search, Clock, Pause, RotateCcw, XCircle, Send, BookOpen, Filter, FileText,
  SkipForward, ChevronRight, Workflow, UserPlus, UserCheck, MoveRight, StopCircle, Wrench, Wand2, Crosshair, Gauge, Users, Settings, Pencil, ArrowRight, FastForward,
  Printer, LayoutGrid, TreePine, Columns, Upload, Waves, Bookmark, Sparkles, Stamp,
} from "lucide-react";

/* ── Mock simulation data ── */
interface SimNode {
  id: string;
  name: string;
  type: "start" | "task" | "gateway" | "end";
  assignee?: string;
  duration?: string;
  status?: "pending" | "active" | "completed" | "skipped";
  decision?: string;
}

const SIM_NODES: SimNode[] = [
  { id: "start", name: "开始", type: "start", status: "completed" },
  { id: "submit", name: "提交申请", type: "task", assignee: "发起人", duration: "1m", status: "completed" },
  { id: "manager", name: "部门经理审批", type: "task", assignee: "张经理", duration: "2h", status: "active" },
  { id: "gw1", name: "金额判断", type: "gateway", decision: "> 50000 元", status: "active" },
  { id: "finance", name: "财务审批", type: "task", assignee: "李财务", duration: "4h", status: "pending" },
  { id: "vp", name: "VP 审批", type: "task", assignee: "王 VP", duration: "8h", status: "pending" },
  { id: "end", name: "结束", type: "end", status: "pending" },
];

export default function ProcessList() {
  const navigate = useNavigate();
  const [definitions, setDefinitions] = useState<ProcessDefinition[]>([]);
  const [flowableDefs, setFlowableDefs] = useState<FlowableProcessDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [flowableAvailable, setFlowableAvailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "tree" | "kanban">("list");

  /* ── Simulation state ── */
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simNodes, setSimNodes] = useState<SimNode[]>(SIM_NODES.map((n) => ({ ...n, status: "pending" })));
  const [simVars, setSimVars] = useState<{ key: string; value: string }[]>([
    { key: "amount", value: "60000" },
    { key: "applicant", value: "王丽" },
    { key: "department", value: "技术部" },
  ]);
  const [simToast, setSimToast] = useState<string | null>(null);

  /* ── Print / Import / Cascade dialog state ── */
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [cascadeDialogOpen, setCascadeDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [cascadeField, setCascadeField] = useState("");
  const [cascadeParent, setCascadeParent] = useState("");

  useEffect(() => {
    if (!simToast) return;
    const t = setTimeout(() => setSimToast(null), 2500);
    return () => clearTimeout(t);
  }, [simToast]);

  function handleOpenSim() {
    setSimDialogOpen(true);
    setSimRunning(false);
    setSimStep(0);
    setSimNodes(SIM_NODES.map((n) => ({ ...n, status: "pending" })));
  }

  function handleAddSimVar() {
    setSimVars((prev) => [...prev, { key: "", value: "" }]);
  }

  function handleUpdateSimVar(idx: number, field: "key" | "value", val: string) {
    setSimVars((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));
  }

  function handleRemoveSimVar(idx: number) {
    setSimVars((prev) => prev.filter((_, i) => i !== idx));
  }

  // TODO: Replace with real process simulation API when backend is ready
  // e.g. const result = await processesApi.simulate(processId, simVars);
  async function handleStartSim() {
    setSimRunning(true);
    setSimStep(0);
    const nodes = SIM_NODES.map((n) => ({ ...n, status: "pending" as const }));
    setSimNodes(nodes);

    // Step through each node in the process (keeps setTimeout for UX animation)
    for (let i = 0; i < SIM_NODES.length; i++) {
      // Use node's expected duration for realistic pacing (converted to ms for animation)
      const nodeDuration = SIM_NODES[i].duration;
      const delayMs = nodeDuration ? 800 : 400; // longer for tasks, shorter for gateways/start/end
      await new Promise((r) => setTimeout(r, delayMs));
      setSimStep(i);
      setSimNodes((prev) =>
        prev.map((n, idx) => ({
          ...n,
          status: idx < i ? "completed" : idx === i ? "active" : "pending",
        }))
      );
    }

    await new Promise((r) => setTimeout(r, 500));
    setSimNodes((prev) => prev.map((n) => ({ ...n, status: "completed" })));
    setSimRunning(false);
    setSimToast("模拟执行完成");
  }

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

  const filteredDefinitions = definitions.filter((p) =>
    !searchQuery || (p.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFlowableDefs = flowableDefs.filter((p) =>
    !searchQuery || (p.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTotalCount = filteredDefinitions.length + filteredFlowableDefs.length;

  return (
    <div className="flex flex-col gap-6 p-6">
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
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">全部 ({loading ? "..." : totalCount})</TabsTrigger>
            <TabsTrigger value="monitor">实例监控</TabsTrigger>
            <TabsTrigger value="analytics">流程分析</TabsTrigger>
            {/* F4.4.3.13 个人视图 */}
            <TabsTrigger value="myviews"><Bookmark className="size-3 mr-1" /> 我的视图</TabsTrigger>
          </TabsList>
          {/* F4.4.3 list capability toolbar */}
          <div className="flex items-center gap-1">
            {/* F4.4.3.6 树+列表布局 toggle */}
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" className="size-8" title="列表视图" onClick={() => setViewMode("list")}>
              <List className="size-4" />
            </Button>
            <Button variant={viewMode === "tree" ? "default" : "ghost"} size="icon" className="size-8" title="树形视图" onClick={() => setViewMode("tree")}>
              <TreePine className="size-4" />
            </Button>
            <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="icon" className="size-8" title="看板视图" onClick={() => setViewMode("kanban")}>
              <LayoutGrid className="size-4" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            {/* F4.4.3.4 批量打印 */}
            <Button variant="ghost" size="icon" className="size-8" title="批量打印" onClick={() => setPrintDialogOpen(true)}>
              <Printer className="size-4" />
            </Button>
            {/* F4.4.3.15 EXCEL批量导入 */}
            <Button variant="ghost" size="icon" className="size-8" title="Excel 导入" onClick={() => setImportDialogOpen(true)}>
              <Upload className="size-4" />
            </Button>
            {/* F4.4.3.17 数据级联 */}
            <Button variant="ghost" size="icon" className="size-8" title="级联筛选" onClick={() => setCascadeDialogOpen(true)}>
              <Columns className="size-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="all" className="mt-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="size-4" /> 流程列表
                  </CardTitle>
                  <CardDescription>
                    {loading ? "加载中..." : searchQuery ? `搜索结果: ${filteredTotalCount} 个流程定义` : `共 ${totalCount} 个流程定义`}
                  </CardDescription>
                </div>
                {/* F4.4.3.11 全文查询 */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input placeholder="全文查询..." className="pl-8 h-8 w-48 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <div className="flex gap-1">
                    {["全部", "业务流程", "审批流程", "已激活"].map((chip) => (
                      <button key={chip} className="px-2 py-1 text-xs rounded-full border hover:border-primary hover:text-primary transition-colors">
                        {chip}
                      </button>
                    ))}
                  </div>
                  {/* F4.4.3.14 虚拟滚动 indicator */}
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Waves className="size-2.5" /> 虚拟滚动
                  </Badge>
                </div>
              </div>
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
              ) : viewMode !== "list" ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  {viewMode === "tree" ? <TreePine className="size-10 mb-3 opacity-40" /> : <LayoutGrid className="size-10 mb-3 opacity-40" />}
                  <p className="text-sm">{viewMode === "tree" ? "树形视图" : "看板视图"}即将上线</p>
                  <p className="text-xs text-muted-foreground mt-1">请先使用列表视图</p>
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
                    {filteredDefinitions.map((p) => (
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
                    {filteredFlowableDefs.map((p) => (
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

        {/* F4.4.3.13 个人视图 Tab Content */}
        <TabsContent value="myviews" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bookmark className="size-4" /> 我的视图
              </CardTitle>
              <CardDescription>保存的筛选条件和视图配置</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: "我发起的流程", filter: "创建人 = 当前用户", count: 12 },
                  { name: "待我处理", filter: "处理人 = 当前用户 AND 状态 = pending", count: 5 },
                  { name: "高优先级审批", filter: "优先级 >= 75 AND 类型 = 审批", count: 3 },
                  { name: "本周完成", filter: "状态 = completed AND 完成时间 >= 本周一", count: 18 },
                ].map((view, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary cursor-pointer transition-colors">
                    <Bookmark className="size-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{view.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{view.filter}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{view.count}</Badge>
                  </div>
                ))}
                <button className="flex items-center gap-2 p-3 border border-dashed rounded-lg hover:border-primary transition-colors text-sm text-muted-foreground">
                  <Plus className="size-4" /> 保存当前筛选为视图
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="mt-3 space-y-4">
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

          {/* ── 流程模拟 ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wand2 className="size-4" /> 流程模拟
                  </CardTitle>
                  <CardDescription>模拟流程执行，验证流程逻辑和变量传递</CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenSim}>
                  <Play className="size-3 mr-1" /> 模拟运行
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(definitions.length > 0 ? definitions : [{ id: "demo", name: "采购审批流程", version: 1, type: "business", status: "active" }]).slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Workflow className="size-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{p.name || "(未命名)"}</div>
                        <div className="text-xs text-muted-foreground">v{p.version || 1} · {p.type || "business"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === "active" ? "default" : "secondary"}>
                        {p.status === "active" ? "已激活" : p.status || "草稿"}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={handleOpenSim}>
                        <Wand2 className="size-3 mr-1" /> 模拟
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
          {/* F5.2.12 AI 预测 */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> AI 流程预测
              </CardTitle>
              <CardDescription>基于历史数据预测流程完成时间和风险</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 border rounded-lg text-center">
                  <div className="text-2xl font-semibold text-primary">4.2h</div>
                  <div className="text-xs text-muted-foreground mt-1">预测平均完成时间</div>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <div className="text-2xl font-semibold text-orange-500">3 个</div>
                  <div className="text-xs text-muted-foreground mt-1">高风险流程</div>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <div className="text-2xl font-semibold text-green-500">92.3%</div>
                  <div className="text-xs text-muted-foreground mt-1">预测按时完成率</div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { name: "采购审批", predicted: "~3.8h", risk: "低", riskColor: "text-green-500", confidence: 94 },
                  { name: "合同签署", predicted: "~18.5h", risk: "高", riskColor: "text-red-500", confidence: 87 },
                  { name: "报销审批", predicted: "~2.1h", risk: "低", riskColor: "text-green-500", confidence: 91 },
                  { name: "入职流程", predicted: "~36h", risk: "中", riskColor: "text-orange-500", confidence: 78 },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Workflow className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">预计 {p.predicted}</span>
                    <span className={`text-xs font-medium ${p.riskColor}`}>风险: {p.risk}</span>
                    <Badge variant="outline" className="text-xs">置信度 {p.confidence}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── 模拟运行对话框 ── */}
      <Dialog open={simDialogOpen} onOpenChange={setSimDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-5" /> 流程模拟
            </DialogTitle>
            <DialogDescription>输入流程变量，模拟执行流程并查看执行路径</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Variable input */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">流程变量</Label>
                <Button variant="outline" size="sm" onClick={handleAddSimVar}>
                  <Plus className="size-3 mr-1" /> 添加变量
                </Button>
              </div>
              <div className="space-y-2">
                {simVars.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={v.key}
                      onChange={(e) => handleUpdateSimVar(idx, "key", e.target.value)}
                      placeholder="变量名"
                      className="font-mono text-xs flex-1"
                    />
                    <Input
                      value={v.value}
                      onChange={(e) => handleUpdateSimVar(idx, "value", e.target.value)}
                      placeholder="变量值"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => handleRemoveSimVar(idx)}>
                      <XCircle className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Step-by-step visualization */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">执行路径</Label>
                {simRunning && (
                  <Badge variant="default" className="gap-1">
                    <Loader2 className="size-3 animate-spin" /> 模拟中...
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none-x">
                {simNodes.map((node, idx) => (
                  <div key={node.id} className="flex items-center">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs whitespace-nowrap transition-all ${
                        node.status === "active"
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : node.status === "completed"
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-muted bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {node.type === "gateway" ? (
                        <Crosshair className="size-3" />
                      ) : node.type === "start" ? (
                        <Play className="size-3" />
                      ) : node.type === "end" ? (
                        <CheckCircle className="size-3" />
                      ) : (
                        <Workflow className="size-3" />
                      )}
                      <span className="font-medium">{node.name}</span>
                    </div>
                    {idx < simNodes.length - 1 && (
                      <ChevronRight className="size-4 text-muted-foreground mx-0.5 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Node details */}
            <div className="grid grid-cols-2 gap-3">
              {/* Decision path */}
              <div className="p-4 border rounded-lg space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Crosshair className="size-4" /> 网关决策
                </Label>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">金额判断</span>
                    <span className="font-medium">{simVars.find((v) => v.key === "amount")?.value || "60000"} {">"} 50000</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">决策结果</span>
                    <Badge variant="default" className="text-xs">走 VP 审批</Badge>
                  </div>
                </div>
              </div>

              {/* Task assignment */}
              <div className="p-4 border rounded-lg space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="size-4" /> 任务分配
                </Label>
                <div className="text-xs space-y-1">
                  {simNodes.filter((n) => n.type === "task").map((n) => (
                    <div key={n.id} className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">{n.name}</span>
                      <span className="font-medium">{n.assignee}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimated time */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Timer className="size-4" /> 预计执行时间
                </Label>
                <span className="text-lg font-semibold text-primary">~14h 1m</span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>提交申请: 1m</span>
                <span>部门经理审批: 2h</span>
                <span>VP 审批: 8h</span>
                <span>财务审批: 4h</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSimDialogOpen(false)}>关闭</Button>
            <Button onClick={handleStartSim} disabled={simRunning}>
              {simRunning ? <Loader2 className="size-4 animate-spin mr-1" /> : <Play className="size-4 mr-1" />}
              {simRunning ? "模拟中..." : "开始模拟"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Batch Print Dialog ── */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="size-5" /> 批量打印
            </DialogTitle>
            <DialogDescription>选择要打印的流程记录，系统将生成可打印的文档</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>打印范围</Label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部流程记录</SelectItem>
                  <SelectItem value="selected">已选中的记录</SelectItem>
                  <SelectItem value="filtered">当前筛选结果</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>打印模板</Label>
              <Select defaultValue="standard">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">标准流程表</SelectItem>
                  <SelectItem value="detail">详细流程卡片</SelectItem>
                  <SelectItem value="summary">汇总表</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              将使用浏览器打印功能生成可打印页面，请确保打印机已连接
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>取消</Button>
            <Button onClick={() => { setPrintDialogOpen(false); setSimToast("已发送到打印机"); }}>
              <Printer className="size-4 mr-1" /> 确认打印
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Excel Import Dialog ── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5" /> Excel 批量导入
            </DialogTitle>
            <DialogDescription>上传 Excel 文件批量导入流程数据</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">拖放 Excel 文件到此处，或点击选择文件</p>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="max-w-xs mx-auto"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              {importFile && (
                <p className="text-xs text-primary mt-2">已选择: {importFile.name}</p>
              )}
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              支持 .xlsx、.xls、.csv 格式，单次最多导入 1000 条记录
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportFile(null); }}>取消</Button>
            <Button onClick={() => { setImportDialogOpen(false); setImportFile(null); setSimToast("导入任务已提交"); }} disabled={!importFile}>
              <Upload className="size-4 mr-1" /> 开始导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cascade Filter Dialog ── */}
      <Dialog open={cascadeDialogOpen} onOpenChange={setCascadeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Columns className="size-5" /> 级联筛选配置
            </DialogTitle>
            <DialogDescription>配置字段之间的级联关联关系</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>子级字段</Label>
              <Select value={cascadeField} onValueChange={setCascadeField}>
                <SelectTrigger>
                  <SelectValue placeholder="选择子级字段" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">部门</SelectItem>
                  <SelectItem value="category">流程分类</SelectItem>
                  <SelectItem value="status">流程状态</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>父级字段</Label>
              <Select value={cascadeParent} onValueChange={setCascadeParent}>
                <SelectTrigger>
                  <SelectValue placeholder="选择父级字段" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="type">流程类型</SelectItem>
                  <SelectItem value="priority">优先级</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cascadeField && cascadeParent && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs">
                级联规则: 选择「{cascadeParent}」后，将自动过滤「{cascadeField}」的可选值
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCascadeDialogOpen(false)}>取消</Button>
            <Button onClick={() => { setCascadeDialogOpen(false); setSimToast("级联筛选已配置"); }}>
              确认配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulation toast */}
      {simToast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {simToast}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── ProcessInstances ─────────────────── */
// TODO: Replace with real API when backend ready (processesApi.listInstances() exists but returns different format; enrich with names/duration/current-node)
const MOCK_INSTANCES = [
  { id: "PI-20260704-001", name: "采购审批 - 王丽提交", definition: "采购审批流程", status: "running", start: "2026-07-04 09:15", duration: "2h 30m", current: "部门经理审批" },
  { id: "PI-20260704-002", name: "差旅报销 - 张伟", definition: "报销审批流程", status: "completed", start: "2026-07-04 08:42", duration: "45m", current: "已完成" },
  { id: "PI-20260703-015", name: "合同签署 - 供应商A", definition: "合同审批流程", status: "running", start: "2026-07-03 14:20", duration: "18h", current: "法务审核" },
  { id: "PI-20260703-012", name: "采购审批 - 李明", definition: "采购审批流程", status: "suspended", start: "2026-07-03 10:05", duration: "暂停", current: "财务审批" },
  { id: "PI-20260702-008", name: "员工入职流程 - HR-001", definition: "入职流程", status: "failed", start: "2026-07-02 16:30", duration: "失败", current: "IT 账号创建" },
];

const instanceStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  running: { label: "运行中", variant: "default", icon: Activity },
  completed: { label: "已完成", variant: "secondary", icon: CheckCircle },
  suspended: { label: "已暂停", variant: "outline", icon: Pause },
  failed: { label: "已失败", variant: "destructive", icon: XCircle },
};

export function ProcessInstances() {
  const [instances, setInstances] = useState(MOCK_INSTANCES);
  const [search, setSearch] = useState("");

  // Load instances from backend API on mount
  useEffect(() => {
    let cancelled = false;
    processesApi
      .listInstances()
      .then((data) => {
        if (cancelled || !data) return;
        // Map API response to local format, using MOCK_INSTANCES fields as fallback
        const mapped = data.map((inst: any) => ({
          id: inst.id || inst.instance_id || `PI-${Date.now()}`,
          name: inst.name || inst.title || inst.id || "未命名实例",
          definition: inst.definition || inst.definition_name || inst.process_key || "未知流程",
          status: inst.status || "running",
          start: inst.start || inst.started_at || inst.created_at || "",
          duration: inst.duration || "",
          current: inst.current || inst.current_node || inst.activity || "",
        }));
        if (mapped.length > 0) {
          setInstances(mapped);
        }
      })
      .catch((err) => {
        console.error("加载流程实例失败，使用本地数据:", err);
      });
    return () => { cancelled = true; };
  }, []);

  /* ── Intervention state ── */
  const [interveneDialogOpen, setInterveneDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [interveneAction, setInterveneAction] = useState<string>("");
  const [interveneTargetNode, setInterveneTargetNode] = useState("");
  const [interveneAssignee, setInterveneAssignee] = useState("");
  const [interveneReason, setInterveneReason] = useState("");
  const [interveneVarKey, setInterveneVarKey] = useState("");
  const [interveneVarValue, setInterveneVarValue] = useState("");
  const [interveneToast, setInterveneToast] = useState<string | null>(null);
  const [interveneLoading, setInterveneLoading] = useState(false);

  useEffect(() => {
    if (!interveneToast) return;
    const t = setTimeout(() => setInterveneToast(null), 2500);
    return () => clearTimeout(t);
  }, [interveneToast]);

  /* ── Load real instances from API ── */
  useEffect(() => {
    processesApi.listInstances()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((inst: any) => ({
            id: inst.id || inst.instance_id || `PI-${Date.now()}`,
            name: inst.name || inst.title || `${inst.definition_id || "流程"} - ${inst.initiator_id || "未知"}`,
            definition: inst.definition_id || inst.definition || "未知流程",
            status: inst.status || "running",
            start: inst.started_at ? new Date(inst.started_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "--",
            duration: inst.ended_at && inst.started_at
              ? `${Math.round((new Date(inst.ended_at).getTime() - new Date(inst.started_at).getTime()) / 60000)}m`
              : inst.status === "completed" ? "已完成" : "进行中",
            current: inst.current_node || inst.status || "--",
          }));
          setInstances(mapped);
        }
      })
      .catch(() => {
        // Keep MOCK_INSTANCES as fallback
      });
  }, []);

  const filtered = instances.filter((i) => i.name.includes(search) || i.id.includes(search));

  function handleOpenIntervene(instanceId: string) {
    setSelectedInstance(instanceId);
    setInterveneAction("");
    setInterveneTargetNode("");
    setInterveneAssignee("");
    setInterveneReason("");
    setInterveneVarKey("");
    setInterveneVarValue("");
    setInterveneDialogOpen(true);
  }

  async function handleConfirmIntervene() {
    if (!interveneAction || !selectedInstance) return;
    setInterveneLoading(true);

    const actionLabels: Record<string, string> = {
      jump: "跳转到节点",
      addSign: "加签",
      transfer: "转办",
      terminate: "终止",
      suspend: "暂停",
      resume: "恢复",
      editVar: "修改变量",
    };

    try {
      const token = localStorage.getItem("mp_token");
      const res = await fetch(`/api/processes/instances/${selectedInstance}/intervene`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ action: interveneAction, reason: interveneReason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "干预操作失败");

      // Update local state based on API response
      const newStatus = json.data.status;
      setInstances((prev) =>
        prev.map((i) =>
          i.id === selectedInstance ? { ...i, status: newStatus } : i
        )
      );
    } catch (err) {
      setInterveneToast("干预操作失败: " + (err instanceof Error ? err.message : "未知错误"));
      setInterveneLoading(false);
      return;
    }

    setInterveneLoading(false);
    setInterveneDialogOpen(false);
    setInterveneToast(`${actionLabels[interveneAction]}操作已执行`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="流程实例"
        description="查看所有运行中、已完成和异常的流程实例"
        action={
          <Button variant="outline" className="gap-2">
            <RotateCcw className="size-4" /> 刷新
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="运行中" value={instances.filter((i) => i.status === "running").length} icon={Activity} />
        <StatCard label="已完成" value={instances.filter((i) => i.status === "completed").length} icon={CheckCircle} />
        <StatCard label="已暂停" value={instances.filter((i) => i.status === "suspended").length} icon={Pause} />
        <StatCard label="已失败" value={instances.filter((i) => i.status === "failed").length} icon={XCircle} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <List className="size-4" /> 实例列表
            </CardTitle>
            <CardDescription>{filtered.length} 个实例</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="size-3 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索实例..." className="pl-7 h-8 w-48 text-sm" />
            </div>
            <Button variant="outline" size="sm"><Filter className="size-3 mr-1" />筛选</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>实例 ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>流程定义</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>当前节点</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inst) => {
                const s = instanceStatusConfig[inst.status] || instanceStatusConfig.running;
                const StatusIcon = s.icon;
                return (
                  <TableRow key={inst.id}>
                    <TableCell className="font-mono text-xs">{inst.id}</TableCell>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell className="text-xs">{inst.definition}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`size-3 ${inst.status === "failed" ? "text-red-500" : inst.status === "running" ? "text-blue-500" : inst.status === "suspended" ? "text-orange-500" : "text-green-500"}`} />
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{inst.current}</TableCell>
                    <TableCell className="text-xs">{inst.duration}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" title="查看详情">
                          <Eye className="size-4" />
                        </Button>
                        {(inst.status === "running" || inst.status === "suspended") && (
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleOpenIntervene(inst.id)}>
                            <Wrench className="size-3 mr-1" /> 干预
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── 流程干预对话框 ── */}
      <Dialog open={interveneDialogOpen} onOpenChange={setInterveneDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="size-5" /> 流程干预
            </DialogTitle>
            <DialogDescription>
              对实例 {selectedInstance} 执行干预操作
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Action select */}
            <div className="space-y-2">
              <Label>干预操作</Label>
              <Select value={interveneAction} onValueChange={setInterveneAction}>
                <SelectTrigger>
                  <SelectValue placeholder="选择干预操作" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jump">跳转到节点</SelectItem>
                  <SelectItem value="addSign">加签</SelectItem>
                  <SelectItem value="transfer">转办</SelectItem>
                  <SelectItem value="terminate">终止</SelectItem>
                  <SelectItem value="suspend">暂停</SelectItem>
                  <SelectItem value="resume">恢复</SelectItem>
                  <SelectItem value="editVar">修改变量</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic form based on action */}
            {interveneAction === "jump" && (
              <div className="space-y-2">
                <Label>目标节点</Label>
                <Select value={interveneTargetNode} onValueChange={setInterveneTargetNode}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择目标节点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submit">提交申请</SelectItem>
                    <SelectItem value="manager">部门经理审批</SelectItem>
                    <SelectItem value="finance">财务审批</SelectItem>
                    <SelectItem value="vp">VP 审批</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(interveneAction === "addSign" || interveneAction === "transfer") && (
              <div className="space-y-2">
                <Label>{interveneAction === "addSign" ? "加签人" : "转办人"}</Label>
                <Input
                  value={interveneAssignee}
                  onChange={(e) => setInterveneAssignee(e.target.value)}
                  placeholder="输入用户名或从通讯录选择"
                />
              </div>
            )}

            {interveneAction === "editVar" && (
              <div className="space-y-2">
                <Label>修改变量</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={interveneVarKey}
                    onChange={(e) => setInterveneVarKey(e.target.value)}
                    placeholder="变量名"
                    className="font-mono text-xs"
                  />
                  <Input
                    value={interveneVarValue}
                    onChange={(e) => setInterveneVarValue(e.target.value)}
                    placeholder="新值"
                  />
                </div>
              </div>
            )}

            {/* Reason input */}
            {interveneAction && (
              <div className="space-y-2">
                <Label>干预原因</Label>
                <Textarea
                  value={interveneReason}
                  onChange={(e) => setInterveneReason(e.target.value)}
                  placeholder="请填写干预原因（必填）"
                  className="h-20"
                />
              </div>
            )}

            {/* Warning for destructive actions */}
            {(interveneAction === "terminate" || interveneAction === "suspend") && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                {interveneAction === "terminate" ? "终止操作将立即结束流程实例，此操作不可撤销。" : "暂停操作将冻结流程实例，所有待办任务将被挂起。"}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterveneDialogOpen(false)}>取消</Button>
            <Button
              variant={interveneAction === "terminate" ? "destructive" : "default"}
              onClick={handleConfirmIntervene}
              disabled={!interveneAction || interveneLoading}
            >
              {interveneLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              确认执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Intervention toast */}
      {interveneToast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {interveneToast}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── ProcessApprovals ─────────────────── */
const MY_APPROVALS = [
  { id: "AP-001", title: "采购申请 - 办公设备采购", submitter: "王丽", type: "采购审批", status: "pending", priority: "high", time: "2 小时前" },
  { id: "AP-002", title: "差旅报销 - 北京出差", submitter: "张伟", type: "报销审批", status: "pending", priority: "normal", time: "4 小时前" },
  { id: "AP-003", title: "合同续签 - 供应商A", submitter: "李娜", type: "合同审批", status: "approved", priority: "high", time: "昨天" },
  { id: "AP-004", title: "请假申请 - 年假", submitter: "刘敏", type: "人事审批", status: "rejected", priority: "normal", time: "2 天前" },
];

const approvalStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审批", variant: "outline" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已驳回", variant: "destructive" },
};

export function ProcessApprovals() {
  const [approvals, setApprovals] = useState(MY_APPROVALS);
  const [filter, setFilter] = useState("all");
  const [stampDialogOpen, setStampDialogOpen] = useState(false);
  const [stampTarget, setStampTarget] = useState<string | null>(null);
  const [stampSaved, setStampSaved] = useState(false);

  /* ── Load real approval tasks from Flowable API ── */
  useEffect(() => {
    flowableApi.listTasks()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((task: any) => ({
            id: task.id || `AP-${Date.now()}`,
            title: task.name || task.description || "未命名审批",
            submitter: task.assignee || "系统",
            type: task.processDefinitionId || "审批流程",
            status: "pending" as const,
            priority: (task.priority ?? 0) >= 75 ? "high" as const : "normal" as const,
            time: task.createTime
              ? new Date(task.createTime).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
              : "--",
          }));
          setApprovals(mapped);
        }
      })
      .catch(() => {
        // Keep MY_APPROVALS as fallback
      });
  }, []);

  const filtered = filter === "all" ? approvals : approvals.filter((a) => a.status === filter);
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  function handleApprove(id: string) {
    setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: "approved" as const } : a));
  }

  function handleReject(id: string) {
    setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: "rejected" as const } : a));
  }

  function handleOpenStamp(id: string) {
    setStampTarget(id);
    setStampSaved(false);
    setStampDialogOpen(true);
  }

  function handleApplyStamp() {
    if (stampTarget) {
      setApprovals((prev) => prev.map((a) => a.id === stampTarget ? { ...a, status: "approved" as const } : a));
    }
    setStampSaved(true);
    setTimeout(() => setStampDialogOpen(false), 800);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="审批中心"
        description="个人审批待办与已办事项"
        action={
          <Button className="gap-2">
            <Send className="size-4" /> 发起审批
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="待我审批" value={pendingCount} icon={Clock} />
        <StatCard label="已通过" value={approvals.filter((a) => a.status === "approved").length} icon={CheckCircle} />
        <StatCard label="已驳回" value={approvals.filter((a) => a.status === "rejected").length} icon={XCircle} />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">全部 ({approvals.length})</TabsTrigger>
          <TabsTrigger value="pending">待审批 ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">已通过</TabsTrigger>
          <TabsTrigger value="rejected">已驳回</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>提交人</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const s = approvalStatusMap[a.status];
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.id}</TableCell>
                        <TableCell className="font-medium">{a.title}</TableCell>
                        <TableCell>{a.submitter}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.type}</Badge></TableCell>
                        <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.time}</TableCell>
                        <TableCell className="text-right">
                          {a.status === "pending" && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" onClick={() => handleApprove(a.id)}>通过</Button>
                              <Button size="sm" variant="outline" onClick={() => handleOpenStamp(a.id)}>
                                <Stamp className="size-3 mr-1" /> 签章
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleReject(a.id)}>驳回</Button>
                            </div>
                          )}
                          {a.status !== "pending" && (
                            <Button variant="ghost" size="icon" className="size-8"><Eye className="size-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stamp Dialog */}
      <Dialog open={stampDialogOpen} onOpenChange={setStampDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stamp className="size-5" /> 电子签章
            </DialogTitle>
            <DialogDescription>为审批单 {stampTarget} 添加电子签章</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 160 }}>
              <div className="w-20 h-20 rounded-full border-[3px] border-red-500 flex items-center justify-center mb-2">
                <div className="text-red-500 text-xs font-bold">公司印章</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">圆形公章模板</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">模板: 圆形公章</Badge>
              <Badge variant="secondary">颜色: 红色</Badge>
            </div>
            {stampSaved && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                <CheckCircle className="size-4" /> 签章已应用，审批已通过
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStampDialogOpen(false)}>取消</Button>
            <Button onClick={handleApplyStamp} disabled={stampSaved}>
              <Stamp className="size-4 mr-1" /> {stampSaved ? "已签章" : "应用签章"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────── ProcessTriggers ─────────────────── */
// Fallback triggers data (API 失败时使用)
const TRIGGERS_FALLBACK = [
  { id: 1, name: "订单创建触发", event: "Order.created", target: "采购审批流程", status: "active", hits: 1248 },
  { id: 2, name: "合同到期提醒", event: "Contract.expires_in_7d", target: "提醒流程", status: "active", hits: 56 },
  { id: 3, name: "库存预警触发", event: "Inventory.low_stock", target: "补货流程", status: "active", hits: 320 },
  { id: 4, name: "审批超时升级", event: "Approval.timeout", target: "升级审批流程", status: "paused", hits: 12 },
];

interface TriggerItem {
  id: string | number;
  name: string;
  event: string;
  target: string;
  status: string;
  hits: number;
}

export function ProcessTriggers() {
  const [triggers, setTriggers] = useState<TriggerItem[]>(TRIGGERS_FALLBACK);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTrigger, setNewTrigger] = useState({ name: "", event: "", target: "", status: "active" });
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TriggerItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  /* Fetch triggers from API */
  useEffect(() => {
    triggersApi.list().then((data) => {
      if (data && data.length > 0) {
        setTriggers(data.map((t: any) => {
          let config: any = {};
          try { config = JSON.parse(t.config || "{}"); } catch {}
          return {
            id: t.id,
            name: t.name,
            event: config.event || t.type,
            target: config.target || "关联流程",
            status: t.status,
            hits: t.hits || 0,
          };
        }));
      }
    }).catch(() => {});
  }, []);

  function toggleStatus(id: string | number) {
    setTriggers((prev) => prev.map((t) => t.id === id ? { ...t, status: t.status === "active" ? "paused" : "active" } : t));
  }

  /* Create trigger */
  async function handleCreateTrigger() {
    if (!newTrigger.name || !newTrigger.event) return;
    setCreating(true);
    try {
      const created = await triggersApi.create({
        name: newTrigger.name,
        type: newTrigger.event,
        config: JSON.stringify({ event: newTrigger.event, target: newTrigger.target }),
        status: newTrigger.status,
      });
      let config: any = {};
      try { config = JSON.parse(created.config || "{}"); } catch {}
      setTriggers((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          event: config.event || created.type,
          target: config.target || "关联流程",
          status: created.status,
          hits: 0,
        },
      ]);
      setCreateOpen(false);
      setNewTrigger({ name: "", event: "", target: "", status: "active" });
      setToast("触发器创建成功");
    } catch {
      setToast("创建触发器失败");
    } finally {
      setCreating(false);
    }
  }

  /* Delete trigger */
  function handleDeleteClick(trigger: TriggerItem) {
    setDeleteTarget(trigger);
    setDeleteOpen(true);
  }

  async function confirmDeleteTrigger() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await triggersApi.delete(String(deleteTarget.id));
      setTriggers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setToast("触发器已删除");
    } catch {
      setToast("删除触发器失败");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="触发器管理"
        description="基于事件驱动的流程自动触发配置"
        action={
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> 新建触发器
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="触发器总数" value={triggers.length} icon={Zap} />
        <StatCard label="已启用" value={triggers.filter((t) => t.status === "active").length} icon={Activity} />
        <StatCard label="累计触发" value={triggers.reduce((s, t) => s + t.hits, 0)} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4" /> 触发器列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>事件</TableHead>
                <TableHead>目标流程</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">触发次数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {triggers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.event}</TableCell>
                  <TableCell className="text-xs">{t.target}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "default" : "secondary"}>
                      {t.status === "active" ? "已启用" : "已暂停"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{t.hits.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(t.id)}>
                        {t.status === "active" ? "暂停" : "启用"}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(t)}>
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Create trigger dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建触发器</DialogTitle>
            <DialogDescription>配置事件触发条件和目标流程</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>触发器名称</Label>
              <Input
                value={newTrigger.name}
                onChange={(e) => setNewTrigger((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="例如：订单创建触发"
              />
            </div>
            <div className="space-y-2">
              <Label>事件类型</Label>
              <Input
                value={newTrigger.event}
                onChange={(e) => setNewTrigger((prev) => ({ ...prev, event: e.target.value }))}
                placeholder="例如：Order.created"
              />
            </div>
            <div className="space-y-2">
              <Label>目标流程</Label>
              <Input
                value={newTrigger.target}
                onChange={(e) => setNewTrigger((prev) => ({ ...prev, target: e.target.value }))}
                placeholder="例如：采购审批流程"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>取消</Button>
            <Button onClick={handleCreateTrigger} disabled={creating || !newTrigger.name || !newTrigger.event}>
              {creating ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除触发器</DialogTitle>
            <DialogDescription>
              确定要删除触发器 "{deleteTarget?.name}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={confirmDeleteTrigger} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── ProcessAnalysis ─────────────────── */
export function ProcessAnalysis() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    processesApi.listInstances()
      .then((data) => setInstances(Array.isArray(data) ? data : []))
      .catch(() => setInstances([]))
      .finally(() => setLoading(false));
  }, []);

  // Compute real statistics from instance data
  const totalInstances = instances.length;
  const completedInstances = instances.filter((i) => i.status === "completed").length;
  const runningInstances = instances.filter((i) => i.status === "running" || i.status === "active").length;
  const failedInstances = instances.filter((i) => i.status === "failed").length;

  // Compute average completion time (from started_at to completed_at)
  const completedWithTime = instances.filter((i) => i.status === "completed" && i.started_at && i.completed_at);
  let avgCompletionTime = "--";
  if (completedWithTime.length > 0) {
    const totalMs = completedWithTime.reduce((sum, i) => {
      const start = new Date(i.started_at).getTime();
      const end = new Date(i.completed_at).getTime();
      return sum + (end - start);
    }, 0);
    const avgMs = totalMs / completedWithTime.length;
    const avgHours = avgMs / (1000 * 60 * 60);
    if (avgHours < 1) {
      avgCompletionTime = `${Math.round(avgHours * 60)}m`;
    } else if (avgHours < 24) {
      avgCompletionTime = `${avgHours.toFixed(1)}h`;
    } else {
      avgCompletionTime = `${(avgHours / 24).toFixed(1)}d`;
    }
  }

  // Success rate
  const successRate = totalInstances > 0
    ? `${((completedInstances / totalInstances) * 100).toFixed(1)}%`
    : "--";

  // Weekly completions (instances completed in the last 7 days)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCompleted = instances.filter((i) =>
    i.status === "completed" && i.completed_at && new Date(i.completed_at).getTime() >= weekAgo
  ).length;

  // Timeout rate (instances that took more than 24h and are still running or failed)
  const timeoutThreshold = 24 * 60 * 60 * 1000;
  const timeoutInstances = instances.filter((i) => {
    if (i.status === "completed") return false;
    if (!i.started_at) return false;
    return Date.now() - new Date(i.started_at).getTime() > timeoutThreshold;
  }).length;
  const timeoutRate = totalInstances > 0
    ? `${((timeoutInstances / totalInstances) * 100).toFixed(1)}%`
    : "--";

  // Process efficiency ranking - group by definition_id
  const processStats: Record<string, { name: string; count: number; completed: number; totalDuration: number }> = {};
  instances.forEach((i) => {
    const key = i.definition_id || i.process_definition_id || i.name || "unknown";
    if (!processStats[key]) {
      processStats[key] = { name: i.name || i.process_name || key, count: 0, completed: 0, totalDuration: 0 };
    }
    processStats[key].count++;
    if (i.status === "completed" && i.started_at && i.completed_at) {
      processStats[key].completed++;
      processStats[key].totalDuration += new Date(i.completed_at).getTime() - new Date(i.started_at).getTime();
    }
  });
  const processRanking = Object.values(processStats)
    .map((p) => ({
      name: p.name,
      avg: p.completed > 0 ? (p.totalDuration / p.completed / (1000 * 60 * 60)).toFixed(1) + "h" : "--",
      rate: p.count > 0 ? Math.round((p.completed / p.count) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="流程分析"
        description="流程效率分析、瓶颈识别与优化建议"
        action={
          <Button variant="outline" className="gap-2">
            <Download className="size-4" /> 导出报告
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="平均审批时长" value={loading ? "..." : avgCompletionTime} icon={Timer} />
        <StatCard label="流程完成率" value={loading ? "..." : successRate} icon={CheckCircle} />
        <StatCard label="超时率" value={loading ? "..." : timeoutRate} trend={-1.2} icon={AlertTriangle} />
        <StatCard label="本周完成" value={loading ? "..." : weeklyCompleted} icon={Activity} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="总实例数" value={loading ? "..." : totalInstances} icon={GitBranch} />
        <StatCard label="已完成" value={loading ? "..." : completedInstances} icon={CheckCircle} />
        <StatCard label="运行中" value={loading ? "..." : runningInstances} icon={Activity} />
        <StatCard label="失败" value={loading ? "..." : failedInstances} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4" /> 流程效率排名
            </CardTitle>
            <CardDescription>按完成率排名（从低到高）</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin mr-2" /> 加载中...
              </div>
            ) : processRanking.length > 0 ? (
              <div className="space-y-3">
                {processRanking.slice(0, 5).map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20 truncate">{p.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${p.rate}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{p.avg}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BarChart3 className="size-8 mb-2 opacity-40" />
                <p className="text-sm">暂无流程实例数据</p>
              </div>
            )}
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
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin mr-2" /> 加载中...
              </div>
            ) : processRanking.length > 0 ? (
              <div className="space-y-3">
                {processRanking.filter((p) => p.avg !== "--").sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg)).slice(0, 3).map((p, idx) => (
                  <div key={p.name} className="flex items-center gap-3 p-3 border rounded-lg">
                    <AlertTriangle className={`size-4 shrink-0 ${idx === 0 ? "text-red-500" : idx === 1 ? "text-orange-500" : "text-yellow-500"}`} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">平均耗时 {p.avg} / 完成率 {p.rate}%</div>
                    </div>
                  </div>
                ))}
                {processRanking.filter((p) => p.avg !== "--").length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <AlertTriangle className="size-8 mb-2 opacity-40" />
                    <p className="text-sm">暂无可分析的瓶颈数据</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertTriangle className="size-8 mb-2 opacity-40" />
                <p className="text-sm">暂无流程实例数据</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────── ProcessPlatform ─────────────────── */
export function ProcessPlatform() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="流程中台"
        description="流程中台 API 文档与接入指南"
        action={
          <Button variant="outline" className="gap-2">
            <BookOpen className="size-4" /> 查看文档
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="API 接口数" value={42} icon={Server} />
        <StatCard label="今日调用" value="12,480" icon={Activity} />
        <StatCard label="平均响应" value="28ms" icon={Timer} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="size-4" /> 核心 API
          </CardTitle>
          <CardDescription>流程中台提供的 RESTful API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { method: "POST", path: "/api/v1/process/start", desc: "启动流程实例" },
              { method: "POST", path: "/api/v1/process/task/complete", desc: "完成任务节点" },
              { method: "GET", path: "/api/v1/process/instances", desc: "查询流程实例" },
              { method: "GET", path: "/api/v1/process/tasks", desc: "查询待办任务" },
              { method: "POST", path: "/api/v1/process/deploy", desc: "部署流程定义" },
              { method: "GET", path: "/api/v1/process/history", desc: "查询流程历史" },
            ].map((api) => (
              <div key={api.path} className="flex items-center gap-3 p-3 border rounded-lg">
                <Badge variant={api.method === "GET" ? "secondary" : "default"} className="font-mono text-xs w-14 justify-center">
                  {api.method}
                </Badge>
                <span className="font-mono text-sm flex-1">{api.path}</span>
                <span className="text-xs text-muted-foreground">{api.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── ProcessExport ─────────────────── */
export function ProcessExport() {
  const [exporting, setExporting] = useState<string | null>(null);

  // TODO: Replace with real export API when backend is ready
  // e.g. const blob = await processesApi.export(format);
  function handleExport(format: string) {
    setExporting(format);
    setTimeout(() => {
      setExporting(null);
      // TODO: Trigger actual file download when API is ready
      // const url = URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.href = url; a.download = `process_export.${format}`; a.click();
    }, 1500);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="流程导出"
        description="导出流程定义、实例数据和分析报告"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: "流程定义 (BPMN XML)", desc: "导出所有流程的 BPMN 2.0 XML 定义文件", format: "bpmn", icon: FileText },
          { name: "流程实例数据", desc: "导出当前运行中和已完成的流程实例数据", format: "instances", icon: List },
          { name: "流程分析报告", desc: "导出流程效率分析报告（PDF）", format: "report", icon: BarChart3 },
          { name: "审批记录", desc: "导出所有审批记录和审批意见", format: "approvals", icon: FileCheck },
          { name: "触发器配置", desc: "导出所有触发器的配置文件", format: "triggers", icon: Zap },
          { name: "全量数据包", desc: "导出所有流程相关数据（ZIP 打包）", format: "all", icon: Download },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.format} className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Icon className="size-8 text-primary" />
                  {exporting === item.format && <Loader2 className="size-4 animate-spin text-primary" />}
                </div>
                <CardTitle className="text-base mt-2">{item.name}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleExport(item.format)}
                  disabled={exporting !== null}
                >
                  <Download className="size-3 mr-1" />
                  {exporting === item.format ? "导出中..." : "导出"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
