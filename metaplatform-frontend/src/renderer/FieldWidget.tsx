import React from "react";
import { FieldSchema } from "../types/schema";
import widgetMap from "./widgetMap";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
      className="space-y-1.5"
      style={{ gridColumn: `span ${field.colSpan ?? 1}` }}
    >
      <Label className="text-sm">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {WidgetComponent ? (
        <WidgetComponent
          field={field}
          value={value}
          onChange={(v) => onChange(field.field, v)}
        />
      ) : (
        <Input
          type="text"
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
