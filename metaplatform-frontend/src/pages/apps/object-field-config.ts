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
  // v1.0.2 Sprint 2 F1.1: 关联 (lookup) 字段
  { value: "lookup", label: "关联", icon: "Link2" },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["value"];

/**
 * v1.0.2 Sprint 2 F1.1: lookup 子配置 (目标对象 + 显示字段).
 *
 * <p>对应后端 AppObjectService.LookupSpec 字段:
 * <ul>
 *   <li>objectId - 关联到的目标对象 ID</li>
 *   <li>displayField - 目标对象上用作下拉显示的字段 code</li>
 * </ul>
 */
export interface LookupConfig {
  objectId: number | null;
  displayField: string;
}

export interface FieldFormData {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  unique_field: boolean;
  default_value: string;
  description: string;
  // v1.0.2 Sprint 2 F1.1: lookup 子配置 (type=lookup 时使用)
  lookup: LookupConfig;
}

export const DEFAULT_FIELD_FORM: FieldFormData = {
  name: "",
  label: "",
  type: "text",
  required: false,
  unique_field: false,
  default_value: "",
  description: "",
  lookup: { objectId: null, displayField: "" },
};

/**
 * v1.0.2 Sprint 2 F1.1: 校验字段表单数据.
 *
 * @returns 错误信息, null 表示通过
 */
export function validateFieldForm(
  data: FieldFormData,
  existingFields: Array<{ code: string }>,
  editingCode: string | null,
): string | null {
  if (!data.name.trim() || !data.label.trim()) {
    return "字段名和显示名均为必填";
  }
  if (!/^[a-z][a-z0-9_]*$/.test(data.name.trim())) {
    return "字段名只能包含小写英文、数字和下划线，且不能以数字开头";
  }
  const exists = existingFields.some(
    (p) =>
      p.code === data.name.trim() &&
      (!editingCode || p.code !== editingCode),
  );
  if (exists) {
    return "字段名在当前对象下已存在";
  }
  // lookup 类型校验
  if (data.type === "lookup") {
    if (!data.lookup.objectId) {
      return "关联字段必须选择目标对象";
    }
    if (!data.lookup.displayField.trim()) {
      return "关联字段必须选择显示字段";
    }
  }
  return null;
}

/**
 * v1.0.2 Sprint 2 F1.2: 编辑 lookup 字段时的 schema 变更风险警告文案.
 *
 * <p>lookup 字段的 DDL (BIGINT + FK 索引) 在初次创建时已锁定,
 * 修改目标对象会触发 DDL 变更并影响已有实例的外键引用,
 * 因此 UI 层需在编辑 lookup 时给出明确警告.
 */
export const LOOKUP_EDIT_WARNING = {
  title: "Schema 变更风险提示",
  body: "关联 (lookup) 字段的目标对象与显示字段已锁定，不可修改。修改将触发 DDL 变更（BIGINT → BIGINT FK 索引重建）并可能影响已有实例的外键引用。",
  action: "如需变更关联目标，请先删除该字段再重建。",
} as const;

/**
 * v1.0.2 Sprint 2 F1.2: 编辑普通字段时的不可修改提示.
 *
 * <p>仅当编辑字段且不是 lookup 类型时显示.
 */
export const FIELD_TYPE_LOCKED_HELPER = "AC-103.5: 字段类型不可修改。如需变更, 请先删除该字段再重建。";

/**
 * v1.0.2 Sprint 2 F1.2: 判断编辑模式下, 是否应显示 "字段类型不可修改" helper.
 *
 * <p>规则: 编辑中且非 lookup 字段显示通用 helper; lookup 字段改由 {@link LOOKUP_EDIT_WARNING} 警告卡片替代.
 */
export function shouldShowFieldTypeHelper(
  editingCode: string | null,
  type: FieldType,
): boolean {
  return editingCode !== null && type !== "lookup";
}

/**
 * v1.0.2 Sprint 2 F1.2: 判断编辑模式下是否应显示 lookup schema 警告.
 */
export function shouldShowLookupWarning(
  editingCode: string | null,
  type: FieldType,
): boolean {
  return editingCode !== null && type === "lookup";
}