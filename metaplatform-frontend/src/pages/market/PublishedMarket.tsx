import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  Search,
  ExternalLink,
  Sparkles,
  Filter,
  Clock,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  Inbox,
  Layers,
  Star,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicApi, type ApplicationLite } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * P14: 公开应用市场 — 浏览所有已发布应用, 无需 auth
 *
 * 设计规范 (摘自 .design_library/metaplatform/):
 *   - 品牌色: bg-primary #3b82f6 (单色, 不用渐变)
 *   - 圆角: card=rounded-lg(6px) / chip/btn=rounded-md(4px) / badge=rounded-full(pill)
 *   - 字号: text-xs(12) / text-sm(14) / text-base(16) / text-xl(20)
 *   - 阴影: shadow-sm 默认 / shadow-md hover
 *   - Badge: pill 形状 + 中性 bg-muted 默认 (doNotInvent colored-type-badges)
 *   - 状态: success=emerald-50/600 / error=destructive
 */

type SortBy = "newest" | "oldest" | "name-asc" | "name-desc";

/**
 * Category 元数据 — 7 类应用分类
 * 规范: chip 统一用 bg-muted + text-muted-foreground (中性, 非 colored)
 */
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  demo: { label: "演示", icon: "✨" },
  customer: { label: "客户关系", icon: "👥" },
  sales: { label: "销售营销", icon: "💼" },
  hr: { label: "人力资源", icon: "🧑‍💼" },
  finance: { label: "财务", icon: "💰" },
  ops: { label: "运营", icon: "⚙️" },
  general: { label: "通用", icon: "📦" },
};

function categoryMeta(cat?: string) {
  return (cat && CATEGORY_META[cat]) || CATEGORY_META.general;
}

