import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, Wand2, Sparkles, X } from "lucide-react";
import { llmApi } from "@/lib/llm-api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AICoPilotProps {
  pageType: string;
  pageName: string;
  onApplySuggestion?: (suggestion: any) => void;
  onClose?: () => void;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  form: "You are a form designer AI. Help build form pages with fields, validation rules, and layout. When the user asks to add a field, suggest the field type (text, number, date, select, etc.) and properties. Format suggestions as JSON.",
  list: "You are a list/table page designer AI. Help configure columns, filters, actions, and data binding for list pages. When asked to add columns or filters, format as JSON.",
  dashboard: "You are a dashboard/report designer AI. Help add chart widgets, KPI cards, and data visualizations. Format widget configurations as JSON.",
  workflow: "You are a workflow designer AI. Help design business processes with nodes, gateways, and connections. Format as BPMN-like JSON.",
  bi: "You are a BI and AI agent designer. Help create agents, training tasks, and analytics configurations.",
  lowcode:
    "You are a LowCode page builder AI. Help add components, configure layouts, and adjust styles. When the user asks to add a component, specify the component type, grid span, and properties.",
  ai: "You are an AI app builder. Help generate entire page structures from natural language descriptions.",
  default: "You are a page building assistant. Help design and configure page components and layouts.",
};

export function AICoPilot({ pageType, pageName, onApplySuggestion, onClose }: AICoPilotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `我是 AI 助手，正在帮你设计「${pageName}」页面（${pageType}类型）。你可以告诉我：\n\n• 添加一个搜索栏\n• 添加数据表格\n• 调整布局为两列\n• 添加图表组件\n• 生成页面框架`,
          timestamp: new Date(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = SYSTEM_PROMPTS[pageType] || SYSTEM_PROMPTS.default;
      const response = await llmApi.chat([
        { role: "system", content: systemPrompt },
        ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMsg.content },
      ]);
      const assistantMsg: Message = { role: "assistant", content: response, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "抱歉，AI 服务暂时不可用。请稍后再试。",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5">
          <Bot className="size-4 text-primary" />
          <span className="text-xs font-semibold">AI 助手</span>
          <Badge variant="secondary" className="text-xs py-0">
            Beta
          </Badge>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-0.5 hover:bg-muted rounded">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto scrollbar-none-x">
        {["生成页面框架", "添加搜索栏", "添加数据表格", "添加图表"].map((q) => (
          <button
            key={q}
            onClick={() => {
              setInput(q);
            }}
            className="shrink-0 px-2 py-1 text-xs border rounded-full hover:bg-primary/5 hover:border-primary/30 transition-colors"
          >
            <Wand2 className="size-2.5 inline mr-0.5" />
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" /> 思考中...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="描述你想要的页面..."
            className="h-8 text-xs"
            disabled={loading}
          />
          <Button
            size="icon"
            className="size-8 shrink-0"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
