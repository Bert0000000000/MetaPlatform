/* ============================================================
 * MetaPlatform Schema-driven UI — Type Definitions
 * ============================================================ */

// ---- Widget types supported by FieldWidget ----
export type WidgetType =
  | "input"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "switch"
  | "datepicker"
  | "datetime"
  | "email"
  | "phone"
  | "url"
  | "rate"
  | "richtext"
  | "file"
  | "image"
  | "signature"
  | "location"
  | "color"
  | "slider"
  | "currency"
  | "percent"
  | "reference"
  | "formula"
  | "divider"
  | "heading";

// ---- Layout ----
export interface PageLayout {
  type: "SINGLE_COLUMN" | "TWO_COLUMN" | "THREE_COLUMN";
  gutter: number;
}

// ---- Field (FORM section) ----
export interface FieldSchema {
  field?: string;
  key?: string; // alias for field - used by the low-code designer
  widget: WidgetType;
  label: string;
  required?: boolean;
  visible?: boolean;
  editable?: boolean;
  placeholder?: string;
  order?: number;
  colSpan?: number;
  width?: "full" | "half" | "third" | "quarter";
  options?: Array<{ label: string; value: string | number }>;
  // extended properties for low-code designer
  defaultValue?: unknown;
  min?: number;
  max?: number;
  pattern?: string;
  precision?: number;
  multiple?: boolean;
  accept?: string;
  maxFileSize?: number;
  rows?: number;
  text?: string; // for divider / heading
  boundObject?: string;
  boundProperty?: string;
}

// ---- TABLE column ----
export interface TableColumn {
  field: string;
  title: string;
  type: "text" | "number" | "date" | "boolean" | "link";
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: number;
}

// ---- TABLE config ----
export interface TableConfig {
  columns: TableColumn[];
  pagination?: boolean;
  pageSize?: number;
}

// ---- KANBAN column ----
export interface KanbanColumn {
  id: string;
  title: string;
  statusKey: string;
  color?: string;
}

// ---- KANBAN config ----
export interface KanbanConfig {
  columns: KanbanColumn[];
  cardTitleField: string;
  cardFields?: string[];
  statusField: string;
}

// ---- Section ----
export type SectionType = "FORM" | "TABLE" | "KANBAN" | "CARD" | "FIELD_GROUP";

export interface SectionSchema {
  id: string;
  title: string;
  type: SectionType;
  columns?: number;
  fields?: FieldSchema[];
  table?: TableConfig;
  kanban?: KanbanConfig;
}

// ---- Top-level PageRender ----
export interface PageRender {
  id?: string;
  name: string;
  displayName?: string;
  pageType: string;
  version?: number;
  objectCode?: string;
  objectId?: string; // ontology object id for data binding
  layout?: PageLayout;
  sections: SectionSchema[];
  viewConfig?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

// ---- Meta info for dashboard listing ----
export interface PageConfigSummary {
  id: string | number;
  name: string;
  displayName?: string;
  code?: string;
  pageType: string;
  objectCode?: string;
  objectTypeId?: string;
  createdAt?: string;
}

// ---- ObjectType from ontology-engine ----
export interface ObjectTypeSummary {
  id: string;
  name?: string;
  code?: string;
  displayName: string;
  description?: string;
  fieldCount?: number;
  createdAt?: string;
}
