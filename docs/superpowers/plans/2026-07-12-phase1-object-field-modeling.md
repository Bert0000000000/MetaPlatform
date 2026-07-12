# 应用中心 Phase 1：业务对象字段管理 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「业务数据建模」页中为每个业务对象提供完整的字段管理（增删改查），让对象拥有真实的字段定义，为后续表单/列表/流程自动绑定打基础。

**Architecture:** 新增一个可复用的 `ObjectFieldPanel` 组件，通过 `ontologyApi` 直接操作 `/ontology/objects/:id/properties`；`DataModeling` 列表中的对象新增「字段」入口，点击后弹出 Dialog 加载该面板。字段类型、必填、唯一、默认值、描述均使用已有 `OntologyProperty` 结构。

**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui + internal `ontologyApi`

---

## 文件变更清单

- **Create** `metaplatform-frontend/src/pages/apps/object-field-config.ts` — 字段类型定义与常量
- **Create** `metaplatform-frontend/src/pages/apps/ObjectFieldPanel.tsx` — 字段管理面板组件
- **Modify** `metaplatform-frontend/src/pages/apps/DataModeling.tsx` — 在对象列表增加「字段」按钮和弹窗入口
- **Create** `scripts/verify-object-fields.py` — Playwright 自动化验证脚本

---

## Task 1：创建字段类型常量

**Files:**
- Create: `metaplatform-frontend/src/pages/apps/object-field-config.ts`

定义 v1.0.1 需要的字段类型。`type` 字段直接使用字符串，与 `ontology_properties.type` 列保持一致。

- [ ] **Step 1：写入常量文件**

```ts
export const FIELD_TYPES = [
  { value: "text", label: "短文本", icon: "Type" },
  { value: "longtext", label: "长文本", icon: "AlignLeft" },
  { value: "number", label: "数值", icon: "Hash" },
  { value: "date", label: "日期", icon: "Calendar" },
  { value: "datetime", label: "日期时间", icon: "Clock" },
  { value: "boolean", label: "是/否", icon: "ToggleLeft" },
  { value: "select", label: "单选", icon: "List" },
  { value: "multiselect", label: "多选", icon: "ListChecks" },
  { value: "email", label: "邮箱", icon: "Mail" },
  { value: "phone", label: "手机号", icon: "Phone" },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["value"];

export interface FieldFormData {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  unique_field: boolean;
  default_value: string;
  description: string;
}

export const DEFAULT_FIELD_FORM: FieldFormData = {
  name: "",
  label: "",
  type: "text",
  required: false,
  unique_field: false,
  default_value: "",
  description: "",
};
```

- [ ] **Step 2：提交**

```bash
git add metaplatform-frontend/src/pages/apps/object-field-config.ts
git commit -m "feat(apps): add field type constants for object modeling"
```

---

## Task 2：实现 ObjectFieldPanel 字段管理面板

**Files:**
- Create: `metaplatform-frontend/src/pages/apps/ObjectFieldPanel.tsx`
- Modify: `metaplatform-frontend/src/lib/api.ts` （不需要修改，但确认使用 `ontologyApi.listProperties/createProperty/updateProperty/deleteProperty`）

面板负责：
1. 根据 `objectId` 拉取字段列表。
2. 以表格展示字段（名称、中文名、类型、必填、唯一、默认值、描述）。
3. 支持新增和编辑字段（共用一个表单区域）。
4. 支持删除字段。
5. 名称自动校验：`/^[a-zA-Z_][a-zA-Z0-9_]*$/`。

- [ ] **Step 1：创建面板组件**

