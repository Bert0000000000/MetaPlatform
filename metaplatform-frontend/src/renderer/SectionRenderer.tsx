import React from "react";
import { SectionSchema } from "../types/schema";
import FieldWidget from "./FieldWidget";
import TableRenderer from "./TableRenderer";
import KanbanRenderer from "./KanbanRenderer";

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
    <div className="mp-section">
      <h3 className="mp-section-title">{section.title}</h3>

      {(section.type === "FORM" || section.type === "FIELD_GROUP") && section.fields && (
        <div
          className="mp-form-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
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
        <div className="mp-card-placeholder">
          <p>Card section: {section.title}</p>
        </div>
      )}
    </div>
  );
};

export default SectionRenderer;
