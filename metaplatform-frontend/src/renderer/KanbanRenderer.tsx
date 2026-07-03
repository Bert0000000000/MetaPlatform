import React, { useMemo } from "react";
import { KanbanConfig } from "../types/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface KanbanRendererProps {
  config: KanbanConfig;
  data?: Record<string, unknown>[];
}

/**
 * Renders a KANBAN section with columns grouped by statusField.
 * Cards are placed into columns matching their statusKey.
 */
const KanbanRenderer: React.FC<KanbanRendererProps> = ({ config, data = [] }) => {
  const { columns, cardTitleField, cardFields = [], statusField } = config;

  // Group cards by status column
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    for (const col of columns) {
      map[col.statusKey] = [];
    }
    for (const item of data) {
      const key = String(item[statusField] ?? "");
      if (map[key]) {
        map[key].push(item);
      } else {
        // put unmatched items into first column as fallback
        if (columns.length > 0) {
          map[columns[0].statusKey].push(item);
        }
      }
    }
    return map;
  }, [columns, data, statusField]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
      {columns.map((col) => {
        const cards = grouped[col.statusKey] ?? [];
        return (
          <div key={col.id} className="space-y-3">
            <div
              className="flex items-center justify-between rounded-t-lg border-t-2 p-3 bg-muted/50"
              style={{ borderTopColor: col.color ?? "#4a90d9" }}
            >
              <span className="text-sm font-semibold">{col.title}</span>
              <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {cards.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  \u6682\u65E0\u8BB0\u5F55
                </div>
              )}
              {cards.map((card, idx) => (
                <Card key={(card["id"] as string) ?? idx}>
                  <CardContent className="p-3 space-y-2">
                    <div className="font-medium text-sm">
                      {String(card[cardTitleField] ?? "\u672A\u547D\u540D")}
                    </div>
                    {cardFields.length > 0 && (
                      <div className="space-y-1">
                        {cardFields.map((f) => (
                          <div key={f} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{f}: </span>
                            <span>{card[f] != null ? String(card[f]) : "--"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanRenderer;