```tsx
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
import { ontologyApi, OntologyProperty } from "@/lib/api";
import { Loader2, Plus, Trash2, Edit3, Save, X } from "lucide-react";
import { FIELD_TYPES, DEFAULT_FIELD_FORM, FieldFormData } from "./object-field-config";

interface ObjectFieldPanelProps {
  objectId: string;
  objectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObjectFieldPanel({
  objectId,
  objectName,
  open,
  onOpenChange,
}: ObjectFieldPanelProps) {
  const [properties, setProperties] = useState<OntologyProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FieldFormData>(DEFAULT_FIELD_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!objectId) return;
    setLoading(true);
    try {
      const res = await ontologyApi.listProperties(objectId);
      setProperties(res.data);
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
      setEditingId(null);
      setError(null);
    }
  }, [open, objectId]);

  const validate = (data: FieldFormData, excludeName?: string) => {
    if (!data.name.trim() || !data.label.trim()) {
      return "字段名和显示名均为必填";
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(data.name.trim())) {
      return "字段名只能包含英文、数字和下划线，且不能以数字开头";
    }
    const exists = properties.some(
      (p) =>
        p.name === data.name.trim() &&
        (!editingId || p.id !== editingId) &&
        p.name !== excludeName
    );
    if (exists) {
      return "字段名在当前对象下已存在";
    }
    return null;
  };

  const handleSave = async () => {
    const data = {
      ...form,
      name: form.name.trim(),
      label: form.label.trim(),
      description: form.description.trim() || undefined,
      default_value: form.default_value.trim() || undefined,
    };
    const msg = validate(data, editingId ? undefined : data.name);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await ontologyApi.updateProperty(editingId, data);
      } else {
        await ontologyApi.createProperty(objectId, data);
      }
      await load();
      setForm(DEFAULT_FIELD_FORM);
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: OntologyProperty) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      label: p.label,
      type: (p.type as FieldFormData["type"]) || "text",
      required: !!p.required,
      unique_field: !!p.unique_field,
      default_value: p.default_value || "",
      description: p.description || "",
    });
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该字段吗？")) return;
    try {
      await ontologyApi.deleteProperty(id);
      await load();
      if (editingId === id) {
        setEditingId(null);
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
                disabled={!!editingId}
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
                {editingId ? "更新字段" : "添加字段"}
              </Button>
              {editingId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
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
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.name}</TableCell>
                    <TableCell>{p.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabel(p.type)}</Badge>
                    </TableCell>
                    <TableCell>{p.required ? "是" : "否"}</TableCell>
                    <TableCell>{p.unique_field ? "是" : "否"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.default_value || "-"}
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
                        onClick={() => handleDelete(p.id)}
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
```

- [ ] **Step 2：提交**

```bash
git add metaplatform-frontend/src/pages/apps/ObjectFieldPanel.tsx
git commit -m "feat(apps): add object field management panel"
```

---

## Task 3：在 DataModeling 中集成字段入口

**Files:**
- Modify: `metaplatform-frontend/src/pages/apps/DataModeling.tsx`

在对象列表的操作列增加「字段」按钮，点击后打开 `ObjectFieldPanel`。

- [ ] **Step 1：导入组件并增加状态**

在文件顶部添加：

```tsx
import { ObjectFieldPanel } from "./ObjectFieldPanel";
```

在组件状态区域添加：

```tsx
const [fieldPanelOpen, setFieldPanelOpen] = useState(false);
const [fieldPanelObject, setFieldPanelObject] = useState<OntologyObject | null>(null);
```

- [ ] **Step 2：在操作列添加按钮**

在对象操作列（编辑按钮之前）插入：

```tsx
<Button
  variant="ghost"
  size="icon"
  className="size-8"
  title="字段"
  onClick={() => {
    setFieldPanelObject(obj);
    setFieldPanelOpen(true);
  }}
>
  <ListTree className="size-4 text-emerald-500" />
</Button>
```

同时从 `lucide-react` 导入 `ListTree`：

```tsx
import { ..., ListTree } from "lucide-react";
```

- [ ] **Step 3：渲染面板组件**

在 `</div>` 结束之前（所有 Dialog 之后）添加：

```tsx
{fieldPanelObject && (
  <ObjectFieldPanel
    objectId={fieldPanelObject.id}
    objectName={fieldPanelObject.label || fieldPanelObject.name}
    open={fieldPanelOpen}
    onOpenChange={(open) => {
      setFieldPanelOpen(open);
      if (!open) {
        // 关闭时刷新对象列表，让 properties_count 保持最新
        fetchObjects();
      }
    }}
  />
)}
```

