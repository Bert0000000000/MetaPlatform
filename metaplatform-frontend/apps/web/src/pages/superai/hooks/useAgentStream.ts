import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, getUser } from '@mate/shared';


/**
 * useAgentStream - P4 Hook for ontology-native Agent Run streaming.
 *
 * <p>Bridges the React layer to the backend AgentRun SSE stream
 * (POST /api/v1/agent/runs/stream). Handles:
 * <ul>
 *   <li>InteractionContext construction (page + subject + viewState)</li>
 *   <li>SSE parsing of RUN_STARTED / TOOL_STARTED / CLAIM_PRODUCED / RUN_COMPLETED</li>
 *   <li>Claim + Evidence accumulation for the UI</li>
 *   <li>Abort + reconnect</li>
 * </ul>
 * </p>
 */

export type RunEventType =
  | 'RUN_STARTED'
  | 'RUN_PAUSED'
  | 'RUN_RESUMED'
  | 'RUN_FAILED'
  | 'RUN_COMPLETED'
  | 'TOOL_STARTED'
  | 'TOOL_COMPLETED'
  | 'CLAIM_PRODUCED'
  | 'EVIDENCE_ATTACHED'
  | 'SUBAGENT_STARTED'
  | 'routing_decision';

export interface RunEvent {
  eventId: string;
  runId: string;
  type: RunEventType;
  ts: string;
  payload: Record<string, unknown>;
  seq: number;
}

export interface Claim {
  claimId: string;
  type: 'FACT' | 'INFERENCE' | 'RECOMMENDATION';
  text: string;
  confidence: number;
  evidenceRefs: string[];
}

export interface Evidence {
  evidenceId: string;
  type: 'ONTOLOGY_OBJECT' | 'ONTOLOGY_METRIC' | 'ONTOLOGY_RELATION' | 'DOCUMENT' | 'KB_CHUNK' | 'EXTERNAL' | 'MODEL_DERIVED';
  ref: string;
  fragment?: string;
  capturedAt: string;
  concept?: string;
  objectId?: string;
  toolCallId?: string;
  envelopeId: string;
}

/**
 * RoutingDecision — semantic_router / dispatcher / llm_fc 路由决策 (MP-SR-01 Stage 2)。
 *
 * <p>前端订阅 routing_decision SSE 事件后渲染：top-k 候选 + 最终选中 + 命中路径。
 * 一轮 run 可能收到多张 routing_decision（pre-screen 在 reasoning 之前，selected
 * 在 dispatch 之前），按事件顺序累加。</p>
 */
export type RoutingTakenPath =
  | 'llm_fc'
  | 'semantic_router'
  | 'dispatcher'
  | 'keyword_fallback';

export interface RoutingCandidate {
  role_slug: string;
  role_rid?: string;
  display_name: string;
  capability_tags?: string[];
  similarity: number;
  reason?: string;
}

export interface RoutingSelected {
  role_slug: string;
  reason?: string;
}

export interface RoutingDecision {
  /** semantic_router top-k 候选（按相似度降序） */
  candidates: RoutingCandidate[];
  /** 最终选中的角色（selected=null 表示 pre-screen 尚未决策） */
  selected: RoutingSelected | null;
  /** 命中路径标签：llm_fc=LLM function calling 直接选 / semantic_router=向量预筛
   *  / dispatcher=fallback 链 / keyword_fallback=关键词兜底 */
  taken_path: RoutingTakenPath | null;
  /** 后端原始 reason 描述（兜底信息） */
  reason: string;
  /** 事件序号，用于同 run 多事件排序 */
  seq: number;
  /** 事件时间戳 */
  ts: string;
}

export interface InteractionContext {
  message: string;
  interaction: {
    appCode: string;
    pageCode: string;
    pageUrl: string;
  };
  subject?: {
    conceptCode: string;
    objectId: string;
  };
  viewState?: Record<string, unknown>;
  contractVersion: '1.0';
}

export interface UseAgentStreamOptions {
  /** Default InteractionContext, e.g. from InteractionContextProvider */
  baseContext: InteractionContext;
  /** Called when a new RunEvent is received */
  onEvent?: (event: RunEvent) => void;
  /** Called when a Claim is received (CLAIM_PRODUCED) */
  onClaim?: (claim: Claim) => void;
  /** Called when Evidence is attached */
  onEvidence?: (evidence: Evidence) => void;
  /** Called when the run finishes (RUN_COMPLETED or RUN_FAILED) */
  onDone?: (result: { status: 'COMPLETED' | 'FAILED' | 'ABORTED'; errorCode?: string; errorMessage?: string }) => void;
}

export interface UseAgentStreamReturn {
  /** Send a new message and start a streaming run */
  send: (message: string, overrides?: Partial<InteractionContext>) => Promise<void>;
  /** Abort the current run */
  abort: () => void;
  /** Current run id (null if not started) */
  runId: string | null;
  /** Run state */
  status: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'aborted';
  /** All received events */
  events: RunEvent[];
  /** All received claims */
  claims: Claim[];
  /** All received evidence */
  evidence: Evidence[];
  /** All received routing_decision events (one run may emit multiple: pre-screen + selected) */
  routingDecisions: RoutingDecision[];
  /** Final assembled response text (assistant) */
  answer: string;
  /** Last error */
  error: string | null;
  /** Whether stream is currently active */
  streaming: boolean;
}

const AGENT_RUN_PATH = '/api/v1/agent/runs/stream';

/**
 * Normalize a routing_decision SSE event payload into the frontend contract.
 *
 * <p>Tolerates both formats:
 * <ul>
 *   <li>Stage-2 contract (MP-SR-01 task 2):
 *       <code>{candidates, selected: {role_slug, reason}, taken_path, reason}</code></li>
 *   <li>Legacy Stage-1 fallback (already deployed in some envs):
 *       <code>{candidates, selected: string|null, reason}</code> — selected 为字符串
 *       role slug/rid 时自动包成 <code>RoutingSelected</code>。</li>
 * </ul>
 * </p>
 */
