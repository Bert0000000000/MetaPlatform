import axios, { AxiosRequestConfig } from 'axios';

/**
 * SuperAI 统一 API 客户端（P4.1）。
 *
 * <p>所有前端页面通过这个客户端与后端沟通：</p>
 * <ul>
 *   <li>POST /api/v1/agent/context/build — 构建 Ontology Context Envelope</li>
 *   <li>POST /api/v1/agent/agents/{id}/execute/stream — SSE 流式执行</li>
 *   <li>POST /api/v1/rag/search — RAG 检索</li>
 * </ul>
 */
export const superAiApi = axios.create({ baseURL: '/api/v1', timeout: 60000 });

export interface RunEvent {
  eventId?: string;
  type: string;
  ts?: number;
  data?: Record<string, unknown>;
}

/**
 * 流式调用 DeerFlow / Agent。
 */
export async function streamAgentRun(opts: {
  agentId: string;
  request: Record<string, unknown>;
  onEvent: (event: RunEvent) => void;
  onError?: (e: unknown) => void;
  signal?: AbortSignal;
}) {
  const url = `/agent/agents/${opts.agentId}/execute/stream`;
  const resp = await fetch('/api/v1' + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts.request),
    signal: opts.signal,
  });
  if (!resp.body) throw new Error('No response body');
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE: event: <name>\ndata: <json>\n\n
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';
    for (const e of events) {
      const lines = e.split('\n');
      let name = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      try {
        opts.onEvent({ type: name, data: data ? JSON.parse(data) : {} });
      } catch {
        opts.onEvent({ type: name, data: { raw: data } });
      }
    }
  }
}

/**
 * 构建 Ontology Context Envelope。
 */
export async function buildContext(request: Record<string, unknown>) {
  const resp = await superAiApi.post('/agent/context/build', request);
  return resp.data?.data;
}
