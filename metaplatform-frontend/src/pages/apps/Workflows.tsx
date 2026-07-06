import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { processesApi, type ProcessDefinition } from "@/lib/api";
import {
  Plus, GitBranch, FileCode, Boxes, Settings, ChevronRight,
  Circle, Pause, CircleDot, Shield, User, ScrollText, Scale,
  FileText, Download, Upload, Save, BarChart3, Clock,
  ArrowRightLeft, MoreHorizontal, Loader2, AlertCircle, Inbox,
  Trash2, Archive,
} from "lucide-react";

const eventTypes = [
  { type: "开始事件", icon: Circle, desc: "6 种触发器" },
  { type: "中间事件", icon: Pause, desc: "捕获/抛出/链接" },
  { type: "结束事件", icon: CircleDot, desc: "8 种结果" },
  { type: "边界事件", icon: Shield, desc: "中断/非中断" },
];

const taskTypes = [
  { type: "用户任务", icon: User, desc: "6 参与者 + 4 任务模式 + 10 按钮" },
  { type: "服务任务", icon: Settings, desc: "6 大适配器" },
  { type: "脚本任务", icon: ScrollText, desc: "Groovy/JS/Python" },
  { type: "业务规则", icon: Scale, desc: "DMN 决策表" },
];

const gatewayTypes = [
  { type: "排他网关", icon: CircleDot, desc: "XOR 决策/合并" },
  { type: "包容网关", icon: Circle, desc: "OR 决策/合并" },
  { type: "并行网关", icon: GitBranch, desc: "AND 分叉/连接" },
  { type: "事件网关", icon: Clock, desc: "事件驱动" },
  { type: "复杂网关", icon: Settings, desc: "自定义" },
];

const subProcessTypes = [
  { type: "嵌入式子流程", desc: "在父流程中" },
  { type: "事件子流程", desc: "触发后执行" },
  { type: "事务子流程", desc: "事务性" },
  { type: "调用活动", desc: "引用全局流程" },
];

const dataElements = [
  { type: "数据对象", icon: FileText },
  { type: "数据输入", icon: Download },
  { type: "数据输出", icon: Upload },
  { type: "数据存储", icon: Save },
];

const connectingTypes = [
  { type: "顺序流", icon: ChevronRight, desc: "实线箭头" },
  { type: "消息流", icon: ArrowRightLeft, desc: "虚线箭头（跨泳池）" },
  { type: "关联", icon: MoreHorizontal, desc: "点线" },
  { type: "数据关联", icon: BarChart3, desc: "数据流向" },
];

const STATUS_LABELS: Record<string, string> = {
  active: "运行中",
  published: "已发布",
  draft: "草稿",
  inactive: "已停用",
};

