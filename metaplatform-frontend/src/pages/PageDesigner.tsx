import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPageConfig, updatePageConfig, createPageConfig } from "../api/pageApi";

/* ────────────────────── 类型定义 ────────────────────── */

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

/* ────────────────────── 常量 ────────────────────── */

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
  { type: "datepicker", label: "日期",     icon: "📅" },
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

/* ────────────────────── 组件 ────────────────────── */

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

  /* 加载已有配置 */
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPageConfig(id)
      .then((cfg) => {
        // 将后端 sections 转换为 DesignerSection
        const rawSections = (cfg as Record<string, unknown>).sections as Record<string, unknown>[] | undefined;
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
            code: (cfg as Record<string, unknown>).code as string ?? "",
            pageType: cfg.pageType ?? "FORM",
            objectCode: cfg.objectCode ?? "",
            sections,
          },
        }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  /* Toast 自动消失 */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── 辅助 setter ── */
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

  /* ── 添加 / 删除 section ── */
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

  /* ── 字段操作 ── */
  const addField = useCallback((secIdx: number, widgetType: string) => {
    setState((prev) => {
      const sections = [...prev.pageConfig.sections];
      const section = sections[secIdx];
      if (section.sectionType === "TABLE") {
        // TABLE section: add a column
        const table = { ...section.table!, columns: [...section.table!.columns, { ...defaultTableCol(), title: WIDGET_LABEL_MAP[widgetType] ?? widgetType }] };
        sections[secIdx] = { ...section, table };
      } else {
        // FIELD_GROUP: add a field
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

  /* ── 拖拽处理 ── */
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
    // 仅当真正离开容器时清除
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    patch({ dragOverSectionIdx: null, dragOverFieldIdx: null });
  }, [patch]);

  const onDropSection = useCallback((e: React.DragEvent, secIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    // 从面板拖入
    const widgetType = e.dataTransfer.getData("application/x-widget-type");
    if (widgetType) {
      addField(secIdx, widgetType);
    }

    // 字段移动
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
          // 如果同一个section内移动且目标在源之后，调整索引
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

  /* ── 保存 ── */
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

  /* ── 预览 ── */
  const handlePreview = useCallback(() => {
    const pid = state.pageConfig.id ?? id;
    if (pid) navigate(`/pages/${pid}`);
  }, [state.pageConfig.id, id, navigate]);

  /* ── 当前选中的 field ── */
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

  /* ────────────────────── 渲染 ────────────────────── */

  if (loading) {
    return <div className="mp-loading" style={{ padding: 40 }}>正在加载页面配置...</div>;
  }

  return (
    <div className="mp-designer">
      {/* Toast */}
      {toast && <div className="mp-designer-toast">{toast}</div>}

      {/* 顶部工具栏 */}
      <div className="mp-designer-toolbar">
        <div className="mp-toolbar-left">
          <button className="mp-btn mp-btn-sm" onClick={() => navigate(-1)} title="返回">
            ← 返回
          </button>
          <span className="mp-toolbar-title">
            {isEditMode ? "编辑页面设计器" : "新建页面设计器"}
          </span>
        </div>
        <div className="mp-toolbar-center">
          <input
            className="mp-toolbar-input"
            placeholder="页面名称"
            value={state.pageConfig.name}
            onChange={(e) => patchPage({ name: e.target.value })}
          />
          <input
            className="mp-toolbar-input mp-toolbar-input-sm"
            placeholder="页面编码"
            value={state.pageConfig.code}
            onChange={(e) => patchPage({ code: e.target.value })}
          />
        </div>
        <div className="mp-toolbar-right">
          <button className="mp-btn mp-btn-sm" onClick={() => addSection("FIELD_GROUP")} title="添加表单区域">
            + 表单区域
          </button>
          <button className="mp-btn mp-btn-sm" onClick={() => addSection("TABLE")} title="添加表格区域">
            + 表格区域
          </button>
          {isEditMode && (
            <button className="mp-btn mp-btn-sm" onClick={handlePreview} title="预览页面">
              预览
            </button>
          )}
          <button className="mp-btn mp-btn-primary mp-btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mp-alert mp-alert-error" style={{ margin: "8px 16px 0" }}>
          {error}
        </div>
      )}

      {/* 三栏主体 */}
      <div className="mp-designer-body" onDragEnd={onDragEnd}>
        {/* ── 左侧：组件面板 ── */}
        <aside className="mp-designer-palette">
          <div className="mp-palette-title">组件列表</div>
          <div className="mp-palette-hint">拖拽组件到画布区域</div>
          <div className="mp-palette-list">
            {WIDGET_LIST.map((w) => (
              <div
                key={w.type}
                className={`mp-palette-item${state.dragSource?.type === "palette" && state.dragSource.widgetType === w.type ? " mp-dragging" : ""}`}
                draggable="true"
                onDragStart={(e) => onDragStartPalette(e, w.type)}
              >
                <span className="mp-palette-item-icon">{w.icon}</span>
                <span className="mp-palette-item-label">{w.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── 中间：画布 ── */}
        <div className="mp-designer-canvas">
          {state.pageConfig.sections.length === 0 ? (
            <div className="mp-canvas-empty">
              <div className="mp-canvas-empty-icon">⬜</div>
              <p>暂无区域，点击上方按钮添加"表单区域"或"表格区域"</p>
            </div>
          ) : (
            state.pageConfig.sections.map((section, secIdx) => {
              const isDropTarget = state.dragOverSectionIdx === secIdx;
              const isSelected = state.selectedSectionIdx === secIdx;
              return (
                <div
                  key={secIdx}
                  className={`mp-designer-section${isSelected ? " selected" : ""}${isDropTarget ? " mp-drop-zone" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    patch({ selectedSectionIdx: secIdx, selectedFieldIdx: null });
                  }}
                  onDragOver={(e) => onDragOverSection(e, secIdx)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDropSection(e, secIdx)}
                >
                  {/* section header */}
                  <div className="mp-section-header">
                    <span className="mp-section-type-badge">
                      {section.sectionType === "TABLE" ? "表格" : "表单"}
                    </span>
                    <span className="mp-section-title-text">{section.title}</span>
                    <div className="mp-section-actions">
                      <button
                        className="mp-btn-icon"
                        title="上移"
                        onClick={(e) => { e.stopPropagation(); moveSection(secIdx, -1); }}
                        disabled={secIdx === 0}
                      >
                        ↑
                      </button>
                      <button
                        className="mp-btn-icon"
                        title="下移"
                        onClick={(e) => { e.stopPropagation(); moveSection(secIdx, 1); }}
                        disabled={secIdx === state.pageConfig.sections.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        className="mp-btn-icon mp-btn-icon-danger"
                        title="删除区域"
                        onClick={(e) => { e.stopPropagation(); removeSection(secIdx); }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* section body */}
                  {section.sectionType === "TABLE" ? (
                    /* TABLE columns */
                    <div className="mp-table-columns">
                      {section.table?.columns.map((col, colIdx) => {
                        const isFieldSelected = isSelected && state.selectedFieldIdx === colIdx;
                        return (
                          <div
                            key={colIdx}
                            className={`mp-designer-field-card${isFieldSelected ? " selected" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              patch({ selectedSectionIdx: secIdx, selectedFieldIdx: colIdx });
                            }}
                          >
                            <div className="mp-field-card-top">
                              <span className="mp-field-card-label">{col.title}</span>
                              <span className="mp-field-card-type">{col.type}</span>
                            </div>
                            <div className="mp-field-card-code">{col.fieldCode}</div>
                            <div className="mp-field-card-actions">
                              <button
                                className="mp-btn-icon"
                                title="上移"
                                onClick={(e) => { e.stopPropagation(); moveField(secIdx, colIdx, -1); }}
                                disabled={colIdx === 0}
                              >
                                ↑
                              </button>
                              <button
                                className="mp-btn-icon"
                                title="下移"
                                onClick={(e) => { e.stopPropagation(); moveField(secIdx, colIdx, 1); }}
                                disabled={colIdx === (section.table?.columns.length ?? 0) - 1}
                              >
                                ↓
                              </button>
                              <button
                                className="mp-btn-icon mp-btn-icon-danger"
                                title="删除列"
                                onClick={(e) => { e.stopPropagation(); removeField(secIdx, colIdx); }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {(!section.table?.columns || section.table.columns.length === 0) && (
                        <div className="mp-canvas-hint">拖拽组件到此处添加列，或点击右侧面板添加</div>
                      )}
                    </div>
                  ) : (
                    /* FIELD_GROUP fields grid */
                    <div
                      className="mp-field-grid"
                      style={{ gridTemplateColumns: `repeat(${section.columns}, 1fr)` }}
                    >
                      {section.fields.map((field, fieldIdx) => {
                        const isFieldSelected = isSelected && state.selectedFieldIdx === fieldIdx;
                        const isDragOver = isDropTarget && state.dragOverFieldIdx === fieldIdx;
                        return (
                          <div
                            key={fieldIdx}
                            className={`mp-designer-field-card${isFieldSelected ? " selected" : ""}${isDragOver ? " mp-insert-before" : ""}`}
                            style={field.colSpan > 1 ? { gridColumn: `span ${field.colSpan}` } : undefined}
                            draggable="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              patch({ selectedSectionIdx: secIdx, selectedFieldIdx: fieldIdx });
                            }}
                            onDragStart={(e) => onDragStartField(e, secIdx, fieldIdx)}
                            onDragOver={(e) => onDragOverField(e, secIdx, fieldIdx)}
                            onDrop={(e) => onDropField(e, secIdx, fieldIdx)}
                          >
                            <div className="mp-field-card-top">
                              <span className="mp-field-card-icon">{WIDGET_ICON_MAP[field.widgetType] ?? "?"}</span>
                              <span className="mp-field-card-label">{field.label}</span>
                              {field.required && <span className="mp-field-card-required">*</span>}
                              <span className="mp-field-card-type">{WIDGET_LABEL_MAP[field.widgetType] ?? field.widgetType}</span>
                            </div>
                            <div className="mp-field-card-code">{field.fieldCode}</div>
                            <div className="mp-field-card-actions">
                              <button
                                className="mp-btn-icon"
                                title="上移"
                                onClick={(e) => { e.stopPropagation(); moveField(secIdx, fieldIdx, -1); }}
                                disabled={fieldIdx === 0}
                              >
                                ↑
                              </button>
                              <button
                                className="mp-btn-icon"
                                title="下移"
                                onClick={(e) => { e.stopPropagation(); moveField(secIdx, fieldIdx, 1); }}
                                disabled={fieldIdx === section.fields.length - 1}
                              >
                                ↓
                              </button>
                              <button
                                className="mp-btn-icon mp-btn-icon-danger"
                                title="删除字段"
                                onClick={(e) => { e.stopPropagation(); removeField(secIdx, fieldIdx); }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {section.fields.length === 0 && (
                        <div className="mp-canvas-hint" style={{ gridColumn: "1 / -1" }}>
                          拖拽组件到此处添加字段
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── 右侧：属性面板 ── */}
        <aside className="mp-designer-props">
          <div className="mp-props-title">属性面板</div>

          {/* 页面属性（无选中时展示） */}
          {state.selectedSectionIdx === null && (
            <div className="mp-props-group">
              <div className="mp-props-group-title">页面属性</div>
              <label className="mp-props-field">
                <span>页面名称</span>
                <input
                  value={state.pageConfig.name}
                  onChange={(e) => patchPage({ name: e.target.value })}
                  placeholder="请输入页面名称"
                />
              </label>
              <label className="mp-props-field">
                <span>页面编码</span>
                <input
                  value={state.pageConfig.code}
                  onChange={(e) => patchPage({ code: e.target.value })}
                  placeholder="请输入页面编码"
                />
              </label>
              <label className="mp-props-field">
                <span>页面类型</span>
                <select
                  value={state.pageConfig.pageType}
                  onChange={(e) => patchPage({ pageType: e.target.value })}
                >
                  <option value="FORM">表单页</option>
                  <option value="TABLE">列表页</option>
                  <option value="DETAIL">详情页</option>
                  <option value="DASHBOARD">仪表盘</option>
                </select>
              </label>
              <label className="mp-props-field">
                <span>关联对象</span>
                <input
                  value={state.pageConfig.objectCode}
                  onChange={(e) => patchPage({ objectCode: e.target.value })}
                  placeholder="ObjectType 编码"
                />
              </label>
            </div>
          )}

          {/* Section 属性（选中 section 但无 field） */}
          {selectedSection && state.selectedFieldIdx === null && (
            <div className="mp-props-group">
              <div className="mp-props-group-title">区域属性</div>
              <label className="mp-props-field">
                <span>区域标题</span>
                <input
                  value={selectedSection.title}
                  onChange={(e) => patchSection(state.selectedSectionIdx!, { title: e.target.value })}
                  placeholder="请输入区域标题"
                />
              </label>
              <label className="mp-props-field">
                <span>区域类型</span>
                <select
                  value={selectedSection.sectionType}
                  onChange={(e) => {
                    const newType = e.target.value as "TABLE" | "FIELD_GROUP";
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
                  <option value="FIELD_GROUP">表单区域</option>
                  <option value="TABLE">表格区域</option>
                </select>
              </label>
              {selectedSection.sectionType === "FIELD_GROUP" && (
                <label className="mp-props-field">
                  <span>列数</span>
                  <select
                    value={selectedSection.columns}
                    onChange={(e) => patchSection(state.selectedSectionIdx!, { columns: Number(e.target.value) })}
                  >
                    <option value={1}>1列</option>
                    <option value={2}>2列</option>
                    <option value={3}>3列</option>
                    <option value={4}>4列</option>
                  </select>
                </label>
              )}
              {selectedSection.sectionType === "TABLE" && selectedSection.table && (
                <>
                  <label className="mp-props-field">
                    <span>分页大小</span>
                    <input
                      type="number"
                      value={selectedSection.table.pageSize}
                      onChange={(e) => {
                        const table = { ...selectedSection.table!, pageSize: Number(e.target.value) };
                        patchSection(state.selectedSectionIdx!, { table });
                      }}
                    />
                  </label>
                  <label className="mp-props-field mp-props-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSection.table.pagination}
                      onChange={(e) => {
                        const table = { ...selectedSection.table!, pagination: e.target.checked };
                        patchSection(state.selectedSectionIdx!, { table });
                      }}
                    />
                    <span>启用分页</span>
                  </label>
                  <label className="mp-props-field mp-props-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSection.table.filterable}
                      onChange={(e) => {
                        const table = { ...selectedSection.table!, filterable: e.target.checked };
                        patchSection(state.selectedSectionIdx!, { table });
                      }}
                    />
                    <span>启用筛选</span>
                  </label>
                  <button
                    className="mp-btn mp-btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => addField(state.selectedSectionIdx!, "input")}
                  >
                    + 添加列
                  </button>
                </>
              )}
              {selectedSection.sectionType === "FIELD_GROUP" && (
                <button
                  className="mp-btn mp-btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => addField(state.selectedSectionIdx!, "input")}
                >
                  + 添加字段
                </button>
              )}
            </div>
          )}

          {/* Field 属性 */}
          {selectedField && state.selectedFieldIdx !== null && state.selectedSectionIdx !== null && (
            <div className="mp-props-group">
              <div className="mp-props-group-title">
                {selectedIsTableCol ? "列属性" : "字段属性"}
              </div>

              {selectedIsTableCol ? (
                /* TABLE column props */
                <>
                  <label className="mp-props-field">
                    <span>列标识</span>
                    <input
                      value={(selectedField as DesignerTableCol).fieldCode}
                      onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { fieldCode: e.target.value })}
                    />
                  </label>
                  <label className="mp-props-field">
                    <span>列标题</span>
                    <input
                      value={(selectedField as DesignerTableCol).title}
                      onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { title: e.target.value })}
                    />
                  </label>
                  <label className="mp-props-field">
                    <span>数据类型</span>
                    <select
                      value={(selectedField as DesignerTableCol).type}
                      onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { type: e.target.value })}
                    >
                      <option value="text">文本</option>
                      <option value="number">数字</option>
                      <option value="date">日期</option>
                      <option value="boolean">布尔</option>
                      <option value="link">链接</option>
                    </select>
                  </label>
                  <label className="mp-props-field">
                    <span>列宽 (px)</span>
                    <input
                      type="number"
                      value={(selectedField as DesignerTableCol).width}
                      onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { width: Number(e.target.value) })}
                    />
                  </label>
                  <label className="mp-props-field mp-props-checkbox">
                    <input
                      type="checkbox"
                      checked={(selectedField as DesignerTableCol).sortable}
                      onChange={(e) => patchTableCol(state.selectedSectionIdx!, state.selectedFieldIdx!, { sortable: e.target.checked })}
                    />
                    <span>可排序</span>
                  </label>
                </>
              ) : (
                /* FIELD_GROUP field props */
                <>
                  <label className="mp-props-field">
                    <span>字段编码</span>
                    <input
                      value={(selectedField as DesignerField).fieldCode}
                      onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { fieldCode: e.target.value })}
                      placeholder="字段唯一编码"
                    />
                  </label>
                  <label className="mp-props-field">
                    <span>标签文本</span>
                    <input
                      value={(selectedField as DesignerField).label}
                      onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { label: e.target.value })}
                      placeholder="显示标签"
                    />
                  </label>
                  <label className="mp-props-field">
                    <span>组件类型</span>
                    <select
                      value={(selectedField as DesignerField).widgetType}
                      onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { widgetType: e.target.value })}
                    >
                      {WIDGET_LIST.map((w) => (
                        <option key={w.type} value={w.type}>{w.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mp-props-field">
                    <span>占位文本</span>
                    <input
                      value={(selectedField as DesignerField).placeholder}
                      onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { placeholder: e.target.value })}
                      placeholder="输入提示"
                    />
                  </label>
                  <label className="mp-props-field">
                    <span>列跨度 (colSpan)</span>
                    <select
                      value={(selectedField as DesignerField).colSpan}
                      onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { colSpan: Number(e.target.value) })}
                    >
                      {Array.from({ length: selectedSection?.columns ?? 2 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mp-props-field mp-props-checkbox">
                    <input
                      type="checkbox"
                      checked={(selectedField as DesignerField).required}
                      onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { required: e.target.checked })}
                    />
                    <span>必填</span>
                  </label>
                  <label className="mp-props-field mp-props-checkbox">
                    <input
                      type="checkbox"
                      checked={(selectedField as DesignerField).readonly}
                      onChange={(e) => patchField(state.selectedSectionIdx!, state.selectedFieldIdx!, { readonly: e.target.checked })}
                    />
                    <span>只读</span>
                  </label>
                </>
              )}
            </div>
          )}

          {/* 提示 */}
          {!selectedSection && state.selectedSectionIdx === null && (
            <div className="mp-props-hint">
              选择画布中的区域或字段以编辑其属性
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default PageDesigner;
