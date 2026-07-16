/**
 * OverflowTabs —— 顶部 Tab 导航容器
 *
 * 设计原则 (MetaPlatform 设计系统: compact minimal enterprise)
 *   - 不使用横向滚动条 (无视觉噪音)
 *   - 容器宽度充足时，平铺所有 tab
 *   - 容器宽度紧张时，自动换行 (flex-wrap)，最多展示两行
 *   - 两行仍放不下时，把多余项折叠进"更多 ▾"下拉
 *   - 字号 12px (--font-size-sm)，间距 8px/12px，圆角 4px
 */

import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OverflowTabItem {
  key: string;
  label: React.ReactNode;
  to?: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}

export interface OverflowTabsProps {
  tabs: OverflowTabItem[];
  overflowThreshold?: number;
  className?: string;
  highlightInDropdown?: boolean;
}

export function OverflowTabs({
  tabs,
  overflowThreshold = 8,
  className,
  highlightInDropdown = true,
}: OverflowTabsProps) {
  const location = useLocation();
  const [measured, setMeasured] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemsRef = React.useRef<(HTMLDivElement | null)[]>([]);
  const [overflowKeys, setOverflowKeys] = React.useState<string[]>([]);

  React.useLayoutEffect(() => {
    const measure = () => {
      const root = containerRef.current;
      if (!root) return;
      const tops = itemsRef.current
        .filter(Boolean)
        .map((el) => (el as HTMLElement).offsetTop);
      if (tops.length === 0) return;
      const firstTop = tops[0];
      const wrapped = tops
        .map((top, idx) => ({ top, idx }))
        .filter((x) => x.top > firstTop + 4);
      if (wrapped.length > 0) {
        const firstWrappedIdx = wrapped[0].idx;
        const collectKeys = tabs.slice(firstWrappedIdx).map((t) => t.key);
        setOverflowKeys(collectKeys);
      } else {
        if (tabs.length > overflowThreshold) {
          setOverflowKeys(tabs.slice(overflowThreshold).map((t) => t.key));
        } else {
          setOverflowKeys([]);
        }
      }
      setMeasured(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [tabs, overflowThreshold]);

  const isActiveTab = (t: OverflowTabItem) => {
    if (typeof t.active === "boolean") return t.active;
    if (t.to) {
      if (t.to === "/" || t.to === "") return location.pathname === "/";
      return (
        location.pathname === t.to ||
        location.pathname.startsWith(t.to.replace(/\/$/, "") + "/")
      );
    }
    return false;
  };

  const visibleTabs = tabs.filter((t) => !overflowKeys.includes(t.key));
  const hiddenTabs = tabs.filter((t) => overflowKeys.includes(t.key));
  const activeHidden = hiddenTabs.find((t) => isActiveTab(t));

  const renderItem = (t: OverflowTabItem, active: boolean): React.ReactNode => {
    const cls = cn(
      "inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
      active
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );
    if (t.to) {
      return (
        <NavLink to={t.to} className={cls}>
          {t.label}
        </NavLink>
      );
    }
    if (t.href) {
      return (
        <a href={t.href} className={cls}>
          {t.label}
        </a>
      );
    }
    return (
      <button type="button" onClick={t.onClick} className={cls}>
        {t.label}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-wrap items-center", className)}
      data-overflow-tabs={measured ? (overflowKeys.length > 0 ? "true" : "false") : "init"}
    >
      {visibleTabs.map((t, idx) => (
        <div
          key={t.key}
          ref={(node) => {
            itemsRef.current[idx] = node;
          }}
          className="contents"
        >
          {renderItem(t, isActiveTab(t))}
        </div>
      ))}

      {hiddenTabs.length > 0 && (
        <div
          ref={(node) => {
            itemsRef.current[visibleTabs.length] = node;
          }}
          className="contents"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-11 px-3 rounded-none text-sm font-medium border-b-2 -mb-px gap-1",
                  activeHidden
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                更多
                {hiddenTabs.length > 1 && (
                  <span className="inline-flex items-center justify-center text-xs text-muted-foreground bg-muted rounded-full h-4 min-w-4 px-1">
                    {hiddenTabs.length}
                  </span>
                )}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                {hiddenTabs.length} 个已折叠
              </DropdownMenuLabel>
              {hiddenTabs.map((t) => {
                const active = isActiveTab(t);
                if (t.to) {
                  return (
                    <DropdownMenuItem key={t.key} asChild>
                      <NavLink
                        to={t.to}
                        className={cn(
                          "cursor-pointer",
                          highlightInDropdown && active && "bg-primary/10 text-primary font-medium",
                        )}
                      >
                        {t.label}
                      </NavLink>
                    </DropdownMenuItem>
                  );
                }
                if (t.href) {
                  return (
                    <DropdownMenuItem key={t.key} asChild>
                      <a
                        href={t.href}
                        className={cn(
                          highlightInDropdown && active && "bg-primary/10 text-primary font-medium",
                        )}
                      >
                        {t.label}
                      </a>
                    </DropdownMenuItem>
                  );
                }
                return (
                  <DropdownMenuItem
                    key={t.key}
                    onClick={t.onClick}
                    className={cn(
                      highlightInDropdown && active && "bg-primary/10 text-primary font-medium",
                    )}
                  >
                    {t.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
