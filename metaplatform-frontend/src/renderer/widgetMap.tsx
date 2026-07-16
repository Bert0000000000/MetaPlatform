import { ComponentType } from "react";
import { FieldSchema } from "../types/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch as SwitchUi } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Maps widget type strings to the native HTML element component or a
 * lightweight wrapper that FieldWidget delegates to.
 *
 * Every entry receives the full FieldSchema plus `value` and `onChange`.
 *
 * Visual style follows MetaPlatform compact design system:
 * - Inputs: bg-secondary, 1px border, 4px radius, 12px font, 6/8px padding
 * - Selects/radios/checkboxes: minimal, border-only
 * - Layout widgets: neutral separators and headings
 */

export interface WidgetProps {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

// ---------- shared classes ----------

const inputBase =
  "h-9 w-full min-w-0 rounded-md border border-input bg-secondary px-2.5 py-1.5 text-sm text-foreground shadow-none transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const selectClasses =
  "h-9 w-full rounded-md border border-input bg-secondary px-2.5 py-1.5 text-sm text-foreground shadow-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

// ---------- basic widgets ----------

const InputWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    className={inputBase}
    placeholder={field.placeholder}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const TextareaWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <Textarea
    placeholder={field.placeholder}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
    rows={field.rows ?? 4}
    className="min-h-[60px] resize-y rounded-md border border-input bg-secondary px-2.5 py-2 text-sm shadow-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 disabled:opacity-50"
  />
);

const NumberWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    type="number"
    className={inputBase}
    placeholder={field.placeholder}
    value={value == null ? "" : String(Number(value))}
    onChange={(e) =>
      onChange(e.target.value === "" ? null : Number(e.target.value))
    }
    disabled={!field.editable}
    min={field.min}
    max={field.max}
    step={field.precision ? 1 / Math.pow(10, field.precision) : 1}
  />
);

const SelectWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <select
    className={selectClasses}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
    multiple={field.multiple}
  >
    {!field.multiple && (
      <option value="">{field.placeholder ?? "-- 请选择 --"}</option>
    )}
    {(field.options ?? []).map((opt) => (
      <option key={String(opt.value)} value={String(opt.value)}>
        {opt.label}
      </option>
    ))}
  </select>
);

const RadioWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="flex flex-wrap gap-4 pt-1">
    {(field.options ?? []).map((opt) => (
      <label
        key={String(opt.value)}
        className={cn(
          "flex items-center gap-2 text-sm text-foreground",
          !field.editable && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          type="radio"
          name={field.key || field.field}
          checked={String(value) === String(opt.value)}
          onChange={() => onChange(opt.value)}
          disabled={!field.editable}
          className="h-4 w-4 border-input text-primary focus:ring-primary/30"
        />
        {opt.label}
      </label>
    ))}
  </div>
);

const CheckboxWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => {
  const arr: string[] = Array.isArray(value) ? value : [];
  const toggle = (v: string) => {
    if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
    else onChange([...arr, v]);
  };
  return (
    <div className="flex flex-wrap gap-4 pt-1">
      {(field.options ?? []).map((opt) => (
        <label
          key={String(opt.value)}
          className={cn(
            "flex items-center gap-2 text-sm text-foreground",
            !field.editable && "cursor-not-allowed opacity-50",
          )}
        >
          <input
            type="checkbox"
            checked={arr.includes(String(opt.value))}
            onChange={() => toggle(String(opt.value))}
            disabled={!field.editable}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary/30"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
};

const SwitchWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="pt-1">
    <SwitchUi
      checked={Boolean(value)}
      onCheckedChange={(v) => onChange(v)}
      disabled={!field.editable}
    />
  </div>
);

const DatepickerWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <input
    type="date"
    className={inputBase}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const DatetimeWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <input
    type="datetime-local"
    className={inputBase}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const EmailWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <input
    type="email"
    className={inputBase}
    placeholder={field.placeholder ?? "email@example.com"}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const PhoneWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <input
    type="tel"
    className={inputBase}
    placeholder={field.placeholder ?? "+86 ..."}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const UrlWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <input
    type="url"
    className={inputBase}
    placeholder={field.placeholder ?? "https://..."}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const RateWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => {
  const current = Number(value ?? 0);
  return (
    <div className="flex gap-1 pt-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "text-lg transition-colors",
            n <= current ? "text-primary" : "text-input",
            !field.editable && "cursor-not-allowed opacity-50",
          )}
          onClick={() => field.editable && onChange(n)}
          role="button"
          aria-label={`${n} star`}
        >
          &#9733;
        </span>
      ))}
    </div>
  );
};

// ---------- advanced widgets ----------

const RichtextWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="rounded-md border border-input bg-secondary">
    <div className="flex gap-2 border-b border-input px-2.5 py-1.5 text-xs text-muted-foreground">
      <span className="px-1 font-bold">B</span>
      <span className="px-1 italic">I</span>
      <span className="px-1 underline">U</span>
      <span className="px-1">H1</span>
      <span className="px-1">H2</span>
      <span>· list</span>
      <span>1. list</span>
      <span>link</span>
    </div>
    <Textarea
      placeholder={field.placeholder ?? "请输入富文本内容"}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      disabled={!field.editable}
      rows={field.rows ?? 6}
      className="min-h-[80px] resize-y border-0 bg-transparent px-2.5 py-2 text-sm shadow-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:opacity-50"
    />
  </div>
);

