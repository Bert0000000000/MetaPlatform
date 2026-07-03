import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/stat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ontologyApi, type OntologyObject } from "@/lib/api";
import {
  Plus, Sparkles, Search, Edit, Trash2, Link2, Loader2, AlertCircle,
  User, Package, Tag, Users, FileText, Receipt, Box, Settings,
} from "lucide-react";

/** Map icon string names from the API to Lucide components */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Package, Tag, Users, FileText, Receipt, Box, Settings,
};

function DynamicIcon({ name, className }: { name?: string; className?: string }) {
  if (name && ICON_MAP[name]) {
    const Icon = ICON_MAP[name];
    return <Icon className={className} />;
  }
  return <Box className={className} />;
}

export default function Objects() {
  const navigate = useNavigate();
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", label: "", icon: "", description: "" });

  const fetchObjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ontologyApi.listObjects();
      setObjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  const handleCreate = async () => {
    if (!form.name || !form.label) return;
    try {
      setCreating(true);
      await ontologyApi.createObject({
        name: form.name,
        label: form.label,
        icon: form.icon || undefined,
        description: form.description || undefined,
      });
      setDialogOpen(false);
      setForm({ name: "", label: "", icon: "", description: "" });
      await fetchObjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除对象「${name}」？`)) return;
    try {
      await ontologyApi.deleteObject(id);
      await fetchObjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const filtered = objects.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="对象（Objects）"
        description="本体 8 要素之第 1 要素：业务对象建模"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" disabled>
              <Sparkles className="size-4" /> AI 对象生成
            </Button>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" /> 新建对象
            </Button>
          </div>
        }
      />

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
        <Button variant="outline" size="sm" disabled>
          <Link2 className="size-4 mr-2" /> 关系图（E-R）
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 border border-destructive/50 rounded bg-destructive/10 text-destructive">
          <AlertCircle className="size-4" />
          <span className="text-sm">{error}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={fetchObjects}>
            重试
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">所有对象（{loading ? "..." : filtered.length}）</CardTitle>
          <CardDescription>基于本体的业务对象，存储于 Neo4j 图数据库</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> 加载中...
            </div>
          ) : objects.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Box className="size-10 mb-3 opacity-40" />
              <p className="text-sm">暂无对象，点击「新建对象」创建第一个</p>
            </div>
          ) : (
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
                  <TableRow
                    key={obj.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/ontology/object/${obj.id}`)}
                  >
                    <TableCell>
                      <DynamicIcon name={obj.icon} className="size-5" />
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/ontology/object/${obj.id}`);
                        }}
                      >
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(obj.id, obj.name);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Object Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建对象</DialogTitle>
            <DialogDescription>创建一个新的本体对象</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="obj-name">对象名（英文标识）</Label>
              <Input
                id="obj-name"
                placeholder="e.g. Customer"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-label">中文标签</Label>
              <Input
                id="obj-label"
                placeholder="e.g. 客户"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-icon">图标名称（可选）</Label>
              <Input
                id="obj-icon"
                placeholder="e.g. User, Package, Tag"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-desc">描述（可选）</Label>
              <Input
                id="obj-desc"
                placeholder="对象描述..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!form.name || !form.label || creating}>
              {creating && <Loader2 className="size-4 animate-spin mr-1" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
