import React, { useCallback, useMemo, useState } from "react";
import { TableConfig } from "../types/schema";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TableRendererProps {
  config: TableConfig;
  data?: Record<string, unknown>[];
}

type SortDir = "asc" | "desc" | null;

/**
 * Renders a TABLE section with sortable column headers and client-side pagination.
 */
const TableRenderer: React.FC<TableRendererProps> = ({ config, data = [] }) => {
  const { columns, pagination = false, pageSize = 20 } = config;

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);

  // ---- sorting ----
  const handleSort = useCallback(
    (field: string, sortable?: boolean) => {
      if (!sortable) return;
      if (sortField === field) {
        // cycle: asc -> desc -> none
        setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
        if (sortDir === "desc") setSortField(null);
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField, sortDir],
  );

  const sorted = useMemo(() => {
    if (!sortField || !sortDir) return data;
    const col = columns.find((c) => c.field === sortField);
    return [...data].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (col?.type === "number") {
        cmp = Number(av) - Number(bv);
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortField, sortDir, columns]);

  // ---- pagination ----
  const total = sorted.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const paged = pagination ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  // ---- cell renderer ----
  const renderCell = (row: Record<string, unknown>, field: string, type: string) => {
    const v = row[field];
    if (v == null || v === "") return <span className="text-muted-foreground">--</span>;
    switch (type) {
      case "boolean":
        return v ? "\u662F" : "\u5426";
      case "link":
        return (
          <a href={String(v)} target="_blank" rel="noreferrer" className="text-primary underline">
            {String(v)}
          </a>
        );
      default:
        return String(v);
    }
  };

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.field}
                style={{ textAlign: col.align ?? "left", width: col.width }}
                className={cn(col.sortable && "cursor-pointer select-none hover:text-foreground")}
                onClick={() => handleSort(col.field, col.sortable)}
              >
                {col.title || col.field}
                {col.sortable && sortField === col.field && (
                  <span className="ml-1 text-xs">
                    {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                  </span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            paged.map((row, idx) => (
              <TableRow key={(row["id"] as string) ?? idx}>
                {columns.map((col) => (
                  <TableCell key={col.field} style={{ textAlign: col.align ?? "left" }}>
                    {renderCell(row, col.field, col.type)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between py-3 px-2 text-sm text-muted-foreground">
          <span>
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableRenderer;
