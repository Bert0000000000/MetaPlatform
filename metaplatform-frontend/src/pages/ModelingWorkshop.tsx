import React, { useCallback, useEffect, useState } from "react";
import {
  listObjectTypes,
  getObjectType,
  createObjectType,
  updateObjectType,
  deleteObjectType,
  nlModeling,
} from "../api/ontologyApi";
import { ObjectTypeSummary } from "../types/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* -- Constants -- */
const FIELD_TYPES = [
  "STRING", "TEXT", "RICH_TEXT", "INTEGER", "LONG", "DOUBLE",
  "BOOLEAN", "DATE", "DATETIME", "ENUM", "REFERENCE", "JSON",
  "EMAIL", "PHONE", "URL", "IMAGE", "FILE", "CURRENCY",
  "PERCENTAGE", "COLOR", "LOCATION", "SIGNATURE",
  "AI_EXTRACT", "AI_GENERATE", "AI_CLASSIFY",
];

const TYPE_LABELS: Record<string, string> = {
  STRING: "文本", TEXT: "长文本", RICH_TEXT: "富文本",
  INTEGER: "整数", LONG: "长整数", DOUBLE: "小数",
  BOOLEAN: "布尔", DATE: "日期", DATETIME: "日期时间",
  ENUM: "枚举", REFERENCE: "引用", JSON: "JSON",
  EMAIL: "邮箱", PHONE: "电话", URL: "链接",
  IMAGE: "图片", FILE: "文件", CURRENCY: "货币",
  PERCENTAGE: "百分比", COLOR: "颜色", LOCATION: "位置",
  SIGNATURE: "签名", AI_EXTRACT: "AI提取", AI_GENERATE: "AI生成", AI_CLASSIFY: "AI分类",
};

type Tab = "info" | "fields" | "lifecycle" | "preview";

interface FieldDef {
  name: string;
  displayName: string;
  fieldType: string;
  required: boolean;
  editable: boolean;
  defaultValue?: string;
  description?: string;
}

interface Transition {
  fromState: string;
  toState: string;
  name: string;
  guardExpression?: string;
  description?: string;
}

