import React, { useState } from "react";
import { PageRender } from "../types/schema";
import SectionRenderer from "./SectionRenderer";

interface SchemaRendererProps {
  schema: PageRender;
  /** Optional pre-populated form data (keyed by field name). */
  initialData?: Record<string, unknown>;
  /** Optional table rows for TABLE sections. */
  tableData?: Record<string, unknown>[];
  /** Optional kanban cards for KANBAN sections. */
  kanbanData?: Record<string, unknown>[];
}

/**
 * SchemaRenderer -- the core entry point.
 *
 * Receives a PageRender JSON (from /api/v1/pages/{id}/render) and
 * declaratively renders the entire page including layout and sections.
 */
const SchemaRenderer: React.FC<SchemaRendererProps> = ({
  schema,
  initialData = {},
  tableData = [],
  kanbanData = [],
}) => {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const layoutClass =
    schema.layout?.type === "TWO_COLUMN"
      ? "mp-layout-two-col"
      : schema.layout?.type === "THREE_COLUMN"
        ? "mp-layout-three-col"
        : "mp-layout-single-col";

  const gutter = schema.layout?.gutter ?? 16;

  return (
    <div className="mp-schema-renderer">
      <header className="mp-page-header">
        <h2>{schema.displayName || schema.name}</h2>
        <span className="mp-page-type-badge">{schema.pageType}</span>
      </header>

      <div className={layoutClass} style={{ gap: gutter }}>
        {schema.sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            formData={formData}
            tableData={tableData}
            kanbanData={kanbanData}
            onFieldChange={handleFieldChange}
          />
        ))}
      </div>
    </div>
  );
};

export default SchemaRenderer;
