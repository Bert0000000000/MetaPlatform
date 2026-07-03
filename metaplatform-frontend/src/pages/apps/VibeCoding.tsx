import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Send, Code2, Play, Save, Download, Folder, File, Terminal, GitBranch, Check, X, Loader2, Bot, Copy, Plus } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; ts: string }

const INITIAL: Msg[] = [
  { role: "assistant", content: "我是 VibeCoding\n用自然语言描述你想要的页面/应用，我来帮你生成。\n\n例如：\n- 「做一个销售看板，按地区分组，显示本月销售额、订单数、客户数」\n- 「客户管理表单，包含姓名、电话、行业、备注」", ts: "12:30" },
];

const FILES = [
  { name: "src/pages/SalesDashboard.tsx", type: "tsx", lines: 142, status: "created" },
  { name: "src/components/SalesChart.tsx", type: "tsx", lines: 86, status: "created" },
  { name: "src/api/sales.ts", type: "ts", lines: 32, status: "created" },
  { name: "src/hooks/useSalesData.ts", type: "ts", lines: 48, status: "created" },
  { name: "package.json", type: "json", lines: 28, status: "modified" },
];

const PREVIEW_LOG = [
  { time: "12:48:32", msg: "✅ 编译成功，5 个文件生成" },
  { time: "12:48:35", msg: "✅ 安装依赖完成 (4 packages)" },
  { time: "12:48:42", msg: "✅ 本地预览启动 http://localhost:3000" },
  { time: "12:48:50", msg: "✅ 渲染完成，0 错误" },
];

export default function VibeCoding() {
  const [msgs, setMsgs] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);

  function send() {
    const text = input.trim();
    if (!text) return;
    setGenerating(true);
    setMsgs((m) => [...m, { role: "user", content: text, ts: "现在" }]);
    setInput("");
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `好的，我正在为你生成代码...\n\n生成了 ${FILES.length} 个文件：\n${FILES.map((f) => `  - ${f.name} (${f.lines} 行)`).join("\n")}\n\n总计 ${FILES.reduce((a, f) => a + f.lines, 0)} 行代码 | 耗时 18 秒\n\n你可以点击右侧「运行预览」查看效果，或「下载源码」获取完整工程。`,
          ts: "现在",
        },
      ]);
      setGenerating(false);
    }, 1500);
  }

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
        <Card className="col-span-4 flex flex-col">
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
              <TabsList>
                <TabsTrigger value="files"><Folder className="size-3 mr-1" /> 文件</TabsTrigger>
                <TabsTrigger value="code"><Code2 className="size-3 mr-1" /> 代码</TabsTrigger>
                <TabsTrigger value="terminal"><Terminal className="size-3 mr-1" /> 终端</TabsTrigger>
                <TabsTrigger value="git"><GitBranch className="size-3 mr-1" /> Git</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <TabsContent value="files" className="m-0 h-full overflow-y-auto p-3">
                <div className="space-y-1">
                  {FILES.map((f) => (
                    <div key={f.name} className="flex items-center gap-2 p-2 hover:bg-muted rounded text-xs">
                      <File className="size-3" />
                      <span className="flex-1 font-mono">{f.name}</span>
                      <Badge variant={f.status === "created" ? "default" : "outline"} className="text-[10px]">
                        {f.status === "created" ? <Plus className="size-2" /> : <Code2 className="size-2" />}
                        <span className="ml-0.5">{f.status === "created" ? "新建" : "修改"}</span>
                      </Badge>
                      <span className="text-muted-foreground">{f.lines} 行</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="code" className="m-0 h-full overflow-auto">
                <pre className="text-xs bg-slate-950 text-slate-50 p-4 font-mono h-full overflow-auto">
{`import React, { useState, useEffect } from 'react';
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
    <div className="p-6 grid grid-cols-3 gap-4">
      <Card>
        <CardHeader><CardTitle>本月销售额</CardTitle></CardHeader>
        <CardContent>
          <div className="text-xl font-bold">¥12,486,329</div>
          <span className="text-green-600 text-sm">+18.2% ↑</span>
        </CardContent>
      </Card>
      {/* AI 生成的更多卡片... */}
      <Card>
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
}`}
                </pre>
              </TabsContent>
              <TabsContent value="terminal" className="m-0 h-full overflow-y-auto p-3">
                <pre className="text-xs font-mono space-y-1">
{`$ npm install
added 4 packages in 3s

$ npm run dev
> vite v7.0.0 dev
> Local:   http://localhost:3000/
> ready in 248ms

$ curl http://localhost:3000
> 200 OK`}
                </pre>
              </TabsContent>
              <TabsContent value="git" className="m-0 h-full overflow-y-auto p-3">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <GitBranch className="size-3" />
                    <span className="font-mono">main</span>
                    <Badge variant="secondary" className="text-[10px]">ahead 1</Badge>
                  </div>
                  <div className="space-y-1 pl-4 border-l-2 ml-3">
                    <div className="flex items-center gap-2">
                      <Check className="size-3 text-green-500" />
                      <span>添加销售看板组件</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3 text-green-500" />
                      <span>添加销售数据 API</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3 text-green-500" />
                      <span>添加销售数据 Hook</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3 text-green-500" />
                      <span>更新 package.json</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* 右侧：预览 */}
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="border-b pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">实时预览</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="size-7"><Play className="size-3" /></Button>
              <Button variant="ghost" size="icon" className="size-7"><Copy className="size-3" /></Button>
              <Button variant="ghost" size="icon" className="size-7"><Download className="size-3" /></Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <div className="bg-muted/30 p-3 h-full overflow-auto">
              <div className="bg-white rounded p-2 text-center text-[10px] text-muted-foreground mb-2">
                http://localhost:3000
              </div>
              <div className="space-y-2">
                <div className="rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white p-3">
                  <div className="text-[10px] opacity-80">本月销售额</div>
                  <div className="text-lg font-bold">¥12,486,329</div>
                  <div className="text-[10px] opacity-80">+18.2% ↑</div>
                </div>
                <div className="rounded border p-2 bg-white">
                  <div className="text-[10px] font-medium mb-1">销售趋势</div>
                  <div className="flex items-end gap-1 h-12">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 88].map((v, i) => (
                      <div key={i} className="flex-1 bg-blue-500 rounded-t" style={{ height: `${v}%` }} />
                    ))}
                  </div>
                </div>
                <div className="rounded border p-2 bg-white">
                  <div className="text-[10px] font-medium mb-1">各地区销售</div>
                  <div className="space-y-1">
                    {[
                      { region: "华东", percent: 95 },
                      { region: "华北", percent: 82 },
                      { region: "华南", percent: 76 },
                      { region: "西部", percent: 58 },
                    ].map((r) => (
                      <div key={r.region} className="flex items-center gap-1 text-[10px]">
                        <span className="w-8">{r.region}</span>
                        <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                          <div className="bg-blue-500 h-full" style={{ width: `${r.percent}%` }} />
                        </div>
                        <span className="font-mono">{r.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 底部日志条 */}
      <Card>
        <CardContent className="p-3">
          <div className="space-y-1">
            {PREVIEW_LOG.map((l, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground">{l.msg}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}