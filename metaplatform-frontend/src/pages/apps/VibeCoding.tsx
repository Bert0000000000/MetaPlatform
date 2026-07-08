import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeEditor } from "@/components/CodeEditor";
import { Sparkles, Send, Code2, Play, Save, Download, Folder, File, Terminal, GitBranch, Check, X, Loader2, Bot, Copy, Plus, Maximize2, Minimize2, Layout, Table, BarChart3, FormInput, List, Navigation, ToggleLeft, Sliders } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; ts: string }

const INITIAL: Msg[] = [
  { role: "assistant", content: "我是 VibeCoding\n用自然语言描述你想要的页面/应用，我来帮你生成。\n\n例如：\n- 「做一个销售看板，按地区分组，显示本月销售额、订单数、客户数」\n- 「客户管理表单，包含姓名、电话、行业、备注」", ts: "12:30" },
];

/* ── Generated file structure ── */
interface GeneratedFile {
  name: string;
  language: string;
  content: string;
  status: "created" | "modified";
}

const SAMPLE_FILES: GeneratedFile[] = [
  {
    name: "src/pages/SalesDashboard.tsx",
    language: "typescript",
    status: "created",
    content: `import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function SalesDashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/sales/summary')
      .then(r => r.json())
      .then(setData);
  }, []);

  return (
    <div className="p-6 w-full grid grid-cols-3 gap-4">
      <Card>
        <CardHeader><CardTitle>本月销售额</CardTitle></CardHeader>
        <CardContent>
          <div className="text-xl font-bold">¥12,486,329</div>
          <span className="text-green-600 text-sm">+18.2% ↑</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>订单数</CardTitle></CardHeader>
        <CardContent>
          <div className="text-xl font-bold">3,842</div>
          <span className="text-green-600 text-sm">+12.5% ↑</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>客户数</CardTitle></CardHeader>
        <CardContent>
          <div className="text-xl font-bold">1,256</div>
          <span className="text-green-600 text-sm">+8.3% ↑</span>
        </CardContent>
      </Card>
      <Card className="col-span-3">
        <CardHeader><CardTitle>销售趋势</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <Bar dataKey="amount" fill="#3b82f6" />
              <XAxis dataKey="region" />
              <YAxis />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}`,
  },
  {
    name: "src/components/SalesChart.tsx",
    language: "typescript",
    status: "created",
    content: `import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesChartProps {
  data: { region: string; amount: number }[];
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="region" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}`,
  },
  {
    name: "src/api/sales.ts",
    language: "typescript",
    status: "created",
    content: `import axios from 'axios';

export interface SalesSummary {
  region: string;
  amount: number;
  orders: number;
  customers: number;
}

export async function fetchSalesSummary(): Promise<SalesSummary[]> {
  const { data } = await axios.get('/api/sales/summary');
  return data;
}

export async function fetchSalesDetail(region: string) {
  const { data } = await axios.get(\`/api/sales/detail/\${region}\`);
  return data;
}`,
  },
  {
    name: "src/hooks/useSalesData.ts",
    language: "typescript",
    status: "created",
    content: `import { useState, useEffect } from 'react';
import { fetchSalesSummary, SalesSummary } from '../api/sales';

export function useSalesData() {
  const [data, setData] = useState<SalesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalesSummary()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error, refetch: () => {
    setLoading(true);
    fetchSalesSummary().then(setData).finally(() => setLoading(false));
  }};
}`,
  },
  {
    name: "package.json",
    language: "json",
    status: "modified",
    content: `{
  "name": "sales-dashboard",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.15.0",
    "axios": "^1.7.9"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}`,
  },
];

