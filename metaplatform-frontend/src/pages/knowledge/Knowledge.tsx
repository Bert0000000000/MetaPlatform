import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockDocuments } from "@/lib/mock-data";
import { FileText, Upload, Search, Eye, FolderTree, Sparkles, Send, Network, Clock, BookMarked, Tag, GitCommit, Brain, MessageSquare } from "lucide-react";

const KB_CATEGORIES = [
  { name: "产品手册", count: 86, icon: "📘", color: "bg-blue-500" },
  { name: "技术规范", count: 124, icon: "📐", color: "bg-purple-500" },
  { name: "业务文档", count: 248, icon: "💼", color: "bg-green-500" },
  { name: "合同协议", count: 178, icon: "📜", color: "bg-orange-500" },
  { name: "会议纪要", count: 326, icon: "📝", color: "bg-pink-500" },
  { name: "政策法规", count: 64, icon: "⚖️", color: "bg-red-500" },
];

const QA_HISTORY = [
  { q: "客户合同的付款条款是什么？", hits: 5, topScore: 0.92, answer: "根据 5 篇文档：付款条款为月结 30 天，T+3 工作日内..." },
  { q: "如何申请差旅报销？", hits: 3, topScore: 0.88, answer: "需要登录 OA → 报销管理 → 填写差旅报销单 → 上传发票..." },
  { q: "Q3 销售目标是多少？", hits: 4, topScore: 0.85, answer: "根据 2026 Q3 销售计划：总目标 ¥4.2 亿，按区域分配..." },
];

// 知识图谱节点（mock）
const GRAPH_NODES = [
  { id: "客户", type: "entity", x: 50, y: 50 },
  { id: "订单", type: "entity", x: 150, y: 30 },
  { id: "合同", type: "entity", x: 150, y: 110 },
  { id: "付款", type: "entity", x: 250, y: 70 },
  { id: "发票", type: "entity", x: 250, y: 150 },
  { id: "客户-签署-合同", type: "relation", x: 100, y: 80 },
  { id: "合同-包含-订单", type: "relation", x: 200, y: 60 },
  { id: "订单-触发-付款", type: "relation", x: 200, y: 110 },
  { id: "付款-生成-发票", type: "relation", x: 250, y: 110 },
];

