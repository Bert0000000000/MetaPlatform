import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Save, Eye, Monitor, Tablet, Smartphone,
  Plus, Trash2, Settings, Move, Code, Wand2, Loader2,
  GripVertical, ChevronDown, ChevronRight,
} from "lucide-react";
import { appsApi, type AppPage } from "@/lib/api";
import { PageHeader } from "@/components/ui/stat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface PageComponent {
  id: string;
  type: string;
  label: string;
  props: Record<string, any>;
  children?: PageComponent[];
}

const COMPONENT_PALETTE = [
  { type: "heading", label: "标题", icon: "H1" },
  { type: "text", label: "文本", icon: "T" },
  { type: "button", label: "按钮", icon: "B" },
  { type: "input", label: "输入框", icon: "I" },
  { type: "image", label: "图片", icon: "IMG" },
  { type: "container", label: "容器", icon: "DIV" },
  { type: "list", label: "列表", icon: "UL" },
  { type: "table", label: "表格", icon: "TB" },
  { type: "card", label: "卡片", icon: "CD" },
  { type: "divider", label: "分割线", icon: "---" },
];

export default function PageEditor() {
  const { appId } = useParams();
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get("pageId");
  const modeParam = searchParams.get("mode");
  const navigate = useNavigate();

  const [components, setComponents] = useState<PageComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageName, setPageName] = useState("新页面");
  const [pageType, setPageType] = useState<string>("lowcode");
  const [mode, setMode] = useState<"lowcode" | "procode" | "ai">(
    (modeParam as "lowcode" | "procode" | "ai") || "lowcode"
  );
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draggedType, setDraggedType] = useState<string | null>(null);

  // Load existing page content
  useEffect(() => {
    if (!appId) return;
    setLoading(true);
    appsApi
      .listPages(appId)
      .then((data) => {
        if (!data) return;
        const target = pageId
          ? data.find((p: AppPage) => p.id === pageId)
          : data[0];
        if (target) {
          setPageName(target.name);
          setPageType(target.type || "lowcode");
          // Try to parse config as component tree
          if (target.config) {
            try {
              const parsed = JSON.parse(target.config);
              if (Array.isArray(parsed)) {
                setComponents(parsed);
              } else if (parsed && Array.isArray(parsed.components)) {
                setComponents(parsed.components);
                if (parsed.name) setPageName(parsed.name);
              }
            } catch {
              // ignore
            }
          }
        }
      })
      .catch((e) => console.error("加载页面数据失败:", e))
      .finally(() => setLoading(false));
  }, [appId, pageId]);

  const addComponent = (type: string) => {
    const newComp: PageComponent = {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: COMPONENT_PALETTE.find((c) => c.type === type)?.label || type,
      props: {},
    };
    setComponents((prev) => [...prev, newComp]);
    setSelectedId(newComp.id);
  };

  const removeComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const moveComponent = (id: string, direction: "up" | "down") => {
    setComponents((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const updateComponent = (id: string, props: Record<string, any>) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, props: { ...c.props, ...props } } : c
      )
    );
  };

  const handleSave = async () => {
    if (!appId) return;
    setSaving(true);
    try {
      const pageDef = { name: pageName, components, mode, type: pageType };
      const configStr = JSON.stringify(pageDef, null, 2);

      if (pageId) {
        await appsApi.updatePage(appId, pageId, { config: configStr });
      } else {
        const result = await appsApi.createPage(appId, {
          name: pageName,
          type: pageType === "ai" ? "custom" : pageType,
          config: configStr,
        });
        if (result && result.id) {
          navigate(`/apps/${appId}/page-editor?pageId=${result.id}`, { replace: true });
        }
      }
    } catch (e) {
      console.error("保存页面失败:", e);
    }
    setSaving(false);
  };

  // Render the canvas with dropped components
  const renderCanvas = () => {
    if (components.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground min-h-[400px]">
          <div className="text-4xl mb-3 opacity-30">
            <Settings className="size-10" />
          </div>
          <p className="text-sm">从左侧拖拽组件到此处</p>
          <p className="text-xs mt-1">或点击组件快速添加</p>
        </div>
      );
    }
    return components.map((comp, index) => (
      <div
        key={comp.id}
        onClick={() => setSelectedId(comp.id)}
        className={`p-3 border rounded-md mb-2 cursor-pointer transition-colors group ${
          selectedId === comp.id
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-border hover:border-primary/50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-xs font-medium text-muted-foreground">
              {comp.label}
            </span>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              onClick={(e) => { e.stopPropagation(); moveComponent(comp.id, "up"); }}
              disabled={index === 0}
            >
              <ChevronDown className="size-3 rotate-180" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              onClick={(e) => { e.stopPropagation(); moveComponent(comp.id, "down"); }}
              disabled={index === components.length - 1}
            >
              <ChevronDown className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 text-destructive"
              onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
        {/* Render a preview based on type */}
        <div className="mt-2">
          {comp.type === "heading" && (
            <h2 className="text-lg font-bold">
              {comp.props.text || "标题文本"}
            </h2>
          )}
          {comp.type === "text" && (
            <p className="text-sm">
              {comp.props.text || "这是一段文本内容，可在右侧属性面板中编辑。"}
            </p>
          )}
          {comp.type === "button" && (
            <Button size="sm" variant="outline">
              {comp.props.text || "按钮"}
            </Button>
          )}
          {comp.type === "input" && (
            <Input
              placeholder={comp.props.placeholder || "请输入..."}
              className="h-8 max-w-xs"
            />
          )}
          {comp.type === "divider" && <hr className="my-1 border-border" />}
          {comp.type === "container" && (
            <div className="border border-dashed rounded p-4 text-center text-xs text-muted-foreground">
              {comp.props.text || "容器区域"}
            </div>
          )}
          {comp.type === "card" && (
            <Card className="text-xs max-w-sm">
              <CardContent className="p-3">
                {comp.props.text || "卡片内容区域"}
              </CardContent>
            </Card>
          )}
          {comp.type === "list" && (
            <div className="text-xs space-y-1">
              <p>- 列表项 1</p>
              <p>- 列表项 2</p>
              <p>- 列表项 3</p>
            </div>
          )}
          {comp.type === "table" && (
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-1 text-left">列1</th>
                  <th className="border p-1 text-left">列2</th>
                  <th className="border p-1 text-left">列3</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-1">数据1</td>
                  <td className="border p-1">数据2</td>
                  <td className="border p-1">数据3</td>
                </tr>
              </tbody>
            </table>
          )}
          {comp.type === "image" && (
            <div className="bg-muted h-24 rounded flex items-center justify-center text-xs text-muted-foreground">
              图片占位
            </div>
          )}
        </div>
      </div>
    ));
  };

  const deviceWidth =
    device === "desktop" ? "100%" : device === "tablet" ? "768px" : "375px";

  const selectedComp = selectedId
    ? components.find((c) => c.id === selectedId)
    : null;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6 h-[calc(100vh-100px)]">
        <PageHeader title="页面编辑器" description="加载中..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigate(`/apps/${appId}/pages`)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="h-6 w-px bg-border" />
          <Input
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            className="h-8 w-48 text-sm font-medium"
            placeholder="页面名称"
          />
          <Badge
            variant={mode === "lowcode" ? "default" : "secondary"}
            className="cursor-pointer gap-1"
            onClick={() => setMode("lowcode")}
          >
            <Wand2 className="size-3" /> LowCode
          </Badge>
          <Badge
            variant={mode === "procode" ? "default" : "secondary"}
            className="cursor-pointer gap-1"
            onClick={() => setMode("procode")}
          >
            <Code className="size-3" /> ProCode
          </Badge>
          <Badge
            variant={mode === "ai" ? "default" : "secondary"}
            className="cursor-pointer gap-1"
            onClick={() => setMode("ai")}
          >
            <Wand2 className="size-3" /> AI
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border rounded-md p-0.5">
            <Button
              variant={device === "desktop" ? "default" : "ghost"}
              size="icon"
              className="size-7"
              onClick={() => setDevice("desktop")}
            >
              <Monitor className="size-3.5" />
            </Button>
            <Button
              variant={device === "tablet" ? "default" : "ghost"}
              size="icon"
              className="size-7"
              onClick={() => setDevice("tablet")}
            >
              <Tablet className="size-3.5" />
            </Button>
            <Button
              variant={device === "mobile" ? "default" : "ghost"}
              size="icon"
              className="size-7"
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="size-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm">
            <Eye className="size-3.5 mr-1" /> 预览
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="size-3.5 mr-1" />
            )}
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Component Palette */}
        <div className="w-52 border-r p-3 overflow-y-auto bg-muted/10">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            组件库
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {COMPONENT_PALETTE.map((c) => (
              <button
                key={c.type}
                draggable
                onDragStart={() => setDraggedType(c.type)}
                onClick={() => addComponent(c.type)}
                className="flex flex-col items-center gap-1 p-2.5 rounded border text-xs hover:border-primary hover:bg-primary/5 transition-colors cursor-grab active:cursor-grabbing bg-background"
              >
                <span className="text-sm font-mono text-primary">{c.icon}</span>
                <span className="text-muted-foreground">{c.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              页面信息
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>组件数量</span>
                <span className="font-medium text-foreground">{components.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>编辑模式</span>
                <Badge variant="outline" className="text-[10px] h-5">{mode}</Badge>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>页面类型</span>
                <span className="font-medium text-foreground">{pageType}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div
          className="flex-1 overflow-y-auto bg-muted/30 p-4 flex justify-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggedType) {
              addComponent(draggedType);
              setDraggedType(null);
            }
          }}
        >
          <div
            className="bg-white border rounded-lg shadow-sm overflow-y-auto"
            style={{ width: deviceWidth, minHeight: "500px", maxWidth: "100%" }}
          >
            <div className="p-4">
              <div className="mb-4 pb-2 border-b border-dashed">
                <p className="text-xs text-muted-foreground">
                  {device === "desktop"
                    ? "桌面端视图"
                    : device === "tablet"
                    ? "平板端视图 (768px)"
                    : "移动端视图 (375px)"}
                </p>
              </div>
              {renderCanvas()}
            </div>
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div className="w-64 border-l p-3 overflow-y-auto bg-muted/10">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            属性面板
          </h3>
          {selectedComp ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">组件类型</Label>
                <p className="text-sm font-medium mt-0.5">{selectedComp.label}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">组件 ID</Label>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
                  {selectedComp.id}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">显示文本</Label>
                <Input
                  value={selectedComp.props.text || ""}
                  onChange={(e) =>
                    updateComponent(selectedComp.id, { text: e.target.value })
                  }
                  className="h-8 text-sm mt-1"
                  placeholder="输入文本内容..."
                />
              </div>
              {selectedComp.type === "input" && (
                <div>
                  <Label className="text-xs text-muted-foreground">占位符</Label>
                  <Input
                    value={selectedComp.props.placeholder || ""}
                    onChange={(e) =>
                      updateComponent(selectedComp.id, {
                        placeholder: e.target.value,
                      })
                    }
                    className="h-8 text-sm mt-1"
                    placeholder="输入占位符..."
                  />
                </div>
              )}
              {(selectedComp.type === "heading" ||
                selectedComp.type === "text" ||
                selectedComp.type === "button") && (
                <div>
                  <Label className="text-xs text-muted-foreground">详细描述</Label>
                  <Textarea
                    value={selectedComp.props.description || ""}
                    onChange={(e) =>
                      updateComponent(selectedComp.id, {
                        description: e.target.value,
                      })
                    }
                    className="text-sm mt-1"
                    rows={3}
                    placeholder="可选的描述文本..."
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">必填字段</Label>
                <input
                  type="checkbox"
                  checked={selectedComp.props.required || false}
                  onChange={(e) =>
                    updateComponent(selectedComp.id, { required: e.target.checked })
                  }
                  className="rounded"
                />
              </div>
              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => removeComponent(selectedComp.id)}
                >
                  <Trash2 className="size-3 mr-1" /> 删除组件
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground mt-8">
              <Settings className="size-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">点击画布中的组件</p>
              <p className="text-xs">查看和编辑其属性</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
