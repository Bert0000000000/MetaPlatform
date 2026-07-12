import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen, Search, ChevronDown, ChevronRight,
  Settings, Edit, Trash2, Plus,
} from "lucide-react";
import type { BaseEditorProps, PageComponent } from "./types";

// ── Column definition ──
interface ColumnDef {
  name: string;
  field: string;
  width: string;
  sortable: boolean;
}

// ── Category tree node ──
interface CategoryNode {
  id: string;
  label: string;
  children: CategoryNode[];
}

// ── Config state ──
interface ListConfig {
  supportSearch: boolean;
  includeChildren: boolean;
  selectLevel: "all" | "children" | "leaf";
  defaultExpand: "all" | "level1" | "none";
  expandLevel: number;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { name: "序号",     field: "index",      width: "60px",  sortable: false },
  { name: "表单名称", field: "name",       width: "auto",  sortable: true },
  { name: "创建人",   field: "creator",    width: "120px", sortable: true },
  { name: "更新时间", field: "updated_at", width: "140px", sortable: true },
  { name: "操作",     field: "actions",    width: "80px",  sortable: false },
];

const CATEGORIES: CategoryNode[] = [
  { id: "gifts", label: "节日礼品", children: [
    { id: "gifts-custom", label: "定制礼品", children: [] },
    { id: "gifts-standard", label: "标准礼品", children: [] },
  ]},
  { id: "employee", label: "员工礼品", children: [
    { id: "employee-birthday", label: "生日礼物", children: [] },
    { id: "employee-holiday", label: "节假日礼品", children: [] },
  ]},
  { id: "office", label: "办公设备", children: [] },
  { id: "network", label: "网络设备", children: [] },
  { id: "computer", label: "电脑配件", children: [] },
];

/**
 * ListPageEditor -- three-column list page editor
 *
 * Fixes vs. original PageEditor.tsx:
 * - Removed duplicate "创建人" column (was "creator" + "author")
 * - Config panel state is connected to parent via setComponents
 * - Proper TypeScript typing
 */