export default function PublishedMarket() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<ApplicationLite[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  // 拉所有已发布应用 (公开, 无 auth)
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    publicApi
      .listPublishedApps()
      .then((rows) => {
        if (!cancel) setApps(rows ?? []);
      })
      .catch((err) => setError("加载失败: " + (err?.message ?? String(err))))
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  // 全部 category (动态)
  const categories = useMemo(() => {
    if (!apps) return [];
    const set = new Set<string>();
    apps.forEach((a) => set.add(a.category ?? "general"));
    return Array.from(set);
  }, [apps]);

  // 过滤 + 搜索 + 排序
  const filtered = useMemo(() => {
    if (!apps) return [];
    const q = query.trim().toLowerCase();
    let list = apps.filter((a) => {
      if (activeCategory !== "all" && (a.category ?? "general") !== activeCategory) return false;
      if (!q) return true;
      return (
        (a.name ?? "").toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        (a.app_slug ?? "").toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (b.published_at ?? "").localeCompare(a.published_at ?? "");
        case "oldest":
          return (a.published_at ?? "").localeCompare(b.published_at ?? "");
        case "name-asc":
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "name-desc":
          return (b.name ?? "").localeCompare(a.name ?? "");
      }
    });
    return list;
  }, [apps, query, activeCategory, sortBy]);

  // P15-3: Featured 区 — 优先 demo 分类, 取最新 3 个
  const featured = useMemo(() => {
    if (!apps || apps.length === 0) return [];
    const demos = apps.filter((a) => a.category === "demo");
    const featuredIds = new Set<string>();
    const result: ApplicationLite[] = [];
    if (demos.length > 0) {
      const latestDemo = [...demos].sort((a, b) =>
        (b.published_at ?? "").localeCompare(a.published_at ?? "")
      )[0];
      result.push(latestDemo);
      featuredIds.add(latestDemo.id);
    }
    const rest = [...apps]
      .filter((a) => !featuredIds.has(a.id))
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    for (const a of rest) {
      if (result.length >= 3) break;
      result.push(a);
      featuredIds.add(a.id);
    }
    return result;
  }, [apps]);

  const featuredIds = useMemo(() => new Set(featured.map((a) => a.id)), [featured]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">正在加载公开应用市场…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="size-10 text-destructive mx-auto mb-3" />
          <p className="text-base text-foreground mb-1">加载失败</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="mt-3 rounded-md">
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Store className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">公开应用市场</h1>
                  {/* Badge: pill 形状 + 中性 bg-muted (doNotInvent: colored-type-badges) */}
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium border border-border">
                    <Sparkles className="size-3 inline mr-0.5" /> Public
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  浏览所有已发布的 MetaPlatform 应用 · 任何人无需登录即可访问
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Stat label="应用总数" value={apps?.length ?? 0} />
              <Stat label="分类" value={categories.length} />
              <Stat label="筛选结果" value={filtered.length} highlight />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="搜索应用名称 / 描述 / slug…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <ArrowUpDown className="size-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="border border-border bg-background rounded-md h-8 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="newest">最新发布</option>
                <option value="oldest">最早发布</option>
                <option value="name-asc">名称 A → Z</option>
                <option value="name-desc">名称 Z → A</option>
              </select>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Filter className="size-3" /> 分类:
              </span>
              <CategoryChip
                active={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
                icon={<Layers className="size-3" />}
                label="全部"
                count={apps?.length ?? 0}
              />
              {categories.map((cat) => {
                const meta = categoryMeta(cat);
                const count = (apps ?? []).filter((a) => (a.category ?? "general") === cat).length;
                return (
                  <CategoryChip
                    key={cat}
                    active={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                    icon={<span>{meta.icon}</span>}
                    label={meta.label}
                    count={count}
                  />
                );
              })}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {!query && activeCategory === "all" && featured.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="size-4 text-primary" />
              <h2 className="text-base font-semibold tracking-tight text-foreground">精选应用</h2>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium border border-border">
                Featured
              </span>
              <span className="text-sm text-muted-foreground">· 编辑推荐 + 最新发布</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((app, idx) => (
                <FeaturedAppCard
                  key={app.id}
                  app={app}
                  rank={idx + 1}
                  onOpen={() => navigate(`/app/${app.app_slug}`)}
                />
              ))}
            </div>
          </section>
        )}

        {(() => {
          const mainList = filtered.filter((a) => !featuredIds.has(a.id));
          if (mainList.length === 0 && (!query && activeCategory === "all" && featured.length > 0)) {
            return (
              <div className="border border-dashed border-border bg-card/50 rounded-md py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  所有精选应用均展示在上方 · 共 {featured.length} 个
                </p>
              </div>
            );
          }
          if (mainList.length === 0) {
            return <EmptyState query={query} category={activeCategory} hasApps={(apps?.length ?? 0) > 0} />;
          }
          return (
            <>
              {!query && activeCategory === "all" && featured.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold tracking-tight text-foreground">所有应用</h2>
                  <span className="text-sm text-muted-foreground">· 共 {mainList.length} 个</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mainList.map((app) => (
                  <PublishedAppCard
                    key={app.id}
                    app={app}
                    onOpen={() => navigate(`/app/${app.app_slug}`)}
                  />
                ))}
              </div>
            </>
          );
        })()}
      </main>

      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>MetaPlatform · 公开应用市场 · 由后端 /api/public/published-apps 提供</span>
          <a href="/" className="hover:text-foreground transition-colors">
            返回主控台 →
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ─── 子组件 ─────────────────────────────────────────────────── */

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className={cn("text-base font-semibold", highlight ? "text-primary" : "text-foreground")}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Category filter chip — 规范: 圆角 md(4px), 边框色, 无阴影
 * active=primary filled, inactive=neutral border
 */
function CategoryChip({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-border text-foreground hover:bg-accent"
      )}
    >
      {icon}
      <span>{label}</span>
      <span className={cn(
        "text-xs px-1 rounded-sm",
        active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {count}
      </span>
    </button>
  );
}

/**
 * Featured 应用卡 — 符合 card.json 规范:
 *   - rounded-lg(6px) border-only
 *   - hover:border-primary
 *   - hover:shadow-md (不超规范允许的 shadow-float = 0 8px 24px)
 *   - 排名徽章 pill 形 bg-primary
 *   - Badge: rounded-full pill 形状
 */
function FeaturedAppCard({
  app,
  rank,
  onOpen,
}: {
  app: ApplicationLite;
  rank: number;
  onOpen: () => void;
}) {
  const meta = categoryMeta(app.category);
  const iconText = app.icon || "📦";

  return (
    <article
      onClick={onOpen}
      className="group relative border border-border bg-card rounded-lg overflow-hidden hover:shadow-md hover:border-primary transition-all cursor-pointer flex flex-col"
    >
      <div className="absolute top-3 right-3 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold z-10">
        #{rank}
      </div>

      <div className="p-5 flex items-start gap-4">
        <div className="size-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xl shrink-0">
          {iconText}
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-1.5 mb-1">
            <Star className="size-3 text-primary fill-primary" />
            <span className="text-xs uppercase tracking-wider font-semibold text-primary">Featured</span>
          </div>
          <h3 className="text-base font-semibold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {app.name}
          </h3>
          {app.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {app.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {/* Badge: pill 形状 + 中性 (符合 badge.json 默认) */}
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {meta.icon} {meta.label}
            </span>
            {/* Status badge: success 状态 (符合 badge.json Status Success) */}
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
              v{app.published_version}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 mt-auto flex items-center justify-between gap-2">
        <code className="text-xs font-mono text-muted-foreground truncate flex-1">
          {app.app_slug}
        </code>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            window.open(app.published_url, "_blank", "noopener,noreferrer");
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs gap-1 rounded-md"
        >
          <ExternalLink className="size-3" /> 立即访问
        </Button>
      </div>
    </article>
  );
}

/**
 * 普通应用卡 — 符合 card.json 规范
 */
function PublishedAppCard({
  app,
  onOpen,
}: {
  app: ApplicationLite;
  onOpen: () => void;
}) {
  const meta = categoryMeta(app.category);
  const iconText = app.icon || "📦";

  return (
    <article
      className="group relative border border-border bg-card rounded-lg overflow-hidden hover:border-primary hover:shadow-md transition-all cursor-pointer flex flex-col"
      onClick={onOpen}
    >
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-lg shrink-0">
          {iconText}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
          {meta.icon} {meta.label}
        </span>
      </div>

      <div className="px-4 pb-3 flex-1">
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {app.name}
        </h3>
        {app.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {app.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            v{app.published_version}
          </span>
          {app.published_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {new Date(app.published_at).toLocaleDateString("zh-CN")}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-border bg-muted flex items-center justify-between gap-2">
        <code className="text-xs font-mono text-muted-foreground truncate flex-1">
          {app.app_slug}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            window.open(app.published_url, "_blank", "noopener,noreferrer");
          }}
          className="h-6 text-xs px-2 gap-1 text-primary hover:text-primary-hover rounded-sm"
          title="新窗口打开公开应用"
        >
          <ExternalLink className="size-3" /> 访问
        </Button>
      </div>
    </article>
  );
}

function EmptyState({
  query,
  category,
  hasApps,
}: {
  query: string;
  category: string;
  hasApps: boolean;
}) {
  return (
    <div className="border border-dashed border-border bg-card/50 rounded-md py-16 text-center">
      <Inbox className="size-10 text-muted-foreground mx-auto mb-3" />
      {hasApps ? (
        <>
          <p className="text-base text-foreground mb-1">没有匹配的应用</p>
          <p className="text-sm text-muted-foreground">
            {query && <>搜索 "<span className="font-mono">{query}</span>" </>}
            {query && category !== "all" && " · "}
            {category !== "all" && <>分类 "<span>{categoryMeta(category).label}</span>"</>}
          </p>
        </>
      ) : (
        <>
          <p className="text-base text-foreground mb-1">市场暂时空空如也</p>
          <p className="text-sm text-muted-foreground">
            登录 MetaPlatform 后, 在应用中心发布你的第一个应用
          </p>
        </>
      )}
    </div>
  );
}
