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
import { appServiceApi, AppServiceObject, AppServiceObjectField } from "@/lib/api";
import { Loader2, Trash2, Edit3, Save, X } from "lucide-react";
import {
  FIELD_TYPES,
  DEFAULT_FIELD_FORM,
  FieldFormData,
  validateFieldForm,
  shouldShowFieldTypeHelper,
  shouldShowLookupWarning,
  LOOKUP_EDIT_WARNING,
} from "./object-field-config";

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

  // v1.0.2 Sprint 2 F1.1: 当前 app 下所有对象 (供 lookup 类型选目标对象)
  const [targetObjects, setTargetObjects] = useState<AppServiceObject[]>([]);
  const [targetFields, setTargetFields] = useState<AppServiceObjectField[]>([]);
  const [loadingTargetFields, setLoadingTargetFields] = useState(false);

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

  // 加载当前 app 下的所有对象 (除自身)
  const loadTargetObjects = async () => {
    try {
      const data = await appServiceApi.listObjects(appId);
      setTargetObjects(Array.isArray(data) ? data.filter((o) => o.id !== objectId) : []);
    } catch (err) {
      console.warn("加载目标对象失败", err);
      setTargetObjects([]);
    }
  };

  // 加载目标对象的字段列表 (供 displayField 选择)
  const loadTargetFields = async (targetObjId: number) => {
    setLoadingTargetFields(true);
    try {
      const data = await appServiceApi.listFields(appId, targetObjId);
      // displayField 通常是字符串型字段
      const list = Array.isArray(data) ? data : [];
      setTargetFields(list.filter((f) => f.type === "text" || f.type === "longtext" || f.type === "number"));
    } catch (err) {
      console.warn("加载目标对象字段失败", err);
      setTargetFields([]);
    } finally {
      setLoadingTargetFields(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      loadTargetObjects();
      setForm(DEFAULT_FIELD_FORM);
      setEditingCode(null);
      setError(null);
      setTargetFields([]);
    }
  }, [open, objectId, appId]);

  // 当 lookup 类型选中目标对象变化时, 重新加载 displayField 选项
  useEffect(() => {
    if (form.type === "lookup" && form.lookup.objectId) {
      loadTargetFields(form.lookup.objectId);
    } else {
      setTargetFields([]);
    }
  }, [form.type, form.lookup.objectId]);

  const handleSave = async () => {
    const msg = validateFieldForm(form, properties, editingCode);
    if (msg) {
      setError(msg);
      return;
    }

    const data: AppServiceObjectField = {
      code: form.name.trim(),
      name: form.label.trim(),
      type: form.type,
      required: form.required,
      unique: form.unique_field,
      description: form.description.trim() || undefined,
      defaultValue: form.default_value.trim() || undefined,
    };

    // v1.0.2 Sprint 2 F1.1: lookup 类型附 lookup 子配置
    if (form.type === "lookup" && form.lookup.objectId) {
      data.lookup = {
        objectId: form.lookup.objectId,
        displayField: form.lookup.displayField,
      };
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
      unique_field: !!p.unique,
      default_value: p.defaultValue || "",
      description: p.description || "",
      lookup: p.lookup
        ? { objectId: p.lookup.objectId, displayField: p.lookup.displayField }
        : { objectId: null, displayField: "" },
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

  // lookup 子配置: 目标对象选项
  const targetObjectOptions = useMemo(
    () =>
      targetObjects.map((o) => ({
        value: String(o.id),
        label: `${o.name} (${o.code})`,
      })),
    [targetObjects],
  );

  // 当前 lookup 字段的 displayField 选项
  const displayFieldOptions = useMemo(
    () =>
      targetFields.map((f) => ({
        value: f.code,
        label: `${f.name} (${f.code})`,
      })),
    [targetFields],
  );

  // 表格中 lookup 列的描述
  const lookupDescription = (p: AppServiceObjectField) => {
    if (p.type !== "lookup" || !p.lookup) return "-";
    const obj = targetObjects.find((o) => o.id === p.lookup!.objectId);
    const objName = obj ? obj.name : `对象 #${p.lookup.objectId}`;
    return `${objName} / ${p.lookup.displayField}`;
  };

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
              <Label className="flex items-center gap-2">
                字段类型
                {editingCode && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid="field-type-locked-badge">
                    不可修改
                  </Badge>
                )}
              </Label>
              <Select
                value={form.type}
                disabled={!!editingCode}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as FieldFormData["type"] }))
                }
              >
                <SelectTrigger data-testid="field-type-trigger">
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
              {shouldShowFieldTypeHelper(editingCode, form.type) && (
                <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="field-type-helper">
                  AC-103.5: 字段类型不可修改。如需变更, 请先删除该字段再重建。
                </p>
              )}
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

            {/* v1.0.2 Sprint 2 F1.1: lookup 子配置区 */}
            {form.type === "lookup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="field-lookup-target">
                    目标对象 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.lookup.objectId ? String(form.lookup.objectId) : ""}
                    disabled={!!editingCode}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        lookup: { objectId: Number(v), displayField: "" },
                      }))
                    }
                  >
                    <SelectTrigger id="field-lookup-target" data-testid="field-lookup-target-trigger">
                      <SelectValue placeholder="选择关联对象..." />
                    </SelectTrigger>
                    <SelectContent>
                      {targetObjectOptions.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">
                          {loadingTargetFields ? "加载中..." : "当前应用下暂无其它对象"}
                        </div>
                      ) : (
                        targetObjectOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="field-lookup-display">
                    显示字段 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.lookup.displayField}
                    disabled={!!editingCode || !form.lookup.objectId}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        lookup: { ...f.lookup, displayField: v },
                      }))
                    }
                  >
                    <SelectTrigger id="field-lookup-display" data-testid="field-lookup-display-trigger">
                      <SelectValue placeholder={form.lookup.objectId ? "选择显示字段..." : "请先选目标对象"} />
                    </SelectTrigger>
                    <SelectContent>
                      {displayFieldOptions.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">
                          {!form.lookup.objectId ? "请先选目标对象" : "该对象没有可显示字段"}
                        </div>
                      ) : (
                        displayFieldOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {shouldShowLookupWarning(editingCode, form.type) && (
                  <div
                    className="col-span-2 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5"
                    data-testid="field-lookup-helper"
                  >
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <span aria-hidden>⚠</span>
                      {LOOKUP_EDIT_WARNING.title}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {LOOKUP_EDIT_WARNING.body}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {LOOKUP_EDIT_WARNING.action}
                    </p>
                  </div>
                )}
              </>
            )}

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
                  <TableHead>关联配置</TableHead>
                  <TableHead>必填</TableHead>
                  <TableHead>唯一</TableHead>
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
                    <TableCell className="text-xs text-muted-foreground" data-testid={`field-lookup-desc-${p.code}`}>
                      {lookupDescription(p)}
                    </TableCell>
                    <TableCell>{p.required ? "是" : "否"}</TableCell>
                    <TableCell>{p.unique ? "是" : "否"}</TableCell>
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