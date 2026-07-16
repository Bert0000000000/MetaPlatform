import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPageConfig, updatePageConfig, createPageConfig } from "../api/pageApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* -- Types -- */

interface DesignerField {
  fieldCode: string;
  label: string;
  widgetType: string;
  required: boolean;
  readonly: boolean;
  colSpan: number;
  placeholder: string;
}

interface DesignerTableCol {
  fieldCode: string;
  title: string;
  type: string;
  sortable: boolean;
  width: number;
}

interface DesignerSection {
  title: string;
  sectionType: "TABLE" | "FIELD_GROUP";
  columns: number;
  fields: DesignerField[];
  table?: {
    columns: DesignerTableCol[];
    pagination: boolean;
    pageSize: number;
    sortable: boolean;
    filterable: boolean;
  };
}

interface DesignerState {
  pageConfig: {
    id?: number | string;
    name: string;
    code: string;
    pageType: string;
    objectCode: string;
    sections: DesignerSection[];
  };
  selectedSectionIdx: number | null;
  selectedFieldIdx: number | null;
  dragOverSectionIdx: number | null;
  dragOverFieldIdx: number | null;
  dragSource: { type: "palette" | "field"; widgetType?: string; sectionIdx?: number; fieldIdx?: number } | null;
}

/* -- Constants -- */

interface WidgetDef {
  type: string;
  label: string;
  icon: string;
}

const WIDGET_LIST: WidgetDef[] = [
  { type: "input",      label: "单行输入", icon: "Aa" },
  { type: "textarea",   label: "多行文本", icon: "¶" },
  { type: "number",     label: "数字",     icon: "#" },
  { type: "select",     label: "下拉选择", icon: "▼" },
  { type: "datepicker", label: "日期",     icon: "Cal" },
  { type: "switch",     label: "开关",     icon: "⊘" },
  { type: "email",      label: "邮箱",     icon: "@" },
  { type: "phone",      label: "电话",     icon: "☎" },
  { type: "rich_text",  label: "富文本",   icon: "B" },
  { type: "currency",   label: "货币",     icon: "¥" },
  { type: "percentage", label: "百分比",   icon: "%" },
  { type: "rate",       label: "评分",     icon: "★" },
];

const WIDGET_LABEL_MAP: Record<string, string> = Object.fromEntries(
  WIDGET_LIST.map((w) => [w.type, w.label]),
);

const WIDGET_ICON_MAP: Record<string, string> = Object.fromEntries(
  WIDGET_LIST.map((w) => [w.type, w.icon]),
);

function defaultField(widgetType: string): DesignerField {
  return {
    fieldCode: `field_${Date.now().toString(36)}`,
    label: WIDGET_LABEL_MAP[widgetType] ?? widgetType,
    widgetType,
    required: false,
    readonly: false,
    colSpan: 1,
    placeholder: "",
  };
}

function defaultTableCol(): DesignerTableCol {
  return {
    fieldCode: `col_${Date.now().toString(36)}`,
    title: "新列",
    type: "text",
    sortable: true,
    width: 150,
  };
}

function makeDefaultSections(): DesignerSection[] {
  return [
    {
      title: "基本信息",
      sectionType: "FIELD_GROUP",
      columns: 2,
      fields: [
        { fieldCode: "name", label: "名称", widgetType: "input", required: true, readonly: false, colSpan: 1, placeholder: "请输入名称" },
        { fieldCode: "code", label: "编码", widgetType: "input", required: true, readonly: false, colSpan: 1, placeholder: "请输入编码" },
        { fieldCode: "description", label: "描述", widgetType: "textarea", required: false, readonly: false, colSpan: 2, placeholder: "请输入描述" },
      ],
    },
    {
      title: "数据列表",
      sectionType: "TABLE",
      columns: 1,
      fields: [],
      table: {
        columns: [
          { fieldCode: "id", title: "ID", type: "text", sortable: true, width: 80 },
          { fieldCode: "name", title: "名称", type: "text", sortable: true, width: 200 },
          { fieldCode: "status", title: "状态", type: "text", sortable: true, width: 100 },
          { fieldCode: "createdAt", title: "创建时间", type: "date", sortable: true, width: 180 },
        ],
        pagination: true,
        pageSize: 20,
        sortable: true,
        filterable: true,
      },
    },
  ];
}

