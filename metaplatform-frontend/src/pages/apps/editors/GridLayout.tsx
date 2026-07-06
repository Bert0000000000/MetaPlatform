import { useState, ReactNode } from "react";
import { GripVertical } from "lucide-react";

/**
 * Grid column spans:
 * - full: 12 cols (100%)
 * - half: 6 cols (50%)
 * - third: 4 cols (33.3%)
 * - quarter: 3 cols (25%)
 */
export type GridSpan = 12 | 6 | 4 | 3;

export interface GridItem {
  id: string;
  span: GridSpan;
  component: ReactNode;
  label?: string;
}

interface GridLayoutProps {
  items: GridItem[];
  onReorder?: (fromIdx: number, toIdx: number) => void;
  onSpanChange?: (id: string, span: GridSpan) => void;
  onRemove?: (id: string) => void;
  editing?: boolean;
}

export function GridLayout({
  items,
  onReorder,
  onSpanChange,
  onRemove,
  editing = true,
}: GridLayoutProps) {
  // Use CSS grid with 12 columns
  return (
    <div className="grid grid-cols-12 gap-3">
      {items.map((item, idx) => (
        <GridCell
          key={item.id}
          item={item}
          index={idx}
          editing={editing}
          onReorder={onReorder}
          onSpanChange={onSpanChange}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function GridCell({
  item,
  index,
  editing,
  onReorder,
  onSpanChange,
  onRemove,
}: {
  item: GridItem;
  index: number;
  editing: boolean;
  onReorder?: (from: number, to: number) => void;
  onSpanChange?: (id: string, span: GridSpan) => void;
  onRemove?: (id: string) => void;
}) {
  const [hovering, setHovering] = useState(false);

  const colSpan =
    item.span === 12
      ? "col-span-12"
      : item.span === 6
        ? "col-span-12 sm:col-span-6"
        : item.span === 4
          ? "col-span-12 sm:col-span-4"
          : "col-span-12 sm:col-span-3";

  if (!editing) {
    return <div className={colSpan}>{item.component}</div>;
  }

  return (
    <div
      className={`${colSpan} relative group border border-dashed border-transparent hover:border-primary/30 rounded-lg transition-colors min-h-[80px]`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Editing toolbar - shows on hover */}
      {hovering && editing && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-background border rounded-md shadow-sm px-1.5 py-0.5">
          <button
            onClick={() => onReorder?.(index, Math.max(0, index - 1))}
            className="p-0.5 hover:bg-muted rounded text-xs"
            title="左移"
          >
            ←
          </button>
          <button
            onClick={() => onReorder?.(index, Math.min(items.length - 1, index + 1))}
            className="p-0.5 hover:bg-muted rounded text-xs"
            title="右移"
          >
            →
          </button>
          <span className="text-[10px] text-muted-foreground px-1">
            {item.span === 12 ? "全行" : item.span === 6 ? "1/2" : item.span === 4 ? "1/3" : "1/4"}
          </span>
          <select
            value={item.span}
            onChange={(e) => onSpanChange?.(item.id, Number(e.target.value) as GridSpan)}
            className="text-[10px] bg-transparent border-none cursor-pointer"
          >
            <option value={12}>全行</option>
            <option value={6}>1/2</option>
            <option value={4}>1/3</option>
            <option value={3}>1/4</option>
          </select>
          <button
            onClick={() => onRemove?.(item.id)}
            className="p-0.5 hover:bg-destructive/20 text-destructive rounded text-xs"
            title="删除"
          >
            ×
          </button>
        </div>
      )}
      {item.component}
    </div>
  );
}

/** Span selector buttons for adding new components — neutral gray style */
export function SpanSelector({ onSelect }: { onSelect: (span: GridSpan) => void }) {
  const options: { span: GridSpan; label: string; width: string }[] = [
    { span: 12, label: "全行", width: "w-full" },
    { span: 6, label: "1/2", width: "w-1/2" },
    { span: 4, label: "1/3", width: "w-1/3" },
    { span: 3, label: "1/4", width: "w-1/4" },
  ];
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.span}
          onClick={() => onSelect(o.span)}
          className="flex flex-col items-center gap-0.5 px-2 py-1 border border-[#d6d4d0] rounded text-[10px] hover:border-[#94a3b8] hover:bg-[#f8f7f5] transition-colors"
        >
          <div className={`${o.width} h-1.5 bg-[#94a3b8]/30 rounded`} />
          <span className="text-[#64748b]">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
