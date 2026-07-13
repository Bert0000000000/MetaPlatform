import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { connect, mapProps, useField } from "@formily/react";
import LookupDropdown, { type LookupOption } from "../LookupDropdown";

/**
 * v1.0.2 Sprint 2 F1.5+: 自研 Formily 组件集.
 *
 * <p>不依赖 antd, 全部基于现有 Radix UI + Tailwind.
 * 组件作为 Formily component 注册, 用 x-component / x-decorator 引用.
 *
 * <p>Formily 上下文通过 react connect 拿到:
 * <ul>
 *   <li>value / onChange (受控)</li>
 *   <li>required / disabled / readonly</li>
 *   <li>errors (校验错误)</li>
 * </ul>
 */

/* ───────────────────────── FormItem (decorator) ───────────────────────── */

export interface FormItemProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  children?: React.ReactNode;
  className?: string;
  /** Formily 注入: errors */
  errors?: string[];
}

/**
 * v1.0.2 Sprint 2 F1.6: FormItem 用 useField 拿到当前 field,
 * 响应 field.visible (由 x-reactions 驱动) 实现联动显隐.
 */
const FormItemInner: React.FC<FormItemProps & { visible?: boolean }> = ({
  title,
  description,
  required,
  children,
  className,
  errors,
  visible,
}) => {
  if (visible === false) {
    // 隐藏时返回空 fragment, 避免渲染占用空间
    return null;
  }
  return (
    <div className={cn("space-y-1.5 mb-4", className)} data-testid="formily-form-item">
      {title && (
        <Label className="text-sm font-medium flex items-center gap-1 text-slate-700">
          <span>{title}</span>
          {required && <span className="text-rose-500">*</span>}
        </Label>
      )}
      <div>{children}</div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {errors && errors.length > 0 && (
        <div
          className="text-xs text-destructive flex items-center gap-1"
          data-testid="formily-form-item-errors"
        >
          <AlertCircle className="size-3" />
          <span>{errors.join(", ")}</span>
        </div>
      )}
    </div>
  );
};

/**
 * FormItem 用 connect 桥接到 Formily field, 响应 visible 状态.
 *
 * <p>Decorator 内的 useField 拿到当前 field, x-reactions 改 field.visible
 * 时本组件会自动重渲染.
 */
export const FormItem: React.FC<FormItemProps> = connect(
  (props) => {
    const field = useField();
    // field.visible === false 时隐藏
    // 默认 visible 为 undefined 即 true (保持向后兼容)
    const visible = field?.visible === false ? false : true;
    return <FormItemInner {...props} visible={visible} />;
  },
  mapProps((props, field) => ({
    title: props.title,
    description: props.description,
    required: field?.required ?? props.required,
    errors: field?.errors ?? props.errors,
  })),
);

/* ───────────────────────── TextField ───────────────────────── */

export interface TextFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}

export const TextField: React.FC<TextFieldProps> = (props) => {
  return (
    <Input
      type="text"
      value={props.value ?? ""}
      onChange={(e) => props.onChange?.(e.target.value)}
      disabled={props.disabled}
      readOnly={props.readOnly}
      placeholder={props.placeholder}
      className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
      data-testid="formily-text-field"
    />
  );
};

/* ───────────────────────── TextareaField ───────────────────────── */

export interface TextareaFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