/* -- Component -- */

const PageDesigner: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [state, setState] = useState<DesignerState>({
    pageConfig: {
      name: "",
      code: "",
      pageType: "FORM",
      objectCode: "",
      sections: makeDefaultSections(),
    },
    selectedSectionIdx: null,
    selectedFieldIdx: null,
    dragOverSectionIdx: null,
    dragOverFieldIdx: null,
    dragSource: null,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* Load config */
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPageConfig(id)
      .then((cfg) => {
        const rawSections = (cfg as unknown as Record<string, unknown>).sections as Record<string, unknown>[] | undefined;
        const sections: DesignerSection[] = Array.isArray(rawSections)
          ? rawSections.map((s: Record<string, unknown>) => {
              const st = (s.sectionType as string) ?? (s.type as string) ?? "FIELD_GROUP";
              const isTable = st === "TABLE";
              return {
                title: (s.title as string) ?? "",
                sectionType: isTable ? "TABLE" : "FIELD_GROUP",
                columns: (s.columns as number) ?? (isTable ? 1 : 2),
                fields: Array.isArray(s.fields)
                  ? (s.fields as Record<string, unknown>[]).map((f: Record<string, unknown>) => ({
                      fieldCode: (f.fieldCode as string) ?? (f.field as string) ?? "",
                      label: (f.label as string) ?? "",
                      widgetType: (f.widgetType as string) ?? (f.widget as string) ?? "input",
                      required: Boolean(f.required),
                      readonly: Boolean(f.readonly) || Boolean(f.editable) === false,
                      colSpan: (f.colSpan as number) ?? 1,
                      placeholder: (f.placeholder as string) ?? "",
                    }))
                  : [],
                table: isTable
                  ? {
                      columns: Array.isArray((s.table as Record<string, unknown>)?.columns)
                        ? ((s.table as Record<string, unknown>).columns as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({
                            fieldCode: (c.fieldCode as string) ?? (c.field as string) ?? "",
                            title: (c.title as string) ?? "",
                            type: (c.type as string) ?? "text",
                            sortable: Boolean(c.sortable),
                            width: (c.width as number) ?? 150,
                          }))
                        : [],
                      pagination: Boolean((s.table as Record<string, unknown>)?.pagination) !== false,
                      pageSize: ((s.table as Record<string, unknown>)?.pageSize as number) ?? 20,
                      sortable: Boolean((s.table as Record<string, unknown>)?.sortable) !== false,
                      filterable: Boolean((s.table as Record<string, unknown>)?.filterable),
                    }
                  : undefined,
              };
            })
          : makeDefaultSections();

        setState((prev) => ({
          ...prev,
          pageConfig: {
            id: cfg.id,
            name: cfg.name ?? cfg.displayName ?? "",
            code: (cfg as unknown as Record<string, unknown>).code as string ?? "",
            pageType: cfg.pageType ?? "FORM",
            objectCode: cfg.objectCode ?? "",
            sections,
          },
        }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  /* Toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  /* -- Helpers -- */
  const patch = useCallback((partial: Partial<DesignerState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchPage = useCallback((partial: Partial<DesignerState["pageConfig"]>) => {
    setState((prev) => ({ ...prev, pageConfig: { ...prev.pageConfig, ...partial } }));
  }, []);

  const patchSection = useCallback((idx: number, partial: Partial<DesignerSection>) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      sections[idx] = { ...sections[idx], ...partial };
      return { ...prev, pageConfig: { ...prev.pageConfig, sections } };
    });
  }, []);

  const patchField = useCallback((secIdx: number, fieldIdx: number, partial: Partial<DesignerField>) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      const fields = [...sections[secIdx].fields];
      fields[fieldIdx] = { ...fields[fieldIdx], ...partial };
      sections[secIdx] = { ...sections[secIdx], fields };
      return { ...prev, pageConfig: { ...prev.pageConfig, sections } };
    });
  }, []);

  const patchTableCol = useCallback((secIdx: number, colIdx: number, partial: Partial<DesignerTableCol>) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      const table = { ...sections[secIdx].table! };
      const columns = [...table.columns];
      columns[colIdx] = { ...columns[colIdx], ...partial };
      table.columns = columns;
      sections[secIdx] = { ...sections[secIdx], table };
      return { ...prev, pageConfig: { ...prev.pageConfig, sections } };
    });
  }, []);

  /* -- Add/Remove Section -- */
  const addSection = useCallback((sectionType: "TABLE" | "FIELD_GROUP") => {
    setState((prev) => {
      const newSection: DesignerSection =
        sectionType === "TABLE"
          ? {
              title: "新表格区域",
              sectionType: "TABLE",
              columns: 1,
              fields: [],
              table: { columns: [defaultTableCol()], pagination: true, pageSize: 20, sortable: true, filterable: true },
            }
          : { title: "新表单区域", sectionType: "FIELD_GROUP", columns: 2, fields: [] };
      return { ...prev, pageConfig: { ...prev.pageConfig, sections: [...prev.pageConfig.sections, newSection] } };
    });
  }, []);

  const removeSection = useCallback((idx: number) => {
    setState((prev) => {
      const sections = prev.pageConfig.sections.filter((_, i) => i !== idx);
      return {
        ...prev,
        pageConfig: { ...prev.pageConfig, sections },
        selectedSectionIdx: prev.selectedSectionIdx === idx ? null : prev.selectedSectionIdx,
        selectedFieldIdx: null,
      };
    });
  }, []);

  const moveSection = useCallback((idx: number, dir: -1 | 1) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      const target = idx + dir;
      if (target < 0 || target >= sections.length) return prev;
      [sections[idx], sections[target]] = [sections[target], sections[idx]];
      return { ...prev, pageConfig: { ...prev.pageConfig, sections }, selectedSectionIdx: target };
    });
  }, []);

  /* -- Field Operations -- */
  const addField = useCallback((secIdx: number, widgetType: string) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      const section = sections[secIdx];
      if (section.sectionType === "TABLE") {
        const table = { ...section.table!, columns: [...section.table!.columns, { ...defaultTableCol(), title: WIDGET_LABEL_MAP[widgetType] ?? widgetType }] };
        sections[secIdx] = { ...section, table };
      } else {
        sections[secIdx] = { ...section, fields: [...section.fields, defaultField(widgetType)] };
      }
      return { ...prev, pageConfig: { ...prev.pageConfig, sections } };
    });
  }, []);

  const removeField = useCallback((secIdx: number, fieldIdx: number) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      if (sections[secIdx].sectionType === "TABLE") {
        const table = { ...sections[secIdx].table!, columns: sections[secIdx].table!.columns.filter((_, i) => i !== fieldIdx) };
        sections[secIdx] = { ...sections[secIdx], table };
      } else {
        sections[secIdx] = { ...sections[secIdx], fields: sections[secIdx].fields.filter((_, i) => i !== fieldIdx) };
      }
      return {
        ...prev,
        pageConfig: { ...prev.pageConfig, sections },
        selectedFieldIdx: prev.selectedFieldIdx === fieldIdx ? null : prev.selectedFieldIdx,
      };
    });
  }, []);

  const moveField = useCallback((secIdx: number, fieldIdx: number, dir: -1 | 1) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      const section = sections[secIdx];
      if (section.sectionType === "TABLE") {
        const cols = [...section.table!.columns];
        const target = fieldIdx + dir;
        if (target < 0 || target >= cols.length) return prev;
        [cols[fieldIdx], cols[target]] = [cols[target], cols[fieldIdx]];
        const table = { ...section.table!, columns: cols };
        sections[secIdx] = { ...section, table };
      } else {
        const fields = [...section.fields];
        const target = fieldIdx + dir;
        if (target < 0 || target >= fields.length) return prev;
        [fields[fieldIdx], fields[target]] = [fields[target], fields[fieldIdx]];
        sections[secIdx] = { ...section, fields };
      }
      return { ...prev, pageConfig: { ...prev.pageConfig, sections }, selectedFieldIdx: fieldIdx + dir };
    });
  }, []);

  /* -- Drag handlers -- */
  const onDragStartPalette = useCallback((e: React.DragEvent, widgetType: string) => {
    e.dataTransfer.setData("application/x-widget-type", widgetType);
    e.dataTransfer.effectAllowed = "copy";
    patch({ dragSource: { type: "palette", widgetType } });
  }, [patch]);

  const onDragStartField = useCallback((e: React.DragEvent, secIdx: number, fieldIdx: number) => {
    e.dataTransfer.setData("application/x-field-move", `${secIdx}:${fieldIdx}`);
    e.dataTransfer.effectAllowed = "move";
    patch({ dragSource: { type: "field", sectionIdx: secIdx, fieldIdx } });
  }, [patch]);

  const onDragOverSection = useCallback((e: React.DragEvent, secIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = state.dragSource?.type === "palette" ? "copy" : "move";
    patch({ dragOverSectionIdx: secIdx });
  }, [patch, state.dragSource]);

  const onDragOverField = useCallback((e: React.DragEvent, secIdx: number, fieldIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    patch({ dragOverSectionIdx: secIdx, dragOverFieldIdx: fieldIdx });
  }, [patch]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    patch({ dragOverSectionIdx: null, dragOverFieldIdx: null });
  }, [patch]);

  const onDropSection = useCallback((e: React.DragEvent, secIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    const widgetType = e.dataTransfer.getData("application/x-widget-type");
    if (widgetType) {
      addField(secIdx, widgetType);
    }

    const moveData = e.dataTransfer.getData("application/x-field-move");
    if (moveData) {
      const [srcSec, srcField] = moveData.split(":").map(Number);
      setState((prev) => {
        const sections = [...prev.pageConfig.sections];
        const srcSection = sections[srcSec];
        const tgtSection = sections[secIdx];

        if (srcSection.sectionType === "FIELD_GROUP" && tgtSection.sectionType === "FIELD_GROUP") {
          const srcFields = [...srcSection.fields];
          const [moved] = srcFields.splice(srcField, 1);
          const tgtFields = [...tgtSection.fields];
          const dropIdx = prev.dragOverFieldIdx ?? tgtFields.length;
          tgtFields.splice(dropIdx, 0, moved);
          sections[srcSec] = { ...srcSection, fields: srcFields };
          sections[secIdx] = { ...tgtSection, fields: tgtFields };
        }
        return { ...prev, pageConfig: { ...prev.pageConfig, sections }, dragOverSectionIdx: null, dragOverFieldIdx: null, dragSource: null };
      });
      return;
    }

    patch({ dragOverSectionIdx: null, dragOverFieldIdx: null, dragSource: null });
  }, [addField, patch]);

  const onDropField = useCallback((e: React.DragEvent, secIdx: number, fieldIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    const widgetType = e.dataTransfer.getData("application/x-widget-type");
    if (widgetType) {
      setState((prev) => {
        const sections = [...prev.pageConfig.sections];
        const section = sections[secIdx];
        if (section.sectionType === "FIELD_GROUP") {
          const fields = [...section.fields];
          fields.splice(fieldIdx, 0, defaultField(widgetType));
          sections[secIdx] = { ...section, fields };
        }
        return { ...prev, pageConfig: { ...prev.pageConfig, sections }, dragOverSectionIdx: null, dragOverFieldIdx: null, dragSource: null };
      });
      return;
    }

    const moveData = e.dataTransfer.getData("application/x-field-move");
    if (moveData) {
      const [srcSec, srcField] = moveData.split(":").map(Number);
      setState((prev) => {
        const sections = [...prev.pageConfig.sections];
        const srcSection = sections[srcSec];
        const tgtSection = sections[secIdx];
        if (srcSection.sectionType === "FIELD_GROUP" && tgtSection.sectionType === "FIELD_GROUP") {
          const srcFields = [...srcSection.fields];
          const [moved] = srcFields.splice(srcField, 1);
          const tgtFields = [...tgtSection.fields];
          let insertIdx = fieldIdx;
          if (srcSec === secIdx && srcField < fieldIdx) insertIdx = fieldIdx - 1;
          tgtFields.splice(insertIdx, 0, moved);
          sections[srcSec] = { ...srcSection, fields: srcFields };
          sections[secIdx] = { ...tgtSection, fields: tgtFields };
        }
        return { ...prev, pageConfig: { ...prev.pageConfig, sections }, dragOverSectionIdx: null, dragOverFieldIdx: null, dragSource: null };
      });
      return;
    }

    patch({ dragOverSectionIdx: null, dragOverFieldIdx: null, dragSource: null });
  }, [patch]);

  const onDragEnd = useCallback(() => {
    patch({ dragOverSectionIdx: null, dragOverFieldIdx: null, dragSource: null });
  }, [patch]);

  /* -- Save -- */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: state.pageConfig.name,
        code: state.pageConfig.code,
        pageType: state.pageConfig.pageType,
        objectCode: state.pageConfig.objectCode,
        sections: state.pageConfig.sections,
      };
      if (isEditMode && id) {
        await updatePageConfig(id, payload);
        setToast("保存成功");
      } else {
        const result = await createPageConfig(payload);
        setToast("创建成功");
        if (result?.id) {
          navigate(`/designer/${result.id}`, { replace: true });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [state.pageConfig, isEditMode, id, navigate]);

  /* -- Preview -- */
  const handlePreview = useCallback(() => {
    const pid = state.pageConfig.id ?? id;
    if (pid) navigate(`/pages/${pid}`);
  }, [state.pageConfig.id, id, navigate]);

  /* -- Selected field -- */
  const selectedField = useMemo((): DesignerField | DesignerTableCol | null => {
    if (state.selectedSectionIdx === null || state.selectedFieldIdx === null) return null;
    const section = state.pageConfig.sections[state.selectedSectionIdx];
    if (!section) return null;
    if (section.sectionType === "TABLE") {
      return section.table?.columns[state.selectedFieldIdx] ?? null;
    }
    return section.fields[state.selectedFieldIdx] ?? null;
  }, [state.selectedSectionIdx, state.selectedFieldIdx, state.pageConfig.sections]);

  const selectedSection = useMemo((): DesignerSection | null => {
    if (state.selectedSectionIdx === null) return null;
    return state.pageConfig.sections[state.selectedSectionIdx] ?? null;
  }, [state.selectedSectionIdx, state.pageConfig.sections]);

  const selectedIsTableCol = selectedSection?.sectionType === "TABLE";

  /* -- Render -- */

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground p-10">正在加载页面配置...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            {"<-"} 返回
          </Button>
          <span className="text-sm font-medium">
            {isEditMode ? "编辑页面设计器" : "新建页面设计器"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-40"
            placeholder="页面名称"
            value={state.pageConfig.name}
            onChange={(e) => patchPage({ name: e.target.value })}
          />
          <Input
            className="h-8 w-28"
            placeholder="页面编码"
            value={state.pageConfig.code}
            onChange={(e) => patchPage({ code: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addSection("FIELD_GROUP")}>
            + 表单区域
          </Button>
          <Button variant="outline" size="sm" onClick={() => addSection("TABLE")}>
            + 表格区域
          </Button>
          {isEditMode && (
            <Button variant="outline" size="sm" onClick={handlePreview}>
              预览
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Three-column body */}
      <div className="flex flex-1 overflow-hidden" onDragEnd={onDragEnd}>
        {/* Left: Palette */}
        <aside className="w-48 border-r bg-muted/30 flex flex-col shrink-0">
          <div className="px-3 py-2 text-sm font-medium text-muted-foreground">组件列表</div>
          <div className="px-3 pb-1 text-xs text-muted-foreground">拖拽组件到画布区域</div>
          <Separator />
          <div className="flex-1 overflow-auto p-2 flex flex-col gap-1">
            {WIDGET_LIST.map((w) => (
              <div
                key={w.type}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md cursor-grab text-sm transition-colors hover:bg-accent",
                  state.dragSource?.type === "palette" && state.dragSource.widgetType === w.type && "bg-accent ring-1 ring-ring"
                )}
                draggable="true"
                onDragStart={(e) => onDragStartPalette(e, w.type)}
              >
                <span className="w-5 text-center text-muted-foreground">{w.icon}</span>
                <span>{w.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-muted/10">
          {state.pageConfig.sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="text-4xl mb-3">[ ]</div>
              <p>暂无区域，点击上方按钮添加"表单区域"或"表格区域"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {state.pageConfig.sections.map((section, secIdx) => {
                const isDropTarget = state.dragOverSectionIdx === secIdx;
                const isSelected = state.selectedSectionIdx === secIdx;
                return (
                  <Card
                    key={secIdx}
                    className={cn(
                      "transition-shadow",
                      isSelected && "ring-2 ring-primary",
                      isDropTarget && "ring-2 ring-primary/50 bg-primary/5"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      patch({ selectedSectionIdx: secIdx, selectedFieldIdx: null });
                    }}
                    onDragOver={(e) => onDragOverSection(e, secIdx)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDropSection(e, secIdx)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={section.sectionType === "TABLE" ? "secondary" : "default"}>
                          {section.sectionType === "TABLE" ? "表格" : "表单"}
                        </Badge>
                        <span className="font-medium">{section.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="上移"
                          onClick={(e) => { e.stopPropagation(); moveSection(secIdx, -1); }}
                          disabled={secIdx === 0}
                        >
                          ^
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="下移"
                          onClick={(e) => { e.stopPropagation(); moveSection(secIdx, 1); }}
                          disabled={secIdx === state.pageConfig.sections.length - 1}
                        >
                          v
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="删除区域"
                          onClick={(e) => { e.stopPropagation(); removeSection(secIdx); }}
                        >
                          X
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {section.sectionType === "TABLE" ? (
                        <div className="flex flex-wrap gap-2">
                          {section.table?.columns.map((col, colIdx) => {
                            const isFieldSelected = isSelected && state.selectedFieldIdx === colIdx;
                            return (
                              <div
                                key={colIdx}
                                className={cn(
                                  "border rounded-md px-3 py-2 cursor-pointer text-sm bg-background transition-colors",
                                  isFieldSelected && "ring-2 ring-primary border-primary"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  patch({ selectedSectionIdx: secIdx, selectedFieldIdx: colIdx });
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{col.title}</span>
                                  <Badge variant="outline" className="text-xs">{col.type}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 font-mono">{col.fieldCode}</div>
                                <div className="flex gap-1 mt-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); moveField(secIdx, colIdx, -1); }} disabled={colIdx === 0}>^</Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); moveField(secIdx, colIdx, 1); }} disabled={colIdx === (section.table?.columns.length ?? 0) - 1}>v</Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeField(secIdx, colIdx); }}>X</Button>
                                </div>
                              </div>
                            );
                          })}
                          {(!section.table?.columns || section.table.columns.length === 0) && (
                            <div className="text-sm text-muted-foreground py-4 w-full text-center">
                              拖拽组件到此处添加列，或点击右侧面板添加
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="grid gap-2"
                          style={{ gridTemplateColumns: `repeat(${section.columns}, 1fr)` }}
                        >
                          {section.fields.map((field, fieldIdx) => {
                            const isFieldSelected = isSelected && state.selectedFieldIdx === fieldIdx;
                            const isDragOver = isDropTarget && state.dragOverFieldIdx === fieldIdx;
                            return (
                              <div
                                key={fieldIdx}
                                className={cn(
                                  "border rounded-md px-3 py-2 cursor-grab text-sm bg-background transition-colors",
                                  isFieldSelected && "ring-2 ring-primary border-primary",
                                  isDragOver && "ring-2 ring-primary/50",
                                  field.colSpan > 1 && "col-span-2"
                                )}
                                draggable="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  patch({ selectedSectionIdx: secIdx, selectedFieldIdx: fieldIdx });
                                }}
                                onDragStart={(e) => onDragStartField(e, secIdx, fieldIdx)}
                                onDragOver={(e) => onDragOverField(e, secIdx, fieldIdx)}
                                onDrop={(e) => onDropField(e, secIdx, fieldIdx)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{WIDGET_ICON_MAP[field.widgetType] ?? "?"}</span>
                                  <span className="font-medium">{field.label}</span>
                                  {field.required && <span className="text-destructive">*</span>}
                                  <Badge variant="outline" className="text-xs ml-auto">{WIDGET_LABEL_MAP[field.widgetType] ?? field.widgetType}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 font-mono">{field.fieldCode}</div>
                                <div className="flex gap-1 mt-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); moveField(secIdx, fieldIdx, -1); }} disabled={fieldIdx === 0}>^</Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); moveField(secIdx, fieldIdx, 1); }} disabled={fieldIdx === section.fields.length - 1}>v</Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeField(secIdx, fieldIdx); }}>X</Button>
                                </div>
                              </div>
                            );
                          })}
                          {section.fields.length === 0 && (
                            <div className="text-sm text-muted-foreground py-4 text-center col-span-full">
                              拖拽组件到此处添加字段
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Properties */}
        <aside className="w-72 border-l bg-muted/30 flex flex-col shrink-0 overflow-auto">
          <div className="px-4 py-3 text-sm font-medium text-muted-foreground">属性面板</div>
          <Separator />

          {/* Page props */}
          {state.selectedSectionIdx === null && (
            <div className="p-4 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">页面属性</div>
              <div className="space-y-1">
                <Label>页面名称</Label>
                <Input value={state.pageConfig.name} onChange={(e) => patchPage({ name: e.target.value })} placeholder="请输入页面名称" />
              </div>
              <div className="space-y-1">
                <Label>页面编码</Label>
                <Input value={state.pageConfig.code} onChange={(e) => patchPage({ code: e.target.value })} placeholder="请输入页面编码" />
              </div>
              <div className="space-y-1">
                <Label>页面类型</Label>
                <Select value={state.pageConfig.pageType} onValueChange={(val) => patchPage({ pageType: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORM">表单页</SelectItem>
                    <SelectItem value="TABLE">列表页</SelectItem>
                    <SelectItem value="DETAIL">详情页</SelectItem>
                    <SelectItem value="DASHBOARD">仪表盘</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>关联对象</Label>
                <Input value={state.pageConfig.objectCode} onChange={(e) => patchPage({ objectCode: e.target.value })} placeholder="ObjectType 编码" />
              </div>
            </div>
          )}

          {/* Section props */}
          {selectedSection && state.selectedFieldIdx === null && (
            <div className="p-4 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">区域属性</div>
              <div className="space-y-1">
                <Label>区域标题</Label>
                <Input value={selectedSection.title} onChange={(e) => patchSection(state.selectedSectionIdx!, { title: e.target.value })} placeholder="请输入区域标题" />
              </div>
              <div className="space-y-1">
                <Label>区域类型</Label>
                <Select
                  value={selectedSection.sectionType}
                  onValueChange={(val) => {
                    const newType = val as "TABLE" | "FIELD_GROUP";
                    const patchObj: Partial<DesignerSection> = { sectionType: newType };
                    if (newType === "TABLE" && !selectedSection.table) {
                      patchObj.table = { columns: [], pagination: true, pageSize: 20, sortable: true, filterable: true };
                      patchObj.columns = 1;
                    }
                    if (newType === "FIELD_GROUP" && selectedSection.columns < 1) {
                      patchObj.columns = 2;
                    }
                    patchSection(state.selectedSectionIdx!, patchObj);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD_GROUP">表单区域</SelectItem>
                    <SelectItem value="TABLE">表格区域</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedSection.sectionType === "FIELD_GROUP" && (
                <div className="space-y-1">
                  <Label>列数</Label>
                  <Select value={String(selectedSection.columns)} onValueChange={(val) => patchSection(state.selectedSectionIdx!, { columns: Number(val) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1列</SelectItem>
                      <SelectItem value="2">2列</SelectItem>
                      <SelectItem value="3">3列</SelectItem>
                      <SelectItem value="4">4列</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedSection.sectionType === "TABLE" && selectedSection.table && (
                <>
                  <div className="space-y-1">
                    <Label>分页大小</Label>
                    <Input type="number" value={selectedSection.table.pageSize} onChange={(e) => {
                      const table = { ...selectedSection.table!, pageSize: Number(e.target.value) };
                      patchSection(state.selectedSectionIdx!, { table });
                    }} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedSection.table.pagination} onChange={(e) => {
                      const table = { ...selectedSection.table!, pagination: e.target.checked };
                      patchSection(state.selectedSectionIdx!, { table });
                    }} />
                    启用分页
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedSection.table.filterable} onChange={(e) => {
                      const table = { ...selectedSection.table!, filterable: e.target.checked };
                      patchSection(state.selectedSectionIdx!, { table });
                    }} />
                    启用筛选
                  </label>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addField(state.selectedSectionIdx!, "input")}>
                    + 添加列
                  </Button>
                </>
              )}
              {selectedSection.sectionType === "FIELD_GROUP" && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => addField(state.selectedSectionIdx!, "input")}>
                  + 添加字段
                </Button>
              )}
            </div>
          )}

          {/* Field props */}
          {selectedField && state.selectedFieldIdx !== null && state.selectedSectionIdx !== null && (
            <div className="p-4 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {selectedIsTableCol ? "列属性" : "字段属性"}
              </div>

              {selectedIsTableCol ? (
                <>
                  <div className="space-y-1">
                    <Label>列标识</Label>
                    <Input value={(selectedField as DesignerTableCol).fieldCode} onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { fieldCode: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>列标题</Label>
                    <Input value={(selectedField as DesignerTableCol).title} onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>数据类型</Label>
                    <Select value={(selectedField as DesignerTableCol).type} onValueChange={(val) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { type: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">文本</SelectItem>
                        <SelectItem value="number">数字</SelectItem>
                        <SelectItem value="date">日期</SelectItem>
                        <SelectItem value="boolean">布尔</SelectItem>
                        <SelectItem value="link">链接</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>列宽 (px)</Label>
                    <Input type="number" value={(selectedField as DesignerTableCol).width} onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { width: Number(e.target.value) })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(selectedField as DesignerTableCol).sortable} onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { sortable: e.target.checked })} />
                    可排序
                  </label>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>字段编码</Label>
                    <Input value={(selectedField as DesignerField).fieldCode} onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { fieldCode: e.target.value })} placeholder="字段唯一编码" />
                  </div>
                  <div className="space-y-1">
                    <Label>标签文本</Label>
                    <Input value={(selectedField as DesignerField).label} onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { label: e.target.value })} placeholder="显示标签" />
                  </div>
                  <div className="space-y-1">
                    <Label>组件类型</Label>
                    <Select value={(selectedField as DesignerField).widgetType} onValueChange={(val) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { widgetType: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WIDGET_LIST.map((w) => (
                          <SelectItem key={w.type} value={w.type}>{w.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>占位文本</Label>
                    <Input value={(selectedField as DesignerField).placeholder} onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { placeholder: e.target.value })} placeholder="输入提示" />
                  </div>
                  <div className="space-y-1">
                    <Label>列跨度 (colSpan)</Label>
                    <Select value={String((selectedField as DesignerField).colSpan)} onValueChange={(val) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { colSpan: Number(val) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: selectedSection?.columns ?? 2 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(selectedField as DesignerField).required} onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { required: e.target.checked })} />
                    必填
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(selectedField as DesignerField).readonly} onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { readonly: e.target.checked })} />
                    只读
                  </label>
                </>
              )}
            </div>
          )}

          {/* Hint */}
          {!selectedSection && state.selectedSectionIdx === null && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              选择画布中的区域或字段以编辑其属性
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default PageDesigner;
