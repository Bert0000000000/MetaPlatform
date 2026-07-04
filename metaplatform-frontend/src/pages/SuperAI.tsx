import { useState, useRef, useEffect, useCallback } from "react";
import { agentsApi } from "@/lib/api";
import type { Agent } from "@/lib/api";
import { Send, Bot, User, Sparkles, Plus, MessageSquare, Bot as BotIcon, ListChecks, BookOpen, Smartphone, BarChart3, GitBranch, FileEdit, Search as SearchIcon, TrendingUp, RefreshCw, FileText, Ruler, Briefcase, ScrollText, Scale, Clock, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/* ── Icon resolver: API icon string → Lucide component ── */
const ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, TrendingUp, RefreshCw, FileText, Sparkles, MessageSquare,
  Bot, User, Smartphone, GitBranch, FileEdit, BookOpen,
};
function resolveAgentIcon(iconName?: string): React.ElementType {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  return Bot;
}

/* ─────────────────── Types ─────────────────── */
interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

/* ─────────────────── Initial messages ─────────────────── */
const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "你好，我是 SuperAI\n我可以帮你：\n- 建应用 / 建对象 / 建流程\n- 查数据 / 分析指标\n- 启动智能体 / 调度任务\n- 回答业务问题\n\n请告诉我你想做什么？",
  ts: formatTime(),
};

function formatTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

/* ─────────────────── Suggestions ─────────────────── */
const SUGGESTIONS = [
  { icon: Smartphone, text: "帮我建一个请假审批应用", category: "建应用" },
  { icon: BarChart3, text: "上个月的订单总额是多少？", category: "查数据" },
  { icon: GitBranch, text: "梳理采购流程并发现瓶颈", category: "流程分析" },
  { icon: Bot, text: "启动财务月结智能体", category: "智能体" },
  { icon: FileEdit, text: "起草一份客户拜访纪要", category: "内容生成" },
  { icon: SearchIcon, text: "从合同库中查找应收账款条款", category: "知识检索" },
];

/* ─────────────────── Mock task data ─────────────────── */
const RECENT_TASKS = [
  { id: 1, title: "生成客户分层标签", agent: "数据分析智能体", status: "completed", time: "2 分钟前", result: "生成 1,234 个客户标签" },
  { id: 2, title: "起草 2026 Q3 销售预测报告", agent: "财务分析智能体", status: "running", time: "进行中", result: "" },
  { id: 3, title: "解析上传的采购合同 PDF", agent: "合同审查智能体", status: "completed", time: "1 小时前", result: "提取 18 个关键条款" },
  { id: 4, title: "为「客户管理」应用生成 3 张报表", agent: "VibeCoding", status: "failed", time: "3 小时前", result: "权限不足" },
  { id: 5, title: "推荐本月最佳供应商", agent: "供应链智能体", status: "completed", time: "昨天", result: "Top 5 已排序" },
];

const KNOWLEDGE_DOCS = [
  { title: "MetaPlatform 用户手册", type: "PDF", size: "12.4 MB", updated: "今天", category: "产品文档", icon: BookOpen },
  { title: "API 接口规范 v2.1", type: "Markdown", size: "384 KB", updated: "3 天前", category: "技术规范", icon: Ruler },
  { title: "BPMN 2.0 节点参考", type: "Web", size: "—", updated: "1 周前", category: "标准规范", icon: Briefcase },
  { title: "销售话术库（已索引）", type: "向量库", size: "8.2K 条", updated: "实时", category: "业务知识", icon: ScrollText },
];