export const TextareaField: React.FC<TextareaFieldProps> = (props) => {
  return (
    <textarea
      value={props.value ?? ""}
      onChange={(e) => props.onChange?.(e.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
      rows={props.rows ?? 4}
      className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition w-full resize-none"
      data-testid="formily-textarea-field"
    />
  );
};

/* ───────────────────────── NumberField ───────────────────────── */

export interface NumberFieldProps {
  value?: number | string;
  onChange?: (value: number | string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const NumberField: React.FC<NumberFieldProps> = (props) => {
  return (
    <Input
      type="number"
      value={props.value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        // Formily 通常传 string, 由 validate 时转换; 这里保持 string
        props.onChange?.(v);
      }}
      disabled={props.disabled}
      placeholder={props.placeholder}
      className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
      data-testid="formily-number-field"
    />
  );
};

/* ───────────────────────── DateField ───────────────────────── */

export interface DateFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  type?: "date" | "datetime-local";
}

export const DateField: React.FC<DateFieldProps> = (props) => {
  return (
    <Input
      type={props.type ?? "date"}
      value={props.value ?? ""}
      onChange={(e) => props.onChange?.(e.target.value)}
      disabled={props.disabled}
      className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
      data-testid="formily-date-field"
    />
  );
};

/* ───────────────────────── CheckboxField ───────────────────────── */

export interface CheckboxFieldProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = (props) => {
  return (
    <Checkbox
      checked={!!props.value}
      onCheckedChange={(v) => props.onChange?.(v === true)}
      disabled={props.disabled}
      data-testid="formily-checkbox-field"
    />
  );
};

/* ───────────────────────── SelectField ───────────────────────── */

export interface SelectFieldOption {
  label: string;
  value: string | number;
}

export interface SelectFieldProps {
  value?: string | number;
  onChange?: (value: string | number) => void;
  disabled?: boolean;
  options?: SelectFieldOption[];
  placeholder?: string;
}

export const SelectField: React.FC<SelectFieldProps> = (props) => {
  const value = props.value == null ? "" : String(props.value);
  return (
    <Select
      value={value}
      onValueChange={(v) => props.onChange?.(v)}
      disabled={props.disabled}
    >
      <SelectTrigger className="border-slate-200" data-testid="formily-select-trigger">
        <SelectValue placeholder={props.placeholder || "请选择..."} />
      </SelectTrigger>
      <SelectContent>
        {(props.options ?? []).map((o) => (
          <SelectItem key={String(o.value)} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/* ───────────────────────── LookupField (复用 LookupDropdown) ───────────────────────── */

export interface LookupFieldProps {
  value?: string | number;
  onChange?: (value: string | number) => void;
  disabled?: boolean;
  /** 目标对象 ID */
  objectId: string | number;
  /** displayField */
  displayField: string;
  placeholder?: string;
  /** 注入的 options (由 SchemaField 父层 useFormEffects 加载) */
  options?: LookupOption[];
  loading?: boolean;
}

export const LookupField: React.FC<LookupFieldProps> = (props) => {
  return (
    <LookupDropdown
      config={{
        field: String(props.objectId), // 占位, 实际 fieldKey 由 schema 提供
        label: "",
        required: false,
        objectId: props.objectId,
        displayField: props.displayField,
        placeholder: props.placeholder,
        value: props.value,
        onChange: (v) => props.onChange?.(v),
        editable: !props.disabled,
      }}
      options={props.options ?? []}
      loading={!!props.loading}
    />
  );
};

/* ───────────────────────── 组件注册表 ───────────────────────── */

/** v1.0.2 Sprint 2 F1.5+: 注册 Formily 组件 */
/**
 * 通过 @formily/react connect / mapProps 把受控 props 接好.
 * 这些是预绑定版本, 直接给 SchemaField 用.
 */
export const FormilyComponents = {
  FormItem,
  TextField: connect(TextField, mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
    readOnly: field?.readOnly ?? props.readOnly,
    placeholder: field?.placeholder ?? props.placeholder,
  }))),
  TextareaField: connect(TextareaField, mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
    placeholder: field?.placeholder ?? props.placeholder,
    rows: props.rows,
  }))),
  NumberField: connect(NumberField, mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
    placeholder: field?.placeholder ?? props.placeholder,
  }))),
  DateField: connect(DateField, mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
    type: props.type,
  }))),
  CheckboxField: connect(CheckboxField, mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
  }))),
  SelectField: connect(SelectField, mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
    options: props.options ?? field?.dataSource ?? [],
    placeholder: props.placeholder,
  }))),
  LookupField: connect(LookupField, mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
    objectId: props.objectId,
    displayField: props.displayField,
    placeholder: props.placeholder,
    options: props.options ?? field?.dataSource ?? [],
    loading: field?.loading ?? props.loading,
  }))),
} as const;

export type FormilyComponentName = keyof typeof FormilyComponents;