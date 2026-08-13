import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AIChatDialogue,
  AIChatInput,
  Avatar,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import type { Message as SemiMessage } from '@douyinfe/semi-ui/lib/es/aiChatDialogue/interface';
import { Bot, Sparkles, User as UserIcon } from 'lucide-react';
import { getToken } from '@mate/shared';
import type { Employee } from '@/api/dw/types';
import {
  appendEmployeeMessage,
  createEmployeeConversation,
  listEmployeeConversations,
  listEmployeeMessages,
  type EmployeeMessage,
} from '@/api/dw/employee-conversations';

const WELCOME_HINTS = [
  '介绍一下你的能力',
  '帮我写一条 SQL',
  '总结最近一次执行',
];

function extractPlainText(contents: Array<{ type: string; [key: string]: unknown }> | undefined): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string') { parts.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj.text === 'string') parts.push(obj.text);
      if (obj.content != null) walk(obj.content);
    }
  };
  walk(contents ?? []);
  return parts.join('');
}

const MOCK_REPLIES = [
  '收到您的消息。我是您的数字员工助手，正在为您处理任务。',
  '根据我的知识库，这个问题可以这样解决：请先确认相关流程，然后按照标准操作执行。',
  '我已查阅相关文档，您询问的内容属于标准业务流程范畴，建议按照规范操作执行。',
  '已为您查询到相关信息。如需进一步操作，请告诉我具体需求。',
];

interface EmbeddedChatProps {
  employee: Employee;
  heightMode?: 'fixed' | 'fill';
}

const STORAGE_PREFIX = 'dwe-conv:';

function readStoredConv(empId: string): string | null {
  try { return localStorage.getItem(STORAGE_PREFIX + empId); } catch { return null; }
}
function writeStoredConv(empId: string, convId: string) {
  try { localStorage.setItem(STORAGE_PREFIX + empId, convId); } catch { /* ignore */ }
}

