/**
 * Unified Low-Code Field Type Library
 *
 * 25+ field types organized by category.  Each definition carries the
 * metadata the designer needs (icon, label, category, default config)
 * as well as the runtime widget key consumed by widgetMap.
 *
 * This is the single source of truth — the designer palette, the
 * property-panel logic, and the schema converter all reference these
 * definitions.
 */

// ─── Types ─────────────────────────────────────────────────

export type FieldCategory = "basic" | "advanced" | "layout" | "business";

export interface OptionItem {
  label: string;
  value: string;
}

/**
 * Design-time field definition stored inside a DesignerSection.
 * Mirrors FieldSchema (runtime) but adds designer-only props.
 */
export interface DesignerField {
  id: string;
  type: string; // key from FIELD_LIBRARY
  label: string;
  fieldKey: string; // unique data-binding key
  required: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: OptionItem[];
  width: "full" | "half" | "third" | "quarter";
  // validation
  min?: number;
  max?: number;
  pattern?: string;
  patternMsg?: string;
  // data binding
  boundObject?: string; // ontology object id
  boundProperty?: string; // ontology property id
  // state
  hidden?: boolean;
  readonly?: boolean;
  // type-specific
  precision?: number; // number / currency
  multiple?: boolean; // select / file
  accept?: string; // file upload mime filter
  maxFileSize?: number; // MB
  rows?: number; // textarea
  // layout-only fields (divider / heading) use this
  text?: string;
}

export interface FieldTypeDef {
  type: string;
  label: string;
  category: FieldCategory;
  icon: string; // lucide icon name
  widget: string; // key into widgetMap
  description: string;
  /** Factory for a new field of this type */
  defaultField: () => Partial<DesignerField>;
  /** Which property-panel sections are relevant for this type */
  props: PropertyGroup[];
}

export type PropertyGroup =
  | "basic" // label, key, placeholder, default
  | "options" // option list for select / radio / checkbox
  | "validation" // required, min, max, pattern
  | "number" // precision, min, max
  | "file" // accept, multiple, maxFileSize
  | "binding" // boundObject, boundProperty
  | "layout" // width, hidden, readonly
  | "text"; // text content for divider / heading

// ─── Helpers ───────────────────────────────────────────────

