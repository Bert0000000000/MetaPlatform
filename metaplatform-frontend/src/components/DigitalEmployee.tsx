import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { llmApi } from "@/lib/llm-api";
import { getAgentForPath } from "@/components/PageAgents";
import type { PageAgentConfig } from "@/components/PageAgents";
import {
  X, Send, Loader2, ChevronRight, User, MessageCircle,
  Minimize2, Maximize2, Zap, BookOpen, Phone, PhoneOff,
  CircleDot,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
 * DigitalEmployee: 数字员工 (全局右下角浮出)
 *
 * 跟之前 PageAgentPanel 的区别:
 *  1. 路由级别全局组件 (放在 Layout.tsx), 不是页面内
 *  2. 右下角浮出 + 圆头像 (不像胶囊按钮)
 *  3. 数字员工: 名字 + 工号 + 角色 + 性格 + 头像 (拟人化)
 *  4. 路由切换 → 自动换员工 + 打招呼
 *  5. 状态: 在线/忙碌/离线 (头像绿点)
 *  6. 可"呼叫" (拨出) 和"挂断" (收起)
 * ════════════════════════════════════════════════════════════════════ */

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

/** 数字员工头像 (两端半圆矩形 pill shape, 24/28/32/44/56px)
 *  - 不是纯圆, 是长方形两端半圆
 *  - 头像 emoji 居中, 在线点放右上
 *  - 宽 = 高 * 1.15, 圆角 = 高 / 2 (半圆)
 */
export function EmployeeAvatar({ avatar, size = 32, online = true, empId }: { avatar: string; size?: number; online?: boolean; empId?: string }) {
  const h = size;
  const w = Math.round(size * 1.15);
  return (
    <div
      className="relative bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center shrink-0"
      style={{
        width: `${w}px`,
        height: `${h}px`,
        borderRadius: `${h / 2}px`, // 两端半圆
        fontSize: Math.round(size * 0.5),
      }}
      title={empId ? `工号 ${empId}` : undefined}
    >
      <span style={{ lineHeight: 1 }}>{avatar}</span>
      {online && (
        <span
          className="absolute rounded-full bg-green-500 border-2 border-white dark:border-slate-800 animate-pulse"
          style={{
            width: Math.max(6, size * 0.28),
            height: Math.max(6, size * 0.28),
            top: -1,
            right: -1,
          }}
        />
      )}
    </div>
  );
}

/** 路由上下文: 给数字员工喂页面实时数据 */
function usePageContext(pathname: string): Record<string, unknown> {
  // 这里可以从 store / localStorage 读, 简化: 只返回 pathname 相关信息
  return {
    pathname,
    timestamp: new Date().toISOString(),
  };
}

export function DigitalEmployee() {
  const location = useLocation();
  const [employee, setEmployee] = useState<PageAgentConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [history, setHistory] = useState<Record<string, ChatMsg[]>>({}); // 按 empId 存历史
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const greetedRef = useRef<string | null>(null);

  // 路由变化 → 切数字员工 + 打招呼
  useEffect(() => {
    const next = getAgentForPath(location.pathname);
    if (!next) {
      setEmployee(null);
      return;
    }
    if (employee?.id !== next.id) {
      // 保存当前员工历史
      if (employee && messages.length > 0) {
        setHistory((h) => ({ ...h, [employee.id]: messages }));
      }
      // 切到新员工
      setEmployee(next);
      // 恢复历史 (若有)
      const past = history[next.id] || [];
      setMessages(past);
      // 首次见面打招呼
      if (greetedRef.current !== next.id) {
        greetedRef.current = next.id;
        const greeting: ChatMsg = {
          id: `greet-${Date.now()}`,
          role: "assistant",
          content: `你好！我是**${next.name}** ${next.avatar}，工号 ${next.empId}，${next.role}。\n\n💼 ${next.tagline}\n\n🧬 性格: ${next.personality.join(" · ")}\n\n📋 我能帮你:\n${next.capabilities.map((c) => `• ${c}`).join("\n")}\n\n随时呼叫我，或点下方快捷指令 ✨`,
          ts: formatTime(),
        };
        setMessages((prev) => [...prev, greeting]);
      }
    }
  }, [location.pathname, employee, history, messages]);

  // 滚动到底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // 打开聚焦
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isTyping || !employee) return;
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
      const ctx = usePageContext(location.pathname);
      const ctxStr = `\n\n# 当前页面实时数据\n\`\`\`json\n${JSON.stringify(ctx, null, 2).slice(0, 800)}\n\`\`\``;
      const reply = await llmApi.chat([
        {
          role: "system",
          content: `你是数字员工「${employee.name}」${employee.avatar}，工号 ${employee.empId}，${employee.role}。性格: ${employee.personality.join(", ")}。\n${employee.systemPrompt}` + ctxStr,
        },
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
  }, [employee, isTyping, location.pathname]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // 没有匹配的数字员工
  if (!employee) {
    return null;
  }

  // 关闭态: 右下角两端半圆矩形头像 + 名字标签
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3 group">
        {/* 名字悬浮标签 */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-card border rounded-full shadow-lg px-3 py-1.5 text-xs flex items-center gap-2 mb-1">
          <CircleDot className="size-2.5 text-green-500 animate-pulse" />
          <span className="font-medium">{employee.name}</span>
          <span className="text-muted-foreground text-[10px]">工号 {employee.empId}</span>
        </div>
        {/* 数字员工半圆矩形头像按钮 */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative group/btn flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 border-2 border-primary/20 hover:border-primary/50 shadow-lg hover:shadow-xl pl-1.5 pr-3 py-1.5 transition-all hover:scale-105"
          style={{
            borderRadius: "9999px", // pill
            height: "56px",
          }}
          title={`呼叫 ${employee.name}`}
        >
          <EmployeeAvatar avatar={employee.avatar} size={40} empId={employee.empId} />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs font-semibold leading-tight whitespace-nowrap">{employee.name}</span>
            <span className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">{employee.empId} · {employee.role}</span>
          </div>
        </button>
      </div>
    );
  }

  // 打开态: 浮出 panel
  return (
    <div className="fixed right-4 bottom-4 z-50">
      <div
        className={`flex flex-col bg-card border rounded-2xl shadow-2xl overflow-hidden transition-all ${
          isMinimized ? "w-[300px] h-[60px]" : "w-[400px] h-[560px]"
        }`}
      >
        {/* Header: 数字员工信息卡 */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b shrink-0 text-white relative"
          style={{
            background: employee.accentColor || "linear-gradient(135deg, #2563eb, #7c3aed)",
          }}
        >
          <EmployeeAvatar avatar={employee.avatar} size={44} empId={employee.empId} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm truncate">{employee.name}</span>
              <span className="text-[10px] opacity-70 font-mono shrink-0">{employee.empId}</span>
            </div>
            <div className="text-[10px] opacity-90 flex items-center gap-1 mt-0.5">
              <CircleDot className="size-2 animate-pulse" />
              <span className="truncate">{employee.role} · 在线</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white hover:bg-white/20"
              onClick={() => setIsMinimized((v) => !v)}
              title={isMinimized ? "展开" : "最小化"}
            >
              {isMinimized ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white hover:bg-white/20"
              onClick={() => {
                if (employee) setHistory((h) => ({ ...h, [employee.id]: messages }));
                setIsOpen(false);
              }}
              title="挂断 (隐藏)"
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* 性格标签条 */}
            <div className="px-3 py-2 border-b bg-muted/30 shrink-0 flex flex-wrap gap-1">
              {employee.personality.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 bg-background/60">
                  {p}
                </Badge>
              ))}
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 ml-auto">
                {employee.empId}
              </Badge>
            </div>

            {/* 消息区 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-muted/10 to-muted/30">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {(msg.role === "assistant" || msg.role === "system") && (
                    <EmployeeAvatar
                      avatar={msg.role === "system" ? "⚙️" : employee.avatar}
                      size={28}
                      online={msg.role === "assistant"}
                      empId={msg.role === "assistant" ? employee.empId : undefined}
                    />
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : msg.role === "system"
                          ? "bg-muted/50 text-muted-foreground text-xs italic"
                          : "bg-card border shadow-sm rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="size-3.5" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2 justify-start">
                  <EmployeeAvatar avatar={employee.avatar} size={28} empId={employee.empId} />
                  <div className="bg-card border rounded-2xl rounded-tl-sm px-3 py-2 text-sm shadow-sm">
                    <div className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                      <span className="ml-1.5 text-xs text-muted-foreground">{employee.name} 正在思考...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 快捷指令 chips */}
            {messages.length <= 1 && employee.quickPrompts.length > 0 && (
              <div className="px-3 py-2 border-t bg-background shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium mb-1.5">
                  <BookOpen className="size-3" />
                  <span>快捷提问</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {employee.quickPrompts.map((p, i) => (
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
                  placeholder={`@${employee.name} ...`}
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
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                <span>💬 {messages.length - 1} 条对话</span>
                <span>🔒 仅本机</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