export function DocumentList() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" /> 文档列表
          </CardTitle>
          <CardDescription>所有文档（含 RAG + GraphRAG）</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="size-3 mr-1" />
            上传文档
          </Button>
          <Button variant="outline" size="sm">
            <Sparkles className="size-3 mr-1" />
            AI 整理
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>作者</TableHead>
              <TableHead>大小</TableHead>
              <TableHead className="text-right">浏览</TableHead>
              <TableHead>更新</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDocuments.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{d.category}</Badge>
                </TableCell>
                <TableCell>{d.author}</TableCell>
                <TableCell>{d.size}</TableCell>
                <TableCell className="text-right">{d.views.toLocaleString()}</TableCell>
                <TableCell>{d.updatedAt}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8">
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function KnowledgeGraph() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="size-4" /> 知识图谱
        </CardTitle>
        <CardDescription>从文档中抽取的实体与关系（GraphRAG 可用）</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-[400px] bg-muted/30 rounded-lg overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet">
            {/* 连线 */}
            <line x1="60" y1="55" x2="140" y2="35" stroke="#94a3b8" strokeWidth="1" />
            <line x1="60" y1="55" x2="140" y2="115" stroke="#94a3b8" strokeWidth="1" />
            <line x1="160" y1="35" x2="240" y2="75" stroke="#94a3b8" strokeWidth="1" />
            <line x1="160" y1="115" x2="240" y2="75" stroke="#94a3b8" strokeWidth="1" />
            <line x1="260" y1="75" x2="260" y2="155" stroke="#94a3b8" strokeWidth="1" />

            {/* 节点 */}
            <g>
              <circle cx="50" cy="50" r="20" fill="#3b82f6" />
              <text x="50" y="55" textAnchor="middle" fill="white" fontSize="10">客户</text>
            </g>
            <g>
              <circle cx="150" cy="30" r="18" fill="#8b5cf6" />
              <text x="150" y="35" textAnchor="middle" fill="white" fontSize="10">订单</text>
            </g>
            <g>
              <circle cx="150" cy="110" r="18" fill="#ec4899" />
              <text x="150" y="115" textAnchor="middle" fill="white" fontSize="10">合同</text>
            </g>
            <g>
              <circle cx="250" cy="70" r="18" fill="#f59e0b" />
              <text x="250" y="75" textAnchor="middle" fill="white" fontSize="10">付款</text>
            </g>
            <g>
              <circle cx="250" cy="150" r="18" fill="#10b981" />
              <text x="250" y="155" textAnchor="middle" fill="white" fontSize="10">发票</text>
            </g>

            {/* 关系标签 */}
            <text x="95" y="40" fontSize="8" fill="#64748b">签署</text>
            <text x="95" y="90" fontSize="8" fill="#64748b">属于</text>
            <text x="200" y="50" fontSize="8" fill="#64748b">触发</text>
            <text x="200" y="100" fontSize="8" fill="#64748b">基于</text>
            <text x="270" y="115" fontSize="8" fill="#64748b">生成</text>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">5 个实体</Badge>
          <Badge variant="outline">5 条关系</Badge>
          <Badge variant="outline">自动抽取</Badge>
          <Badge variant="outline">置信度 ≥ 0.8</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function SmartQA() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(QA_HISTORY);

  function ask(query: string) {
    if (!query.trim()) return;
    setResults((r) => [
      {
        q: query,
        hits: 4,
        topScore: 0.86,
        answer: "（AI 模拟回答）已根据知识库内容生成答案，引用 4 个文档片段，详见下方引用列表。",
      },
      ...r,
    ]);
    setQ("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="size-4" /> 智能问答（RAG）
        </CardTitle>
        <CardDescription>基于知识库的自然语言问答</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-4">
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MessageSquare className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.q}</div>
                  <div className="text-xs text-muted-foreground mt-1">检索 {r.hits} 个片段 · 最高相关度 {(r.topScore * 100).toFixed(0)}%</div>
                </div>
              </div>
              <div className="flex items-start gap-2 pl-6">
                <Sparkles className="size-4 text-purple-500 shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">{r.answer}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(q)}
            placeholder="基于知识库提问..."
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <Button onClick={() => ask(q)}>
            <Send className="size-3 mr-1" />
            提问
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function Categories() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="size-4" /> 文档分类
        </CardTitle>
        <CardDescription>6 个一级分类，共 1,026 篇文档</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {KB_CATEGORIES.map((c) => (
            <div key={c.name} className="rounded-lg border p-4 hover:border-primary cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg ${c.color} text-white flex items-center justify-center text-xl`}>
                  {c.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.count} 篇文档</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function VersionHistory() {
  const VERSIONS = [
    { ver: "v3.2", doc: "MetaPlatform 用户手册", author: "张伟", time: "今早 09:15", change: "新增 AI 智能体章节" },
    { ver: "v3.1", doc: "MetaPlatform 用户手册", author: "李娜", time: "昨天 17:30", change: "修订流程设计器部分" },
    { ver: "v2.4", doc: "API 接口规范", author: "王强", time: "2 天前", change: "新增 12 个 OpenAPI" },
    { ver: "v1.8", doc: "BPMN 2.0 节点参考", author: "刘敏", time: "1 周前", change: "完善子流程文档" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitCommit className="size-4" /> 版本历史
        </CardTitle>
        <CardDescription>文档变更追踪</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>版本</TableHead>
              <TableHead>文档</TableHead>
              <TableHead>修改人</TableHead>
              <TableHead>变更</TableHead>
              <TableHead className="text-right">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {VERSIONS.map((v, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{v.ver}</TableCell>
                <TableCell className="font-medium">{v.doc}</TableCell>
                <TableCell>{v.author}</TableCell>
                <TableCell className="text-xs">{v.change}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{v.time}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function KnowledgeDashboard() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BookMarked className="size-5 text-primary" />
            知识库
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            企业文档、向量检索、知识图谱与 RAG 智能问答
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="size-3 mr-1" />
            上传文档
          </Button>
          <Button size="sm">
            <Sparkles className="size-3 mr-1" />
            AI 问答
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="文档总数" value={1284} icon="📄" />
        <StatCard label="已分块" value={48620} icon="🧩" />
        <StatCard label="向量化" value={48620} icon="🔢" />
        <StatCard label="知识图谱节点" value={8934} icon="🕸️" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="docs">文档</TabsTrigger>
          <TabsTrigger value="categories">分类</TabsTrigger>
          <TabsTrigger value="graph">知识图谱</TabsTrigger>
          <TabsTrigger value="qa">智能问答</TabsTrigger>
          <TabsTrigger value="history">版本历史</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="size-4" /> RAG 检索
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">2,841</div>
                <p className="text-xs text-muted-foreground mt-1">本周检索次数</p>
                <p className="text-xs text-muted-foreground">平均响应 156ms</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderTree className="size-4" /> GraphRAG
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">186</div>
                <p className="text-xs text-muted-foreground mt-1">本周图谱检索</p>
                <p className="text-xs text-muted-foreground">平均响应 89ms</p>
              </CardContent>
            </Card>
          </div>
          <DocumentList />
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <DocumentList />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Categories />
        </TabsContent>

        <TabsContent value="graph" className="mt-4">
          <KnowledgeGraph />
        </TabsContent>

        <TabsContent value="qa" className="mt-4">
          <SmartQA />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <VersionHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}