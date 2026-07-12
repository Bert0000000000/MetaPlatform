import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard, PageHeader } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { appsApi, versionsApi, adminApi, appCollaboratorsApi, appFormsApi, appReportsApi, appDashboardsApi, appDatasetsApi, type Application, type AppCollaborator, type AppForm, type AppReport, type AppDashboard, type AppDataset } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Box, FileText, GitBranch, Users, Calendar, Dna, Loader2, AlertCircle, Upload, TrendingUp, Plus, Workflow, Eye, Zap, CheckCircle, Trash2, ArrowLeft, ExternalLink, Layers, ClipboardList, BarChart3, LayoutDashboard, Plug, Copy, Download, Pencil, Save, X, UserPlus, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

/** Local helper to safely parse audit_logs.detail (stored as JSON string) */
function safeParseJson(s: string | null | undefined): any | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

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

  /* ── P1: 内联编辑 (name / description / icon / status 等) ── */
  const [editingName, setEditingName] = useState(false);
  /* 当前正在回滚的 version.id, 控制按钮 loading */
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  /* ── P1: 复制应用对话框 ── */
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);

  /** 应用基本信息保存到后端 */
  const saveBasicInfo = async (patch: Partial<Application>) => {
    if (!appId) return;
    setSavingInfo(true);
    try {
      const updated = await appsApi.update(appId, patch);
      setApp((prev) => (prev ? { ...prev, ...updated } : prev));
      window.dispatchEvent(new CustomEvent("mp:apps-changed", { detail: { appId, kind: "update", patch } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingInfo(false);
    }
  };

  /** 开始编辑 (双击触发) */
  const beginEditName = () => {
    setNameDraft(app.name);
    setEditingName(true);
  };
  const beginEditDesc = () => {
    setDescDraft(app.description ?? "");
  };
  /** 保存名称修改 */
  const commitName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === app.name) {
      setEditingName(false);
      return;
    }
    await saveBasicInfo({ name: trimmed });
    setEditingName(false);
  };
  /** 保存描述修改 — blur 触发 */
  const commitDesc = async () => {
    if ((app.description ?? "") === descDraft) return;
    await saveBasicInfo({ description: descDraft });
  };

  /** P1: 复制应用 → 通过 NewAppWizard 走 POST /apps/clone */
  const handleClone = async () => {
    if (!appId) return;
    setCloning(true);
    try {
      const created = await appsApi.clone({
        sourceAppId: appId,
        name: (cloneName.trim() || `${app.name} (副本)`),
        description: app.description,
        category: app.category,
        icon: app.icon,
      });
      setCloneDialogOpen(false);
      window.dispatchEvent(new CustomEvent("mp:apps-changed", { detail: { appId: created.id, kind: "clone" } }));
      navigate(`/apps/${created.id}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "复制失败");
    } finally {
      setCloning(false);
    }
  };

  /** P1: 导出 — 触发下载 zip */
  const handleExport = async () => {
    if (!appId) return;
    try {
      const token = localStorage.getItem("mp_token") || "";
      const url = `/api/apps/${appId}/export`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        setError(`导出失败 (${resp.status})`);
        return;
      }
      // P1.5: 解析响应 — 若返回 JSON { fileName, manifest } 则 manifest-only; 若下载 zip
      const cd = resp.headers.get("content-disposition") ?? "";
      if (cd.includes("attachment") && resp.headers.get("content-type")?.includes("application/json")) {
        // manifest-only (没有真实 zip 文件); 让浏览器保存 manifest.json
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        const m = cd.match(/filename="?([^";]+)"?/);
        a.download = m?.[1] || `${app.name}-manifest.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      } else {
        // 包 zip 直接 download
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        const m = cd.match(/filename="?([^";]+)"?/);
        a.download = m?.[1] || `${app.name}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  };
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
    if (!appId) return;
    let cancelled = false;
    setLogsLoading(true);
    // P1: 改用 appsApi.activity(appId) — 显示本应用的活动 (audit_logs 已被 POST /apps 写入了)
    appsApi
      .activity(appId, 20)
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setActivityLogs(data as any);
      })
      .catch(() => {
        if (!cancelled) setActivityLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => { cancelled = true; };
  }, [appId]);

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
    <div className="flex flex-col gap-6 p-6 w-full">
      {/* P1: 应用名 + 描述 内联编辑 */}
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                disabled={savingInfo}
                className="text-xl font-semibold h-9 max-w-md"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={commitName} disabled={savingInfo}>
                <Save className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <h1
              className="text-2xl font-semibold tracking-tight cursor-pointer hover:bg-muted/40 px-2 py-1 -mx-2 -my-1 rounded inline-block"
              onDoubleClick={beginEditName}
              onClick={() => beginEditName()}
              title="点击编辑名称"
            >
              {app.name}
            </h1>
          )}
          <textarea
            defaultValue={app.description ?? ""}
            key={app.description ?? ""}
            onFocus={beginEditDesc}
            onBlur={commitDesc}
            placeholder="点击添加应用描述..."
            rows={2}
            className="mt-2 w-full text-sm text-muted-foreground bg-transparent border-none resize-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1"
          />
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground px-2">
            <span>v{app.version}</span>
            <span>·</span>
            <span>{app.category}</span>
            {app.environment && <><span>·</span><span>{app.environment}</span></>}
            {app.owner_id && <><span>·</span><span className="font-mono">owner: {app.owner_id.slice(0, 8)}</span></>}
            <Badge variant={app.status === "published" ? "default" : "secondary"}>
              {app.status === "published" ? "已发布" : app.status === "active" ? "运行中" : app.status}
            </Badge>
          </div>
        </div>
      </div>
      <PageHeader
        title=""
        description=""
        action={
          <div className="flex gap-2 flex-wrap items-center">
            {/* P1: 状态机迁移 */}
            <StatusTransitionControls app={app} setApp={setApp} setError={setError} />
            <Button variant="outline" size="sm" onClick={() => setLowCodeDialogOpen(true)}>
              <Zap className="size-3.5 mr-1" /> 升级到 LowCode
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCloneDialogOpen(true)}>
              <Copy className="size-3.5 mr-1" /> 复制
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-3.5 mr-1" /> 导出
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/apps/${appId}/pages`)}
              title="进入页面编辑器"
            >
              <Pencil className="size-3.5 mr-1" /> 进入设计器
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="size-3.5 mr-1" /> 删除应用
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <StatCard label="对象数" value={app.objects_count ?? 0} icon={<Dna className="size-3" />} />
        <StatCard label="页面数" value={app.pages_count ?? 0} icon={<FileText className="size-3" />} />
        <StatCard label="模块数" value={app.modules_count ?? 0} icon={<Layers className="size-3" />} />
        <StatCard label="表单" value={app.forms_count ?? 0} icon={<ClipboardList className="size-3" />} />
        <StatCard label="报表" value={app.reports_count ?? 0} icon={<BarChart3 className="size-3" />} />
        <StatCard label="仪表盘" value={app.dashboards_count ?? 0} icon={<LayoutDashboard className="size-3" />} />
        <StatCard label="集成" value={app.integrations_count ?? 0} icon={<Plug className="size-3" />} />
        <StatCard label="流程数" value={app.flows_count ?? 0} icon={<GitBranch className="size-3" />} />
        <StatCard label="版本" value={app.version} icon={<Calendar className="size-3" />} />
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
            <div className="flex gap-1 h-20">
              {[35, 55, 42, 68, 50, 75, 60].map((h, i) => (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground leading-none">{h}</span>
                  <div
                    className="w-full rounded-t bg-primary/70 transition-all hover:bg-primary"
                    style={{ height: `${h}%` }}
                    title={`${["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i]}: ${h} 次操作`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1 px-0.5">
              {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent publications - from versions API (app_versions) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-4" /> 版本历史
            </CardTitle>
            <CardDescription>app_versions 表，最新 5 条，含一键回滚</CardDescription>
          </CardHeader>
          <CardContent>
            {versionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {versions.slice(0, 5).map((v: any) => (
                  <li key={v.id ?? v.version_id} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <Eye className="size-4 text-muted-foreground" />
                      <div className="leading-tight">
                        <div className="font-medium">v{v.version}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[260px]" title={v.description || v.commit_message}>
                          {v.description || v.commit_message || "(无描述)"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{v.status}</Badge>
                      <span className="text-xs text-muted-foreground">{(v.created_at || "").slice(0, 10)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={rollingBack === v.id}
                        onClick={async () => {
                          if (!appId || !v.id) return;
                          if (!window.confirm(`回滚到版本 v${v.version}？该操作会撤销当前版本的运行实例。`)) return;
                          setRollingBack(v.id);
                          try {
                            await appsApi.rollback(appId, { versionId: v.id });
                            // 重新 fetch stats 和应用
                            appsApi.get(appId).then(setApp).catch(() => {});
                            window.dispatchEvent(new CustomEvent("mp:apps-changed", { detail: { appId, kind: "rollback", version: v.version } }));
                            window.dispatchEvent(new CustomEvent("mp:configs-changed", { detail: { appId, kind: "rollback" } }));
                            toast.success(`已回滚到 v${v.version}`);
                          } catch (e) {
                            toast.error("回滚失败: " + (e instanceof Error ? e.message : String(e)));
                          } finally {
                            setRollingBack(null);
                          }
                        }}
                        title="回滚到此版本"
                      >
                        {rollingBack === v.id ? <Loader2 className="size-3 animate-spin" /> : "回滚"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
                <Upload className="size-6 mb-2" />
                暂无版本记录（创建应用时会自动初始化 v0.1）
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">最近活动</TabsTrigger>
          <TabsTrigger value="pages">页面</TabsTrigger>
          <TabsTrigger value="forms">表单</TabsTrigger>
          <TabsTrigger value="datasets">数据集</TabsTrigger>
          <TabsTrigger value="reports">报表</TabsTrigger>
          <TabsTrigger value="dashboards">仪表盘</TabsTrigger>
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
                  {activityLogs.slice(0, 8).map((log: any) => {
                    const detail = log.detail ? safeParseJson(log.detail) : null;
                    const desc =
                      detail && detail.name
                        ? `${log.action === "create" ? "新建" : log.action === "update" ? "更新" : log.action === "delete" ? "删除" : log.action}: ${detail.name}`
                        : (log.description || log.action || JSON.stringify(log));
                    return (
                      <li key={log.id ?? `${log.created_at}-${Math.random()}`} className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs w-16 shrink-0">
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                        <span className="flex-1 truncate">{desc}</span>
                        {log.user_name && <span className="text-xs text-muted-foreground">{log.user_name}</span>}
                      </li>
                    );
                  })}
                  {activityLogs.length > 8 && (
                    <li className="text-xs text-muted-foreground">
                      查看完整活动：<button className="underline" onClick={() => window.open(`/admin/logs?app_id=${appId}`, "_blank")}>审计中心</button>
                    </li>
                  )}
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
        {/* P4-4: Pages Tab Content — 列出应用全部 page, 显示类型徽章 + 关联 ID */}
        <TabsContent value="pages" className="mt-4">
          <PagesListTab appId={app.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          {/* P1: 应用设置可编辑 — category / icon / environment / tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用设置</CardTitle>
              <CardDescription>分类 / 图标 / 环境与标签均可修改（点击右侧值即可）。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField label="应用 ID" value={app.id} readOnly mono />
              <EditableSelectField
                label="分类"
                value={app.category}
                options={[
                  "traditional", "business", "lowcode", "dashboard", "workflow", "custom",
                  "bi", "bpm", "crm", "hr", "ops", "kb", "form", "report",
                ]}
                onSave={(v) => saveBasicInfo({ category: String(v) })}
                disabled={savingInfo}
              />
              <EditableSelectField
                label="环境"
                value={app.environment || "dev"}
                options={["dev", "test", "staging", "prod"]}
                onSave={(v) => saveBasicInfo({ environment: String(v) })}
                disabled={savingInfo}
              />
              <EditableField
                label="图标"
                value={app.icon ?? ""}
                placeholder="如 📦 或 emoji"
                onSave={(v) => saveBasicInfo({ icon: String(v) })}
                disabled={savingInfo}
              />

              {/* P1: Tags CRUD */}
              <TagEditor
                tags={app.tags || []}
                disabled={savingInfo}
                onSave={(next) => saveBasicInfo({ tags: next })}
              />

              <div className="flex justify-between">
                <span className="text-muted-foreground">状态</span>
                <Badge variant={app.status === "published" ? "default" : "secondary"}>{app.status}</Badge>
              </div>

              {/* P1: Owner 显示 — 替换原来 owner_id 前 8 位 */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">拥有者</span>
                <span className="flex items-center gap-2">
                  {app.owner_name && <span>{app.owner_name}</span>}
                  {app.owner_email && (
                    <a href={`mailto:${app.owner_email}`} className="text-xs text-muted-foreground hover:underline">
                      {app.owner_email}
                    </a>
                  )}
                  {!app.owner_name && app.owner_id && <span className="font-mono text-xs">{String(app.owner_id).slice(0, 12)}</span>}
                  {!app.owner_name && !app.owner_id && <span className="text-muted-foreground">无</span>}
                </span>
              </div>

              {app.created_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">创建时间</span>
                  <span className="text-xs">{new Date(app.created_at).toLocaleString("zh-CN")}</span>
                </div>
              )}
              {app.updated_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最后更新</span>
                  <span className="text-xs">{new Date(app.updated_at).toLocaleString("zh-CN")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* P2-1: 协作成员 */}
          <CollaboratorsCard appId={app.id} />
          {/* P2-3: 公开访问别名 */}
          <PublicAliasesCard appId={app.id} />
        </TabsContent>

        {/* P0-7: 表单 Tab */}
        <TabsContent value="forms" className="mt-4">
          <FormsListTab appId={app.id} />
        </TabsContent>

        {/* P0-7: 数据集 Tab */}
        <TabsContent value="datasets" className="mt-4">
          <DatasetsListTab appId={app.id} />
        </TabsContent>

        {/* P0-7: 报表 Tab */}
        <TabsContent value="reports" className="mt-4">
          <ReportsListTab appId={app.id} />
        </TabsContent>

        {/* P0-7: 仪表盘 Tab */}
        <TabsContent value="dashboards" className="mt-4">
          <DashboardsListTab appId={app.id} />
        </TabsContent>
      </Tabs>

      {/* P1: 复制应用对话框 */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>复制应用</DialogTitle>
            <DialogDescription>
              将当前应用的页面 / 模块 / 配置 / 集成等全部复制到新应用。
              注意：集成中的密钥字段会被清空并禁用，请到新应用的 AppConfig 重新配。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">新应用名称</label>
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder={`${app.name} (副本)`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>取消</Button>
            <Button onClick={handleClone} disabled={cloning}>
              {cloning ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Copy className="size-4 mr-1" />}
              复制并跳到新应用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="p-3 bg-primary border border-yellow-200 rounded-lg text-xs text-yellow-800">
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
/**
 * 状态机迁移控件 — 显示当前 status + 下拉选择允许的目标状态.
 * 后端 PUT /:id 接受任意 status, 规则在 UI 层约束 (owner/viewer 角色校验交给后端 header).
 */
function StatusTransitionControls({
  app,
  setApp,
  setError,
}: {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  setError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const transitions: Record<string, { target: string; label: string; intent?: "default" | "outline" | "destructive" }[]> = {
    draft:      [{ target: "testing", label: "提测" }],
    testing:    [{ target: "draft", label: "回 dev" }, { target: "ready_to_publish", label: "提交发布" }],
    ready_to_publish: [{ target: "testing", label: "回测试" }],
    published:  [{ target: "archived", label: "下架" }],
    archived:   [{ target: "draft", label: "恢复" }],
  };
  const opts = transitions[app.status] ?? [];
  if (opts.length === 0) return null;
  const goTo = async (target: string) => {
    setBusy(true);
    try {
      const updated = await appsApi.update(app.id, { status: target });
      setApp((prev) => (prev ? { ...prev, ...updated } : prev));
      window.dispatchEvent(new CustomEvent("mp:apps-changed", { detail: { appId: app.id, kind: "status", status: target } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "状态切换失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-1">
      {opts.map((opt) => (
        <Button
          key={opt.target}
          size="sm"
          variant={opt.intent ?? "outline"}
          disabled={busy}
          onClick={() => {
            if (opt.target === "archived" && !window.confirm("确认下架当前应用？")) return;
            goTo(opt.target);
          }}
        >
          {busy ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

/* ─── P0-7: 表单 / 数据集 / 报表 / 仪表盘 四个列表 tab ─── */

/**
 * P4-4: Pages Tab — 列出应用所有 page (含 form/report/dashboard 自动镜像),
 * 类型徽章 + 关联 ID 提示。
 */
function PagesListTab({ appId }: { appId: string }) {
  const navigate = useNavigate();
  const [list, setList] = useState<Array<{ id: string; name: string; type: string; status: string; form_id?: string | null; report_id?: string | null; dashboard_id?: string | null; updated_at?: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const pages = await appsApi.listPages(appId);
      setList(Array.isArray(pages) ? pages : []);
    } catch { setList([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [appId]);

  const counts = list.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] ?? 0) + 1;
    return acc;
  }, {});

  const typeColor = (t: string) => {
    if (t === "form") return "bg-primary text-amber-800 border-amber-300";
    if (t === "report") return "bg-blue-100 text-blue-800 border-blue-300";
    if (t === "dashboard") return "bg-primary text-violet-800 border-violet-300";
    if (t === "workflow") return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (t === "list") return "bg-slate-100 text-slate-700 border-slate-300";
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="size-4" /> 页面 ({list.length})
          <span className="text-xs text-muted-foreground ml-2">
            form: {counts.form ?? 0} · report: {counts.report ?? 0} · dashboard: {counts.dashboard ?? 0} · list: {counts.list ?? 0} · workflow: {counts.workflow ?? 0}
          </span>
        </CardTitle>
        <CardDescription>页面是应用的最终载体；表单/报表/仪表盘都会自动镜像到页面</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : list.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border rounded p-2">
                <span className="text-base">{p.icon || "📄"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    id: {p.id.slice(0, 8)}…
                    {p.form_id ? ` · form: ${p.form_id.slice(0, 8)}…` : null}
                    {p.report_id ? ` · report: ${p.report_id.slice(0, 8)}…` : null}
                    {p.dashboard_id ? ` · dashboard: ${p.dashboard_id.slice(0, 8)}…` : null}
                  </div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded border ${typeColor(p.type)}`}>{p.type}</span>
                <Badge variant={p.status === "published" ? "default" : "secondary"} className="text-xs">{p.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => {
                  navigate(`/apps/${appId}/page-editor?pageId=${p.id}`);
                }}>编辑</Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">暂无页面 — 在表单/报表/仪表盘 Tab 新建会自动镜像</div>
        )}
      </CardContent>
    </Card>
  );
}

function FormsListTab({ appId }: { appId: string }) {
  const [list, setList] = useState<AppForm[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  /**
   * 镜像创建 app_pages 行 — 让 Pages Tab 与表单列表双向可见。
   * idempotent: 用 formId 在 page.config 内 form_id 标记同一行。
   * P5-BUGFIX: 自动 attach 到第一个 customModule, 避免在 `/apps/:id/pages` 模块列表下不可见。
   */
  const attachToFirstModule = async (pageId: string) => {
    try {
      const mods = await appsApi.listModules(appId);
      const firstReal = (Array.isArray(mods) ? mods : []).find((m: any) => m.id !== "__uncategorized__");
      if (!firstReal) return; // 无 module 时默认显示在"未分类"组
      const existing = Array.isArray(firstReal.pageIds) ? firstReal.pageIds : [];
      if (existing.includes(pageId)) return;
      const merged = [...existing, pageId];
      await appsApi.updateModule(appId, firstReal.id, { pageIds: merged });
    } catch (e) {
      console.warn("[FormsListTab] attachToFirstModule failed:", e);
    }
  };

  const ensurePageForForm = async (formId: string, formName: string) => {
    try {
      const pages = await appsApi.listPages(appId);
      const existing = (pages || []).find((p: any) => p.form_id === formId);
      if (existing) return existing.id;
      const created = await appsApi.createPage(appId, {
        name: formName,
        type: "form",
        status: "draft",
        icon: "📝",
        form_id: formId,
      });
      const newId = created?.id;
      if (newId) await attachToFirstModule(newId);
      return newId;
    } catch (e) {
      console.warn("[FormsListTab] ensurePageForForm failed:", e);
      return null;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await appFormsApi.list(appId);
      setList(Array.isArray(data) ? data : []);
      // 异步拉每个表单提交计数 (失败不阻断)
      const newCounts: Record<string, number> = {};
      await Promise.allSettled(
        (Array.isArray(data) ? data : []).map(async (f) => {
          try {
            const subs = await appFormsApi.submissions(appId, f.id, 1);
            newCounts[f.id] = Array.isArray(subs) ? subs.length : 0;
          } catch (e) { newCounts[f.id] = 0; }
        })
      );
      setCounts(newCounts);
      // 镜像同步 page
      await Promise.all(
        (Array.isArray(data) ? data : []).map((f) => ensurePageForForm(f.id, f.name))
      );
    } catch { setList([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [appId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="size-4"/> 表单 ({list.length})</CardTitle>
          <CardDescription>已设计的表单，可发布后让用户提交</CardDescription>
        </div>
        <Button size="sm" onClick={async () => {
          const name = window.prompt("新表单名称");
          if (!name) return;
          const created = await appFormsApi.create(appId, { name });
          // 立即同步创建 type='form' page
          if (created?.id) await ensurePageForForm(created.id, name);
          await load();
          window.dispatchEvent(new CustomEvent("mp:apps-changed", { detail: { appId, kind: "form_created" } }));
        }}><Plus className="size-3 mr-1" />新建表单</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : list.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {list.map((f) => (
              <li key={f.id} className="flex items-center gap-2 border rounded p-2 hover:bg-muted/30">
                <div className="flex-1">
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">v{f.version} · {f.status} · {counts[f.id] ?? 0} 提交</div>
                </div>
                <Badge variant={f.status === "published" ? "default" : "secondary"}>{f.status}</Badge>
                <Button size="sm" variant="outline" disabled={submitting === f.id} onClick={async () => {
                  setSubmitting(f.id);
                  try { await appFormsApi.update(appId, f.id, { status: f.status === "published" ? "draft" : "published" }); await load(); }
                  finally { setSubmitting(null); }
                }}>{f.status === "published" ? "下架" : "发布"}</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  const subs = await appFormsApi.submissions(appId, f.id, 50);
                  const summary = (subs || []).slice(0, 3).map((s) => `${s.submittedAt} ${(s.values.name || s.submitterEmail) || "匿名"}`).join("\n");
                  window.alert(`${f.name} 提交数: ${(subs || []).length}\n最近 3 条:\n${summary || "(无)"}`);
                }}>提交</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!window.confirm(`删除表单 ${f.name}？会同时删除其提交记录。`)) return;
                  await appFormsApi.remove(appId, f.id);
                  await load();
                }}><Trash2 className="size-3" /></Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">暂无表单 — 点击右上角 "新建表单"</div>
        )}
      </CardContent>
    </Card>
  );
}

function DatasetsListTab({ appId }: { appId: string }) {
  const [list, setList] = useState<AppDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: Record<string, unknown>[]; took: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try { setList(await appDatasetsApi.list(appId)); }
    catch { setList([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [appId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Dna className="size-4"/> 数据集 ({list.length})</CardTitle>
          <CardDescription>表单 / ontology / SQL 数据源，为报表 / 仪表盘提供数据</CardDescription>
        </div>
        <Button size="sm" onClick={async () => {
          const name = window.prompt("新数据集名称");
          if (!name) return;
          await appDatasetsApi.create(appId, { name, sourceType: "view" });
          await load();
        }}><Plus className="size-3 mr-1" />新建数据集</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : list.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {list.map((d) => (
              <li key={d.id} className="flex items-center gap-2 border rounded p-2">
                <div className="flex-1">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">source={d.sourceType} · fields={d.fields.length} · cache={d.cacheTtlSeconds}s</div>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  setPreviewFor(d.id);
                  setPreview(null);
                  try {
                    const r = await appDatasetsApi.preview(appId, d.id, 50);
                    setPreview({ rows: r.rows, took: r.took });
                  } catch (e) {
                    setPreview({ rows: [{ _error: String((e as Error).message) }], took: 0 });
                  }
                }}>预览</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!window.confirm(`删除数据集 ${d.name}？`)) return;
                  await appDatasetsApi.remove(appId, d.id);
                  await load();
                }}><Trash2 className="size-3" /></Button>
                {previewFor === d.id && preview && (
                  <Dialog open={!!previewFor} onOpenChange={(o) => !o && setPreviewFor(null)}>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>{d.name} — 预览</DialogTitle>
                        <DialogDescription>{preview.rows.length} 行 · {preview.took}ms</DialogDescription>
                      </DialogHeader>
                      <pre className="text-xs overflow-auto max-h-96 bg-muted p-2 rounded">
                        {JSON.stringify(preview.rows, null, 2)}
                      </pre>
                    </DialogContent>
                  </Dialog>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">暂无数据集</div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsListTab({ appId }: { appId: string }) {
  const [list, setList] = useState<AppReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ id: string; rows: Record<string, unknown>[]; took: number; rowCount: number } | null>(null);

  /**
   * 镜像创建 app_pages 行 (type='report')
   */
  const attachToFirstModule = async (pageId: string) => {
    try {
      const mods = await appsApi.listModules(appId);
      const firstReal = (Array.isArray(mods) ? mods : []).find((m: any) => m.id !== "__uncategorized__");
      if (!firstReal) return;
      const existing = Array.isArray(firstReal.pageIds) ? firstReal.pageIds : [];
      if (existing.includes(pageId)) return;
      const merged = [...existing, pageId];
      await appsApi.updateModule(appId, firstReal.id, { pageIds: merged });
    } catch (e) { /* ignore */ }
  };

  const ensurePageForReport = async (reportId: string, reportName: string) => {
    try {
      const pages = await appsApi.listPages(appId);
      const existing = (pages || []).find((p: any) => p.report_id === reportId);
      if (existing) return existing.id;
      const created = await appsApi.createPage(appId, {
        name: reportName,
        type: "report",
        status: "draft",
        icon: "📊",
        report_id: reportId,
      });
      const newId = created?.id;
      if (newId) await attachToFirstModule(newId);
      return newId;
    } catch (e) {
      console.warn("[ReportsListTab] ensurePageForReport failed:", e);
      return null;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await appReportsApi.list(appId);
      setList(Array.isArray(data) ? data : []);
      await Promise.all((Array.isArray(data) ? data : []).map((r) => ensurePageForReport(r.id, r.name)));
    } catch { setList([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [appId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="size-4"/> 报表 ({list.length})</CardTitle>
          <CardDescription>数据集 + 布局，每次 run 写 report_runs 审计</CardDescription>
        </div>
        <Button size="sm" onClick={async () => {
          const name = window.prompt("新报表名称");
          if (!name) return;
          const created = await appReportsApi.create(appId, { name });
          if (created?.id) await ensurePageForReport(created.id, name);
          await load();
        }}><Plus className="size-3 mr-1" />新建报表</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : list.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-2 border rounded p-2">
                <div className="flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">dataset={r.datasetId || "-"} · {r.status}</div>
                </div>
                <Button size="sm" variant="outline" disabled={running === r.id || !r.datasetId} onClick={async () => {
                  setRunning(r.id);
                  try {
                    const result = await appReportsApi.run(appId, r.id, { limit: 50 });
                    setLastRun({ id: r.id, rows: result.rows, took: result.took, rowCount: result.rowCount });
                  } catch (e) {
                    setLastRun({ id: r.id, rows: [{ _error: String((e as Error).message) }], took: 0, rowCount: 0 });
                  } finally { setRunning(null); }
                }}>{running === r.id ? <Loader2 className="size-3 animate-spin" /> : "执行"}</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!window.confirm(`删除报表 ${r.name}？`)) return;
                  await appReportsApi.remove(appId, r.id);
                  await load();
                }}><Trash2 className="size-3" /></Button>
                {lastRun?.id === r.id && (
                  <Dialog open onOpenChange={() => setLastRun(null)}>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>{r.name} — 运行结果</DialogTitle>
                        <DialogDescription>{lastRun.rowCount} 行 · {lastRun.took}ms</DialogDescription>
                      </DialogHeader>
                      <pre className="text-xs overflow-auto max-h-96 bg-muted p-2 rounded">
                        {JSON.stringify(lastRun.rows, null, 2)}
                      </pre>
                    </DialogContent>
                  </Dialog>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">暂无报表</div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardsListTab({ appId }: { appId: string }) {
  const [list, setList] = useState<AppDashboard[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 镜像创建 app_pages 行 (type='dashboard')
   */
  const attachToFirstModule = async (pageId: string) => {
    try {
      const mods = await appsApi.listModules(appId);
      const firstReal = (Array.isArray(mods) ? mods : []).find((m: any) => m.id !== "__uncategorized__");
      if (!firstReal) return;
      const existing = Array.isArray(firstReal.pageIds) ? firstReal.pageIds : [];
      if (existing.includes(pageId)) return;
      const merged = [...existing, pageId];
      await appsApi.updateModule(appId, firstReal.id, { pageIds: merged });
    } catch (e) { /* ignore */ }
  };

  const ensurePageForDashboard = async (dashboardId: string, dashboardName: string) => {
    try {
      const pages = await appsApi.listPages(appId);
      const existing = (pages || []).find((p: any) => p.dashboard_id === dashboardId);
      if (existing) return existing.id;
      const created = await appsApi.createPage(appId, {
        name: dashboardName,
        type: "dashboard",
        status: "draft",
        icon: "📈",
        dashboard_id: dashboardId,
      });
      const newId = created?.id;
      if (newId) await attachToFirstModule(newId);
      return newId;
    } catch (e) {
      console.warn("[DashboardsListTab] ensurePageForDashboard failed:", e);
      return null;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await appDashboardsApi.list(appId);
      setList(Array.isArray(data) ? data : []);
      await Promise.all((Array.isArray(data) ? data : []).map((d) => ensurePageForDashboard(d.id, d.name)));
    } catch { setList([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [appId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><LayoutDashboard className="size-4"/> 仪表盘 ({list.length})</CardTitle>
          <CardDescription>部件库 + 网格布局，运行拉真实 widget data</CardDescription>
        </div>
        <Button size="sm" onClick={async () => {
          const name = window.prompt("新仪表盘名称");
          if (!name) return;
          const created = await appDashboardsApi.create(appId, { name });
          if (created?.id) await ensurePageForDashboard(created.id, name);
          await load();
        }}><Plus className="size-3 mr-1" />新建仪表盘</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : list.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {list.map((d) => {
              const widgets = Array.isArray(d.widgets) ? (d.widgets as any[]) : [];
              const linked = widgets.filter((w) => w.datasetId).length;
              return (
                <li key={d.id} className="flex items-center gap-2 border rounded p-2">
                  <div className="flex-1">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      widgets={widgets.length} · linked={linked} · {d.status}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={async () => {
                    // 一次性 bulk 拉数, 显示概要
                    const r = await appDashboardsApi.widgetData(appId, d.id);
                    const summary = (r.data?.widgets || []).map((w) => `${w.widgetId || '?'}: ${w.status} (${w.rowCount ?? 0} 行)`).join("\n");
                    alert(`部件执行结果:\n${summary}`);
                  }}>运行</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!window.confirm(`删除仪表盘 ${d.name}？`)) return;
                    await appDashboardsApi.remove(appId, d.id);
                    await load();
                  }}><Trash2 className="size-3" /></Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">暂无仪表盘</div>
        )}
      </CardContent>
    </Card>
  );
}

function EditableField({
  label, value, placeholder, readOnly, mono, disabled, onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  mono?: boolean;
  disabled?: boolean;
  onSave?: (next: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!editing) setDraft(value ?? ""); }, [value, editing]);

  if (readOnly) {
    return (
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <span className={`text-sm truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
      </div>
    );
  }

  const commit = async () => {
    if (draft === value) { setEditing(false); return; }
    if (!onSave) return;
    setBusy(true);
    try { await onSave(draft); } finally { setBusy(false); setEditing(false); }
  };

  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1 justify-end">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={busy || disabled}
            className="h-7 max-w-[160px] text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(value); setEditing(false); }
            }}
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={commit} disabled={busy} className="h-7 px-2"><Save className="size-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setDraft(value); setEditing(false); }} className="h-7 px-2"><X className="size-3" /></Button>
        </div>
      ) : (
        <button
          type="button"
          className={`hover:bg-muted/40 rounded px-2 py-0.5 text-sm ${mono ? "font-mono text-xs" : ""} truncate max-w-[200px]`}
          onClick={() => !disabled && setEditing(true)}
        >
          {value || <span className="text-muted-foreground italic">{placeholder || "未设置"}</span>}
        </button>
      )}
    </div>
  );
}

/** 可编辑下拉 — 用于 category / environment */
function EditableSelectField({
  label, value, options, onSave, disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onSave: (next: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = async () => {
    if (draft === value) { setEditing(false); return; }
    setBusy(true);
    try { await onSave(draft); } finally { setBusy(false); setEditing(false); }
  };

  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            className="border rounded px-2 py-1 text-sm bg-background"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          >
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={commit} disabled={busy} className="h-7 px-2"><Save className="size-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setDraft(value); setEditing(false); }} className="h-7 px-2"><X className="size-3" /></Button>
        </div>
      ) : (
        <button
          type="button"
          className="hover:bg-muted/40 rounded px-2 py-0.5 text-sm"
          onClick={() => !disabled && setEditing(true)}
        >
          {value || <span className="text-muted-foreground italic">未设置</span>}
        </button>
      )}
    </div>
  );
}

/** P2-3: 公开访问别名 — 把表单 / 仪表盘 暴露为短链 /p/:slug */
function PublicAliasesCard({ appId }: { appId: string }) {
  const [list, setList] = useState<Array<{ slug: string; kind: string; target_id: string; status: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [kind, setKind] = useState<"form" | "dashboard">("dashboard");
  const [targetId, setTargetId] = useState("");

  const load = async () => {
    try { setList((await appsApi.aliases.list(appId)) || []); }
    catch { setList([]); }
  };
  useEffect(() => { load(); }, [appId]);

  const onCreate = async () => {
    const slug = slugInput.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 64);
    if (!slug) { toast.error("slug 至少 1 个合法字符 (a-z, 0-9, _, -)"); return; }
    if (!targetId) { toast.error("请选择目标"); return; }
    try {
      await appsApi.aliases.create(appId, { slug, kind, target_id: targetId });
      toast.success("已生成公开访问别名");
      setCreating(false); setSlugInput(""); setTargetId("");
      await load();
    } catch (e) {
      toast.error("创建失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="size-4" /> 公开访问别名
        </CardTitle>
        <CardDescription>为表单 / 仪表盘生成短链，可让外部用户无登录访问</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {list.map((a) => (
              <li key={a.slug} className="flex items-center gap-2 border rounded p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs">/p/{a.slug}</div>
                  <div className="text-xs text-muted-foreground">{a.kind} → {a.target_id?.slice(0, 12)} · {a.status}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  const path = a.kind === "form" ? `/apps/${appId}/public/form?formId=${encodeURIComponent(a.target_id)}` : `/apps/${appId}/public/dashboard?dashboardId=${encodeURIComponent(a.target_id)}`;
                  window.open(path, "_blank");
                }}>打开</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!window.confirm(`删除 alias /p/${a.slug}？`)) return;
                  await appsApi.aliases.remove(appId, a.slug);
                  await load();
                }}><Trash2 className="size-3" /></Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">暂无公开别名</div>
        )}
        {creating ? (
          <div className="border rounded p-2 space-y-2">
            <Input
              placeholder="slug (a-z, 0-9, -, _)"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              className="h-7"
            />
            <div className="flex gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "form" | "dashboard")}
                className="border rounded px-2 py-1 text-xs bg-background"
              >
                <option value="form">form</option>
                <option value="dashboard">dashboard</option>
              </select>
              <Input
                placeholder="target_id (formId 或 dashboardId)"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="h-7 flex-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
              <Button size="sm" onClick={onCreate}>保存</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="size-3 mr-1" /> 新建别名
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** 协作成员卡片 */
function CollaboratorsCard({ appId }: { appId: string }) {
  const [list, setList] = useState<AppCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState<"editor" | "viewer" | "owner">("editor");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const data = await appCollaboratorsApi.list(appId);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [appId]);

  const addCollab = async () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("请输入合法邮箱");
      return;
    }
    setBusy(true);
    try {
      await appCollaboratorsApi.create(appId, { userEmail: trimmed, role: roleInput });
      setEmailInput("");
      setAdding(false);
      await load();
    } catch (e) {
      toast.error("添加失败: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  const updateRole = async (c: AppCollaborator, role: "owner" | "editor" | "viewer") => {
    try {
      await appCollaboratorsApi.update(appId, c.id, { role });
      await load();
    } catch (e) {
      toast.error("权限更新失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const removeCollab = async (c: AppCollaborator) => {
    if (!window.confirm(`移除 ${c.userEmail} 的协作权限？`)) return;
    try {
      await appCollaboratorsApi.remove(appId, c.id);
      await load();
    } catch (e) {
      alert("移除失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="size-4" /> 协作成员
        </CardTitle>
        <CardDescription>邀请其他用户协作，可赋予 owner / editor / viewer 角色</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : list.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border rounded p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.user_name || c.userEmail}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.userEmail}</div>
                </div>
                <select
                  value={c.role}
                  onChange={(e) => updateRole(c, e.target.value as "owner" | "editor" | "viewer")}
                  className="border rounded px-2 py-1 text-xs bg-background"
                >
                  <option value="owner">owner</option>
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => removeCollab(c)} title="移除">
                  <Trash2 className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">暂无协作者</div>
        )}

        {adding ? (
          <div className="flex items-center gap-2 border rounded p-2">
            <Input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="user@example.com"
              disabled={busy}
              className="h-7"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") addCollab(); if (e.key === "Escape") setAdding(false); }}
            />
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as "editor" | "viewer" | "owner")}
              className="border rounded px-2 py-1 text-xs bg-background"
              disabled={busy}
            >
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
            <Button size="sm" onClick={addCollab} disabled={busy}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : "添加"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>取消</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus className="size-3 mr-1" /> 邀请协作者
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Tag 编辑器 — Badge + Input (回车提交, 退格删除) */
function TagEditor({
  tags, onSave, disabled,
}: { tags: string[]; onSave: (next: string[]) => void; disabled?: boolean }) {
  const [input, setInput] = useState("");
  const list = Array.isArray(tags) ? tags : [];

  const add = (raw: string) => {
    const v = raw.trim().replace(/[,\s]+/g, "-").replace(/[^\u4e00-\u9fa5a-zA-Z0-9_\-]/g, "");
    if (!v) return;
    if (list.includes(v)) { setInput(""); return; }
    if (list.length >= 20) { toast.warning("最多 20 个标签"); return; }
    onSave([...list, v]);
    setInput("");
  };

  const remove = (t: string) => {
    onSave(list.filter((x) => x !== t));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-sm">标签</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {list.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
            #{t}
            <button
              type="button"
              disabled={disabled}
              className="hover:text-destructive"
              onClick={() => remove(t)}
              title="移除标签"
            >
              ×
            </button>
          </span>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(input); }
            else if (e.key === "Backspace" && !input && list.length > 0) { remove(list[list.length - 1]); }
          }}
          placeholder="输入标签 + 回车"
          disabled={disabled}
          className="h-6 w-32 text-xs"
        />
      </div>
    </div>
  );
}

/** 简单可点击字段 (左 label + 右值), 不触发任何动作。用于展示型。 */

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
        // request<T> 已 unwrap 了 data 包装层 → res 直接是 { runtime, persisted, slug, published_url }
        const r = res?.runtime;
        setRuntime({
          state: r?.state ?? "absent",
          running: r?.running,
          port: r?.port ?? null,
          containerId: r?.containerId ?? app.runtime_container_id ?? null,
          startedAt: r?.startedAt,
          error: r?.error,
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

  // 监听全局"页面/模块变更"事件 → 重新拉 stats (避免 pages_count / flows_count 滞后)
  useEffect(() => {
    if (!app.id) return;
    const handler = () => {
      appsApi.stats(app.id).then((s) => {
        setApp((prev) => prev ? { ...prev, ...s } : prev);
      }).catch(() => {});
    };
    window.addEventListener("mp:pages-changed", handler);
    window.addEventListener("mp:flows-changed", handler);
    window.addEventListener("mp:ontology-changed", handler);
    return () => {
      window.removeEventListener("mp:pages-changed", handler);
      window.removeEventListener("mp:flows-changed", handler);
      window.removeEventListener("mp:ontology-changed", handler);
    };
  }, [app.id]);

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
          <div className="rounded-md border border-yellow-300 bg-primary text-yellow-900 px-3 py-2 text-xs flex items-start gap-2">
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
                  isContainer ? "bg-green-500" : isDegraded ? "bg-primary" : "bg-zinc-400"
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
            <div className="mt-1 font-mono text-xs text-muted-foreground flex items-center gap-2">
              <span>{runtime?.containerId ? runtime.containerId.slice(0, 12) + "…" : "—"}</span>
              {runtime?.containerId && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => navigator.clipboard.writeText(runtime.containerId!)}
                    title="复制完整容器 ID"
                  >
                    <Copy className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    title="在新窗口查看容器日志"
                    onClick={() => window.open(`/apps/${app.id}/runtime/logs?container=${encodeURIComponent(runtime.containerId)}`, "_blank")}
                  >
                    <ExternalLink className="size-3" />
                  </Button>
                </>
              )}
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
