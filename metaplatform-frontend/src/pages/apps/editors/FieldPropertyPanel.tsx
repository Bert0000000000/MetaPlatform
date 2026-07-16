/**
 * Field Property Panel
 *
 * Contextual property editor for a selected DesignerField.
 * Shows/hides property groups based on the field type definition's
 * `props` array.
 */

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  DesignerField,
  getFieldDef,
  WIDTH_OPTIONS,
  type PropertyGroup,
} from "./fieldLibrary";
import type { AppServiceObjectField } from "@/lib/api";

// ─── Section wrapper ───────────────────────────────────────

function PropSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 px-4 py-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ─── Field row helpers ─────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="shrink-0 text-xs text-gray-600">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function FullRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      {children}
    </div>
  );
}

// ─── Options editor (for select / radio / checkbox) ────────

function OptionsEditor({
  options,
  onChange,
}: {
  options: { label: string; value: string }[];
  onChange: (opts: { label: string; value: string }[]) => void;
}) {
  const update = (idx: number, key: "label" | "value", val: string) => {
    const next = [...options];
    next[idx] = { ...next[idx], [key]: val };
    onChange(next);
  };
  const remove = (idx: number) => onChange(options.filter((_, i) => i !== idx));
  const add = () =>
    onChange([
      ...options,
      { label: `选项${options.length + 1}`, value: `opt${options.length + 1}` },
    ]);

  return (
    <div className="space-y-1.5">
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-300" />
          <Input
            value={opt.label}
            onChange={(e) => update(idx, "label", e.target.value)}
            placeholder="显示名称"
            className="h-8 text-xs"
          />
          <Input
            value={opt.value}
            onChange={(e) => update(idx, "value", e.target.value)}
            placeholder="值"
            className="h-8 text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-gray-400 hover:text-red-500"
            onClick={() => remove(idx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={add}
      >
        <Plus className="mr-1 h-3 w-3" /> 添加选项
      </Button>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────

export interface FieldPropertyPanelProps {
  field: DesignerField | null;
  onChange: (patch: Partial<DesignerField>) => void;
  onDelete: () => void;
  /** Ontology objects for data binding (optional) */
  ontologyObjects?: { id: string; label: string; properties?: { id: string; label: string }[] }[];
  /** Properties of the bound object (Java backend fields) */
  boundProperties?: AppServiceObjectField[];
}

export function FieldPropertyPanel({
  field,
  onChange,
  onDelete,
  ontologyObjects,
  boundProperties,
}: FieldPropertyPanelProps) {
  const handle = useCallback(
    (key: keyof DesignerField, value: unknown) => {
      onChange({ [key]: value } as Partial<DesignerField>);
    },
    [onChange],
  );

  if (!field) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-400">
        <div>
          <div className="mb-2 text-3xl">⚙️</div>
          <p>选择一个字段以编辑其属性</p>
        </div>
      </div>
    );
  }

  const def = getFieldDef(field.type);
  const groups = def?.props ?? ["basic", "layout"];
  const has = (g: PropertyGroup) => groups.includes(g);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{def?.label ?? field.type}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {field.type}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={onDelete}
        >
          <Trash2 className="mr-1 h-3 w-3" /> 删除
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Basic */}
        {has("basic") && (
          <PropSection title="基本属性">
            <FullRow label="标签">
              <Input
                value={field.label}
                onChange={(e) => handle("label", e.target.value)}
                className="h-8 text-xs"
              />
            </FullRow>
            <FullRow label="字段标识 (key)">
              <Input
                value={field.fieldKey}
                onChange={(e) => handle("fieldKey", e.target.value)}
                placeholder="用于数据绑定的唯一标识"
                className="h-8 text-xs"
              />
            </FullRow>
            {(field.type === "input" ||
              field.type === "textarea" ||
              field.type === "number" ||
              field.type === "email" ||
              field.type === "phone" ||
              field.type === "url" ||
              field.type === "richtext") && (
              <FullRow label="占位提示">
                <Input
                  value={field.placeholder ?? ""}
                  onChange={(e) => handle("placeholder", e.target.value)}
                  placeholder="请输入占位文字"
                  className="h-8 text-xs"
                />
              </FullRow>
            )}
            {(field.type === "input" ||
              field.type === "textarea" ||
              field.type === "number" ||
              field.type === "switch" ||
              field.type === "datepicker" ||
              field.type === "datetime" ||
              field.type === "rate" ||
              field.type === "color" ||
              field.type === "slider" ||
              field.type === "currency" ||
              field.type === "percent") && (
              <FullRow label="默认值">
                <Input
                  value={String(field.defaultValue ?? "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (field.type === "number" || field.type === "rate" || field.type === "slider" || field.type === "currency" || field.type === "percent") {
                      handle("defaultValue", v === "" ? null : Number(v));
                    } else if (field.type === "switch") {
                      handle("defaultValue", v === "true");
                    } else {
                      handle("defaultValue", v);
                    }
                  }}
                  placeholder="默认值"
                  className="h-8 text-xs"
                />
              </FullRow>
            )}
          </PropSection>
        )}

        {/* Text content (divider / heading) */}
        {has("text") && (
          <PropSection title="文本内容">
            <FullRow label="显示文字">
              <Textarea
                value={field.text ?? ""}
                onChange={(e) => handle("text", e.target.value)}
                placeholder="输入要显示的文字"
                rows={2}
                className="text-xs"
              />
            </FullRow>
          </PropSection>
        )}

        {/* Options */}
        {has("options") && (
          <PropSection title="选项配置">
            <OptionsEditor
              options={field.options ?? []}
              onChange={(opts) => handle("options", opts)}
            />
          </PropSection>
        )}

        {/* Number config */}
        {has("number") && (
          <PropSection title="数值设置">
            <FieldRow label="小数位数">
              <Input
                type="number"
                min={0}
                max={6}
                value={field.precision ?? 0}
                onChange={(e) => handle("precision", Number(e.target.value))}
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="最小值">
              <Input
                type="number"
                value={field.min ?? ""}
                onChange={(e) =>
                  handle("min", e.target.value === "" ? undefined : Number(e.target.value))
                }
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="最大值">
              <Input
                type="number"
                value={field.max ?? ""}
                onChange={(e) =>
                  handle("max", e.target.value === "" ? undefined : Number(e.target.value))
                }
                className="h-8 text-xs"
              />
            </FieldRow>
          </PropSection>
        )}

        {/* File upload config */}
        {has("file") && (
          <PropSection title="上传设置">
            <FieldRow label="允许多文件">
              <Switch
                checked={field.multiple ?? false}
                onCheckedChange={(v) => handle("multiple", v)}
              />
            </FieldRow>
            <FullRow label="文件类型">
              <Select
                value={field.accept ?? "*/*"}
                onValueChange={(v) => handle("accept", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*/*">所有文件</SelectItem>
                  <SelectItem value="image/*">仅图片</SelectItem>
                  <SelectItem value="application/pdf">PDF 文档</SelectItem>
                  <SelectItem value=".doc,.docx">Word 文档</SelectItem>
                  <SelectItem value=".xls,.xlsx">Excel 表格</SelectItem>
                  <SelectItem value="text/*">文本文件</SelectItem>
                </SelectContent>
              </Select>
            </FullRow>
            <FieldRow label="大小限制 (MB)">
              <Input
                type="number"
                min={1}
                value={field.maxFileSize ?? 10}
                onChange={(e) => handle("maxFileSize", Number(e.target.value))}
                className="h-8 text-xs"
              />
            </FieldRow>
          </PropSection>
        )}

        {/* Validation */}
        {has("validation") && (
          <PropSection title="校验规则">
            <FieldRow label="必填">
              <Switch
                checked={field.required}
                onCheckedChange={(v) => handle("required", v)}
              />
            </FieldRow>
            {(field.type === "input" ||
              field.type === "textarea" ||
              field.type === "email" ||
              field.type === "phone" ||
              field.type === "url") && (
              <>
                <FullRow label="正则校验">
                  <Input
                    value={field.pattern ?? ""}
                    onChange={(e) => handle("pattern", e.target.value)}
                    placeholder="如: ^[A-Za-z]+$"
                    className="h-8 text-xs font-mono"
                  />
                </FullRow>
                <FullRow label="校验提示">
                  <Input
                    value={field.patternMsg ?? ""}
                    onChange={(e) => handle("patternMsg", e.target.value)}
                    placeholder="校验失败时的提示信息"
                    className="h-8 text-xs"
                  />
                </FullRow>
              </>
            )}
            {(field.type === "input" || field.type === "textarea") && (
              <div className="flex gap-2">
                <FieldRow label="最小长度">
                  <Input
                    type="number"
                    value={field.min ?? ""}
                    onChange={(e) =>
                      handle("min", e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    className="h-8 text-xs"
                  />
                </FieldRow>
                <FieldRow label="最大长度">
                  <Input
                    type="number"
                    value={field.max ?? ""}
                    onChange={(e) =>
                      handle("max", e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    className="h-8 text-xs"
                  />
                </FieldRow>
              </div>
            )}
          </PropSection>
        )}

        {/* Data binding */}
        {has("binding") && ontologyObjects && ontologyObjects.length > 0 && (
          <PropSection title="数据绑定">
            <FullRow label="关联对象">
              <Select
                value={field.boundObject ?? ""}
                onValueChange={(v) => handle("boundObject", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择数据对象" />
                </SelectTrigger>
                <SelectContent>
                  {ontologyObjects.map((obj) => (
                    <SelectItem key={obj.id} value={obj.id}>
                      {obj.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FullRow>
            {field.boundObject && boundProperties && boundProperties.length > 0 && (
              <FullRow label="关联属性">
                <Select
                  value={field.boundProperty ?? ""}
                  onValueChange={(v) => {
                    const prop = boundProperties.find((p) => p.code === v);
                    const patch: Partial<DesignerField> = { boundProperty: v };
                    if (!field.fieldKey || field.fieldKey === field.boundProperty) {
                      patch.fieldKey = v;
                    }
                    const currentName = boundProperties.find((p) => p.code === field.boundProperty)?.name;
                    if (!field.label || field.label === currentName) {
                      patch.label = prop?.name ?? v;
                    }
                    onChange(patch);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="选择字段属性" />
                  </SelectTrigger>
                  <SelectContent>
                    {boundProperties.map((prop) => (
                      <SelectItem key={prop.code} value={prop.code}>
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FullRow>
            )}
          </PropSection>
        )}

        {/* v1.0.2 Sprint 2 F1.3: lookup 字段专属提示 — 必填目标对象+显示字段 */}
        {field.type === "lookup" && has("binding") && (
          <div
            className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
            data-testid="lookup-config-hint"
          >
            <div className="font-medium mb-1">关联字段配置</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>
                目标对象：
                {field.boundObject
                  ? ontologyObjects?.find((o) => o.id === field.boundObject)?.label
                  : <span className="text-destructive">未选</span>}
              </li>
              <li>
                显示字段：
                {field.boundProperty
                  ? <span className="font-mono">{field.boundProperty}</span>
                  : <span className="text-destructive">未选</span>}
              </li>
            </ul>
            <div className="mt-1 text-[10px] text-amber-600">
              提交表单前必须选齐目标对象 + 显示字段
            </div>
          </div>
        )}

        {/* Layout */}
        {has("layout") && (
          <PropSection title="布局与状态">
            <FieldRow label="宽度">
              <Select
                value={field.width}
                onValueChange={(v) =>
                  handle("width", v as DesignerField["width"])
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="隐藏">
              <Switch
                checked={field.hidden ?? false}
                onCheckedChange={(v) => handle("hidden", v)}
              />
            </FieldRow>
            <FieldRow label="只读">
              <Switch
                checked={field.readonly ?? false}
                onCheckedChange={(v) => handle("readonly", v)}
              />
            </FieldRow>
          </PropSection>
        )}
      </div>
    </div>
  );
}