/* ── Preview HTML template ── */
function generatePreviewHTML(files: GeneratedFile[]): string {
  const dashboardFile = files.find(f => f.name.includes("SalesDashboard"));
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sales Dashboard Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 0; background: #f9fafb; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .stat-value { font-size: 1.5rem; font-weight: 700; }
    .trend-up { color: #16a34a; font-size: 0.875rem; }
    .bar { background: #3b82f6; border-radius: 2px 2px 0 0; transition: height 0.3s; }
    .bar:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div style="padding: 24px; max-width: 900px; margin: 0 auto;">
    <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 20px;">Sales Dashboard</h1>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
      <div class="card" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; border: none;">
        <div style="opacity: 0.8; font-size: 0.875rem;">本月销售额</div>
        <div style="font-size: 1.5rem; font-weight: 700; margin: 4px 0;">¥12,486,329</div>
        <div style="opacity: 0.8; font-size: 0.875rem;">+18.2% ↑</div>
      </div>
      <div class="card">
        <div style="color: #6b7280; font-size: 0.875rem;">订单数</div>
        <div class="stat-value">3,842</div>
        <div class="trend-up">+12.5% ↑</div>
      </div>
      <div class="card">
        <div style="color: #6b7280; font-size: 0.875rem;">客户数</div>
        <div class="stat-value">1,256</div>
        <div class="trend-up">+8.3% ↑</div>
      </div>
    </div>
    <div class="card" style="margin-bottom: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px;">销售趋势</h3>
      <div style="display: flex; align-items: flex-end; gap: 6px; height: 160px; padding: 0 8px;">
        ${[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 88].map((v, i) =>
          `<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div class="bar" style="width: 100%; height: ${v}%;"></div>
            <span style="font-size: 0.625rem; color: #9ca3af;">${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</span>
          </div>`
        ).join('\n        ')}
      </div>
    </div>
    <div class="card">
      <h3 style="font-weight: 600; margin-bottom: 12px;">各地区销售</h3>
      <div style="space-y: 8px;">
        ${[
          { region: "华东", percent: 95, amount: "¥4,256,780" },
          { region: "华北", percent: 82, amount: "¥3,128,450" },
          { region: "华南", percent: 76, amount: "¥2,845,320" },
          { region: "西部", percent: 58, amount: "¥1,652,180" },
          { region: "中部", percent: 45, amount: "¥603,599" },
        ].map(r => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 6px 0;">
            <span style="width: 40px; font-size: 0.875rem;">${r.region}</span>
            <div style="flex: 1; background: #f3f4f6; border-radius: 4px; height: 8px; overflow: hidden;">
              <div style="width: ${r.percent}%; background: #3b82f6; height: 100%; border-radius: 4px;"></div>
            </div>
            <span style="font-size: 0.75rem; color: #6b7280; width: 80px; text-align: right;">${r.amount}</span>
            <span style="font-size: 0.75rem; font-family: monospace; width: 36px;">${r.percent}%</span>
          </div>`
        ).join('')}
      </div>
    </div>
  </div>
</body>
</html>`;
}

const PREVIEW_LOG = [
  { time: "12:48:32", msg: "✅ 编译成功，5 个文件生成" },
  { time: "12:48:35", msg: "✅ 安装依赖完成 (4 packages)" },
  { time: "12:48:42", msg: "✅ 本地预览启动 http://localhost:3000" },
  { time: "12:48:50", msg: "✅ 渲染完成，0 错误" },
];

const COMPONENT_LIBRARY = [
  { category: "布局", items: [
    { name: "Card", icon: Layout, snippet: "<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent>Content</CardContent></Card>" },
    { name: "Grid", icon: Layout, snippet: "<div className='grid grid-cols-3 gap-4'>...</div>" },
    { name: "Flex", icon: Layout, snippet: "<div className='flex items-center gap-4'>...</div>" },
  ]},
  { category: "数据展示", items: [
    { name: "Table", icon: Table, snippet: "<Table><TableHeader>...</TableHeader><TableBody>...</TableBody></Table>" },
    { name: "Chart", icon: BarChart3, snippet: "<BarChart data={data}><Bar dataKey='amount' /></BarChart>" },
    { name: "List", icon: List, snippet: "<ul className='space-y-2'>{items.map(i => <li key={i}>{i}</li>)}</ul>" },
  ]},
  { category: "表单", items: [
    { name: "Input", icon: FormInput, snippet: "<Input placeholder='请输入' />" },
    { name: "Select", icon: List, snippet: "<Select><SelectTrigger><SelectValue /></SelectTrigger></Select>" },
    { name: "Switch", icon: ToggleLeft, snippet: "<Switch checked={val} onCheckedChange={setVal} />" },
    { name: "Slider", icon: Sliders, snippet: "<Slider min={0} max={100} value={[50]} />" },
  ]},
  { category: "导航", items: [
    { name: "Tabs", icon: Navigation, snippet: "<Tabs><TabsList><TabsTrigger>Tab</TabsTrigger></TabsList></Tabs>" },
    { name: "Button", icon: FormInput, snippet: "<Button>Click</Button>" },
  ]},
];

export default function VibeCoding() {
  const [msgs, setMsgs] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [activeFileTab, setActiveFileTab] = useState<string>("");
  const [generated, setGenerated] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [showCode, setShowCode] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function send() {
    const text = input.trim();
    if (!text) return;
    setGenerating(true);
    setMsgs((m) => [...m, { role: "user", content: text, ts: "现在" }]);
    setInput("");
    setTimeout(() => {
      setFiles(SAMPLE_FILES);
      setActiveFileTab(SAMPLE_FILES[0].name);
      setGenerated(true);
      setPreviewSrc(generatePreviewHTML(SAMPLE_FILES));
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `好的，我已为你生成代码！\n\n生成了 ${SAMPLE_FILES.length} 个文件：\n${SAMPLE_FILES.map((f) => `  - ${f.name} (${f.content.split('\n').length} 行)`).join("\n")}\n\n总计 ${SAMPLE_FILES.reduce((a, f) => a + f.content.split('\n').length, 0)} 行代码 | 耗时 18 秒\n\n你可以：\n- 右侧预览面板查看运行效果\n- 点击「运行预览」刷新视图\n- 点击「复制代码」或「下载」获取代码`,
          ts: "现在",
        },
      ]);
      setGenerating(false);
    }, 1500);
  }

  function handleRunPreview() {
    if (files.length > 0) {
      setPreviewSrc(generatePreviewHTML(files));
    }
  }

  function handleCopyCode() {
    const activeFile = files.find((f) => f.name === activeFileTab);
    if (activeFile) {
      navigator.clipboard.writeText(activeFile.content).then(() => {
        alert(`已复制 ${activeFile.name} 到剪贴板`);
      });
    }
  }

  function handleCopyAll() {
    const all = files.map((f) => `// ${f.name}\n${f.content}`).join('\n\n');
    navigator.clipboard.writeText(all).then(() => {
      alert("已复制全部代码到剪贴板");
    });
  }

  function handleDownload() {
    const all = files.map((f) => `// ========== ${f.name} ==========\n${f.content}`).join('\n\n\n');
    const blob = new Blob([all], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vibe-coding-output.tsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleUpdateFileContent(name: string, content: string) {
    setFiles((prev) => prev.map((f) => f.name === name ? { ...f, content, status: "modified" } : f));
  }

  const activeFile = files.find((f) => f.name === activeFileTab);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-200px)]">
      <PageHeader
        title="VibeCoding AI 编程"
        description="自然语言 → 完整应用（生成式开发）"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Folder className="size-3 mr-1" />
              历史项目
            </Button>
            <Button size="sm">
              <Sparkles className="size-3 mr-1" />
              新建项目
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 左侧：对话 */}
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="size-4 text-primary" /> AI 对话
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Bot className="size-3" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg p-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="text-xs whitespace-pre-wrap">{m.content}</div>
                  <div className={`text-[10px] mt-1 ${m.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{m.ts}</div>
                </div>
              </div>
            ))}
            {generating && (
              <div className="flex gap-2">
                <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot className="size-3" />
                </div>
                <div className="bg-muted rounded-lg p-2 text-xs flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" /> AI 正在生成代码...
                </div>
              </div>
            )}
          </CardContent>
          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="描述你想要的页面或应用..."
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <Button onClick={send} disabled={generating} size="icon"><Send className="size-3" /></Button>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {["销售看板", "客户管理", "订单管理", "数据图表"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="text-[10px] border rounded-full px-2 py-0.5 hover:border-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* 中间：代码 + 文件 */}
        <Card className="col-span-5 flex flex-col">
          <Tabs defaultValue="files" className="flex flex-col flex-1">
            <CardHeader className="border-b pb-2">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="files"><Folder className="size-3 mr-1" /> 文件</TabsTrigger>
                  <TabsTrigger value="code"><Code2 className="size-3 mr-1" /> 代码</TabsTrigger>
                  <TabsTrigger value="components"><Layout className="size-3 mr-1" /> 组件库</TabsTrigger>
                  <TabsTrigger value="terminal"><Terminal className="size-3 mr-1" /> 终端</TabsTrigger>
                  <TabsTrigger value="git"><GitBranch className="size-3 mr-1" /> Git</TabsTrigger>
                </TabsList>
                {generated && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopyAll}>
                      <Copy className="size-3 mr-1" /> 复制全部
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDownload}>
                      <Download className="size-3 mr-1" /> 下载
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <TabsContent value="files" className="m-0 h-full overflow-y-auto p-3">
                {generated ? (
                  <div className="space-y-1">
                    {files.map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center gap-2 p-2 hover:bg-muted rounded text-xs cursor-pointer"
                        onClick={() => setActiveFileTab(f.name)}
                      >
                        <File className="size-3" />
                        <span className="flex-1 font-mono">{f.name}</span>
                        <Badge variant={f.status === "created" ? "default" : "outline"} className="text-[10px]">
                          {f.status === "created" ? <Plus className="size-2" /> : <Code2 className="size-2" />}
                          <span className="ml-0.5">{f.status === "created" ? "新建" : "修改"}</span>
                        </Badge>
                        <span className="text-muted-foreground">{f.content.split('\n').length} 行</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    等待 AI 生成文件...
                  </div>
                )}
              </TabsContent>
              <TabsContent value="code" className="m-0 h-full flex flex-col">
                {generated && files.length > 0 ? (
                  <>
                    {/* File tabs */}
                    <div className="flex border-b bg-muted/30 overflow-x-auto shrink-0">
                      {files.map((f) => (
                        <button
                          key={f.name}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r shrink-0 ${
                            f.name === activeFileTab ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent"
                          }`}
                          onClick={() => setActiveFileTab(f.name)}
                        >
                          <File className="size-3" />
                          {f.name.split('/').pop()}
                          {f.status === "modified" && <span className="size-1.5 rounded-full bg-orange-500" />}
                        </button>
                      ))}
                    </div>
                    {/* Code editor */}
                    <div className="flex-1 min-h-0">
                      {activeFile && (
                        <CodeEditor
                          language={activeFile.language}
                          value={activeFile.content}
                          onChange={(v) => handleUpdateFileContent(activeFile.name, v)}
                          height="100%"
                          theme="dark"
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <pre className="text-xs bg-slate-950 text-slate-50 p-4 font-mono h-full overflow-auto">
                    {`// 等待 AI 生成代码...
// 输入你的需求开始生成`}
                  </pre>
                )}
              </TabsContent>
              {/* F4.4.6.4 组件库面板 */}
              <TabsContent value="components" className="m-0 h-full overflow-y-auto p-3">
                <div className="space-y-4">
                  {COMPONENT_LIBRARY.map((group) => (
                    <div key={group.category}>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">{group.category}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {group.items.map((comp) => (
                          <button
                            key={comp.name}
                            type="button"
                            className="flex items-center gap-2 p-2 border rounded text-xs hover:border-primary transition-colors cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", comp.snippet);
                            }}
                            onClick={() => {
                              setInput((prev) => prev + (prev ? "\n" : "") + `添加组件: ${comp.name}`);
                            }}
                            title={comp.snippet}
                          >
                            <comp.icon className="size-3.5 text-muted-foreground" />
                            <span className="font-medium">{comp.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="terminal" className="m-0 h-full overflow-y-auto p-3">
                <pre className="text-xs font-mono space-y-1">
{generated ? `$ npm install
added 4 packages in 3s

$ npm run dev
> vite v7.0.0 dev
> Local:   http://localhost:3000/
> ready in 248ms

$ curl http://localhost:3000
> 200 OK` : `$ 等待生成完成...`}
                </pre>
              </TabsContent>
              <TabsContent value="git" className="m-0 h-full overflow-y-auto p-3">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <GitBranch className="size-3" />
                    <span className="font-mono">main</span>
                    <Badge variant="secondary" className="text-[10px]">{generated ? "ahead 5" : "up to date"}</Badge>
                  </div>
                  {generated && (
                    <div className="space-y-1 pl-4 border-l-2 ml-3">
                      {files.map((f) => (
                        <div key={f.name} className="flex items-center gap-2">
                          <Check className="size-3 text-green-500" />
                          <span>{f.status === "created" ? "添加" : "修改"} {f.name.split('/').pop()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* 右侧：预览 */}
        <Card className="col-span-4 flex flex-col">
          <CardHeader className="border-b pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">实时预览</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="size-7" onClick={handleRunPreview} title="运行预览">
                <Play className="size-3" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={handleCopyCode} title="复制当前文件代码">
                <Copy className="size-3" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={handleDownload} title="下载全部代码">
                <Download className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {generated && previewSrc ? (
              <iframe
                ref={iframeRef}
                srcDoc={previewSrc}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts"
              />
            ) : (
              <div className="bg-muted/30 p-3 h-full overflow-auto">
                <div className="bg-white rounded p-2 text-center text-[10px] text-muted-foreground mb-2">
                  http://localhost:3000
                </div>
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <div className="text-center">
                    <Play className="size-8 mx-auto mb-2 opacity-30" />
                    <p>等待 AI 生成后预览</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 底部日志条 */}
      <Card>
        <CardContent className="p-3">
          <div className="space-y-1">
            {(generated ? PREVIEW_LOG : [{ time: "", msg: "等待生成任务..." }]).map((l, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground">{l.msg}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
