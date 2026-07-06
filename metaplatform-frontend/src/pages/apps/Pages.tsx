import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { appsApi, type AppPage } from "@/lib/api";
import {
  Plus, Search, FileText, Loader2, Trash2, Edit, Wand2,
  Monitor, Smartphone, Tablet, FolderOpen, ChevronRight, ChevronDown, Copy,
  FileCode, FileEdit, LayoutDashboard, Palette, Sparkles,
  Save, RotateCcw, Clock, Hash, X,
  Type, Image, Square, List, Table2, CreditCard, Minus,
  GripVertical, Eye, Settings, Menu, Database, BarChart3,
  GitBranch, FileJson, Layers, BookOpen, Bot,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  FormLowCodeEditor, ListPageEditor, ReportEditor, FlowEditor, BIEditor,
} from "./editors";
import {
  TYPE_META, COMPONENT_PALETTE, PAGE_TYPE_OPTIONS,
} from "./editors/types";
import { usePageEditor } from "./editors/usePageEditor";
import { EditorShell } from "./editors/EditorShell";
import type { PageComponent, PageVersion } from "./editors/types";

/** 分类定义 — 对应截图中的彩色图标分类 */
interface TreeCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;       // tailwind color class
  bgColor: string;     // background color for icon
  typeFilter: string[]; // which page types belong here
  expanded: boolean;
}

/** 分类配置 */
const TREE_CATEGORIES: TreeCategory[] = [
  {
    id: "business-model", label: "业务模型", icon: <Database className="size-3.5" />,
    color: "text-red-500", bgColor: "bg-red-50", typeFilter: ["business_model", "custom"],
    expanded: true,
  },
  {
    id: "forms", label: "表单页面", icon: <FileEdit className="size-3.5" />,
    color: "text-blue-500", bgColor: "bg-blue-50", typeFilter: ["form", "lowcode"],
    expanded: false,
  },
  {
    id: "lists", label: "列表页面", icon: <LayoutDashboard className="size-3.5" />,
    color: "text-green-500", bgColor: "bg-green-50", typeFilter: ["list"],
    expanded: false,
  },
  {
    id: "vue-pages", label: "Vue 页面", icon: <FileJson className="size-3.5" />,
    color: "text-emerald-500", bgColor: "bg-emerald-50", typeFilter: ["vue", "procode"],
    expanded: false,
  },
  {
    id: "workflows", label: "业务流程", icon: <GitBranch className="size-3.5" />,
    color: "text-amber-500", bgColor: "bg-amber-50", typeFilter: ["workflow"],
    expanded: false,
  },
  {
    id: "reports", label: "报表页面", icon: <BarChart3 className="size-3.5" />,
    color: "text-indigo-500", bgColor: "bg-indigo-50", typeFilter: ["report", "dashboard"],
    expanded: false,
  },
  {
    id: "bi", label: "商业智能", icon: <Layers className="size-3.5" />,
    color: "text-violet-500", bgColor: "bg-violet-50", typeFilter: ["bi", "analytics"],
    expanded: false,
  },
];

/* ── State ── */

