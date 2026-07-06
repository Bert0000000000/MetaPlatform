import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { appsApi, type AppPage } from "@/lib/api";
import {
  Plus, Search, FileText, Loader2, Trash2, Edit, Wand2,
  Monitor, FolderOpen, ChevronRight, ChevronDown, Copy, Eye,
  FileCode, FileEdit, LayoutDashboard, Palette, Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  form: { label: "表单", icon: <FileEdit className="size-3.5" />, color: "text-blue-500" },
  list: { label: "列表", icon: <LayoutDashboard className="size-3.5" />, color: "text-green-500" },
  dashboard: { label: "仪表盘", icon: <LayoutDashboard className="size-3.5" />, color: "text-purple-500" },
  custom: { label: "自定义", icon: <Palette className="size-3.5" />, color: "text-orange-500" },
  vibe_coding: { label: "VibeCoding", icon: <Sparkles className="size-3.5" />, color: "text-pink-500" },
  lowcode: { label: "LowCode", icon: <Palette className="size-3.5" />, color: "text-blue-500" },
  procode: { label: "ProCode", icon: <FileCode className="size-3.5" />, color: "text-green-500" },
  ai: { label: "AI 生成", icon: <Wand2 className="size-3.5" />, color: "text-purple-500" },
};

const TYPE_OPTIONS = [
  { value: "lowcode", label: "LowCode", icon: <Palette className="size-4" /> },
  { value: "procode", label: "ProCode", icon: <FileCode className="size-4" /> },
  { value: "ai", label: "AI 生成", icon: <Wand2 className="size-4" /> },
];

