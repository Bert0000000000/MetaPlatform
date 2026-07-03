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
        <Button variant="outline" size="sm">
          <Link2 className="size-4 mr-2" /> 关系图
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
    </div>
  );
}
