// useOntologyAssistant - 桥接 PageAssistantController 面板 + SuperAI agent 流
// (MP-ONT-PROPOSAL-01)。
//
// 用户在 AI 助手面板输入自然语言描述本体：
//   - 走 POST /api/v1/copilot/chat/agent/stream（与 SuperAI 聊天同一条流）
//   - token 增量累加到 assistant 消息气泡
//   - 流中出现 proposal 事件（model_type / create_instance / merge_suggestion /
//     action 四种 kind）→ 触发 onProposal 回调弹出 ProposalConfirmDrawer
//   - 没有 proposal 的纯文本回答 → 直接显示在面板里
//
// 返回的对象形状与 usePageAssistant 一致，可无修改接入 AIAssistantWorkspace。
//
// 注：本 hook 原先打在一个后端不存在的端点（/api/v1/agent/runs/stream，实测 404）
// 上，已改接真实可用的 copilot agent 流。

import { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { PageAssistantController, AssistantMessage } from '@mate/shared';
import { streamAgentChat } from '@/api/superai/chat';

export interface ProposalFromStream {
  proposal_id: string;
  kind: string;
  /** 流里附加的标题 / 摘要（可选） */
  title?: string;
  summary?: string;
}

/** 宿主页面上下文（后端折进 system prompt，让指代能落到具体页面/对象）。 */
export interface AssistantInteractionContext {
  appCode: string;
  pageCode: string;
  pageUrl: string;
}

export interface UseOntologyAssistantOptions {
  employeeId: string;
  employeeName: string;
  employeeDescription: string;
  moduleLabel: string;
  welcomeMessage: string;
  suggestions: string[];
  /** Agent run 的 base context（含 appCode / pageCode / pageUrl）。 */
  baseContext: { interaction: AssistantInteractionContext };
  /** 流里出现 proposal 时触发（弹 drawer）。 */
  onProposal?: (proposal: ProposalFromStream) => void;
  /** 流跑失败的回调（可选，用于 toast）。 */
  onError?: (message: string) => void;
}

const createMessage = (role: AssistantMessage['role'], content: string): AssistantMessage => ({
  id: `${role}-${nanoid(8)}`,
  role,
  content,
  createdAt: new Date().toISOString(),
});

const createSessionId = (employeeId: string) => `${employeeId}-${nanoid(10)}`;

export function useOntologyAssistant(options: UseOntologyAssistantOptions): PageAssistantController {
  const {
    employeeId, employeeName, employeeDescription, moduleLabel,
    welcomeMessage, suggestions, baseContext, onProposal, onError,
  } = options;

  // 面板 UI 状态
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => createSessionId(employeeId));
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);

  // 当前 assistant 消息 id（同一轮流都累加到这条）
  const assistantMessageIdRef = useRef<string | null>(null);
  // 对话历史（发给后端做多轮上下文）
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  // 防止同一条流二次弹 proposal
  const proposalEmittedRef = useRef<string | null>(null);

  const onProposalRef = useRef(onProposal);
  const onErrorRef = useRef(onError);
  useEffect(() => { onProposalRef.current = onProposal; }, [onProposal]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const baseContextRef = useRef(baseContext);
  useEffect(() => { baseContextRef.current = baseContext; }, [baseContext]);

  const streamingRef = useRef(false);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  const sendMessage = useCallback((rawContent: string) => {
    const content = rawContent.trim();
    if (!content || streamingRef.current) return;

    proposalEmittedRef.current = null;
    setMessages((prev) => [...prev, createMessage('user', content)]);
    const assistantId = `assistant-${nanoid(8)}`;
    assistantMessageIdRef.current = assistantId;
    setMessages((prev) => [...prev, createMessage('assistant', '')]);
    setIsThinking(true);
    setStreaming(true);

    const history = [...historyRef.current, { role: 'user' as const, content }];
    historyRef.current = history;

    const controller = new AbortController();
    abortRef.current = controller;

    const appendToBubble = (text: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m)),
      );
    };

    void streamAgentChat(
      history,
      {
        onDelta: appendToBubble,
        onProposal: (proposal) => {
          if (proposalEmittedRef.current === proposal.proposalId) return;
          proposalEmittedRef.current = proposal.proposalId;
          onProposalRef.current?.({
            proposal_id: proposal.proposalId,
            kind: proposal.kind,
            summary: proposal.impactSummary,
          });
        },
        onDone: (fullContent) => {
          if (fullContent) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)),
            );
            historyRef.current = [...historyRef.current, { role: 'assistant', content: fullContent }];
          }
          setIsThinking(false);
          setStreaming(false);
          abortRef.current = null;
        },
        onError: (message) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.content === ''
                ? { ...m, content: `（流式推理失败：${message}）` }
                : m,
            ),
          );
          onErrorRef.current?.(message);
          setIsThinking(false);
          setStreaming(false);
          abortRef.current = null;
        },
      },
      controller.signal,
      { context: baseContextRef.current },
    );
  }, []);

  const clearSession = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    assistantMessageIdRef.current = null;
    proposalEmittedRef.current = null;
    historyRef.current = [];
    setMessages([]);
    setIsThinking(false);
    setStreaming(false);
    setSessionId(createSessionId(employeeId));
  }, [employeeId]);

  // 卸载时 abort
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    employeeId,
    employeeName,
    employeeDescription,
    moduleLabel,
    welcomeMessage,
    suggestions,
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