export default function EmbeddedChat({ employee, heightMode = 'fixed' }: EmbeddedChatProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmployeeMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 进入页面：恢复 / 加载 / 自动创建会话
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      setError(null);
      try {
        // 优先使用 localStorage 缓存的会话 id（session 内稳定）
        const stored = readStoredConv(employee.employeeId);
        let target: string | null = null;
        if (stored) {
          // 验证会话仍存在（404 则 fallback 创建新会话）
          try {
            await listEmployeeMessages(employee.employeeId, stored);
            target = stored;
          } catch {
            target = null;
          }
        }
        if (!target) {
          const convs = await listEmployeeConversations(employee.employeeId);
          if (convs.length > 0) {
            target = convs[0].conversationId;
          } else {
            const created = await createEmployeeConversation(employee.employeeId, '');
            target = created.conversationId;
          }
          writeStoredConv(employee.employeeId, target);
        }
        if (cancelled) return;
        setConversationId(target);
        const msgs = await listEmployeeMessages(employee.employeeId, target);
        if (cancelled) return;
        setMessages(msgs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [employee.employeeId]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !conversationId) return;

      setLoading(true);
      setError(null);

      // 1. 持久化 user 消息
      let userMsg: EmployeeMessage;
      try {
        userMsg = await appendEmployeeMessage(employee.employeeId, conversationId, {
          role: 'user', content: trimmed, status: 'completed',
          model: '', createdAt: new Date().toISOString(),
        });
        setMessages((prev) => [...prev, userMsg]);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('保存消息失败'));
        setLoading(false);
        return;
      }

      // 2. 流式获取 AI 回复
      const controller = new AbortController();
      abortRef.current = controller;
      const history = messages
        .filter((m) => m.status === 'completed')
        .slice(-20)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const systemPrompt = employee.capability?.systemPrompt
        || `你是${employee.name}，${employee.roleIdentity}。${employee.description}`;

      // 临时 assistant 消息（流式中状态变化）
      const tempAssistantId = `local-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          messageId: tempAssistantId,
          conversationId: conversationId!,
          role: 'assistant', content: '', status: 'in_progress', model: '',
          sequence: prev.length + 1, createdAt: new Date().toISOString(),
        },
      ]);

      let accumulated = '';
      try {
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
              ...history,
              { role: 'user', content: trimmed },
            ],
            temperature: employee.capability?.temperature ?? 0.7,
            maxTokens: employee.capability?.maxTokens ?? 2048,
            appId: 'app-employee-chat',
            // 透传 sessionId（Kernel SessionSandbox 关联）
            sessionId: conversationId,
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
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const data = t.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data) as {
                type?: string;
                data?: { text?: string; finish_reason?: string };
                choices?: { delta?: { content?: string }; finish_reason?: string }[];
              };
              let delta = '';
              if (parsed.choices?.[0]?.delta?.content) delta = parsed.choices[0].delta.content;
              else if (parsed.type === 'token' && parsed.data?.text !== undefined) delta = parsed.data.text;
              if (delta) {
                accumulated += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.messageId === tempAssistantId ? { ...m, content: accumulated } : m)),
                );
              }
              if (parsed.choices?.[0]?.finish_reason || parsed.type === 'final' || parsed.data?.finish_reason) {
                finished = true;
              }
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 用户取消 — 保留已累积内容
        } else {
          // 走 mock 回复
          const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
          let index = 0;
          const timer = setInterval(() => {
            if (index >= reply.length) {
              clearInterval(timer);
              accumulated = reply;
              setMessages((prev) =>
                prev.map((m) => (m.messageId === tempAssistantId ? { ...m, content: accumulated } : m)),
              );
            } else {
              accumulated += reply.slice(index, index + 2);
              index += 2;
              setMessages((prev) =>
                prev.map((m) => (m.messageId === tempAssistantId ? { ...m, content: accumulated } : m)),
              );
            }
          }, 50);
          // 等 mock 流式写完
          await new Promise((r) => setTimeout(r, (reply.length / 2) * 50 + 100));
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }

      // 3. 持久化 assistant 消息（替换临时条目为持久化消息）
      try {
        const assistantMsg = await appendEmployeeMessage(employee.employeeId, conversationId, {
          role: 'assistant',
          content: accumulated,
          status: 'completed',
          model: employee.capability?.model || '',
          createdAt: new Date().toISOString(),
        });
        setMessages((prev) =>
          prev.map((m) => (m.messageId === tempAssistantId ? assistantMsg : m)),
        );
      } catch (err) {
        // 持久化失败也要保留本地流式结果
        console.error('保存 assistant 消息失败', err);
      }
    },
    [employee, loading, conversationId, messages],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  // 业务消息 → Semi AI 消息（ContentItem[] 格式，按 role 区分 input_text/output_text）
  const semiMessages = useMemo<SemiMessage[]>(
    () =>
      messages.map((msg) => {
        const text = msg.content;
        const isStreaming = msg.messageId.startsWith('local-');
        const status: SemiMessage['status'] = msg.status === 'failed'
          ? 'failed'
          : isStreaming
            ? text === '' ? 'in_progress' : 'incomplete'
            : 'completed';
        const contentItems: Array<Record<string, unknown>> = [];
        if (text) {
          contentItems.push({
            type: 'message',
            content: [{ type: msg.role === 'user' ? 'input_text' : 'output_text', text }],
          });
        }
        return {
          id: msg.messageId,
          role: msg.role,
          name: msg.role === 'user' ? '我' : employee.name,
          content: contentItems,
          createdAt: msg.createdAt ? Date.parse(msg.createdAt) : Date.now(),
          status,
          model: msg.role === 'assistant' ? msg.model || employee.capability?.model : undefined,
        };
      }),
    [messages, employee.name, employee.capability?.model],
  );

  const showWelcome = messages.length === 0 && !initialLoading;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: heightMode === 'fill' ? '100%' : 500,
        minHeight: heightMode === 'fill' ? 0 : undefined,
        gap: 8,
        position: 'relative',
      }}
    >
      {initialLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Spin />
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-danger)', fontSize: 13 }}>
          加载失败：{error.message}
        </div>
      ) : (
        <>
          <AIChatDialogue
            className="edp-ai-dialogue"
            style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 'none', padding: '12px 0 0' }}
            align="leftRight"
            mode="bubble"
            chats={semiMessages}
            roleConfig={{
              user: { name: '我' },
              assistant: { name: employee.name },
            }}
            dialogueRenderConfig={{
              renderDialogueAvatar: ({ message }) => (
                <Avatar
                  size="extra-small"
                  color={message?.role === 'user' ? 'blue' : 'purple'}
                  style={{ flexShrink: 0 }}
                >
                  {message?.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                </Avatar>
              ),
            }}
            topSlot={
              showWelcome ? (
                <div style={{ textAlign: 'center', padding: '32px 16px 8px' }}>
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'var(--semi-color-primary-light-default)',
                      color: 'var(--semi-color-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Sparkles size={24} />
                  </div>
                  <Typography.Title heading={5} style={{ margin: '0 0 4px' }}>
                    你好，我是 {employee.name}
                  </Typography.Title>
                  <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                    {employee.roleIdentity || '数字员工'} · 随时为你服务
                  </Typography.Text>
                </div>
              ) : undefined
            }
            hints={showWelcome ? WELCOME_HINTS : []}
            hintStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginLeft: 0, marginTop: 16 }}
            onHintClick={(hint) => { void handleSend(hint); }}
          />
          <AIChatInput
            placeholder={`向 ${employee.name} 发送消息…`}
            sendHotKey="enter"
            round
            generating={loading}
            onStopGenerate={handleCancel}
            onMessageSend={({ inputContents }) => {
              void handleSend(extractPlainText(inputContents));
            }}
          />
        </>
      )}
    </div>
  );
}