- [ ] **Step 4：运行类型检查**

```bash
cd metaplatform-frontend
.\node_modules\.bin\tsc.cmd --noEmit
```

Expected: `error TS0: no errors`

- [ ] **Step 5：提交**

```bash
git add metaplatform-frontend/src/pages/apps/DataModeling.tsx
git commit -m "feat(apps): wire object field panel into data modeling page"
```

---

## Task 4：自动化验证

**Files:**
- Create: `scripts/verify-object-fields.py`

- [ ] **Step 1：编写验证脚本**

```python
import requests
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"

def main():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": "admin@metaplatform.com", "password": "admin123"},
        timeout=5,
    ).json()
    token = r["data"]["token"]
    user = r["data"]["user"]

    headers = {"Authorization": f"Bearer {token}"}
    apps = requests.get(f"{BASE}/api/apps", headers=headers, timeout=5).json()["data"]
    app_id = apps[0]["id"]

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto("http://localhost:5173/login")
        page.evaluate(
            f"() => {{ localStorage.setItem('metaplatform_token', '{token}'); "
            f"localStorage.setItem('metaplatform_user', '{json.dumps(user)}'); }}"
        )
        page.goto(f"http://localhost:5173/apps/{app_id}/data-modeling")
        page.wait_for_timeout(1500)

        # 创建对象
        page.click('button:has-text("新建对象")')
        page.fill('input[id="obj-name"]', f"PlanObject_{int(__import__('time').time())}")
        page.fill('input[id="obj-label"]', "计划对象")
        page.fill('input[id="obj-desc"]', "测试对象字段管理")
        page.click('button:has-text("创建")')
        page.wait_for_timeout(800)

        # 打开字段面板
        page.locator('button[title="字段"]').first.click()
        page.wait_for_timeout(500)

        # 添加字段
        page.fill('input[id="field-name"]', "plan_name")
        page.fill('input[id="field-label"]', "计划名称")
        page.click('button:has-text("添加字段")')
        page.wait_for_timeout(800)

        # 截图
        page.screenshot(path="d:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/verify-object-fields.png", full_page=False)

        # 校验字段出现在列表
        assert page.locator('td:has-text("plan_name")').count() > 0, "字段未保存"
        browser.close()
        print("OK: object field management verified")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2：运行脚本**

```bash
python scripts/verify-object-fields.py
```

Expected: 输出 `OK: object field management verified`，并在根目录生成 `verify-object-fields.png`。

- [ ] **Step 3：提交**

```bash
git add scripts/verify-object-fields.py
git commit -m "test(apps): add e2e verification for object field management"
```

---

## Spec Coverage 自检

- v1.0.1 US-103「配置业务对象与字段」：✅ 对象创建已有，字段 CRUD 由本计划补齐。
- 字段类型覆盖文本/数值/日期/布尔/枚举：✅ Task 1 覆盖 `text / longtext / number / date / datetime / boolean / select / multiselect`。
- 必填与唯一约束：✅ Task 2 表单中提供。
- 自动建表/字段变更同步：❌ 仍由 ontology-engine 后端负责，前端不处理；如后端未实现，需另开计划。

## Placeholder 自检

本计划无 `TBD`、`TODO`、`implement later`、`similar to` 等占位符；每个步骤均包含完整代码或命令。

## Type Consistency 自检

- `FieldFormData` 中 `type` 使用 `FieldType`，与 `FIELD_TYPES` 常量一致。
- 表单提交给 API 的字段名 `required` / `unique_field` / `default_value` / `description` 与 `OntologyProperty` 接口一致。
- `ObjectFieldPanel` props 中的 `objectId` 和 `objectName` 在 `DataModeling` 中均来自 `OntologyObject`。

---

## 执行方式

Plan complete and saved to `docs/superpowers/plans/2026-07-12-phase1-object-field-modeling.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