const FileWidget: ComponentType<WidgetProps> = ({ field }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-secondary px-4 py-6 text-xs text-muted-foreground",
      !field.editable && "opacity-50",
    )}
  >
    <span className="text-lg">📎</span>
    <span>点击或拖拽文件到此处上传</span>
    {field.multiple && <span className="text-xs">支持多文件上传</span>}
    {field.maxFileSize && (
      <span className="text-xs">单个文件最大 {field.maxFileSize}MB</span>
    )}
  </div>
);

const ImageWidget: ComponentType<WidgetProps> = ({ field, value }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-secondary px-4 py-6 text-xs text-muted-foreground",
      !field.editable && "opacity-50",
    )}
  >
    {value ? (
      <img
        src={String(value)}
        alt="preview"
        className="max-h-32 rounded object-contain"
      />
    ) : (
      <>
        <span className="text-lg">🖼️</span>
        <span>点击或拖拽图片到此处上传</span>
        {field.maxFileSize && (
          <span className="text-xs">最大 {field.maxFileSize}MB</span>
        )}
      </>
    )}
  </div>
);

const SignatureWidget: ComponentType<WidgetProps> = ({ field }) => (
  <div
    className={cn(
      "flex items-center justify-center rounded-md border border-dashed border-input bg-secondary px-4 py-10 text-xs text-muted-foreground",
      !field.editable && "opacity-50",
    )}
  >
    <span className="mr-1.5 text-base">✍️</span>
    点击此处手写签名
  </div>
);

const LocationWidget: ComponentType<WidgetProps> = ({ field, value }) => (
  <div className="flex items-center gap-2">
    <input
      className={cn(inputBase, "cursor-default")}
      placeholder="点击获取当前位置"
      value={String(value ?? "")}
      readOnly
      disabled={!field.editable}
    />
    <button
      type="button"
      className="shrink-0 rounded-md border border-input bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
      disabled={!field.editable}
    >
      📍 定位
    </button>
  </div>
);

const ColorWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={String(value ?? "#3B82F6")}
      onChange={(e) => onChange(e.target.value)}
      disabled={!field.editable}
      className="h-9 w-16 cursor-pointer rounded-md border border-input bg-transparent"
    />
    <input
      className={inputBase}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      disabled={!field.editable}
    />
  </div>
);

const SliderWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="flex items-center gap-3 pt-2">
    <input
      type="range"
      min={field.min ?? 0}
      max={field.max ?? 100}
      value={Number(value ?? 0)}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={!field.editable}
      className="flex-1 accent-primary"
    />
    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
      {Number(value ?? 0)}
    </span>
  </div>
);

// ---------- business widgets ----------

const CurrencyWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="relative">
    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
      ¥
    </span>
    <input
      type="number"
      className={cn(inputBase, "pl-6")}
      placeholder={field.placeholder ?? "0.00"}
      value={value == null ? "" : String(Number(value).toFixed(field.precision ?? 2))}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
      disabled={!field.editable}
      step={field.precision ? 1 / Math.pow(10, field.precision) : 0.01}
    />
  </div>
);

const PercentWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="relative">
    <input
      type="number"
      className={cn(inputBase, "pr-7")}
      placeholder={field.placeholder ?? "0"}
      value={value == null ? "" : String(Number(value))}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
      disabled={!field.editable}
      min={field.min ?? 0}
      max={field.max ?? 100}
      step={field.precision ? 1 / Math.pow(10, field.precision) : 1}
    />
    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
      %
    </span>
  </div>
);

const ReferenceWidget: ComponentType<WidgetProps> = ({
  field,
  value,
  onChange,
}) => (
  <div className="flex items-center gap-2">
    <input
      className={cn(inputBase, "cursor-default")}
      placeholder="选择关联记录..."
      value={String(value ?? "")}
      readOnly
      disabled={!field.editable}
    />
    <button
      type="button"
      className="shrink-0 rounded-md border border-input bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
      disabled={!field.editable}
    >
      选择
    </button>
  </div>
);

const FormulaWidget: ComponentType<WidgetProps> = ({ field, value }) => (
  <input
    className={cn(inputBase, "bg-muted text-muted-foreground")}
    value={String(value ?? "")}
    readOnly
    placeholder="自动计算"
    disabled
  />
);

// ---------- layout widgets ----------

const DividerWidget: ComponentType<WidgetProps> = ({ field }) =>
  field.text ? (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{field.text}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  ) : (
    <hr className="border-border" />
  );

const HeadingWidget: ComponentType<WidgetProps> = ({ field }) => (
  <p className="text-sm font-medium text-foreground">
    {field.text || field.label}
  </p>
);

// ---------- registry ----------

const widgetMap: Record<string, ComponentType<WidgetProps>> = {
  // basic
  input: InputWidget,
  textarea: TextareaWidget,
  number: NumberWidget,
  select: SelectWidget,
  radio: RadioWidget,
  checkbox: CheckboxWidget,
  switch: SwitchWidget,
  datepicker: DatepickerWidget,
  datetime: DatetimeWidget,
  // advanced
  email: EmailWidget,
  phone: PhoneWidget,
  url: UrlWidget,
  rate: RateWidget,
  richtext: RichtextWidget,
  file: FileWidget,
  image: ImageWidget,
  signature: SignatureWidget,
  location: LocationWidget,
  color: ColorWidget,
  slider: SliderWidget,
  // business
  currency: CurrencyWidget,
  percent: PercentWidget,
  reference: ReferenceWidget,
  formula: FormulaWidget,
  // layout
  divider: DividerWidget,
  heading: HeadingWidget,
};

export default widgetMap;
