import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { processesApi, type ProcessDefinition } from "@/lib/api";
import { ProcessDesignerV2 } from "@/components/flow-designer/ProcessDesignerV2";
import {
  Plus, GitBranch, FileCode, Loader2, AlertCircle, Inbox,
  Trash2, Pen, ArrowLeft,
} from "lucide-react";

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

  /* ── Designer mode ── */
  const [designingProcess, setDesigningProcess] = useState<ProcessDefinition | null>(null);

  /* ── Create dialog state ── */
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [newProcessKey, setNewProcessKey] = useState("");

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
      .then((data) => setProcesses(data ?? []))
      .catch((err: Error) => setError(err.message || "加载流程列表失败"))
      .finally(() => setLoading(false));
  }, [appId]);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  /* ── Create handler ── */
  function handleCreateClick() {
    setNewProcessName("");
    setNewProcessKey(`proc_${Date.now()}`);
    setCreateDialogOpen(true);
  }

  async function confirmCreate() {
    if (!appId) {
      console.error("appId 缺失, 无法创建流程");
      return;
    }
    setCreateDialogOpen(false);
    try {
      // 1. 先在数据库创建空白流程
      const created = await processesApi.create({
        app_id: appId,
        name: newProcessName || "新流程",
        type: "business",
        description: "",
      });
      const realProcess = (created as any)?.data ?? created;
      // 2. 同步本地列表, 广播事件
      setProcesses((prev) => {
        if (prev.find((p) => p.id === realProcess.id)) return prev;
        return [...prev, realProcess as ProcessDefinition];
      });
      window.dispatchEvent(new CustomEvent("mp:flows-changed", { detail: { appId, kind: "create", processId: realProcess.id } }));
      // 3. 进入设计器
      setDesigningProcess(realProcess as ProcessDefinition);
    } catch (e) {
      console.error("创建流程失败:", e);
    }
  }

  /* ── Design handler ── */
  function handleDesign(proc: ProcessDefinition) {
    setDesigningProcess(proc);
  }

  function handleBackToList() {
    setDesigningProcess(null);
  }

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
      window.dispatchEvent(new CustomEvent("mp:flows-changed", { detail: { appId, kind: "delete", processId: deleteTarget.id } }));
      setImportToast("流程已删除");
    } catch {
      setError("删除流程失败");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  }

  /* ── BPMN import ── */
  function handleBpmnImportClick() {
    bpmnInputRef.current?.click();
  }

  async function handleBpmnFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!appId) {
      setError("appId 缺失, 无法导入 BPMN");
      return;
    }
    try {
      const xml = await file.text();
      // 用默认名 "导入-BPMN-时间戳" 作为流程名, 直接 POST 到 process_definitions (persist)
      const baseName = (file.name || "imported.bpmn").replace(/\.bpmn\w*$/i, "");
      const created = await processesApi.create({
        app_id: appId,
        name: `${baseName}（导入 ${new Date().toLocaleDateString()}）`,
        type: "business",
        bpmn_xml: xml,
      });
      const real = (created as any)?.data ?? created;
      setProcesses((prev) => {
        if (prev.find((p) => p.id === real.id)) return prev;
        return [...prev, real as ProcessDefinition];
      });
      window.dispatchEvent(new CustomEvent("mp:flows-changed", { detail: { appId, kind: "import", processId: real.id } }));
      setImportToast(`已导入 "${file.name}" → 新流程 "${(real as any).name || baseName}"`);
    } catch (err) {
      setError("BPMN 导入失败: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  /* ── If designing, show full-height designer ── */
  if (designingProcess) {
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        <ProcessDesignerV2
          definitionId={designingProcess.id}
          className="flex-1"
        />
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">流程</h1>
          <p className="text-sm text-muted-foreground mt-1">
            BPMN 2.0 规范 · 业务流程 + 审批流程 + 服务编排
          </p>
        </div>
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
          <Button className="gap-2" onClick={handleCreateClick}>
            <Plus className="size-4" /> 新建流程
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">正在加载流程列表...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchProcesses}>重试</Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && processes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Inbox className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无流程定义</p>
          <Button variant="outline" size="sm" onClick={handleCreateClick}>
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
              onClick={() => handleDesign(proc)}
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
                  {STATUS_LABELS[proc.status] ?? proc.status ?? "草稿"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleDesign(proc); }}
                >
                  <Pen className="size-3" /> 设计
                </Button>
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

      {/* ── Create dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建流程</DialogTitle>
            <DialogDescription>创建一个新的流程定义，进入设计器编辑。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">流程名称</Label>
              <Input
                value={newProcessName}
                onChange={(e) => setNewProcessName(e.target.value)}
                className="h-8 text-xs"
                placeholder="例如：报销审批流程"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">流程 Key</Label>
              <Input
                value={newProcessKey}
                onChange={(e) => setNewProcessKey(e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="reimbursement_approval"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={confirmCreate}>创建并设计</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除流程</DialogTitle>
            <DialogDescription>
              确定要删除流程 "{deleteTarget?.name}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>取消</Button>
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