/* ─────────────────── Enhanced mock LLM ─────────────────── */
function sendMock(input: string): Promise<string> {
  return new Promise((resolve) => {
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      const lower = input.toLowerCase();

      if (lower.includes("建") || lower.includes("应用") || lower.includes("创建")) {
        resolve(
          "好的，我将引导你创建新应用。请确认：\n1. 应用类型（空白 / 模板 / AI 生成）\n2. 关联的数据源\n3. 业务范围（CRM/ERP/OA...）\n\n你可以点击下方「开始」直接进入新建应用向导。"
        );
        return;
      }
      if (lower.includes("订单") || lower.includes("数据") || lower.includes("查询") || lower.includes("多少")) {
        resolve(
          "上月订单总额为 ¥12,486,329，同比 +18.2%。\n- 华东区占比 42%\n- Top 3 客户贡献 35%\n- 环比增长最快品类：工业设备 (+32%)\n\n如需深度分析，请告诉我具体维度（产品/客户/区域）。"
        );
        return;
      }
      if (lower.includes("流程") || lower.includes("瓶颈") || lower.includes("审批") || lower.includes("优化")) {
        resolve(
          "已分析 5 个核心流程：\n- 采购审批：平均 4.2 天（瓶颈在法务环节）\n- 报销流程：平均 1.8 天（高效）\n- 合同审批：平均 7.5 天（需优化）\n- 请假申请：平均 0.5 天（优秀）\n- 订单到收款：平均 5.6 天（中等）\n\n建议优先优化合同审批的并行节点，预计可缩短 40% 周期。"
        );
        return;
      }
      if (lower.includes("报表") || lower.includes("报告") || lower.includes("可视化")) {
        resolve(
          "我可以为你生成以下报表：\n1. 销售业绩看板（实时）\n2. 客户分群分析（RFM）\n3. 供应链健康度报告\n4. 财务月度汇总\n\n请指定时间范围和关注的指标维度。"
        );
        return;
      }
      if (lower.includes("智能体") || lower.includes("agent") || lower.includes("启动")) {
        resolve(
          "当前可用的智能体：\n- 数据分析智能体（在线）\n- 流程分析智能体（在线）\n- 文档撰写智能体（在线）\n- VibeCoding 智能体（在线）\n- 客服智能体（忙碌）\n\n请指定你想启动的智能体，或告诉我需要完成什么任务，我会自动匹配。"
        );
        return;
      }
      if (lower.includes("你好") || lower.includes("hi") || lower.includes("hello") || lower.includes("嗨")) {
        resolve(
          "你好！很高兴见到你。我是 SuperAI，你的 AI 助手。\n\n我可以帮你：建应用、查数据、分析流程、生成内容、调度智能体。\n\n有什么我可以帮你的吗？"
        );
        return;
      }
      if (lower.includes("帮助") || lower.includes("help") || lower.includes("能做什么")) {
        resolve(
          "我是 SuperAI，可以帮你完成以下任务：\n\n1. **建应用** - 用自然语言描述，自动生成应用\n2. **查数据** - 查询业务数据和指标\n3. **分析流程** - 识别流程瓶颈并给优化建议\n4. **生成内容** - 起草合同、纪要、报告等\n5. **调度智能体** - 启动专业智能体执行任务\n6. **知识检索** - 从知识库中搜索信息\n\n请告诉我你想做什么？"
        );
        return;
      }

      // Default response
      resolve(
        "已收到你的请求。在 LLM Gateway 接入后，将由 GPT-4o / Claude / 文心等模型协同回答。\n\n我目前是 Mock 模式，可以模拟以下能力：\n- 建应用 / 查数据 / 分析流程\n- 生成内容 / 启动智能体 / 知识检索\n\n请试试输入关键词来体验！"
      );
    }, delay);
  });
}

/* ─────────────────── ChatTab ─────────────────── */
interface ChatTabProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  agentPrompt?: string | null;
  onAgentPromptConsumed?: () => void;
}

function ChatTab({ messages, setMessages, agentPrompt, onAgentPromptConsumed }: ChatTabProps) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* Handle agent prompt injection */
  useEffect(() => {
    if (agentPrompt) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: agentPrompt, ts: formatTime() },
      ]);
      onAgentPromptConsumed?.();
    }
  }, [agentPrompt, setMessages, onAgentPromptConsumed]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;

    const userMsg: Message = { role: "user", content, ts: formatTime() };
    setMessages((m) => [...m, userMsg]);
    if (!text) setInput("");
    setIsTyping(true);

    try {
      const reply = await sendMock(content);
      setMessages((m) => [...m, { role: "assistant", content: reply, ts: formatTime() }]);
    } finally {
      setIsTyping(false);
    }
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
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Bot className="size-4" />
              </div>
              <Card className="bg-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>SuperAI 正在思考...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t p-4 bg-background">
        <div className="mx-auto" style={{ maxWidth: "900px" }}>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-end gap-2">
                <textarea
                  className="flex-1 resize-none border-0 bg-transparent p-2 text-sm focus:outline-none placeholder:text-muted-foreground"
                  placeholder="问我任何问题...(按 Enter 发送，Shift+Enter 换行)"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={isTyping}
                />
                <Button onClick={() => send()} size="icon" aria-label="发送" disabled={isTyping}>
                  {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                <Sparkles className="size-3 text-primary shrink-0" />
                <span className="text-muted-foreground shrink-0">智能建议：</span>
                {SUGGESTIONS.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s.text)}
                    className="hover:underline text-foreground disabled:opacity-50"
                    disabled={isTyping}
                  >
                    <s.icon className="size-3 mr-1 inline" />{s.text}
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

