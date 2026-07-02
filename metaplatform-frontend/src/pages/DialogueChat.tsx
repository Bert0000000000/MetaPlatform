import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  listSessions,
  createSession,
  getMessages,
  sendMessage,
  deleteSession,
} from "../api/dialogueApi";

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

  /* Scroll to bottom on new messages */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* Load sessions on mount */
  useEffect(() => {
    loadSessions();
  }, []);

  /* Load messages when active session changes */
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
        // will send after session is created — defer to next tick
        setTimeout(() => doSend(session.id, text), 100);
      } catch {
        /* silent */
      }
      return;
    }

    doSend(activeSessionId, text);
  }

  async function doSend(sessionId: string, text: string) {
    // Optimistic user message
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
      // reply could be single message or array
      if (Array.isArray(reply)) {
        setMessages((prev) => [...prev, ...reply]);
      } else {
        setMessages((prev) => [...prev, reply]);
      }
      // Refresh sessions to update title/time
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
    <div className="mp-chat">
      {/* Left sidebar — session list */}
      <aside className="mp-chat-sidebar">
        <div className="mp-chat-sidebar-header">
          <button className="mp-btn mp-btn-primary" onClick={handleNewSession}>
            + 新建对话
          </button>
        </div>
        <div className="mp-chat-session-list">
          {sessions.length === 0 && (
            <div className="mp-empty-hint">暂无对话</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`mp-chat-session-item${activeSessionId === s.id ? " active" : ""}`}
              onClick={() => setActiveSessionId(s.id)}
            >
              <div className="mp-chat-session-title">{s.title || "未命名对话"}</div>
              <div className="mp-chat-session-time">{formatTime(s.updatedAt)}</div>
              <button
                className="mp-chat-session-delete"
                onClick={(e) => handleDeleteSession(e, s.id)}
                title="删除对话"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Center chat area */}
      <section className="mp-chat-main">
        {!activeSessionId && messages.length === 0 ? (
          <div className="mp-chat-empty">
            <div className="mp-chat-empty-icon">💬</div>
            <h3>AI 对话</h3>
            <p>选择或新建一个对话开始交流</p>
          </div>
        ) : (
          <>
            <div className="mp-chat-messages">
              {loading && <div className="mp-loading">加载中...</div>}
              {messages.map((msg) => (
                <div key={msg.id} className={`mp-chat-message ${msg.role}`}>
                  <div className="mp-chat-message-bubble">
                    {msg.role === "assistant" && msg.intent && (
                      <span className="mp-chat-intent-badge">{msg.intent}</span>
                    )}
                    <div className="mp-chat-message-content">{msg.content}</div>
                    <div className="mp-chat-message-time">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                  {msg.role === "assistant" &&
                    msg.suggestedActions &&
                    msg.suggestedActions.length > 0 && (
                      <div className="mp-chat-suggestions">
                        {msg.suggestedActions.map((action, i) => (
                          <button
                            key={i}
                            className="mp-chat-suggestion-chip"
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
                <div className="mp-chat-message assistant">
                  <div className="mp-chat-message-bubble">
                    <div className="mp-chat-message-content mp-chat-typing">
                      正在思考...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom input bar */}
            <div className="mp-chat-input">
              <textarea
                ref={inputRef}
                className="mp-chat-input-field"
                placeholder="输入消息，按 Enter 发送..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="mp-btn mp-btn-primary mp-chat-send-btn"
                onClick={handleSend}
                disabled={!inputValue.trim() || sending}
              >
                发送
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default DialogueChat;
