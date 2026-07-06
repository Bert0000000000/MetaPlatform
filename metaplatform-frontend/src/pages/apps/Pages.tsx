import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/stat";
import { pagesApi, appsApi } from "@/lib/api";
import {
  Plus, Search, Layout, Code2, FileText, BarChart3,
  FileEdit, ClipboardList, Palette, Sparkles, Package, Loader2, Copy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface Page {
  id: string;
  name: string;
  type: "表单" | "列表" | "仪表盘" | "自定义" | "VibeCoding";
  icon: LucideIcon;
  status: "published" | "draft" | "archived";
  updatedAt: string;
}

// TODO: Replace with real API when backend ready (appsApi does not have pages listing endpoint)
const INITIAL_PAGES: Page[] = [
  { id: "p-1", name: "客户档案", type: "表单", icon: FileEdit, status: "published", updatedAt: "2026-07-01" },
  { id: "p-2", name: "客户列表", type: "列表", icon: ClipboardList, status: "published", updatedAt: "2026-07-02" },
  { id: "p-3", name: "销售仪表盘", type: "仪表盘", icon: BarChart3, status: "published", updatedAt: "2026-07-01" },
  { id: "p-4", name: "客户画像自定义页", type: "自定义", icon: Palette, status: "draft", updatedAt: "2026-07-03" },
  { id: "p-5", name: "VibeCoding Demo", type: "VibeCoding", icon: Sparkles, status: "draft", updatedAt: "2026-07-03" },
  { id: "p-6", name: "订单管理", type: "列表", icon: Package, status: "published", updatedAt: "2026-06-28" },
];

const TYPE_ICON_MAP: Record<Page["type"], React.ReactNode> = {
  表单: <FileText className="size-4" />,
  列表: <Layout className="size-4" />,
  仪表盘: <BarChart3 className="size-4" />,
  自定义: <Code2 className="size-4" />,
  VibeCoding: <Code2 className="size-4" />,
};

const PAGE_TYPE_OPTIONS: Array<{ value: Page["type"]; label: string }> = [
  { value: "表单", label: "表单" },
  { value: "列表", label: "列表" },
  { value: "仪表盘", label: "仪表盘" },
  { value: "自定义", label: "自定义" },
  { value: "VibeCoding", label: "VibeCoding" },
];

export default function Pages() {
  const navigate = useNavigate();
  const { appId } = useParams();
  const [pages, setPages] = useState<Page[]>(INITIAL_PAGES);
  const [search, setSearch] = useState("");

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageType, setNewPageType] = useState<Page["type"]>("表单");

  const filtered = pages.filter((p) => p.name.includes(search));

  const handleCreatePage = async () => {
    if (!newPageName.trim()) return;
    setCreating(true);

    try {
      // Use appsApi.createPage if we have an appId, otherwise use pagesApi.create
      const typeMap: Record<string, string> = {
        "表单": "form",
        "列表": "list",
        "仪表盘": "dashboard",
        "自定义": "custom",
        "VibeCoding": "vibe_coding",
      };

      if (appId) {
        const created = await appsApi.createPage(appId, {
          name: newPageName.trim(),
          type: typeMap[newPageType] || "list",
        });
        const newPage: Page = {
          id: created.id,
          name: created.name,
          type: newPageType,
          icon: newPageType === "VibeCoding" ? Sparkles : FileEdit,
          status: created.status as Page["status"],
          updatedAt: created.updated_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        };
        setPages((prev) => [newPage, ...prev]);
      } else {
        const created = await pagesApi.create({
          app_id: "demo",
          name: newPageName.trim(),
          type: typeMap[newPageType] || "list",
        });
        const newPage: Page = {
          id: created.id,
          name: created.name,
          type: newPageType,
          icon: newPageType === "VibeCoding" ? Sparkles : FileEdit,
          status: created.status as Page["status"],
          updatedAt: created.updated_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        };
        setPages((prev) => [newPage, ...prev]);
      }
    } catch (e) {
      console.error("创建页面失败:", e);
      // Fallback to local-only creation on API failure
      const newPage: Page = {
        id: `p-${Date.now()}`,
        name: newPageName.trim(),
        type: newPageType,
        icon: newPageType === "VibeCoding" ? Sparkles : FileEdit,
        status: "draft",
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      setPages((prev) => [newPage, ...prev]);
    }

    setNewPageName("");
    setNewPageType("表单");
    setShowCreateDialog(false);
    setCreating(false);
  };

  const handleCardClick = (page: Page) => {
    // Navigate to page designer/preview based on type
    if (page.type === "VibeCoding") {
      navigate(`/apps/${appId || "demo"}/vibe-coding?pageId=${page.id}`);
    } else {
      navigate(`/apps/${appId || "demo"}/page-designer?pageId=${page.id}`);
    }
  };

  // F4.4.1.5 页面复制
  const handleCopyPage = (page: Page) => {
    const newPage: Page = {
      id: `p-${Date.now()}`,
      name: `${page.name} (副本)`,
      type: page.type,
      icon: page.icon,
      status: "draft",
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setPages((prev) => [newPage, ...prev]);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="页面"
        description="LowCode + VUE + VibeCoding 三轨"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Code2 className="size-4" /> VibeCoding
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
              <Plus className="size-4" /> 新建页面
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">表单</div>
            <div className="text-xl font-semibold mt-1">
              {pages.filter((p) => p.type === "表单").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">列表</div>
            <div className="text-xl font-semibold mt-1">
              {pages.filter((p) => p.type === "列表").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">仪表盘</div>
            <div className="text-xl font-semibold mt-1">
              {pages.filter((p) => p.type === "仪表盘").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">自定义/VibeCoding</div>
            <div className="text-xl font-semibold mt-1">
              {pages.filter((p) => p.type === "自定义" || p.type === "VibeCoding").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="搜索页面..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Page cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <FileText className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? "没有匹配的页面" : "暂无页面"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="size-4 mr-1" /> 新建页面
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((page) => (
            <Card
              key={page.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleCardClick(page)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <page.icon className="size-5" />
                  <Badge variant="outline" className="gap-1">
                    {TYPE_ICON_MAP[page.type]} {page.type}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2">{page.name}</CardTitle>
                <CardDescription>最后更新: {page.updatedAt}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant={page.status === "published" ? "default" : "secondary"}>
                    {page.status === "published" ? "已发布" : page.status === "draft" ? "草稿" : "已归档"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); handleCopyPage(page); }}
                    title="复制页面"
                  >
                    <Copy className="size-3 mr-1" /> 复制
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Page Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建页面</DialogTitle>
            <DialogDescription>创建一个新页面，选择页面类型</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="page-name">页面名称 *</Label>
              <Input
                id="page-name"
                placeholder="如：客户详情页、订单列表"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>页面类型</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAGE_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewPageType(opt.value)}
                    className={`text-left rounded border p-3 transition-all hover:border-primary ${
                      newPageType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {TYPE_ICON_MAP[opt.value]}
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleCreatePage} disabled={creating || !newPageName.trim()}>
              {creating ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Plus className="size-4 mr-1" />
              )}
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
