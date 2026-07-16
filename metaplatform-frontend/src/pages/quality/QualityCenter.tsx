import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/ui/stat";
import { qualityApi } from "@/lib/api";
import { llmApi } from "@/lib/llm-api";
import { TestTube, Bot, Play, CheckCircle2, XCircle, Loader2, Bug, FileText, Plus, Gauge, Sparkles, GitBranch, AlertCircle, Zap, FlaskConical, BarChart3, Download, Activity, Settings, Search, Send, Monitor, Wrench, Eye, Clock, Shield, Trash2 } from "lucide-react";

const statusConfig = {
  passed: { label: "通过", variant: "default" as const, icon: CheckCircle2 },
  failed: { label: "失败", variant: "destructive" as const, icon: XCircle },
  running: { label: "运行中", variant: "secondary" as const, icon: Loader2 },
  skipped: { label: "跳过", variant: "outline" as const, icon: null },
  draft: { label: "草稿", variant: "outline" as const, icon: null },
};

const priorityConfig = {
  P0: { label: "P0", variant: "destructive" as const },
  P1: { label: "P1", variant: "default" as const },
  P2: { label: "P2", variant: "outline" as const },
};

// 测试用例 fallback 数据（API 失败时使用）
const TEST_CASES_FALLBACK = [
  { id: "t-1", name: "客户对象建模 CRUD", module: "本体引擎", type: "单元" as const, status: "passed" as const, priority: "P0" as const, lastRun: "10min ago", duration: "2.3s" },
  { id: "t-2", name: "请假流程端到端", module: "流程引擎", type: "流程" as const, status: "passed" as const, priority: "P0" as const, lastRun: "1h ago", duration: "12.4s" },
  { id: "t-3", name: "报销审批页面回归", module: "应用中心", type: "UI" as const, status: "failed" as const, priority: "P0" as const, lastRun: "30min ago", duration: "45.2s" },
  { id: "t-4", name: "知识库 RAG 检索性能", module: "知识库", type: "性能" as const, status: "passed" as const, priority: "P1" as const, lastRun: "2h ago", duration: "8.1s" },
  { id: "t-5", name: "数据中心 Doris SQL 集成", module: "数据中心", type: "集成" as const, status: "running" as const, priority: "P0" as const, lastRun: "running", duration: "-" },
];

// 缺陷跟踪 fallback 数据（API 失败时使用）
const BUGS_FALLBACK = [
  { id: "BUG-1284", title: "客户详情页加载慢（>3s）", module: "客户管理", severity: "P0", status: "open", assignee: "张伟", createdAt: "今天 09:42" },
  { id: "BUG-1283", title: "审批流加签功能不可用", module: "报销审批", severity: "P0", status: "fixed", assignee: "李娜", createdAt: "昨天 16:20" },
  { id: "BUG-1282", title: "销售看板图表数据缺失 7/1", module: "销售看板", severity: "P1", status: "verifying", assignee: "王强", createdAt: "昨天 14:30" },
  { id: "BUG-1281", title: "智能体回答错乱（中英文混排）", module: "智能体助手", severity: "P1", status: "open", assignee: "刘敏", createdAt: "2 天前" },
  { id: "BUG-1280", title: "导出 PDF 中文乱码", module: "销售看板", severity: "P2", status: "closed", assignee: "陈红", createdAt: "3 天前" },
];

// 性能测试结果
const PERF_TESTS = [
  { name: "首屏加载", p50: 0.8, p95: 1.4, target: 1.5, status: "passed" },
  { name: "页面切换", p50: 0.2, p95: 0.5, target: 0.8, status: "passed" },
  { name: "表单提交", p50: 1.2, p95: 2.1, target: 2.0, status: "warning" },
  { name: "报表查询", p50: 2.4, p95: 4.8, target: 5.0, status: "passed" },
  { name: "并发 1000 用户", p50: 1.8, p95: 3.5, target: 4.0, status: "passed" },
];

// AI 用例生成
const AI_GENERATED = [
  { name: "客户编号为空的保存场景", type: "边界测试", source: "AI 根据对象生成", confidence: 92 },
  { name: "订单金额为负的校验", type: "边界测试", source: "AI 根据对象生成", confidence: 88 },
  { name: "审批流超时自动通过", type: "流程测试", source: "AI 根据流程生成", confidence: 85 },
  { name: "大屏看板 1 万条数据渲染", type: "性能测试", source: "AI 根据页面生成", confidence: 79 },
];