export function ListPageEditor({ components, setComponents, setDirty }: BaseEditorProps) {
  // ── Sync columns and rows from parent component data ──
  const existingConfig = components?.[0]?.props;
  const [columns, setColumns] = useState<ColumnDef[]>(
    existingConfig?.columns || DEFAULT_COLUMNS
  );
  const [rows, setRows] = useState<Record<string, string>[]>(
    existingConfig?.rows || []
  );
  const [config, setConfig] = useState<ListConfig>(existingConfig?.config || {
    supportSearch: true,
    includeChildren: true,
    selectLevel: "children",
    defaultExpand: "level1",
    expandLevel: 1,
  });

  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(["gifts", "employee"])
  );

  /** Persist config + columns back to parent */
  const persistToParent = useCallback(
    (cols: ColumnDef[], cfg: ListConfig) => {
      setComponents((prev: PageComponent[]) => {
        if (prev.length === 0) {
          return [{ id: "list-config", type: "list-config", label: "列表配置", props: { columns: cols, config: cfg } }];
        }
        return prev.map((c, i) =>
          i === 0 ? { ...c, props: { ...c.props, columns: cols, config: cfg } } : c
        );
      });
      setDirty(true);
    },
    [setComponents, setDirty]
  );

  const updateConfig = (patch: Partial<ListConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    persistToParent(columns, next);
  };

  // ── Category tree helpers ──
  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Column CRUD ──
  const addColumn = () => {
    const next = [...columns, { name: "新列", field: `field_${Date.now()}`, width: "100px", sortable: false }];
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

  return (
    <div className="flex gap-0 h-[calc(100vh-200px)] min-h-[400px]">
      {/* ═══ Left: Category Tree ═══ */}
      <div className="w-52 border-r flex flex-col shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <FolderOpen className="size-3.5 text-amber-500" />
            全部
          </div>
          <button className="text-xs text-primary">重置</button>
        </div>
        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <input
              placeholder="请输入"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-7 pl-6 pr-2 text-xs border rounded"
            />
          </div>
        </div>
        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-1 pb-2">
          {CATEGORIES.filter(
            (cat) =>
              !searchText ||
              cat.label.includes(searchText) ||
              cat.children.some((ch) => ch.label.includes(searchText))
          ).map((cat) => (
            <div key={cat.id}>
              <div
                onClick={() => cat.children.length > 0 && toggleCat(cat.id)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded cursor-pointer hover:bg-muted ${
                  selectedCategory === cat.id
                    ? "bg-primary/10 text-primary font-medium"
                    : ""
                }`}
                style={{ paddingLeft: "8px" }}
              >
                {cat.children.length > 0 ? (
                  expandedCats.has(cat.id) ? (
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  <span className="size-3" />
                )}
                <span>{cat.label}</span>
              </div>
              {expandedCats.has(cat.id) &&
                cat.children.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => setSelectedCategory(child.id)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded cursor-pointer hover:bg-muted ${
                      selectedCategory === child.id
                        ? "bg-primary/10 text-primary font-medium"
                        : ""
                    }`}
                    style={{ paddingLeft: "28px" }}
                  >
                    <span>{child.label}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Center: Data Table ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
          <div className="relative">
            <input
              placeholder="合同中..."
              className="h-7 w-24 pr-2 text-xs border rounded"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <input
              placeholder="请输入"
              className="h-7 pl-6 pr-2 text-xs border rounded w-28"
            />
          </div>
          <span className="text-xs text-muted-foreground">创建时间</span>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, start: e.target.value }))
            }
            className="h-7 px-2 text-xs border rounded w-28"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, end: e.target.value }))
            }
            className="h-7 px-2 text-xs border rounded w-28"
          />
          <button className="h-7 px-4 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90">
            查询
          </button>
          <button className="h-7 px-3 text-xs border rounded hover:bg-muted">
            重置
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-medium text-muted-foreground border-b whitespace-nowrap"
                    style={{ width: col.width === "auto" ? undefined : col.width }}
                  >
                    {col.name}
                    {col.sortable && (
                      <span className="ml-1 text-xs">↕</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                    {columns.map((col, j) => (
                      <td key={j} className="px-3 py-2">
                        {col.field === "index" ? (
                          <span className="text-muted-foreground">{i + 1}</span>
                        ) : col.field === "actions" ? (
                          <div className="flex items-center gap-1">
                            <button className="p-1 rounded hover:bg-primary/10 text-primary" title="编辑"><Edit className="size-3" /></button>
                            <button className="p-1 rounded hover:bg-destructive/10 text-destructive" title="删除"><Trash2 className="size-3" /></button>
                          </div>
                        ) : (
                          <span>{row[col.field] || "--"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                Array.from({ length: 10 }, (_, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                    {columns.map((col, j) => (
                      <td key={j} className="px-3 py-2">
                        {col.field === "index" ? <span className="text-muted-foreground">{i + 1}</span>
                        : col.field === "actions" ? (
                          <div className="flex items-center gap-1">
                            <button className="p-1 rounded hover:bg-primary/10 text-primary" title="编辑"><Edit className="size-3" /></button>
                            <button className="p-1 rounded hover:bg-destructive/10 text-destructive" title="删除"><Trash2 className="size-3" /></button>
                          </div>
                        ) : <span className="text-muted-foreground">--</span>}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
          <span>共 {rows.length || 10} 条</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-0.5 border rounded hover:bg-muted">
              上一页
            </button>
            <button className="px-2 py-0.5 bg-primary text-primary-foreground rounded">
              1
            </button>
            <button className="px-2 py-0.5 border rounded hover:bg-muted">
              2
            </button>
            <button className="px-2 py-0.5 border rounded hover:bg-muted">
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Right: Config Panel ═══ */}
      <div className="w-56 border-l flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Settings className="size-3.5" /> 配置规则
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Columns management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">列配置</p>
              <button
                onClick={addColumn}
                className="flex items-center gap-0.5 text-xs text-primary hover:underline"
              >
                <Plus className="size-2.5" /> 添加列
              </button>
            </div>
            <div className="space-y-1">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 border rounded text-xs"
                >
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

          {/* Settings */}
          <div>
            <p className="text-xs font-medium mb-2">设置</p>
            <label className="flex items-center justify-between text-xs mb-2 cursor-pointer">
              <span>支持搜索</span>
              <div
                className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${
                  config.supportSearch ? "bg-primary" : "bg-muted"
                }`}
                onClick={() =>
                  updateConfig({ supportSearch: !config.supportSearch })
                }
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                    config.supportSearch ? "left-4.5" : "left-0.5"
                  }`}
                />
              </div>
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span>包含子级节点</span>
              <div
                className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${
                  config.includeChildren ? "bg-primary" : "bg-muted"
                }`}
                onClick={() =>
                  updateConfig({ includeChildren: !config.includeChildren })
                }
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                    config.includeChildren ? "left-4.5" : "left-0.5"
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Selectable levels */}
          <div>
            <p className="text-xs font-medium mb-2">可选层级</p>
            <div className="space-y-1.5">
              {(
                [
                  { value: "all" as const, label: "全部节点" },
                  { value: "children" as const, label: "指定节点" },
                  { value: "leaf" as const, label: "仅末级节点" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <input
                    type="radio"
                    name="selectLevel"
                    checked={config.selectLevel === opt.value}
                    onChange={() => updateConfig({ selectLevel: opt.value })}
                    className="size-3 accent-primary"
                  />
                  <span>{opt.label}</span>
                  {opt.value === "children" &&
                    config.selectLevel === "children" && (
                      <span className="text-xs text-muted-foreground border rounded px-1 py-0.5">
                        级以下节点
                      </span>
                    )}
                </label>
              ))}
            </div>
          </div>

          {/* Default expand */}
          <div>
            <p className="text-xs font-medium mb-2">默认展开状态</p>
            <div className="space-y-1.5">
              {(
                [
                  { value: "all" as const, label: "展开全部" },
                  { value: "level1" as const, label: "1 级", extra: true },
                  { value: "none" as const, label: "收起全部" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <input
                    type="radio"
                    name="defaultExpand"
                    checked={config.defaultExpand === opt.value}
                    onChange={() => updateConfig({ defaultExpand: opt.value })}
                    className="size-3 accent-primary"
                  />
                  <span>{opt.label}</span>
                  {opt.extra && config.defaultExpand === "level1" && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        级
                      </span>
                      <input
                        type="number"
                        value={config.expandLevel}
                        min={1}
                        max={10}
                        onChange={(e) =>
                          updateConfig({
                            expandLevel: Number(e.target.value),
                          })
                        }
                        className="w-8 h-5 text-center text-xs border rounded"
                      />
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Data settings */}
          <div>
            <p className="text-xs font-medium mb-2">数据设置</p>
            <button className="text-xs text-primary hover:underline">
              设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
