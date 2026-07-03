import React, { useState } from "react";
import { PageRender } from "../types/schema";
import SectionRenderer from "./SectionRenderer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
      ? "grid grid-cols-1 md:grid-cols-2"
      : schema.layout?.type === "THREE_COLUMN"
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        : "grid grid-cols-1";

  const gutter = schema.layout?.gutter ?? 16;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{schema.displayName || schema.name}</h2>
        <Badge variant="secondary">{schema.pageType}</Badge>
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