export function TestCases({ onAdoptFromAI }: { onAdoptFromAI?: (caseItem: { name: string; module: string; type: string }) => void }) {
  const [cases, setCases] = useState(TEST_CASES_FALLBACK);

  /* Fetch test cases from API */
  useEffect(() => {
    qualityApi.listCases().then((data) => {
      if (data && data.length > 0) {
        setCases(data.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          module: tc.module || "未分类",
          type: (tc.type === "functional" ? "单元" : tc.type === "performance" ? "性能" : tc.type === "integration" ? "集成" : "单元") as "单元" | "集成" | "UI" | "流程" | "性能",
          status: (tc.result === "passed" ? "passed" : tc.result === "failed" ? "failed" : tc.status === "completed" ? "passed" : "draft") as "passed" | "failed" | "running" | "skipped" | "draft",
          priority: (tc.priority === "high" ? "P0" : tc.priority === "medium" ? "P1" : "P2") as "P0" | "P1" | "P2",
          lastRun: tc.status === "completed" ? new Date(tc.updated_at).toLocaleDateString("zh-CN") : "未运行",
          duration: tc.duration ? `${(tc.duration / 1000).toFixed(1)}s` : "-",
        })));
      }
    }).catch(() => {});
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(AI_GENERATED);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleAIGenerate() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const response = await llmApi.chat([
        {
          role: "system",
          content: `你是一个测试用例生成专家。根据用户描述的对象、流程或页面，生成测试用例列表。
请以 JSON 数组格式返回，每个元素包含：
- name: 用例名称（字符串）
- type: 用例类型，从 "边界测试"、"流程测试"、"性能测试"、"功能测试"、"集成测试" 中选择
- confidence: 置信度 0-100 的数字

只返回 JSON 数组，不要包含其他文字。示例：
[{"name":"测试用例名称","type":"边界测试","confidence":90}]`,
        },
        { role: "user", content: aiPrompt },
      ], { temperature: 0.7, maxTokens: 1000 });

      const content = response.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setAiGenerated(parsed.map((item: { name?: string; type?: string; confidence?: number }) => ({
          name: item.name || "未命名用例",
          type: item.type || "功能测试",
          source: "AI 根据用户描述生成",
          confidence: item.confidence || 80,
        })));
      } else {
        setAiError("AI 返回格式无法解析，请重试");
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setAiGenerating(false);
    }
  }
  const [form, setForm] = useState({ name: "", module: "", type: "单元", priority: "P1" });

  function handleAddCase() {
    if (!form.name.trim()) return;
    setCases((prev) => [...prev, {
      id: `t-${Date.now()}`,
      name: form.name,
      module: form.module || "未分类",
      type: form.type as "单元" | "集成" | "UI" | "流程" | "性能",
      status: "draft",
      priority: form.priority as "P0" | "P1" | "P2",
      lastRun: "未运行",
      duration: "-",
    }]);
    setDialogOpen(false);
    setForm({ name: "", module: "", type: "单元", priority: "P1" });
  }

  // Run a test case by calling the backend API
  async function handleRun(id: string) {
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, status: "running" as const, lastRun: "运行中..." } : c));
    try {
      const token = localStorage.getItem("mp_token");
      const response = await fetch(`/api/quality/test-cases/${id}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await response.json();
      if (json.success && json.data) {
        const tc = json.data;
        setCases((prev) => prev.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            status: (tc.result === "passed" ? "passed" : tc.result === "failed" ? "failed" : "passed") as "passed" | "failed",
            lastRun: "刚刚",
            duration: tc.duration ? `${(tc.duration / 1000).toFixed(1)}s` : "-",
          };
        }));
      } else {
        // API returned error, mark as failed
        setCases((prev) => prev.map((c) => c.id === id ? { ...c, status: "failed" as const, lastRun: "失败" } : c));
      }
    } catch (err) {
      // Network error, mark as failed
      setCases((prev) => prev.map((c) => c.id === id ? { ...c, status: "failed" as const, lastRun: "请求失败" } : c));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">测试用例</CardTitle>
          <CardDescription>所有测试用例（{cases.length} 个）</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="size-3 mr-1" />
            AI 生成
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3 mr-1" />
            新建用例
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用例名</TableHead>
              <TableHead>模块</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>优先级</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>最近运行</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((t) => {
              const s = statusConfig[t.status];
              const p = priorityConfig[t.priority];
              const StatusIcon = s.icon;
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.module}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.variant}>{p.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {StatusIcon && <StatusIcon className={`size-3 ${t.status === "failed" ? "text-red-500" : t.status === "running" ? "animate-spin" : "text-green-500"}`} />}
                      <span>{s.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>{t.duration}</TableCell>
                  <TableCell className="text-xs">{t.lastRun}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => handleRun(t.id)} disabled={t.status === "running"}>
                      <Play className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建测试用例</DialogTitle>
            <DialogDescription>创建一个新的测试用例</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用例名</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：客户编号唯一性校验" />
            </div>
            <div className="space-y-2">
              <Label>模块</Label>
              <Input value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))} placeholder="如：本体引擎" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["单元", "集成", "UI", "流程", "性能"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - 紧急</SelectItem>
                    <SelectItem value="P1">P1 - 高</SelectItem>
                    <SelectItem value="P2">P2 - 中</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddCase}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 生成用例对话框 */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> AI 自动生成测试用例
            </DialogTitle>
            <DialogDescription>描述对象 / 流程 / 页面，AI 自动推荐测试用例</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mb-2">
            <Input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="如：客户对象的 CRUD 操作"
              onKeyDown={(e) => e.key === "Enter" && handleAIGenerate()}
              disabled={aiGenerating}
            />
            <Button size="sm" onClick={handleAIGenerate} disabled={aiGenerating || !aiPrompt.trim()}>
              {aiGenerating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            </Button>
          </div>
          {aiError && <div className="text-xs text-destructive mb-2">{aiError}</div>}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {aiGenerated.map((g, i) => (
              <div key={`${g.name}-${i}`} className="flex items-center gap-3 p-3 border rounded-lg">
                <Sparkles className="size-4 text-primary shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{g.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {g.type} · {g.source}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">置信度 {g.confidence}%</Badge>
                <Button size="sm" variant="outline" onClick={async () => {
                  const newId = `t-ai-${Date.now()}-${i}`;
                  const mappedType = (g.type.includes("边界") || g.type.includes("单元") ? "单元" : g.type.includes("流程") ? "流程" : g.type.includes("性能") ? "性能" : "集成") as "单元" | "集成" | "UI" | "流程" | "性能";
                  setCases((prev) => [...prev, {
                    id: newId,
                    name: g.name,
                    module: "AI 生成",
                    type: mappedType,
                    status: "draft" as const,
                    priority: "P1" as const,
                    lastRun: "未运行",
                    duration: "-",
                  }]);
                  try {
                    await qualityApi.createCase({ name: g.name, module: "AI 生成", type: mappedType === "单元" ? "functional" : mappedType === "性能" ? "performance" : "integration", priority: "medium" });
                  } catch (e) { console.warn("Failed to persist AI case:", e); }
                  onAdoptFromAI?.({ name: g.name, module: "AI 生成", type: g.type });
                }}>
                  采纳
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>关闭</Button>
            <Button onClick={async () => {
              // 一键全部采纳
              for (let i = 0; i < aiGenerated.length; i++) {
                const g = aiGenerated[i];
                const mappedType = (g.type.includes("边界") || g.type.includes("单元") ? "单元" : g.type.includes("流程") ? "流程" : g.type.includes("性能") ? "性能" : "集成") as "单元" | "集成" | "UI" | "流程" | "性能";
                setCases((prev) => [...prev, {
                  id: `t-ai-batch-${Date.now()}-${i}`,
                  name: g.name,
                  module: "AI 生成",
                  type: mappedType,
                  status: "draft" as const,
                  priority: "P1" as const,
                  lastRun: "未运行",
                  duration: "-",
                }]);
                try {
                  await qualityApi.createCase({ name: g.name, module: "AI 生成", type: mappedType === "单元" ? "functional" : mappedType === "性能" ? "performance" : "integration", priority: "medium" });
                } catch (e) { console.warn("Failed to persist AI case:", e); }
              }
              setAiDialogOpen(false);
            }}>
              <Sparkles className="size-3 mr-1" />
              全部采纳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function BugTracker() {
  const [bugs, setBugs] = useState(BUGS_FALLBACK);

  /* Fetch bugs from API */
  useEffect(() => {
    qualityApi.listBugs().then((data) => {
      if (data && data.length > 0) {
        setBugs(data.map((b: any) => ({
          id: b.id.toUpperCase().replace("BUG-", "BUG-"),
          title: b.title,
          module: b.module || "未分类",
          severity: b.severity === "high" ? "P0" : b.severity === "medium" ? "P1" : "P2",
          status: b.status,
          assignee: b.assignee || "待分配",
          createdAt: new Date(b.created_at).toLocaleDateString("zh-CN"),
        })));
      }
    }).catch(() => {});
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", module: "", severity: "P1", assignee: "" });
  const p0Count = bugs.filter((b) => b.severity === "P0").length;

  function handleAddBug() {
    if (!form.title.trim()) return;
    setBugs((prev) => [{
      id: `BUG-${1285 + prev.length}`,
      title: form.title,
      module: form.module || "未分类",
      severity: form.severity,
      status: "open",
      assignee: form.assignee || "待分配",
      createdAt: "刚刚",
    }, ...prev]);
    setDialogOpen(false);
    setForm({ title: "", module: "", severity: "P1", assignee: "" });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="size-4" /> 缺陷跟踪
          </CardTitle>
          <CardDescription>{bugs.length} 个缺陷，P0 优先级 {p0Count} 个</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          上报缺陷
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>模块</TableHead>
              <TableHead>级别</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>负责人</TableHead>
              <TableHead className="text-right">创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bugs.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.id}</TableCell>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell>{b.module}</TableCell>
                <TableCell>
                  <Badge variant={priorityConfig[b.severity as keyof typeof priorityConfig].variant}>{b.severity}</Badge>
                </TableCell>
                <TableCell>
                  {b.status === "open" && <Badge variant="destructive">待处理</Badge>}
                  {b.status === "fixed" && <Badge variant="secondary" className="text-green-600">已修复</Badge>}
                  {b.status === "verifying" && <Badge className="bg-blue-500">验证中</Badge>}
                  {b.status === "closed" && <Badge variant="outline">已关闭</Badge>}
                </TableCell>
                <TableCell>{b.assignee}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{b.createdAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上报缺陷</DialogTitle>
            <DialogDescription>提交新的缺陷报告</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="简要描述问题" />
            </div>
            <div className="space-y-2">
              <Label>模块</Label>
              <Input value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))} placeholder="如：客户管理" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>级别</Label>
                <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - 紧急</SelectItem>
                    <SelectItem value="P1">P1 - 高</SelectItem>
                    <SelectItem value="P2">P2 - 中</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>负责人</Label>
                <Input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} placeholder="负责人姓名" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddBug}>提交</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const PERF_STORAGE_KEY = "mp_perf_tests";

export function PerfMonitor() {
  const [perfTests, setPerfTests] = useState<typeof PERF_TESTS>(() => {
    try {
      const stored = localStorage.getItem(PERF_STORAGE_KEY);
      return stored ? JSON.parse(stored) : PERF_TESTS;
    } catch { return PERF_TESTS; }
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", p50: "", p95: "", target: "" });

  useEffect(() => {
    try { localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(perfTests)); } catch {}
  }, [perfTests]);

  function handleAddTest() {
    if (!form.name.trim()) return;
    const p50 = parseFloat(form.p50) || 0;
    const p95 = parseFloat(form.p95) || 0;
    const target = parseFloat(form.target) || 0;
    const status = p95 <= target ? "passed" : p95 <= target * 1.1 ? "warning" : "failed";
    setPerfTests((prev) => [...prev, { name: form.name, p50, p95, target, status }]);
    setDialogOpen(false);
    setForm({ name: "", p50: "", p95: "", target: "" });
  }

  function handleDeleteTest(name: string) {
    setPerfTests((prev) => prev.filter((t) => t.name !== name));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="size-4" /> 性能监控
          </CardTitle>
          <CardDescription>{perfTests.length} 个性能指标（基于 RUM）</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          添加指标
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>指标</TableHead>
              <TableHead>P50</TableHead>
              <TableHead>P95</TableHead>
              <TableHead>目标</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perfTests.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.p50}s</TableCell>
                <TableCell>{p.p95}s</TableCell>
                <TableCell className="text-muted-foreground">≤ {p.target}s</TableCell>
                <TableCell>
                  {p.status === "passed" && <Badge variant="secondary" className="text-green-600">通过</Badge>}
                  {p.status === "warning" && <Badge variant="outline" className="text-orange-500">接近阈值</Badge>}
                  {p.status === "failed" && <Badge variant="destructive">超时</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDeleteTest(p.name)} title="删除">
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加性能指标</DialogTitle>
            <DialogDescription>配置新的性能监控指标</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>指标名</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：首屏加载" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>P50 (秒)</Label>
                <Input type="number" step="0.1" value={form.p50} onChange={(e) => setForm((f) => ({ ...f, p50: e.target.value }))} placeholder="0.8" />
              </div>
              <div className="space-y-2">
                <Label>P95 (秒)</Label>
                <Input type="number" step="0.1" value={form.p95} onChange={(e) => setForm((f) => ({ ...f, p95: e.target.value }))} placeholder="1.4" />
              </div>
              <div className="space-y-2">
                <Label>目标 (秒)</Label>
                <Input type="number" step="0.1" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="1.5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddTest}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function AIGenerateCases({ onAdopt }: { onAdopt?: (caseItem: { name: string; type: string }) => void }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(AI_GENERATED);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await llmApi.chat([
        {
          role: "system",
          content: `你是一个测试用例生成专家。根据用户描述的对象、流程或页面，生成测试用例列表。
请以 JSON 数组格式返回，每个元素包含：
- name: 用例名称（字符串）
- type: 用例类型，从 "边界测试"、"流程测试"、"性能测试"、"功能测试"、"集成测试" 中选择
- confidence: 置信度 0-100 的数字

只返回 JSON 数组，不要包含其他文字。示例：
[{"name":"测试用例名称","type":"边界测试","confidence":90}]`,
        },
        {
          role: "user",
          content: prompt,
        },
      ], { temperature: 0.7, maxTokens: 1000 });

      const content = response.content.trim();
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const cases = parsed.map((item: { name?: string; type?: string; confidence?: number }) => ({
          name: item.name || "未命名用例",
          type: item.type || "功能测试",
          source: "AI 根据用户描述生成",
          confidence: item.confidence || 80,
        }));
        setGenerated(cases);
      } else {
        setError("AI 返回格式无法解析，请重试");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请检查网络连接");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> AI 自动生成用例
        </CardTitle>
        <CardDescription>描述对象/流程/页面，AI 自动推荐测试用例</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述需要生成测试用例的对象、流程或页面，如：客户对象的 CRUD 操作"
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            disabled={generating}
          />
          <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}
            {generating ? "生成中..." : "生成"}
          </Button>
        </div>

        {error && (
          <div className="text-sm text-destructive mb-3 p-2 border border-destructive/20 rounded bg-destructive/5">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {generated.map((g, i) => (
            <div key={`${g.name}-${i}`} className="flex items-center gap-3 p-3 border rounded-lg">
              <Sparkles className="size-4 text-primary shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-sm">{g.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {g.type} · {g.source}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">置信度 {g.confidence}%</Badge>
              <Button size="sm" variant="outline" onClick={() => onAdopt?.({ name: g.name, type: g.type })}>
                采纳
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function QualityDashboard() {
  const [cases, setCases] = useState(TEST_CASES_FALLBACK);
  const [bugsData, setBugsData] = useState(BUGS_FALLBACK);
  const [stats, setStats] = useState<{ totalCases: number; passedCases: number; failedCases: number; passRate: string; totalBugs: number; openBugs: number } | null>(null);

  /* Fetch quality stats from API */
  useEffect(() => {
    qualityApi.getStats().then((data) => {
      setStats(data);
    }).catch(() => {});
  }, []);

  /* Fetch test cases from API */
  useEffect(() => {
    qualityApi.listCases().then((data) => {
      if (data && data.length > 0) {
        setCases(data.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          module: tc.module || "未分类",
          type: (tc.type === "functional" ? "单元" : tc.type === "performance" ? "性能" : tc.type === "integration" ? "集成" : "单元") as "单元" | "集成" | "UI" | "流程" | "性能",
          status: (tc.result === "passed" ? "passed" : tc.result === "failed" ? "failed" : tc.status === "completed" ? "passed" : "draft") as "passed" | "failed" | "running" | "skipped" | "draft",
          priority: (tc.priority === "high" ? "P0" : tc.priority === "medium" ? "P1" : "P2") as "P0" | "P1" | "P2",
          lastRun: tc.status === "completed" ? new Date(tc.updated_at).toLocaleDateString("zh-CN") : "未运行",
          duration: tc.duration ? `${(tc.duration / 1000).toFixed(1)}s` : "-",
        })));
      }
    }).catch(() => {});
  }, []);

  /* Fetch bugs from API */
  useEffect(() => {
    qualityApi.listBugs().then((data) => {
      if (data && data.length > 0) {
        setBugsData(data.map((b: any) => ({
          id: b.id.toUpperCase().replace("BUG-", "BUG-"),
          title: b.title,
          module: b.module || "未分类",
          severity: b.severity === "high" ? "P0" : b.severity === "medium" ? "P1" : "P2",
          status: b.status,
          assignee: b.assignee || "待分配",
          createdAt: new Date(b.created_at).toLocaleDateString("zh-CN"),
        })));
      }
    }).catch(() => {});
  }, []);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDashPrompt, setAiDashPrompt] = useState("");
  const [aiDashGenerating, setAiDashGenerating] = useState(false);
  const [aiDashGenerated, setAiDashGenerated] = useState(AI_GENERATED);
  const [aiDashError, setAiDashError] = useState<string | null>(null);

  async function handleDashAIGenerate() {
    if (!aiDashPrompt.trim()) return;
    setAiDashGenerating(true);
    setAiDashError(null);
    try {
      const response = await llmApi.chat([
        {
          role: "system",
          content: `你是一个测试用例生成专家。根据用户描述的对象、流程或页面，生成测试用例列表。
请以 JSON 数组格式返回，每个元素包含：
- name: 用例名称（字符串）
- type: 用例类型，从 "边界测试"、"流程测试"、"性能测试"、"功能测试"、"集成测试" 中选择
- confidence: 置信度 0-100 的数字

只返回 JSON 数组，不要包含其他文字。示例：
[{"name":"测试用例名称","type":"边界测试","confidence":90}]`,
        },
        { role: "user", content: aiDashPrompt },
      ], { temperature: 0.7, maxTokens: 1000 });

      const content = response.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setAiDashGenerated(parsed.map((item: { name?: string; type?: string; confidence?: number }) => ({
          name: item.name || "未命名用例",
          type: item.type || "功能测试",
          source: "AI 根据用户描述生成",
          confidence: item.confidence || 80,
        })));
      } else {
        setAiDashError("AI 返回格式无法解析，请重试");
      }
    } catch (e) {
      setAiDashError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setAiDashGenerating(false);
    }
  }

  const caseCount = stats?.totalCases ?? cases.length;
  const passedCount = stats?.passedCases ?? cases.filter((t) => t.status === "passed").length;
  const failedCount = stats?.failedCases ?? cases.filter((t) => t.status === "failed").length;
  const passRate = stats?.passRate ?? (caseCount > 0 ? ((passedCount / caseCount) * 100).toFixed(1) : "0");
  const bugCount = stats?.totalBugs ?? bugsData.length;

  async function handleAdoptFromAI(caseItem: { name: string; type: string }) {
    const mappedType = (caseItem.type.includes("边界") || caseItem.type.includes("单元") ? "单元" : caseItem.type.includes("流程") ? "流程" : caseItem.type.includes("性能") ? "性能" : "集成") as "单元" | "集成" | "UI" | "流程" | "性能";
    setCases((prev) => [...prev, {
      id: `t-adopt-${Date.now()}`,
      name: caseItem.name,
      module: "AI 生成",
      type: mappedType,
      status: "draft" as const,
      priority: "P1" as const,
      lastRun: "未运行",
      duration: "-",
    }]);
    try {
      await qualityApi.createCase({ name: caseItem.name, module: "AI 生成", type: mappedType === "单元" ? "functional" : mappedType === "性能" ? "performance" : "integration", priority: "medium" });
    } catch (e) { console.warn("Failed to persist AI case:", e); }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <TestTube className="size-5 text-primary" />
            质量中心
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            测试用例、缺陷跟踪、性能监控与 AI 自动生成
          </p>
        </div>
        <Button size="sm" onClick={() => setAiDialogOpen(true)}>
          <Sparkles className="size-3 mr-1" />
          AI 生成用例
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="用例总数" value={caseCount} icon={FlaskConical} />
        <StatCard label="通过率" value={`${passRate}%`} trend={2.1} icon={CheckCircle2} />
        <StatCard label="失败用例" value={failedCount} icon={XCircle} />
        <StatCard label="缺陷数" value={bugCount} icon={BarChart3} />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">概览</TabsTrigger>
          <TabsTrigger value="cases">测试用例</TabsTrigger>
          <TabsTrigger value="bugs">缺陷跟踪</TabsTrigger>
          <TabsTrigger value="perf">性能监控</TabsTrigger>
          <TabsTrigger value="perfTest">性能测试</TabsTrigger>
          <TabsTrigger value="security">安全扫描</TabsTrigger>
          <TabsTrigger value="ai">AI 生成</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube className="size-4" /> 单元测试
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">{stats?.passedCases ?? passedCount} / {stats?.totalCases ?? caseCount}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats?.passRate ?? passRate}% 通过</p>
              </CardContent>
            </Card>
            {/* TODO: needs backend API - per-category stats not available yet */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="size-4" /> AI UI 自动化
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">24 / 28</div>
                <p className="text-xs text-muted-foreground mt-1">85.7% 通过</p>
              </CardContent>
            </Card>
            {/* TODO: needs backend API - per-category stats not available yet */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4" /> 流程测试
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">12 / 12</div>
                <p className="text-xs text-muted-foreground mt-1">100% 通过</p>
              </CardContent>
            </Card>
          </div>
          <AIGenerateCases onAdopt={handleAdoptFromAI} />
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <TestCases />
        </TabsContent>

        <TabsContent value="bugs" className="mt-4">
          <BugTracker />
        </TabsContent>

        <TabsContent value="perf" className="mt-4">
          <PerfMonitor />
        </TabsContent>

        <TabsContent value="perfTest" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="size-4" /> 性能测试引擎
              </CardTitle>
              <CardDescription>配置并发用户、持续时间和目标端点</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>并发用户数</Label>
                  <Input type="number" defaultValue={100} />
                </div>
                <div className="space-y-2">
                  <Label>持续时间(秒)</Label>
                  <Input type="number" defaultValue={60} />
                </div>
                <div className="space-y-2">
                  <Label>目标端点</Label>
                  <Input defaultValue="/api/v1/process/start" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <Label>测试端点列表</Label>
                {["GET /api/v1/process/instances", "POST /api/v1/process/task/complete", "GET /api/v1/ontology/objects", "POST /api/v1/data/query"].map((ep) => (
                  <div key={ep} className="flex items-center gap-2 p-2 border rounded text-sm">
                    <Checkbox defaultChecked />
                    <span className="font-mono text-xs">{ep}</span>
                  </div>
                ))}
              </div>
              <Button><Play className="size-3 mr-1" /> 启动性能测试</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="size-4" /> 安全扫描
              </CardTitle>
              <CardDescription>OWASP Top 10 / SAST / DAST 安全扫描配置</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: "OWASP Top 10", desc: "检查 OWASP 十大安全漏洞", checked: true },
                    { name: "SAST (静态分析)", desc: "源代码安全扫描", checked: true },
                    { name: "DAST (动态分析)", desc: "运行时安全测试", checked: false },
                  ].map((opt) => (
                    <div key={opt.name} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox defaultChecked={opt.checked} />
                        <span className="font-medium text-sm">{opt.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>扫描目标 URL</Label>
                  <Input defaultValue="http://localhost:5173" />
                </div>
                <div className="space-y-2">
                  <Label>排除路径</Label>
                  <Input defaultValue="/static, /assets, /node_modules" />
                </div>
                <Button><Shield className="size-3 mr-1" /> 启动安全扫描</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <AIGenerateCases onAdopt={handleAdoptFromAI} />
        </TabsContent>
      </Tabs>

      {/* AI 生成用例对话框 (header button) */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> AI 自动生成测试用例
            </DialogTitle>
            <DialogDescription>描述对象 / 流程 / 页面，AI 自动推荐测试用例</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mb-2">
            <Input
              value={aiDashPrompt}
              onChange={(e) => setAiDashPrompt(e.target.value)}
              placeholder="如：客户对象的 CRUD 操作"
              onKeyDown={(e) => e.key === "Enter" && handleDashAIGenerate()}
              disabled={aiDashGenerating}
            />
            <Button size="sm" onClick={handleDashAIGenerate} disabled={aiDashGenerating || !aiDashPrompt.trim()}>
              {aiDashGenerating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            </Button>
          </div>
          {aiDashError && <div className="text-xs text-destructive mb-2">{aiDashError}</div>}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {aiDashGenerated.map((g, i) => (
              <div key={`${g.name}-${i}`} className="flex items-center gap-3 p-3 border rounded-lg">
                <Sparkles className="size-4 text-primary shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{g.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{g.type} · {g.source}</div>
                </div>
                <Badge variant="outline" className="text-xs">置信度 {g.confidence}%</Badge>
                <Button size="sm" variant="outline" onClick={() => {
                  handleAdoptFromAI({ name: g.name, type: g.type });
                  setAiDialogOpen(false);
                }}>
                  采纳
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>关闭</Button>
            <Button onClick={() => {
              aiDashGenerated.forEach((g) => handleAdoptFromAI({ name: g.name, type: g.type }));
              setAiDialogOpen(false);
            }}>
              <Sparkles className="size-3 mr-1" /> 全部采纳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────── OntologyTesting ─────────────────── */
// TODO: needs backend API - no ontology testing endpoint exists yet
const ONTOLOGY_TESTS = [
  { id: 1, name: "Customer 对象完整性", object: "Customer", checks: 18, passed: 17, failed: 1, status: "warning" },
  { id: 2, name: "Order 关系校验", object: "Order", checks: 12, passed: 12, failed: 0, status: "passed" },
  { id: 3, name: "Product 属性约束", object: "Product", checks: 16, passed: 16, failed: 0, status: "passed" },
  { id: 4, name: "Employee 权限验证", object: "Employee", checks: 8, passed: 6, failed: 2, status: "failed" },
  { id: 5, name: "Contract 规则引擎", object: "Contract", checks: 10, passed: 10, failed: 0, status: "passed" },
];

export function OntologyTesting() {
  const [tests, setTests] = useState(ONTOLOGY_TESTS);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    qualityApi.listOntologyTests()
      .then((data) => { if (data && data.length > 0) setTests(data); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  function runAll() {
    setRunning(true);
    setTimeout(() => setRunning(false), 2000);
  }

  const totalChecks = tests.reduce((s, t) => s + t.checks, 0);
  const totalPassed = tests.reduce((s, t) => s + t.passed, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="质量中心"
        description="自动验证本体对象、属性、关系和规则的完整性"
        action={<Button className="gap-2" onClick={runAll} disabled={running}>{running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {running ? "运行中..." : "运行全部"}</Button>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="测试对象" value={tests.length} icon={FlaskConical} />
        <StatCard label="检查项" value={totalChecks} icon={CheckCircle2} />
        <StatCard label="通过率" value={`${((totalPassed / totalChecks) * 100).toFixed(1)}%`} icon={BarChart3} />
        <StatCard label="失败项" value={totalChecks - totalPassed} icon={XCircle} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FlaskConical className="size-4" /> 本体测试套件</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>测试名</TableHead><TableHead>对象</TableHead><TableHead>检查项</TableHead><TableHead>通过</TableHead><TableHead>失败</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground">加载中...</TableCell></TableRow>}
              {tests.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="secondary">{t.object}</Badge></TableCell>
                  <TableCell>{t.checks}</TableCell>
                  <TableCell className="text-green-600">{t.passed}</TableCell>
                  <TableCell className={t.failed > 0 ? "text-red-500" : ""}>{t.failed}</TableCell>
                  <TableCell>{t.status === "passed" ? <Badge variant="secondary" className="text-green-600">通过</Badge> : t.status === "failed" ? <Badge variant="destructive">失败</Badge> : <Badge variant="outline" className="text-orange-500">警告</Badge>}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm"><Eye className="size-3 mr-1" />详情</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── AIUITesting ─────────────────── */
// TODO: needs backend API - no AI UI testing endpoint exists yet
const AI_UI_TESTS = [
  { id: 1, name: "登录页表单验证", page: "/login", steps: 5, status: "passed", duration: "3.2s" },
  { id: 2, name: "客户列表分页", page: "/customers", steps: 8, status: "passed", duration: "5.1s" },
  { id: 3, name: "订单创建流程", page: "/orders/new", steps: 12, status: "failed", duration: "8.4s" },
  { id: 4, name: "审批流页面渲染", page: "/approval", steps: 6, status: "passed", duration: "4.2s" },
  { id: 5, name: "报表大屏加载", page: "/dashboard", steps: 4, status: "running", duration: "..." },
];

export function AIUITesting() {
  const [uiTests, setUiTests] = useState(AI_UI_TESTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    qualityApi.listUITests()
      .then((data) => { if (data && data.length > 0) setUiTests(data); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="AI UI 测试" description="AI 驱动的 UI 自动化测试，自动识别页面元素并生成测试脚本" action={<Button className="gap-2"><Sparkles className="size-4" /> AI 生成用例</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="UI 测试数" value={uiTests.length} icon={Monitor} />
        <StatCard label="通过" value={uiTests.filter((t) => t.status === "passed").length} icon={CheckCircle2} />
        <StatCard label="失败" value={uiTests.filter((t) => t.status === "failed").length} icon={XCircle} />
        <StatCard label="覆盖率" value="85.7%" icon={BarChart3} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bot className="size-4" /> UI 测试用例</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>页面</TableHead><TableHead>步骤数</TableHead><TableHead>耗时</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">加载中...</TableCell></TableRow>}
              {uiTests.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.page}</TableCell>
                  <TableCell>{t.steps}</TableCell>
                  <TableCell className="text-xs">{t.duration}</TableCell>
                  <TableCell>{t.status === "passed" ? <Badge variant="secondary" className="text-green-600">通过</Badge> : t.status === "failed" ? <Badge variant="destructive">失败</Badge> : <Badge className="bg-blue-500">运行中</Badge>}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm"><Play className="size-3 mr-1" />运行</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── ProcessTesting ─────────────────── */
// TODO: needs backend API - no process testing endpoint exists yet
const PROCESS_TESTS = [
  { id: 1, name: "采购审批全流程", nodes: 5, coverage: 100, status: "passed", lastRun: "2 小时前" },
  { id: 2, name: "报销审批-超时升级", nodes: 7, coverage: 85, status: "passed", lastRun: "3 小时前" },
  { id: 3, name: "合同审批-并发测试", nodes: 4, coverage: 75, status: "failed", lastRun: "昨天" },
  { id: 4, name: "入职流程-异常分支", nodes: 8, coverage: 62, status: "warning", lastRun: "2 天前" },
];

export function ProcessTesting() {
  const [processTests, setProcessTests] = useState(PROCESS_TESTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    qualityApi.listProcessTests()
      .then((data) => { if (data && data.length > 0) setProcessTests(data); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="流程测试" description="端到端流程自动化测试与节点覆盖率分析" action={<Button className="gap-2"><Play className="size-4" /> 运行全部</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="流程测试数" value={processTests.length} icon={GitBranch} />
        <StatCard label="通过" value={processTests.filter((t) => t.status === "passed").length} icon={CheckCircle2} />
        <StatCard label="平均覆盖率" value="80.5%" icon={BarChart3} />
        <StatCard label="总节点" value={processTests.reduce((s, t) => s + t.nodes, 0)} icon={Activity} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><GitBranch className="size-4" /> 流程测试套件</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>节点数</TableHead><TableHead>覆盖率</TableHead><TableHead>状态</TableHead><TableHead>上次运行</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">加载中...</TableCell></TableRow>}
              {processTests.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.nodes}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><div className="flex-1 bg-muted rounded-full h-1.5"><div className="bg-primary rounded-full h-1.5" style={{ width: `${t.coverage}%` }} /></div><span className="text-xs">{t.coverage}%</span></div></TableCell>
                  <TableCell>{t.status === "passed" ? <Badge variant="secondary" className="text-green-600">通过</Badge> : t.status === "failed" ? <Badge variant="destructive">失败</Badge> : <Badge variant="outline" className="text-orange-500">警告</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.lastRun}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm"><Play className="size-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── AIBugFix ─────────────────── */
// TODO: needs backend API - no AI bug fix endpoint exists yet
const AI_FIXES = [
  { id: 1, bug: "BUG-1284", title: "客户详情页加载慢", suggestion: "添加分页加载 + 虚拟滚动", confidence: 92, status: "pending", effort: "低" },
  { id: 2, bug: "BUG-1283", title: "审批流加签功能不可用", suggestion: "修复加签节点类型判断逻辑", confidence: 88, status: "applied", effort: "中" },
  { id: 3, bug: "BUG-1281", title: "智能体回答错乱", suggestion: "添加语言检测中间件", confidence: 75, status: "pending", effort: "高" },
];

export function AIBugFix() {
  const [fixes, setFixes] = useState(AI_FIXES);
  const [loading, setLoading] = useState(true);
  function applyFix(id: number) { setFixes((prev) => prev.map((f) => f.id === id ? { ...f, status: "applied" } : f)); }

  useEffect(() => {
    qualityApi.listAIFixes()
      .then((data) => { if (data && data.length > 0) setFixes(data); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="AI Bug 修复" description="AI 分析缺陷根因并自动生成修复建议" action={<Button className="gap-2"><Sparkles className="size-4" /> AI 分析新缺陷</Button>} />
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" /> AI 修复建议</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="text-center py-4 text-muted-foreground">加载中...</div>}
          <div className="space-y-4">
            {fixes.map((f) => (
              <div key={f.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-xs">{f.bug}</Badge><span className="font-medium text-sm">{f.title}</span></div>
                    <p className="text-sm text-muted-foreground mt-2">建议: {f.suggestion}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">置信度 {f.confidence}%</Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>工作量: {f.effort}</span><span>状态: {f.status === "applied" ? "已应用" : "待处理"}</span></div>
                  {f.status === "pending" ? <Button size="sm" onClick={() => applyFix(f.id)}>应用修复</Button> : <Badge variant="secondary" className="text-green-600"><CheckCircle2 className="size-3 mr-1" />已应用</Badge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── TestReport ─────────────────── */
// TODO: needs backend API - no test report endpoint exists yet
export function TestReport() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    qualityApi.listReports()
      .then((data) => { if (data && data.length > 0) setReports(data); })
      .catch(() => { /* keep empty */ })
      .finally(() => setLoading(false));
  }, []);

  const fallbackReports = [
    { name: "每日回归测试报告", time: "今天 10:30" },
    { name: "v1.3 发版测试报告", time: "昨天 18:00" },
    { name: "性能测试报告", time: "2 天前" },
    { name: "安全扫描报告", time: "3 天前" },
  ];

  const displayReports = reports.length > 0 ? reports : fallbackReports;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="测试报告" description="生成和查看各类测试报告" action={<Button className="gap-2"><Download className="size-4" /> 导出报告</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="总用例数" value={73} icon={FlaskConical} />
        <StatCard label="通过率" value="91.8%" icon={CheckCircle2} />
        <StatCard label="缺陷数" value={5} icon={Bug} />
        <StatCard label="覆盖率" value="87.2%" icon={BarChart3} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">最新报告</CardTitle></CardHeader>
          <CardContent>
            {loading && <div className="text-center py-4 text-muted-foreground">加载中...</div>}
            <div className="space-y-3">
              {displayReports.map((r: any) => (
                <div key={r.name || r.id} className="flex items-center justify-between p-2 border rounded">
                  <div><div className="font-medium text-sm">{r.name || r.title}</div><div className="text-xs text-muted-foreground">{r.time || r.created_at || ""}</div></div>
                  <Button variant="ghost" size="sm"><Download className="size-3 mr-1" />下载</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">趋势分析</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { metric: "通过率趋势", value: "91.8%", trend: "+2.1%" },
                { metric: "缺陷密度", value: "0.68/KLOC", trend: "-0.12" },
                { metric: "回归时间", value: "18 分钟", trend: "-3min" },
                { metric: "AI 用例采纳率", value: "78%", trend: "+5%" },
              ].map((t) => (
                <div key={t.metric} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{t.metric}</span>
                  <div className="text-right"><span className="font-medium text-sm">{t.value}</span><span className="text-xs ml-2 text-green-600">{t.trend}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}