import React, { useMemo } from "react";
import { KanbanConfig } from "../types/schema";

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
    <div className="mp-kanban">
      {columns.map((col) => {
        const cards = grouped[col.statusKey] ?? [];
        return (
          <div key={col.id} className="mp-kanban-column">
            <div
              className="mp-kanban-column-header"
              style={{ borderTopColor: col.color ?? "#4a90d9" }}
            >
              <span className="mp-kanban-column-title">{col.title}</span>
              <span className="mp-kanban-column-count">{cards.length}</span>
            </div>
            <div className="mp-kanban-column-body">
              {cards.length === 0 && (
                <div className="mp-kanban-empty">暂无记录</div>
              )}
              {cards.map((card, idx) => (
                <div
                  key={(card["id"] as string) ?? idx}
                  className="mp-kanban-card"
                >
                  <div className="mp-kanban-card-title">
                    {String(card[cardTitleField] ?? "未命名")}
                  </div>
                  {cardFields.length > 0 && (
                    <div className="mp-kanban-card-fields">
                      {cardFields.map((f) => (
                        <div key={f} className="mp-kanban-card-field">
                          <span className="mp-kanban-card-field-name">{f}: </span>
                          <span>{card[f] != null ? String(card[f]) : "--"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanRenderer;