export default function Workflows() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<ProcessDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bpmnInputRef = useRef<HTMLInputElement>(null);

  /* ── Delete dialog state ── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProcessDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── BPMN import toast ── */
  const [importToast, setImportToast] = useState<string | null>(null);

  useEffect(() => {
    if (!importToast) return;
    const t = setTimeout(() => setImportToast(null), 3000);
    return () => clearTimeout(t);
  }, [importToast]);

  const fetchProcesses = useCallback(() => {
    setLoading(true);
    setError(null);

    processesApi
      .list(appId ? { app_id: appId } : undefined)
      .then((data) => {
        setProcesses(data ?? []);
      })
      .catch((err: Error) => {
        setError(err.message || "加载流程列表失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [appId]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  /* ── Delete handler ── */
  function handleDeleteClick(proc: ProcessDefinition, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteTarget(proc);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await processesApi.delete(deleteTarget.id);
      setProcesses((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setImportToast("流程已删除");
    } catch {
      setError("删除流程失败");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  }

  /* ── BPMN import handler ── */
  function handleBpmnImportClick() {
    bpmnInputRef.current?.click();
  }

  function handleBpmnFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // TODO: Real BPMN XML parsing would use bpmn.js library
    // For now, just accept the file and show a success toast
    const reader = new FileReader();
    reader.onload = () => {
      setImportToast(`BPMN 文件 "${file.name}" 导入成功（解析功能待集成 bpmn.js）`);
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="流程"
        description="BPMN 2.0 规范 · 业务流程 + 审批流程 + 服务编排"
        action={
          <div className="flex gap-2">
            <input
              ref={bpmnInputRef}
              type="file"
              accept=".bpmn,.xml"
              className="hidden"
              onChange={handleBpmnFileChange}
            />
            <Button variant="outline" className="gap-2" onClick={handleBpmnImportClick}>
              <FileCode className="size-4" /> 导入 BPMN XML
            </Button>
            <Button className="gap-2" onClick={() => navigate("/process/designer")}>
              <Plus className="size-4" /> 新建流程
            </Button>
          </div>
        }
      />

      {/* Real process definitions from API */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">流程定义（{processes.length}）</CardTitle>
          <CardDescription>已部署的流程定义列表</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">正在加载流程列表...</p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="size-6 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchProcesses}>
                重试
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && processes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Inbox className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">暂无流程定义</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/process/designer")}>
                <Plus className="size-4 mr-1" /> 创建第一个流程
              </Button>
            </div>
          )}

          {/* Process list */}
          {!loading && !error && processes.length > 0 && (
            <div className="space-y-2">
              {processes.map((proc) => (
                <div
                  key={proc.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/process/designer?definition=${proc.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                      <GitBranch className="size-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{proc.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {proc.type} · v{proc.version}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        proc.status === "active" || proc.status === "published"
                          ? "default"
                          : proc.status === "archived"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {proc.status === "active" ? "运行中" : proc.status === "published" ? "已发布" : proc.status === "archived" ? "已归档" : STATUS_LABELS[proc.status] ?? proc.status ?? "草稿"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteClick(proc, e)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BPMN Elements Showcase - kept as reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">流对象（Flow Objects）</CardTitle>
          <CardDescription>BPMN 2.0 规范的三大基础元素</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 事件 */}
          <div>
            <h4 className="text-sm font-medium mb-3">事件（Events）</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {eventTypes.map((e) => (
                <div key={e.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="mb-1"><e.icon className="size-5" /></div>
                  <div className="font-medium text-sm">{e.type}</div>
                  <div className="text-xs text-muted-foreground">{e.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 活动（任务） */}
          <div>
            <h4 className="text-sm font-medium mb-3">活动（Activities）- 任务</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {taskTypes.map((t) => (
                <div key={t.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="mb-1"><t.icon className="size-5" /></div>
                  <div className="font-medium text-sm">{t.type}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 子流程 */}
          <div>
            <h4 className="text-sm font-medium mb-3">子流程（Sub-Process）</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {subProcessTypes.map((s) => (
                <div key={s.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="font-medium text-sm">{s.type}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 网关 */}
          <div>
            <h4 className="text-sm font-medium mb-3">网关（Gateways）</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {gatewayTypes.map((g) => (
                <div key={g.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="mb-1"><g.icon className="size-5" /></div>
                  <div className="font-medium text-sm">{g.type}</div>
                  <div className="text-xs text-muted-foreground">{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据（Data）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {dataElements.map((d) => (
              <div key={d.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                <div className="mb-1"><d.icon className="size-5" /></div>
                <div className="font-medium text-sm">{d.type}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 连接对象 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">连接对象（Connecting Objects）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {connectingTypes.map((c) => (
              <div key={c.type} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                <div className="mb-1"><c.icon className="size-5" /></div>
                <div className="font-medium text-sm">{c.type}</div>
                <div className="text-xs text-muted-foreground">{c.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 泳道 & Artifacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">泳道（Swimlanes）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">泳池（Pool）</div>
                <div className="text-xs text-muted-foreground">参与者</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">泳道（Lane）</div>
                <div className="text-xs text-muted-foreground">角色/部门</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">制品（Artifacts）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">组（Group）</div>
                <div className="text-xs text-muted-foreground">黄色虚线框</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="font-medium text-sm">文本注释</div>
                <div className="text-xs text-muted-foreground">附加文本说明</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除流程</DialogTitle>
            <DialogDescription>
              确定要删除流程 "{deleteTarget?.name}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />}
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {importToast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {importToast}
        </div>
      )}
    </div>
  );
}
