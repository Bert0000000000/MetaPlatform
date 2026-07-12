import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Activity, AlertTriangle, CheckCircle2, Container, RefreshCw,
  Server, ExternalLink, Layers, Trash2, KeyRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type RuntimeItem = {
  app_id: string;
  name: string;
  app_slug: string;
  alias_slug: string;
  published_at: string;
  persisted_port: number | null;
  persisted_mode: string | null;
  runtime: {
    state?: string;
    running?: boolean;
    port?: number | null;
    containerId?: string;
    startedAt?: string;
    error?: string;
  } | null;
  serving_mode: "container" | "degraded" | "missing" | string;
};

type Summary = {
  docker: "ok" | "degraded";
  docker_error?: string | null;
  totals: {
    total: number;
    container_running: number;
    degraded: number;
    absent: number;
  };
  items: RuntimeItem[];
};

function pillFor(mode: RuntimeItem["serving_mode"]) {
  if (mode === "container") return { label: "独立容器", color: "bg-green-500/15 text-green-700 border-green-500/30" };
  if (mode === "degraded") return { label: "降级（进程内）", color: "bg-primary/15 text-yellow-700 border-yellow-500/30" };
  return { label: "已停止", color: "bg-zinc-400/15 text-zinc-600 border-zinc-400/30" };
}

export function AdminRuntime() {
  const navigate = useNavigate();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);
  const [pruneReport, setPruneReport] = useState<{
    pruned: Array<{ slug: string; reason: string }>;
    orphan_pruned: string[];
    kept: number;
    finished_at: string;
  } | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await appsApi.getAdminRuntimeSummary() as Summary;
      setData(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  };

  const prune = async () => {
    setPruning(true);
    try {
      const r = await appsApi.pruneRuntimes();
      if (r?.skipped) {
        setError(`Pruner skipped: ${r.skipped}`);
      } else {
        setPruneReport(r as any);
        // After prune the port pool may have freed up — refresh summary
        refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setPruning(false); }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Container className="size-6" />
            运行时监控
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            所有已发布应用的容器状态、Docker 守护进程可达性、降级情况
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/api-keys")}>
            <KeyRound className="size-3 mr-1" />
            API Keys
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("size-3 mr-1", loading && "animate-spin")} />
            刷新
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={prune} disabled={pruning}
                title="清理过期/孤立的发布容器，释放端口 (31001-31499)">
          <Trash2 className={cn("size-3 mr-1", pruning && "animate-pulse")} />
          {pruning ? "清理中…" : "立即清理"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Top totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已发布应用总数</CardDescription>
            <CardTitle className="text-2xl">{data?.totals.total ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>容器运行中</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 text-green-600">
              <Activity className="size-5" />
              {data?.totals.container_running ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>降级模式</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="size-5" />
              {data?.totals.degraded ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Docker 守护进程</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {data?.docker === "ok" ? (
                <>
                  <CheckCircle2 className="size-5 text-green-600" />
                  <span className="text-green-600">可达</span>
                </>
              ) : data?.docker === "degraded" ? (
                <>
                  <AlertTriangle className="size-5 text-yellow-600" />
                  <span className="text-yellow-600">不可达</span>
                </>
              ) : "—"}
            </CardTitle>
            {data?.docker_error && (
              <CardDescription className="mt-1 text-xs">{data.docker_error}</CardDescription>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Per-app table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="size-4" />
            应用运行时详情
          </CardTitle>
          <CardDescription>
            每行 = 一个已发布应用；点击名称跳转到应用详情，点击打开进入对外访问 URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data && loading && (
            <div className="flex justify-center py-8">
              <RefreshCw className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {data && data.items.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              暂未发布应用
            </div>
          )}
          {data && data.items.map((it) => {
            const pill = pillFor(it.serving_mode);
            return (
              <div key={it.app_id} className="grid grid-cols-12 gap-2 items-center py-3 px-3 rounded-lg border bg-card">
                <div className="col-span-4">
                  <a href={`/apps/${it.app_id}/overview`} className="font-medium hover:underline flex items-center gap-1">
                    <Box className="size-3" />
                    {it.name}
                  </a>
                  <code className="text-xs text-muted-foreground font-mono">{it.app_slug}</code>
                </div>
                <div className="col-span-3">
                  <Badge variant="outline" className={cn("text-xs", pill.color)}>{pill.label}</Badge>
                  {it.runtime?.state && (
                    <code className="ml-2 text-xs text-muted-foreground font-mono">{it.runtime.state}</code>
                  )}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  端口 {it.runtime?.port ?? it.persisted_port ?? "—"}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {it.runtime?.containerId ? `${it.runtime.containerId.slice(0, 12)}…` : it.runtime?.error || "—"}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/app/${it.app_slug}`} target="_blank" rel="noopener noreferrer" title="打开对外访问">
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Server className="size-3" />
        仪表盘每 8 秒自动刷新；Docker 状态变化会立即反映在「Docker 守护进程」卡片
      </div>

      {pruneReport && (
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="size-4 text-emerald-500" />
              最近一次清理结果
              <span className="text-xs text-muted-foreground font-normal">
                {new Date(pruneReport.finished_at).toLocaleString("zh-CN")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex gap-4 flex-wrap">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-green-600" />
                保留 <strong>{pruneReport.kept}</strong> 个容器
              </span>
              <span className="flex items-center gap-1">
                <Trash2 className="size-3 text-emerald-600" />
                清理过期 <strong>{pruneReport.pruned?.length ?? 0}</strong> 个
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="size-3 text-amber-600" />
                清理孤立 <strong>{pruneReport.orphan_pruned?.length ?? 0}</strong> 个
              </span>
            </div>
            {(pruneReport.pruned?.length > 0 || pruneReport.orphan_pruned?.length > 0) && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">查看详情</summary>
                <div className="mt-2 space-y-1 font-mono">
                  {pruneReport.pruned?.map((p) => (
                    <div key={p.slug}>↳ {p.slug} <span className="text-muted-foreground">({p.reason})</span></div>
                  ))}
                  {pruneReport.orphan_pruned?.map((s) => (
                    <div key={s} className="text-amber-700">↳ orphan: {s}</div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
