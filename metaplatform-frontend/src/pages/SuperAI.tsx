import { useState } from "react";
import { Send, Bot, User, Sparkles, Plus, MessageSquare, Bot as BotIcon, ListChecks, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "你好，我是 SuperAI 🤖\n我可以帮你：\n• 建应用 / 建对象 / 建流程\n• 查数据 / 分析指标\n• 启动智能体 / 调度任务\n• 回答业务问题\n\n请告诉我你想做什么？",
    ts: "09:30",
  },
];

const SUGGESTIONS = [
  { icon: "📱", text: "帮我建一个请假审批应用", category: "建应用" },
  { icon: "📊", text: "上个月的订单总额是多少？", category: "查数据" },
  { icon: "🔄", text: "梳理采购流程并发现瓶颈", category: "流程分析" },
  { icon: "🤖", text: "启动财务月结智能体", category: "智能体" },
  { icon: "📝", text: "起草一份客户拜访纪要", category: "内容生成" },
  { icon: "🔍", text: "从合同库中查找应收账款条款", category: "知识检索" },
];

const RECENT_TASKS = [
  { id: 1, title: "生成客户分层标签", agent: "数据分析智能体", status: "completed", time: "2 分钟前", result: "生成 1,234 个客户标签" },
  { id: 2, title: "起草 2026 Q3 销售预测报告", agent: "财务分析智能体", status: "running", time: "进行中", result: "" },
  { id: 3, title: "解析上传的采购合同 PDF", agent: "合同审查智能体", status: "completed", time: "1 小时前", result: "提取 18 个关键条款" },
  { id: 4, title: "为「客户管理」应用生成 3 张报表", agent: "VibeCoding", status: "failed", time: "3 小时前", result: "权限不足" },
  { id: 5, title: "推荐本月最佳供应商", agent: "供应链智能体", status: "completed", time: "昨天", result: "Top 5 已排序" },
];

const KNOWLEDGE_DOCS = [
  { title: "MetaPlatform 用户手册", type: "PDF", size: "12.4 MB", updated: "今天", category: "产品文档" },
  { title: "API 接口规范 v2.1", type: "Markdown", size: "384 KB", updated: "3 天前", category: "技术规范" },
  { title: "BPMN 2.0 节点参考", type: "Web", size: "—", updated: "1 周前", category: "标准规范" },
  { title: "销售话术库（已索引）", type: "向量库", size: "8.2K 条", updated: "实时", category: "业务知识" },
];

function sendMock(input: string): string {
  if (input.includes("建") || input.includes("应用")) {
    return "好的，我将引导你创建新应用。请确认：\n1. 应用类型（空白 / 模板 / AI 生成）\n2. 关联的数据源\n3. 业务范围（CRM/ERP/OA...）\n\n你可以点击下方「开始」直接进入新建应用向导。";
  }
  if (input.includes("订单") || input.includes("数据")) {
    return "上月订单总额为 ¥12,486,329，同比 +18.2%。\n• 华东区占比 42%\n• Top 3 客户贡献 35%\n\n如需深度分析，请告诉我具体维度（产品/客户/区域）。";
  }
  if (input.includes("流程") || input.includes("瓶颈")) {
    return "已分析 5 个核心流程：\n• 采购审批：平均 4.2 天（瓶颈在法务环节）\n• 报销流程：平均 1.8 天（高效）\n• 合同审批：平均 7.5 天（需优化）\n\n建议优先优化合同审批的并行节点。";
  }
  return "已收到你的请求。在 LLM Gateway 接入后，将由 GPT-4o / Claude / 文心等模型协同回答。\n\n我目前是 Mock 模式，可以模拟以下能力：建应用、查数据、分析流程、生成内容。";
}

