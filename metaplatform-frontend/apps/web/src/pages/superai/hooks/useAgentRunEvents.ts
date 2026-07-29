import { useEffect, useRef, useState } from 'react';
import type { RunEvent, RunEventType } from './useAgentStream';

export interface UseAgentRunEventsOptions {
  runId: string | null;
  afterSeq?: number;
  onEvent?: (event: RunEvent) => void;
  enabled?: boolean;
  reconnectDelayMs?: number;
}

const RUN_EVENT_TYPES: RunEventType[] = [
  'RUN_STARTED',
  'RUN_PAUSED',
  'RUN_RESUMED',
  'RUN_FAILED',
  'RUN_COMPLETED',
  'TOOL_STARTED',
  'TOOL_COMPLETED',
  'CLAIM_PRODUCED',
  'EVIDENCE_ATTACHED',
  'SUBAGENT_STARTED',
];

function toRunEvent(message: MessageEvent<string>, runId: string): RunEvent | null {
  try {
    const raw = JSON.parse(message.data) as Partial<RunEvent>;
    const seq = Number(raw.seq ?? 0);
    if (!Number.isSafeInteger(seq) || seq < 1 || !raw.type) return null;
    return {
      eventId: raw.eventId || message.lastEventId || '',
      runId: raw.runId || runId,
      type: raw.type,
      ts: raw.ts || new Date().toISOString(),
      payload: raw.payload || {},
      seq,
    };
  } catch {
    return null;
  }
}

/**
 * Consumes the canonical tenant-scoped GET RunEvent SSE stream after a run exists.
 * Named SSE frames are registered explicitly; reconnects resume exclusively after the
 * highest accepted seq, so a closed snapshot stream cannot duplicate already-rendered events.
 */
export function useAgentRunEvents(options: UseAgentRunEventsOptions) {
  const { runId, afterSeq = 0, onEvent, enabled = true, reconnectDelayMs = 500 } = options;
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeqRef = useRef(afterSeq);
  const onEventRef = useRef(onEvent);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled || !runId) return;

    let disposed = false;
    lastSeqRef.current = afterSeq;
    setEvents([]);

    const connect = () => {
      if (disposed) return;
      const base = import.meta.env.VITE_API_BASE_URL || '/api';
      const query = new URLSearchParams({ runId });
      if (lastSeqRef.current > 0) query.set('afterSeq', String(lastSeqRef.current));
      const source = new EventSource(`${base}/api/v1/agent/run/stream?${query.toString()}`);
      sourceRef.current = source;

      source.onopen = () => setConnected(true);

      const accept = (message: MessageEvent<string>) => {
        const event = toRunEvent(message, runId);
        if (!event || event.seq <= lastSeqRef.current) return;
        // A no-gap replay is required. If a gap is observed, reconnect from the last
        // accepted seq instead of rendering an incomplete causal history.
        if (event.seq !== lastSeqRef.current + 1) {
          source.close();
          setConnected(false);
          if (!disposed) reconnectRef.current = setTimeout(connect, reconnectDelayMs);
          return;
        }
        lastSeqRef.current = event.seq;
        setEvents((previous) => [...previous, event]);
        onEventRef.current?.(event);
      };

      source.onmessage = accept;
      RUN_EVENT_TYPES.forEach((type) => source.addEventListener(type, accept as EventListener));
      source.onerror = () => {
        source.close();
        setConnected(false);
        if (!disposed) reconnectRef.current = setTimeout(connect, reconnectDelayMs);
      };
    };

    connect();
    return () => {
      disposed = true;
      sourceRef.current?.close();
      sourceRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
      setConnected(false);
    };
  }, [runId, afterSeq, enabled, reconnectDelayMs]);

  return {
    events,
    connected,
    lastSeq: lastSeqRef.current,
    close: () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
      setConnected(false);
    },
  };
}
