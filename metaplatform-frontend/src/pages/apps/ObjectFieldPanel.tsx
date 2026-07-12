import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appServiceApi, AppServiceObjectField } from "@/lib/api";
import { Loader2, Trash2, Edit3, Save, X } from "lucide-react";
import { FIELD_TYPES, DEFAULT_FIELD_FORM, FieldFormData } from "./object-field-config";

interface ObjectFieldPanelProps {
  appId: string | number;
  objectId: number;
  objectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObjectFieldPanel({
  appId,
  objectId,
  objectName,
  open,
  onOpenChange,
}: ObjectFieldPanelProps) {
  const [properties, setProperties] = useState<AppServiceObjectField[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FieldFormData>(DEFAULT_FIELD_FORM);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!objectId) return;
    setLoading(true);
    try {
      const data = await appServiceApi.listFields(appId, objectId);
      setProperties(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载字段失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setForm(DEFAULT_FIELD_FORM);
      setEditingCode(null);
      setError(null);
    }
  }, [open, objectId, appId]);

  const validate = (data: FieldFormData) => {
    if (!data.name.trim() || !data.label.trim()) {
      return "字段名和显示名均为必填";
    }
    if (!/^[a-z][a-z0-9_]*$/.test(data.name.trim())) {
      return "字段名只能包含小写英文、数字和下划线，且不能以数字开头";
    }
    const exists = properties.some(
      (p) =>
        p.code === data.name.trim() &&
        (!editingCode || p.code !== editingCode)
    );
    if (exists) {
      return "字段名在当前对象下已存在";
    }
    return null;
  };

  const handleSave = async () => {
    const data: AppServiceObjectField = {
      code: form.name.trim(),
      name: form.label.trim(),
      type: form.type,
      required: form.required,
      description: form.description.trim() || undefined,
      defaultValue: form.default_value.trim() || undefined,
    };
    const msg = validate(form);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingCode) {
        await appServiceApi.updateField(appId, objectId, editingCode, data);
      } else {
        await appServiceApi.addField(appId, objectId, data);
      }
      await load();
      setForm(DEFAULT_FIELD_FORM);
      setEditingCode(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: AppServiceObjectField) => {
    setEditingCode(p.code);
    setForm({
      name: p.code,
      label: p.name,
      type: (p.type as FieldFormData["type"]) || "text",
      required: !!p.required,
      unique_field: false,
      default_value: p.defaultValue || "",
      description: p.description || "",
    });
    setError(null);
  };

  const handleDelete = async (code: string) => {
    if (!confirm("确定删除该字段吗？")) return;
    try {
      await appServiceApi.deleteField(appId, objectId, code);
      await load();
      if (editingCode === code) {
        setEditingCode(null);
        setForm(DEFAULT_FIELD_FORM);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const typeLabel = useMemo(() => {
    const map = new Map(FIELD_TYPES.map((t) => [t.value, t.label]));
    return (v: string) => map.get(v) || v;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>对象字段：{objectName}</DialogTitle>
          <DialogDescription>管理该对象下的字段定义</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Form */}
          <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/30">
            <div className="space-y-1.5">
              <Label htmlFor="field-name">字段名（英文标识）</Label>
              <Input
                id="field-name"
                placeholder="name"
                value={form.name}
                disabled={!!editingCode}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-label">显示名</Label>
              <Input
                id="field-label"
                placeholder="姓名"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>字段类型</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as FieldFormData["type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-default">默认值</Label>
              <Input
                id="field-default"
                placeholder="可选"
                value={form.default_value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_value: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="field-desc">描述</Label>
              <Input
                id="field-desc"
                placeholder="字段用途说明"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-6 col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.required}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, required: v === true }))
                  }
                />
                必填
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.unique_field}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, unique_field: v === true }))
                  }
                />
                唯一
              </label>
            </div>
            <div className="col-span-2 flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                ) : (
                  <Save className="size-4 mr-1" />
                )}
                {editingCode ? "更新字段" : "添加字段"}
              </Button>
              {editingCode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingCode(null);
                    setForm(DEFAULT_FIELD_FORM);
                    setError(null);
                  }}
                >
                  <X className="size-4 mr-1" /> 取消编辑
                </Button>
              )}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="size-4 animate-spin" /> 加载字段...
            </div>
          ) : properties.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              暂无字段，请在上方添加
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>字段名</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>必填</TableHead>
                  <TableHead>唯一</TableHead>
                  <TableHead>默认值</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((p) => (
                  <TableRow key={p.code}>
                    <TableCell className="font-mono">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabel(p.type)}</Badge>
                    </TableCell>
                    <TableCell>{p.required ? "是" : "否"}</TableCell>
                    <TableCell>否</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.defaultValue || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleEdit(p)}
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleDelete(p.code)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
