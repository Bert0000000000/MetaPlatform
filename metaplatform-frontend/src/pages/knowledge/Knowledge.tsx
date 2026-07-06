import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { knowledgeApi, knowledgeQaApi, type KnowledgeDocument } from "@/lib/api";
import { FileText, Upload, Search, Eye, FolderTree, Sparkles, Send, Network, Clock, BookMarked, Tag, GitCommit, Brain, MessageSquare, BookOpen, Ruler, Briefcase, ScrollText, NotebookPen, Scale, Puzzle, Hash, Trash2, Bell, Plus, CheckCircle2, RefreshCw, Download, Activity, XCircle } from "lucide-react";
import { StatCard, PageHeader } from "@/components/ui/stat";

const KB_CATEGORIES = [
  { name: "产品手册", count: 86, icon: BookOpen, color: "bg-blue-500" },
  { name: "技术规范", count: 124, icon: Ruler, color: "bg-purple-500" },
  { name: "业务文档", count: 248, icon: Briefcase, color: "bg-green-500" },
  { name: "合同协议", count: 178, icon: ScrollText, color: "bg-orange-500" },
  { name: "会议纪要", count: 326, icon: NotebookPen, color: "bg-pink-500" },
  { name: "政策法规", count: 64, icon: Scale, color: "bg-red-500" },
];

// TODO: Replace with real API when backend ready (knowledgeApi.search() exists but no Q&A history endpoint)
const QA_HISTORY = [
  { q: "客户合同的付款条款是什么？", hits: 5, topScore: 0.92, answer: "根据 5 篇文档：付款条款为月结 30 天，T+3 工作日内..." },
  { q: "如何申请差旅报销？", hits: 3, topScore: 0.88, answer: "需要登录 OA → 报销管理 → 填写差旅报销单 → 上传发票..." },
  { q: "Q3 销售目标是多少？", hits: 4, topScore: 0.85, answer: "根据 2026 Q3 销售计划：总目标 ¥4.2 亿，按区域分配..." },
];