export default function Pages() {
  const navigate = useNavigate();
  const { appId } = useParams();

  /* ── Page list state ── */
  const [pages, setPages] = useState<AppPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<AppPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appName, setAppName] = useState("应用");
  const [categories, setCategories] = useState<TreeCategory[]>(TREE_CATEGORIES);

  /* ── Editor state ── */
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const editor = usePageEditor(appId, editingPageId);

  /* ── Dialogs ── */
  const [newPageDialogOpen, setNewPageDialogOpen] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageType, setNewPageType] = useState("lowcode");
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPage, setDeletingPage] = useState<AppPage | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Load page list ── */
  const loadPages = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const data = await appsApi.listPages(appId);
      setPages(data || []);
      const app = await appsApi.get(appId);
      setAppName(app?.name || "应用");
    } catch (err) {
      console.error("加载页面列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { loadPages(); }, [loadPages]);

  /* ── Helpers ── */
  const getPageMeta = (type: string) => {
    const meta = TYPE_META[type];
    if (meta) return meta;
    return { label: type, icon: FileText, color: "text-muted-foreground" as string };
  };
  const renderPageIcon = (type: string, className = "size-3.5") => {
    const IconComp = getPageMeta(type).icon;
    return <IconComp className={className} />;
  };

  const filteredPages = pages.filter(
    (p) => p.name.includes(search) || (TYPE_META[p.type]?.label || "").includes(search)
  );

  /** 切换分类展开/折叠 */
  const toggleCategory = (catId: string) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, expanded: !c.expanded } : c));
  };

  /** 按分类分组页面 — 每个页面只归入第一个匹配的分类 */
  const groupedByCategory = categories.map(cat => ({
    ...cat,
    pages: pages.filter(p => {
      const pageType = p.type || "lowcode";
      return cat.typeFilter.includes(pageType);
    }),
  }));

  /** 未分类的页面 — 不属于任何分类的页面 */
  const categorizedTypeSet = new Set(categories.flatMap(c => c.typeFilter));
  const uncategorizedPages = pages.filter(p => !categorizedTypeSet.has(p.type || "lowcode"));

  /* ── Component operations ── */
  const addComponent = (type: string) => {
    const meta = COMPONENT_PALETTE.find(c => c.type === type);
    const newComp: PageComponent = {
      id: `comp-${Date.now()}`,
      type,
      label: meta?.label || type,
      props: {},
    };
    editor.setComponents(prev => [...prev, newComp]);
    editor.setSelectedCompId(newComp.id);
  };

  const removeComponent = (id: string) => {
    editor.setComponents(prev => prev.filter(c => c.id !== id));
    if (editor.selectedCompId === id) editor.setSelectedCompId(null);
  };

  const updateComponent = (id: string, props: Record<string, any>) => {
    editor.setComponents(prev => prev.map(c => c.id === id ? { ...c, props: { ...c.props, ...props } } : c));
  };

  const moveComponent = (fromIdx: number, toIdx: number) => {
    editor.setComponents(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const selectedComp = editor.components.find(c => c.id === editor.selectedCompId) || null;

  /* ── Page CRUD ── */
  const handleCreatePage = async () => {
    if (!appId || !newPageName.trim()) return;
    setCreating(true);
    try {
      const result = await appsApi.createPage(appId, { name: newPageName.trim(), type: newPageType });
      setNewPageDialogOpen(false);
      setNewPageName("");
      setNewPageType("lowcode");
      await loadPages();
      if (result?.id) {
        const newPage = { id: result.id, name: newPageName.trim(), type: newPageType } as AppPage;
        setSelectedPage(newPage);
        setEditingPageId(result.id);
      }
    } catch (e) { console.error("创建页面失败:", e); }
    finally { setCreating(false); }
  };

  const handleDuplicatePage = async (page: AppPage) => {
    if (!appId) return;
    try {
      await appsApi.createPage(appId, { name: `${page.name} (副本)`, type: page.type, config: page.config });
      await loadPages();
    } catch (e) { console.error("复制页面失败:", e); }
  };

  const handleDeleteClick = (page: AppPage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
        setEditingPageId(null);
      }
      await loadPages();
    } catch (e) { console.error("删除页面失败:", e); }
    finally { setDeleting(false); setDeleteDialogOpen(false); setDeletingPage(null); }
  };

  const deviceWidth = editor.device === "desktop" ? "100%" : editor.device === "tablet" ? "768px" : "375px";

  /* ── Render canvas ── */
  const renderCanvas = () => {
    if (editor.components.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
          <LayoutDashboard className="size-10 mb-3 opacity-20" />
          <p className="text-sm">从左侧拖拽组件到此处</p>
          <p className="text-xs mt-1">或点击组件添加</p>
        </div>
      );
    }
    return editor.components.map((comp, idx) => (
      <div key={comp.id}
        draggable
        onDragStart={() => setDraggedType(comp.type)}
        onClick={() => editor.setSelectedCompId(comp.id)}
        className={`group relative p-3 border rounded-md mb-2 cursor-pointer transition-all ${
          editor.selectedCompId === comp.id
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-border hover:border-primary/30 hover:bg-muted/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-xs font-medium text-muted-foreground">{comp.label}</span>
            <span className="text-[10px] text-muted-foreground/50 font-mono">{comp.id.slice(-6)}</span>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {idx > 0 && (
              <button onClick={(e) => { e.stopPropagation(); moveComponent(idx, idx - 1); }}
                className="p-0.5 rounded hover:bg-muted text-xs" title="上移">↑</button>
            )}
            {idx < editor.components.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); moveComponent(idx, idx + 1); }}
                className="p-0.5 rounded hover:bg-muted text-xs" title="下移">↓</button>
            )}
            <button onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive" title="删除">
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs">
          {comp.type === "heading" && <h2 className="text-lg font-bold">{comp.props.text || "标题文本"}</h2>}
          {comp.type === "text" && <p className="text-muted-foreground">{comp.props.text || "这是一段文本内容..."}</p>}
          {comp.type === "button" && <Button size="sm" variant="outline">{comp.props.text || "按钮"}</Button>}
          {comp.type === "input" && <Input placeholder={comp.props.placeholder || "输入框"} className="h-8" />}
          {comp.type === "divider" && <hr className="my-1 border-border" />}
          {comp.type === "container" && <div className="border border-dashed rounded p-4 text-center text-xs text-muted-foreground">容器区域</div>}
          {comp.type === "card" && <div className="border rounded p-3 bg-card text-xs">卡片内容</div>}
          {comp.type === "list" && <div className="text-xs text-muted-foreground space-y-1"><p>• 列表项 1</p><p>• 列表项 2</p><p>• 列表项 3</p></div>}
          {comp.type === "table" && <table className="w-full text-xs border border-border"><thead><tr><th className="border border-border p-1 text-left">列1</th><th className="border border-border p-1 text-left">列2</th></tr></thead><tbody><tr><td className="border border-border p-1">-</td><td className="border border-border p-1">-</td></tr></tbody></table>}
          {comp.type === "image" && <div className="bg-muted h-16 rounded flex items-center justify-center text-xs text-muted-foreground">图片占位</div>}
        </div>
      </div>
    ));
  };

  /* ════════════════════════════════════════════════════════════════ */
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
        {/* ── Left: Page Tree Panel (截图风格) ── */}
        <div className="w-72 border-r bg-white flex flex-col">
          {/* Header: 应用搭建 + 菜单图标 */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">应用搭建</span>
            <button className="p-1 rounded hover:bg-muted text-muted-foreground">
              <Menu className="size-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input placeholder="请输入" value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm pr-8 bg-muted/30" />
            </div>
          </div>

          {/* Module Section Header: 模块 + add button */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-xs font-semibold text-muted-foreground">模块</span>
            <button className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="新建模块"
              onClick={() => setNewPageDialogOpen(true)}>
              <Plus className="size-3.5" />
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FolderOpen className="size-8 mb-2 opacity-30" />
                <p className="text-xs">暂无页面</p>
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setNewPageDialogOpen(true)}>
                  <Plus className="size-3 mr-1" /> 创建第一个页面
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {/* Root module node */}
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground">
                  <ChevronDown className="size-3" />
                  <FolderOpen className="size-3.5 text-amber-500" />
                  <span>{appName}</span>
                </div>

                {/* Category groups */}
                {groupedByCategory
                  .filter(cat => cat.pages.length > 0 || !search)
                  .map(cat => {
                    const catPages = search
                      ? cat.pages.filter(p => p.name.includes(search))
                      : cat.pages;
                    return (
                      <div key={cat.id}>
                        {/* Category header (expandable) */}
                        <div
                          onClick={() => toggleCategory(cat.id)}
                          className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded cursor-pointer text-sm hover:bg-muted/50 transition-colors"
                        >
                          {cat.expanded ? (
                            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                          )}
                          <span className={`${cat.color} shrink-0`}>{cat.icon}</span>
                          <span className="flex-1 text-[13px] font-medium">{cat.label}</span>
                          {catPages.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">{catPages.length}</span>
                          )}
                        </div>

                        {/* Category pages (when expanded) */}
                        {cat.expanded && catPages.length > 0 && (
                          <div className="space-y-0.5">
                            {catPages.map(page => {
                              const meta = getPageMeta(page.type);
                              const isSelected = selectedPage?.id === page.id;
                              return (
                                <div key={page.id}
                                  onClick={() => { setSelectedPage(page); setEditingPageId(page.id); }}
                                  className={`group flex items-center gap-2 pl-14 pr-2 py-1 rounded cursor-pointer text-[13px] transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-muted/50 text-foreground"
                                  }`}
                                >
                                  <span className={`shrink-0 ${isSelected ? "text-primary" : meta.color}`}>
                                    {renderPageIcon(page.type)}
                                  </span>
                                  <span className="flex-1 truncate">{page.name}</span>
                                  {/* Hover actions */}
                                  <div className={`flex gap-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedPage(page); setEditingPageId(page.id); }}
                                      className="p-0.5 rounded hover:bg-muted" title="编辑">
                                      <Edit className="size-3" />
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteClick(page, e)}
                                      className="p-0.5 rounded hover:bg-destructive/20 text-destructive" title="删除">
                                      <Trash2 className="size-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Uncategorized pages (shown in default category) */}
                {uncategorizedPages.length > 0 && (
                  <div>
                    <div
                      onClick={() => toggleCategory("uncategorized")}
                      className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded cursor-pointer text-sm hover:bg-muted/50 transition-colors"
                    >
                      <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-gray-400 shrink-0"><FileText className="size-3.5" /></span>
                      <span className="flex-1 text-[13px] font-medium">其他页面</span>
                      <span className="text-[10px] text-muted-foreground">{uncategorizedPages.length}</span>
                    </div>
                    {search && uncategorizedPages.map(page => {
                      const meta = getPageMeta(page.type);
                      const isSelected = selectedPage?.id === page.id;
                      return (
                        <div key={page.id}
                          onClick={() => { setSelectedPage(page); setEditingPageId(page.id); }}
                          className={`group flex items-center gap-2 pl-14 pr-2 py-1 rounded cursor-pointer text-[13px] transition-colors ${
                            isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <span className={`shrink-0 ${isSelected ? "text-primary" : meta.color}`}>{renderPageIcon(page.type)}</span>
                          <span className="flex-1 truncate">{page.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Inline Editor ── */}
        <div className="flex-1 flex flex-col">
          {selectedPage ? (
            <EditorShell
              pageName={editor.pageName}
              onPageNameChange={(name) => { editor.setPageName(name); editor.markDirty(); }}
              pageType={selectedPage.type}
              dirty={editor.dirty}
              currentVersion={editor.currentVersion}
              versions={editor.versions}
              onRestoreVersion={editor.restoreVersion}
              device={editor.device}
              onDeviceChange={editor.setDevice}
              showAI={editor.showAI}
              onToggleAI={() => editor.setShowAI(!editor.showAI)}
              saving={editor.saving}
              onSave={editor.savePage}
            >
              {selectedPage.type === "list" ? (
                <ListPageEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} />
              ) : selectedPage.type === "dashboard" || selectedPage.type === "report" ? (
                <ReportEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} />
              ) : selectedPage.type === "workflow" ? (
                <FlowEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} />
              ) : selectedPage.type === "bi" ? (
                <BIEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} />
              ) : (
                /* Default: form/lowcode */
                <FormLowCodeEditor components={editor.components} setComponents={editor.setComponents} setDirty={editor.setDirty} selectedCompId={editor.selectedCompId} setSelectedCompId={editor.setSelectedCompId} />
              )}
            </EditorShell>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Monitor className="size-12 mb-3 opacity-20" />
              <p className="text-sm">选择左侧页面开始编辑</p>
              <p className="text-xs mt-1">或点击「新建页面」创建</p>
            </div>
          )}
        </div>
      </div>

      {/* ── New Page Dialog ── */}
      <Dialog open={newPageDialogOpen} onOpenChange={setNewPageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建页面</DialogTitle>
            <DialogDescription>选择页面类型并命名</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-page-name">页面名称 *</Label>
              <Input id="new-page-name" value={newPageName} onChange={(e) => setNewPageName(e.target.value)}
                placeholder="如：客户详情页、订单列表" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>页面类型</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAGE_TYPE_OPTIONS.map((t) => (
                  <button key={t.value} type="button" onClick={() => setNewPageType(t.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 border rounded-lg transition-all ${
                      newPageType === t.value ? "border-primary bg-primary/5" : "hover:border-primary/50"
                    }`}>
                    <div className={newPageType === t.value ? "text-primary" : "text-muted-foreground"}>{t.icon}</div>
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={creating}>取消</Button></DialogClose>
            <Button onClick={handleCreatePage} disabled={creating || !newPageName.trim()}>
              {creating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Plus className="size-4 mr-1" />}
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除页面</DialogTitle>
            <DialogDescription>确定要删除页面「{deletingPage?.name}」吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={deleting}>取消</Button></DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
