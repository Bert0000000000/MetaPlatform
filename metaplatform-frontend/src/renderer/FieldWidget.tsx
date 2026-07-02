import React from "react";
import { FieldSchema } from "../types/schema";
import widgetMap from "./widgetMap";

interface FieldWidgetProps {
  field: FieldSchema;
  value: unknown;
  onChange: (field: string, value: unknown) => void;
}

/**
 * Renders a single field widget based on `field.widget`.
 * Falls back to a plain text input when the widget type is unknown.
 */
const FieldWidget: React.FC<FieldWidgetProps> = ({ field, value, onChange }) => {
  if (field.visible === false) return null;

  const WidgetComponent = widgetMap[field.widget];

  return (
    <div
      className="mp-field"
      style={{ gridColumn: `span ${field.colSpan ?? 1}` }}
    >
      <label className="mp-field-label">
        {field.label}
        {field.required && <span className="mp-field-required">*</span>}
      </label>
      {WidgetComponent ? (
        <WidgetComponent
          field={field}
          value={value}
          onChange={(v) => onChange(field.field, v)}
        />
      ) : (
        <input
          type="text"
          className="mp-widget-input"
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(field.field, e.target.value)}
          disabled={!field.editable}
        />
      )}
    </div>
  );
};

export default FieldWidget;
