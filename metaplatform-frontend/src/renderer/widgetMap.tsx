import { ComponentType } from "react";
import { FieldSchema } from "../types/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Maps widget type strings to the native HTML element component or a
 * lightweight wrapper that FieldWidget delegates to.
 *
 * Every entry receives the full FieldSchema plus `value` and `onChange`.
 */

export interface WidgetProps {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

// ---------- native widget wrappers ----------

const selectClasses = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const InputWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <Input
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
    rows={4}
  />
);

const NumberWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <Input
    type="number"
    placeholder={field.placeholder}
    value={value == null ? "" : String(Number(value))}
    onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    disabled={!field.editable}
  />
);

const SelectWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <select
    className={selectClasses}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  >
    <option value="">{field.placeholder ?? "-- \u8BF7\u9009\u62E9 --"}</option>
    {(field.options ?? []).map((opt) => (
      <option key={String(opt.value)} value={String(opt.value)}>
        {opt.label}
      </option>
    ))}
  </select>
);

const DatepickerWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <Input
    type="date"
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const SwitchWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-gray-300"
      checked={Boolean(value)}
      onChange={(e) => onChange(e.target.checked)}
      disabled={!field.editable}
    />
  </label>
);

const EmailWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <Input
    type="email"
    placeholder={field.placeholder ?? "email@example.com"}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const PhoneWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <Input
    type="tel"
    placeholder={field.placeholder ?? "+86 ..."}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const UrlWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <Input
    type="url"
    placeholder={field.placeholder ?? "https://..."}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const RateWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => {
  const current = Number(value ?? 0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "text-2xl cursor-pointer transition-colors",
            n <= current ? "text-yellow-400" : "text-gray-300",
            !field.editable && "cursor-not-allowed opacity-50"
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

// ---------- registry ----------

const widgetMap: Record<string, ComponentType<WidgetProps>> = {
  input: InputWidget,
  textarea: TextareaWidget,
  number: NumberWidget,
  select: SelectWidget,
  datepicker: DatepickerWidget,
  switch: SwitchWidget,
  email: EmailWidget,
  phone: PhoneWidget,
  url: UrlWidget,
  rate: RateWidget,
};

export default widgetMap;