/* ─────────────────── AgentTab ─────────────────── */
interface AgentTabProps {
  onActivateAgent: (prompt: string) => void;
}

/* 本地 fallback 智能体数据（API 不可用时） */
const FALLBACK_AGENTS = [
  { id: "data", name: "数据分析智能体", description: "查数据 / 出报表 / 发现异常", icon: "BarChart3", prompt: "你好，我已激活「数据分析智能体」，我可以帮你查询数据、生成报表、发现异常指标。请告诉我你想分析什么？" },
  { id: "report", name: "报表生成智能体", description: "自动编排 BI 报表", icon: "TrendingUp", prompt: "你好，我已激活「报表生成智能体」，我可以自动编排 BI 报表并可视化。请告诉我想生成什么报表？" },
  { id: "process", name: "流程分析智能体", description: "识别瓶颈 / 给出优化建议", icon: "RefreshCw", prompt: "你好，我已激活「流程分析智能体」，我可以识别流程瓶颈并给出优化建议。请告诉我想分析哪条流程？" },
  { id: "doc", name: "文档撰写智能体", description: "起草合同 / 会议纪要 / 周报", icon: "FileText", prompt: "你好，我已激活「文档撰写智能体」，我可以帮你起草合同、会议纪要、周报等文档。请告诉我想写什么？" },
  { id: "code", name: "VibeCoding 智能体", description: "自然语言生成完整应用", icon: "Sparkles", prompt: "你好，我已激活「VibeCoding 智能体」，我可以用自然语言帮你生成完整应用。请描述你想要的应用？" },
  { id: "support", name: "客服智能体", description: "7x24 答疑 / 工单预处理", icon: "MessageSquare", prompt: "你好，我已激活「客服智能体」，我可以 7x24 小时答疑并预处理工单。请问有什么可以帮你的？" },
];

interface AgentWithPrompt {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
}

