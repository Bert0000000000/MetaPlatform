/**
 * F4.6.22 定时任务管理 UI
 *
 * Admin / ops page for the in-process scheduler. Surfaces:
 *   • status (running + lastTickAt)
 *   • all jobs (name, cron, enabled, nextRun) with toggle + manual-run
 *   • recent runs of a selected job (status + duration + error)
 *   • ad-hoc job creator (name + 5-field cron + log|webhook handler)
 *
 * Built-in jobs (metrics.heartbeat, apikeys.flush_call_log, …) are
 * shown but the UI deliberately hides the delete button on them — the
 * backend rejects those deletions anyway.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Calendar, Loader2, Pause, Play, Plus, RefreshCw, Trash2, Zap, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { schedulerApi, type SchedulerJob, type SchedulerRun, type SchedulerStatus } from "@/lib/api";

const BUILTIN_PREFIXES = ["metrics.", "apikeys.", "cdc.", "audit.", "rate-limit.", "replication.", "cleanup."];

function isBuiltin(name: string) {
  return BUILTIN_PREFIXES.some((p) => name.startsWith(p));
}

function fmtRelative(ts?: string | null) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s 前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m 前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h 前`;
  return new Date(ts).toLocaleString();
}

export function SchedulerPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [runs, setRuns] = useState<SchedulerRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // ── create-job dialog ──
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCron, setNewCron] = useState("*/5 * * * *");
  const [newKind, setNewKind] = useState<"log" | "webhook">("log");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await schedulerApi.list();
      setStatus(s);
      if (!selectedName && s.jobs.length > 0) setSelectedName(s.jobs[0].name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedName]);

  const loadRuns = useCallback(async (name: string) => {
    setRunsLoading(true);
    try {
      const r = await schedulerApi.runs(name, 20);
      setRuns(Array.isArray(r) ? r : []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selectedName) loadRuns(selectedName); }, [selectedName, loadRuns]);

  const trigger = async (name: string) => {
    try {
      const r = await schedulerApi.trigger(name);
      if (r.error) setError(`Job ${name} 运行失败: ${r.error}`);
      await Promise.all([loadRuns(name), load()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "触发失败");
    }
  };

  const toggle = async (j: SchedulerJob) => {
    try {
      await schedulerApi.setEnabled(j.name, !j.enabled);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "状态切换失败");
    }
  };

  const remove = async (j: SchedulerJob) => {
    if (isBuiltin(j.name)) return; // backend will reject anyway
    if (!confirm(`撤销注册任务 ${j.name}? 历史运行记录会保留。`)) return;
    try {
      await schedulerApi.delete(j.name);
      setSelectedName(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "撤销失败");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || newCron.trim().split(" ").length !== 5) {
      setError("name 必填，cron 必须是 5 字段表达式");
      return;
    }
    if (newKind === "webhook" && !newWebhookUrl.trim()) {
      setError("webhook 模式需要填写 URL");
      return;
    }
    setCreating(true);
    try {
      await schedulerApi.create({
        name: newName.trim(),
        cron: newCron.trim(),
        handlerKind: newKind,
        payload: newKind === "webhook" ? { url: newWebhookUrl.trim() } : null,
      });
      setShowCreate(false);
      setNewName("");
      setNewCron("*/5 * * * *");
      setNewKind("log");
      setNewWebhookUrl("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="size-6 text-violet-500" />
            定时任务 (F4.6.22)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            平台内置 + 用户自注册的定时任务。Scheduler 单进程，cron 表达式为标准 5 字段（分 时 日 月 周）。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/runtime")}>返回运维</Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className={cn("size-3 mr-1", loading && "animate-spin")} />刷新</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="size-3 mr-1" />新建任务</Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="size-4" />{error}
        </div>
      )}

      {/* Scheduler status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">运行状态</div>
            <div className="text-2xl font-semibold mt-1 flex items-center gap-2">
              {status?.running ? (
                <><CheckCircle2 className="size-5 text-green-600" />运行中</>
              ) : (
                <><AlertTriangle className="size-5 text-amber-600" />已停止</>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">已注册任务</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{status?.jobCount ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">最近 Tick</div>
            <div className="text-2xl font-semibold mt-1 flex items-center gap-2">
              <Clock className="size-5 text-slate-500" />
              <span className="text-base font-normal text-muted-foreground">{fmtRelative(status?.lastTickAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Job list ──────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">任务列表</CardTitle>
            <CardDescription>点击行查看运行历史；点击 ▶ 立即运行一次。</CardDescription>
          </CardHeader>
          <CardContent>
            {status?.jobs.length ? (
              <div className="divide-y -mx-3">
                {status.jobs.map((j) => (
                  <button
                    key={j.name}
                    onClick={() => setSelectedName(j.name)}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 ${
                      selectedName === j.name ? "bg-violet-50" : ""
                    }`}
                  >
                    <span className={`size-2 rounded-full ${j.enabled ? "bg-green-500" : "bg-slate-300"}`} />
                    <code className="text-xs font-medium flex-1 truncate">{j.name}</code>
                    <code className="text-[10px] text-muted-foreground tabular-nums">{j.cron}</code>
                    {isBuiltin(j.name) && <Badge variant="outline" className="text-[9px]">built-in</Badge>}
                    {!j.enabled && <Badge variant="secondary" className="text-[9px]">disabled</Badge>}
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="size-7"
                      onClick={(e) => { e.stopPropagation(); trigger(j.name); }}
                      title="立即运行"
                    >
                      <Zap className="size-3.5 text-amber-600" />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="size-7"
                      onClick={(e) => { e.stopPropagation(); toggle(j); }}
                      title={j.enabled ? "停用" : "启用"}
                    >
                      {j.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="size-7"
                      onClick={(e) => { e.stopPropagation(); remove(j); }}
                      disabled={isBuiltin(j.name)}
                      title={isBuiltin(j.name) ? "内置任务受保护" : "撤销注册"}
                    >
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed rounded">
                暂无任务
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Runs of selected job ──────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              运行历史
              {selectedName && <code className="text-xs text-muted-foreground">{selectedName}</code>}
            </CardTitle>
            <CardDescription>最近 20 条记录，包含状态、耗时与错误信息。</CardDescription>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />加载中…
              </div>
            ) : runs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                暂无运行记录（首次 cron tick 后会自动出现）
              </div>
            ) : (
              <div className="space-y-1.5">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    {r.status === "ok" ? (
                      <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />
                    ) : r.status === "error" ? (
                      <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                    ) : (
                      <Loader2 className="size-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="text-muted-foreground tabular-nums">{fmtRelative(r.started_at)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="tabular-nums">{r.duration_ms ?? "—"}ms</span>
                    {r.error && (
                      <span className="text-red-600 truncate" title={r.error}>
                        {r.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建定时任务</DialogTitle>
            <DialogDescription>
              5 字段 cron 表达式（分 时 日 月 周），例如 <code>*/5 * * * *</code> 表示每 5 分钟一次。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">任务名称</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my.heartbeat" />
            </div>
            <div>
              <Label className="text-sm">Cron 表达式</Label>
              <Input value={newCron} onChange={(e) => setNewCron(e.target.value)} />
              <div className="flex gap-1 mt-2 flex-wrap">
                {["*/1 * * * *", "*/5 * * * *", "0 * * * *", "0 0 * * *"].map((c) => (
                  <Button key={c} type="button" variant="outline" size="sm" onClick={() => setNewCron(c)}>
                    {c}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">任务类型</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" size="sm" variant={newKind === "log" ? "default" : "outline"} onClick={() => setNewKind("log")}>
                  log（写一行结构化日志）
                </Button>
                <Button type="button" size="sm" variant={newKind === "webhook" ? "default" : "outline"} onClick={() => setNewKind("webhook")}>
                  webhook（HTTP POST）
                </Button>
              </div>
            </div>
            {newKind === "webhook" && (
              <div>
                <Label className="text-sm">Webhook URL</Label>
                <Input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://example.com/cron-endpoint" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>取消</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              注册任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// local helper — keeps the page file standalone without importing cn from
// elsewhere just for two classnames.
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}