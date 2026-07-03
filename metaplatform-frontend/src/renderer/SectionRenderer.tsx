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
 * - FORM: grid of FieldWidgets
 * - TABLE: TableRenderer
 * - KANBAN: KanbanRenderer
 * - CARD: simple card container (shows title + children info)
 */
const SectionRenderer: React.FC<SectionRendererProps> = ({
  section,
  formData = {},
  tableData = [],
  kanbanData = [],
  onFieldChange,
}) => {
  const columns = section.columns ?? 2;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">{section.title}</h3>

      {(section.type === "FORM" || section.type === "FIELD_GROUP") && section.fields && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
          }}
        >
          {section.fields
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((f) => (
              <FieldWidget
                key={f.field}
                field={f}
                value={formData[f.field]}
                onChange={(field, value) => onFieldChange?.(field, value)}
              />
            ))}
        </div>
      )}

      {section.type === "TABLE" && section.table && (
        <TableRenderer config={section.table} data={tableData} />
      )}

      {section.type === "KANBAN" && section.kanban && (
        <KanbanRenderer config={section.kanban} data={kanbanData} />
      )}

      {section.type === "CARD" && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Card section: {section.title}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SectionRenderer;
