import { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { AssistantMessage, PageAssistantConfig, PageAssistantController } from './types';

const createSessionId = (employeeId: string) => `${employeeId}-${nanoid(10)}`;

const createMessage = (role: AssistantMessage['role'], content: string): AssistantMessage => ({
  id: `${role}-${nanoid(8)}`,
  role,
  content,
  createdAt: new Date().toISOString(),
});

export function usePageAssistant(config: PageAssistantConfig): PageAssistantController {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => createSessionId(config.employeeId));
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingReply = useCallback(() => {
    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingReply, [cancelPendingReply]);

  const sendMessage = useCallback((rawContent: string) => {
    const content = rawContent.trim();
    if (!content || isThinking) return;

    setMessages((current) => [...current, createMessage('user', content)]);
    setIsThinking(true);

    const reply = config.createReply?.(content)
      ?? `${config.employeeName}已收到你的问题：“${content}”。当前为界面演示，后续将接入该模块对应的数字员工服务。`;

    replyTimerRef.current = setTimeout(() => {
      setMessages((current) => [...current, createMessage('assistant', reply)]);
      setIsThinking(false);
      replyTimerRef.current = null;
    }, config.replyDelayMs ?? 650);
  }, [config.createReply, config.employeeName, config.replyDelayMs, isThinking]);

  const clearSession = useCallback(() => {
    cancelPendingReply();
    setMessages([]);
    setIsThinking(false);
    setSessionId(createSessionId(config.employeeId));
  }, [cancelPendingReply, config.employeeId]);

  return {
    ...config,
    isOpen,
    sessionId,
    messages,
    isThinking,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((current) => !current),
    sendMessage,
    clearSession,
  };
}