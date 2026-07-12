import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Database, Plus, Edit3, Trash2, Search, Filter, Download, Upload,
  ChevronLeft, Eye, Hash, Calendar, Type, ToggleLeft, Link2, ListChecks,
  Save, X, FileText,
} from "lucide-react";
import { ontologyApi, type OntologyObject, type OntologyProperty } from "@/lib/api";
import { PageHeader } from "@/components/ui/stat";

/* ════════════════════════════════════════════════════════════════════
 * Instances: 业务实例 CRUD
 *
 * 选一个对象 (Customer/Order/Product) → 动态加载 schema (25 字段类型)
 *   → 生成数据列表 + 筛选 + 分页
 *   → 动态生成新建/编辑表单
 *   → 实例保存到 localStorage (mock)
 *
 * 这是 P0-1: schema 类型 → 数据实例的桥梁, 完成 L2-2 本体论闭环
 * ════════════════════════════════════════════════════════════════════ */

const FIELD_TYPES = {
  text: { label: "短文本", icon: Type, input: "text" },
  longtext: { label: "长文本", icon: Type, input: "textarea" },
  richtext: { label: "富文本", icon: Type, input: "textarea" },
  integer: { label: "整数", icon: Hash, input: "number" },
  decimal: { label: "小数", icon: Hash, input: "number" },
  currency: { label: "金额", icon: Hash, input: "number" },
  percent: { label: "百分比", icon: Hash, input: "number" },
  boolean: { label: "布尔", icon: ToggleLeft, input: "switch" },
  date: { label: "日期", icon: Calendar, input: "date" },
  datetime: { label: "日期时间", icon: Calendar, input: "datetime-local" },
  email: { label: "邮箱", icon: Type, input: "email" },
  phone: { label: "电话", icon: Type, input: "tel" },
  url: { label: "网址", icon: Type, input: "url" },
  select: { label: "枚举", icon: ListChecks, input: "select" },
  multiselect: { label: "多选", icon: ListChecks, input: "multiselect" },
  relation: { label: "关联", icon: Link2, input: "relation" },
  file: { label: "文件", icon: FileText, input: "text" },
  image: { label: "图片", icon: FileText, input: "text" },
  json: { label: "JSON", icon: FileText, input: "textarea" },
} as const;

type FieldType = keyof typeof FIELD_TYPES;