let _idCounter = 0;
export function uid(prefix = "f"): string {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

// ─── Field Library ─────────────────────────────────────────

export const FIELD_LIBRARY: FieldTypeDef[] = [
  // ── Basic fields ──
  {
    type: "input",
    label: "单行文本",
    category: "basic",
    icon: "Type",
    widget: "input",
    description: "单行文本输入框",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "input",
      label: "单行文本",
      fieldKey: "",
      required: false,
      width: "half",
      placeholder: "请输入",
    }),
  },
  {
    type: "textarea",
    label: "多行文本",
    category: "basic",
    icon: "AlignLeft",
    widget: "textarea",
    description: "多行文本输入域",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "textarea",
      label: "多行文本",
      fieldKey: "",
      required: false,
      width: "full",
      placeholder: "请输入",
      rows: 4,
    }),
  },
  {
    type: "number",
    label: "数字",
    category: "basic",
    icon: "Hash",
    widget: "number",
    description: "数值输入",
    props: ["basic", "number", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "number",
      label: "数字",
      fieldKey: "",
      required: false,
      width: "half",
      precision: 0,
      min: 0,
    }),
  },
  {
    type: "select",
    label: "下拉选择",
    category: "basic",
    icon: "ChevronDownSquare",
    widget: "select",
    description: "下拉单选/多选",
    props: ["basic", "options", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "select",
      label: "下拉选择",
      fieldKey: "",
      required: false,
      width: "half",
      multiple: false,
      options: [
        { label: "选项一", value: "opt1" },
        { label: "选项二", value: "opt2" },
      ],
    }),
  },
  {
    type: "radio",
    label: "单选框组",
    category: "basic",
    icon: "CircleDot",
    widget: "radio",
    description: "单选按钮组",
    props: ["basic", "options", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "radio",
      label: "单选框组",
      fieldKey: "",
      required: false,
      width: "full",
      options: [
        { label: "选项一", value: "opt1" },
        { label: "选项二", value: "opt2" },
      ],
    }),
  },
  {
    type: "checkbox",
    label: "复选框组",
    category: "basic",
    icon: "CheckSquare",
    widget: "checkbox",
    description: "多选复选框组",
    props: ["basic", "options", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "checkbox",
      label: "复选框组",
      fieldKey: "",
      required: false,
      width: "full",
      options: [
        { label: "选项一", value: "opt1" },
        { label: "选项二", value: "opt2" },
      ],
    }),
  },
  {
    type: "switch",
    label: "开关",
    category: "basic",
    icon: "ToggleLeft",
    widget: "switch",
    description: "是/否开关",
    props: ["basic", "binding", "layout"],
    defaultField: () => ({
      type: "switch",
      label: "开关",
      fieldKey: "",
      required: false,
      width: "half",
      defaultValue: false,
    }),
  },
  {
    type: "datepicker",
    label: "日期",
    category: "basic",
    icon: "Calendar",
    widget: "datepicker",
    description: "日期选择器",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "datepicker",
      label: "日期",
      fieldKey: "",
      required: false,
      width: "half",
    }),
  },
  {
    type: "datetime",
    label: "日期时间",
    category: "basic",
    icon: "CalendarClock",
    widget: "datetime",
    description: "日期+时间选择器",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "datetime",
      label: "日期时间",
      fieldKey: "",
      required: false,
      width: "half",
    }),
  },

  // ── Advanced fields ──
  {
    type: "email",
    label: "邮箱",
    category: "advanced",
    icon: "Mail",
    widget: "email",
    description: "电子邮箱输入",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "email",
      label: "邮箱",
      fieldKey: "",
      required: false,
      width: "half",
      placeholder: "email@example.com",
      pattern: "^[^@]+@[^@]+\\.[^@]+$",
      patternMsg: "请输入有效的邮箱地址",
    }),
  },
  {
    type: "phone",
    label: "手机号",
    category: "advanced",
    icon: "Smartphone",
    widget: "phone",
    description: "手机号码输入",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "phone",
      label: "手机号",
      fieldKey: "",
      required: false,
      width: "half",
      placeholder: "请输入手机号",
      pattern: "^1[3-9]\\d{9}$",
      patternMsg: "请输入有效的手机号",
    }),
  },
  {
    type: "url",
    label: "网址",
    category: "advanced",
    icon: "Link",
    widget: "url",
    description: "URL 输入",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "url",
      label: "网址",
      fieldKey: "",
      required: false,
      width: "full",
      placeholder: "https://...",
    }),
  },
  {
    type: "rate",
    label: "评分",
    category: "advanced",
    icon: "Star",
    widget: "rate",
    description: "星级评分 (1-5)",
    props: ["basic", "binding", "layout"],
    defaultField: () => ({
      type: "rate",
      label: "评分",
      fieldKey: "",
      required: false,
      width: "half",
      defaultValue: 0,
    }),
  },
  {
    type: "richtext",
    label: "富文本",
    category: "advanced",
    icon: "FileText",
    widget: "richtext",
    description: "富文本编辑器",
    props: ["basic", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "richtext",
      label: "富文本",
      fieldKey: "",
      required: false,
      width: "full",
    }),
  },
  {
    type: "file",
    label: "附件上传",
    category: "advanced",
    icon: "Paperclip",
    widget: "file",
    description: "文件上传",
    props: ["basic", "file", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "file",
      label: "附件上传",
      fieldKey: "",
      required: false,
      width: "full",
      multiple: true,
      accept: "*/*",
      maxFileSize: 10,
    }),
  },
  {
    type: "image",
    label: "图片上传",
    category: "advanced",
    icon: "Image",
    widget: "image",
    description: "图片上传 (带预览)",
    props: ["basic", "file", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "image",
      label: "图片上传",
      fieldKey: "",
      required: false,
      width: "full",
      multiple: false,
      accept: "image/*",
      maxFileSize: 5,
    }),
  },
  {
    type: "signature",
    label: "手写签名",
    category: "advanced",
    icon: "PenTool",
    widget: "signature",
    description: "手写签名板",
    props: ["basic", "binding", "layout"],
    defaultField: () => ({
      type: "signature",
      label: "手写签名",
      fieldKey: "",
      required: false,
      width: "full",
    }),
  },
  {
    type: "location",
    label: "定位",
    category: "advanced",
    icon: "MapPin",
    widget: "location",
    description: "地理位置选择",
    props: ["basic", "binding", "layout"],
    defaultField: () => ({
      type: "location",
      label: "定位",
      fieldKey: "",
      required: false,
      width: "full",
    }),
  },
  {
    type: "color",
    label: "颜色选择",
    category: "advanced",
    icon: "Palette",
    widget: "color",
    description: "颜色选择器",
    props: ["basic", "binding", "layout"],
    defaultField: () => ({
      type: "color",
      label: "颜色选择",
      fieldKey: "",
      required: false,
      width: "half",
      defaultValue: "#3B82F6",
    }),
  },
  {
    type: "slider",
    label: "滑块",
    category: "advanced",
    icon: "SlidersHorizontal",
    widget: "slider",
    description: "数值滑块",
    props: ["basic", "number", "binding", "layout"],
    defaultField: () => ({
      type: "slider",
      label: "滑块",
      fieldKey: "",
      required: false,
      width: "full",
      min: 0,
      max: 100,
      defaultValue: 50,
    }),
  },

  // ── Business fields ──
  {
    type: "currency",
    label: "金额",
    category: "business",
    icon: "CircleDollarSign",
    widget: "currency",
    description: "货币金额 (自动格式化)",
    props: ["basic", "number", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "currency",
      label: "金额",
      fieldKey: "",
      required: false,
      width: "half",
      precision: 2,
      min: 0,
    }),
  },
  {
    type: "percent",
    label: "百分比",
    category: "business",
    icon: "Percent",
    widget: "percent",
    description: "百分比输入",
    props: ["basic", "number", "validation", "binding", "layout"],
    defaultField: () => ({
      type: "percent",
      label: "百分比",
      fieldKey: "",
      required: false,
      width: "half",
      precision: 1,
      min: 0,
      max: 100,
    }),
  },
  {
    type: "reference",
    label: "关联引用",
    category: "business",
    icon: "GitBranch",
    widget: "reference",
    description: "引用其他对象的记录",
    props: ["basic", "binding", "validation", "layout"],
    defaultField: () => ({
      type: "reference",
      label: "关联引用",
      fieldKey: "",
      required: false,
      width: "full",
    }),
  },
  // ── v1.0.2 Sprint 2 F1.3: 关联 (lookup) 字段 ──
  // 与 reference 类似, 但强绑定到 AppObjectService.LookupSpec
  // (objectId + displayField). 拖入后用户必须选目标对象 + 显示字段.
  {
    type: "lookup",
    label: "关联字段",
    category: "business",
    icon: "Link2",
    widget: "lookup",
    description: "关联到另一对象的 lookup 字段 (FK + displayField)",
    props: ["basic", "binding", "validation", "layout"],
    defaultField: () => ({
      type: "lookup",
      label: "关联字段",
      fieldKey: "",
      required: false,
      width: "full",
    }),
  },
  {
    type: "formula",
    label: "公式",
    category: "business",
    icon: "FunctionSquare",
    widget: "formula",
    description: "自动计算公式 (只读)",
    props: ["basic", "binding", "layout"],
    defaultField: () => ({
      type: "formula",
      label: "公式",
      fieldKey: "",
      required: false,
      width: "half",
      readonly: true,
    }),
  },

  // ── Layout fields ──
  {
    type: "divider",
    label: "分割线",
    category: "layout",
    icon: "Minus",
    widget: "divider",
    description: "视觉分隔线",
    props: ["text", "layout"],
    defaultField: () => ({
      type: "divider",
      label: "分割线",
      fieldKey: "",
      required: false,
      width: "full",
      text: "",
    }),
  },
  {
    type: "heading",
    label: "标题文字",
    category: "layout",
    icon: "Heading",
    widget: "heading",
    description: "静态标题/说明文字",
    props: ["text", "layout"],
    defaultField: () => ({
      type: "heading",
      label: "标题",
      fieldKey: "",
      required: false,
      width: "full",
      text: "标题文字",
    }),
  },
];

