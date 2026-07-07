import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { appsApi, versionsApi, type Application } from "@/lib/api";
import {
  Box, GitBranch, CheckCircle2, ArrowRight, Rocket, History,
  Package, RotateCcw, Target, Loader2, AlertCircle, Copy, ExternalLink,
  Sliders, Users, Percent, Layers, Gauge, ArrowLeftRight, Scale, GitCompare,
  FastForward, Rewind, Eye, Plus, Save, RefreshCw, ChevronRight, Play,
  Upload,
} from "lucide-react";

const environments = [
  { name: "开发环境", color: "bg-blue-500", status: "running" },
  { name: "测试环境", color: "bg-yellow-500", status: "running" },
  { name: "预览环境", color: "bg-purple-500", status: "running" },
  { name: "生产环境", color: "bg-green-500", status: "running" },
];

/* ── Mock tenants for grayscale ── */
// TODO: Replace with real API when backend ready (appsApi does not have tenants listing endpoint)
const MOCK_TENANTS = [
  { id: "t1", name: "阿里云", plan: "企业版" },
  { id: "t2", name: "腾讯云", plan: "企业版" },
  { id: "t3", name: "华为云", plan: "标准版" },
  { id: "t4", name: "字节跳动", plan: "企业版" },
  { id: "t5", name: "美团", plan: "标准版" },
  { id: "t6", name: "京东", plan: "企业版" },
  { id: "t7", name: "拼多多", plan: "标准版" },
  { id: "t8", name: "网易", plan: "标准版" },
];

/* ── Fallback version history (API 失败时使用) ── */
const VERSIONS_FALLBACK = [
  { version: "1.3.0", date: "2026-07-04", traffic: 70, status: "primary", parallel: false },
  { version: "1.2.0", date: "2026-06-20", traffic: 30, status: "running", parallel: true },
  { version: "1.1.0", date: "2026-05-15", traffic: 0, status: "archived", parallel: false },
  { version: "1.0.0", date: "2026-04-01", traffic: 0, status: "archived", parallel: false },
];

