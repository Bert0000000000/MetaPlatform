/**
 * Schema Preview
 *
 * Wraps the runtime SchemaRenderer to render a live preview of the
 * designer state. Converts DesignerState -> PageRender on the fly.
 *
 * Visual style is aligned with the MetaPlatform compact design system:
 * - Small radius (6px max)
 * - Border-only surfaces (no heavy shadows)
 * - Compact typography and spacing
 */

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SchemaRenderer from "@/renderer/SchemaRenderer";
import { DesignerState } from "./DesignerTypes";
import { designerToPageRender } from "./schemaConverter";

interface SchemaPreviewProps {
  state: DesignerState;
}

export const SchemaPreview: React.FC<SchemaPreviewProps> = ({ state }) => {
  const schema = useMemo(() => designerToPageRender(state), [state]);

  return (
    <div className="bg-bg-secondary flex min-h-full justify-center p-6">
      <Card className="w-full max-w-4xl border border-border bg-card">
        {state.pageName && (
          <CardHeader className="border-b px-5 py-3">
            <CardTitle className="text-base font-semibold tracking-normal text-foreground">
              {state.pageName}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-5">
          <SchemaRenderer schema={schema} />
        </CardContent>
      </Card>
    </div>
  );
};

export default SchemaPreview;
