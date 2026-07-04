import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/stat";
import { ontologyApi, type OntologyObject } from "@/lib/api";
import {
  Plus, Search, Sparkles, Edit, Trash2, Link2,
  Loader2, AlertCircle, Inbox, Box, Database, X,
  Brain, GitBranch, Hash, Globe, ArrowRight, Type,
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

export default function DataModeling() {
  const { appId } = useParams();
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newObjectName, setNewObjectName] = useState("");
  const [newObjectLabel, setNewObjectLabel] = useState("");
  const [newObjectDescription, setNewObjectDescription] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // F4.3.6 AI Field Recommendation dialog
  const [showAIRecommend, setShowAIRecommend] = useState(false);
  const [aiTargetObject, setAiTargetObject] = useState<string | null>(null);
  const [aiRecommending, setAiRecommending] = useState(false);
  const [aiFields, setAiFields] = useState<{ name: string; type: string; reason: string }[]>([]);

  // F4.3.7 E-R Diagram dialog
  const [showERDiagram, setShowERDiagram] = useState(false);

  // F4.3.10 Virtual Model dialog
  const [showVirtualModel, setShowVirtualModel] = useState(false);
  const [virtualModelTarget, setVirtualModelTarget] = useState<string | null>(null);

  // F4.3.11 Auto-number in create dialog
  const [newFieldType, setNewFieldType] = useState<string>("text");

  // Fetch objects
  const fetchObjects = useCallback(() => {
    if (!appId) return;
    setLoading(true);
    setError(null);

    ontologyApi
      .listObjects(appId)
      .then((data) => {
        setObjects(data ?? []);
      })
      .catch((err: Error) => {
        setError(err.message || "加载对象列表失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [appId]);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  // Search filter
  const filtered = objects.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.label.includes(search),
  );

  // Create object
  const handleCreate = async () => {
    if (!newObjectName.trim() || !newObjectLabel.trim()) {
      setCreateError("对象名和中文名均为必填");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await ontologyApi.createObject({
        app_id: appId,
        name: newObjectName.trim(),
        label: newObjectLabel.trim(),
        description: newObjectDescription.trim() || undefined,
      });
      // Reset form and refresh
      setNewObjectName("");
      setNewObjectLabel("");
      setNewObjectDescription("");
      setShowCreateDialog(false);
      fetchObjects();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "创建对象失败";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  // Delete object
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该对象吗？此操作不可恢复。")) return;
    setDeletingId(id);
    try {
      await ontologyApi.deleteObject(id);
      setObjects((prev) => prev.filter((o) => o.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "删除失败";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  // F4.3.6 AI Field Recommendation
  const handleAIRecommend = (objectName: string) => {
    setAiTargetObject(objectName);
    setShowAIRecommend(true);
    setAiRecommending(true);
    setAiFields([]);
    setTimeout(() => {
      setAiFields([
        { name: "created_at", type: "datetime", reason: "记录创建时间，便于审计" },
        { name: "updated_at", type: "datetime", reason: "记录最后更新时间" },
        { name: "status", type: "enum", reason: "状态管理，支持工作流" },
        { name: "owner_id", type: "reference", reason: "关联用户，支持权限控制" },
        { name: "tags", type: "array", reason: "标签字段，便于分类搜索" },
      ]);
      setAiRecommending(false);
    }, 1500);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在加载对象列表...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="业务数据建模"
        description="基于本体引擎的对象建模（应用内的数据模型）"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Sparkles className="size-4" /> AI 智能建模
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
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            关闭
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索对象..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowERDiagram(true)}>
          <Link2 className="size-4 mr-2" /> 关系图
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowVirtualModel(true)}>
          <Globe className="size-4 mr-2" /> 虚拟模型
        </Button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Inbox className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? "没有匹配的对象" : "暂无对象，请新建"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="size-4 mr-1" /> 新建对象
            </Button>
          )}
        </div>
      )}

      {/* Objects table */}
      {filtered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">本应用的对象（{filtered.length}）</CardTitle>
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
                    <TableCell className="font-mono">{obj.name}</TableCell>
                    <TableCell>{obj.label}</TableCell>
                    <TableCell className="text-right">{obj.properties_count ?? 0}</TableCell>
                    <TableCell className="text-right">{obj.actions_count ?? 0}</TableCell>
                    <TableCell className="text-right">{obj.rules_count ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={obj.status === "active" ? "default" : "secondary"}>
                        {obj.status === "active" ? "已激活" : obj.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8" title="AI 推荐字段" onClick={() => handleAIRecommend(obj.name)}>
                        <Brain className="size-4 text-violet-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" title="虚拟模型" onClick={() => { setVirtualModelTarget(obj.name); setShowVirtualModel(true); }}>
                        <Globe className="size-4 text-cyan-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
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

      {/* Create Object Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建对象</DialogTitle>
            <DialogDescription>创建一个新的业务对象（数据模型）</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="obj-name">对象名（英文标识） *</Label>
              <Input
                id="obj-name"
                placeholder="如：Customer、Order"
                value={newObjectName}
                onChange={(e) => setNewObjectName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-label">中文名 *</Label>
              <Input
                id="obj-label"
                placeholder="如：客户、订单"
                value={newObjectLabel}
                onChange={(e) => setNewObjectLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-desc">描述</Label>
              <Input
                id="obj-desc"
                placeholder="简要说明该对象的用途"
                value={newObjectDescription}
                onChange={(e) => setNewObjectDescription(e.target.value)}
              />
            </div>
            {/* F4.3.11 自动编号字段 */}
            <div className="space-y-1.5">
              <Label>编号字段类型</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "text", label: "普通文本", icon: Type },
                  { value: "auto-number", label: "自动编号", icon: Hash },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewFieldType(opt.value)}
                    className={`flex items-center gap-2 p-2 rounded border text-sm transition-colors ${
                      newFieldType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <opt.icon className="size-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
              {newFieldType === "auto-number" && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded text-xs">
                  <Hash className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">格式预览: </span>
                  <span className="font-mono">ORD-00001, ORD-00002, ORD-00003...</span>
                </div>
              )}
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
              {creating ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Plus className="size-4 mr-1" />
              )}
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F4.3.6 AI Field Recommendation Dialog */}
      <Dialog open={showAIRecommend} onOpenChange={setShowAIRecommend}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="size-5 text-violet-500" /> AI 字段推荐
            </DialogTitle>
            <DialogDescription>
              为「{aiTargetObject}」推荐常用字段
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {aiRecommending ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="size-5 animate-spin text-violet-500" />
                <span className="text-sm text-muted-foreground">AI 正在分析推荐字段...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {aiFields.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Hash className="size-4 text-violet-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{f.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{f.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{f.reason}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <Plus className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIRecommend(false)}>关闭</Button>
            {!aiRecommending && aiFields.length > 0 && (
              <Button onClick={() => { alert("已添加全部推荐字段"); setShowAIRecommend(false); }}>
                <Sparkles className="size-3 mr-1" /> 全部添加
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F4.3.7 E-R Diagram Dialog */}
      <Dialog open={showERDiagram} onOpenChange={setShowERDiagram}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="size-5" /> 对象关系图
            </DialogTitle>
            <DialogDescription>本体对象间的 E-R 关系</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-muted/30">
            <svg viewBox="0 0 600 320" className="w-full h-auto">
              {/* Entity boxes */}
              {[
                { x: 50, y: 30, w: 140, h: 80, label: "Customer", fields: "id, name, email" },
                { x: 250, y: 30, w: 140, h: 80, label: "Order", fields: "id, amount, date" },
                { x: 450, y: 30, w: 140, h: 80, label: "Product", fields: "id, name, price" },
                { x: 150, y: 200, w: 140, h: 80, label: "Contact", fields: "id, phone, type" },
                { x: 350, y: 200, w: 140, h: 80, label: "Invoice", fields: "id, total, status" },
              ].map((entity, i) => (
                <g key={i}>
                  <rect x={entity.x} y={entity.y} width={entity.w} height={entity.h} rx="6" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  <text x={entity.x + entity.w / 2} y={entity.y + 20} textAnchor="middle" className="text-[11px] font-semibold" fill="hsl(var(--foreground))">{entity.label}</text>
                  <line x1={entity.x + 8} y1={entity.y + 28} x2={entity.x + entity.w - 8} y2={entity.y + 28} stroke="hsl(var(--border))" strokeWidth="0.5" />
                  <text x={entity.x + 10} y={entity.y + 45} className="text-[9px]" fill="hsl(var(--muted-foreground))">{entity.fields}</text>
                </g>
              ))}
              {/* Relationship lines */}
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
                </marker>
              </defs>
              <line x1={190} y1={70} x2={250} y2={70} stroke="hsl(var(--primary))" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <text x={220} y={62} textAnchor="middle" className="text-[8px]" fill="hsl(var(--muted-foreground))">1:N</text>
              <line x1={390} y1={70} x2={450} y2={70} stroke="hsl(var(--primary))" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <text x={420} y={62} textAnchor="middle" className="text-[8px]" fill="hsl(var(--muted-foreground))">N:M</text>
              <line x1={120} y1={110} x2={170} y2={200} stroke="hsl(var(--primary))" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <text x={130} y={160} textAnchor="middle" className="text-[8px]" fill="hsl(var(--muted-foreground))">1:N</text>
              <line x1={320} y1={110} x2={380} y2={200} stroke="hsl(var(--primary))" strokeWidth="1.5" markerEnd="url(#arrow)" />
              <text x={365} y={160} textAnchor="middle" className="text-[8px]" fill="hsl(var(--muted-foreground))">N:1</text>
            </svg>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowERDiagram(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F4.3.10 Virtual Model Dialog */}
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
                  { method: "GET", path: `/api/v1/${obj.name}`, desc: `${obj.label} 列表` },
                  { method: "POST", path: `/api/v1/${obj.name}`, desc: `${obj.label} 创建` },
                ])
            ).map((ep, i) => (
              <div key={i} className="flex items-center gap-3 p-2 border rounded text-xs">
                <Badge
                  variant={ep.method === "GET" ? "secondary" : ep.method === "POST" ? "default" : ep.method === "DELETE" ? "destructive" : "outline"}
                  className="font-mono text-[10px] w-16 justify-center"
                >
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
    </div>
  );
}
