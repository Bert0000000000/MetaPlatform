import axios, { AxiosRequestConfig } from 'axios';

/**
 * SuperAI 统一 API 客户端 — 与 ERR-1/ERR-2/ERR-3 对齐。
 *
 * OpenAPI spec：docs/superpowers/specs/2026-07-26-ontology-deerflow-phase1.yaml
 *
 * <p>对齐策略：</p>
 * <ul>
 *   <li>POST /ontology/context/build    — 构建 Envelope（替换旧 /api/v1/agent/context/build）</li>
 *   <li>POST /agent/runs               — 创建 AgentRun（含 SSE 流式事件流，含 on_disconnect=continue）</li>
 *   <li>GET  /agent/runs/{runId}/events?afterSeq=... — 历史事件查询（含 seq 游标）</li>
 *   <li>POST /agent/ground-tools/{name} — 仅 DeerFlow middleware 内部使用，前端不直接调用</li>
 * </ul>
 *
 * Phase 1 MVP 不写 Action / Artifact URL 等写 Tool 端点（见 ERR-4）。
 */

export const superAiApi = axios.create({ baseURL: '/api/v1', timeout: 60000 });

/**
 * RunEvent 对齐 OpenAPI §ERR-2 — 21 种事件。
 *
 * <p>前端只需关心自身订阅的子集（如 CLAIM_PRODUCED / RUN_COMPLETED / TOOL_COMPLETED）。
 * 其他事件可选择性订阅。</p>
 */
export interface RunEvent {
  eventId: string;
  runId: string;
  taskId?: string | null;
  subAgentId?: string | null;
  parentRunId?: string | null;
  type: string;                         // RunEventType 的 21 个值之一，前端不强约束
  ts: string;                           // ISO 8601
  traceId: string;
  tenantId: string;
  envelopeId?: string | null;
  seq: number;                          // 单 run 单调递增
  payload: Record<string, unknown>;
}

/**
 * 与 OpenAPI §InteractionContext 对齐的请求体。
 *
 * <p>含 selectedText / clientHints，与 ERR-1 §服务端二次校验 对齐。</p>
 */
export interface InteractionContextRequest {
  message: string;
  interaction: {
    appCode: string;
    pageCode: string;
    pageUrl?: string;
    selectedText?: string | null;
    tenantId?: string;
  };
  subject?: {
    conceptCode: string;
    objectId: string;
  } | null;
  viewState?: {
    activeTab?: string;
    filters?: Record<string, unknown>;
    selectedMetrics?: string[];
  };
  clientHints?: {
    supportsStreaming: boolean;
    supportsArtifacts: boolean;
    uiLocale?: string;
  };
}

/**
 * EnvelopeHandle — 与 OpenAPI §BuildEnvelopeResponse 对齐。
 */
export interface EnvelopeHandle {
  envelopeId: string;
  signature: { alg: 'HS256' | 'RS256'; kid: string; value: string };
  expiresAt: string;
}

/**
 * 构建 OntologyContextEnvelope（POST /ontology/context/build）。
 */
export async function buildContext(request: InteractionContextRequest): Promise<EnvelopeHandle> {
  const resp = await superAiApi.post('/ontology/context/build', request);
  return resp.data?.data ?? resp.data;
}

/**
 * 创建 AgentRun（POST /agent/runs）。
 *
 * <p>返回 AgentRun（含 runId, status=PENDING），随后调用方接入 streamAgentRun。</p>
 */
export async function createAgentRun(opts: {
  agentId: string;
  goal: string;
  envelopeId: string;
  runtimeType?: 'DEERFLOW' | 'FAST_QUERY';
  parentRunId?: string;
}): Promise<{ runId: string; status: string; traceId: string }> {
  const resp = await superAiApi.post('/agent/runs', opts);
  return resp.data?.data ?? resp.data;
}

/**
 * 取消 AgentRun（POST /agent/runs/{runId}/cancel）。
 */
export async function cancelAgentRun(runId: string): Promise<void> {
  await superAiApi.post(`/agent/runs/${runId}/cancel`);
}

/**
 * 查询历史 RunEvent（GET /agent/runs/{runId}/events?afterSeq=...）。
 *
 * <p>Phase 1 MVP 流式暂用轮询模式：每 500ms 拉取 seq > afterSeq 的事件。
 * Phase 1.5 接入真正的 SSE。</p>
 */
export async function fetchRunEvents(opts: {
  runId: string;
  afterSeq?: number;
  types?: string[];
  signal?: AbortSignal;
}): Promise<RunEvent[]> {
  const resp = await superAiApi.get(`/agent/runs/${opts.runId}/events`, {
    params: { afterSeq: opts.afterSeq, types: opts.types?.join(',') },
    signal: opts.signal,
  });
  return resp.data?.data ?? resp.data ?? [];
}

/**
 * 流式订阅 AgentRun 事件（兼容老接口名 streamAgentRun，内部走轮询）。
 *
 * <p>调用方传入 onEvent 回调，每次拉到新事件即触发；事件流尾终止以收到
 * type === 'RUN_COMPLETED' 或 'RUN_FAILED' 为信号。</p>
 */
export async function streamAgentRun(opts: {
  agentId: string;
  request: InteractionContextRequest;
  onEvent: (event: RunEvent) => void;
  onError?: (e: unknown) => void;
  signal?: AbortSignal;
  pollIntervalMs?: number;
}) {
  try {
    const env = await buildContext(opts.request);
    const run = await createAgentRun({
      agentId: opts.agentId,
      goal: opts.request.message,
      envelopeId: env.envelopeId,
    });

    let afterSeq = 0;
    let done = false;
    while (!done) {
      if (opts.signal?.aborted) {
        await cancelAgentRun(run.runId).catch(() => undefined);
        return;
      }
      const events = await fetchRunEvents({
        runId: run.runId,
        afterSeq,
        signal: opts.signal,
      });
      for (const ev of events) {
        opts.onEvent(ev);
        afterSeq = Math.max(afterSeq, ev.seq);
        if (ev.type === 'RUN_COMPLETED' || ev.type === 'RUN_FAILED') {
          done = true;
        }
      }
      if (!done) {
        await new Promise((r) => setTimeout(r, opts.pollIntervalMs ?? 500));
      }
    }
  } catch (e) {
    opts.onError?.(e);
  }
}

/**
 * 列出 Run 的 Claim（GET /agent/runs/{runId}/claims）。
 */
export async function fetchClaims(runId: string): Promise<Array<{
  claimId: string; type: 'FACT' | 'INFERENCE' | 'RECOMMENDATION';
  content: string; confidence: number; evidenceRefs: string[];
}>> {
  const resp = await superAiApi.get(`/agent/runs/${runId}/claims`);
  return resp.data?.data ?? resp.data ?? [];
}

/**
 * 列出 Run 的 Evidence（GET /agent/runs/{runId}/evidence）。
 */
export async function fetchEvidence(runId: string): Promise<Array<{
  evidenceId: string; type: string; ref: string; fragment?: string | null;
}>> {
  const resp = await superAiApi.get(`/agent/runs/${runId}/evidence`);
  return resp.data?.data ?? resp.data ?? [];
}

/**
 * 列出 Run 的 Artifact（GET /agent/runs/{runId}/artifacts），含短期签名 URL。
 */
export async function fetchArtifacts(runId: string): Promise<Array<{
  artifactId: string; filename: string; contentType: string;
  signedUrl?: string | null;
}>> {
  const resp = await superAiApi.get(`/agent/runs/${runId}/artifacts`);
  return resp.data?.data ?? resp.data ?? [];
}