// ─── Lookup helpers ────────────────────────────────────────

const FIELD_MAP = new Map(FIELD_LIBRARY.map((f) => [f.type, f]));

export function getFieldDef(type: string): FieldTypeDef | undefined {
  return FIELD_MAP.get(type);
}

export function fieldsByCategory(cat: FieldCategory): FieldTypeDef[] {
  return FIELD_LIBRARY.filter((f) => f.category === cat);
}

export const CATEGORY_LABELS: Record<FieldCategory, string> = {
  basic: "基础字段",
  advanced: "高级字段",
  business: "业务字段",
  layout: "布局字段",
};

export const CATEGORY_ORDER: FieldCategory[] = [
  "basic",
  "advanced",
  "business",
  "layout",
];

/** Width options for the property panel */
export const WIDTH_OPTIONS: { value: DesignerField["width"]; label: string }[] =
  [
    { value: "full", label: "整行" },
    { value: "half", label: "1/2" },
    { value: "third", label: "1/3" },
    { value: "quarter", label: "1/4" },
  ];

/** Create a fully-initialised DesignerField from a type definition */
export function createField(type: string): DesignerField {
  const def = getFieldDef(type);
  const base = def?.defaultField() ?? {};
  return {
    ...base,
    id: uid(),
    type,
    label: base.label ?? type,
    fieldKey: base.fieldKey ?? "",
    required: base.required ?? false,
    width: base.width ?? "full",
  } as DesignerField;
}
