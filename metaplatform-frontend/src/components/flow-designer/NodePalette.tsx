/**
 * NodePalette - Left sidebar with draggable BPMN node types.
 * Groups nodes by category and supports drag-and-drop to canvas.
 */
import { useCallback, type DragEvent } from "react";
import { bpmnNodeTypeRegistry, type BpmnNodeTypeMeta } from "./BpmnNodes";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

// Group by category
function groupByCategory(items: BpmnNodeTypeMeta[]): Map<string, BpmnNodeTypeMeta[]> {
  const map = new Map<string, BpmnNodeTypeMeta[]>();
  for (const item of items) {
    const existing = map.get(item.category) || [];
    existing.push(item);
    map.set(item.category, existing);
  }
  return map;
}

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
  Events: "Events",
  Tasks: "Tasks",
  Gateways: "Gateways",
  Subprocess: "Subprocesses",
  Artifacts: "Artifacts",
};

export function NodePalette() {
  const grouped = groupByCategory(bpmnNodeTypeRegistry);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Events: true,
    Tasks: true,
    Gateways: true,
    Subprocess: true,
    Artifacts: true,
  });

  const toggleCategory = useCallback((cat: string) => {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const onDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, nodeType: string, defaultData: Record<string, unknown>) => {
      event.dataTransfer.setData("application/bpmn-node-type", nodeType);
      event.dataTransfer.setData("application/bpmn-node-data", JSON.stringify(defaultData));
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <h3 className="text-sm font-semibold text-foreground">Node Palette</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Drag elements to the canvas
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <button
              className="flex items-center gap-1 w-full px-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => toggleCategory(category)}
            >
              {expanded[category] ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              {CATEGORY_LABELS[category] || category}
            </button>
            {expanded[category] && (
              <div className="space-y-1 pb-2">
                {items.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, item.type, item.defaultData)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded border border-transparent hover:border-border hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-all group"
                      title={item.label}
                    >
                      <div
                        className="flex items-center justify-center rounded size-6 shrink-0 transition-colors"
                        style={{
                          background: `${item.color}18`,
                          border: `1px solid ${item.borderColor}`,
                        }}
                      >
                        <Icon className="size-3.5" style={{ color: item.color }} />
                      </div>
                      <span className="text-xs text-foreground group-hover:text-foreground">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
