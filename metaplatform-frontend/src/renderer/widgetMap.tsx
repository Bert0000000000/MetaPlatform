import { ComponentType } from "react";
import { FieldSchema } from "../types/schema";

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

const InputWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    type="text"
    className="mp-widget-input"
    placeholder={field.placeholder}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const TextareaWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <textarea
    className="mp-widget-textarea"
    placeholder={field.placeholder}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
    rows={4}
  />
);

const NumberWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    type="number"
    className="mp-widget-input"
    placeholder={field.placeholder}
    value={value == null ? "" : Number(value)}
    onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    disabled={!field.editable}
  />
);

const SelectWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <select
    className="mp-widget-select"
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  >
    <option value="">{field.placeholder ?? "-- 请选择 --"}</option>
    {(field.options ?? []).map((opt) => (
      <option key={String(opt.value)} value={String(opt.value)}>
        {opt.label}
      </option>
    ))}
  </select>
);

const DatepickerWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    type="date"
    className="mp-widget-input"
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const SwitchWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <label className="mp-widget-switch">
    <input
      type="checkbox"
      checked={Boolean(value)}
      onChange={(e) => onChange(e.target.checked)}
      disabled={!field.editable}
    />
    <span className="mp-widget-switch-label" />
  </label>
);

const EmailWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    type="email"
    className="mp-widget-input"
    placeholder={field.placeholder ?? "email@example.com"}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const PhoneWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    type="tel"
    className="mp-widget-input"
    placeholder={field.placeholder ?? "+86 ..."}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const UrlWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => (
  <input
    type="url"
    className="mp-widget-input"
    placeholder={field.placeholder ?? "https://..."}
    value={String(value ?? "")}
    onChange={(e) => onChange(e.target.value)}
    disabled={!field.editable}
  />
);

const RateWidget: ComponentType<WidgetProps> = ({ field, value, onChange }) => {
  const current = Number(value ?? 0);
  return (
    <div className="mp-widget-rate">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`mp-rate-star ${n <= current ? "active" : ""}`}
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
