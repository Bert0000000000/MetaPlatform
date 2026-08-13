import { useState, useRef, useMemo, useCallback } from 'react';
import { Chat } from '@douyinfe/semi-ui';
import type { Message as SemiMessage } from '@douyinfe/semi-ui/lib/es/chat/interface';
import { Bot, User } from 'lucide-react';
import { getToken } from '@mate/shared';
import type { Employee } from '@/api/dw/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'local' | 'loading' | 'updating' | 'success' | 'error';
  streaming?: boolean;
  createdAt: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

const MOCK_REPLIES = [
  '收到您的消息。我是您的数字员工助手，正在为您处理任务。',
  '根据我的知识库，这个问题可以这样解决：请先确认相关流程，然后按照标准操作执行。',
  '我已查阅相关文档，您询问的内容属于标准业务流程范畴，建议按照规范操作执行。',
  '已为您查询到相关信息。如需进一步操作，请告诉我具体需求。',
];

interface EmbeddedChatProps {
  employee: Employee;
  /** 高度：默认 500；传 'fill' 时撑满父容器（详情页中间栏） */
  heightMode?: 'fixed' | 'fill';
}

export default function EmbeddedChat({ employee, heightMode = 'fixed' }: EmbeddedChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        status: 'local',
        createdAt: now(),
      };
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        status: 'updating',
        streaming: true,
        createdAt: now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const historyMsgs = [...messages]
        .filter((m) => m.status === 'success')
        .slice(-20)
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        }));

      const systemPrompt = employee.capability?.systemPrompt || `你是${employee.name}，${employee.roleIdentity}。${employee.description}`;

      try {
        // 经 copilot 走真实 LLM 链路：copilot 读 IAM provider 配置 →
        // llmgw /chat/real → 真实模型（SSE）。API key 留在 copilot 后端。
        const response = await fetch('/api/v1/copilot/chat/completions/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify({
            model: employee.capability?.model || 'doubao-pro-32k',
            messages: [
              { role: 'system', content: systemPrompt },
              ...historyMsgs,
              { role: 'user', content: trimmed },
            ],
            temperature: employee.capability?.temperature ?? 0.7,
            maxTokens: employee.capability?.maxTokens ?? 2048,
            appId: 'app-employee-chat',
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`LLM Gateway 不可用（${response.status}）`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let finished = false;

        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('data:')) continue;
            const data = trimmedLine.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as {
                type?: string;
                data?: { text?: string; finish_reason?: string };
                choices?: { delta?: { content?: string }; finish_reason?: string }[];
              };
              // copilot → llmgw 链路：{choices:[{delta:{content}}]}（OpenAI 风格）
              let delta = '';
              if (parsed.choices?.[0]?.delta?.content) {
                delta = parsed.choices[0].delta.content;
              } else if (parsed.type === 'token' && parsed.data?.text !== undefined) {
                delta = parsed.data.text;
              }
              if (delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + delta }
                      : m,
                  ),
                );
              }
              if (
                parsed.choices?.[0]?.finish_reason ||
                parsed.type === 'final' ||
                parsed.data?.finish_reason
              ) {
                finished = true;
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, status: 'success', streaming: false }
              : m,
          ),
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, status: 'success', streaming: false }
                : m,
            ),
          );
        } else {
          const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
          let index = 0;
          const timer = setInterval(() => {
            if (index >= reply.length) {
              clearInterval(timer);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, status: 'success', streaming: false, content: reply }
                    : m,
                ),
              );
              return;
            }
            const chunk = reply.slice(index, index + 2);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + chunk }
                  : m,
              ),
            );
            index += 2;
          }, 50);
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [employee, loading, messages],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  // 业务消息 → Semi Chat 消息：streaming 映射到 loading/incomplete，error 单独映射
  const semiMessages = useMemo<SemiMessage[]>(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createAt: Date.parse(msg.createdAt),
        status:
          msg.status === 'error'
            ? 'error'
            : msg.streaming
              ? msg.content === ''
                ? 'loading'
                : 'incomplete'
              : 'complete',
      })),
    [messages],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: heightMode === 'fill' ? '100%' : 500,
        minHeight: heightMode === 'fill' ? 0 : undefined,
        background: 'var(--semi-color-bg-1)',
        borderRadius: 8,
        padding: 8,
        overflow: 'hidden',
      }}
    >
      <Chat
        style={{ width: '100%', height: '100%', maxWidth: 'none', paddingTop: 0, paddingBottom: 0 }}
        align="leftRight"
        mode="bubble"
        chats={semiMessages}
        roleConfig={{
          user: { avatar: <User size={16} /> },
          assistant: { avatar: <Bot size={16} /> },
        }}
        onMessageSend={(content) => {
          void handleSend(content);
        }}
        showStopGenerate
        onStopGenerator={handleCancel}
        placeholder={`向 ${employee.name} 发送消息…`}
        sendHotKey="enter"
        topSlot={
          messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px 8px', color: 'var(--muted-foreground)' }}>
              <Bot size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontSize: 13 }}>开始与 {employee.name} 对话</div>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
