/**
 * v1.0.2 Sprint 2 F1.5+: Formily schema 适配器.
 *
 * <p>把现有 MetaPlatform section/field schema 转成 Formily JSON Schema.
 *
 * <p>字段类型映射:
 * <ul>
 *   <li>text / email / phone / string  -> TextField</li>
 *   <li>longtext / textarea / richtext -> TextareaField</li>
 *   <li>number / currency / percent   -> NumberField</li>
 *   <li>date                          -> DateField</li>
 *   <li>datetime                      -> DateField (datetime-local)</li>
 *   <li>boolean / switch              -> CheckboxField</li>
 *   <li>select / radio                -> SelectField</li>
 *   <li>multiselect                   -> (F1.5+: TBD)</li>
 *   <li>lookup                        -> LookupField</li>
 * </ul>
 */
import type { ISchema } from "@formily/json-schema";

export type FieldWidget = string;

export interface MetaSection {
  id?: string | number;
  title?: string;
  type?: string;  // FORM/TABLE/KANBAN/CARD/FIELD_GROUP
  columns?: number;
  fields?: MetaField[];
}

export interface MetaField {
  /** 字段 key (Formily 中的 name) */
  field: string;
  /** 显示名 */
  label?: string;
  /** 类型 / widget */
  widget?: FieldWidget;
  /** 兼容老格式 */
  type?: string;
  /** 是否必填 */
  required?: boolean;
  /** placeholder */
  placeholder?: string;
  /** description */
  description?: string;
  /** 默认值 */
  default?: unknown;
  /** select / radio 选项 */
  options?: Array<{ label: string; value: string | number }>;
  /** lookup 配置 */
  lookup?: {
    objectId: string | number;
    displayField: string;
  };
  /** 兼容扁平 lookup */
  boundObject?: string | number;
  boundProperty?: string;
  /**
   * v1.0.2 Sprint 2 F1.6: 联动显隐规则 (AND 组合).
   *
   * <p>当依赖字段满足条件时, 此字段可见; 否则隐藏 (visible=false).
   *
   * <p>典型场景: lookup 字段选中 "China" -> 显示 "Province" 字段.
   *
   * <p>支持操作符:
   * <ul>
   *   <li>eq     - 等于 value</li>
   *   <li>neq    - 不等于 value</li>
   *   <li>notEmpty - 字段有值 (非空)</li>
   *   <li>empty  - 字段为空</li>
   * </ul>
   *
   * <p>多规则为 AND 关系.
   */
  visibleWhen?: VisibleWhenRule | VisibleWhenRule[];
}

/**
 * v1.0.2 Sprint 2 F1.6: 联动显隐规则.
 */
export type VisibleWhenOp = "eq" | "neq" | "notEmpty" | "empty";

export interface VisibleWhenRule {
  /** 依赖字段 key */
  field: string;
  /** 操作符 */
  op: VisibleWhenOp;
  /** 期望值 (op=eq/neq 时必填) */
  value?: string | number | boolean;
}

/**
 * 把 widget/type 映射到 Formily 组件名.
 */
export function widgetToComponent(widget: string | undefined): string {
  const w = String(widget ?? "").toLowerCase();
  switch (w) {
    case "text":
    case "input":
    case "string":
    case "email":
    case "phone":
    case "tel":
      return "TextField";
    case "longtext":
    case "textarea":
    case "richtext":
      return "TextareaField";
    case "number":
    case "currency":
    case "percent":
    case "slider":
    case "rating":
      return "NumberField";
    case "date":
      return "DateField";
    case "datetime":
    case "datetime-local":
      return "DateField";
    case "boolean":
    case "switch":
    case "checkbox":
      return "CheckboxField";
    case "select":
    case "radio":
      return "SelectField";
    case "lookup":
      return "LookupField";
    default:
      return "TextField";
  }
}

/**
 * 把 widget/type 映射到 Formily JSON Schema type.
 * 用于校验 (Formily 内置 validator).
 */
export function widgetToSchemaType(widget: string | undefined): "string" | "number" | "boolean" | "date" | "object" {
  const w = String(widget ?? "").toLowerCase();
  switch (w) {
    case "number":
    case "currency":
    case "percent":
    case "slider":
    case "rating":
      return "number";
    case "boolean":
    case "switch":
    case "checkbox":
      return "boolean";
    case "date":
    case "datetime":
    case "datetime-local":
      return "string";
    default:
      return "string";
  }
}

/**
 * v1.0.2 Sprint 2 F1.6: 把单个 visibleWhen 规则转成表达式片段.
 *
 * <p>返回形如 `$values.country === 'CN'` (用于拼接 when).
 *
 * <p>value 在表达式内做 JSON.stringify 防止注入; Formily 用 new Function() 求值.
 */
