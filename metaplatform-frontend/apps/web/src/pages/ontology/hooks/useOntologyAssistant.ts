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
//
// 2026-09-18（ADR-0065 / `MP-CONTEXT-AWARE-01` S2）：上下文从**静态三键**升级为
// **分层状态键**（navigation / selection / pendingSelection），并新增 `sendWithContext`
// 入口。旧宿主（只给 `baseContext.interaction`）的 payload **逐字节不变**——分层键
// 只在真的有内容时才落（见 `buildAssistantContextEnvelope`）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { PageAssistantController, AssistantMessage } from '@mate/shared';
import { streamAgentChat } from '@/api/superai/chat';
import {
  buildAssistantContextEnvelope,
  getOntologyContextSnapshot,
  type AssistantInteractionContext,
  type AssistantNavigationState,
  type AssistantPendingSelection,
  type AssistantSelection,
} from './assistantContext';

export type { AssistantInteractionContext } from './assistantContext';

export interface ProposalFromStream {
  proposal_id: string;
  kind: string;
  /** 流里附加的标题 / 摘要（可选） */
  title?: string;
  summary?: string;
}

export interface UseOntologyAssistantOptions {
  employeeId: string;
  employeeName: string;
  employeeDescription: string;
  moduleLabel: string;
  welcomeMessage: string;
  suggestions: string[];
  /** Agent run 的 base context（appCode / pageCode / pageUrl）。 */
  baseContext: { interaction: AssistantInteractionContext };
  /**
   * 动态 navigation（ADR-0065 §3.4）：每次发问时现取，所以路由/深链变了自动跟上。
   * 不传时退化为读本体域 store（宿主页与助手常不在同一 React 树，见 `assistantContext`）。
   */
  getNavigationState?: () => AssistantNavigationState | null;
  /** 动态 selection：同上，不传时读本体域 store。 */
  getSelection?: () => AssistantSelection | null;
  /** 流里出现 proposal 时触发（弹 drawer）。 */
  onProposal?: (proposal: ProposalFromStream) => void;
  /** 流跑失败的回调（可选，用于 toast）。 */
  onError?: (message: string) => void;
}

/** 在一次发送上附加的一次性上下文。 */
export interface SendWithContextOptions {
  /** 覆盖本次的选中态（不传则用 getSelection / store）。 */
  selection?: AssistantSelection | null;
  /** 一次性划词上下文——**消费即弃**，不写回任何状态。 */
  pendingSelection?: AssistantPendingSelection | null;
}

/** `usePageAssistant` 的控制器 + 分层上下文入口。 */
export interface OntologyAssistantController extends PageAssistantController {
  /** 带上下文发一句（划词/右键"问 AI"、选中后追问的入口）。 */
  sendWithContext: (text: string, options?: SendWithContextOptions) => void;
}

const createMessage = (role: AssistantMessage['role'], content: string): AssistantMessage => ({
  id: `${role}-${nanoid(8)}`,
  role,
  content,
  createdAt: new Date().toISOString(),
});

const createSessionId = (employeeId: string) => `${employeeId}-${nanoid(10)}`;

export function useOntologyAssistant(options: UseOntologyAssistantOptions): OntologyAssistantController {
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

  // 动态取数函数放进 ref：发送时现取，避免把它们写进 useCallback 依赖导致重建。
  const getNavigationStateRef = useRef(options.getNavigationState);
  const getSelectionRef = useRef(options.getSelection);
  useEffect(() => { getNavigationStateRef.current = options.getNavigationState; }, [options.getNavigationState]);
  useEffect(() => { getSelectionRef.current = options.getSelection; }, [options.getSelection]);

  const streamingRef = useRef(false);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  /** 发送内核：`sendMessage` 与 `sendWithContext` 共用，差别只在本次附带的上下文。 */
  const sendInternal = useCallback((
    rawContent: string,
    extra?: SendWithContextOptions,
  ) => {
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

    // 上下文在**发送这一刻**组装：navigation 随路由、selection 随选中，都是一次性请求态。
    const store = getOntologyContextSnapshot();
    const navigation = getNavigationStateRef.current
      ? getNavigationStateRef.current()
      : store.navigation;
    const selection = extra?.selection !== undefined
      ? extra.selection
      : (getSelectionRef.current ? getSelectionRef.current() : store.selection);

    const context = buildAssistantContextEnvelope({
      interaction: baseContextRef.current.interaction,
      navigation,
      selection,
      pendingSelection: extra?.pendingSelection ?? null,
    });

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
      { context },
    );
  }, []);

  const sendMessage = useCallback((rawContent: string) => sendInternal(rawContent), [sendInternal]);

  const sendWithContext = useCallback(
    (rawContent: string, sendOptions?: SendWithContextOptions) => sendInternal(rawContent, sendOptions),
    [sendInternal],
  );

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
    sendWithContext,
    clearSession,
  };
}