// 知识图谱节点（mock）
// TODO: Replace with real API when backend ready (knowledgeApi does not have graph nodes endpoint)
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
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "文档", category: "业务文档", content: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await knowledgeApi.listDocuments();
      setDocs(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function handleCreate() {
    if (!form.title.trim()) return;
    try {
      setSubmitting(true);
      await knowledgeApi.createDocument({
        title: form.title,
        type: form.type,
        category: form.category,
        content: form.content,
      });
      setDialogOpen(false);
      setForm({ title: "", type: "文档", category: "业务文档", content: "" });
      await loadDocs();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该文档？")) return;
    try {
      await knowledgeApi.deleteDocument(id);
      await loadDocs();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" /> 文档列表
          </CardTitle>
          <CardDescription>所有文档（{docs.length} 篇）</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
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
        {loading && <div className="text-center py-8 text-muted-foreground">加载中...</div>}
        {error && <div className="text-center py-8 text-destructive">{error}</div>}
        {!loading && !error && docs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">暂无文档，点击上方按钮上传</div>
        )}
        {!loading && !error && docs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>大小</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{d.category || "未分类"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.status === "active" ? "default" : "outline"}>{d.status === "active" ? "已发布" : d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8">
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传文档</DialogTitle>
            <DialogDescription>将文档添加到知识库</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="文档标题" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["文档", "手册", "规范", "报告", "协议", "纪要"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>分类</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["产品手册", "技术规范", "业务文档", "合同协议", "会议纪要", "政策法规"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="文档内容..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={submitting || !form.title.trim()}>
              {submitting ? "提交中..." : "提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [results, setResults] = useState<{ q: string; hits: number; topScore: number; answer: string }[]>(QA_HISTORY);
  const [searching, setSearching] = useState(false);

  /* Fetch Q&A history from API */
  useEffect(() => {
    knowledgeQaApi.list(10).then((data) => {
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          q: item.question,
          hits: 1,
          topScore: 0.85,
          answer: item.answer || "暂无回答",
        }));
        setResults(mapped);
      }
    }).catch(() => {});
  }, []);

  async function ask(query: string) {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const docs = await knowledgeApi.search(query);
      const answer = docs.length > 0
        ? `根据知识库检索到 ${docs.length} 篇相关文档：${docs.map((d) => d.title).join("、")}。`
        : "未找到相关文档，请尝试其他关键词。";
      setResults((r) => [
        { q: query, hits: docs.length, topScore: docs.length > 0 ? 0.86 : 0, answer },
        ...r,
      ]);
      // Save Q&A to backend
      knowledgeQaApi.create({
        question: query,
        answer,
        source_doc_id: docs.length > 0 ? docs[0].id : null,
      }).catch(() => {});
    } catch {
      setResults((r) => [
        { q: query, hits: 0, topScore: 0, answer: "检索失败，请稍后重试。" },
        ...r,
      ]);
    } finally {
      setSearching(false);
      setQ("");
    }
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
          <Button onClick={() => ask(q)} disabled={searching}>
            <Send className="size-3 mr-1" />
            {searching ? "检索中..." : "提问"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function Categories() {
  const [cats, setCats] = useState<{ category: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const catIcons: Record<string, React.ElementType> = {
    "产品手册": BookOpen,
    "技术规范": Ruler,
    "业务文档": Briefcase,
    "合同协议": ScrollText,
    "会议纪要": NotebookPen,
    "政策法规": Scale,
  };
  const catColors: Record<string, string> = {
    "产品手册": "bg-blue-500",
    "技术规范": "bg-purple-500",
    "业务文档": "bg-green-500",
    "合同协议": "bg-orange-500",
    "会议纪要": "bg-pink-500",
    "政策法规": "bg-red-500",
  };

  useEffect(() => {
    knowledgeApi.categories().then((data) => {
      setCats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalCount = cats.reduce((sum, c) => sum + c.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="size-4" /> 文档分类
        </CardTitle>
        <CardDescription>{cats.length} 个分类，共 {totalCount} 篇文档</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-center py-4 text-muted-foreground">加载中...</div>}
        {!loading && cats.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">暂无分类</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cats.map((c) => {
            const Icon = catIcons[c.category] || Tag;
            const color = catColors[c.category] || "bg-gray-500";
            return (
              <div key={c.category} className="rounded-lg border p-4 hover:border-primary cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-lg ${color} text-white flex items-center justify-center`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{c.category}</div>
                    <div className="text-xs text-muted-foreground">{c.count} 篇文档</div>
                  </div>
                </div>
              </div>
            );
          })}
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
  const [docCount, setDocCount] = useState(0);
  const [catCount, setCatCount] = useState(0);

  useEffect(() => {
    knowledgeApi.listDocuments().then((data) => setDocCount(data.length)).catch(() => {});
    knowledgeApi.categories().then((data) => setCatCount(data.length)).catch(() => {});
  }, []);

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
        <StatCard label="文档总数" value={docCount} icon={FileText} />
        <StatCard label="分类数" value={catCount} icon={Puzzle} />
        <StatCard label="向量化" value={docCount > 0 ? docCount * 10 : 0} icon={Hash} />
        <StatCard label="知识图谱节点" value={8934} icon={Network} />
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

/* ─────────────────── KnowledgeProcessing ─────────────────── */
const PROCESSING_JOBS = [
  { id: 1, doc: "MetaPlatform 用户手册", task: "向量化 + 图谱抽取", status: "completed", progress: 100, time: "5 分钟" },
  { id: 2, doc: "API 接口规范 v3.2", task: "向量化", status: "running", progress: 68, time: "进行中" },
  { id: 3, doc: "BPMN 2.0 节点参考", task: "图谱抽取", status: "pending", progress: 0, time: "排队中" },
  { id: 4, doc: "差旅报销制度", task: "向量化 + 图谱抽取", status: "completed", progress: 100, time: "12 分钟" },
  { id: 5, doc: "Q3 销售计划", task: "分类标注", status: "failed", progress: 45, time: "失败" },
];

const procStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "已完成", variant: "default" },
  running: { label: "处理中", variant: "secondary" },
  pending: { label: "排队中", variant: "outline" },
  failed: { label: "失败", variant: "destructive" },
};

export function KnowledgeProcessing() {
  const [jobs, setJobs] = useState(PROCESSING_JOBS);

  function retryJob(id: number) {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: "running", progress: 0 } : j));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="知识加工"
        description="文档向量化、实体抽取、知识图谱构建"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建任务</Button>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="加工任务" value={jobs.length} icon={RefreshCw} />
        <StatCard label="已完成" value={jobs.filter((j) => j.status === "completed").length} icon={CheckCircle2} />
        <StatCard label="处理中" value={jobs.filter((j) => j.status === "running").length} icon={Activity} />
        <StatCard label="失败" value={jobs.filter((j) => j.status === "failed").length} icon={XCircle} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4" /> 加工任务</CardTitle>
          <CardDescription>自动对上传文档进行向量化和知识抽取</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文档</TableHead>
                <TableHead>加工类型</TableHead>
                <TableHead>进度</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => {
                const s = procStatusConfig[j.status];
                return (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.doc}</TableCell>
                    <TableCell className="text-xs">{j.task}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5 w-24">
                          <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${j.progress}%` }} />
                        </div>
                        <span className="text-xs">{j.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{j.time}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {j.status === "failed" && <Button variant="ghost" size="sm" onClick={() => retryJob(j.id)}>重试</Button>}
                      {j.status === "completed" && <Button variant="ghost" size="icon" className="size-8"><Eye className="size-4" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── KnowledgeSearch ─────────────────── */
export function KnowledgeSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ title: string; snippet: string; score: number; source: string }[]>([]);
  const [searching, setSearching] = useState(false);

  function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setTimeout(() => {
      setResults([
        { title: "客户合同付款条款", snippet: "根据合同第 5.2 条，付款条款为月结 30 天，T+3 工作日内完成对公转账...", score: 0.94, source: "合同协议" },
        { title: "差旅报销制度", snippet: "差旅报销标准：机票经济舱、酒店不超过 500 元/晚、市内交通实报实销...", score: 0.88, source: "政策法规" },
        { title: "Q3 销售目标分解", snippet: "Q3 总目标 ¥4.2 亿，华东 ¥1.8 亿、华南 ¥1.2 亿、华北 ¥0.8 亿...", score: 0.82, source: "业务文档" },
      ]);
      setSearching(false);
    }, 800);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="知识搜索" description="基于 RAG 的语义搜索，支持自然语言查询" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Search className="size-4" /> 语义搜索</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="输入自然语言查询..."
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <Button onClick={doSearch} disabled={searching}>
              <Search className="size-3 mr-1" />{searching ? "搜索中..." : "搜索"}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="border rounded-lg p-3 hover:border-primary cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm">{r.title}</div>
                    <Badge variant="outline" className="text-xs">相关度 {(r.score * 100).toFixed(0)}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{r.snippet}</p>
                  <div className="mt-2 text-xs text-muted-foreground">来源: {r.source}</div>
                </div>
              ))}
            </div>
          )}
          {results.length === 0 && !searching && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="size-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">输入关键词开始搜索知识库</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── KnowledgeSubscribe ─────────────────── */
const SUBSCRIPTIONS = [
  { id: 1, name: "产品手册更新", category: "产品手册", frequency: "实时", status: "active", lastNotified: "2 小时前" },
  { id: 2, name: "技术规范变更", category: "技术规范", frequency: "每天", status: "active", lastNotified: "昨天" },
  { id: 3, name: "政策法规变动", category: "政策法规", frequency: "每周", status: "active", lastNotified: "3 天前" },
  { id: 4, name: "合同模板更新", category: "合同协议", frequency: "实时", status: "paused", lastNotified: "1 周前" },
];

export function KnowledgeSubscribe() {
  const [subs, setSubs] = useState(SUBSCRIPTIONS);

  function toggleSub(id: number) {
    setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status: s.status === "active" ? "paused" : "active" } : s));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="知识订阅"
        description="订阅知识库分类变更通知，及时获取最新文档"
        action={<Button className="gap-2"><Bell className="size-4" /> 新建订阅</Button>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="订阅数" value={subs.length} icon={Bell} />
        <StatCard label="已启用" value={subs.filter((s) => s.status === "active").length} icon={CheckCircle2} />
        <StatCard label="本周通知" value={12} icon={Send} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="size-4" /> 订阅列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订阅名</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>通知频率</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后通知</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="secondary">{s.category}</Badge></TableCell>
                  <TableCell className="text-xs">{s.frequency}</TableCell>
                  <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status === "active" ? "已启用" : "已暂停"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.lastNotified}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleSub(s.id)}>{s.status === "active" ? "暂停" : "启用"}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}