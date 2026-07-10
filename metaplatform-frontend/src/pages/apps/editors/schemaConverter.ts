/**
 * Schema Converter
 *
 * Bridges design-time state (DesignerState) and runtime schema
 * (PageRender) so the same SchemaRenderer that powers the live app
 * also powers the designer's preview mode.
 */

import { DesignerState, DesignerSection } from "./DesignerTypes";
import { DesignerField } from "./fieldLibrary";
import type {
  PageRender,
  SectionSchema,
  FieldSchema,
} from "@/types/schema";

// ─── DesignerState -> PageRender ────────────────────────────

function fieldToSchema(f: DesignerField): FieldSchema {
  return {
    key: f.fieldKey || f.id,
    field: f.fieldKey || f.id,
    label: f.label,
    widget: f.type as FieldSchema["widget"],
    required: f.required,
    placeholder: f.placeholder,
    defaultValue: f.defaultValue,
    options: f.options,
    editable: !f.readonly,
    visible: !f.hidden,
    width: f.width,
    // type-specific (conditionally spread to avoid undefined keys)
    ...(f.min != null ? { min: f.min } : {}),
    ...(f.max != null ? { max: f.max } : {}),
    ...(f.pattern ? { pattern: f.pattern } : {}),
    ...(f.precision != null ? { precision: f.precision } : {}),
    ...(f.multiple != null ? { multiple: f.multiple } : {}),
    ...(f.accept ? { accept: f.accept } : {}),
    ...(f.maxFileSize != null ? { maxFileSize: f.maxFileSize } : {}),
    ...(f.rows != null ? { rows: f.rows } : {}),
    ...(f.text != null ? { text: f.text } : {}),
    // data binding
    ...(f.boundObject
      ? { boundObject: f.boundObject, boundProperty: f.boundProperty }
      : {}),
  } as FieldSchema;
}

function sectionToSchema(s: DesignerSection): SectionSchema {
  return {
    id: s.id,
    title: s.title,
    type: "FORM",
    columns: s.columns,
    fields: s.fields.map(fieldToSchema),
  };
}

export function designerToPageRender(state: DesignerState): PageRender {
  return {
    name: state.pageName,
    version: 1,
    pageType: state.pageType,
    objectId: state.boundObjectId,
    sections: state.sections.map(sectionToSchema),
  };
}

// ─── PageRender -> DesignerState ────────────────────────────

function schemaToField(sf: FieldSchema, idx: number): DesignerField {
  return {
    id: `imp_${Date.now().toString(36)}_${idx}`,
    type: sf.widget || "input",
    label: sf.label,
    fieldKey: sf.key || sf.field || "",
    required: sf.required ?? false,
    placeholder: sf.placeholder,
    defaultValue: sf.defaultValue,
    options: sf.options as DesignerField["options"],
    width: (sf.width as DesignerField["width"]) ?? "full",
    hidden: sf.visible === false,
    readonly: sf.editable === false,
    min: sf.min,
    max: sf.max,
    pattern: sf.pattern,
    precision: sf.precision,
    multiple: sf.multiple,
    accept: sf.accept,
    maxFileSize: sf.maxFileSize,
    rows: sf.rows,
    text: sf.text,
    boundObject: sf.boundObject,
    boundProperty: sf.boundProperty,
  };
}

function schemaToSection(ss: SectionSchema, idx: number): DesignerSection {
  return {
    id: ss.id || `sec_${idx}`,
    title: ss.title,
    columns: (ss.columns as 1 | 2 | 3 | 4) ?? 2,
    collapsed: false,
    fields: (ss.fields ?? []).map((f, i) => schemaToField(f, i)),
  };
}

export function pageRenderToDesigner(
  pr: PageRender,
  pageName: string,
): DesignerState {
  return {
    version: 1,
    pageName: pageName,
    pageType: (pr.pageType as DesignerState["pageType"]) ?? "form",
    boundObjectId: pr.objectId,
    sections: (pr.sections ?? []).map((s, i) => schemaToSection(s, i)),
  };
}

// ─── JSON string helpers (AppPage.config is a JSON string) ─

export function stateToJson(state: DesignerState): string {
  return JSON.stringify(state, null, 2);
}

export function jsonToState(json: string, fallbackName: string): DesignerState {
  try {
    const parsed = JSON.parse(json);
    // Detect if the stored JSON is a DesignerState (has "pageName")
    // vs a PageRender (has "name" + "pageType" + "sections").
    if (parsed.pageName) {
      return parsed as DesignerState;
    }
    // It's a PageRender - convert.
    return pageRenderToDesigner(parsed as PageRender, fallbackName);
  } catch {
    return createEmptyState(fallbackName);
  }
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
