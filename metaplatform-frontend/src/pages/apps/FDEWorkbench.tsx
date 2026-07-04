import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CodeEditor } from "@/components/CodeEditor";
import {
  Eye, Code, Wand2, RefreshCw, Rocket, Save, Play, Layers, Database,
  Package, Layout, Type, Image as ImageIcon, Square, Table as TableIcon,
  BarChart3, GitBranch, ChevronRight, ChevronDown, Sparkles, Loader2,
  Monitor, Smartphone, Tablet, X, Plus, Trash2, GripVertical, Settings,
} from "lucide-react";

/* ── Types ── */
interface ComponentNode {
  id: string;
  type: string;
  label: string;
  props: Record<string, string>;
  children?: ComponentNode[];
}

interface DataModelField {
  name: string;
  type: string;
  required: boolean;
}

interface DataModelObject {
  name: string;
  fields: DataModelField[];
  expanded?: boolean;
}

/* ── Mock data models (ontology objects) ── */
const DATA_MODELS: DataModelObject[] = [
  {
    name: "客户 (Customer)",
    expanded: true,
    fields: [
      { name: "id", type: "UUID", required: true },
      { name: "name", type: "String", required: true },
      { name: "email", type: "String", required: false },
      { name: "phone", type: "String", required: false },
      { name: "company", type: "String", required: false },
      { name: "level", type: "Enum", required: false },
      { name: "created_at", type: "DateTime", required: true },
    ],
  },
  {
    name: "订单 (Order)",
    fields: [
      { name: "id", type: "UUID", required: true },
      { name: "customer_id", type: "UUID", required: true },
      { name: "amount", type: "Decimal", required: true },
      { name: "status", type: "Enum", required: true },
      { name: "items", type: "JSON", required: false },
      { name: "created_at", type: "DateTime", required: true },
    ],
  },
  {
    name: "产品 (Product)",
    fields: [
      { name: "id", type: "UUID", required: true },
      { name: "name", type: "String", required: true },
      { name: "price", type: "Decimal", required: true },
      { name: "category", type: "String", required: false },
      { name: "stock", type: "Int", required: false },
    ],
  },
];

/* ── Component Library ── */
const COMPONENT_LIBRARY = [
  {
    category: "基础组件",
    items: [
      { type: "Text", label: "文本", icon: Type },
      { type: "Button", label: "按钮", icon: Square },
      { type: "Image", label: "图片", icon: ImageIcon },
      { type: "Divider", label: "分割线", icon: Package },
    ],
  },
  {
    category: "数据组件",
    items: [
      { type: "Table", label: "数据表格", icon: TableIcon },
      { type: "Form", label: "表单", icon: Layout },
      { type: "Chart", label: "图表", icon: BarChart3 },
      { type: "Statistic", label: "统计卡片", icon: Package },
    ],
  },
  {
    category: "布局组件",
    items: [
      { type: "Container", label: "容器", icon: Layout },
      { type: "Grid", label: "栅格", icon: Package },
      { type: "Tabs", label: "标签页", icon: Package },
      { type: "Card", label: "卡片", icon: Package },
    ],
  },
];

/* ── Default generated code ── */
const DEFAULT_CODE = `import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export default function CustomerDashboard() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch customers from ontology API
    fetch("/api/ontology/customer")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">客户管理仪表盘</h1>
        <Button>+ 新建客户</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{customers.length}</div>
            <div className="text-xs text-muted-foreground">客户总数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">86%</div>
            <div className="text-xs text-muted-foreground">活跃率</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">¥2.4M</div>
            <div className="text-xs text-muted-foreground">本月营收</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">156</div>
            <div className="text-xs text-muted-foreground">新增客户</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>客户列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户名称</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>等级</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">加载中...</TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">暂无客户数据</TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell><Badge>{c.level}</Badge></TableCell>
                    <TableCell>活跃</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}`;

/* ── Visual preview component ── */
function VisualPreview({ components, device }: { components: ComponentNode[]; device: string }) {
  const widthClass = device === "mobile" ? "max-w-[375px]" : device === "tablet" ? "max-w-[768px]" : "w-full";

  return (
    <div className={`mx-auto ${widthClass} bg-white rounded-lg shadow-sm border min-h-[500px] p-4`}>
      {components.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Layout className="size-12 mb-3 opacity-40" />
          <p className="text-sm">可视化编辑器</p>
          <p className="text-xs mt-1">从组件库拖拽组件或使用 AI 生成</p>
        </div>
      ) : (
        <div className="space-y-3">
          {components.map((comp) => (
            <VisualComponent key={comp.id} comp={comp} />
          ))}
        </div>
      )}
    </div>
  );
}

