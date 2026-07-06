import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { appsApi, filesystemApi } from "@/lib/api";
import {
  ArrowLeft, Save, Eye, Monitor, Tablet, Smartphone,
  Bot, Loader2, Hash, Clock, ChevronDown, Sparkles,
  FileText, LayoutDashboard, GitBranch, Database, BarChart3,
  Layers, FileEdit, FileCode, Palette, Send, X,
} from "lucide-react";
import { AICoPilot } from "./editors/AICoPilot";

// Lazy-load specialized editors
// For now, we'll use inline conditional rendering
// Later these can be split into separate files

interface PageData {
  id: string;
  name: string;
  type: string;
  config?: string;
  status?: string;
}

interface PageComponent {
  id: string;
  type: string;
  label: string;
  props: Record<string, any>;
  span?: number; // grid span: 12=full, 6=half, 4=third, 3=quarter
}

interface PageVersion {
  version: number;
  timestamp: string;
  components: PageComponent[];
}

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  form:      { label: "表单页面", icon: FileEdit, color: "text-blue-500" },
  list:      { label: "列表页面", icon: LayoutDashboard, color: "text-green-500" },
  dashboard: { label: "仪表盘",   icon: BarChart3, color: "text-purple-500" },
  report:    { label: "报表页面", icon: BarChart3, color: "text-indigo-500" },
  workflow:  { label: "业务流程", icon: GitBranch, color: "text-amber-500" },
  bi:        { label: "商业智能", icon: Layers, color: "text-violet-500" },
  custom:    { label: "自定义",   icon: Palette, color: "text-orange-500" },
  lowcode:   { label: "LowCode",  icon: Palette, color: "text-blue-500" },
  procode:   { label: "ProCode",  icon: FileCode, color: "text-emerald-500" },
  ai:        { label: "AI 生成",  icon: Sparkles, color: "text-purple-500" },
};