/* -- Main Page -- */
const ModelingWorkshop: React.FC = () => {
  const [objectTypes, setObjectTypes] = useState<ObjectTypeSummary[]>([]);
  const [selected, setSelected] = useState<ObjectTypeSummary | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("fields");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* NL Modeling */
  const [nlInput, setNlInput] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<Record<string, unknown> | null>(null);

  /* Create form */
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "", displayName: "", description: "",
    entityTypeId: "",
  });

  /* Field editing */
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);

  /* Lifecycle */
  const [states, setStates] = useState<string[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [newState, setNewState] = useState("");
  const [newTransition, setNewTransition] = useState<Transition>({
    fromState: "", toState: "", name: "",
  });

  /* -- Load -- */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listObjectTypes();
      setObjectTypes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /* -- Select ObjectType -- */
  const handleSelect = async (ot: ObjectTypeSummary) => {
    setSelected(ot);
    setError(null);
    try {
      const d = await getObjectType(ot.id);
      setDetail(d as unknown as Record<string, unknown>);
      const fd = (d as unknown as Record<string, unknown>).fieldDefinitions as FieldDef[] | undefined;
      setFields(fd ?? []);
      const ls = (d as unknown as Record<string, unknown>).lifecycleStates as string[] | undefined;
      setStates(ls ?? []);
      const lt = (d as unknown as Record<string, unknown>).lifecycleTransitions as Transition[] | undefined;
      setTransitions(lt ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载详情失败");
    }
  };

  /* -- Save ObjectType -- */
  const handleSave = async () => {
    if (!selected || !detail) return;
    try {
      await updateObjectType(selected.id, {
        code: detail.code,
        displayName: detail.displayName,
        description: detail.description ?? "",
        entityTypeId: detail.entityTypeId ?? "",
        fieldDefinitions: fields,
        lifecycleStates: states,
        lifecycleTransitions: transitions,
        initialState: states[0] ?? "draft",
      });
      await reload();
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  /* -- Create ObjectType -- */
  const handleCreate = async () => {
    if (!createForm.code || !createForm.displayName) {
      setError("编码和显示名称必填");
      return;
    }
    try {
      await createObjectType({
        ...createForm,
        fieldDefinitions: fields,
        lifecycleStates: states.length > 0 ? states : ["draft", "active", "archived"],
        lifecycleTransitions: transitions,
        initialState: states[0] ?? "draft",
      });
      setShowCreate(false);
      setCreateForm({ code: "", displayName: "", description: "", entityTypeId: "" });
      setFields([]);
      setStates([]);
      setTransitions([]);
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  /* -- Delete ObjectType -- */
  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除此 ObjectType？")) return;
    try {
      await deleteObjectType(id);
      if (selected?.id === id) { setSelected(null); setDetail(null); }
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  /* -- NL Modeling -- */
  const handleNlModeling = async () => {
    if (!nlInput.trim()) return;
    setNlLoading(true);
    setError(null);
    try {
      const result = await nlModeling(nlInput);
      setNlResult(result);
      setCreateForm({
        code: (result.code as string) ?? "",
        displayName: (result.displayName as string) ?? "",
        description: (result.description as string) ?? "",
        entityTypeId: "",
      });
      const fd = result.fieldDefinitions as FieldDef[] | undefined;
      if (fd) setFields(fd);
      const ls = result.lifecycleStates as string[] | undefined;
      if (ls) setStates(ls);
      const lt = result.lifecycleTransitions as Transition[] | undefined;
      if (lt) setTransitions(lt);
      setShowCreate(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "NL 建模失败");
    } finally {
      setNlLoading(false);
    }
  };

  /* -- Field Operations -- */
  const addField = () => {
    setEditingField({ name: "", displayName: "", fieldType: "STRING", required: false, editable: true });
  };
  const saveField = () => {
    if (!editingField || !editingField.name || !editingField.displayName) return;
    const idx = fields.findIndex(f => f.name === editingField.name);
    if (idx >= 0) {
      const next = [...fields]; next[idx] = editingField; setFields(next);
    } else {
      setFields([...fields, editingField]);
    }
    setEditingField(null);
  };
  const removeField = (name: string) => setFields(fields.filter(f => f.name !== name));

  /* -- Lifecycle Operations -- */
  const addState = () => {
    if (newState && !states.includes(newState)) {
      setStates([...states, newState]); setNewState("");
    }
  };
  const removeState = (s: string) => {
    setStates(states.filter(st => st !== s));
    setTransitions(transitions.filter(t => t.fromState !== s && t.toState !== s));
  };
  const addTransition = () => {
    if (newTransition.fromState && newTransition.toState && newTransition.name) {
      setTransitions([...transitions, newTransition]);
      setNewTransition({ fromState: "", toState: "", name: "" });
    }
  };
  const removeTransition = (idx: number) => setTransitions(transitions.filter((_, i) => i !== idx));

  /* -- Render -- */
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">建模特工场</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schema 驱动的业务对象可视化管理
          </p>
        </div>
        <Button onClick={() => {
          setShowCreate(true);
          setFields([]);
          setStates(["draft", "active", "archived"]);
          setTransitions([
            { fromState: "draft", toState: "active", name: "激活" },
            { fromState: "active", toState: "archived", name: "归档" },
          ]);
          setNlResult(null);
        }}>
          + 新建 ObjectType
        </Button>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            x
          </Button>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
          <div className="px-4 py-3 text-sm font-medium text-muted-foreground">
            ObjectType 列表 ({objectTypes.length})
          </div>
          <Separator />
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                加载中...
              </div>
            ) : objectTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p>暂无 ObjectType</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 p-2">
                {objectTypes.map(ot => (
                  <div
                    key={ot.id}
                    className={cn(
                      "relative group flex flex-col gap-0.5 px-3 py-2 rounded-md cursor-pointer transition-colors",
                      selected?.id === ot.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-foreground/80"
                    )}
                    onClick={() => handleSelect(ot)}
                  >
                    <div className="text-sm font-medium pr-6">
                      {ot.displayName || ot.code || ot.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ot.code || ot.name}
                    </div>
                    <button
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDelete(ot.id); }}
                      title="删除"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right detail */}
        <main className="flex-1 overflow-auto p-6">
          {/* Create form */}
          {showCreate && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {nlResult ? "AI 建模结果（可编辑后保存）" : "新建 ObjectType"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>编码 *</Label>
                    <Input
                      value={createForm.code}
                      onChange={e => setCreateForm({ ...createForm, code: e.target.value })}
                      placeholder="e.g. customer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>显示名称 *</Label>
                    <Input
                      value={createForm.displayName}
                      onChange={e => setCreateForm({ ...createForm, displayName: e.target.value })}
                      placeholder="e.g. 客户"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>描述</Label>
                    <Input
                      value={createForm.description}
                      onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="对象描述"
                    />
                  </div>
                </div>

                <FieldEditor
                  fields={fields}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  addField={addField}
                  saveField={saveField}
                  removeField={removeField}
                />

                <LifecycleEditor
                  states={states}
                  transitions={transitions}
                  newState={newState}
                  setNewState={setNewState}
                  newTransition={newTransition}
                  setNewTransition={setNewTransition}
                  addState={addState}
                  removeState={removeState}
                  addTransition={addTransition}
                  removeTransition={removeTransition}
                />

                <div className="flex gap-2">
                  <Button onClick={handleCreate}>创建</Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detail view */}
          {!showCreate && selected && detail && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="fields">字段管理</TabsTrigger>
                  <TabsTrigger value="lifecycle">生命周期</TabsTrigger>
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                </TabsList>
                <Button size="sm" onClick={handleSave}>保存</Button>
              </div>

              <TabsContent value="info">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>编码</Label>
                        <Input
                          value={String(detail.code ?? "")}
                          onChange={e => setDetail({ ...detail, code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>显示名称</Label>
                        <Input
                          value={String(detail.displayName ?? "")}
                          onChange={e => setDetail({ ...detail, displayName: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label>描述</Label>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={String(detail.description ?? "")}
                          onChange={e => setDetail({ ...detail, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fields">
                <FieldEditor
                  fields={fields}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  addField={addField}
                  saveField={saveField}
                  removeField={removeField}
                />
              </TabsContent>

              <TabsContent value="lifecycle">
                <LifecycleEditor
                  states={states}
                  transitions={transitions}
                  newState={newState}
                  setNewState={setNewState}
                  newTransition={newTransition}
                  setNewTransition={setNewTransition}
                  addState={addState}
                  removeState={removeState}
                  addTransition={addTransition}
                  removeTransition={removeTransition}
                />
              </TabsContent>

              <TabsContent value="preview">
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">字段预览</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>字段名</TableHead>
                            <TableHead>显示名</TableHead>
                            <TableHead>类型</TableHead>
                            <TableHead>必填</TableHead>
                            <TableHead>可编辑</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map(f => (
                            <TableRow key={f.name}>
                              <TableCell>
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {f.name}
                                </code>
                              </TableCell>
                              <TableCell>{f.displayName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {TYPE_LABELS[f.fieldType] ?? f.fieldType}
                                </Badge>
                              </TableCell>
                              <TableCell>{f.required ? "Yes" : ""}</TableCell>
                              <TableCell>{f.editable ? "Yes" : ""}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-3">生命周期</h3>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {states.map(s => (
                          <Badge key={s} variant="outline">{s}</Badge>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        {transitions.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">{t.fromState}</Badge>
                            <span className="text-muted-foreground">{"->"}</span>
                            <Badge variant="secondary">{t.toState}</Badge>
                            <span className="text-muted-foreground">({t.name})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Empty state */}
          {!showCreate && !selected && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="text-5xl mb-4">[M]</div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                建模特工场
              </h3>
              <p>选择左侧 ObjectType 查看详情，或点击「新建 ObjectType」开始建模</p>
            </div>
          )}
        </main>
      </div>

      {/* NL modeling bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-t bg-muted/30">
        <span className="text-lg">AI</span>
        <Input
          className="flex-1"
          placeholder="用自然语言描述你的业务对象，AI 自动生成 ObjectType... 例如：我需要一个客户管理对象，包含姓名、邮箱、电话、公司名称"
          value={nlInput}
          onChange={e => setNlInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleNlModeling()}
          disabled={nlLoading}
        />
        <Button
          onClick={handleNlModeling}
          disabled={nlLoading || !nlInput.trim()}
        >
          {nlLoading ? "生成中..." : "AI 建模"}
        </Button>
      </div>
    </div>
  );
};

/* -- Field Editor Component -- */
const FieldEditor: React.FC<{
  fields: FieldDef[];
  editingField: FieldDef | null;
  setEditingField: (f: FieldDef | null) => void;
  addField: () => void;
  saveField: () => void;
  removeField: (name: string) => void;
}> = ({ fields, editingField, setEditingField, addField, saveField, removeField }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
      <CardTitle className="text-base">字段定义 ({fields.length})</CardTitle>
      <Button variant="outline" size="sm" onClick={addField}>+ 添加字段</Button>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>字段名</TableHead>
            <TableHead>显示名</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>必填</TableHead>
            <TableHead>可编辑</TableHead>
            <TableHead style={{ width: 60 }}>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map(f => (
            <TableRow key={f.name}>
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{f.name}</code>
              </TableCell>
              <TableCell>{f.displayName}</TableCell>
              <TableCell>
                <Badge variant="secondary">{TYPE_LABELS[f.fieldType] ?? f.fieldType}</Badge>
              </TableCell>
              <TableCell>{f.required ? "Yes" : ""}</TableCell>
              <TableCell>{f.editable ? "Yes" : ""}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditingField({ ...f })}
                    title="编辑"
                  >
                    E
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeField(f.name)}
                    title="删除"
                  >
                    X
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {fields.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                暂无字段，点击「添加字段」开始
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Edit row */}
      {editingField && (
        <div className="flex flex-wrap items-end gap-3 mt-4 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <Label className="text-xs">字段名 (英文)</Label>
            <Input
              value={editingField.name}
              onChange={e => setEditingField({ ...editingField, name: e.target.value })}
              className="h-8 w-32"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">显示名称</Label>
            <Input
              value={editingField.displayName}
              onChange={e => setEditingField({ ...editingField, displayName: e.target.value })}
              className="h-8 w-32"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">类型</Label>
            <Select
              value={editingField.fieldType}
              onValueChange={val => setEditingField({ ...editingField, fieldType: val })}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={editingField.required}
              onChange={e => setEditingField({ ...editingField, required: e.target.checked })}
              className="rounded border-input"
            />
            必填
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={editingField.editable}
              onChange={e => setEditingField({ ...editingField, editable: e.target.checked })}
              className="rounded border-input"
            />
            可编辑
          </label>
          <Button size="sm" className="h-8" onClick={saveField}>确定</Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingField(null)}>取消</Button>
        </div>
      )}
    </CardContent>
  </Card>
);

/* -- Lifecycle Editor Component -- */
const LifecycleEditor: React.FC<{
  states: string[];
  transitions: Transition[];
  newState: string;
  setNewState: (s: string) => void;
  newTransition: Transition;
  setNewTransition: (t: Transition) => void;
  addState: () => void;
  removeState: (s: string) => void;
  addTransition: () => void;
  removeTransition: (idx: number) => void;
}> = ({ states, transitions, newState, setNewState, newTransition, setNewTransition, addState, removeState, addTransition, removeTransition }) => (
  <div className="space-y-6">
    {/* States */}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">状态 ({states.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          {states.map(s => (
            <Badge key={s} variant="outline" className="gap-1 pr-1">
              {s}
              <button
                className="ml-1 rounded-full hover:bg-destructive/20 px-1 text-xs"
                onClick={() => removeState(s)}
              >
                x
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="新状态名"
            value={newState}
            onChange={e => setNewState(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addState()}
            className="h-8 flex-1"
          />
          <Button size="sm" className="h-8" onClick={addState}>添加</Button>
        </div>
      </CardContent>
    </Card>

    {/* State diagram */}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">状态流转</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          {states.map((s, i) => (
            <React.Fragment key={s}>
              <Badge variant="secondary">{s}</Badge>
              {i < states.length - 1 && (
                <span className="text-muted-foreground">{"->"}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Transitions */}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">流转规则 ({transitions.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>起始状态</TableHead>
              <TableHead>目标状态</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>守卫条件</TableHead>
              <TableHead style={{ width: 50 }}>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transitions.map((t, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{t.fromState}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{t.toState}</Badge>
                </TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{t.guardExpression || "--"}</code>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeTransition(i)}
                  >
                    X
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Add transition */}
        <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <Label className="text-xs">起始状态</Label>
            <Select
              value={newTransition.fromState}
              onValueChange={val => setNewTransition({ ...newTransition, fromState: val })}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="选择" />
              </SelectTrigger>
              <SelectContent>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <span className="text-muted-foreground pb-2">{"->"}</span>
          <div className="space-y-1">
            <Label className="text-xs">目标状态</Label>
            <Select
              value={newTransition.toState}
              onValueChange={val => setNewTransition({ ...newTransition, toState: val })}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="选择" />
              </SelectTrigger>
              <SelectContent>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">流转名称</Label>
            <Input
              value={newTransition.name}
              onChange={e => setNewTransition({ ...newTransition, name: e.target.value })}
              className="h-8 w-32"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">守卫条件 (可选)</Label>
            <Input
              value={newTransition.guardExpression ?? ""}
              onChange={e => setNewTransition({ ...newTransition, guardExpression: e.target.value })}
              className="h-8 w-40"
            />
          </div>
          <Button size="sm" className="h-8" onClick={addTransition}>添加</Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default ModelingWorkshop;