function VisualComponent({ comp }: { comp: ComponentNode }) {
  switch (comp.type) {
    case "Text":
      return <p className="text-sm">{comp.props.content || "文本组件"}</p>;
    case "Button":
      return <Button size="sm">{comp.props.text || "按钮"}</Button>;
    case "Table":
      return (
        <div className="border rounded overflow-auto text-xs">
          <table className="w-full">
            <thead className="bg-muted"><tr><th className="px-2 py-1">列 1</th><th className="px-2 py-1">列 2</th><th className="px-2 py-1">列 3</th></tr></thead>
            <tbody>
              <tr className="border-t"><td className="px-2 py-1">数据</td><td className="px-2 py-1">数据</td><td className="px-2 py-1">数据</td></tr>
              <tr className="border-t"><td className="px-2 py-1">数据</td><td className="px-2 py-1">数据</td><td className="px-2 py-1">数据</td></tr>
            </tbody>
          </table>
        </div>
      );
    case "Card":
      return (
        <div className="border rounded-lg p-4">
          <div className="font-medium text-sm mb-2">{comp.props.title || "卡片标题"}</div>
          <div className="text-xs text-muted-foreground">卡片内容区域</div>
        </div>
      );
    case "Chart":
      return (
        <div className="bg-gray-50 rounded flex items-center justify-center h-32">
          <BarChart3 className="size-8 text-gray-400" />
          <span className="text-xs text-gray-500 ml-2">图表组件</span>
        </div>
      );
    default:
      return (
        <div className="border border-dashed rounded p-3 text-xs text-muted-foreground">
          [{comp.type}] {comp.label}
        </div>
      );
  }
}

