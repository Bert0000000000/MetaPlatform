import { useNavigate, useLocation } from "react-router-dom";
import { Search, Bell, Store } from "lucide-react";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Topbar — 顶部工具栏 (sticky)
 *
 * 设计规范 (摘自 .design_library/metaplatform/colors_and_type.css):
 *   - height: h-14 (56px) — 与 sidebar 的 h-14 brandArea 对齐
 *   - background: var(--color-surface) (#ffffff) + bg/80 backdrop-blur
 *   - border-b 1px var(--color-border)
 *   - icon size-4 (16px, 规范按钮图标)
 *   - 圆角: btn rounded-md(4px) / kbd rounded(3px) / badge rounded-full(pill)
 *   - 字号: text-sm(14) / text-xs(12) — 不用任意像素
 *   - 阴影: 无 (sticky only)
 *
 * 解剖:
 *   - left: Search input ⌘K + Marketplace 一级入口
 *   - right: Notification + RoleSwitcher
 */
export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMarketplaceActive = location.pathname.startsWith("/marketplace");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-3 backdrop-blur-md">
      {/* ── Left ──────────────────────────────────────────── */}
      <div className="flex flex-1 items-center gap-2">
        {/* Search ⌘K — 模拟 input, 跳转 /superai */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex w-64 justify-start gap-2 text-muted-foreground rounded-md"
              onClick={() => navigate("/superai")}
              aria-label="打开搜索或 AI 助手"
            >
              <Search className="size-4 shrink-0" />
              <span className="text-sm">搜索或 AI 助手</span>
              {/* kbd — 圆角 sm(3px), bg-muted 中性 */}
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-sm border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>唤起全局 AI 助手 ⌘K</TooltipContent>
        </Tooltip>

        {/* P17: 公开应用市场 — 一级入口 (active 时填充主色) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isMarketplaceActive ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate("/marketplace")}
              className={cn(
                "gap-2 rounded-md text-sm",
                isMarketplaceActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-foreground hover:bg-accent"
              )}
              aria-label="公开应用市场"
              aria-current={isMarketplaceActive ? "page" : undefined}
            >
              <Store className="size-4 shrink-0" />
              <span className="hidden lg:inline">公开应用市场</span>
              {/* Badge: pill 形, 中性 bg-muted, 不抢眼 */}
              <span className="hidden md:inline lg:hidden text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium border border-border">
                公开
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>浏览所有已发布的应用 · 无需登录</TooltipContent>
        </Tooltip>
      </div>

      {/* ── Right ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Notification — icon-only btn */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="通知"
              className="text-foreground hover:bg-accent rounded-md"
            >
              <Bell className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>通知</TooltipContent>
        </Tooltip>

        <RoleSwitcher />
      </div>
    </header>
  );
}