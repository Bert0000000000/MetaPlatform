/**
 * Enhanced Low-Code Form Editor
 *
 * A section-based, drag-and-drop form designer with:
 * - 25+ field types organized by category (basic / advanced / business / layout)
 * - Section containers with configurable column layout (1-4 cols)
 * - Rich contextual property panel per field type
 * - Data-model binding (ontology objects + properties)
 * - Design ↔ Preview toggle using the runtime SchemaRenderer
 * - Native HTML5 drag-and-drop for field reordering
 *
 * Backward-compatible with the existing FormEditorProps interface:
 * the DesignerState is serialized into the components array so the
 * parent's save mechanism (usePageEditor → filesystem) persists it.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Code2,
  Layers,
  ArrowUp,
  ArrowDown,
  Database,
  Undo2,
  Redo2,
  Frame,
} from "lucide-react";
import type { FormEditorProps } from "./types";
import type { PageComponent } from "./types";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  fieldsByCategory,
  getFieldDef,
  createField,
  type DesignerField,
  type FieldCategory,
} from "./fieldLibrary";
import type { DesignerState, DesignerSection } from "./DesignerTypes";
import {
  stateToJson,
  jsonToState,
} from "./schemaConverter";
import { FieldPropertyPanel } from "./FieldPropertyPanel";
import { SchemaPreview } from "./SchemaPreview";
import { IframePreview } from "./IframePreview";
import { getIcon } from "./icons";
import { useUndoRedo } from "./useUndoRedo";
import { appsApi, appServiceApi, type AppServiceObject, type AppServiceObjectField } from "@/lib/api";
import { cn } from "@/lib/utils";

/** AC-201.6 撤销/重做 coalesceKey 命名空间. */
const COALESCE_KEYS = {
  fieldProps: (id: string) => `field:${id}:props`,
  fieldAdd: "field:add",
  fieldDelete: (id: string) => `field:${id}:delete`,
  fieldDuplicate: (id: string) => `field:${id}:duplicate`,
  fieldMove: (id: string) => `field:${id}:move`,
  fieldDrop: "field:drop",
  sectionAdd: "section:add",
  sectionDelete: (id: string) => `section:${id}:delete`,
  sectionProps: (id: string) => `section:${id}:props`,
  bindingObject: "binding:object",
};

// ─── Constants ─────────────────────────────────────────────

const DESIGNER_SENTINEL = "__designer_state__";
const WIDTH_SPAN: Record<DesignerField["width"], number> = {
  full: 12,
  half: 6,
  third: 4,
  quarter: 3,
};

// ─── Designer State ↔ Components sync ──────────────────────

function mapObjectTypeToWidget(type: string): string {
  switch (type) {
    case "longtext": return "textarea";
    case "number": return "number";
    case "boolean": return "switch";
    case "date": return "datepicker";
    case "datetime": return "datetime";
    case "select": return "select";
    case "multiselect": return "select";
    case "email": return "email";
    case "phone": return "phone";
    default: return "input";
  }
}

function mapObjectTypeToIcon(type: string): string {
  switch (type) {
    case "longtext": return "AlignLeft";
    case "number": return "Hash";
    case "boolean": return "ToggleLeft";
    case "date":
    case "datetime": return "Calendar";
    case "select":
    case "multiselect": return "List";
    case "email": return "Mail";
    case "phone": return "Phone";
    default: return "Type";
  }
}

function stateToComponents(state: DesignerState): PageComponent[] {
  return [
    {
      id: DESIGNER_SENTINEL,
      type: DESIGNER_SENTINEL,
      props: { state },
      span: 12,
    } as PageComponent,
  ];
}

function componentsToState(
  components: PageComponent[],
  pageName: string,
): DesignerState | null {
  const found = components?.find((c) => c.type === DESIGNER_SENTINEL);
  if (found?.props?.state) {
    return found.props.state as DesignerState;
  }
  // Try JSON string format
  if (found?.props?.json) {
    return jsonToState(found.props.json as string, pageName);
  }
  return null;
}

function createEmptyState(name: string): DesignerState {
  return {
    version: 1,
    pageName: name,
    pageType: "form",
    sections: [
      {
        id: `sec_${Date.now().toString(36)}`,
        title: "基本信息",
        columns: 2,
        collapsed: false,
        fields: [],
      },
    ],
  };
}