/* ── AI Generation Dialog ── */
function AIGeneratePanel({ onGenerate, onClose }: { onGenerate: (code: string, comps: ComponentNode[]) => void; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      const newCode = `// AI 生成: ${prompt}
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AIGeneratedPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">${prompt}</h1>
      <Card>
        <CardHeader><CardTitle>AI 生成的内容</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">基于提示词「${prompt}」自动生成的页面组件</p>
          <Button className="mt-4">操作按钮</Button>
        </CardContent>
      </Card>
    </div>
  );
}`;
      const newComps: ComponentNode[] = [
        { id: `ai-${Date.now()}-1`, type: "Text", label: "标题", props: { content: prompt } },
        { id: `ai-${Date.now()}-2`, type: "Card", label: "卡片", props: { title: "AI 生成内容" } },
        { id: `ai-${Date.now()}-3`, type: "Button", label: "操作", props: { text: "操作按钮" } },
      ];
      onGenerate(newCode, newComps);
      setGenerating(false);
      onClose();
    }, 2000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <Card className="w-[500px] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI 生成
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">描述你想要的页面</label>
            <textarea
              className="w-full border rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="例如：创建一个客户管理仪表盘，包含客户列表、统计卡片和图表..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">快速模板</label>
            <div className="flex flex-wrap gap-2">
              {["客户管理看板", "销售数据报表", "项目任务面板", "库存监控仪表盘"].map((t) => (
                <button key={t} onClick={() => setPrompt(t)} className="text-xs border rounded-full px-3 py-1 hover:border-primary transition-colors">{t}</button>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={handleGenerate} disabled={!prompt.trim() || generating}>
            {generating ? <><Loader2 className="size-4 mr-2 animate-spin" />生成中...</> : <><Wand2 className="size-4 mr-2" />生成页面</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main FDE Workbench ── */
export default function FDEWorkbench() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

  const [code, setCode] = useState(DEFAULT_CODE);
  const [visualComponents, setVisualComponents] = useState<ComponentNode[]>([
    { id: "vc1", type: "Text", label: "标题", props: { content: "客户管理仪表盘" } },
    { id: "vc2", type: "Card", label: "统计卡片", props: { title: "客户总数" } },
    { id: "vc3", type: "Table", label: "数据表格", props: { data: "customer" } },
    { id: "vc4", type: "Chart", label: "图表", props: { type: "bar" } },
  ]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showComponents, setShowComponents] = useState(true);
  const [showDataModels, setShowDataModels] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /* Toast auto-clear */
  if (toast) {
    setTimeout(() => setToast(null), 2500);
  }

  /* Sync visual to code */
  const handleSync = useCallback(() => {
    setSyncing(true);
    setTimeout(() => {
      const generatedCode = `// 从可视化编辑器同步生成
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function GeneratedPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
${visualComponents.map((c) => `      {/* ${c.label} */}`).join("\n")}
    </div>
  );
}`;
      setCode(generatedCode);
      setSyncing(false);
      setToast("已同步可视化到代码");
    }, 1000);
  }, [visualComponents]);

  /* Handle AI generation */
  const handleAIGenerate = useCallback((newCode: string, newComps: ComponentNode[]) => {
    setCode(newCode);
    setVisualComponents(newComps);
    setToast("AI 已生成页面");
  }, []);

  /* Deploy */
  const handleDeploy = useCallback(() => {
    setDeploying(true);
    setTimeout(() => {
      setDeploying(false);
      setToast("部署成功！页面已上线");
    }, 3000);
  }, []);

  /* Add component from library */
  function addComponent(type: string, label: string) {
    const newComp: ComponentNode = {
      id: `comp-${Date.now()}`,
      type,
      label,
      props: {},
    };
    setVisualComponents((prev) => [...prev, newComp]);
    setSelectedComp(newComp.id);
    setToast(`已添加 ${label}`);
  }

  /* Remove component */
  function removeComponent(id: string) {
    setVisualComponents((prev) => prev.filter((c) => c.id !== id));
    if (selectedComp === id) setSelectedComponent(null);
  }

  function setSelectedComponent(id: string | null) {
    setSelectedComp(id);
  }

  return (
    <div className="flex flex-col h-full">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/apps/${appId}/overview`)}>
            <ChevronRight className="size-3 rotate-180 mr-1" /> 返回
          </Button>
          <div className="h-4 w-px bg-border" />
          <Code className="size-4 text-primary" />
          <span className="font-medium text-sm">FDE 工作台</span>
          <Badge variant="secondary">App: {appId}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Device preview toggle */}
          <div className="flex items-center rounded-md border overflow-hidden">
            <Button variant={device === "desktop" ? "default" : "ghost"} size="sm" className="rounded-none px-2" onClick={() => setDevice("desktop")}>
              <Monitor className="size-3.5" />
            </Button>
            <Button variant={device === "tablet" ? "default" : "ghost"} size="sm" className="rounded-none px-2" onClick={() => setDevice("tablet")}>
              <Tablet className="size-3.5" />
            </Button>
            <Button variant={device === "mobile" ? "default" : "ghost"} size="sm" className="rounded-none px-2" onClick={() => setDevice("mobile")}>
              <Smartphone className="size-3.5" />
            </Button>
          </div>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={() => setShowAIPanel(true)}>
            <Sparkles className="size-3 mr-1" /> AI 生成
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-3 mr-1 animate-spin" /> : <RefreshCw className="size-3 mr-1" />}
            同步
          </Button>
          <Button variant="outline" size="sm" onClick={() => setToast("已保存")}>
            <Save className="size-3 mr-1" /> 保存
          </Button>
          <Button size="sm" onClick={handleDeploy} disabled={deploying}>
            {deploying ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Rocket className="size-3 mr-1" />}
            一键部署
          </Button>
        </div>
      </div>

      {/* Main content: split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Component Library + Data Models */}
        <div className="w-56 border-r bg-muted/30 overflow-y-auto shrink-0 flex flex-col">
          {/* Toggle panels */}
          <div className="border-b">
            <button
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-muted/50"
              onClick={() => setShowComponents(!showComponents)}
            >
              <span className="flex items-center gap-2">
                <Layers className="size-3.5" /> 组件库
              </span>
              {showComponents ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
            {showComponents && (
              <div className="px-3 pb-2 space-y-3">
                {COMPONENT_LIBRARY.map((cat) => (
                  <div key={cat.category}>
                    <div className="text-xs text-muted-foreground mb-1">{cat.category}</div>
                    <div className="grid grid-cols-2 gap-1">
                      {cat.items.map((item) => (
                        <button
                          key={item.type}
                          onClick={() => addComponent(item.type, item.label)}
                          className="flex flex-col items-center gap-1 p-2 rounded border border-transparent hover:border-border hover:bg-background text-xs transition-colors"
                        >
                          <item.icon className="size-4 text-muted-foreground" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data Models panel */}
          <div className="border-b">
            <button
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-muted/50"
              onClick={() => setShowDataModels(!showDataModels)}
            >
              <span className="flex items-center gap-2">
                <Database className="size-3.5" /> 数据模型
              </span>
              {showDataModels ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
            {showDataModels && (
              <div className="px-3 pb-2 space-y-2">
                {DATA_MODELS.map((model) => (
                  <div key={model.name} className="border rounded text-xs">
                    <div className="flex items-center gap-1 px-2 py-1.5 font-medium bg-muted/50">
                      <Database className="size-3 text-primary" />
                      {model.name}
                    </div>
                    <div className="px-2 pb-1">
                      {model.fields.map((f) => (
                        <div key={f.name} className="flex items-center justify-between py-0.5">
                          <span className="font-mono text-muted-foreground">{f.name}</span>
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{f.type}</Badge>
                            {f.required && <span className="text-red-500 text-[10px]">*</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Canvas components tree */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">画布组件</div>
            {visualComponents.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">暂无组件</div>
            ) : (
              <div className="space-y-1">
                {visualComponents.map((comp) => (
                  <div
                    key={comp.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer group transition-colors ${
                      selectedComp === comp.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedComponent(comp.id)}
                  >
                    <GripVertical className="size-3 text-muted-foreground" />
                    <span className="flex-1 truncate">{comp.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{comp.type}</Badge>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Visual Editor */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <VisualPreview components={visualComponents} device={device} />
        </div>

        {/* Right: Code Editor */}
        <div className="flex-1 border-l flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Code className="size-3.5" />
              <span className="text-xs font-medium">代码编辑器</span>
              <Badge variant="outline" className="text-xs">TypeScript</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { navigator.clipboard?.writeText(code); setToast("代码已复制"); }}>
                复制
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleSync}>
                <RefreshCw className="size-3 mr-1" /> 同步
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              language="typescript"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </div>

      {/* AI Generate Panel */}
      {showAIPanel && (
        <AIGeneratePanel
          onGenerate={handleAIGenerate}
          onClose={() => setShowAIPanel(false)}
        />
      )}
    </div>
  );
}
