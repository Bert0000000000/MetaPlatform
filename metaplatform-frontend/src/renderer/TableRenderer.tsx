import React, { useCallback, useMemo, useState } from "react";
import { TableConfig } from "../types/schema";

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
    if (v == null || v === "") return <span className="mp-cell-empty">--</span>;
    switch (type) {
      case "boolean":
        return v ? "是" : "否";
      case "link":
        return (
          <a href={String(v)} target="_blank" rel="noreferrer">
            {String(v)}
          </a>
        );
      default:
        return String(v);
    }
  };

  return (
    <div className="mp-table-wrapper">
      <table className="mp-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.field}
                style={{ textAlign: col.align ?? "left", width: col.width }}
                className={col.sortable ? "sortable" : ""}
                onClick={() => handleSort(col.field, col.sortable)}
              >
                {col.title}
                {col.sortable && sortField === col.field && (
                  <span className="mp-sort-indicator">
                    {sortDir === "asc" ? " ▲" : " ▼"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="mp-table-empty">
                暂无数据
              </td>
            </tr>
          ) : (
            paged.map((row, idx) => (
              <tr key={(row["id"] as string) ?? idx}>
                {columns.map((col) => (
                  <td key={col.field} style={{ textAlign: col.align ?? "left" }}>
                    {renderCell(row, col.field, col.type)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pagination && totalPages > 1 && (
        <div className="mp-table-pagination">
          <span className="mp-page-info">
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

export default TableRenderer;
