/**
 * FilterRow.tsx — v1.0.2 Sprint 2 F1.7+ Formily 化过滤器单行.
 *
 * <p>由 ListPageEditor 在过滤器 FormProvider 内循环渲染, 每行一个字段.
 * <p>Formily components: FilterOpSelect (9 种操作符) + FilterValueInput (随 op 变化).
 * <p>通过 x-reactions 实现: op=empty 时 value 字段隐藏.
 */
import * as React from "react";
import { connect, mapProps } from "@formily/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * v1.0.2 Sprint 2 F1.7+: 9 种操作符 UI 标签.
 *
 * <p>与后端 FilterParser 对应 (B1.4):
 * <ul>
 *   <li>eq / neq / gt / gte / lt / lte / contains / empty / in</li>
 * </ul>
 */
export const FILTER_OPS = [
  { value: "eq",       label: "等于",       placeholder: "输入值",     numeric: false, takesValue: true },
  { value: "neq",      label: "不等于",     placeholder: "输入值",     numeric: false, takesValue: true },
  { value: "gt",       label: "大于",       placeholder: "输入数字",   numeric: true,  takesValue: true },
  { value: "gte",      label: "≥",          placeholder: "输入数字",   numeric: true,  takesValue: true },
  { value: "lt",       label: "<",          placeholder: "输入数字",   numeric: true,  takesValue: true },
  { value: "lte",      label: "≤",          placeholder: "输入数字",   numeric: true,  takesValue: true },
  { value: "contains", label: "包含",       placeholder: "输入子串",   numeric: false, takesValue: true },
  { value: "empty",    label: "为空",       placeholder: "",            numeric: false, takesValue: false },
  { value: "in",       label: "在列表中",   placeholder: "a,b,c",      numeric: false, takesValue: true },
] as const;

export type FilterOp = typeof FILTER_OPS[number]["value"];

/**
 * v1.0.2 Sprint 2 F1.7+: 单个过滤器行, Formily 化.
 *
 * <p>组件绑定:
 * <ul>
 *   <li>op:        FilterOpSelect</li>
 *   <li>value:     FilterValueInput (x-reactions 控制 visible)</li>
 *   <li>field:     字段名 (隐藏, 由 SchemaField schema.properties 提供)</li>
 * </ul>
 */
export interface FilterRowProps {
  /** 字段名 (column) */
  field?: string;
  /** 操作符 */
  op?: FilterOp;
  /** 值 */
  value?: string;
  /** 删除该过滤器 */
  onRemove?: () => void;
  /** 字段 UI 标签 */
  fieldLabel?: string;
}

/**
 * op select 组件.
 */
const FilterOpSelectInner: React.FC<{
  value?: FilterOp;
  onChange?: (v: FilterOp) => void;
}> = (props) => {
  return (
    <Select
      value={props.value ?? "eq"}
      onValueChange={(v) => props.onChange?.(v as FilterOp)}
    >
      <SelectTrigger className="border-slate-200 w-[120px]" data-testid="filter-op-trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FILTER_OPS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
export const FilterOpSelect = connect(
  FilterOpSelectInner,
  mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
  })),
);

/**
 * value input 组件, op=empty 时显示空提示.
 */
const FilterValueInputInner: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  op?: FilterOp;
}> = ({ value, onChange, op }) => {
  const opMeta = FILTER_OPS.find((o) => o.value === op);
  const placeholder = opMeta?.placeholder ?? "输入值";
  const isNumeric = opMeta?.numeric ?? false;
  return (
    <Input
      type={isNumeric ? "number" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
      data-testid="filter-value-input"
    />
  );
};
export const FilterValueInput = connect(
  FilterValueInputInner,
  mapProps((props: any, field: any) => ({
    value: props.value,
    onChange: field?.setValue,
    op: props.op,
  })),
);

/**
 * FilterRow 行容器. 负责 layout + 标题 + 删除按钮.
 */
export const FilterRow: React.FC<FilterRowProps> = ({
  field,
  op,
  value,
  onRemove,
  fieldLabel,
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded border border-slate-200 bg-white",
      )}
      data-testid={`filter-row-${field}`}
    >
      <div className="text-sm font-medium text-slate-700 min-w-[100px] truncate">
        {fieldLabel || field}
      </div>
      <FilterOpSelect value={op} />
      {/* value 字段: 由 Formily x-reactions 控制 visible */}
      {op !== "empty" && (
        <div className="flex-1">
          <FilterValueInput value={value} op={op} />
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        data-testid={`filter-remove-${field}`}
        className="text-slate-400 hover:text-rose-600"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
};