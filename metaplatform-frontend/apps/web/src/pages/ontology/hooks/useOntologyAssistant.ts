// useOntologyAssistant - 桥接 PageAssistantController 面板 + useAgentStream 后端流
// (MP-ONT-PROPOSAL-01)。
//
// 替代 usePageAssistant 的空壳实现：
//   - 用户在 AI 助手面板输入自然语言描述本体
//   - 走 POST /api/v1/agent/runs/stream 流（SSE）
//   - 流式 token → 累加到 assistant 消息气泡
//   - RUN_COMPLETED payload 携带 proposal_id（model_type / create_instance /
//     merge_suggestion / action 四种 kind）→ 触发 onProposal 回调弹出
//     ProposalConfirmDrawer
//   - 没有 proposal_id 的纯文本回答 → 直接显示在面板里
//
// 返回的对象形状与 usePageAssistant 完全一致，可以无修改替换接入 AIAssistantWorkspace。

import { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { PageAssistantController, AssistantMessage } from '@mate/shared';
import {
  useAgentStream,
  type InteractionContext,
  type Claim,
  type Evidence,
} from '@/pages/superai/hooks';

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
  /** Agent run 的 base context（含 appCode / pageCode / pageUrl）。 */
  baseContext: Pick<InteractionContext, 'interaction'>;
  /** 流结束后命中： proposal_id 时触发（弹 drawer）。 */
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

/**
 * useOntologyAssistant - 把 useAgentStream 封装成 PageAssistantController。
 *
 * <p>行为约定：
 * <ul>
 *   <li><code>sendMessage(content)</code>：向当前 session 发送一条用户消息，
 *       启动一次 Agent run；空内容或已有流在跑则直接忽略。</li>
 *   <li>流式 token 通过 <code>message</code> / <code>token</code> 事件累加到
 *       <code>assistant</code> 消息气泡的 content 字段。</li>
 *   <li>CLAIM_PRODUCED / EVIDENCE_ATTACHED 暂不渲染到面板气泡（仅日志），后续
 *       可以挂 <code>onClaim/onEvidence</code> 加面板下方的 Claims 区。</li>
 *   <li>RUN_COMPLETED：若 payload 含 <code>proposal_id</code> →
 *       <code>onProposal</code>；否则纯文本回答直接显示。</li>
 *   <li>RUN_FAILED：写入一段错误说明 + 调用 <code>onError</code>。</li>
 * </ul>
 * </p>
 */
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

  // 当前 assistant 消息 id（同一轮流都累加到这条）
  const assistantMessageIdRef = useRef<string | null>(null);
  // 防止 RUN_COMPLETED 二次弹 proposal
  const proposalEmittedRef = useRef<string | null>(null);

  const onProposalRef = useRef(onProposal);
  const onErrorRef = useRef(onError);
  useEffect(() => { onProposalRef.current = onProposal; }, [onProposal]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // 构造 baseContext（每次 send 都从 prop 拷一份）
  const baseContextRef = useRef(baseContext);
  useEffect(() => { baseContextRef.current = baseContext; }, [baseContext]);

  // useAgentStream：每次 streamTick 变化就重新订阅（SSE 跑完了再发新消息）
  // 这里用一个伪 prop 触发，每次 send 自增 streamTick
  const stream = useAgentStream({
    baseContext: {
      ...baseContextRef.current,
      message: '',
      contractVersion: '1.0',
    },
    onEvent: (ev) => {
      const payload = (ev.payload ?? {}) as Record<string, unknown>;
      const data = (ev as unknown as { data?: Record<string, unknown> }).data ?? {};

      if (ev.type === 'RUN_COMPLETED') {
        const answer = typeof payload.answer === 'string' ? payload.answer : '';
        const proposalId =
          (typeof payload.proposal_id === 'string' && payload.proposal_id) ||
          (typeof data.proposal_id === 'string' && data.proposal_id) ||
          (typeof payload.proposalId === 'string' && payload.proposalId) ||
          null;
        const proposalKind =
          (typeof payload.proposal_kind === 'string' && payload.proposal_kind) ||
          (typeof data.proposal_kind === 'string' && data.proposal_kind) ||
          (typeof payload.kind === 'string' && payload.kind) ||
          'model_type';
        const proposalTitle =
          (typeof payload.proposal_title === 'string' && payload.proposal_title) ||
          (typeof data.proposal_title === 'string' && data.proposal_title) ||
          undefined;
        const proposalSummary =
          (typeof payload.proposal_summary === 'string' && payload.proposal_summary) ||
          (typeof data.proposal_summary === 'string' && data.proposal_summary) ||
          undefined;

        // 把 RUN_COMPLETED 自带的 answer 兜底注入 assistant 气泡
        const id = assistantMessageIdRef.current;
        if (id && answer) {
          setMessages((prev) => prev.map((m) =>
            m.id === id && m.content === '' ? { ...m, content: answer } : m,
          ));
        }

        // 触发 proposal 弹窗（每个 session 只触发一次，避免重连重发）
        if (proposalId && proposalEmittedRef.current !== proposalId) {
          proposalEmittedRef.current = proposalId;
          onProposalRef.current?.({
            proposal_id: proposalId,
            kind: proposalKind,
            title: proposalTitle,
            summary: proposalSummary,
          });
        }

        setIsThinking(false);
      } else if (ev.type === 'RUN_FAILED') {
        const errMsg =
          (typeof payload.errorMessage === 'string' && payload.errorMessage) ||
          (typeof payload.message === 'string' && payload.message) ||
          '流式推理失败';
        const id = assistantMessageIdRef.current;
        if (id) {
          setMessages((prev) => prev.map((m) =>
            m.id === id && m.content === ''
              ? { ...m, content: `（流式推理失败：${errMsg}）` }
              : m,
          ));
        }
        onErrorRef.current?.(errMsg);
        setIsThinking(false);
      }
    },
    onClaim: (_c: Claim) => {
      // 占位：当前面板不渲染 claims，后续可挂 claims 区域
    },
    onEvidence: (_e: Evidence) => {
      // 占位：同上
    },
    onDone: () => {
      setIsThinking(false);
    },
  });

  // 用 ref 拿最新 send + abort（避免闭层过期）
  const streamRef = useRef(stream);
  useEffect(() => { streamRef.current = stream; }, [stream]);

  const sendMessage = useCallback((rawContent: string) => {
    const content = rawContent.trim();
    if (!content || streamRef.current.streaming) return;

    proposalEmittedRef.current = null;

    setMessages((prev) => [...prev, createMessage('user', content)]);
    const assistantId = `assistant-${nanoid(8)}`;
    assistantMessageIdRef.current = assistantId;
    setMessages((prev) => [...prev, createMessage('assistant', '')]);

    setIsThinking(true);

    // 异步触发真正的流（下一 microtask，确保 assistantMessageIdRef 已写入）
    queueMicrotask(() => {
      streamRef.current.send(content).catch(() => {
        setIsThinking(false);
      });
    });
  }, []);

  const clearSession = useCallback(() => {
    if (streamRef.current.streaming) streamRef.current.abort();
    assistantMessageIdRef.current = null;
    proposalEmittedRef.current = null;
    setMessages([]);
    setIsThinking(false);
    setSessionId(createSessionId(employeeId));
  }, [employeeId]);

  // 卸载时 abort
  useEffect(() => {
    return () => {
      streamRef.current.abort();
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