import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  LayoutDashboard,
  Sparkles,
  Building2,
  Smartphone,
  GitBranch,
  BarChart3,
  Dna,
  CheckCircle2,
  BookOpen,
  Cloud,
  Users,
  Settings2,
  ArrowRight,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  path: string;
  category: string;
  keywords: string[];
}

const COMMANDS: CommandItem[] = [
  { id: "dashboard", label: "工作台", icon: LayoutDashboard, path: "/dashboard", category: "导航", keywords: ["工作台", "dashboard", "首页"] },
  { id: "superai", label: "SuperAI 对话", icon: Sparkles, path: "/superai", category: "导航", keywords: ["AI", "对话", "superai", "智能"] },
  { id: "apps", label: "应用中心", icon: Smartphone, path: "/apps", category: "导航", keywords: ["应用", "apps", "列表"] },
  { id: "apps-new", label: "新建应用", icon: Smartphone, path: "/apps/new", category: "操作", keywords: ["新建", "创建", "应用", "new"] },
  { id: "apps-vibe", label: "VibeCoding", icon: Sparkles, path: "/apps/vibe", category: "操作", keywords: ["vibe", "代码", "AI生成", "vibecoding"] },
  { id: "process", label: "流程中心", icon: GitBranch, path: "/process", category: "导航", keywords: ["流程", "process", "审批"] },
  { id: "process-designer", label: "流程设计器", icon: GitBranch, path: "/process/designer", category: "操作", keywords: ["设计器", "bpmn", "流程设计"] },
  { id: "data", label: "数据中心", icon: BarChart3, path: "/data", category: "导航", keywords: ["数据", "data", "指标"] },
  { id: "ontology", label: "本体引擎", icon: Dna, path: "/ontology", category: "导航", keywords: ["本体", "ontology", "对象", "建模"] },
  { id: "quality", label: "质量中心", icon: CheckCircle2, path: "/quality", category: "导航", keywords: ["质量", "quality", "测试"] },
  { id: "knowledge", label: "知识库", icon: BookOpen, path: "/knowledge", category: "导航", keywords: ["知识", "knowledge", "文档", "RAG"] },
  { id: "market", label: "云市场", icon: Cloud, path: "/market", category: "导航", keywords: ["市场", "market", "模板"] },
  { id: "agents", label: "数字员工", icon: Users, path: "/agents", category: "导航", keywords: ["数字员工", "agents", "智能体"] },
  { id: "admin", label: "后台管理", icon: Settings2, path: "/admin", category: "导航", keywords: ["管理", "admin", "设置", "用户"] },
  { id: "admin-users", label: "用户管理", icon: Users, path: "/admin/users", category: "操作", keywords: ["用户", "users", "账号"] },
  { id: "admin-roles", label: "角色权限", icon: Settings2, path: "/admin/roles", category: "操作", keywords: ["角色", "权限", "RBAC"] },
  { id: "admin-logs", label: "操作日志", icon: Settings2, path: "/admin/logs", category: "操作", keywords: ["日志", "审计", "log"] },
];

const AI_ACTIONS = [
  { id: "ai-create-app", label: "用 AI 创建应用", description: "自然语言描述需求", icon: Sparkles },
  { id: "ai-create-object", label: "用 AI 创建本体对象", description: "自动生成数据模型", icon: Dna },
  { id: "ai-create-process", label: "用 AI 创建流程", description: "描述业务流程", icon: GitBranch },
  { id: "ai-query-data", label: "用 AI 查询数据", description: "自然语言查数据", icon: BarChart3 },
  { id: "ai-search-docs", label: "用 AI 搜索知识库", description: "RAG 语义搜索", icon: BookOpen },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Global ⌘K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Filter commands
  const filtered = query.trim()
    ? COMMANDS.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
    : COMMANDS;

  const showAiActions = query.trim().length > 0;

  // Handle selection
  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      navigate(item.path);
    },
    [navigate],
  );

  const handleAiAction = useCallback(
    (action: (typeof AI_ACTIONS)[number]) => {
      setOpen(false);
      navigate(`/superai?q=${encodeURIComponent(action.label)}`);
    },
    [navigate],
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = filtered.length + (showAiActions ? AI_ACTIONS.length : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + total) % total);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showAiActions && selectedIndex < AI_ACTIONS.length) {
        handleAiAction(AI_ACTIONS[selectedIndex]);
      } else {
        const cmdIndex = showAiActions
          ? selectedIndex - AI_ACTIONS.length
          : selectedIndex;
        if (filtered[cmdIndex]) {
          handleSelect(filtered[cmdIndex]);
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden max-w-xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="搜索菜单、操作、或输入 AI 指令..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11 text-sm"
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {/* AI Actions */}
          {showAiActions && (
            <div className="px-2 py-1">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                AI 操作
              </div>
              {AI_ACTIONS.map((action, i) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAiAction(action)}
                    className={`flex items-center gap-3 w-full px-2 py-2 rounded-md text-left transition-colors ${
                      selectedIndex === i
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {action.label}
                      </div>
                      {action.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {action.description}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Navigation & Actions */}
          <div className="px-2 py-1">
            {showAiActions && filtered.length > 0 && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                导航
              </div>
            )}
            {filtered.map((item, i) => {
              const Icon = item.icon;
              const idx = showAiActions ? i + AI_ACTIONS.length : i;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`flex items-center gap-3 w-full px-2 py-2 rounded-md text-left transition-colors ${
                    selectedIndex === idx
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{item.label}</div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {item.category}
                  </Badge>
                </button>
              );
            })}
            {filtered.length === 0 && !showAiActions && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                未找到匹配结果
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-xs">
                ↑↓
              </kbd>{" "}
              导航
            </span>
            <span>
              <kbd className="inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-xs">
                ↵
              </kbd>{" "}
              选择
            </span>
          </div>
          <span>MetaPlatform AI 助手</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
