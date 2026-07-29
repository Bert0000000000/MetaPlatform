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
  | 'SUBAGENT_STARTED';

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
  /** Final assembled response text (assistant) */
  answer: string;
  /** Last error */
  error: string | null;
  /** Whether stream is currently active */
  streaming: boolean;
}

const AGENT_RUN_PATH = '/api/v1/agent/runs/stream';

export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
  const { baseContext, onEvent, onClaim, onEvidence, onDone } = options;

  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<UseAgentStreamReturn['status']>('idle');
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
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

  return { send, abort, runId, status, events, claims, evidence, answer, error, streaming };
}
