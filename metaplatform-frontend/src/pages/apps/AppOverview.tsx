import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard, PageHeader } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { appsApi, versionsApi, adminApi, type Application } from "@/lib/api";
import { Box, FileText, GitBranch, Users, Calendar, Dna, Loader2, AlertCircle, Upload, TrendingUp, Plus, Workflow, Eye, Zap, CheckCircle, Trash2, ArrowLeft, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function AppOverview() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowCodeDialogOpen, setLowCodeDialogOpen] = useState(false);

  // Real version data
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Real activity logs
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Delete app state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    appsApi
      .get(appId)
      .then((data) => {
        if (!cancelled) setApp(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "加载应用详情失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  // Fetch versions from backend
  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    setVersionsLoading(true);
    versionsApi
      .listByApp(appId)
      .then((data) => {
        if (!cancelled && data) setVersions(data);
      })
      .catch(() => {
        // keep empty, fallback to placeholder UI
      })
      .finally(() => {
        if (!cancelled) setVersionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [appId]);

  // Fetch activity logs from backend
  useEffect(() => {
    let cancelled = false;
    setLogsLoading(true);
    adminApi
      .listLogs(5, 0)
      .then((data) => {
        if (!cancelled && data) setActivityLogs(data);
      })
      .catch(() => {
        // keep empty, fallback to placeholder UI
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Delete app handler
  const handleDeleteApp = async () => {
    if (!appId) return;
    setDeleting(true);
    try {
      await appsApi.delete(appId);
      navigate("/apps");
    } catch (err) {
      console.error("删除应用失败:", err);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在加载应用详情...</p>
      </div>
    );
  }

  // Error state
  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm text-destructive">{error || "应用不存在"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={app.name}
        description={`${app.description || "暂无描述"} · v${app.version} · ${app.category}`}
        action={
          <div className="flex gap-2">
            {/* F4.4.9.2 升级到 LowCode */}
            <Button variant="outline" onClick={() => setLowCodeDialogOpen(true)}>
              <Zap className="size-4 mr-1" /> 升级到 LowCode
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="size-4 mr-1" /> 删除应用
            </Button>
            <Badge variant={app.status === "published" ? "default" : "secondary"}>
              {app.status === "published" ? "已发布" : app.status === "active" ? "运行中" : app.status}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="对象数" value={app.objects_count ?? 0} icon={<Dna className="size-5" />} />
        <StatCard label="页面数" value={app.pages_count ?? 0} icon={<FileText className="size-5" />} />
        <StatCard label="流程数" value={app.flows_count ?? 0} icon={<GitBranch className="size-5" />} />
        <StatCard label="版本" value={app.version} icon={<Calendar className="size-5" />} />
      </div>

      {/* F4.2.5 快速入口 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/pages`)}>
          <Plus className="size-4" /> 新建页面
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/data-modeling`)}>
          <Dna className="size-4" /> 新建对象
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/workflows`)}>
          <Workflow className="size-4" /> 新建流程
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/publish`)}>
          <Upload className="size-4" /> 发布
        </Button>
        {app.status === "published" && (
          <Button
            variant="default"
            className="gap-2 h-auto py-3"
            onClick={() => {
              const url = app.published_url || (app.app_slug ? `/published/${app.app_slug}` : null);
              if (url) window.open(url, "_blank");
            }}
            disabled={!app.published_url && !app.app_slug}
          >
            <ExternalLink className="size-4" /> 查看已发布应用
          </Button>
        )}
      </div>

      {/* F5.2 独立运行环境 — isolated runtime status card + degraded banner */}
      <RuntimeEnvironment app={app} />

      {/* F4.2.4 应用活跃度 + F4.2.3 最近发布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity trend - CSS-based */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4" /> 应用活跃度
            </CardTitle>
            <CardDescription>最近活动趋势</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-16">
              {[35, 55, 42, 68, 50, 75, 60].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/70 transition-all hover:bg-primary"
                  style={{ height: `${h}%` }}
                  title={`${["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i]}: ${h} 次操作`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
              {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent publications - from versions API */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-4" /> 最近发布
            </CardTitle>
            <CardDescription>app_publications 最近记录</CardDescription>
          </CardHeader>
          <CardContent>
            {versionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length > 0 ? (
              <ul className="space-y-3 text-sm">
                {versions.slice(0, 3).map((v: any, i: number) => (
                  <li key={i} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <Eye className="size-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">v{v.version || v.version_number || "1.0.0"}</span>
                        <span className="text-muted-foreground ml-2">{v.environment || v.env || "生产"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-green-600">
                        {v.status === "success" || v.status === "published" ? "成功" : v.status || "成功"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{(v.created_at || v.date || "").slice(0, 10)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
                <Upload className="size-6 mb-2" />
                暂无发布记录
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">最近活动</TabsTrigger>
          <TabsTrigger value="deploy">部署记录</TabsTrigger>
          <TabsTrigger value="settings">应用设置</TabsTrigger>
        </TabsList>
        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近活动</CardTitle>
              <CardDescription>最近的操作记录</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : activityLogs.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {activityLogs.slice(0, 5).map((log: any, i: number) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs w-16 shrink-0">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      <span>{log.description || log.action || JSON.stringify(log)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3">
                    <span className="text-muted-foreground">暂无活动记录</span>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="deploy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">部署记录</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="size-4 text-green-500" />
                    <span>v2.3 生产环境</span>
                  </div>
                  <span className="text-muted-foreground text-xs">2026-07-01</span>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="size-4 text-green-500" />
                    <span>v2.2 生产环境</span>
                  </div>
                  <span className="text-muted-foreground text-xs">2026-06-15</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用设置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">应用 ID</span>
                  <span className="font-mono">{app.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">分类</span>
                  <span>{app.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">状态</span>
                  <Badge variant={app.status === "published" ? "default" : "secondary"}>
                    {app.status}
                  </Badge>
                </div>
                {app.created_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>{app.created_at}</span>
                  </div>
                )}
                {app.updated_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最后更新</span>
                    <span>{app.updated_at}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* LowCode Upgrade Confirmation Dialog */}
      <Dialog open={lowCodeDialogOpen} onOpenChange={setLowCodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-yellow-500" /> 升级到 LowCode 模式
            </DialogTitle>
            <DialogDescription>
              升级后将解锁完整的低代码开发能力，包括自定义组件、高级数据建模、API 编排等
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">升级后将获得以下能力:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> 自定义页面组件与布局
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> 高级数据模型与关联关系
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> API 编排与自定义逻辑
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> VibeCoding AI 代码生成
                </li>
              </ul>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              注意: 升级操作不可逆。升级后应用将切换到 LowCode 开发模式。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLowCodeDialogOpen(false)}>取消</Button>
            <Button onClick={() => setLowCodeDialogOpen(false)}>
              <Zap className="size-4 mr-1" /> 确认升级
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete App Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" /> 删除应用
            </DialogTitle>
            <DialogDescription>
              确定要删除应用「{app.name}」吗？此操作将删除应用及其所有页面、对象和流程数据，且不可恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
            警告: 此操作不可逆。应用的所有数据将被永久删除。
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteApp} disabled={deleting}>
              {deleting ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="size-4 mr-1" />
              )}
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * F5.2 Runtime Environment card.
 *
 * Shows whether the published app is running in its own docker
 * container, and surfaces a yellow banner when the platform has to
 * serve the snapshot out of its own process (docker daemon down).
 */
function RuntimeEnvironment({ app }: { app: Application }) {
  const [runtime, setRuntime] = useState<{
    state: string;
    running?: boolean;
    port?: number | null;
    containerId?: string | null;
    startedAt?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (app.status !== "published" || !app.id) {
      setRuntime(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    appsApi
      .getRuntime(app.id)
      .then((res) => {
        if (cancelled) return;
        setRuntime({
          state: res?.runtime?.state ?? "absent",
          running: res?.runtime?.running,
          port: res?.runtime?.port ?? null,
          containerId: res?.runtime?.containerId ?? app.runtime_container_id ?? null,
          startedAt: res?.runtime?.startedAt,
          error: res?.runtime?.error,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to whatever is persisted on the application row.
        setRuntime({
          state: app.runtime_container_id ? "persisted" : "absent",
          port: app.runtime_port ?? null,
          containerId: app.runtime_container_id ?? null,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [app.id, app.status, app.runtime_container_id, app.runtime_port]);

  if (app.status !== "published") return null;

  const isDegraded = (runtime?.error && !runtime?.running) || app.runtime_mode === "degraded";
  const isContainer = (runtime?.running || app.runtime_mode === "container") && runtime?.containerId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Box className="size-4" /> 独立运行环境
        </CardTitle>
        <CardDescription>
          已发布的应用跑在一个独立 Docker 容器里，与主平台互不影响
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isDegraded && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 text-yellow-900 px-3 py-2 text-xs flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">运行环境未隔离（降级模式）</div>
              <div className="text-yellow-800/80 mt-0.5">
                Docker 守护进程不可达，平台正在用自己的进程直接读取该应用的发布快照文件。
                数据仍然是该应用专属的，但不再跑在独立容器里 — 启动 Docker 后重新发布即可恢复隔离。
                {runtime?.error ? <span className="block mt-1 opacity-70">({runtime.error})</span> : null}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">运行模式</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-block size-2 rounded-full ${
                  isContainer ? "bg-green-500" : isDegraded ? "bg-yellow-500" : "bg-zinc-400"
                }`}
              />
              <span className="font-medium">
                {isContainer ? "独立容器" : isDegraded ? "降级 (进程内)" : loading ? "查询中…" : "未启动"}
              </span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">容器 / 主机端口</div>
            <div className="mt-1 font-mono">
              {runtime?.port ? `${runtime.port} (→ 3000)` : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">容器 ID</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {runtime?.containerId
                ? runtime.containerId.slice(0, 12) + "…"
                : "—"}
            </div>
          </div>
        </div>

        {app.published_url && (
          <div className="text-xs text-muted-foreground pt-1 border-t">
            公开访问地址：<span className="font-mono">{window.location.origin}{app.published_url}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
