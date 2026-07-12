import React from "react";
import { SectionSchema } from "../types/schema";
import FieldWidget from "./FieldWidget";
import TableRenderer from "./TableRenderer";
import KanbanRenderer from "./KanbanRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SectionRendererProps {
  section: SectionSchema;
  formData?: Record<string, unknown>;
  tableData?: Record<string, unknown>[];
  kanbanData?: Record<string, unknown>[];
  onFieldChange?: (field: string, value: unknown) => void;
}

/**
 * Renders a single section based on its type.
 * - FORM: grid of FieldWidgets (12-column grid, width-aware)
 * - TABLE: TableRenderer
 * - KANBAN: KanbanRenderer
 * - CARD: simple card container
 *
 * Style follows MetaPlatform compact design system:
 * - border-only card, 6px radius, 12px padding
 * - section title: 12px semibold uppercase secondary text with 0.05em tracking
 * - fields stacked in a compact 12-col grid
 */
const SectionRenderer: React.FC<SectionRendererProps> = ({
  section,
  formData = {},
  tableData = [],
  kanbanData = [],
  onFieldChange,
}) => {
  return (
    <Card className="border border-border bg-card">
      <CardHeader className="border-b px-4 py-2.5">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {section.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {(section.type === "FORM" || section.type === "FIELD_GROUP") &&
          section.fields && (
            <div
              className="grid gap-x-4 gap-y-4"
              style={{ gridTemplateColumns: "repeat(12, 1fr)" }}
            >
              {section.fields
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((f, idx) => {
                  const fieldKey = f.key || f.field || f.label;

                  return (
                    <FieldWidget
                      key={fieldKey || idx}
                      field={f}
                      value={formData[fieldKey]}
                      onChange={(field, value) => onFieldChange?.(field, value)}
                    />
                  );
                })}
            </div>
          )}

        {section.type === "TABLE" && section.table && (
          <TableRenderer config={section.table} data={tableData} />
        )}

        {section.type === "KANBAN" && section.kanban && (
          <KanbanRenderer config={section.kanban} data={kanbanData} />
        )}

        {section.type === "CARD" && (
          <p className="text-sm text-muted-foreground">
            Card section: {section.title}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SectionRenderer;
