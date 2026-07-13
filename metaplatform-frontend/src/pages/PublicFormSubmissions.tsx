/**
 * PublicFormSubmissions.tsx — 公开表单提交记录列表
 * 无需鉴权，常用于申请人提交后查看历史记录。
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, ArrowLeft, Download, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { publicApi, type FormSubmission, type PaginatedSubmissions } from "@/lib/api";

const PUBLIC_BASE = (import.meta.env?.VITE_API_BASE || "/api").replace(/\/$/, "");

async function fetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    credentials: "omit",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function escapeCsvCell(value: unknown) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function buildCsv(rows: FormSubmission[], valueKeys: string[]) {
  const headers = ["提交时间", "状态", "提交人邮箱", "提交人姓名", ...valueKeys];
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const r of rows) {
    const values = r.values || {};
    const line = [
      formatDate(r.submittedAt),
      r.status,
      r.submitterEmail,
      r.submitterName,
      ...valueKeys.map((k) => values[k]),
    ];
    lines.push(line.map(escapeCsvCell).join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

export default function PublicFormSubmissions() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [formName, setFormName] = useState<string>("");
  const [formLoading, setFormLoading] = useState(true);
  const [result, setResult] = useState<PaginatedSubmissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sortField, setSortField] = useState("submitted_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!formId) return;
    setFormLoading(true);
    fetchPublic<{ name: string }>(`/public/forms/${encodeURIComponent(formId)}`)
      .then((data) => setFormName(data.name))
      .catch((e) => setError((e as Error).message))
      .finally(() => setFormLoading(false));
  }, [formId]);

  const load = async (targetPage = page) => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await publicApi.listFormSubmissions(formId, {
        page: targetPage,
        pageSize,
        sortField,
        sortOrder,
        q: q || undefined,
        status: status || undefined,
      });
      setResult(data);
      setPage(data.page);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!formId) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, pageSize, sortField, sortOrder]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!formId) return;
      load(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const valueKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of result?.rows || []) {
      for (const k of Object.keys(r.values || {})) keys.add(k);
    }
    return Array.from(keys);
  }, [result]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const exportCsv = () => {
    if (!result?.rows.length) return;
    const csv = buildCsv(result.rows, valueKeys);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formName || "submissions"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (formLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" /> 加载失败
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-3 mr-1" /> 返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = result?.rows || [];
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 1;

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{formName || "表单提交记录"}</h1>
            <p className="text-sm text-muted-foreground mt-1">公开访问 · 共 {total} 条记录</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="size-4 mr-1" /> 导出 CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => load(page)} disabled={loading}>
              <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> 刷新
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4 mr-1" /> 返回
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="搜索提交人、邮箱或内容…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">全部状态</option>
                <option value="pending">待处理</option>
                <option value="approved">已通过</option>
                <option value="rejected">已驳回</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={10}>10 条/页</option>
                <option value={20}>20 条/页</option>
                <option value={50}>50 条/页</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <SortableHeader label="提交时间" field="submitted_at" current={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableHeader label="状态" field="status" current={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableHeader label="提交人" field="submitter_name" current={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableHeader label="邮箱" field="submitter_email" current={sortField} order={sortOrder} onSort={handleSort} />
                  {valueKeys.map((k) => (
                    <th key={k} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4 + valueKeys.length} className="text-center py-12 text-muted-foreground">
                      暂无提交记录
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.submittedAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">{row.submitterName || "-"}</td>
                      <td className="px-4 py-3">{row.submitterEmail || "-"}</td>
                      {valueKeys.map((k) => (
                        <td key={k} className="px-4 py-3 max-w-xs truncate">
                          {String((row.values || {})[k] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页，共 {total} 条
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => load(page - 1)} disabled={page <= 1 || loading}>
              <ChevronLeft className="size-4 mr-1" /> 上一页
            </Button>
            <Button variant="outline" size="sm" onClick={() => load(page + 1)} disabled={page >= totalPages || loading}>
              下一页 <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  current,
  order,
  onSort,
}: {
  label: string;
  field: string;
  current: string;
  order: "asc" | "desc";
  onSort: (f: string) => void;
}) {
  const active = current === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
    >
      {label} {active ? (order === "asc" ? "↑" : "↓") : "↕"}
    </th>
  );
}

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "approved":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已通过</Badge>;
    case "rejected":
      return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">已驳回</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">待处理</Badge>;
  }
}