export function visibleWhenToExpression(rule: VisibleWhenRule): string {
  const ref = `$values.${rule.field}`;
  switch (rule.op) {
    case "eq":
      return `${ref} === ${JSON.stringify(rule.value)}`;
    case "neq":
      return `${ref} !== ${JSON.stringify(rule.value)}`;
    case "notEmpty":
      return `(${ref} !== undefined && ${ref} !== null && ${ref} !== '')`;
    case "empty":
      return `(${ref} === undefined || ${ref} === null || ${ref} === '')`;
    default:
      return "true";
  }
}

/**
 * v1.0.2 Sprint 2 F1.6: 把 visibleWhen 规则转 Formily x-reactions.
 *
 * <p>多规则 AND 组合; 全部满足时 visible=true 否则 visible=false.
 *
 * <p>返回 null 表示无规则 (无需 reactions).
 */
export function visibleWhenToReactions(
  visibleWhen: VisibleWhenRule | VisibleWhenRule[] | undefined,
): any | null {
  if (!visibleWhen) return null;
  const rules = Array.isArray(visibleWhen) ? visibleWhen : [visibleWhen];
  if (rules.length === 0) return null;
  const deps = Array.from(new Set(rules.map((r) => r.field)));
  const whenExpr = rules.map(visibleWhenToExpression).join(" && ");
  return {
    dependencies: deps,
    when: "{{" + whenExpr + "}}",
    fulfill: { state: { visible: true } },
    otherwise: { state: { visible: false } },
  };
}

/**
 * 把单个 MetaField 转成 Formily JSON Schema 节点.
 */
export function fieldToSchema(field: MetaField): ISchema {
  const componentName = widgetToComponent(field.widget || field.type);
  const schemaType = widgetToSchemaType(field.widget || field.type);
  const widget = String(field.widget || field.type || "").toLowerCase();

  const node: ISchema = {
    type: schemaType,
    title: field.label ?? field.field,
    required: !!field.required,
    "x-component": componentName,
    "x-decorator": "FormItem",
    "x-validator": field.required ? { required: true, message: `${field.label ?? field.field} 是必填` } : undefined,
    "x-component-props": {
      placeholder: field.placeholder,
    },
    "x-decorator-props": {
      description: field.description,
    },
    default: field.default,
  };

  // select / radio: 注入 options
  if (componentName === "SelectField" && Array.isArray(field.options)) {
    (node["x-component-props"] ??= {}).options = field.options;
  }

  // lookup: 注入 objectId + displayField
  if (componentName === "LookupField") {
    const lookup = field.lookup ?? (field.boundObject && field.boundProperty
      ? { objectId: field.boundObject, displayField: field.boundProperty }
      : undefined);
    if (lookup) {
      (node["x-component-props"] ??= {}).objectId = lookup.objectId;
      (node["x-component-props"] ??= {}).displayField = lookup.displayField;
    }
  }

  // date-time
  if (componentName === "DateField" && (widget === "datetime" || widget === "datetime-local")) {
    (node["x-component-props"] ??= {}).type = "datetime-local";
  }

  // v1.0.2 Sprint 2 F1.6: 联动显隐规则 -> x-reactions
  if (field.visibleWhen) {
    const reactions = visibleWhenToReactions(field.visibleWhen);
    if (reactions) node["x-reactions"] = reactions;
  }

  return node;
}

/**
 * 把 MetaSection[] 转成 Formily JSON Schema (单对象, fields 平铺到 properties).
 *
 * <p>Formily 的 JSON Schema 通常是一个对象 (properties: {}); sections 在 MetaPlatform
 * 是布局概念, 渲染时通过 createForm / form.getValuesIn() 取数.
 */
export function sectionsToFormilySchema(sections: MetaSection[]): ISchema {
  const properties: Record<string, ISchema> = {};
  for (const section of sections) {
    const fields = section.fields ?? [];
    for (const f of fields) {
      if (!f?.field) continue;
      properties[f.field] = fieldToSchema(f);
    }
  }
  return {
    type: "object",
    properties,
  };
}

/**
 * 提取表单初始值 (根据 default)
 */
export function extractInitialValues(sections: MetaSection[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of sections) {
    for (const f of section.fields ?? []) {
      if (!f?.field) continue;
      if (f.default !== undefined) out[f.field] = f.default;
    }
  }
  return out;
}

/**
 * 提取 lookup 字段配置 (供 useFormEffects 调用 lookup-options API)
 */
export function extractLookupConfigs(sections: MetaSection[]): MetaField[] {
  const result: MetaField[] = [];
  for (const section of sections) {
    for (const f of section.fields ?? []) {
      if (widgetToComponent(f.widget || f.type) !== "LookupField") continue;
      result.push(f);
    }
  }
  return result;
}