// ─── Field Palette (left panel) ────────────────────────────

function FieldPalette({
  onAddField,
  objectFields,
  onAddObjectField,
}: {
  onAddField: (type: string) => void;
  objectFields: AppServiceObjectField[];
  onAddObjectField: (field: AppServiceObjectField) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Layers className="h-3.5 w-3.5" /> 组件库
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {CATEGORY_ORDER.map((cat: FieldCategory) => {
          const fields = fieldsByCategory(cat);
          return (
            <div key={cat} className="mb-3">
              <div className="mb-1.5 px-1 text-xs font-medium text-gray-400">
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {fields.map((def) => {
                  const Icon = getIcon(def.icon);
                  return (
                    <button
                      key={def.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("field-type", def.type);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => onAddField(def.type)}
                      className="group flex flex-col items-center gap-1 rounded-md border border-gray-100 bg-white px-2 py-2.5 text-center transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm active:scale-95"
                      title={def.description}
                    >
                      <Icon className="h-4 w-4 text-gray-500 transition-colors group-hover:text-blue-500" />
                      <span className="text-xs text-gray-600 group-hover:text-blue-600">
                        {def.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {objectFields.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <div className="mb-1.5 px-1 text-xs font-medium text-gray-400">
              对象字段
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {objectFields.map((field) => {
                const Icon = getIcon(mapObjectTypeToIcon(field.type));
                return (
                  <button
                    key={field.code}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("object-field-code", field.code);
                      e.dataTransfer.setData("object-field-name", field.name);
                      e.dataTransfer.setData("object-field-type", field.type);
                      e.dataTransfer.setData("object-field-required", String(field.required));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAddObjectField(field)}
                    className="group flex flex-col items-center gap-1 rounded-md border border-gray-100 bg-white px-2 py-2.5 text-center transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm active:scale-95"
                    title={field.description || field.name}
                  >
                    <Icon className="h-4 w-4 text-gray-500 transition-colors group-hover:text-blue-500" />
                    <span className="text-xs text-gray-600 group-hover:text-blue-600 truncate w-full">
                      {field.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────

function SectionHeader({
  section,
  onToggleCollapse,
  onTitleChange,
  onColumnsChange,
  onDelete,
  onAddField,
}: {
  section: DesignerSection;
  onToggleCollapse: () => void;
  onTitleChange: (title: string) => void;
  onColumnsChange: (cols: 1 | 2 | 3 | 4) => void;
  onDelete: () => void;
  onAddField: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-gray-50/80 px-3 py-2">
      <button
        onClick={onToggleCollapse}
        className="text-gray-400 hover:text-gray-600"
      >
        {section.collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      <input
        value={section.title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="flex-1 bg-transparent text-sm font-medium text-gray-700 outline-none focus:bg-white focus:px-1 focus:rounded"
      />
      <div className="flex items-center gap-1">
        <Select
          value={String(section.columns)}
          onValueChange={(v) =>
            onColumnsChange(Number(v) as 1 | 2 | 3 | 4)
          }
        >
          <SelectTrigger className="h-7 w-[70px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1列</SelectItem>
            <SelectItem value="2">2列</SelectItem>
            <SelectItem value="3">3列</SelectItem>
            <SelectItem value="4">4列</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onAddField}
        >
          <Plus className="mr-0.5 h-3 w-3" /> 字段
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Field Card (in canvas) ────────────────────────────────

function FieldCard({
  field,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  field: DesignerField;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const def = getFieldDef(field.type);
  const Icon = getIcon(def?.icon ?? "Type");
  const span = WIDTH_SPAN[field.width] ?? 12;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={cn(
        "group relative cursor-pointer rounded-md border p-2.5 transition-all",
        selected
          ? "border-blue-400 bg-blue-50/30 ring-1 ring-blue-300"
          : "border-gray-200 bg-white hover:border-gray-300",
        field.hidden && "opacity-50",
      )}
      style={{ gridColumn: `span ${span}` }}
    >
      {/* Drag handle */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-3.5 w-3.5 text-gray-300" />
      </div>

      {/* Field label + type badge */}
      <div className="flex items-center gap-1.5 pl-3">
        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="flex-1 truncate text-xs font-medium text-gray-700">
          {field.label || "(未命名)"}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
        <span className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-500">
          {def?.label ?? field.type}
        </span>
      </div>

      {/* Fake widget preview */}
      <div className="mt-1.5 pl-3">
        <FieldPreview field={field} />
      </div>

      {/* Action buttons (shown on hover/selected) */}
      <div
        className={cn(
          "absolute right-1 top-1 flex gap-0.5 transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/** Lightweight preview of the field's widget (design-time only) */
function FieldPreview({ field }: { field: DesignerField }) {
  const def = getFieldDef(field.type);
  if (!def) return null;

  // Layout fields
  if (field.type === "divider") {
    return <hr className="border-gray-200" />;
  }
  if (field.type === "heading") {
    return (
      <p className="text-xs font-medium text-gray-600">
        {field.text || field.label}
      </p>
    );
  }

  // Input-like fields
  if (
    ["input", "email", "phone", "url", "number", "currency", "percent"].includes(
      field.type,
    )
  ) {
    const prefix = field.type === "currency" ? "¥ " : "";
    const suffix = field.type === "percent" ? " %" : "";
    return (
      <div className="flex h-7 items-center rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
        {prefix}
        {field.placeholder || `请输入${field.label}`}
        {suffix}
      </div>
    );
  }

  if (field.type === "textarea" || field.type === "richtext") {
    return (
      <div className="h-12 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-400">
        {field.placeholder || `请输入${field.label}`}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="flex h-7 items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
        <span>{field.placeholder || "-- 请选择 --"}</span>
        <ChevronDown className="h-3 w-3" />
      </div>
    );
  }

  if (field.type === "radio" || field.type === "checkbox") {
    return (
      <div className="flex flex-wrap gap-2 pt-0.5">
        {(field.options ?? []).slice(0, 3).map((opt, i) => (
          <span
            key={i}
            className="flex items-center gap-1 text-xs text-gray-500"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-gray-300" />
            {opt.label}
          </span>
        ))}
      </div>
    );
  }

  if (field.type === "switch") {
    return (
      <div className="pt-0.5">
        <div className="inline-block h-4 w-7 rounded-full bg-gray-200" />
      </div>
    );
  }

  if (field.type === "datepicker" || field.type === "datetime") {
    return (
      <div className="flex h-7 items-center rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
        📅 选择日期{field.type === "datetime" ? "时间" : ""}
      </div>
    );
  }

  if (field.type === "rate") {
    return (
      <div className="pt-0.5 text-sm text-gray-300">★★★★★</div>
    );
  }

  if (field.type === "file" || field.type === "image") {
    return (
      <div className="flex h-10 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">
        {field.type === "image" ? "🖼️" : "📎"} 点击上传
      </div>
    );
  }

  if (field.type === "signature") {
    return (
      <div className="flex h-10 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">
        ✍️ 点击签名
      </div>
    );
  }

  if (field.type === "location") {
    return (
      <div className="flex h-7 items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
        <span>点击获取位置</span>
        <span>📍</span>
      </div>
    );
  }

  if (field.type === "color") {
    return (
      <div className="flex h-7 items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2">
        <div className="h-4 w-6 rounded border border-gray-200 bg-blue-500" />
        <span className="text-xs text-gray-400">#3B82F6</span>
      </div>
    );
  }

  if (field.type === "slider") {
    return (
      <div className="flex items-center gap-2 pt-1">
        <div className="h-1 flex-1 rounded-full bg-gray-200" />
        <span className="text-xs text-gray-400">50</span>
      </div>
    );
  }

  if (field.type === "reference") {
    return (
      <div className="flex h-7 items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
        <span>选择关联记录...</span>
        <span className="rounded border border-gray-200 px-1">选择</span>
      </div>
    );
  }

  // v1.0.2 Sprint 2 F1.3: lookup 字段占位预览
  if (field.type === "lookup") {
    const obj = ontologyObjects.find((o) => String(o.id) === field.boundObject);
    const displayField = field.boundProperty;
    if (!obj) {
      return (
        <div className="flex h-7 items-center justify-between rounded border border-amber-200 bg-amber-50 px-2 text-xs text-amber-700" data-testid="lookup-empty-preview">
          <span>请在右侧选择目标对象</span>
          <span className="rounded border border-amber-300 px-1">选择</span>
        </div>
      );
    }
    return (
      <div className="flex h-7 items-center justify-between rounded border border-blue-200 bg-blue-50 px-2 text-xs text-blue-700" data-testid="lookup-preview">
        <span>{obj.name}{displayField ? ` / ${displayField}` : " / (待选字段)"}</span>
        <span className="rounded border border-blue-300 px-1">{displayField ? "已配" : "待配"}</span>
      </div>
    );
  }

  if (field.type === "formula") {
    return (
      <div className="flex h-7 items-center rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
        自动计算
      </div>
    );
  }

  return (
    <div className="h-7 rounded border border-gray-200 bg-gray-50" />
  );
}

// ─── Designer Canvas (center panel) ────────────────────────

function DesignerCanvas({
  state,
  selectedFieldId,
  onSelectField,
  onUpdate,
  appId,
  ontologyObjects,
  boundProperties,
}: {
  state: DesignerState;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdate: (updater: (prev: DesignerState) => DesignerState, coalesceKey?: string) => void;
  appId?: string;
  ontologyObjects: AppServiceObject[];
  boundProperties: AppServiceObjectField[];
}) {
  const [dragData, setDragData] = useState<{
    sectionId: string;
    fieldId: string;
  } | null>(null);

  // ── Section operations ──

  const addSection = () => {
    onUpdate((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: `sec_${Date.now().toString(36)}`,
          title: `分区 ${prev.sections.length + 1}`,
          columns: 2,
          collapsed: false,
          fields: [],
        },
      ],
    }), COALESCE_KEYS.sectionAdd);
  };

  const deleteSection = (sectionId: string) => {
    onUpdate((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }), COALESCE_KEYS.sectionDelete(sectionId));
  };

  const updateSection = (
    sectionId: string,
    patch: Partial<DesignerSection>,
  ) => {
    onUpdate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s,
      ),
    }), COALESCE_KEYS.sectionProps(sectionId));
  };

  // ── Field operations ──

  const addField = (sectionId: string, type: string) => {
    const field = createField(type);
    onUpdate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: [...s.fields, field] }
          : s,
      ),
    }), COALESCE_KEYS.fieldAdd);
    onSelectField(field.id);
  };

  const addObjectField = (sectionId: string, objField: AppServiceObjectField) => {
    const type = mapObjectTypeToWidget(objField.type);
    const field = createField(type) as DesignerField;
    field.label = objField.name;
    field.fieldKey = objField.code;
    field.required = objField.required ?? false;
    field.boundObject = state.boundObjectId;
    field.boundProperty = objField.code;
    if (type === "select" && objField.type === "multiselect") {
      field.multiple = true;
    }
    onUpdate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: [...s.fields, field] }
          : s,
      ),
    }), COALESCE_KEYS.fieldAdd);
    onSelectField(field.id);
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    onUpdate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
          : s,
      ),
    }), COALESCE_KEYS.fieldDelete(fieldId));
    if (selectedFieldId === fieldId) onSelectField(null);
  };

  const duplicateField = (sectionId: string, fieldId: string) => {
    onUpdate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.fields.findIndex((f) => f.id === fieldId);
        if (idx === -1) return s;
        const orig = s.fields[idx];
        const copy: DesignerField = {
          ...orig,
          id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          label: `${orig.label} (副本)`,
        };
        const fields = [...s.fields];
        fields.splice(idx + 1, 0, copy);
        return { ...s, fields };
      }),
    }), COALESCE_KEYS.fieldDuplicate(fieldId));
  };

  const moveField = (
    sectionId: string,
    fieldId: string,
    direction: "up" | "down",
  ) => {
    onUpdate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.fields.findIndex((f) => f.id === fieldId);
        if (idx === -1) return s;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= s.fields.length) return s;
        const fields = [...s.fields];
        [fields[idx], fields[targetIdx]] = [fields[targetIdx], fields[idx]];
        return { ...s, fields };
      }),
    }), COALESCE_KEYS.fieldMove(fieldId));
  };

  // ── Drag and drop ──

  const handleFieldDragStart = (
    e: React.DragEvent,
    sectionId: string,
    fieldId: string,
  ) => {
    setDragData({ sectionId, fieldId });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFieldDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleFieldDrop = (
    e: React.DragEvent,
    targetSectionId: string,
    targetFieldId?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is a palette drag (new field type)
    const fieldType = e.dataTransfer.getData("field-type");
    if (fieldType) {
      addField(targetSectionId, fieldType);
      setDragData(null);
      return;
    }

    // Check if this is an object-field drag
    const objectFieldCode = e.dataTransfer.getData("object-field-code");
    if (objectFieldCode) {
      const objField = boundProperties.find((f) => f.code === objectFieldCode);
      if (objField) {
        addObjectField(targetSectionId, objField);
      }
      setDragData(null);
      return;
    }

    // Otherwise it's a field reorder
    if (!dragData) return;

    const { sectionId: srcSectionId, fieldId: srcFieldId } = dragData;

    onUpdate((prev) => {
      const newSections = prev.sections.map((s) => ({
        ...s,
        fields: [...s.fields],
      }));

      const srcSection = newSections.find((s) => s.id === srcSectionId);
      if (!srcSection) return prev;
      const srcIdx = srcSection.fields.findIndex((f) => f.id === srcFieldId);
      if (srcIdx === -1) return prev;
      const [moved] = srcSection.fields.splice(srcIdx, 1);

      const tgtSection = newSections.find((s) => s.id === targetSectionId);
      if (!tgtSection) return prev;

      if (targetFieldId) {
        const tgtIdx = tgtSection.fields.findIndex(
          (f) => f.id === targetFieldId,
        );
        tgtSection.fields.splice(tgtIdx, 0, moved);
      } else {
        tgtSection.fields.push(moved);
      }

      return { ...prev, sections: newSections };
    }, COALESCE_KEYS.fieldDrop);

    setDragData(null);
  };

  const handleSectionDrop = (
    e: React.DragEvent,
    sectionId: string,
  ) => {
    const fieldType = e.dataTransfer.getData("field-type");
    if (fieldType) {
      addField(sectionId, fieldType);
      return;
    }
    const objectFieldCode = e.dataTransfer.getData("object-field-code");
    if (objectFieldCode) {
      const objField = boundProperties.find((f) => f.code === objectFieldCode);
      if (objField) {
        addObjectField(sectionId, objField);
      }
    }
  };

  // ── Render ──

  return (
    <div
      className="flex-1 overflow-y-auto bg-gray-50"
      onClick={() => onSelectField(null)}
    >
      <div className="mx-auto max-w-4xl space-y-3 p-4">
        {/* Data model binding bar */}
        {appId && ontologyObjects.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
            <Database className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600">数据模型:</span>
            <Select
              value={state.boundObjectId ?? ""}
              onValueChange={(v) =>
                onUpdate((prev) => ({
                  ...prev,
                  boundObjectId: v || undefined,
                }), COALESCE_KEYS.bindingObject)
              }
            >
              <SelectTrigger className="h-7 w-[200px] text-xs">
                <SelectValue placeholder="选择关联数据对象" />
              </SelectTrigger>
              <SelectContent>
                {ontologyObjects.map((obj) => (
                  <SelectItem key={obj.id} value={String(obj.id)}>
                    {obj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.boundObjectId && (
              <span className="text-xs text-green-600">
                ✓ 已绑定 {ontologyObjects.find((o) => String(o.id) === state.boundObjectId)?.name}
              </span>
            )}
          </div>
        )}

        {/* Sections */}
        {state.sections.map((section) => (
          <div
            key={section.id}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <SectionHeader
              section={section}
              onToggleCollapse={() =>
                updateSection(section.id, {
                  collapsed: !section.collapsed,
                })
              }
              onTitleChange={(title) =>
                updateSection(section.id, { title })
              }
              onColumnsChange={(columns) =>
                updateSection(section.id, { columns })
              }
              onDelete={() => deleteSection(section.id)}
              onAddField={() => addField(section.id, "input")}
            />

            {!section.collapsed && (
              <div
                className="min-h-[60px] p-3"
                onDragOver={handleFieldDragOver}
                onDrop={(e) => handleSectionDrop(e, section.id)}
              >
                {section.fields.length === 0 ? (
                  <div
                    className="flex h-16 items-center justify-center rounded-md border-2 border-dashed border-gray-200 text-xs text-gray-400"
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleFieldDrop(e, section.id);
                    }}
                  >
                    拖拽左侧组件到此处，或点击上方"字段"按钮添加
                  </div>
                ) : (
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: "repeat(12, 1fr)" }}
                  >
                    {section.fields.map((field) => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        selected={selectedFieldId === field.id}
                        onSelect={() => onSelectField(field.id)}
                        onDelete={() =>
                          deleteField(section.id, field.id)
                        }
                        onDuplicate={() =>
                          duplicateField(section.id, field.id)
                        }
                        onMoveUp={() =>
                          moveField(section.id, field.id, "up")
                        }
                        onMoveDown={() =>
                          moveField(section.id, field.id, "down")
                        }
                        onDragStart={(e) =>
                          handleFieldDragStart(
                            e,
                            section.id,
                            field.id,
                          )
                        }
                        onDragOver={handleFieldDragOver}
                        onDrop={(e) =>
                          handleFieldDrop(e, section.id, field.id)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add section button */}
        <button
          onClick={addSection}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 transition-colors hover:border-blue-300 hover:bg-blue-50/30 hover:text-blue-500"
        >
          <Plus className="h-4 w-4" /> 添加分区
        </button>
      </div>
    </div>
  );
}

// ─── Main Editor Component ─────────────────────────────────

export interface EnhancedFormEditorProps extends FormEditorProps {
  appId?: string;
  pageName?: string;
  device?: "desktop" | "tablet" | "mobile";
}

export function FormLowCodeEditor({
  components,
  setComponents,
  setDirty,
  selectedCompId,
  setSelectedCompId,
  appId,
  pageName,
  device,
}: EnhancedFormEditorProps) {
  const [mode, setMode] = useState<"design" | "preview" | "iframe" | "json">("design");
  const initialState = useMemo<DesignerState>(() => {
    const existing = componentsToState(components, pageName ?? "未命名表单");
    return existing ?? createEmptyState(pageName ?? "未命名表单");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在初次挂载时计算初始 state
  // AC-201.6: 用 history 包裹 state, commit() 自动入栈
  const history = useUndoRedo<DesignerState>(initialState, {
    capacity: 20, // AC-201.6 要求 ≥5
    mergeWindowMs: 600,
  });
  const state = history.state;

  const [ontologyObjects, setOntologyObjects] = useState<AppServiceObject[]>([]);
  const [boundProperties, setBoundProperties] = useState<AppServiceObjectField[]>([]);
  const [appSlug, setAppSlug] = useState<string | null>(null);
  const resolvedAppId = appSlug ?? appId;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync external components → internal state (only on first load or external reset)
  const lastSyncedRef = useRef<string>("");
  useEffect(() => {
    const tag = components
      ?.find((c) => c.type === DESIGNER_SENTINEL)
      ?.id;
    if (tag && tag !== lastSyncedRef.current) {
      lastSyncedRef.current = tag;
      const restored = componentsToState(
        components,
        pageName ?? "未命名表单",
      );
      if (restored) history.reset(restored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, pageName]);

  // Sync internal state → external components (when state changes, push to parent)
  useEffect(() => {
    setComponents(stateToComponents(state));
    setDirty(true);
  }, [state, setComponents, setDirty]);

  const handleUpdate = useCallback(
    (updater: (prev: DesignerState) => DesignerState, coalesceKey?: string) => {
      const prev = stateRef.current;
      const next = updater(prev);
      history.commit(next, coalesceKey);
    },
    [history],
  );

  // AC-201.6 键盘快捷键: Ctrl/Cmd+Z 撤销, Ctrl/Cmd+Shift+Z 重做
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // 焦点在文本输入控件时不拦截, 让原生 undo 继续生效
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history.redo();
      } else if (!e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history.undo();
      } else if (!e.shiftKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [history]);

  // 解析 Node 应用 UUID → Java app-service 所需的 slug
  useEffect(() => {
    if (!appId) return;
    appsApi
      .get(appId)
      .then((a) => setAppSlug(a.app_slug || appId))
      .catch(() => setAppSlug(appId));
  }, [appId]);

  // Load app objects for data binding (Java backend)
  useEffect(() => {
    if (!resolvedAppId) return;
    appServiceApi
      .listObjects(resolvedAppId)
      .then((objs) => setOntologyObjects(objs))
      .catch(() => {});
  }, [resolvedAppId]);

  // Load object fields when bound object changes
  useEffect(() => {
    if (!state.boundObjectId) {
      setBoundProperties([]);
      return;
    }
    const obj = ontologyObjects.find((o) => String(o.id) === state.boundObjectId);
    if (!obj || !obj.schemaJson) {
      setBoundProperties([]);
      return;
    }
    try {
      const fields = JSON.parse(obj.schemaJson) as AppServiceObjectField[];
      setBoundProperties(Array.isArray(fields) ? fields : []);
    } catch {
      setBoundProperties([]);
    }
  }, [state.boundObjectId, ontologyObjects]);

  // ── Selected field lookup ──

  const selectedField = useMemo(() => {
    if (!selectedCompId) return null;
    for (const sec of state.sections) {
      const found = sec.fields.find((f) => f.id === selectedCompId);
      if (found) return found;
    }
    return null;
  }, [selectedCompId, state]);

  const selectedFieldSectionId = useMemo(() => {
    if (!selectedCompId) return null;
    for (const sec of state.sections) {
      if (sec.fields.some((f) => f.id === selectedCompId)) return sec.id;
    }
    return null;
  }, [selectedCompId, state]);

  const handleFieldChange = useCallback(
    (patch: Partial<DesignerField>) => {
      if (!selectedFieldSectionId || !selectedCompId) return;
      handleUpdate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === selectedFieldSectionId
            ? {
                ...s,
                fields: s.fields.map((f) =>
                  f.id === selectedCompId ? { ...f, ...patch } : f,
                ),
              }
            : s,
        ),
      }), COALESCE_KEYS.fieldProps(selectedCompId));
    },
    [selectedFieldSectionId, selectedCompId, handleUpdate],
  );

  const handleFieldDelete = useCallback(() => {
    if (!selectedFieldSectionId || !selectedCompId) return;
    handleUpdate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === selectedFieldSectionId
          ? { ...s, fields: s.fields.filter((f) => f.id !== selectedCompId) }
          : s,
      ),
    }), COALESCE_KEYS.fieldDelete(selectedCompId));
    setSelectedCompId(null);
  }, [selectedFieldSectionId, selectedCompId, handleUpdate, setSelectedCompId]);

  // ── Render ──

  const ontologyObjectsForPanel = useMemo(
    () =>
      ontologyObjects.map((o) => ({
        id: String(o.id),
        label: o.name,
      })),
    [ontologyObjects],
  );

  // v1.0.2 Sprint 2 F1.3: 当选中字段是 lookup 时, 按 field.boundObject 加载目标对象的字段列表
  // 用于在 FieldPropertyPanel 的 "关联属性" Select 中显示
  const [lookupTargetFields, setLookupTargetFields] = useState<AppServiceObjectField[]>([]);
  useEffect(() => {
    if (!selectedField || selectedField.type !== "lookup" || !selectedField.boundObject) {
      setLookupTargetFields([]);
      return;
    }
    const obj = ontologyObjects.find((o) => String(o.id) === selectedField.boundObject);
    if (!obj) {
      setLookupTargetFields([]);
      return;
    }
    if (obj.schemaJson) {
      try {
        const fields = JSON.parse(obj.schemaJson) as AppServiceObjectField[];
        setLookupTargetFields(Array.isArray(fields) ? fields : []);
        return;
      } catch {
        setLookupTargetFields([]);
        return;
      }
    }
    // 无 schemaJson 时调用 listFields API
    if (resolvedAppId) {
      appServiceApi
        .listFields(resolvedAppId, Number(obj.id))
        .then((fields) => setLookupTargetFields(Array.isArray(fields) ? fields : []))
        .catch(() => setLookupTargetFields([]));
    }
  }, [selectedField, ontologyObjects, resolvedAppId]);

  // 决定 FieldPropertyPanel 用哪个 fields 列表
  const propertiesForPanel: AppServiceObjectField[] = useMemo(() => {
    if (selectedField?.type === "lookup") return lookupTargetFields;
    return boundProperties;
  }, [selectedField, lookupTargetFields, boundProperties]);

  return (
    <div className="flex h-full overflow-hidden bg-white">
      {/* Left: Palette (design mode only) */}
      {mode === "design" && (
        <div className="w-56 shrink-0 border-r bg-white">
          <FieldPalette
            onAddField={(type) => {
              // Add to the first section (or create one)
              const targetSection =
                state.sections[0]?.id ?? null;
              if (targetSection) {
                const field = createField(type);
                handleUpdate((prev) => ({
                  ...prev,
                  sections: prev.sections.map((s) =>
                    s.id === targetSection
                      ? { ...s, fields: [...s.fields, field] }
                      : s,
                  ),
                }), COALESCE_KEYS.fieldAdd);
                setSelectedCompId(field.id);
              }
            }}
            objectFields={boundProperties}
            onAddObjectField={(objField) => {
              const targetSection = state.sections[0]?.id ?? null;
              if (!targetSection) return;
              const type = mapObjectTypeToWidget(objField.type);
              const field = createField(type) as DesignerField;
              field.label = objField.name;
              field.fieldKey = objField.code;
              field.required = objField.required ?? false;
              field.boundObject = state.boundObjectId;
              field.boundProperty = objField.code;
              if (type === "select" && objField.type === "multiselect") {
                field.multiple = true;
              }
              handleUpdate((prev) => ({
                ...prev,
                sections: prev.sections.map((s) =>
                  s.id === targetSection
                    ? { ...s, fields: [...s.fields, field] }
                    : s,
                ),
              }), COALESCE_KEYS.fieldAdd);
              setSelectedCompId(field.id);
            }}
          />
        </div>
      )}

      {/* Center: Canvas or Preview or JSON */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mode switcher */}
        <div className="flex items-center gap-1 border-b bg-gray-50/50 px-3 py-1.5">
          {/* AC-201.6 撤销/重做按钮 (放在最左侧, 工具显眼位置) */}
          <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="撤销 (Ctrl+Z)"
              data-testid="undo-button"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="text-xs">{history.canUndo ? `撤销 (${history.pastDepth})` : "撤销"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="重做 (Ctrl+Shift+Z)"
              data-testid="redo-button"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="text-xs">{history.canRedo ? `重做 (${history.futureDepth})` : "重做"}</span>
            </Button>
          </div>
          <button
            onClick={() => setMode("design")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "design"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Layers className="h-3.5 w-3.5" /> 设计
          </button>
          <button
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "preview"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Eye className="h-3.5 w-3.5" /> 预览
          </button>
          {/* AC-201.7: 在 iframe 内预览渲染效果, 与父页面样式完全隔离 */}
          <button
            onClick={() => setMode("iframe")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "iframe"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
            data-testid="iframe-preview-button"
            title="在隔离的 iframe 环境中预览表单 (AC-201.7)"
          >
            <Frame className="h-3.5 w-3.5" /> iframe 预览
          </button>
          <button
            onClick={() => setMode("json")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "json"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Code2 className="h-3.5 w-3.5" /> JSON
          </button>
        </div>

        {mode === "design" && (
          <DesignerCanvas
            state={state}
            selectedFieldId={selectedCompId}
            onSelectField={setSelectedCompId}
            onUpdate={handleUpdate}
            appId={resolvedAppId}
            ontologyObjects={ontologyObjects}
            boundProperties={boundProperties}
          />
        )}

        {mode === "preview" && <SchemaPreview state={state} />}

        {mode === "iframe" && (
          <IframePreview
            state={state}
            deviceWidth={(device ?? "desktop") === "mobile" ? 390 : (device ?? "desktop") === "tablet" ? 768 : 1024}
            deviceHeight={(device ?? "desktop") === "mobile" ? 720 : (device ?? "desktop") === "tablet" ? 900 : 720}
          />
        )}

        {mode === "json" && (
          <div className="flex-1 overflow-auto p-4">
            <pre className="rounded-lg bg-gray-900 p-4 text-xs text-green-400">
              {stateToJson(state)}
            </pre>
          </div>
        )}
      </div>

      {/* Right: Properties (design mode only) */}
      {mode === "design" && (
        <div className="w-72 shrink-0 border-l bg-white">
          <FieldPropertyPanel
            field={selectedField}
            onChange={handleFieldChange}
            onDelete={handleFieldDelete}
            ontologyObjects={ontologyObjectsForPanel}
            boundProperties={propertiesForPanel}
          />
        </div>
      )}
    </div>
  );
}

export default FormLowCodeEditor;