export default function AppPublish() {
  const { appId } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPublished = app?.status === "published";

  /* ── Grayscale release state ── */
  const [grayStrategy, setGrayStrategy] = useState("percent");
  const [grayPercent, setGrayPercent] = useState(0);
  const [grayTenants, setGrayTenants] = useState<string[]>([]);
  const [grayActive, setGrayActive] = useState(false);
  const [grayConfirmOpen, setGrayConfirmOpen] = useState(false);
  const [grayAction, setGrayAction] = useState<"start" | "promote" | "rollback" | null>(null);
  const [grayToast, setGrayToast] = useState<string | null>(null);

  /* ── Version management state ── */
  const [versions, setVersions] = useState(VERSIONS_FALLBACK);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[string, string]>(["1.3.0", "1.2.0"]);

  /* ── Gray release toast ── */
  useEffect(() => {
    if (!grayToast) return;
    const t = setTimeout(() => setGrayToast(null), 2500);
    return () => clearTimeout(t);
  }, [grayToast]);

  // Fetch app data
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
        if (!cancelled) setError(err.message || "加载应用信息失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  // Fetch versions from API
  useEffect(() => {
    if (!appId) return;
    versionsApi.listByApp(appId).then((data) => {
      if (data && data.length > 0) {
        setVersions(data.map((v: any, idx: number) => ({
          version: v.version,
          date: new Date(v.created_at).toLocaleDateString("zh-CN"),
          traffic: idx === 0 ? 70 : idx === 1 ? 30 : 0,
          status: idx === 0 ? "primary" : v.status === "published" ? "running" : "archived",
          parallel: idx === 1,
        })));
      }
    }).catch(() => {});
  }, [appId]);

  // Load existing gray release config from API
  useEffect(() => {
    if (!appId) return;
    appsApi.getGrayConfig(appId).then((config) => {
      if (config) {
        setGrayStrategy(config.strategy || "percent");
        setGrayPercent(config.percentage || 0);
        setGrayTenants(config.tenants || []);
        if ((config.percentage || 0) > 0) setGrayActive(true);
      }
    }).catch(() => {});
  }, [appId]);

  // Publish handler
  const handlePublish = async () => {
    if (!appId) return;
    setPublishing(true);
    try {
      const result = await appsApi.publish(appId);
      // The publish response now carries a `runtime` block describing
      // whether the platform spawned a dedicated docker container
      // (mode = "container") or fell back to reading the snapshot
      // directly because the docker daemon is unreachable
      // (mode = "degraded"). Surface that to the user immediately so
      // they know what kind of environment they got.
      if (result && result.runtime) {
        if (result.runtime.mode === "container") {
          setGrayToast(`已部署到独立容器 (端口 ${result.runtime.port})`);
        } else {
          setGrayToast("已发布 — 运行环境未隔离（Docker 不可达，降级模式）");
        }
      }
      // Refresh app data after publishing
      const refreshed = await appsApi.get(appId);
      setApp(refreshed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "发布失败";
      setError(message);
    } finally {
      setPublishing(false);
    }
  };

  // Unpublish handler
  const handleUnpublish = async () => {
    if (!appId) return;
    setUnpublishing(true);
    try {
      await appsApi.unpublish(appId);
      const refreshed = await appsApi.get(appId);
      setApp(refreshed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "取消发布失败";
      setError(message);
    } finally {
      setUnpublishing(false);
    }
  };

  // Copy published URL
  const handleCopyLink = () => {
    if (!app?.app_slug) return;
    const url = `${window.location.origin}/app/${app.app_slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Grayscale release handlers ── */
  function handleGrayAction(action: "start" | "promote" | "rollback") {
    setGrayAction(action);
    setGrayConfirmOpen(true);
  }

  function confirmGrayAction() {
    if (grayAction === "start") {
      const newPct = 10;
      setGrayActive(true);
      setGrayPercent(newPct);
      // Persist to backend
      if (appId) {
        appsApi.setGrayConfig(appId, { strategy: grayStrategy, percentage: newPct, tenants: grayTenants }).catch(() => {});
      }
      setGrayToast("灰度发布已启动，当前流量 10%");
    } else if (grayAction === "promote") {
      setGrayPercent(100);
      setGrayActive(false);
      if (appId) {
        appsApi.setGrayConfig(appId, { strategy: grayStrategy, percentage: 100, tenants: grayTenants }).catch(() => {});
      }
      setGrayToast("已全量发布，灰度结束");
    } else if (grayAction === "rollback") {
      setGrayPercent(0);
      setGrayActive(false);
      if (appId) {
        // Use the first non-primary active version for rollback, or reset gray config
        const rollbackVersion = versions.find((v) => v.status === "running");
        if (rollbackVersion) {
          // Find version id from API if available - for now just reset gray config
          appsApi.setGrayConfig(appId, { strategy: grayStrategy, percentage: 0, tenants: [] }).catch(() => {});
        } else {
          appsApi.setGrayConfig(appId, { strategy: grayStrategy, percentage: 0, tenants: [] }).catch(() => {});
        }
      }
      setGrayToast("灰度已回滚");
    }
    setGrayConfirmOpen(false);
    setGrayAction(null);
  }

  function handleGrayPercentChange(val: number) {
    setGrayPercent(val);
    if (val > 0 && val < 100) setGrayActive(true);
    if (val === 0) setGrayActive(false);
    // Persist gray config on slider change
    if (appId) {
      appsApi.setGrayConfig(appId, { strategy: grayStrategy, percentage: val, tenants: grayTenants }).catch(() => {});
    }
  }

  function handleToggleGrayTenant(tenantId: string) {
    setGrayTenants((prev) =>
      prev.includes(tenantId) ? prev.filter((t) => t !== tenantId) : [...prev, tenantId]
    );
  }

  /* ── Version management handlers ── */
  function handleToggleParallel(idx: number) {
    setVersions((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, parallel: !v.parallel } : v))
    );
  }

  function handleSwitchPrimary(idx: number) {
    setVersions((prev) =>
      prev.map((v, i) => ({
        ...v,
        status: i === idx ? "primary" : v.status === "primary" ? "running" : v.status,
      }))
    );
    setGrayToast(`已切换主版本为 ${versions[idx].version}`);
  }

  function handleTrafficChange(idx: number, val: number) {
    setVersions((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, traffic: val } : v))
    );
  }

  function handleOpenCompare() {
    setCompareOpen(true);
  }

  async function handleVersionRollback(versionStr: string) {
    if (!appId) return;
    try {
      // Find the version record by version string from the API
      const versionData = await versionsApi.listByApp(appId);
      const target = versionData?.find((v: any) => v.version === versionStr);
      if (target) {
        await appsApi.rollback(appId, { versionId: target.id });
        // Refresh app data
        const refreshed = await appsApi.get(appId);
        setApp(refreshed);
        setGrayToast(`已回滚到版本 ${versionStr}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "回滚失败";
      setGrayToast(message);
    }
  }

  const publishedUrl = app?.app_slug
    ? `${window.location.origin}/app/${app.app_slug}`
    : null;

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在加载应用信息...</p>
      </div>
    );
  }

  // Error state (initial load)
  if (!app) {
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
        title="应用发布"
        description={isPublished ? `已发布 · slug: ${app.app_slug ?? "N/A"}` : "未发布"}
        action={
          <div className="flex gap-2">
            {isPublished ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleUnpublish}
                disabled={unpublishing}
              >
                {unpublishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                {unpublishing ? "取消发布中..." : "取消发布"}
              </Button>
            ) : (
              <Button
                className="gap-2"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                {publishing ? "发布中..." : "发布新版本"}
              </Button>
            )}
          </div>
        }
      />

      {/* Error message for actions */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            关闭
          </Button>
        </div>
      )}

      {/* Published URL card */}
      <RuntimeHealthBanner />

      {isPublished && publishedUrl && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ExternalLink className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">已发布访问地址</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {publishedUrl}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="size-4 mr-1" />
                  {copied ? "已复制" : "复制链接"}
                </Button>
                <Button variant="default" size="sm" asChild>
                  <a href={`/app/${app.app_slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 mr-1" />
                    访问
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="当前版本"
          value={app.version}
          icon={<Package className="size-5" />}
        />
        <StatCard
          label="发布状态"
          value={isPublished ? "已发布" : "未发布"}
          icon={<Rocket className="size-5" />}
        />
        <StatCard
          label="对象数"
          value={app.objects_count ?? 0}
          icon={<GitBranch className="size-5" />}
        />
        <StatCard
          label="页面数"
          value={app.pages_count ?? 0}
          icon={<Box className="size-5" />}
        />
      </div>

      <PublishedEnvironments appId={appId!} />

      {/* ── 灰度发布 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="size-4" /> 灰度发布
          </CardTitle>
          <CardDescription>按策略逐步放量，降低发布风险</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strategy select + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select value={grayStrategy} onValueChange={setGrayStrategy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">按比例</SelectItem>
                  <SelectItem value="tenant">按租户</SelectItem>
                  <SelectItem value="usergroup">按用户组</SelectItem>
                </SelectContent>
              </Select>
              {grayActive && (
                <Badge variant="default" className="gap-1">
                  <Gauge className="size-3" /> 灰度中
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleGrayAction("start")} disabled={grayActive}>
                <Play className="size-3 mr-1" /> 开始灰度
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleGrayAction("promote")} disabled={!grayActive}>
                <FastForward className="size-3 mr-1" /> 全量发布
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleGrayAction("rollback")} disabled={!grayActive}>
                <Rewind className="size-3 mr-1" /> 回滚灰度
              </Button>
            </div>
          </div>

          {/* Percentage strategy */}
          {grayStrategy === "percent" && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm">流量分配</Label>
                <span className="text-sm font-mono font-medium">{grayPercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={grayPercent}
                onChange={(e) => handleGrayPercentChange(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Tenant strategy */}
          {grayStrategy === "tenant" && (
            <div className="space-y-3 p-4 border rounded-lg">
              <Label className="text-sm">选择灰度租户</Label>
              <div className="grid grid-cols-2 gap-2">
                {MOCK_TENANTS.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={grayTenants.includes(t.id)}
                      onCheckedChange={() => handleToggleGrayTenant(t.id)}
                    />
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.plan}</div>
                    </div>
                  </label>
                ))}
              </div>
              {grayTenants.length > 0 && (
                <div className="text-xs text-muted-foreground">已选择 {grayTenants.length} 个租户</div>
              )}
            </div>
          )}

          {/* User group strategy */}
          {grayStrategy === "usergroup" && (
            <div className="space-y-3 p-4 border rounded-lg">
              <Label className="text-sm">用户组</Label>
              <div className="grid grid-cols-3 gap-2">
                {["内测用户", "VIP 用户", "企业管理员", "普通用户", "开发者", "运营"].map((g) => (
                  <label key={g} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                    <Checkbox />
                    <span className="text-sm">{g}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Gray release status */}
          {grayActive && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="text-center">
                <div className="text-lg font-semibold text-primary">{grayPercent}%</div>
                <div className="text-xs text-muted-foreground">当前流量</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{grayStrategy === "tenant" ? grayTenants.length : "--"}</div>
                <div className="text-xs text-muted-foreground">受影响租户</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-500">正常</div>
                <div className="text-xs text-muted-foreground">健康状态</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 版本管理 ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="size-4" /> 版本管理
              </CardTitle>
              <CardDescription>管理多版本并行运行和流量分配</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenCompare}>
              <GitCompare className="size-3 mr-1" /> 版本对比
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {versions.map((v, idx) => (
              <div key={v.version} className={`border rounded-lg p-4 space-y-3 ${v.status === "primary" ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-sm font-medium">v{v.version}</div>
                    <Badge variant={v.status === "primary" ? "default" : v.status === "running" ? "secondary" : "outline"}>
                      {v.status === "primary" ? "主版本" : v.status === "running" ? "运行中" : "已归档"}
                    </Badge>
                    {v.parallel && (
                      <Badge variant="outline" className="text-xs">
                        <ArrowLeftRight className="size-3 mr-1" /> 并行运行
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{v.date}</span>
                    {v.status !== "archived" && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">并行</Label>
                        <Switch
                          checked={v.parallel}
                          onCheckedChange={() => handleToggleParallel(idx)}
                          disabled={v.status === "archived"}
                        />
                      </div>
                    )}
                    {v.status !== "primary" && v.status !== "archived" && (
                      <Button variant="outline" size="sm" onClick={() => handleSwitchPrimary(idx)}>
                        切换主版本
                      </Button>
                    )}
                    {v.status === "archived" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleVersionRollback(v.version)}
                      >
                        <RotateCcw className="size-3 mr-1" /> 版本回滚
                      </Button>
                    )}
                  </div>
                </div>

                {/* Traffic split */}
                {v.status !== "archived" && (
                  <div className="flex items-center gap-4">
                    <Label className="text-xs w-16">流量分配</Label>
                    <div className="flex-1 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={v.traffic}
                        onChange={(e) => handleTrafficChange(idx, Number(e.target.value))}
                        className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        disabled={v.status === "archived"}
                      />
                      <span className="text-sm font-mono w-12 text-right">{v.traffic}%</span>
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`rounded-full h-2 transition-all ${v.status === "primary" ? "bg-primary" : "bg-blue-400"}`}
                        style={{ width: `${v.traffic}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Traffic summary bar */}
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
            <div className="text-xs text-muted-foreground mb-2">流量分配总览</div>
            <div className="flex rounded-full overflow-hidden h-3">
              {versions.filter((v) => v.traffic > 0).map((v) => (
                <div
                  key={v.version}
                  className={`h-full transition-all ${v.status === "primary" ? "bg-primary" : "bg-blue-400"}`}
                  style={{ width: `${v.traffic}%` }}
                  title={`v${v.version}: ${v.traffic}%`}
                />
              ))}
              {versions.reduce((s, v) => s + v.traffic, 0) < 100 && (
                <div className="h-full bg-muted flex-1" />
              )}
            </div>
            <div className="flex gap-4 mt-2">
              {versions.filter((v) => v.traffic > 0).map((v) => (
                <div key={v.version} className="flex items-center gap-1.5 text-xs">
                  <div className={`size-2 rounded-full ${v.status === "primary" ? "bg-primary" : "bg-blue-400"}`} />
                  v{v.version} ({v.traffic}%)
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 灰度确认对话框 ── */}
      <Dialog open={grayConfirmOpen} onOpenChange={setGrayConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {grayAction === "start" && "确认开始灰度发布"}
              {grayAction === "promote" && "确认全量发布"}
              {grayAction === "rollback" && "确认回滚灰度"}
            </DialogTitle>
            <DialogDescription>
              {grayAction === "start" && "将按照当前策略开始灰度发布，初始流量 10%"}
              {grayAction === "promote" && "将流量 100% 切换到新版本，结束灰度"}
              {grayAction === "rollback" && "将所有流量回退到上一个稳定版本"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {grayAction === "start" && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                <div>策略: {grayStrategy === "percent" ? "按比例" : grayStrategy === "tenant" ? "按租户" : "按用户组"}</div>
                {grayStrategy === "percent" && <div>初始流量: 10%</div>}
                {grayStrategy === "tenant" && <div>选中租户: {grayTenants.length || "全部"} 个</div>}
              </div>
            )}
            {grayAction === "rollback" && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                回滚操作将立即生效，所有用户将访问上一个稳定版本
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrayConfirmOpen(false)}>取消</Button>
            <Button
              variant={grayAction === "rollback" ? "destructive" : "default"}
              onClick={confirmGrayAction}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 版本对比对话框 ── */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="size-5" /> 版本对比
            </DialogTitle>
            <DialogDescription>对比两个版本之间的差异</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={compareVersions[0]} onValueChange={(v) => setCompareVersions([v, compareVersions[1]])}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {versions.map((ver) => (
                    <SelectItem key={ver.version} value={ver.version}>v{ver.version}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ArrowLeftRight className="size-4 text-muted-foreground" />
              <Select value={compareVersions[1]} onValueChange={(v) => setCompareVersions([compareVersions[0], v])}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {versions.map((ver) => (
                    <SelectItem key={ver.version} value={ver.version}>v{ver.version}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Simplified diff view */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">v{compareVersions[0]}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">发布日期</span><span>{versions.find((v) => v.version === compareVersions[0])?.date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">流量占比</span><span>{versions.find((v) => v.version === compareVersions[0])?.traffic}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">状态</span><span>{versions.find((v) => v.version === compareVersions[0])?.status === "primary" ? "主版本" : "运行中"}</span></div>
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">v{compareVersions[1]}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">发布日期</span><span>{versions.find((v) => v.version === compareVersions[1])?.date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">流量占比</span><span>{versions.find((v) => v.version === compareVersions[1])?.traffic}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">状态</span><span>{versions.find((v) => v.version === compareVersions[1])?.status === "primary" ? "主版本" : versions.find((v) => v.version === compareVersions[1])?.status === "archived" ? "已归档" : "运行中"}</span></div>
                </div>
              </div>
            </div>

            {/* Mock diff */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium border-b">变更摘要</div>
              <div className="p-3 space-y-1 font-mono text-xs">
                <div className="text-green-600">+ 新增字段: customer_type</div>
                <div className="text-green-600">+ 新增页面: 数据看板</div>
                <div className="text-orange-500">~ 修改流程: 采购审批增加财务节点</div>
                <div className="text-red-500">- 移除字段: legacy_status</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompareOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {grayToast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {grayToast}
        </div>
      )}
    </div>
  );
}

/**
 * PublishedEnvironments — replaces the old "开发/测试/预览/生产" mock
 * row. Each entry below is a real deployed environment (a row in
 * `app_publications`): the live production entry links to the running
 * isolated runtime, archived rows link to historical snapshots that
 * still resolve at their `/app/<slug>` URL.
 */
function PublishedEnvironments({ appId }: { appId: string }) {
  type Pub = {
    id: string;
    slug: string;
    published_url: string;
    published_version: string;
    created_at: string;
    environment: "production" | "archived";
    isLive: boolean;
  };

  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<{
    running: boolean;
    port: number | null;
    containerId: string | null;
    mode: string | null;
    error?: string;
  } | null>(null);

  const refresh = async () => {
    if (!appId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = (await appsApi.listPublications(appId)) as Pub[];
      setPubs(Array.isArray(rows) ? rows : []);
      const live = rows.find((r) => r.isLive);
      if (live) {
        try {
          const rt = await appsApi.getRuntime(appId);
          setRuntimeInfo({
            running: !!rt?.runtime?.running,
            port: rt?.runtime?.port ?? rt?.persisted?.port ?? null,
            containerId: rt?.runtime?.containerId ?? rt?.persisted?.containerId ?? null,
            mode: rt?.persisted?.mode ?? null,
            error: rt?.runtime?.error,
          });
        } catch {/* keep pubs but no live runtime info */}
      } else {
        setRuntimeInfo(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载发布环境失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  // Live re-poll when the user clicks publish/unpublish from the parent
  // component. The simpler path is to expose a refresh on window, but
  // that fights React — instead we just refresh on a 5s timer while
  // there are live publications.
  useEffect(() => {
    if (!pubs.some((p) => p.isLive)) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubs.some((p) => p.isLive)]);

  const liveBadge = (pub: Pub) => {
    if (pub.isLive) {
      if (runtimeInfo?.running) return { label: "运行中", color: "bg-green-500" };
      if (runtimeInfo?.mode === "degraded") return { label: "降级模式", color: "bg-yellow-500" };
      return { label: "已停止", color: "bg-zinc-400" };
    }
    return { label: "已归档", color: "bg-zinc-400" };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="size-4" /> 已发布环境
            </CardTitle>
            <CardDescription>
              每一行对应一个真实部署的运行环境，点击链接直达该版本的访问地址
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {loading && pubs.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && pubs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
            <Upload className="size-6 mb-2" />
            尚未发布，点击右上角"发布新版本"创建第一个环境
          </div>
        )}

        {pubs.map((pub) => {
          const badge = liveBadge(pub);
          const fullUrl = `${window.location.origin}${pub.published_url}`;
          return (
            <div
              key={pub.id}
              className="border rounded-lg p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
            >
              <div className="size-2 rounded-full shrink-0" data-color={badge.color} >
                <span className={`block size-2 rounded-full ${badge.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {pub.environment === "production" ? "生产环境" : `历史版本 v${pub.published_version}`}
                  </span>
                  <Badge variant="outline" className="text-xs">{badge.label}</Badge>
                  {pub.isLive && runtimeInfo?.mode === "degraded" && (
                    <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                      Docker 不可达
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1 truncate">
                  {fullUrl}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  发布于 {new Date(pub.created_at).toLocaleString("zh-CN")}
                  {pub.isLive && runtimeInfo?.port ? ` · 容器端口 ${runtimeInfo.port} → 3000` : null}
                  {pub.isLive && runtimeInfo?.containerId ? ` · 容器 ${runtimeInfo.containerId.slice(0, 12)}…` : null}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(fullUrl)}
                  title="复制链接"
                >
                  <Copy className="size-3" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  asChild
                >
                  <a href={pub.published_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3 mr-1" />
                    打开
                  </a>
                </Button>
                {!pub.isLive && pub.environment === "archived" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!appId) return;
                      if (!window.confirm(`将此版本 v${pub.published_version} 切换为生产环境？当前生产环境会被归档。`)) return;
                      try {
                        await appsApi.restorePublication(appId, pub.id);
                        await refresh();
                        window.alert("已切换为生产环境");
                      } catch (err) {
                        window.alert(`切换失败: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    }}
                    title="将此历史版本切换为生产环境"
                  >
                    <History className="size-3 mr-1" />
                    切换为主版本
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * RuntimeHealthBanner — platform-wide docker daemon health shown at
 * the top of the publish tab. Loads GET /api/runtime/health once
 * when the page mounts; subsequent visits refetch the request.
 *
 *  - `docker === "ok"`     -> hidden
 *  - `docker === "degraded"` -> yellow banner explaining that
 *    published apps will fall back to the in-process snapshot reader.
 */
function RuntimeHealthBanner() {
  type Health = { docker: "ok" | "degraded"; error?: string };
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    appsApi.getRuntimeHealth()
      .then((h) => { if (alive) setHealth(h as Health); })
      .catch(() => { if (alive) setHealth({ docker: "degraded", error: "health check failed" }); });
    return () => { alive = false; };
  }, []);

  if (!health || health.docker === "ok") return null;
  return (
    <div className="rounded-lg border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 flex items-start gap-3">
      <AlertCircle className="size-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
          运行时未隔离（Docker 不可达）
        </p>
        <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
          {health.error ? `原因: ${health.error}。` : ""}
          已发布的应用将以 <span className="font-mono">快照降级</span> 模式在平台进程内运行，进程内隔离（每个 app 单独的 sqlite 文件）但不再独立容器。
        </p>
      </div>
    </div>
  );
}
