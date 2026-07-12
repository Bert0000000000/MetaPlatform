import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Sparkles, Bot, Zap, Folder, X, RotateCcw, Database, FileText, LayoutDashboard, ChevronUp, Rocket,
  ClipboardList, FileEdit, BarChart3,
  Loader2, AlertCircle, Inbox, Brain, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { appsApi, type Application } from "@/lib/api";
import { AICreateAppDialog } from "@/pages/apps/AICreateAppDialog";

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  "传统应用": ClipboardList,
  "AI 原生": Bot,
  "数字员工": Sparkles,
  "VibeCoding": Zap,
};

const APP_CATEGORIES = ["全部", "CRM", "ERP", "OA", "HR", "数据"] as const;
type AppCategory = (typeof APP_CATEGORIES)[number];

export function AppsListPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AppCategory>("全部");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiInitialScene, setAiInitialScene] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    appsApi
      .list()
      .then((data) => {
        if (!cancelled) setApps(data ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "加载应用列表失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 监听"全局应用变更"事件 (新建/编辑/删除) → 立刻重拉列表, 避免看到过时的卡片
  useEffect(() => {
    const reload = () => {
      appsApi.list().then((data) => setApps(data ?? [])).catch(() => {});
    };
    const onAppsChanged = () => reload();
    window.addEventListener("mp:apps-changed", onAppsChanged);
    return () => window.removeEventListener("mp:apps-changed", onAppsChanged);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">应用中心</h1>
          <p className="text-sm text-muted-foreground mt-1">
            构建应用 · NoCode + LowCode + ProCode + VibeCoding
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/apps/new")} className="gap-2">
            <Plus className="size-4" /> 新建应用
          </Button>
          <Button
            variant="outline"
            onClick={() => { setAiInitialScene(undefined); setAiDialogOpen(true); }}
            className="gap-2 border-primary text-primary hover:bg-blue-50"
          >
            <Wand2 className="size-4" /> 使用 AI 创建
          </Button>
        </div>
      </div>

      {/* P9-3: Demo 卡片专项区 — 符合设计规范 (primary #3b82f6, 6px 圆角, 紧凑) */}
      <DemoShowcase
        demoApp={apps.find((a: any) => a.category === "demo")}
        onChanged={() => appsApi.list().then((d) => setApps(d ?? [])).catch(() => {})}
      />

      {/* Quick entry cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => { setAiInitialScene("ai"); setAiDialogOpen(true); }}
        >
          <CardHeader>
            <Brain className="size-6 text-violet-500 mb-2" />
            <CardTitle className="text-base flex items-center gap-1.5">
              AI 原生 <Wand2 className="size-3.5 text-violet-500" />
            </CardTitle>
            <CardDescription>AI 驱动的智能应用 · 1 句话生成</CardDescription>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => { setAiInitialScene("ai"); setAiDialogOpen(true); }}
        >
          <CardHeader>
            <Bot className="size-6 text-primary mb-2" />
            <CardTitle className="text-base">智能体场景应用</CardTitle>
            <CardDescription>基于多智能体协作的应用</CardDescription>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary relative"
          onClick={() => { setAiInitialScene("workforce"); setAiDialogOpen(true); }}
        >
          <CardHeader>
            <Sparkles className="size-6 text-violet-500 mb-2" />
            <CardTitle className="text-base flex items-center gap-1.5">
              数字员工应用 <Wand2 className="size-3.5 text-violet-500" />
            </CardTitle>
            <CardDescription>每个数字员工是一个应用 · AI 一句话创建</CardDescription>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => navigate("/apps/new?type=vibe")}
        >
          <CardHeader>
            <Zap className="size-6 text-primary mb-2" />
            <CardTitle className="text-base">VibeCoding 应用</CardTitle>
            <CardDescription>AI 对话生成代码应用</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">正在加载应用列表...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            重试
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && apps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Inbox className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无应用</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/apps/new")}
          >
            <Plus className="size-4 mr-1" /> 创建第一个应用
          </Button>
        </div>
      )}

      {/* Category filter chips - F4.1.5 */}
      {!loading && !error && apps.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {APP_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* App list */}
      {!loading && !error && apps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Folder className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">我的应用</h2>
            <Badge variant="secondary">{apps.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps
              .filter((app) => categoryFilter === "全部" || app.category?.includes(categoryFilter))
              .map((app) => {
              const IconComponent = CATEGORY_ICONS[app.category] ?? ClipboardList;
              return (
                <Card
                  key={app.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", app.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData("text/plain");
                    if (!fromId || fromId === app.id) return;
                    const reordered = [...apps];
                    const fromIdx = reordered.findIndex((x) => x.id === fromId);
                    const toIdx = reordered.findIndex((x) => x.id === app.id);
                    if (fromIdx < 0 || toIdx < 0) return;
                    const [moved] = reordered.splice(fromIdx, 1);
                    reordered.splice(toIdx, 0, moved);
                    setApps(reordered);
                    try {
                      await appsApi.resort(reordered.map((x) => x.id));
                    } catch (err) {
                      // 回滚
                      setApps(apps);
                      alert("排序保存失败: " + (err instanceof Error ? err.message : String(err)));
                    }
                  }}
                  onClick={() => navigate(`/apps/${app.id}/overview`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <IconComponent className="size-5" />
                      <div className="flex items-center gap-1">
                        {app.environment && (
                          <Badge variant="outline" className="text-xs">
                            {app.environment}
                          </Badge>
                        )}
                        <Badge variant="outline">{app.category}</Badge>
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">{app.name}</CardTitle>
                    <CardDescription>
                      {app.description || "暂无描述"}
                    </CardDescription>
                    {/* P1: tags + owner 显示 */}
                    {(app.tags?.length || app.owner_name) && (
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        {(app.tags || []).slice(0, 4).map((t) => (
                          <span key={t} className="inline-flex rounded-full bg-secondary px-1.5 py-0.5 text-xs">
                            #{t}
                          </span>
                        ))}
                        {(app.tags?.length ?? 0) > 4 && (
                          <span className="text-xs text-muted-foreground">+{app.tags!.length - 4}</span>
                        )}
                        {app.owner_name && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            👤 {app.owner_name}
                          </span>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{app.objects_count ?? 0} 对象</span>
                      <span>{app.pages_count ?? 0} 页面</span>
                      <span>{app.flows_count ?? 0} 流程</span>
                      {app.forms_count ? <span>{app.forms_count} 表单</span> : null}
                      {app.reports_count ? <span>{app.reports_count} 报表</span> : null}
                      {app.dashboards_count ? <span>{app.dashboards_count} 仪表盘</span> : null}
                      {app.modules_count ? <span>{app.modules_count} 模块</span> : null}
                      {app.integrations_count ? <span>{app.integrations_count} 集成</span> : null}
                    </div>
                    {app.status && (
                      <Badge
                        className="mt-2 text-xs"
                        variant={app.status === "published" ? "default" : app.status === "archived" ? "destructive" : "secondary"}
                      >
                        {app.status}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Create-App Dialog (1 句话生成应用) */}
      <AICreateAppDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        initialScene={aiInitialScene}
        onCreated={(app) => {
          // 1) 乐观更新本地 list
          setApps((prev) => [app, ...(prev ?? [])]);
          // 2) 广播, 让其它可能挂载的 AppHeader 等刷新
          window.dispatchEvent(new CustomEvent("mp:apps-changed", { detail: { kind: "create", app } }));
        }}
      />
    </div>
  );
}

/**
 * P9-3: Demo 卡片专项区 — 符合设计规范
 *
 * 设计规范要点:
 *   - 品牌主色 #3b82f6 (blue-500) 而非 violet
 *   - 圆角 6px (rounded-md) 而非 rounded-xl
 *   - 紧凑企业风, 不用 shadow-xl
 *   - 主推 demo + 场景占位卡 (gray border + "敬请期待")
 *   - 短链 CTA 内嵌到主推卡, 不再放横幅
 *   - "重置" 操作放右上角小按钮 (低调)
 */
type DemoAppLite = {
  id: string;
  name: string;
  description?: string;
  category?: string;
};

const DEMO_SCENARIOS = [
  {
    key: "customer-mgmt",
    label: "客户管理",
    description: "客户登记 → 订单跟踪 → 销售报表 → 实时仪表盘",
    icon: "📊",
    badge: "已上线",
    accent: "primary", // #3b82f6
  },
  {
    key: "ecom-order",
    label: "电商订单",
    description: "商品 SKU → 购物车表单 → 订单报表 → 履约看板",
    icon: "🛒",
    badge: "敬请期待",
    accent: "muted",
  },
  {
    key: "support-ticket",
    label: "工单系统",
    description: "工单提交 → SLA 报表 → 客服看板 → 公开追踪",
    icon: "🎫",
    badge: "敬请期待",
    accent: "muted",
  },
  {
    key: "hr-onboarding",
    label: "入职流程",
    description: "员工登记 → 入职清单 → HR 报表 → 团队看板",
    icon: "🧑‍💼",
    badge: "敬请期待",
    accent: "muted",
  },
];

function DemoShowcase({
  demoApp,
  onChanged,
}: {
  demoApp?: DemoAppLite;
  onChanged?: () => void;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("metaplatform:demo-section-collapsed") === "1"; }
    catch { return false; }
  });
  const [resetting, setResetting] = useState(false);
  const [aliases, setAliases] = useState<{ slug: string; kind: string; targetName?: string; hitCount?: number }[]>([]);
  const navigate = useNavigate();

  const reloadApps = async () => {
    try {
      const d = await appsApi.list();
      // 从 props.onChanged 走父级更新; 这里额外直接重查 demo app
      if (demoApp?.id) {
        const fresh = (d ?? []).find((a: any) => a.id === demoApp.id);
        if (fresh) {
          // 重新拉 aliases 因为 publish 会创建/更新 published_url
          const token = localStorage.getItem("mp_token");
          const r = await fetch(`/api/apps/${demoApp.id}/aliases`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const j = await r.json();
          if (j.success) setAliases(j.data || []);
        }
      }
      if (onChanged) onChanged();
    } catch { /* ignore */ }
  };

  // 拉 demo aliases 用于 CTA 短链
  useEffect(() => {
    if (!demoApp?.id) return;
    const token = localStorage.getItem("mp_token");
    fetch(`/api/apps/${demoApp.id}/aliases`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setAliases(j.data || []); })
      .catch(() => setAliases([]));
  }, [demoApp?.id]);

  const handleClose = () => {
    setCollapsed(true);
    try { localStorage.setItem("metaplatform:demo-section-collapsed", "1"); } catch { /* ignore */ }
  };

  const handleResetAndSeed = async () => {
    if (resetting) return;
    if (!window.confirm("确定要清空并重新生成 Demo 应用吗?\n\n会删除所有 category='demo' 的应用及其关联数据,然后重建。")) return;
    setResetting(true);
    try {
      const token = localStorage.getItem("mp_token");
      const r = await fetch("/api/admin/demo-reset-and-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (j.success) {
        window.alert(`✓ Demo 已重置!\n\n应用: ${j.data.appName}\n数据集: ${j.data.datasetCount}\n表单: ${j.data.formCount}\n报表: ${j.data.reportCount}\n仪表盘: ${j.data.dashboardCount}`);
        if (onChanged) onChanged();
        window.location.reload();
      } else {
        window.alert("重置失败: " + (j.error ?? "未知错误"));
      }
    } catch (e) {
      window.alert("请求失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setResetting(false);
    }
  };

  if (collapsed) return null;

  const openDemo = () => { if (demoApp?.id) navigate(`/apps/${demoApp.id}/overview`); };
  const openShort = (slug: string) => {
    window.open(`/r/${slug}`, "_blank", "noopener,noreferrer");
  };

  // 短链按 kind 归类
  const formAliases = aliases.filter((a) => a.kind === "form");
  const dashboardAliases = aliases.filter((a) => a.kind === "dashboard");
  const reportAliases = aliases.filter((a) => a.kind === "report");

  return (
    <section className="border border-border bg-card rounded-md">
      {/* Section header — 紧凑设计规范风格 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider">
            <Sparkles className="size-3" /> Demo
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">演示应用场景</h2>
          <span className="text-xs text-muted-foreground">
            · 立即体验 MetaPlatform 完整闭环, 每个场景都是一个独立业务应用
          </span>
        </div>
        <div className="flex items-center gap-1">
          {demoApp && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAndSeed}
              disabled={resetting}
              className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
              title="清空所有 demo 数据并重新生成"
            >
              {resetting ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="size-3 mr-1" />
              )}
              {resetting ? "重置中…" : "重置"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
            aria-label="折叠 demo 区"
            title="折叠"
          >
            <ChevronUp className="size-4" />
          </Button>
        </div>
      </div>

      {/* Section body — 4 卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {DEMO_SCENARIOS.map((s, idx) => {
          const isFeatured = s.key === "customer-mgmt" && demoApp;
          return (
            <DemoScenarioCard
              key={s.key}
              scenario={s}
              isFeatured={isFeatured}
              demoApp={demoApp}
              formAliases={formAliases}
              dashboardAliases={dashboardAliases}
              reportAliases={reportAliases}
              onOpenDemo={openDemo}
              onOpenShort={openShort}
              onPublished={async () => { await reloadApps(); }}
              isFirst={idx === 0}
            />
          );
        })}
      </div>
    </section>
  );
}

/**
 * Demo 场景卡 — 设计规范: 6px 圆角, 紧凑, 主推 vs 占位 不同视觉
 */
function DemoScenarioCard({
  scenario,
  isFeatured,
  demoApp,
  formAliases,
  dashboardAliases,
  reportAliases,
  onOpenDemo,
  onOpenShort,
  onPublished,
  isFirst,
}: {
  scenario: typeof DEMO_SCENARIOS[number];
  isFeatured: boolean;
  demoApp?: DemoAppLite;
  formAliases: { slug: string; targetName?: string }[];
  dashboardAliases: { slug: string; targetName?: string }[];
  reportAliases: { slug: string; targetName?: string }[];
  onOpenDemo: () => void;
  onOpenShort: (slug: string) => void;
  onPublished: () => void;
  isFirst: boolean;
}) {
  if (!isFeatured) {
    // 占位卡 — muted 风格
    return (
      <div className="bg-card p-4 flex flex-col gap-2 min-h-[180px]">
        <div className="flex items-start justify-between">
          <div className="size-9 rounded-md bg-muted flex items-center justify-center text-lg shrink-0">
            {scenario.icon}
          </div>
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            {scenario.badge}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-foreground">{scenario.label}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{scenario.description}</p>
        </div>
        <div className="text-xs text-muted-foreground italic mt-auto">
          该场景将在下个迭代提供
        </div>
      </div>
    );
  }

  // 主推卡 — 品牌色, 显式 CTA
  return (
    <div className="bg-card p-4 flex flex-col gap-3 min-h-[180px] relative">
      {/* 主推角标 */}
      <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
        Featured
      </span>
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xl shrink-0">
          {scenario.icon}
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <h3 className="text-sm font-semibold text-foreground">{scenario.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{scenario.description}</p>
        </div>
      </div>

      {/* 数据指标 */}
      {demoApp && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Database className="size-3" /> 5 datasets
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3" /> 5 forms
          </span>
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="size-3" /> 5 reports
          </span>
          <span className="inline-flex items-center gap-1">
            <LayoutDashboard className="size-3" /> 5 dashboards
          </span>
        </div>
      )}

      {/* 主操作 */}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={onOpenDemo}
          disabled={!demoApp}
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs gap-1 rounded-md"
        >
          <Sparkles className="size-3" /> 进入 AppOverview
        </Button>
        <PublishButton demoApp={demoApp} onPublished={onPublished} />
      </div>

      {/* 公开短链 CTA — 按类型分组 */}
      {(formAliases.length > 0 || dashboardAliases.length > 0 || reportAliases.length > 0) && (
        <div className="border-t border-border pt-2.5 mt-auto space-y-1.5">
          {formAliases.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground w-8 shrink-0">表单</span>
              {formAliases.map((a) => (
                <button
                  key={a.slug}
                  onClick={() => onOpenShort(a.slug)}
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  title={`公开访问 ${a.targetName ?? a.slug}`}
                >
                  <FileText className="size-2.5" /> {a.slug}
                </button>
              ))}
            </div>
          )}
          {dashboardAliases.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground w-8 shrink-0">仪表盘</span>
              {dashboardAliases.map((a) => (
                <button
                  key={a.slug}
                  onClick={() => onOpenShort(a.slug)}
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  title={`公开访问 ${a.targetName ?? a.slug}`}
                >
                  <LayoutDashboard className="size-2.5" /> {a.slug}
                </button>
              ))}
            </div>
          )}
          {reportAliases.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground w-8 shrink-0">报表</span>
              {reportAliases.map((a) => (
                <button
                  key={a.slug}
                  onClick={() => onOpenShort(a.slug)}
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  title={`公开访问 ${a.targetName ?? a.slug}`}
                >
                  <BarChart3 className="size-2.5" /> {a.slug}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * P13-3: 一键发布按钮 — 简洁显示当前发布状态 + 触发 POST /publish
 */
function PublishButton({
  demoApp,
  onPublished,
}: {
  demoApp?: DemoAppLite;
  onPublished: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pubUrl, setPubUrl] = useState<string | null>(null);
  const [pubVersion, setPubVersion] = useState<string | null>(null);

  // 拉当前发布状态
  useEffect(() => {
    if (!demoApp?.id) { setPubUrl(null); setPubVersion(null); return; }
    let cancel = false;
    (async () => {
      try {
        const token = localStorage.getItem("mp_token");
        const r = await fetch(`/api/apps/${demoApp.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = await r.json();
        if (!cancel && j.success) {
          const a = j.data;
          setPubUrl(a.published_url || null);
          setPubVersion(a.published_version || null);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [demoApp?.id]);

  const handlePublish = async () => {
    if (!demoApp?.id || busy) return;
    if (!window.confirm("确定要发布此应用到 MetaPlatform 公有访问网络吗?\n\n将:\n• 创建 SQLite 快照文件\n• 启动独立 Docker runtime 容器\n• 生成公开访问 URL (/app/:slug)")) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("mp_token");
      const r = await fetch(`/api/apps/${demoApp.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commitMessage: "通过应用中心一键发布" }),
      });
      const j = await r.json();
      if (j.success) {
        setPubUrl(j.data.application?.published_url || j.data.publishedUrl || pubUrl);
        setPubVersion(j.data.application?.published_version || j.data.publishedVersion || pubVersion);
        window.alert(`✓ 发布成功!\n\nURL: /app/${j.data.application?.app_slug || ""}\n版本: ${j.data.application?.published_version || j.data.publishedVersion || "v0.1"}`);
        onPublished();
      } else {
        window.alert("发布失败: " + (j.error ?? "未知错误"));
      }
    } catch (e) {
      window.alert("请求失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (!demoApp) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handlePublish}
        disabled={busy}
        className="border-primary text-primary hover:bg-blue-50 h-7 text-xs gap-1 rounded-md"
        title={pubUrl ? `已发布 → ${pubUrl}` : "一键发布到公有网络"}
      >
        {busy ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Rocket className="size-3" />
        )}
        {busy ? "发布中…" : pubUrl ? "重新发布" : "发布"}
      </Button>
      {pubUrl && (
        <a
          href={pubUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-emerald-700 hover:text-emerald-900 hover:underline font-mono"
          title={`已发布 (${pubVersion || "v0.1"})`}
        >
          /app/{pubUrl.replace(/^\/app\//, "")}
        </a>
      )}
    </>
  );
}
