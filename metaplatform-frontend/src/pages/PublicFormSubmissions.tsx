/**
 * PublicFormSubmissions.tsx — 公开表单提交记录列表
 * 无需鉴权，常用于申请人提交后查看历史记录。
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, AlertCircle, ArrowLeft, Download, Search,
  ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
import { appServiceApi, type FormDataPageResult, type PublicFormSchema } from "@/lib/api";
import { toast } from "@/lib/toast";

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function escapeCsvCell(value: unknown) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function PublicFormSubmissions() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [formName, setFormName] = useState<string>("");
  const [schema, setSchema] = useState<PublicFormSchema | null>(null);
  const [formLoading, setFormLoading] = useState(true);
  const [result, setResult] = useState<FormDataPageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!formId) return;
    setFormLoading(true);
    appServiceApi.public.getFormSchema(formId)
      .then((data) => {
        setFormName(data.name);
        setSchema(data);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setFormLoading(false));
  }, [formId]);

  const fieldKeys = useMemo(() => {
    const keys: string[] = [];
    if (!schema) return keys;
    const sections = schema.sections || [];
    sections.forEach((s: any) => {
      (s.fields || []).forEach((f: any) => {
        const key = f.fieldKey || f.key || f.code;
        if (key) keys.push(key);
      });
    });
    return keys;
  }, [schema]);

  const load = async (targetPage = page) => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: targetPage, size: pageSize };
      if (sort) params.sort = sort;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await appServiceApi.public.getSubmissions(formId, params);
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
  }, [formId, pageSize, sort]);

  const handleSort = (field: string) => {
    if (!sort) {
      setSort(field);
    } else if (sort === field) {
      setSort(`-${field}`);
    } else if (sort === `-${field}`) {
      setSort(undefined);
    } else {
      setSort(field);
    }
  };

  const exportCsv = () => {
    if (!result?.rows.length) return;
    const header = ["ID", "创建时间", "更新时间", ...fieldKeys];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const row of result.rows) {
      const line = [
        row.id ?? "",
        row.created_at ?? "",
        row.updated_at ?? "",
        ...fieldKeys.map((k) => row[k]),
      ];
      lines.push(line.map(escapeCsvCell).join(","));
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formName || "submissions"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 导出成功");
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
                  placeholder="全局搜索（v1.0.1 暂未启用）"
                  disabled
                  className="pl-9"
                />
              </div>
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
                  <SortableHeader label="ID" field="id" current={sort} onSort={handleSort} />
                  <SortableHeader label="创建时间" field="created_at" current={sort} onSort={handleSort} />
                  <SortableHeader label="更新时间" field="updated_at" current={sort} onSort={handleSort} />
                  <SortableHeader label="审批状态" field="workflow_status" current={sort} onSort={handleSort} />
                  <SortableHeader label="当前任务" field="current_task_name" current={sort} onSort={handleSort} />
                  {fieldKeys.map((k) => (
                    <SortableHeader key={k} label={k} field={k} current={sort} onSort={handleSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5 + fieldKeys.length} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin inline mr-2" /> 加载中...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5 + fieldKeys.length} className="text-center py-12 text-muted-foreground">
                      暂无提交记录
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{row.id ?? "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(String(row.created_at || ""))}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(String(row.updated_at || ""))}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={String(row.workflow_status || "")} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.current_task_name ?? "-"}</td>
                      {fieldKeys.map((k) => (
                        <td key={k} className="px-4 py-3 max-w-xs truncate">
                          {row[k] == null ? "-" : String(row[k])}
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

function StatusBadge({ status }: { status: string }) {
  const label = status || "none";
  const color =
    label === "completed" || label === "approved"
      ? "bg-green-100 text-green-700"
      : label === "rejected"
      ? "bg-red-100 text-red-700"
      : label === "running"
      ? "bg-blue-100 text-blue-700"
      : label === "error"
      ? "bg-orange-100 text-orange-700"
      : "bg-gray-100 text-gray-700";
  const text =
    label === "completed" || label === "approved"
      ? "已通过"
      : label === "rejected"
      ? "已驳回"
      : label === "running"
      ? "审批中"
      : label === "error"
      ? "流程异常"
      : "未启动";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>{text}</span>;
}

function SortableHeader({
  label,
  field,
  current,
  onSort,
}: {
  label: string;
  field: string;
  current?: string;
  onSort: (f: string) => void;
}) {
  const activeAsc = current === field;
  const activeDesc = current === `-${field}`;
  return (
    <th
      onClick={() => onSort(field)}
      className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
    >
      {label} {activeAsc ? "↑" : activeDesc ? "↓" : "↕"}
    </th>
  );
}
