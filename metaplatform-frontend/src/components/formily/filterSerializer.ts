/**
 * filterSerializer.ts — v1.0.2 Sprint 2 F1.7+ 过滤器/排序 URL + API 序列化.
 *
 * <p>把前端 UI 状态 (FilterEntry, SortEntry) 序列化为后端 FilterParser 接受的字符串语法:
 * <ul>
 *   <li>eq       -> "=value"</li>
 *   <li>neq      -> "!=value"</li>
 *   <li>gt       -> ">value"</li>
 *   <li>gte      -> ">=value"</li>
 *   <li>lt       -> "<value"</li>
 *   <li>lte      -> "<=value"</li>
 *   <li>contains -> "~value"</li>
 *   <li>empty    -> ":"</li>
 *   <li>in       -> "in(a,b,c)"</li>
 * </ul>
 *
 * <p>把 sort field+dir 序列化为 "-field" (desc) 或 "field" (asc).
 */
import type { FilterOp } from "./FilterRow";

export interface FilterEntry {
  field: string;
  op: FilterOp;
  value: string;
}

export interface SortEntry {
  field: string;
  dir: "asc" | "desc";
}

/**
 * 序列化为后端 FilterParser 语法.
 */
export function serializeFilterExpression(op: FilterOp, value: string): string {
  if (op === "empty") return ":";
  if (op === "eq") return `=${value}`;
  if (op === "neq") return `!=${value}`;
  if (op === "gt") return `>${value}`;
  if (op === "gte") return `>=${value}`;
  if (op === "lt") return `<${value}`;
  if (op === "lte") return `<=${value}`;
  if (op === "contains") return `~${value}`;
  if (op === "in") return `in(${value})`;
  return value;
}

/**
 * 把 FilterEntry map 转后端 filters 对象.
 */
export function filtersToQuery(filters: Record<string, FilterEntry>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, e] of Object.entries(filters)) {
    out[field] = serializeFilterExpression(e.op, e.value);
  }
  return out;
}

/**
 * 把 SortEntry[] 转为后端 sort 字符串数组 ("field" or "-field").
 */
export function sortToQuery(sort: SortEntry[]): string[] {
  return sort.map((s) => (s.dir === "desc" ? `-${s.field}` : s.field));
}

/**
 * 列头点击 toggle 排序: 未排序 -> asc -> desc -> 无.
 */
export function toggleSort(current: SortEntry[] | undefined, field: string): SortEntry[] {
  if (!current || current.length === 0) {
    return [{ field, dir: "asc" }];
  }
  const first = current[0];
  if (first.field !== field) {
    return [{ field, dir: "asc" }];
  }
  if (first.dir === "asc") {
    return [{ field, dir: "desc" }];
  }
  return [];
}

/**
 * 当前 sort 状态 (字段 + 方向) 用于列头箭头展示.
 */
export function sortStateOf(sort: SortEntry[] | undefined, field: string): "asc" | "desc" | null {
  if (!sort || sort.length === 0) return null;
  const first = sort[0];
  if (first.field !== field) return null;
  return first.dir;
}

/**
 * URL query string sync helpers.
 * Encode: filter field -> URL key "filter_field"
 *         sort field -> URL key "sort"
 */
export function buildListUrlQuery(sort: SortEntry[], filters: Record<string, FilterEntry>, page = 1, size = 20): Record<string, string> {
  const out: Record<string, string> = {
    page: String(page),
    size: String(size),
  };
  if (sort.length > 0) {
    out.sort = sortToQuery(sort)[0];
  }
  for (const [field, e] of Object.entries(filters)) {
    out[`filter_${field}`] = serializeFilterExpression(e.op, e.value);
  }
  return out;
}

export function parseListUrlQuery(qs: URLSearchParams): {
  sort: SortEntry[];
  filters: Record<string, FilterEntry>;
  page: number;
  size: number;
} {
  const sort: SortEntry[] = [];
  const filters: Record<string, FilterEntry> = {};
  let page = 1;
  let size = 20;
  qs.forEach((value, key) => {
    if (key === "page") page = Math.max(1, parseInt(value, 10) || 1);
    else if (key === "size") size = Math.max(1, Math.min(200, parseInt(value, 10) || 20));
    else if (key === "sort") {
      const desc = value.startsWith("-");
      const field = desc ? value.substring(1) : value;
      if (field) sort.push({ field, dir: desc ? "desc" : "asc" });
    } else if (key.startsWith("filter_")) {
      const field = key.substring("filter_".length);
      const entry = parseFilterExpression(value);
      if (entry) filters[field] = entry;
    }
  });
  return { sort, filters, page, size };
}

/**
 * 解析后端 FilterParser 语法为 FilterEntry.
 */
export function parseFilterExpression(expr: string): FilterEntry | null {
  if (!expr) return null;
  if (expr === ":") return { field: "", op: "empty", value: "" };
  if (expr.startsWith("!=")) return { field: "", op: "neq", value: expr.substring(2) };
  if (expr.startsWith(">=")) return { field: "", op: "gte", value: expr.substring(2) };
  if (expr.startsWith("<=")) return { field: "", op: "lte", value: expr.substring(2) };
  if (expr.startsWith("in(") && expr.endsWith(")")) {
    return { field: "", op: "in", value: expr.substring(3, expr.length - 1) };
  }
  const op = expr.substring(0, 1);
  const value = expr.substring(1);
  switch (op) {
    case ">": return { field: "", op: "gt", value };
    case "<": return { field: "", op: "lt", value };
    case "=": return { field: "", op: "eq", value };
    case "~": return { field: "", op: "contains", value };
    default: return { field: "", op: "eq", value: expr };
  }
}