export default function Pages() {
  const navigate = useNavigate();
  const { appId } = useParams();

  const [pages, setPages] = useState<AppPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<AppPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create dialog state
  const [newPageDialogOpen, setNewPageDialogOpen] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageType, setNewPageType] = useState("lowcode");
  const [creating, setCreating] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPage, setDeletingPage] = useState<AppPage | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load pages from API
  const loadPages = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const data = await appsApi.listPages(appId);
      setPages(data || []);
    } catch (err) {
      console.error("加载页面列表失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, [appId]);

  const filteredPages = pages.filter(
    (p) => p.name.includes(search) || (TYPE_META[p.type]?.label || "").includes(search)
  );

  // Create page and navigate to editor
  const handleCreatePage = async () => {
    if (!appId || !newPageName.trim()) return;
    setCreating(true);
    try {
      const result = await appsApi.createPage(appId, {
        name: newPageName.trim(),
        type: newPageType,
      });
      setNewPageDialogOpen(false);
      setNewPageName("");
      setNewPageType("lowcode");
      // Navigate to page editor
      if (result && result.id) {
        navigate(`/apps/${appId}/page-editor?pageId=${result.id}`);
      } else {
        await loadPages();
      }
    } catch (e) {
      console.error("创建页面失败:", e);
    } finally {
      setCreating(false);
    }
  };

  // Duplicate page
  const handleDuplicatePage = async (page: AppPage) => {
    if (!appId) return;
    try {
      await appsApi.createPage(appId, {
        name: `${page.name} (副本)`,
        type: page.type,
        config: page.config,
      });
      await loadPages();
    } catch (e) {
      console.error("复制页面失败:", e);
    }
  };

  // Delete page
  const handleDeleteClick = (page: AppPage, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingPage(page);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!appId || !deletingPage) return;
    setDeleting(true);
    try {
      await appsApi.deletePage(appId, deletingPage.id);
      if (selectedPage?.id === deletingPage.id) {
        setSelectedPage(null);
      }
      await loadPages();
    } catch (err) {
      console.error("删除页面失败:", err);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingPage(null);
    }
  };

  const getPageMeta = (type: string) =>
    TYPE_META[type] || { label: type, icon: <FileText className="size-3.5" />, color: "text-muted-foreground" };

  return (
    <div className="flex flex-col gap-0 p-6 h-[calc(100vh-100px)]">
      <PageHeader
        title="页面"
        description="管理应用页面结构"
        action={
          <Button className="gap-2" onClick={() => setNewPageDialogOpen(true)}>
            <Plus className="size-4" /> 新建页面
          </Button>
        }
      />

      <div className="flex flex-1 border rounded-lg overflow-hidden mt-4">
        {/* Left: Page Tree Panel */}
        <div className="w-72 border-r bg-muted/10 flex flex-col">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索页面..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FolderOpen className="size-8 mb-2 opacity-30" />
                <p className="text-xs">
                  {search ? "没有匹配的页面" : "暂无页面"}
                </p>
                {!search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => setNewPageDialogOpen(true)}
                  >
                    <Plus className="size-3 mr-1" /> 创建第一个页面
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {/* Root node */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  <ChevronDown className="size-3" />
                  <FolderOpen className="size-3.5 text-amber-500" />
                  <span>页面 ({filteredPages.length})</span>
                </div>

                {/* Page nodes */}
                {filteredPages.map((page) => {
                  const meta = getPageMeta(page.type);
                  const isSelected = selectedPage?.id === page.id;
                  return (
                    <div
                      key={page.id}
                      onClick={() => setSelectedPage(page)}
                      className={`group flex items-center gap-2 pl-6 pr-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className={`${isSelected ? "text-primary-foreground" : meta.color}`}>
                        {meta.icon}
                      </span>
                      <span className="flex-1 truncate text-[13px]">{page.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected ? "bg-primary-foreground/20" : "bg-muted"
                      }`}>
                        {meta.label}
                      </span>
                      {/* Hover actions */}
                      <div className={`flex gap-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/apps/${appId}/page-editor?pageId=${page.id}`);
                          }}
                          className={`p-0.5 rounded hover:bg-${isSelected ? "primary-foreground/20" : "accent"}`}
                          title="编辑"
                        >
                          <Edit className="size-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(page, e)}
                          className={`p-0.5 rounded hover:bg-destructive/20`}
                          title="删除"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Page Detail Panel */}
        <div className="flex-1 flex flex-col">
          {selectedPage ? (
            <div className="flex flex-col h-full">
              {/* Page Header Bar */}
              <div className="flex items-center justify-between border-b px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md bg-muted ${getPageMeta(selectedPage.type).color}`}>
                    {getPageMeta(selectedPage.type).icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{selectedPage.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      类型: {getPageMeta(selectedPage.type).label}
                      {selectedPage.created_at && (
                        <span> | 创建于 {selectedPage.created_at.slice(0, 10)}</span>
                      )}
                      {selectedPage.updated_at && (
                        <span> | 更新于 {selectedPage.updated_at.slice(0, 10)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/apps/${appId}/page-editor?pageId=${selectedPage.id}`)}
                  >
                    <Edit className="size-3.5 mr-1" /> 编辑页面
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/apps/${appId}/page-editor?mode=ai&pageId=${selectedPage.id}`)}
                  >
                    <Wand2 className="size-3.5 mr-1" /> AI 编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicatePage(selectedPage)}
                  >
                    <Copy className="size-3.5 mr-1" /> 复制
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => handleDeleteClick(selectedPage, e)}
                  >
                    <Trash2 className="size-3.5 mr-1" /> 删除
                  </Button>
                </div>
              </div>

              {/* Page Preview Area */}
              <div className="flex-1 p-5 overflow-y-auto bg-muted/20">
                <div className="border rounded-lg bg-white p-6 max-w-2xl mx-auto shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`p-1 rounded ${getPageMeta(selectedPage.type).color}`}>
                      {getPageMeta(selectedPage.type).icon}
                    </div>
                    <h2 className="text-lg font-semibold">{selectedPage.name}</h2>
                    <Badge variant="outline" className="text-[10px]">
                      {getPageMeta(selectedPage.type).label}
                    </Badge>
                    <Badge
                      variant={selectedPage.status === "published" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {selectedPage.status === "published" ? "已发布" : "草稿"}
                    </Badge>
                  </div>

                  {selectedPage.config ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        此页面已包含组件配置，点击下方按钮进入编辑器查看和修改。
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      页面暂无内容，点击编辑开始设计。
                    </p>
                  )}

                  <div className="mt-5 border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <Monitor className="size-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">页面预览区域</p>
                    <p className="text-xs mt-1">进入编辑器后可实时预览页面效果</p>
                    <Button
                      className="mt-4"
                      size="sm"
                      onClick={() => navigate(`/apps/${appId}/page-editor?pageId=${selectedPage.id}`)}
                    >
                      <Edit className="size-3.5 mr-1" /> 开始编辑
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Monitor className="size-12 mb-3 opacity-20" />
              <p className="text-sm">选择左侧页面进行查看</p>
              <p className="text-xs mt-1">或点击「新建页面」开始创建</p>
            </div>
          )}
        </div>
      </div>

      {/* New Page Dialog */}
      <Dialog open={newPageDialogOpen} onOpenChange={setNewPageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建页面</DialogTitle>
            <DialogDescription>选择页面类型并命名</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-page-name">页面名称 *</Label>
              <Input
                id="new-page-name"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="如：客户详情页、订单列表"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>页面类型</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNewPageType(t.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 border rounded-lg transition-all ${
                      newPageType === t.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <div className={newPageType === t.value ? "text-primary" : "text-muted-foreground"}>
                      {t.icon}
                    </div>
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={creating}>取消</Button>
            </DialogClose>
            <Button
              onClick={handleCreatePage}
              disabled={creating || !newPageName.trim()}
            >
              {creating ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Plus className="size-4 mr-1" />
              )}
              {creating ? "创建中..." : "创建并编辑"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除页面</DialogTitle>
            <DialogDescription>
              确定要删除页面「{deletingPage?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>取消</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
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
