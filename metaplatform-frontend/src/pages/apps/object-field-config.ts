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