function AgentTab({ onActivateAgent }: AgentTabProps) {
  const [agents, setAgents] = useState<AgentWithPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await agentsApi.list();
        if (!cancelled && data.length > 0) {
          // 将 API agent 映射为带 prompt 的本地格式
          const mapped = data.map((a: Agent) => ({
            id: a.id,
            name: a.name,
            description: a.description || a.type || "",
            icon: a.type || "Bot",
            prompt: `你好，我已激活「${a.name}」。${a.description || "请问有什么可以帮你的？"}`,
          }));
          setAgents(mapped);
        } else if (!cancelled) {
          setAgents(FALLBACK_AGENTS);
        }
      } catch {
        if (!cancelled) setAgents(FALLBACK_AGENTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold">智能体广场</h1>
          <p className="text-xs text-muted-foreground">SuperAI 内置 6 类业务智能体，可一键唤起</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> 加载智能体...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => {
              const Icon = resolveAgentIcon(a.icon);
              return (
                <Card key={a.id} className="hover:border-primary cursor-pointer transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Icon className="size-5" />
                      <Badge variant="secondary">内置</Badge>
                    </div>
                    <CardTitle className="text-sm mt-1">{a.name}</CardTitle>
                    <CardDescription>{a.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => onActivateAgent(a.prompt)}
                    >
                      <BotIcon className="size-3 mr-1" />
                      唤起
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
}

/* ─────────────────── TasksTab ─────────────────── */
function TasksTab() {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">智能体任务</h1>
          <p className="text-sm text-muted-foreground">SuperAI 调度的所有任务，含历史记录</p>
        </div>
        <Button size="sm" onClick={() => alert("新建任务功能开发中")}>
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

/* ─────────────────── KnowledgeTab ─────────────────── */
function KnowledgeTab() {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">知识中心</h1>
          <p className="text-sm text-muted-foreground">SuperAI 检索增强（RAG）的私有知识库</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => alert("接入向量库功能开发中")}>
            接入向量库
          </Button>
          <Button size="sm" onClick={() => alert("上传文档功能开发中")}>
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
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary cursor-pointer">
                <d.icon className="size-5 text-primary shrink-0" />
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

/* ─────────────────── History Sidebar ─────────────────── */
interface HistorySidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (conv: Conversation) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function HistorySidebar({ conversations, currentId, onSelect, onDelete, onClose }: HistorySidebarProps) {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l z-40 flex flex-col shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-sm">对话历史</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="size-8 mb-2" />
            <p className="text-sm">暂无历史对话</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                  conv.id === currentId ? "bg-muted border" : ""
                }`}
                onClick={() => onSelect(conv)}
              >
                <MessageSquare className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{conv.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {conv.messages.length} 条消息 · {conv.createdAt}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Main SuperAIPage ─────────────────── */
export function SuperAIPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [activeTab, setActiveTab] = useState("chat");
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);

  /* Save current conversation before switching */
  const saveCurrentConversation = useCallback(() => {
    if (messages.length <= 1) return; // Don't save empty conversations
    const title = messages.find((m) => m.role === "user")?.content.slice(0, 30) || "新对话";
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    if (currentConvId) {
      // Update existing
      setConversations((prev) =>
        prev.map((c) => (c.id === currentConvId ? { ...c, messages, title } : c))
      );
    } else {
      // Save as new
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        title,
        messages,
        createdAt: dateStr,
      };
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConvId(newConv.id);
    }
  }, [messages, currentConvId]);

  /* New conversation */
  function handleNewConversation() {
    saveCurrentConversation();
    setMessages([WELCOME_MESSAGE]);
    setCurrentConvId(null);
    setActiveTab("chat");
  }

  /* Select conversation from history */
  function handleSelectConversation(conv: Conversation) {
    // Save current first
    if (messages.length > 1) {
      saveCurrentConversation();
    }
    setMessages(conv.messages);
    setCurrentConvId(conv.id);
    setShowHistory(false);
    setActiveTab("chat");
  }

  /* Delete conversation */
  function handleDeleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === currentConvId) {
      setMessages([WELCOME_MESSAGE]);
      setCurrentConvId(null);
    }
  }

  /* Activate agent - switch to chat and inject prompt */
  function handleActivateAgent(prompt: string) {
    saveCurrentConversation();
    setMessages([WELCOME_MESSAGE]);
    setCurrentConvId(null);
    setAgentPrompt(prompt);
    setActiveTab("chat");
  }

  /* Agent prompt consumed callback */
  const handleAgentPromptConsumed = useCallback(() => {
    setAgentPrompt(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            SuperAI
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">AI 对话入口 · Cmd+K 全局唤起</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <Clock className="size-3 mr-1" />
            历史
            {conversations.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{conversations.length}</Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewConversation}>
            <Plus className="size-3 mr-1" />
            新对话
          </Button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
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
              <ChatTab
                messages={messages}
                setMessages={setMessages}
                agentPrompt={agentPrompt}
                onAgentPromptConsumed={handleAgentPromptConsumed}
              />
            </TabsContent>
            <TabsContent value="agent" className="flex-1 m-0 overflow-y-auto">
              <AgentTab onActivateAgent={handleActivateAgent} />
            </TabsContent>
            <TabsContent value="tasks" className="flex-1 m-0 overflow-y-auto">
              <TasksTab />
            </TabsContent>
            <TabsContent value="knowledge" className="flex-1 m-0 overflow-y-auto">
              <KnowledgeTab />
            </TabsContent>
          </Tabs>
        </div>

        {/* History sidebar */}
        {showHistory && (
          <HistorySidebar
            conversations={conversations}
            currentId={currentConvId}
            onSelect={handleSelectConversation}
            onDelete={handleDeleteConversation}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  );
}