export function Instances() {
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<OntologyObject | null>(null);
  const [properties, setProperties] = useState<OntologyProperty[]>([]);
  const [instances, setInstances] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null);

  // 加载对象列表
  useEffect(() => {
    ontologyApi.listObjects()
      .then((objs) => {
        setObjects(objs);
        if (objs.length > 0) setSelectedObject(objs[0]);
      })
      .catch(() => setObjects([]));
  }, []);

  // 选中对象时: 加载 schema + 真 API 拉数据
  const loadData = useCallback(async () => {
    if (!selectedObject) return;
    try {
      const [props, insts] = await Promise.all([
        ontologyApi.listProperties(selectedObject.id).catch(() => []),
        ontologyApi.listInstances(selectedObject.id).catch(() => []),
      ]);
      setProperties(props);
      // 后端返回的 data 是 JSON 字符串 parse 后, 加上 __id (后端 id) 给前端用
      setInstances(insts.map((i: any) => ({ __id: i.id, ...i.data, __createdAt: i.created_at })));
      setPage(1);
    } catch {
      setProperties([]);
      setInstances([]);
    }
  }, [selectedObject]);

  useEffect(() => { loadData(); }, [loadData]);

  // 过滤
  const filtered = useMemo(() => {
    if (!search.trim()) return instances;
    const q = search.toLowerCase();
    return instances.filter((inst) =>
      Object.values(inst).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [instances, search]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // 真 API: 保存 (新增或更新)
  const handleSave = async (data: Record<string, unknown>) => {
    if (!selectedObject) return;
    try {
      if (data.__id) {
        // 更新
        await ontologyApi.updateInstance(data.__id as string, data);
      } else {
        // 新建
        await ontologyApi.createInstance(selectedObject.id, data);
      }
      setEditing(null);
      await loadData(); // 重新拉
    } catch (e: unknown) {
      alert("保存失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // 真 API: 删除
  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该数据实例？")) return;
    try {
      await ontologyApi.deleteInstance(id);
      await loadData();
    } catch (e: unknown) {
      alert("删除失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleExport = () => {
    if (!selectedObject) return;
    const data = JSON.stringify(instances, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedObject.name}-instances-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedObject) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            加载中... (无对象)
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="数据实例"
        description="8 要素本体论的运行时数据 — 选择对象查看 / 编辑 / 创建实例"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-3.5 mr-1" /> 导出 JSON
            </Button>
            <Button size="sm" onClick={() => setEditing({})}>
              <Plus className="size-3.5 mr-1" /> 新建实例
            </Button>
          </div>
        }
      />

      {/* 对象选择 + 统计 */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">选择对象:</Label>
              <Select
                value={selectedObject.id}
                onValueChange={(v) => {
                  const obj = objects.find((o) => o.id === v);
                  if (obj) setSelectedObject(obj);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {objects.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label || o.name} <span className="text-muted-foreground text-xs">({o.name})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 ml-auto text-xs text-muted-foreground">
              <span>📦 {properties.length} 字段</span>
              <span>📊 {instances.length} 实例</span>
              <span>🔍 {filtered.length} 过滤后</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜索 + 筛选 */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索任意字段..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            {search && (
              <Button size="sm" variant="ghost" onClick={() => setSearch("")}>
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          {properties.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              该对象还没有字段定义。<br />
              请先到「属性」页面添加字段。
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              暂无数据。点击「新建实例」开始。
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    {properties.slice(0, 5).map((p) => (
                      <TableHead key={p.id} className="text-xs">
                        {p.label || p.name}
                        <span className="ml-1 text-xs text-muted-foreground">({FIELD_TYPES[p.type as FieldType]?.label || p.type})</span>
                      </TableHead>
                    ))}
                    <TableHead className="text-right text-xs">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((inst) => (
                    <TableRow key={inst.__id as string}>
                      {properties.slice(0, 5).map((p) => (
                        <TableCell key={p.id} className="text-xs">
                          {renderCell(inst[p.name], p.type as FieldType)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setViewing(inst)}>
                            <Eye className="size-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(inst)}>
                            <Edit3 className="size-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDelete(inst.__id as string)}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {filtered.length > PAGE_SIZE && (
          <CardContent className="pt-2 pb-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              第 {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} 条 / 共 {filtered.length} 条
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-3" /> 上一页
              </Button>
              <span className="px-2 py-1 text-xs">第 {page} / {totalPages} 页</span>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                下一页 <ChevronLeft className="size-3 rotate-180" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 编辑 Dialog */}
      <InstanceEditDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        instance={editing}
        properties={properties}
        onSave={handleSave}
      />

      {/* 查看 Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>实例详情</DialogTitle>
            <DialogDescription>{selectedObject.label} · {viewing?.__id as string}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2 py-2">
              {properties.map((p) => (
                <div key={p.id} className="grid grid-cols-3 gap-2 text-xs border-b pb-2">
                  <div className="font-medium">{p.label || p.name}</div>
                  <div className="col-span-2 text-muted-foreground">
                    {p.type === "boolean" ? (
                      <Badge variant={viewing[p.name] ? "default" : "secondary"}>
                        {viewing[p.name] ? "✓ 是" : "× 否"}
                      </Badge>
                    ) : (
                      <span className="font-mono">{String(viewing[p.name] ?? "—")}</span>
                    )}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                <div className="text-muted-foreground">创建时间</div>
                <div className="col-span-2 font-mono text-muted-foreground">
                  {(viewing.__createdAt as string) || "—"}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>关闭</Button>
            {viewing && (
              <Button onClick={() => { setEditing(viewing); setViewing(null); }}>
                <Edit3 className="size-3.5 mr-1" /> 编辑
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 渲染单元格
function renderCell(value: unknown, type: FieldType): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (type === "boolean") {
    return <Badge variant={value ? "default" : "secondary"} className="text-xs">
      {value ? "是" : "否"}
    </Badge>;
  }
  if (type === "datetime" || type === "date") {
    return <span className="font-mono text-xs">{String(value).slice(0, 19).replace("T", " ")}</span>;
  }
  if (type === "json") {
    return <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(value).slice(0, 30)}</span>;
  }
  const str = String(value);
  if (str.length > 50) return <span title={str}>{str.slice(0, 50)}…</span>;
  return <span>{str}</span>;
}

// 动态表单 Dialog
function InstanceEditDialog({
  open, onOpenChange, instance, properties, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Record<string, unknown> | null;
  properties: OntologyProperty[];
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (instance) {
      setForm({ ...instance });
    } else {
      setForm({});
    }
  }, [instance, open]);

  const isEdit = !!instance?.__id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑实例" : "新建实例"}</DialogTitle>
          <DialogDescription>
            {properties.length} 个字段, 按 25 字段类型动态生成表单
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {properties.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              该对象还没有字段定义。
            </div>
          )}
          {properties.map((p) => {
            const ftype = FIELD_TYPES[p.type as FieldType];
            const value = form[p.name] ?? "";
            return (
              <div key={p.id} className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  {p.label || p.name}
                  <span className="text-muted-foreground font-normal">
                    ({ftype?.label || p.type})
                  </span>
                  {p.required ? <span className="text-destructive">*</span> : null}
                </Label>
                {p.type === "longtext" || p.type === "richtext" || p.type === "json" ? (
                  <Textarea
                    value={String(value)}
                    onChange={(e) => setForm((f) => ({ ...f, [p.name]: e.target.value }))}
                    className="text-xs min-h-[60px] font-mono"
                    rows={3}
                  />
                ) : p.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={value ? "default" : "outline"}
                      onClick={() => setForm((f) => ({ ...f, [p.name]: !value }))}
                    >
                      {value ? "✓ 是" : "× 否"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {value ? "true" : "false"}
                    </span>
                  </div>
                ) : p.type === "select" ? (
                  <Input
                    value={String(value)}
                    onChange={(e) => setForm((f) => ({ ...f, [p.name]: e.target.value }))}
                    placeholder="枚举值 (逗号分隔)"
                    className="text-xs h-8"
                  />
                ) : (
                  <Input
                    type={ftype?.input || "text"}
                    value={String(value)}
                    onChange={(e) => setForm((f) => ({ ...f, [p.name]: e.target.value }))}
                    className="text-xs h-8"
                    required={!!p.required}
                  />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => onSave(form)} disabled={properties.length === 0}>
            <Save className="size-3.5 mr-1" /> 保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
