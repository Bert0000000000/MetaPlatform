import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { llmApi } from "@/lib/llm-api";
import {
  Bot, X, Send, Loader2, Sparkles, ChevronRight, User,
  MessageCircle, Minimize2, Maximize2, Zap, BookOpen,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
 * PageAgent: 页面内嵌的专属 Agent 智能体
 *
 * 每个 ontology 页面 (对象/属性/关系/...) 配置专属 Agent, 包含:
 *   - 名称 + 头像 emoji
 *   - 能力描述 (页面能帮什么)
 *   - 系统提示词 (送给 LLM 的 prompt)
 *   - 快速操作 (Quick Actions) — 按钮直接执行
 *   - 快捷指令 (Quick Prompts) — 一键发问
 *
 * 用户在页面内跟 Agent 对话, Agent 可以:
 *   1. 回答页面相关问题 (走 LLM API)
 *   2. 触发快速操作 (打开 Dialog, 调 API)
 *   3. 解释当前页面状态 (基于传入的 context 数据)
 *
 * 设计: 右侧浮出 panel, 不覆盖主内容, 可收起为右侧气泡按钮
 * ════════════════════════════════════════════════════════════════════ */

export interface PageAgentConfig {
  /** Agent 唯一 key, e.g. "ontology-objects" */
  id: string;
  /** 显示名, e.g. "对象建模助手" */
  name: string;
  /** emoji 头像 */
  avatar: string;
  /** 一句话能力描述, e.g. "帮你快速建模业务对象" */
  tagline: string;
  /** 详细能力列表, 显示在欢迎语里 */
  capabilities: string[];
  /** LLM 系统提示词 */
  systemPrompt: string;
  /** 快捷操作 — 显示为按钮, 点击后回调 */
  quickActions?: { label: string; icon?: string; onClick: () => void; variant?: "default" | "outline" }[];
  /** 快捷指令 — 显示为 chip, 点击发问 */
  quickPrompts: string[];
  /** 暖场色 (背景) */
  accentColor?: string;
}

export interface PageAgentPanelProps {
  config: PageAgentConfig;
  /** 实时页面数据, 送给 LLM 当 context */
  context?: Record<string, unknown>;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
  actions?: { label: string; onClick: () => void }[];
}

function formatTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function PageAgentPanel({ config, context }: PageAgentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef<string | null>(null);

  // 打开时暖场
  useEffect(() => {
    if (isOpen && initRef.current !== config.id) {
      initRef.current = config.id;
      const capList = config.capabilities.map((c) => `• ${c}`).join("\n");
      setMessages([
        {
          id: `init-${Date.now()}`,
          role: "assistant",
          content: `👋 你好！我是「${config.name}」${config.avatar}\n\n${config.tagline}\n\n我可以帮你:\n${capList}\n\n💡 点下面快捷指令, 或直接输入问题`,
          ts: formatTime(),
        },
      ]);
    }
  }, [isOpen, config]);

  // 滚动到底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // 打开聚焦输入
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isTyping) return;
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: content.trim(),
      ts: formatTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      // 把页面 context 摘要送进 system prompt (轻量, 不超 800 字符)
      const ctxStr = context
        ? `\n\n# 当前页面实时数据\n\`\`\`json\n${JSON.stringify(context, null, 2).slice(0, 1500)}\n\`\`\``
        : "";
      const reply = await llmApi.chat([
        { role: "system", content: config.systemPrompt + ctxStr },
        { role: "user", content: userMsg.content },
      ], { temperature: 0.7, maxTokens: 1024 });
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply.content,
        ts: formatTime(),
      }]);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: `⚠️ AI 调用失败：${reason}\n\n💡 你仍可以使用下方快捷操作, 或在【后台管理 → AI Gateway】配置 LLM。`,
        ts: formatTime(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [config, context, isTyping]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // 关闭态: 显示悬浮按钮 (页面右上角嵌入感)
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="gap-2 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30 hover:border-primary/50 hover:from-primary/10 hover:to-primary/20"
      >
        <span className="text-base leading-none">{config.avatar}</span>
        <Bot className="size-3.5" />
        <span className="font-medium text-xs">{config.name}</span>
        <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
      </Button>
    );
  }

  return (
    <div
      className={`fixed right-4 z-40 flex flex-col bg-card border rounded-xl shadow-2xl overflow-hidden transition-all ${
        isMinimized ? "bottom-4 w-[280px] h-[44px]" : "bottom-4 top-20 w-[400px]"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b shrink-0 text-white"
        style={{
          background: config.accentColor || "linear-gradient(135deg, #2563eb, #7c3aed)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{config.avatar}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{config.name}</div>
            {!isMinimized && (
              <div className="text-[10px] opacity-80 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-300 animate-pulse" />
                <span>在线 · {config.tagline}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-white hover:bg-white/20"
            onClick={() => setIsMinimized((v) => !v)}
          >
            {isMinimized ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-white hover:bg-white/20"
            onClick={() => setIsOpen(false)}
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* 能力标签 + 快捷操作 */}
          {messages.length <= 1 && (
            <div className="px-3 py-2.5 border-b bg-muted/30 shrink-0 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                <Zap className="size-3" />
                <span>快捷操作</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(config.quickActions || []).map((a, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={a.variant || "outline"}
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      a.onClick();
                      setMessages((prev) => [...prev, {
                        id: `act-${Date.now()}`,
                        role: "system",
                        content: `✓ 已执行: ${a.label}`,
                        ts: formatTime(),
                      }]);
                    }}
                  >
                    {a.icon && <span>{a.icon}</span>}
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-muted/20 to-muted/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {(msg.role === "assistant" || msg.role === "system") && (
                  <div
                    className={`size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm ${
                      msg.role === "system" ? "bg-muted" : "bg-primary/10"
                    }`}
                  >
                    {msg.role === "system" ? "⚙️" : config.avatar}
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : msg.role === "system"
                        ? "bg-muted/50 text-muted-foreground text-xs italic"
                        : "bg-card border shadow-sm"
                  }`}
                >
                  {msg.content}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.actions.map((act, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          onClick={act.onClick}
                        >
                          {act.label}
                        </Button>
                      ))}
                    </div>
                  )}
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
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm">
                  {config.avatar}
                </div>
                <div className="bg-card border rounded-lg px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="ml-1 text-xs text-muted-foreground">{config.name} 思考中</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 快捷指令 chips */}
          {messages.length <= 1 && config.quickPrompts.length > 0 && (
            <div className="px-3 py-2 border-t bg-background shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium mb-1.5">
                <BookOpen className="size-3" />
                <span>快捷提问</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {config.quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    className="text-[11px] px-2.5 py-1 rounded-full border bg-muted/30 hover:bg-muted hover:border-primary/30 whitespace-nowrap transition-colors shrink-0"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 输入区 */}
          <div className="px-3 py-2 border-t bg-background shrink-0">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`问 ${config.name} 任何问题...`}
                className="flex-1 h-9 text-sm"
                disabled={isTyping}
              />
              <Button
                size="icon"
                className="size-9 shrink-0"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
              >
                {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