function parseRoutingDecision(ev: RunEvent): RoutingDecision | null {
  const p = (ev.payload ?? {}) as Record<string, unknown>;
  const rawCandidates = Array.isArray(p.candidates) ? p.candidates : [];
  const candidates: RoutingCandidate[] = rawCandidates
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const cc = c as Record<string, unknown>;
      return {
        role_slug: String(cc.role_slug ?? ''),
        role_rid: typeof cc.role_rid === 'string' ? cc.role_rid : undefined,
        display_name: String(cc.display_name ?? cc.role_slug ?? ''),
        capability_tags: Array.isArray(cc.capability_tags)
          ? (cc.capability_tags as unknown[]).map(String)
          : undefined,
        similarity: typeof cc.similarity === 'number' ? cc.similarity : 0,
        reason: typeof cc.reason === 'string' ? cc.reason : undefined,
      } satisfies RoutingCandidate;
    });

  const rawSelected = p.selected;
  let selected: RoutingSelected | null = null;
  if (rawSelected && typeof rawSelected === 'object') {
    const sel = rawSelected as Record<string, unknown>;
    selected = {
      role_slug: String(sel.role_slug ?? ''),
      reason: typeof sel.reason === 'string' ? sel.reason : undefined,
    };
  } else if (typeof rawSelected === 'string' && rawSelected.length > 0) {
    // Legacy shape: selected = role slug/rid string
    selected = { role_slug: rawSelected };
  }

  const rawTaken = p.taken_path;
  const taken_path: RoutingTakenPath | null =
    rawTaken === 'llm_fc' || rawTaken === 'semantic_router' ||
    rawTaken === 'dispatcher' || rawTaken === 'keyword_fallback'
      ? rawTaken
      : null;

  const reason = typeof p.reason === 'string'
    ? p.reason
    : selected?.reason ?? (candidates.length === 0 ? 'no candidates' : 'semantic_router pre-screen');

  return {
    candidates,
    selected,
    taken_path,
    reason,
    seq: ev.seq,
    ts: ev.ts,
  };
}

export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
  const { baseContext, onEvent, onClaim, onEvidence, onDone } = options;

  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<UseAgentStreamReturn['status']>('idle');
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [routingDecisions, setRoutingDecisions] = useState<RoutingDecision[]>([]);
  const [answer, setAnswer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus((s) => (s === 'running' || s === 'starting' ? 'aborted' : s));
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (message: string, overrides?: Partial<InteractionContext>) => {
      // Reset state
      setError(null);
      setEvents([]);
      setClaims([]);
      setEvidence([]);
      setRoutingDecisions([]);
      setAnswer('');
      setStatus('starting');
      setStreaming(true);

      const context: InteractionContext = {
        ...baseContext,
        ...overrides,
        message,
        contractVersion: '1.0',
      };

      const controller = new AbortController();
      abortRef.current = controller;

      const token = getToken();
      const user = getUser();

      try {
        const response = await fetch((import.meta.env.VITE_API_BASE_URL || '/api') + AGENT_RUN_PATH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: JSON.stringify(context),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const txt = await response.text().catch(() => '');
          throw new Error('Agent stream failed: ' + response.status + ' ' + txt);
        }

        setStatus('running');
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let finalStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';
        let errCode: string | undefined;
        let errMsg: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;

            let parsed: any;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            const ev: RunEvent = {
              eventId: parsed.eventId || '',
              runId: parsed.runId || '',
              type: parsed.type,
              ts: parsed.ts || new Date().toISOString(),
              payload: parsed.payload || {},
              seq: parsed.seq || 0,
            };

            setEvents((prev) => [...prev, ev]);
            if (parsed.runId && !runId) setRunId(parsed.runId);
            onEvent?.(ev);

            if (ev.type === 'CLAIM_PRODUCED' && ev.payload.claim) {
              const c = ev.payload.claim as unknown as Claim;
              setClaims((prev) => [...prev, c]);
              onClaim?.(c);
            } else if (ev.type === 'EVIDENCE_ATTACHED' && ev.payload.evidence) {
              const e = ev.payload.evidence as unknown as Evidence;
              setEvidence((prev) => [...prev, e]);
              onEvidence?.(e);
            } else if (ev.type === 'routing_decision') {
              const rd = parseRoutingDecision(ev);
              if (rd) setRoutingDecisions((prev) => [...prev, rd]);
            } else if (ev.type === 'RUN_COMPLETED') {
              finalStatus = 'COMPLETED';
              if (typeof ev.payload.answer === 'string') setAnswer(ev.payload.answer);
            } else if (ev.type === 'RUN_FAILED') {
              finalStatus = 'FAILED';
              errCode = ev.payload.errorCode as string | undefined;
              errMsg = ev.payload.errorMessage as string | undefined;
              if (typeof ev.payload.answer === 'string') setAnswer(ev.payload.answer);
            }
          }
        }

        setStatus(finalStatus === 'COMPLETED' ? 'completed' : 'failed');
        onDone?.({ status: finalStatus, errorCode: errCode, errorMessage: errMsg });
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          setStatus('aborted');
          onDone?.({ status: 'ABORTED' });
        } else {
          setError((e as Error).message || 'Stream failed');
          setStatus('failed');
          onDone?.({ status: 'FAILED', errorMessage: (e as Error).message });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [baseContext, onEvent, onClaim, onEvidence, onDone, runId],
  );

  return { send, abort, runId, status, events, claims, evidence, routingDecisions, answer, error, streaming };
}
