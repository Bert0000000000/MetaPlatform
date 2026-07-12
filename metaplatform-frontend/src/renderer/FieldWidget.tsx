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

/** Width -> colSpan (out of 12) for 12-col grid, or raw span for N-col grid */
const WIDTH_SPAN: Record<string, number> = {
  full: 12,
  half: 6,
  third: 4,
  quarter: 3,
};

/**
 * Renders a single field widget based on `field.widget`.
 * Falls back to a plain text input when the widget type is unknown.
 *
 * Supports both the legacy `field` / `colSpan` properties and the
 * low-code designer's `key` / `width` properties.
 *
 * Visual style follows MetaPlatform compact design system:
 * - Label: 12px, medium weight, secondary color, 4px gap to input
 * - Required mark: destructive color
 */
const FieldWidget: React.FC<FieldWidgetProps> = ({ field, value, onChange }) => {
  if (field.visible === false) return null;

  const fieldKey = field.key || field.field || field.label;
  const span = field.colSpan ?? (field.width ? WIDTH_SPAN[field.width] ?? 1 : 1);

  // Layout widgets (divider / heading) render without a label wrapper
  if (field.widget === "divider" || field.widget === "heading") {
    const WidgetComponent = widgetMap[field.widget];
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        {WidgetComponent ? (
          <WidgetComponent
            field={field}
            value={value}
            onChange={(v) => onChange(fieldKey, v)}
          />
        ) : null}
      </div>
    );
  }

  const WidgetComponent = widgetMap[field.widget];

  return (
    <div className="flex flex-col gap-1" style={{ gridColumn: `span ${span}` }}>
      <Label className="text-xs font-medium text-muted-foreground">
        {field.label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {WidgetComponent ? (
        <WidgetComponent
          field={field}
          value={value}
          onChange={(v) => onChange(fieldKey, v)}
        />
      ) : (
        <Input
          type="text"
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          disabled={!field.editable}
        />
      )}
    </div>
  );
};

export default FieldWidget;