function ChatTab() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content) return;
    setMessages((m) => [
      ...m,
      { role: "user", content, ts: "现在" },
      { role: "assistant", content: sendMock(content), ts: "现在" },
    ]);
    if (!text) setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex flex-col gap-4" style={{ maxWidth: "900px" }}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot className="size-4" />
                </div>
              )}
              <div className={`max-w-[70%] flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <Card className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}>
                  <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  </CardContent>
                </Card>
                {m.ts && <span className="text-xs text-muted-foreground mt-1">{m.ts}</span>}
              </div>
              {m.role === "user" && (
                <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t p-4 bg-background">
        <div className="mx-auto" style={{ maxWidth: "900px" }}>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-end gap-2">
                <textarea
                  className="flex-1 resize-none border-0 bg-transparent p-2 text-sm focus:outline-none placeholder:text-muted-foreground"
                  placeholder="问我任何问题…（按 Enter 发送，Shift+Enter 换行）"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button onClick={() => send()} size="icon" aria-label="发送">
                  <Send className="size-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                <Sparkles className="size-3 text-primary shrink-0" />
                <span className="text-muted-foreground shrink-0">智能建议：</span>
                {SUGGESTIONS.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s.text)}
                    className="hover:underline text-foreground"
                  >
                    {s.icon} {s.text}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AgentTab() {
  const AGENTS = [
    { id: "data", name: "数据分析智能体", desc: "查数据 / 出报表 / 发现异常", icon: "📊" },
    { id: "report", name: "报表生成智能体", desc: "自动编排 BI 报表", icon: "📈" },
    { id: "process", name: "流程分析智能体", desc: "识别瓶颈 / 给出优化建议", icon: "🔄" },
    { id: "doc", name: "文档撰写智能体", desc: "起草合同 / 会议纪要 / 周报", icon: "📝" },
    { id: "code", name: "VibeCoding 智能体", desc: "自然语言生成完整应用", icon: "✨" },
    { id: "support", name: "客服智能体", desc: "7×24 答疑 / 工单预处理", icon: "💬" },
  ];
  return (
    <div className="p-4 flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold">智能体广场</h1>
        <p className="text-xs text-muted-foreground">SuperAI 内置 6 类业务智能体，可一键唤起</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENTS.map((a) => (
          <Card key={a.id} className="hover:border-primary cursor-pointer transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <span className="text-xl">{a.icon}</span>
                <Badge variant="secondary">内置</Badge>
              </div>
              <CardTitle className="text-sm mt-1">{a.name}</CardTitle>
              <CardDescription>{a.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" className="w-full">
                <BotIcon className="size-3 mr-1" />
                唤起
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TasksTab() {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">智能体任务</h1>
          <p className="text-sm text-muted-foreground">SuperAI 调度的所有任务，含历史记录</p>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          新建任务
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">任务</th>
                <th className="px-4 py-2 font-medium">智能体</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">结果</th>
                <th className="px-4 py-2 font-medium text-right">时间</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_TASKS.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.agent}</td>
                  <td className="px-4 py-3">
                    {t.status === "completed" && <Badge variant="secondary" className="text-green-600">已完成</Badge>}
                    {t.status === "running" && <Badge className="bg-blue-500">进行中</Badge>}
                    {t.status === "failed" && <Badge variant="destructive">失败</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{t.result || "—"}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KnowledgeTab() {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">知识中心</h1>
          <p className="text-sm text-muted-foreground">SuperAI 检索增强（RAG）的私有知识库</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            接入向量库
          </Button>
          <Button size="sm">
            <Plus className="size-3 mr-1" />
            上传文档
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">126</div>
            <div className="text-xs text-muted-foreground">文档总数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">8,492</div>
            <div className="text-xs text-muted-foreground">已索引片段</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">12</div>
            <div className="text-xs text-muted-foreground">数据源</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xl font-bold">98.2%</div>
            <div className="text-xs text-muted-foreground">检索准确率</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已接入的知识源</CardTitle>
          <CardDescription>支持文档上传、网页抓取、数据库同步、API 接入</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KNOWLEDGE_DOCS.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary">
                <BookOpen className="size-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {d.category} · {d.type} · {d.size} · 更新于 {d.updated}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SuperAIPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            SuperAI
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">AI 对话入口 · ⌘K 全局唤起</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            历史
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="size-3 mr-1" />
            新对话
          </Button>
        </div>
      </div>
      <Tabs defaultValue="chat" className="flex flex-col flex-1">
        <div className="border-b bg-background px-6">
          <TabsList className="h-11 bg-transparent">
            <TabsTrigger value="chat" className="gap-1.5 data-[state=active]:bg-primary/10">
              <MessageSquare className="size-3.5" /> 对话
            </TabsTrigger>
            <TabsTrigger value="agent" className="gap-1.5 data-[state=active]:bg-primary/10">
              <Bot className="size-3.5" /> 智能体
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 data-[state=active]:bg-primary/10">
              <ListChecks className="size-3.5" /> 任务
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-1.5 data-[state=active]:bg-primary/10">
              <BookOpen className="size-3.5" /> 知识中心
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
          <ChatTab />
        </TabsContent>
        <TabsContent value="agent" className="flex-1 m-0 overflow-y-auto">
          <AgentTab />
        </TabsContent>
        <TabsContent value="tasks" className="flex-1 m-0 overflow-y-auto">
          <TasksTab />
        </TabsContent>
        <TabsContent value="knowledge" className="flex-1 m-0 overflow-y-auto">
          <KnowledgeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}