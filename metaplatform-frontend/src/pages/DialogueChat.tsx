import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  listSessions,
  createSession,
  getMessages,
  sendMessage,
  deleteSession,
} from "../api/dialogueApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ---- Types ---- */
interface Session {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  intent?: string;
  suggestedActions?: string[];
}

/* ---- Component ---- */
const DialogueChat: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  async function loadSessions() {
    try {
      const data = await listSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    }
  }

  async function loadMessages(sessionId: string) {
    setLoading(true);
    try {
      const data = await getMessages(sessionId);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewSession() {
    try {
      const session = await createSession("新对话");
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    } catch {
      /* silent */
    }
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || sending) return;

    if (!activeSessionId) {
      try {
        const session = await createSession(text.slice(0, 30));
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        setTimeout(() => doSend(session.id, text), 100);
      } catch {
        /* silent */
      }
      return;
    }

    doSend(activeSessionId, text);
  }

  async function doSend(sessionId: string, text: string) {
    const tempUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);
    setInputValue("");
    setSending(true);

    try {
      const reply = await sendMessage(sessionId, text);
      if (Array.isArray(reply)) {
        setMessages((prev) => [...prev, ...reply]);
      } else {
        setMessages((prev) => [...prev, reply]);
      }
      loadSessions();
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "发送失败，请稍后重试。",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    } catch {
      /* silent */
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestionClick(action: string) {
    setInputValue(action);
    inputRef.current?.focus();
  }

  function formatTime(ts: string) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar -- session list */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-3">
          <Button className="w-full" onClick={handleNewSession}>
            + 新建对话
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          {sessions.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              暂无对话
            </div>
          )}
          <div className="flex flex-col gap-1 p-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "relative group flex flex-col gap-0.5 px-3 py-2 rounded-md cursor-pointer transition-colors",
                  activeSessionId === s.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground/80"
                )}
                onClick={() => setActiveSessionId(s.id)}
              >
                <div className="text-sm font-medium pr-6 truncate">
                  {s.title || "未命名对话"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(s.updatedAt)}
                </div>
                <button
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-sm"
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  title="删除对话"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Center chat area */}
      <section className="flex-1 flex flex-col overflow-hidden">
        {!activeSessionId && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="text-5xl mb-4">[Chat]</div>
            <h3 className="text-lg font-medium text-foreground mb-2">AI 对话</h3>
            <p>选择或新建一个对话开始交流</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {loading && (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    加载中...
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.role === "assistant" && msg.intent && (
                        <span className="inline-block text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 mb-1">
                          {msg.intent}
                        </span>
                      )}
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      <div
                        className={cn(
                          "text-xs mt-1",
                          msg.role === "user"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                    {msg.role === "assistant" &&
                      msg.suggestedActions &&
                      msg.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {msg.suggestedActions.map((action, i) => (
                            <button
                              key={i}
                              className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent transition-colors"
                              onClick={() => handleSuggestionClick(action)}
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                      <div className="text-sm text-muted-foreground animate-pulse">
                        正在思考...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Bottom input bar */}
            <div className="border-t p-4">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <textarea
                  ref={inputRef}
                  className="flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  placeholder="输入消息，按 Enter 发送..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sending}
                  className="shrink-0"
                >
                  发送
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default DialogueChat;
