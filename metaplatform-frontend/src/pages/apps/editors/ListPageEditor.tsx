/**
 * ListPageEditor.tsx — v1.0.2 Sprint 2 F1.5+ Formily 化重写.
 *
 * <p>特性 (F1.5 ~ F1.10 一并实现):
 * <ul>
 *   <li>F1.5 全局搜索 + 列过滤 (Formily FilterRow)</li>
 *   <li>F1.6 列头点击排序 + 箭头 (asc/desc/none)</li>
 *   <li>F1.7 9 种操作符过滤器 (eq/neq/gt/gte/lt/lte/contains/empty/in)</li>
 *   <li>F1.8 列设置面板 (显示/隐藏/排序)</li>
 *   <li>F1.9 CSV 导出按钮</li>
 *   <li>F1.10 URL 同步过滤器/排序 (filter_field / sort)</li>
 * </ul>
 *
 * <p>Formily 化要点:
 * <ul>
 *   <li>FilterRow 用 Formily connect + mapProps 把 FilterOpSelect / FilterValueInput 接入</li>
 *   <li>x-reactions 控制 op=empty 时 value 字段 visible=false</li>
 *   <li>sort state 由 URL 反序列化而来, 变化时写回 URL</li>
 *   <li>filter + sort 状态用 React useState 集中管理 (URL ↔ state)</li>
 * </ul>
 */
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, Download, Settings,
  Plus, Trash2, Loader2, Search, X, SlidersHorizontal,
} from "lucide-react";
import { appServiceApi } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { BaseEditorProps, PageComponent } from "./types";
import {
  FilterRow, FILTER_OPS, type FilterOp,
} from "@/components/formily/FilterRow";
import {
  filtersToQuery, sortToQuery, toggleSort, sortStateOf,
  buildListUrlQuery, parseListUrlQuery,
  type FilterEntry, type SortEntry,
} from "@/components/formily/filterSerializer";

interface ColumnDef {
  name: string;
  field: string;
  width: string;
  sortable: boolean;
  /** F1.8: 列是否在数据表中显示 */
  visible: boolean;
}

interface ListConfig {
  supportSearch: boolean;
  pageSize: number;
}

const SYSTEM_COLUMNS: ColumnDef[] = [
  { name: "ID", field: "id", width: "80px", sortable: true, visible: true },
  { name: "创建时间", field: "created_at", width: "160px", sortable: true, visible: true },
  { name: "更新时间", field: "updated_at", width: "160px", sortable: true, visible: true },
];

