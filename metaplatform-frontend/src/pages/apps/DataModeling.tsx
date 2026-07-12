import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/stat";
import { appServiceApi, type AppServiceObject } from "@/lib/api";
import {
  Plus, Edit, Trash2, Link2,
  Loader2, AlertCircle, Inbox, Box, Database, Save, Globe, Bot, Wand2,
  ListTree,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { RelationshipDiagram } from "@/components/ontology/RelationshipDiagram";
import { ObjectFieldPanel } from "./ObjectFieldPanel";

function fieldCountFromSchema(obj: AppServiceObject): number {
  try {
    if (!obj.schemaJson) return 0;
    const parsed = JSON.parse(obj.schemaJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default function DataModeling() {
  const { appId } = useParams();
  const [objects, setObjects] = useState<AppServiceObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "diagram">("list");

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newObjectName, setNewObjectName] = useState("");
  const [newObjectLabel, setNewObjectLabel] = useState("");
  const [newObjectDescription, setNewObjectDescription] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<AppServiceObject | null>(null);
  const [editObjectName, setEditObjectName] = useState("");
  const [editObjectLabel, setEditObjectLabel] = useState("");
  const [editObjectDescription, setEditObjectDescription] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Virtual Model dialog
  const [showVirtualModel, setShowVirtualModel] = useState(false);
  const [virtualModelTarget, setVirtualModelTarget] = useState<string | null>(null);

  // Field panel
  const [fieldPanelOpen, setFieldPanelOpen] = useState(false);
  const [fieldPanelObject, setFieldPanelObject] = useState<AppServiceObject | null>(null);

  // Fetch objects
  const fetchObjects = useCallback(() => {
    if (!appId) return;
    setLoading(true);
    setError(null);
    appServiceApi
      .listObjects(appId)
      .then((data) => setObjects(data ?? []))
      .catch((err: Error) => setError(err.message || "加载对象列表失败"))
      .finally(() => setLoading(false));
  }, [appId]);

  useEffect(() => { fetchObjects(); }, [fetchObjects]);

  // 监听"全局本体变更"事件 (数字员工 / 其他页面 创建/更新/删除对象/字段),
  // 自动重新拉对象列表, 不要用户手动刷页.
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      // 只刷新本应用 (其它 app 改动则忽略)
      if (detail && typeof detail === "object" && "appId" in detail && detail.appId && detail.appId !== appId) return;
      fetchObjects();
    };
    window.addEventListener("mp:ontology-changed", onChange as EventListener);
    window.addEventListener("mp:app-changed", onChange as EventListener);
    return () => {
      window.removeEventListener("mp:ontology-changed", onChange as EventListener);
      window.removeEventListener("mp:app-changed", onChange as EventListener);
    };
  }, [appId, fetchObjects]);

  // Search filter
  const filtered = objects.filter(
    (o) =>
      o.code.toLowerCase().includes(search.toLowerCase()) ||
      o.name.includes(search),
  );

  // Create object
  const handleCreate = async () => {
    if (!appId) {
      setCreateError("应用 ID 无效");
      return;
    }
    const code = newObjectName.trim();
    const name = newObjectLabel.trim();
    if (!code || !name) {
      setCreateError("对象名和中文名均为必填");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      setCreateError("对象名只能包含小写英文、数字和下划线，且不能以数字开头");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await appServiceApi.createObject(appId, {
        code,
        name,
        description: newObjectDescription.trim() || undefined,
      });
      setNewObjectName("");
      setNewObjectLabel("");
      setNewObjectDescription("");
      setShowCreateDialog(false);
      await fetchObjects();
      window.dispatchEvent(new CustomEvent("mp:ontology-changed", { detail: { kind: "create_object", appId } }));
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "创建对象失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!appId) {
      setError("应用 ID 无效");
      return;
    }
    if (!confirm("确定要删除该对象吗？此操作不可恢复。")) return;
    setDeletingId(id);
    try {
      await appServiceApi.deleteObject(appId, id);
      setObjects((prev) => prev.filter((o) => o.id !== id));
      window.dispatchEvent(new CustomEvent("mp:ontology-changed", { detail: { kind: "delete_object", appId } }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditClick = (obj: AppServiceObject) => {
    setEditingObject(obj);
    setEditObjectName(obj.code);
    setEditObjectLabel(obj.name || "");
    setEditObjectDescription(obj.description || "");
    setEditError(null);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingObject) return;
    if (!appId) {
      setEditError("应用 ID 无效");
      return;
    }
    if (!editObjectLabel.trim()) {
      setEditError("中文名不能为空");
      return;
    }
    setEditing(true);
    setEditError(null);
    try {
      await appServiceApi.updateObject(appId, editingObject.id, {
        name: editObjectLabel.trim(),
        description: editObjectDescription.trim() || undefined,
      });
      fetchObjects();
      setEditDialogOpen(false);
      setEditingObject(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "更新对象失败");
    } finally {
      setEditing(false);
    }
  };

  /**
   * 触发嵌入式数字员工面板 (业务数据建模的"AI 智能建模"入口):
   * 把详细的"帮我建一个应用的数据模型"提示词通过 CustomEvent 推送给 AppDetailLayout,
   * 它就会打开统一的面板 + 把 prompt 预填到输入框. 用户只需按回车即可让模型开干.
   */
  const openAiModeling = (extra?: string) => {
    const base = "为这个应用搭建/梳理一个完整的数据模型";
    const hint = extra ? `\n\n${extra}` : "\n\n依据下面我给的对象提示, 先创建 3~6 个核心业务对象, 每个对象 5~8 个常用字段. 然后在关系图里告诉我建模思路.";
    const prompt = `${base}.${hint}`;
    window.dispatchEvent(new CustomEvent("mp:open-ai-workforce", { detail: { prompt } }));
  };

  /** 让数字员工为指定对象加字段 (走统一面板, 提示词已预填) */
  const openAiAddFields = (obj: AppServiceObject) => {
    const prompt = `为对象「${obj.name || obj.code}」推荐并加上 5~8 个核心字段.`;
    window.dispatchEvent(new CustomEvent("mp:open-ai-workforce", { detail: { prompt } }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在加载对象列表...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <PageHeader
        title="业务数据建模"
        description={`基于本体引擎的对象建模 (应用内 ${objects.length} 个对象)`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2 bg-primary hover:from-violet-100 hover:to-fuchsia-100 border-violet-300"
              onClick={() => openAiModeling()}
              title="让数字员工帮你自动建模"
            >
              <Wand2 className="size-4 text-violet-600" /> AI 智能建模
              <Bot className="size-3.5 text-violet-500" />
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
              <Plus className="size-4" /> 新建对象
            </Button>
          </div>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">关闭</Button>
        </div>
      )}

      {/* View switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border p-0.5 bg-muted/40">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-3 h-7 text-xs rounded-md transition-colors ${view === "list" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Database className="inline size-3 mr-1" />对象列表
          </button>
          <button
            type="button"
            onClick={() => setView("diagram")}
            className={`px-3 h-7 text-xs rounded-md transition-colors ${view === "diagram" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Link2 className="inline size-3 mr-1" />对象关系图
          </button>
        </div>
        <Input
          placeholder="搜索对象..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8"
        />
        <Button variant="outline" size="sm" onClick={() => setShowVirtualModel(true)} className="ml-auto">
          <Globe className="size-4 mr-1" /> 虚拟模型
        </Button>
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <>
          {filtered.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Inbox className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {search ? "没有匹配的对象" : "暂无对象, 请新建"}
              </p>
              {!search && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="size-4 mr-1" /> 新建对象
                  </Button>
                  <Button size="sm" onClick={() => openAiModeling("我没有任何数据建模经验, 请从行业最佳实践起步")}>
                    <Wand2 className="size-4 mr-1" /> 让 AI 帮我建
                  </Button>
                </div>
              )}
            </div>
          )}

          {filtered.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">本应用的对象 ({filtered.length})</CardTitle>
                <CardDescription>所有对象归属于本应用</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>图标</TableHead>
                      <TableHead>对象名</TableHead>
                      <TableHead>中文名</TableHead>
                      <TableHead className="text-right">属性</TableHead>
                      <TableHead className="text-right">动作</TableHead>
                      <TableHead className="text-right">规则</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((obj) => (
                      <TableRow key={obj.id}>
                        <TableCell>
                          <Box className="size-5 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-mono">{obj.code}</TableCell>
                        <TableCell>{obj.name}</TableCell>
                        <TableCell className="text-right">{fieldCountFromSchema(obj)}</TableCell>
                        <TableCell className="text-right">0</TableCell>
                        <TableCell className="text-right">0</TableCell>
                        <TableCell>
                          <Badge variant={obj.dataTableName ? "default" : "secondary"}>
                            {obj.dataTableName ? "已激活" : "未建表"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                          variant="ghost" size="icon" className="size-8"
                          title="字段"
                          onClick={() => {
                            setFieldPanelObject(obj);
                            setFieldPanelOpen(true);
                          }}
                        >
                          <ListTree className="size-4 text-emerald-500" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="size-8"
                          title="让 AI 帮我加字段"
                          onClick={() => openAiAddFields(obj)}
                        >
                          <Wand2 className="size-4 text-violet-500" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="size-8"
                          title="虚拟模型"
                          onClick={() => { setVirtualModelTarget(obj.code); setShowVirtualModel(true); }}
                        >
                          <Globe className="size-4 text-cyan-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" title="编辑对象" onClick={() => handleEditClick(obj)}>
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-8"
                            onClick={() => handleDelete(obj.id)}
                            disabled={deletingId === obj.id}
                          >
                            {deletingId === obj.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* DIAGRAM VIEW - 规范化关系图 */}
      {view === "diagram" && appId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Link2 className="size-4 text-primary" /> 对象关系图
            </CardTitle>
            <CardDescription>
              基于本体真实数据: 节点 = 对象, 边 = 关系. 可拖拽节点 / 滚轮缩放.
              如果觉得模型应该加什么关系, 让数字员工帮你联线.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RelationshipDiagram appId={appId} objects={objects} />
          </CardContent>
        </Card>
      )}

      {/* Create Object Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建对象</DialogTitle>
            <DialogDescription>创建一个新的业务对象 (数据模型)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="obj-name">对象名 (英文标识) *</Label>
              <Input id="obj-name" placeholder="如: Customer、Order" value={newObjectName} onChange={(e) => setNewObjectName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-label">中文名 *</Label>
              <Input id="obj-label" placeholder="如: 客户、订单" value={newObjectLabel} onChange={(e) => setNewObjectLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-desc">描述</Label>
              <Input id="obj-desc" placeholder="简要说明该对象的用途" value={newObjectDescription} onChange={(e) => setNewObjectDescription(e.target.value)} />
            </div>
            {createError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {createError}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Plus className="size-4 mr-1" />}
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Object Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑对象</DialogTitle>
            <DialogDescription>修改对象「{editingObject?.code}」的基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-obj-name">对象名 (英文标识)</Label>
              <Input id="edit-obj-name" placeholder="如: Customer、Order" value={editObjectName} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-obj-label">中文名 *</Label>
              <Input id="edit-obj-label" placeholder="如: 客户、订单" value={editObjectLabel} onChange={(e) => setEditObjectLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-obj-desc">描述</Label>
              <Input id="edit-obj-desc" placeholder="简要说明该对象的用途" value={editObjectDescription} onChange={(e) => setEditObjectDescription(e.target.value)} />
            </div>
            {editError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={editing}>取消</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={editing}>
              {editing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
              {editing ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Virtual Model Dialog */}
      <Dialog open={showVirtualModel} onOpenChange={setShowVirtualModel}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="size-5 text-cyan-500" /> 虚拟业务模型
            </DialogTitle>
            <DialogDescription>
              {virtualModelTarget ? `${virtualModelTarget} 的 HTTP 服务端点` : "所有对象的虚拟 HTTP 服务端点"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(virtualModelTarget
              ? [
                  { method: "GET", path: `/api/v1/${virtualModelTarget}`, desc: "查询列表" },
                  { method: "GET", path: `/api/v1/${virtualModelTarget}/:id`, desc: "查询详情" },
                  { method: "POST", path: `/api/v1/${virtualModelTarget}`, desc: "创建记录" },
                  { method: "PUT", path: `/api/v1/${virtualModelTarget}/:id`, desc: "更新记录" },
                  { method: "DELETE", path: `/api/v1/${virtualModelTarget}/:id`, desc: "删除记录" },
                ]
              : objects.flatMap((obj) => [
                  { method: "GET", path: `/api/v1/${obj.code}`, desc: `${obj.name} 列表` },
                  { method: "POST", path: `/api/v1/${obj.code}`, desc: `${obj.name} 创建` },
                ])
            ).map((ep, i) => (
              <div key={i} className="flex items-center gap-3 p-2 border rounded text-xs">
                <Badge variant={ep.method === "GET" ? "secondary" : ep.method === "POST" ? "default" : ep.method === "DELETE" ? "destructive" : "outline"} className="font-mono text-xs w-16 justify-center">
                  {ep.method}
                </Badge>
                <span className="font-mono flex-1">{ep.path}</span>
                <span className="text-muted-foreground">{ep.desc}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVirtualModel(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {fieldPanelObject && (
        <ObjectFieldPanel
          appId={appId}
          objectId={fieldPanelObject.id}
          objectName={fieldPanelObject.name || fieldPanelObject.code}
          open={fieldPanelOpen}
          onOpenChange={(open) => {
            setFieldPanelOpen(open);
            if (!open) {
              fetchObjects();
            }
          }}
        />
      )}
    </div>
  );
}
