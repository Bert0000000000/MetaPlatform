import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { llmApi } from "@/lib/llm-api";
import {
  MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, Loader2, GripVertical,
} from "lucide-react";

/* ── Route → page context mapping ── */
const PAGE_CONTEXT_MAP: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "工作台", description: "角色化仪表盘，展示应用、消息、智能体概览" },
  "/dashboard/portal": { title: "企业门户", description: "统一入口，快速访问全部应用和待办" },
  "/dashboard/myapps": { title: "我的应用", description: "用户创建和使用的应用列表" },
  "/dashboard/myagents": { title: "我的数字员工", description: "分配给当前用户的 AI 数字员工" },
  "/dashboard/messages": { title: "消息中心", description: "系统通知、审批提醒和团队消息" },
  "/dashboard/freepage": { title: "自由页面", description: "灵活创建自定义页面，支持拖拽布局" },
  "/superai": { title: "SuperAI", description: "AI 对话助手，支持建应用、查数据、分析流程" },
  "/apps": { title: "应用中心", description: "管理和创建业务应用" },
  "/process": { title: "流程中心", description: "业务流程设计、审批和编排" },
  "/ontology": { title: "本体引擎", description: "管理业务对象、属性和关系" },
  "/data": { title: "数据中心", description: "数据源管理、指标中心和数据分析" },
  "/knowledge": { title: "知识库", description: "知识文档管理和智能检索" },
  "/agents": { title: "数字员工中心", description: "智能体管理、监控和协作" },
  "/market": { title: "云市场", description: "模板、插件和技能市场" },
  "/quality": { title: "质量中心", description: "测试用例、Bug 追踪和性能监控" },
  "/architecture": { title: "架构中心", description: "企业架构全景，业务/应用/数据/技术四域" },
  "/architecture/business": { title: "业务架构", description: "价值链、业务能力、流程、角色、事件、对象" },
  "/architecture/application": { title: "应用架构", description: "应用全景、依赖关系和跨应用映射" },
  "/architecture/data": { title: "数据架构", description: "数据域、数据模型和湖仓分布" },
  "/architecture/tech": { title: "技术架构", description: "技术栈、部署拓扑和服务依赖" },
  "/admin": { title: "后台管理", description: "用户、角色、权限和系统配置" },
};

function getPageContext(pathname: string): { title: string; description: string } {
  // Try exact match first
  if (PAGE_CONTEXT_MAP[pathname]) return PAGE_CONTEXT_MAP[pathname];
  // Try prefix match (longest first)
  const sorted = Object.keys(PAGE_CONTEXT_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (pathname.startsWith(prefix)) return PAGE_CONTEXT_MAP[prefix];
  }
  return { title: "MetaPlatform", description: "企业级低代码 AI 平台" };
}

/* ── Real AI response via LLM API ── */
async function getAIReply(question: string, context: { title: string; description: string }): Promise<string> {
  try {
    // Don't pin a model — backend falls back to whatever the operator
    // saved in [后台管理 → AI Gateway 配置] (llm_model in system_config).
    // Hard-coding "gpt-4o-mini" was shadowing Qwen / DeepSeek / etc.
    const response = await llmApi.chat([
      { role: "system", content: `你是「${context.title}」页面的AI助手。${context.description}。请用中文简洁回答用户问题。` },
      { role: "user", content: question }
    ], { temperature: 0.7, maxTokens: 512 });
    return response.content;
  } catch (err) {
    // Surface the underlying failure to the user instead of swallowing it
    // into a generic "service unavailable". Helps the operator diagnose
    // whether it's a missing API key, a wrong model name, or a network
    // problem from [后台管理 → AI Gateway 配置].
    const reason = err instanceof Error ? err.message : String(err);
    return `我是页面助手，当前页面是「${context.title}」。${context.description}\n\nAI 调用失败：${reason}\n\n（提示：可在【后台管理 → AI Gateway 配置】中把 Base URL 改成 mock://... 进入 Mock 模式试一下，或填入真实的 Provider 信息。）`;
  }
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

function formatTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

export function PageAIAssistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const context = getPageContext(location.pathname);

  /* Initialize welcome message when opened */
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `你好！我是「${context.title}」的页面助手。\n\n${context.description}\n\n有什么我能帮你的？`,
          ts: formatTime(),
        },
      ]);
    }
  }, [isOpen, context.title, context.description, messages.length]);

  /* Update context message when route changes */
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `已切换到「${context.title}」页面。\n${context.description}\n\n有什么需要帮助的？`,
          ts: formatTime(),
        },
      ]);
    }
    // Only on pathname change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* Focus input when opened */
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  async function handleSend() {
    if (!input.trim() || isTyping) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim(), ts: formatTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const reply = await getAIReply(userMsg.content, context);
      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: formatTime() }]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /* Closed state: just the floating button */
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center group"
        title="页面 AI 助手"
      >
        <MessageCircle className="size-6" />
        <span className="absolute -top-1 -right-1 size-3 rounded-full bg-green-400 animate-pulse" />
      </button>
    );
  }

  /* Minimized state */
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-card border rounded-full shadow-lg px-4 py-2">
        <Bot className="size-4 text-primary" />
        <span className="text-sm font-medium">{context.title} 助手</span>
        <Button variant="ghost" size="icon" className="size-6" onClick={() => setIsMinimized(false)}>
          <Maximize2 className="size-3" />
        </Button>
        <Button variant="ghost" size="icon" className="size-6" onClick={() => { setIsOpen(false); setMessages([]); }}>
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  /* Full chat dialog */
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] flex flex-col bg-card border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="size-4" />
          <span className="font-medium text-sm">{context.title} - AI 助手</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-6 text-primary-foreground hover:text-primary-foreground/80" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-primary-foreground hover:text-primary-foreground/80" onClick={() => { setIsOpen(false); setMessages([]); }}>
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="size-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="size-3.5" />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2 justify-start">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="size-3.5 text-primary" />
            </div>
            <div className="bg-card border rounded-lg px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-3 py-2 border-t bg-background flex gap-2 overflow-x-auto shrink-0">
          {["这个页面有什么功能？", "怎么使用？", "遇到问题怎么办"].map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="text-xs px-2.5 py-1 rounded-full border bg-muted/50 hover:bg-muted whitespace-nowrap transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`询问关于「${context.title}」的问题...`}
            className="flex-1 h-9 text-sm"
            disabled={isTyping}
          />
          <Button
            size="icon"
            className="size-9 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
          >
            {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