export default function PageEditor() {
  const { appId } = useParams();
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get("pageId");
  const navigate = useNavigate();

  // Page data
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [pageName, setPageName] = useState("");
  const [components, setComponents] = useState<PageComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Version
  const [currentVersion, setCurrentVersion] = useState(0);
  const [versions, setVersions] = useState<PageVersion[]>([]);

  // UI state
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showAI, setShowAI] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  // Load page data
  useEffect(() => {
    if (!appId || !pageId) { setLoading(false); return; }
    const loadPage = async () => {
      try {
        // Load page metadata
        const pages = await appsApi.listPages(appId);
        const page = pages?.find((p: any) => p.id === pageId);
        if (page) {
          setPageData(page);
          setPageName(page.name);
        }
        // Load page content from filesystem
        const files = await filesystemApi.listFiles({ app_id: appId });
        const configFile = files?.find((f: any) => f.name === `page-${pageId}.json`);
        if (configFile?.content) {
          const parsed = JSON.parse(configFile.content);
          if (parsed.components) setComponents(parsed.components);
          if (parsed.version) setCurrentVersion(parsed.version);
          if (parsed.versionHistory) setVersions(parsed.versionHistory);
        }
      } catch (e) { console.error("Failed to load page:", e); }
      setLoading(false);
    };
    loadPage();
  }, [appId, pageId]);

  // Save
  const handleSave = async () => {
    if (!appId || !pageId) return;
    setSaving(true);
    try {
      const newVer = currentVersion + 1;
      const newVersion: PageVersion = { version: newVer, timestamp: new Date().toISOString(), components: [...components] };
      const pageDef = { name: pageName, components, version: newVer, versionHistory: [...versions, newVersion].slice(-20) };
      const fileName = `page-${pageId}.json`;
      const files = await filesystemApi.listFiles({ app_id: appId });
      const existing = files?.find((f: any) => f.name === fileName);
      if (existing) {
        await filesystemApi.updateFile(existing.id, { content: JSON.stringify(pageDef, null, 2) });
      } else {
        await filesystemApi.createFile({ app_id: appId, name: fileName, is_dir: false, content: JSON.stringify(pageDef, null, 2) });
      }
      setCurrentVersion(newVer);
      setVersions(prev => [...prev, newVersion]);
      setDirty(false);
    } catch (e) { console.error("Save failed:", e); }
    setSaving(false);
  };

  const pageType = pageData?.type || "lowcode";
  const typeMeta = TYPE_META[pageType] || TYPE_META.lowcode;
  const TypeIcon = typeMeta.icon;
  const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "375px";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <Input value={pageName} onChange={(e) => { setPageName(e.target.value); setDirty(true); }}
            className="h-7 w-48 text-sm font-semibold border-none shadow-none focus-visible:ring-0 px-0" />
          <Badge variant="outline" className={`text-[10px] gap-1 ${typeMeta.color}`}>
            <TypeIcon className="size-3" /> {typeMeta.label}
          </Badge>
          {dirty && <Badge variant="secondary" className="text-[10px] gap-1"><span className="size-1.5 rounded-full bg-orange-400 inline-block" />未保存</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {/* Version */}
          <button onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
            <Hash className="size-3" /> v{currentVersion}
          </button>
          {/* Device preview */}
          <div className="flex gap-0.5 border rounded p-0.5">
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([d, Icon]) => (
              <button key={d} onClick={() => setDevice(d)}
                className={`p-1 rounded ${device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          {/* AI toggle */}
          <Button variant={showAI ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1"
            onClick={() => setShowAI(!showAI)}>
            <Bot className="size-3.5" /> AI 助手
          </Button>
          {/* Save */}
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Save className="size-3 mr-1" />}
            {saving ? "保存中" : "保存"}
          </Button>
        </div>
      </div>

      {/* Version History Panel */}
      {showVersions && (
        <div className="border-b bg-muted/30 px-4 py-3 max-h-40 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">版本历史</span>
            <button onClick={() => setShowVersions(false)}><X className="size-3.5 text-muted-foreground" /></button>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无版本记录</p>
          ) : (
            [...versions].reverse().map(ver => (
              <div key={ver.version} className={`flex items-center justify-between px-2 py-1 rounded text-xs ${ver.version === currentVersion ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{ver.version}</span>
                  <span className="text-muted-foreground">{ver.components?.length || 0} 个组件</span>
                  <span className="text-muted-foreground/60 flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {ver.timestamp ? new Date(ver.timestamp).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "--"}
                  </span>
                </div>
                {ver.version === currentVersion && <Badge variant="default" className="text-[10px] py-0">当前</Badge>}
                {ver.version !== currentVersion && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5"
                    onClick={() => { setComponents(ver.components); setCurrentVersion(ver.version); setShowVersions(false); }}>
                    恢复
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Main Area: Editor + AI Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Canvas Area */}
        <div className={`flex-1 overflow-y-auto bg-muted/20 p-4 flex justify-center ${showAI ? "border-r" : ""}`}>
          <div className="bg-white border rounded-lg shadow-sm overflow-y-auto w-full" style={{ maxWidth: deviceWidth }}>
            <div className="p-4">
              {/* Route to the right editor based on page type */}
              {renderEditorByType(pageType)}
            </div>
          </div>
        </div>

        {/* AI Co-pilot Panel */}
        {showAI && (
          <div className="w-80 shrink-0">
            <AICoPilot
              pageType={pageType}
              pageName={pageName}
              onApplySuggestion={(suggestion) => {
                // Apply AI suggestion to components
                if (suggestion?.components) {
                  setComponents(prev => [...prev, ...suggestion.components]);
                  setDirty(true);
                }
              }}
              onClose={() => setShowAI(false)}
            />
          </div>
        )}
      </div>
    </div>
  );

  // Editor Router: renders the right editor based on page type
  function renderEditorByType(type: string) {
    switch (type) {
      case "form":
      case "lowcode":
        return <FormOrLowCodeEditor components={components} setComponents={setComponents}
          selectedCompId={selectedCompId} setSelectedCompId={setSelectedCompId} setDirty={setDirty} />;
      case "list":
        return <ListPageEditor components={components} setComponents={setComponents} setDirty={setDirty} />;
      case "dashboard":
      case "report":
        return <ReportEditor components={components} setComponents={setComponents} setDirty={setDirty} />;
      case "workflow":
        return <FlowEditor components={components} setComponents={setComponents} setDirty={setDirty} />;
      case "bi":
        return <BIEditor components={components} setComponents={setComponents} setDirty={setDirty} />;
      default:
        return <FormOrLowCodeEditor components={components} setComponents={setComponents}
          selectedCompId={selectedCompId} setSelectedCompId={setSelectedCompId} setDirty={setDirty} />;
    }
  }
}

// Inline Editor Components (will be extracted to separate files later)

function FormOrLowCodeEditor({ components, setComponents, selectedCompId, setSelectedCompId, setDirty }: any) {
  const COMPONENT_PALETTE = [
    { type: "heading", label: "标题", icon: "H1" },
    { type: "text", label: "文本", icon: "T" },
    { type: "button", label: "按钮", icon: "B" },
    { type: "input", label: "输入框", icon: "I" },
    { type: "image", label: "图片", icon: "IMG" },
    { type: "container", label: "容器", icon: "□" },
    { type: "list", label: "列表", icon: "≡" },
    { type: "table", label: "表格", icon: "⊞" },
    { type: "card", label: "卡片", icon: "▢" },
    { type: "divider", label: "分割线", icon: "—" },
  ];

  const addComponent = (type: string, span = 12) => {
    const meta = COMPONENT_PALETTE.find(c => c.type === type);
    const newComp = { id: `comp-${Date.now()}`, type, label: meta?.label || type, props: {}, span };
    setComponents((prev: any[]) => [...prev, newComp]);
    setSelectedCompId(newComp.id);
    setDirty(true);
  };

  const removeComponent = (id: string) => {
    setComponents((prev: any[]) => prev.filter((c: any) => c.id !== id));
    if (selectedCompId === id) setSelectedCompId(null);
    setDirty(true);
  };

  const updateComponent = (id: string, props: Record<string, any>) => {
    setComponents((prev: any[]) => prev.map((c: any) => c.id === id ? { ...c, props: { ...c.props, ...props } } : c));
    setDirty(true);
  };

  const changeSpan = (id: string, span: number) => {
    setComponents((prev: any[]) => prev.map((c: any) => c.id === id ? { ...c, span } : c));
    setDirty(true);
  };

  const selectedComp = components.find((c: any) => c.id === selectedCompId);

  return (
    <div className="flex gap-3 min-h-[400px]">
      {/* Component Palette */}
      <div className="w-36 shrink-0 border-r pr-3">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">组件库</h4>
        <div className="space-y-1">
          {COMPONENT_PALETTE.map(c => (
            <button key={c.type} onClick={() => addComponent(c.type)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors text-left">
              <span className="text-muted-foreground text-sm">{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mt-4 mb-2">布局宽度</h4>
        <div className="space-y-1">
          {[{ span: 12, label: "全行 (100%)" }, { span: 6, label: "一半 (50%)" }, { span: 4, label: "三分之一 (33%)" }, { span: 3, label: "四分之一 (25%)" }].map(o => (
            <button key={o.span} onClick={() => addComponent("card", o.span)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted border border-transparent hover:border-border transition-colors text-left">
              <div className={`bg-primary/20 rounded h-1.5 ${o.span === 12 ? "w-full" : o.span === 6 ? "w-1/2" : o.span === 4 ? "w-1/3" : "w-1/4"}`} />
              <span className="text-muted-foreground">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <LayoutDashboard className="size-8 mb-2 opacity-20" />
            <p className="text-sm">从左侧添加组件</p>
            <p className="text-xs mt-1">选择宽度后点击组件添加到画布</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-2">
            {components.map((comp: any) => {
              const span = comp.span || 12;
              const colClass = span === 12 ? "col-span-12" : span === 6 ? "col-span-12 sm:col-span-6" : span === 4 ? "col-span-12 sm:col-span-4" : "col-span-12 sm:col-span-3";
              const isSelected = selectedCompId === comp.id;
              return (
                <div key={comp.id} onClick={() => setSelectedCompId(comp.id)}
                  className={`${colClass} relative group p-3 border rounded-lg cursor-pointer transition-all min-h-[60px] ${
                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-dashed border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}>
                  {/* Span controls */}
                  <div className="absolute -top-2.5 right-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <select value={comp.span || 12} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); changeSpan(comp.id, Number(e.target.value)); }}
                      className="text-[10px] bg-background border rounded px-1 py-0.5 cursor-pointer shadow-sm">
                      <option value={12}>全行</option>
                      <option value={6}>1/2</option>
                      <option value={4}>1/3</option>
                      <option value={3}>1/4</option>
                    </select>
                    <button onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
                      className="text-[10px] bg-background border rounded px-1 py-0.5 hover:bg-destructive/20 text-destructive shadow-sm">x</button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{comp.label}</span>
                  <div className="mt-1 text-xs text-muted-foreground/50">
                    {comp.type === "input" && <input placeholder="输入框" className="w-full border rounded px-2 py-1 text-xs" disabled />}
                    {comp.type === "button" && <button className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs">按钮</button>}
                    {comp.type === "table" && <div className="border rounded p-2 text-xs">表格区域</div>}
                    {comp.type === "heading" && <h3 className="font-semibold">{comp.props?.text || "标题"}</h3>}
                    {comp.type === "text" && <p className="text-xs">文本内容</p>}
                    {comp.type === "card" && <div className="bg-muted/50 rounded p-2 text-xs">卡片内容</div>}
                    {comp.type === "image" && <div className="bg-muted h-8 rounded flex items-center justify-center text-xs">图片</div>}
                    {comp.type === "divider" && <hr className="my-1" />}
                    {comp.type === "list" && <div className="text-xs">- 列表项</div>}
                    {comp.type === "container" && <div className="border border-dashed rounded p-2 text-xs text-center">容器</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Properties Panel */}
      <div className="w-48 shrink-0 border-l pl-3">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">属性</h4>
        {selectedComp ? (
          <div className="space-y-3">
            <div className="text-xs font-medium">{selectedComp.label}</div>
            <div>
              <label className="text-[10px] text-muted-foreground">文本</label>
              <input value={selectedComp.props?.text || ""} onChange={(e) => updateComponent(selectedComp.id, { text: e.target.value })}
                className="w-full border rounded px-2 py-1 text-xs mt-0.5" placeholder="输入文本..." />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">占位符</label>
              <input value={selectedComp.props?.placeholder || ""} onChange={(e) => updateComponent(selectedComp.id, { placeholder: e.target.value })}
                className="w-full border rounded px-2 py-1 text-xs mt-0.5" placeholder="输入占位符..." />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground">必填</label>
              <input type="checkbox" checked={selectedComp.props?.required || false}
                onChange={(e) => updateComponent(selectedComp.id, { required: e.target.checked })} className="size-3" />
            </div>
            <button onClick={() => removeComponent(selectedComp.id)}
              className="w-full text-xs py-1 border border-destructive/50 text-destructive rounded hover:bg-destructive/5">
              删除组件
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground py-4 text-center">点击组件查看属性</p>
        )}
      </div>
    </div>
  );
}

// List Page Editor
function ListPageEditor({ components, setComponents, setDirty }: any) {
  const [columns, setColumns] = useState<{ name: string; field: string; width: string; sortable: boolean }[]>(
    components?.length > 0 ? components[0]?.props?.columns || [] : [
      { name: "ID", field: "id", width: "80px", sortable: true },
      { name: "名称", field: "name", width: "auto", sortable: true },
      { name: "状态", field: "status", width: "100px", sortable: false },
      { name: "创建时间", field: "created_at", width: "120px", sortable: true },
    ]
  );
  const [dataSource, setDataSource] = useState(components?.[0]?.props?.dataSource || "");
  const [filterFields, setFilterFields] = useState(components?.[0]?.props?.filters || ["搜索"]);

  const addColumn = () => setColumns(prev => [...prev, { name: "新列", field: "new_field", width: "100px", sortable: false }]);
  const removeColumn = (idx: number) => setColumns(prev => prev.filter((_: any, i: number) => i !== idx));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">列表页面编辑器</h3>

      {/* Data Source */}
      <div className="border rounded-lg p-3">
        <h4 className="text-xs font-medium mb-2">数据源</h4>
        <select value={dataSource} onChange={(e) => setDataSource(e.target.value)}
          className="w-full border rounded px-2 py-1.5 text-sm">
          <option value="">选择数据源...</option>
          <option value="customers">客户对象 (Customer)</option>
          <option value="orders">订单对象 (Order)</option>
          <option value="products">产品对象 (Product)</option>
          <option value="contracts">合同对象 (Contract)</option>
        </select>
      </div>

      {/* Columns */}
      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium">列配置</h4>
          <button onClick={addColumn} className="text-xs text-primary hover:underline">+ 添加列</button>
        </div>
        <div className="space-y-1.5">
          {columns.map((col: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <input value={col.name} onChange={(e) => {
                const newCols = [...columns]; newCols[idx] = { ...col, name: e.target.value }; setColumns(newCols);
              }} className="flex-1 border rounded px-2 py-1" placeholder="列名" />
              <input value={col.field} onChange={(e) => {
                const newCols = [...columns]; newCols[idx] = { ...col, field: e.target.value }; setColumns(newCols);
              }} className="flex-1 border rounded px-2 py-1" placeholder="字段名" />
              <input value={col.width} onChange={(e) => {
                const newCols = [...columns]; newCols[idx] = { ...col, width: e.target.value }; setColumns(newCols);
              }} className="w-20 border rounded px-2 py-1" placeholder="宽度" />
              <label className="flex items-center gap-1 text-[10px]">
                <input type="checkbox" checked={col.sortable} onChange={(e) => {
                  const newCols = [...columns]; newCols[idx] = { ...col, sortable: e.target.checked }; setColumns(newCols);
                }} className="size-3" /> 排序
              </label>
              <button onClick={() => removeColumn(idx)} className="text-destructive hover:underline text-[10px]">删除</button>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border rounded-lg p-3">
        <h4 className="text-xs font-medium mb-2">筛选栏</h4>
        <div className="flex flex-wrap gap-1.5">
          {filterFields.map((f: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-[10px]">{f}</Badge>
          ))}
          <button onClick={() => setFilterFields((prev: string[]) => [...prev, "新筛选条件"])}
            className="text-[10px] text-primary hover:underline">+ 添加</button>
        </div>
      </div>

      {/* Preview */}
      <div className="border rounded-lg p-3">
        <h4 className="text-xs font-medium mb-2">预览</h4>
        <div className="border rounded overflow-hidden text-xs">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>{columns.map((col: any, i: number) => (
                <th key={i} className="px-3 py-2 text-left font-medium">{col.name}</th>
              ))}</tr>
            </thead>
            <tbody>
              <tr className="border-t"><td colSpan={columns.length} className="px-3 py-4 text-center text-muted-foreground">
                数据将从数据源加载
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Report/Dashboard Editor
function ReportEditor({ components, setComponents, setDirty }: any) {
  const [widgets, setWidgets] = useState<{ type: string; title: string; span: number }[]>(
    components?.length > 0 ? components[0]?.props?.widgets || [] : [
      { type: "kpi", title: "KPI 指标卡", span: 3 },
      { type: "kpi", title: "KPI 指标卡", span: 3 },
      { type: "kpi", title: "KPI 指标卡", span: 3 },
      { type: "kpi", title: "KPI 指标卡", span: 3 },
      { type: "bar", title: "柱状图", span: 6 },
      { type: "line", title: "折线图", span: 6 },
      { type: "pie", title: "饼图", span: 4 },
      { type: "table", title: "数据表格", span: 8 },
    ]
  );

  const addWidget = (type: string) => {
    setWidgets(prev => [...prev, { type, title: `${type} 组件`, span: 6 }]);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">报表/仪表盘编辑器</h3>

      {/* Widget palette */}
      <div className="border rounded-lg p-3">
        <h4 className="text-xs font-medium mb-2">组件库</h4>
        <div className="flex flex-wrap gap-1.5">
          {[{ type: "kpi", label: "KPI 指标卡" }, { type: "bar", label: "柱状图" }, { type: "line", label: "折线图" },
            { type: "pie", label: "饼图" }, { type: "area", label: "面积图" }, { type: "table", label: "数据表格" },
            { type: "gauge", label: "仪表盘" }, { type: "funnel", label: "漏斗图" }].map(w => (
            <button key={w.type} onClick={() => addWidget(w.type)}
              className="px-2 py-1 text-xs border rounded hover:bg-primary/5 hover:border-primary/30 transition-colors">
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Widget grid preview */}
      <div className="border rounded-lg p-3">
        <h4 className="text-xs font-medium mb-2">画布预览</h4>
        <div className="grid grid-cols-12 gap-2">
          {widgets.map((w, i) => {
            const colClass = w.span === 12 ? "col-span-12" : w.span === 8 ? "col-span-12 sm:col-span-8" : w.span === 6 ? "col-span-12 sm:col-span-6" : w.span === 4 ? "col-span-12 sm:col-span-4" : "col-span-12 sm:col-span-3";
            return (
              <div key={i} className={`${colClass} border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground`}>
                <div className="mb-1 font-medium text-foreground">{w.title}</div>
                <div className="h-20 bg-muted/50 rounded flex items-center justify-center">
                  {w.type === "kpi" && <span className="text-2xl font-bold text-primary">--</span>}
                  {w.type === "bar" && <span>Bar Chart</span>}
                  {w.type === "line" && <span>Line Chart</span>}
                  {w.type === "pie" && <span>Pie Chart</span>}
                  {w.type === "table" && <span>Data Table</span>}
                  {!["kpi", "bar", "line", "pie", "table"].includes(w.type) && <span>{w.type}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Flow Editor (inline, NOT redirect to process center)
function FlowEditor({ components, setComponents, setDirty }: any) {
  const [nodes, setNodes] = useState<{ id: string; type: string; label: string; x: number; y: number }[]>(
    components?.[0]?.props?.nodes || [
      { id: "start", type: "start", label: "开始", x: 50, y: 200 },
      { id: "task1", type: "task", label: "提交申请", x: 200, y: 200 },
      { id: "gateway", type: "gateway", label: "审批判断", x: 350, y: 200 },
      { id: "approve", type: "task", label: "审批通过", x: 500, y: 120 },
      { id: "reject", type: "task", label: "审批驳回", x: 500, y: 280 },
      { id: "end", type: "end", label: "结束", x: 650, y: 200 },
    ]
  );

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const NODE_COLORS: Record<string, string> = {
    start: "bg-green-100 border-green-400 text-green-700",
    task: "bg-blue-100 border-blue-400 text-blue-700",
    gateway: "bg-amber-100 border-amber-400 text-amber-700",
    end: "bg-red-100 border-red-400 text-red-700",
  };

  const addNode = (type: string) => {
    const labels: Record<string, string> = { start: "开始", task: "新任务", gateway: "网关", end: "结束" };
    setNodes(prev => [...prev, { id: `node-${Date.now()}`, type, label: labels[type] || "节点", x: 100 + prev.length * 120, y: 200 }]);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">流程编辑器</h3>

      {/* Node palette */}
      <div className="flex gap-2">
        {[
          { type: "start", label: "开始节点" },
          { type: "task", label: "任务节点" },
          { type: "gateway", label: "网关" },
          { type: "end", label: "结束节点" },
        ].map(n => (
          <button key={n.type} onClick={() => addNode(n.type)}
            className={`px-3 py-1.5 text-xs border rounded-lg hover:opacity-80 transition ${NODE_COLORS[n.type]}`}>
            {n.label}
          </button>
        ))}
      </div>

      {/* Flow canvas */}
      <div className="border rounded-lg bg-white p-4 overflow-auto" style={{ minHeight: "300px" }}>
        <svg width="800" height="400" className="w-full">
          {/* Connection lines */}
          {nodes.map((node, i) => {
            const next = nodes[i + 1];
            if (!next) return null;
            return (
              <line key={`line-${i}`} x1={node.x + 60} y1={node.y + 20} x2={next.x} y2={next.y + 20}
                stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />
            );
          })}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="#94a3b8" />
            </marker>
          </defs>
          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id} onClick={() => setSelectedNode(node.id)}
              className={`cursor-pointer ${selectedNode === node.id ? "opacity-100" : "opacity-90 hover:opacity-100"}`}>
              {node.type === "gateway" ? (
                <rect x={node.x} y={node.y} width="120" height="40" rx="4"
                  className={NODE_COLORS[node.type]} fill="currentColor" fillOpacity={0.1}
                  stroke="currentColor" strokeWidth={2} />
              ) : (
                <rect x={node.x} y={node.y} width="120" height="40" rx={node.type === "start" || node.type === "end" ? 20 : 6}
                  className={NODE_COLORS[node.type]} fill="currentColor" fillOpacity={0.1}
                  stroke="currentColor" strokeWidth={2} />
              )}
              <text x={node.x + 60} y={node.y + 25} textAnchor="middle" className="text-xs fill-current">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Node properties */}
      {selectedNode && (
        <div className="border rounded-lg p-3">
          <h4 className="text-xs font-medium mb-2">节点属性</h4>
          {(() => {
            const node = nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            return (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">节点名称</label>
                  <input value={node.label} onChange={(e) => {
                    setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, label: e.target.value } : n));
                  }} className="w-full border rounded px-2 py-1 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">节点类型</label>
                  <select value={node.type} disabled className="w-full border rounded px-2 py-1 text-xs mt-0.5 bg-muted">
                    <option value="start">开始</option>
                    <option value="task">任务</option>
                    <option value="gateway">网关</option>
                    <option value="end">结束</option>
                  </select>
                </div>
                <button onClick={() => { setNodes(prev => prev.filter(n => n.id !== selectedNode)); setSelectedNode(null); }}
                  className="text-xs text-destructive hover:underline">删除节点</button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// BI Editor
function BIEditor({ components, setComponents, setDirty }: any) {
  const [agents, setAgents] = useState<{ name: string; model: string; status: string }[]>(
    components?.[0]?.props?.agents || [
      { name: "销售助手", model: "GPT-4", status: "active" },
      { name: "客服机器人", model: "GPT-3.5", status: "draft" },
    ]
  );
  const [tasks, setTasks] = useState<{ name: string; schedule: string; status: string }[]>(
    components?.[0]?.props?.tasks || [
      { name: "每日销售报表", schedule: "每天 08:00", status: "active" },
      { name: "周度客户分析", schedule: "每周一 09:00", status: "active" },
    ]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">商业智能编辑器</h3>

      {/* Agent Builder */}
      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium">数字员工 / Agent</h4>
          <button onClick={() => setAgents(prev => [...prev, { name: "新 Agent", model: "GPT-3.5", status: "draft" }])}
            className="text-xs text-primary hover:underline">+ 创建</button>
        </div>
        <div className="space-y-1.5">
          {agents.map((agent, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 border rounded text-xs">
              <div className="flex items-center gap-2">
                <Bot className="size-3.5" />
                <span className="font-medium">{agent.name}</span>
                <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-[10px] py-0">
                  {agent.status === "active" ? "运行中" : "草稿"}
                </Badge>
              </div>
              <span className="text-muted-foreground">{agent.model}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Training Tasks */}
      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium">定期训练任务</h4>
          <button onClick={() => setTasks(prev => [...prev, { name: "新任务", schedule: "每天 00:00", status: "draft" }])}
            className="text-xs text-primary hover:underline">+ 创建</button>
        </div>
        <div className="space-y-1.5">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 border rounded text-xs">
              <div className="flex items-center gap-2">
                <Clock className="size-3.5" />
                <span className="font-medium">{task.name}</span>
              </div>
              <span className="text-muted-foreground">{task.schedule}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