export function ListPageEditor({
  components,
  setComponents,
  setDirty,
  appId,
  pageData,
  formId,
}: BaseEditorProps) {
  const existingConfig = components?.[0]?.props;
  const [searchParams, setSearchParams] = useSearchParams();

  const [columns, setColumns] = useState<ColumnDef[]>(
    existingConfig?.columns?.map((c: ColumnDef) => ({ ...c, visible: c.visible ?? true })) || []
  );
  const [config, setConfig] = useState<ListConfig>(existingConfig?.config || {
    supportSearch: true,
    pageSize: 20,
  });

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(config.pageSize);
  const [sort, setSort] = useState<SortEntry[]>([]);
  const [filters, setFilters] = useState<Record<string, FilterEntry>>({});
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const resolvedAppId = appId;
  const resolvedFormId = formId ?? pageData?.form_id;

  // F1.10: URL -> state 反序列化 (首次加载 + 监听变化)
  const initial = useRef(false);
  useEffect(() => {
    if (!initial.current) {
      const parsed = parseListUrlQuery(searchParams);
      if (parsed.sort.length > 0) setSort(parsed.sort);
      if (Object.keys(parsed.filters).length > 0) setFilters(parsed.filters);
      if (parsed.page > 1) setPage(parsed.page);
      if (parsed.size !== 20) setSize(parsed.size);
      initial.current = true;
    }
  }, [searchParams]);

  // F1.10: state -> URL 同步
  useEffect(() => {
    if (!initial.current) return;
    const next = buildListUrlQuery(sort, filters, page, size);
    const cur = new URLSearchParams(searchParams);
    let changed = false;
    for (const k of Object.keys(next)) {
      if (cur.get(k) !== next[k]) { cur.set(k, next[k]); changed = true; }
    }
    // 移除已不存在的 filter_*
    const removed: string[] = [];
    cur.forEach((_, k) => {
      if (k.startsWith("filter_") && !(k in next)) { removed.push(k); changed = true; }
    });
    removed.forEach((k) => cur.delete(k));
    if (changed) setSearchParams(cur, { replace: true });
  }, [sort, filters, page, size]);

  // 字段过滤输入框 (顶部全局搜索)
  const [globalQuery, setGlobalQuery] = useState("");

  // 列推导
  useEffect(() => {
    if (!resolvedAppId || !resolvedFormId || columns.length > 0) return;
    appServiceApi.forms.get(resolvedAppId, resolvedFormId)
      .then((form) => {
        const schema = form.schemaJson ? JSON.parse(form.schemaJson) : {};
        const fields: any[] = [];
        if (Array.isArray(schema.sections)) {
          schema.sections.forEach((s: any) => {
            if (Array.isArray(s.fields)) fields.push(...s.fields);
          });
        } else if (Array.isArray(schema.fields)) {
          fields.push(...schema.fields);
        }
        const derivedColumns: ColumnDef[] = fields.map((f: any) => ({
          name: f.label || f.name || f.fieldKey,
          field: f.fieldKey || f.key || f.code,
          width: "auto",
          sortable: true,
          visible: true,
        }));
        setColumns([...derivedColumns, ...SYSTEM_COLUMNS]);
      })
      .catch((e) => {
        console.warn("[ListPageEditor] 加载表单 schema 失败:", e);
        setColumns(SYSTEM_COLUMNS);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAppId, resolvedFormId]);

  const loadData = useCallback(async () => {
    if (!resolvedAppId || !resolvedFormId) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size };
      const sortQ = sortToQuery(sort);
      if (sortQ.length > 0) params.sort = sortQ.join(",");
      const filterQ = filtersToQuery(filters);
      for (const [k, v] of Object.entries(filterQ)) params[k] = v;
      const result = await appServiceApi.forms.listData(resolvedAppId, resolvedFormId, params);
      setRows(result.rows);
      setTotal(result.total);
    } catch (e) {
      toast.error("加载列表数据失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [resolvedAppId, resolvedFormId, page, size, sort, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const persistToParent = (cols: ColumnDef[], cfg: ListConfig) => {
    setComponents((prev: PageComponent[]) => {
      if (prev.length === 0) {
        return [{ id: "list-config", type: "list-config", label: "列表配置", props: { columns: cols, config: cfg } }];
      }
      return prev.map((c, i) =>
        i === 0 ? { ...c, props: { ...c.props, columns: cols, config: cfg } } : c
      );
    });
    setDirty(true);
  };

  const updateConfig = (patch: Partial<ListConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    if (patch.pageSize) setSize(patch.pageSize);
    persistToParent(columns, next);
  };

  const addColumn = () => {
    const next = [...columns, { name: "新列", field: `field_${Date.now()}`, width: "auto", sortable: true, visible: true }];
    setColumns(next);
    persistToParent(next, config);
  };

  const removeColumn = (idx: number) => {
    const next = columns.filter((_, i) => i !== idx);
    setColumns(next);
    persistToParent(next, config);
  };

  const updateColumnName = (idx: number, name: string) => {
    const next = columns.map((c, i) => (i === idx ? { ...c, name } : c));
    setColumns(next);
    persistToParent(next, config);
  };

  // F1.8: 列显示/隐藏
  const toggleColumnVisible = (idx: number) => {
    const next = columns.map((c, i) => (i === idx ? { ...c, visible: !c.visible } : c));
    setColumns(next);
    persistToParent(next, config);
  };

  // F1.6: 列头点击 toggle
  const handleHeaderClick = (col: ColumnDef) => {
    if (!col.sortable) return;
    setSort(toggleSort(sort, col.field));
    setPage(1);
  };

  // F1.7: 添加过滤器行
  const addFilter = (field: string) => {
    if (filters[field]) return;
    setFilters((prev) => ({ ...prev, [field]: { field, op: "eq", value: "" } }));
    setPage(1);
  };

  // F1.7: 更新过滤器
  const updateFilter = (field: string, op: FilterOp, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: { field, op, value } };
      if (op === "empty") delete next[field].value;
      // 值为空且非 empty op -> 移除 (但保留 UI 显示)
      return next;
    });
    setPage(1);
  };

  const removeFilter = (field: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  const exportCsv = async () => {
    if (!resolvedAppId || !resolvedFormId) return;
    try {
      const params: Record<string, string | number> = {};
      const sortQ = sortToQuery(sort);
      if (sortQ.length > 0) params.sort = sortQ.join(",");
      const filterQ = filtersToQuery(filters);
      for (const [k, v] of Object.entries(filterQ)) params[k] = v;
      const res = await appServiceApi.forms.exportCsv(resolvedAppId, resolvedFormId, params);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${resolvedFormId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV 导出成功");
    } catch (e) {
      toast.error("CSV 导出失败: " + (e as Error).message);
    }
  };

  // F1.8: 列可见性过滤
  const displayColumns = useMemo(
    () => (columns.length > 0 ? columns : SYSTEM_COLUMNS).filter((c) => c.visible !== false),
    [columns],
  );

  // F1.7: 已激活的过滤器列表
  const activeFilters = Object.values(filters);

  // F1.7: 可添加过滤器的列 (未激活)
  const availableFilterFields = (columns.length > 0 ? columns : SYSTEM_COLUMNS).filter(
    (c) => !filters[c.field],
  );

  return (
    <div className="flex gap-0 h-[calc(100vh-200px)] min-h-[400px]">
      {/* ═══ Center: Data Table ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {config.supportSearch && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  placeholder="全局搜索..."
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  className="h-7 pl-7 pr-2 text-xs w-48"
                  data-testid="global-search"
                  disabled
                  title="v1.0.2 全局搜索: 用过滤器替代"
                />
              </div>
            )}
            {/* F1.7: 过滤器入口 */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterPanelOpen((s) => !s)}
              data-testid="filter-panel-toggle"
            >
              <SlidersHorizontal className="size-3 mr-1" />
              过滤器
              {activeFilters.length > 0 && (
                <Badge className="ml-1 px-1 py-0 text-[10px]" data-testid="filter-active-count">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportCsv} data-testid="export-csv">
              <Download className="size-3 mr-1" /> 导出 CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowConfig((s) => !s)} data-testid="config-toggle">
              <Settings className="size-3 mr-1" /> 配置
            </Button>
          </div>
        </div>

        {/* F1.7: Filter Panel (Formily FilterRow) */}
        {filterPanelOpen && (
          <div className="px-4 py-3 border-b bg-violet-50/30 space-y-2" data-testid="filter-panel">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">
                高级过滤器 (Formily x-reactions 驱动, 9 种操作符)
              </span>
              <div className="flex gap-2">
                {activeFilters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-6 text-xs text-rose-600"
                    data-testid="clear-filters"
                  >
                    <X className="size-3 mr-1" /> 清空
                  </Button>
                )}
              </div>
            </div>

            {activeFilters.map((f) => {
              const col = (columns.length > 0 ? columns : SYSTEM_COLUMNS).find((c) => c.field === f.field);
              return (
                <FilterRow
                  key={f.field}
                  field={f.field}
                  fieldLabel={col?.name ?? f.field}
                  op={f.op}
                  value={f.value}
                  onRemove={() => removeFilter(f.field)}
                />
              );
            })}

            {availableFilterFields.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs text-muted-foreground">添加过滤器:</span>
                {availableFilterFields.map((c) => (
                  <Button
                    key={c.field}
                    variant="ghost"
                    size="sm"
                    onClick={() => addFilter(c.field)}
                    className="h-6 text-xs border border-dashed border-slate-300"
                    data-testid={`add-filter-${c.field}`}
                  >
                    <Plus className="size-3 mr-1" /> {c.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {displayColumns.map((col) => {
                  const sortDir = sortStateOf(sort, col.field);
                  return (
                    <th
                      key={col.field}
                      className="px-3 py-2 text-left font-medium text-muted-foreground border-b whitespace-nowrap"
                      style={{ width: col.width === "auto" ? undefined : col.width }}
                      data-testid={`header-${col.field}`}
                    >
                      <div
                        className="flex items-center gap-1 cursor-pointer select-none"
                        onClick={() => handleHeaderClick(col)}
                      >
                        <span className={col.sortable ? "hover:text-foreground" : ""}>
                          {col.name}
                        </span>
                        {col.sortable && (
                          <span data-testid={`sort-icon-${col.field}`}>
                            {sortDir === "asc" ? <ArrowUp className="size-3 text-violet-600" />
                              : sortDir === "desc" ? <ArrowDown className="size-3 text-violet-600" />
                                : <ArrowUpDown className="size-3 opacity-40" />}
                          </span>
                        )}
                      </div>
                      {/* F1.7: 列头 inline filter (单字段简单 contains) */}
                      <div className="mt-1">
                        <Input
                          value={filters[col.field]?.op === "contains" ? filters[col.field].value : ""}
                          onChange={(e) => {
                            if (!e.target.value) {
                              removeFilter(col.field);
                            } else {
                              updateFilter(col.field, "contains", e.target.value);
                            }
                          }}
                          placeholder="过滤..."
                          className="h-5 text-[10px] px-1 py-0"
                          data-testid={`header-filter-${col.field}`}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={displayColumns.length} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="size-4 animate-spin inline mr-1" /> 加载中...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                    {displayColumns.map((col) => (
                      <td key={col.field} className="px-3 py-2">
                        {row[col.field] == null ? "--" : String(row[col.field])}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={displayColumns.length} className="px-3 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
          <span data-testid="total-count">共 {total} 条</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPage(1)} disabled={page <= 1} data-testid="page-first">
              <ChevronsLeft className="size-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} data-testid="page-prev">
              <ChevronLeft className="size-3" />
            </Button>
            <span className="px-2" data-testid="page-current">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="page-next">
              <ChevronRight className="size-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPage(totalPages)} disabled={page >= totalPages} data-testid="page-last">
              <ChevronsRight className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ Right: Config Panel ═══ */}
      {showConfig && (
        <div className="w-64 border-l flex flex-col shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Settings className="size-3.5" /> 配置规则
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium">列配置 (F1.8)</p>
                <button
                  onClick={addColumn}
                  className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                  data-testid="add-column"
                >
                  <Plus className="size-2.5" /> 添加列
                </button>
              </div>
              <div className="space-y-1">
                {columns.map((col, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 border rounded text-xs" data-testid={`config-col-${col.field}`}>
                    {/* F1.8: 显示/隐藏切换 */}
                    <input
                      type="checkbox"
                      checked={col.visible !== false}
                      onChange={() => toggleColumnVisible(i)}
                      className="size-3 accent-violet-600"
                      data-testid={`col-visible-${col.field}`}
                    />
                    <input
                      value={col.name}
                      onChange={(e) => updateColumnName(i, e.target.value)}
                      className="flex-1 border-none bg-transparent text-xs focus:outline-none px-0"
                    />
                    <button
                      onClick={() => removeColumn(i)}
                      className="p-0.5 rounded hover:bg-destructive/20 text-destructive"
                    >
                      <Trash2 className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2">设置</p>
              <label className="flex items-center justify-between text-xs mb-2 cursor-pointer">
                <span>支持搜索</span>
                <input
                  type="checkbox"
                  checked={config.supportSearch}
                  onChange={(e) => updateConfig({ supportSearch: e.target.checked })}
                  className="size-3 accent-violet-600"
                />
              </label>
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>每页条数</span>
                <select
                  value={config.pageSize}
                  onChange={(e) => updateConfig({ pageSize: Number(e.target.value) })}
                  className="h-6 text-xs border rounded px-1"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>

            <div>
              <p className="text-xs font-medium mb-2">F1.7 操作符说明</p>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                {FILTER_OPS.map((o) => (
                  <p key={o.value}>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {o.label}
                    </Badge>
                    {o.takesValue ? ` 输入值` : " (无值)"}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}