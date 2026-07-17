import { useState, useRef, useMemo, useCallback } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { Typography, Space, Tag, theme } from 'antd';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import { getToken, getUser } from '@/utils/auth';
import type { Employee } from '@/types';

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
}

export default function EmbeddedChat({ employee }: EmbeddedChatProps) {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
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
      setInput('');

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
        const response = await fetch('/api/v1/llmgw/chat/completions/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify({
            model: employee.capability?.model || 'doubao-pro',
            messages: [
              { role: 'system', content: systemPrompt },
              ...historyMsgs,
              { role: 'user', content: trimmed },
            ],
            temperature: employee.capability?.temperature ?? 0.7,
            maxTokens: employee.capability?.maxTokens ?? 2048,
            user: getUser()?.id,
            appId: `app-dw-${employee.employeeId}`,
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
              const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string }; finishReason?: string | null }> };
              if (parsed.choices?.[0]?.delta?.content !== undefined) {
                const delta = parsed.choices[0].delta.content || '';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + delta }
                      : m,
                  ),
                );
              }
              if (parsed.choices?.[0]?.finishReason) {
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

  const bubbleItems = useMemo(
    () =>
      messages.map((msg) => {
        const isUser = msg.role === 'user';
        return {
          key: msg.id,
          role: isUser ? ('user' as const) : ('ai' as const),
          status: msg.status,
          placement: isUser ? ('end' as const) : ('start' as const),
          streaming: msg.streaming,
          loading: msg.status === 'loading',
          content: <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>,
        };
      }),
    [messages],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 500 }}>
      <div style={{ marginBottom: 8 }}>
        <Space>
          <Typography.Text strong>与 {employee.name} 对话</Typography.Text>
          <Tag color="blue">{employee.roleIdentity}</Tag>
        </Space>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: colorBgContainer, padding: 12, borderRadius: 8, overflow: 'auto' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: '#999' }}>
            <RobotOutlined style={{ fontSize: 40, marginBottom: 12 }} />
            <div>开始与 {employee.name} 对话</div>
          </div>
        ) : (
          <Bubble.List
            items={bubbleItems}
            autoScroll
            role={{
              ai: { placement: 'start', avatar: <RobotOutlined /> },
              user: { placement: 'end', avatar: <UserOutlined /> },
            }}
          />
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <Sender
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          loading={loading}
          onCancel={handleCancel}
          placeholder={`向 ${employee.name} 发送消息...`}
          autoSize={{ minRows: 1, maxRows: 4 }}
        />
      </div>
    </div>
  );
}
