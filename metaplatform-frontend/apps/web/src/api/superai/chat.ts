import { createApiClient, apiPath } from '@mate/shared/api';

export const apiClient = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await apiClient.get<T>(url, params ? { params } : undefined)); }
export async function post<T>(url: string, body?: unknown): Promise<T> { return data(await apiClient.post<T>(url, body)); }
export async function put<T>(url: string, body?: unknown): Promise<T> { return data(await apiClient.put<T>(url, body)); }
export async function del<T>(url: string): Promise<T> { return data(await apiClient.delete<T>(url)); }

import type {
  Citation,
  MultimodalModel,
  RoutingCandidate,
  RoutingDecision,
  RoutingSelected,
  RoutingTakenPath,
} from './types';
import { getToken, getUser } from '@mate/shared';
export interface StreamMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: (content: string, citations: Citation[]) => void;
  onError: (message: string) => void;
}
export interface AgentCallEvent {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
}
export interface AgentResultEvent {
  callId: string;
  status: 'success' | 'error';
  result: Record<string, unknown>;
}
export interface RoutingDecisionEvent {
  decision: RoutingDecision;
}
export interface StreamAgentCallbacks {
  onReasoning?: (text: string) => void;
  onToolCall?: (call: AgentCallEvent) => void;
  onToolResult?: (result: AgentResultEvent) => void;
  onRoutingDecision?: (event: RoutingDecisionEvent) => void;
  onDelta: (text: string) => void;
  onDone: (content: string, citations: Citation[]) => void;
  onError: (message: string) => void;
}
export interface MultimodalResponse {
  id: string;
  model: string;
  provider: string;
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}
export async function listMultimodalModels(): Promise<MultimodalModel[]> {
  const resp = await get<{ items: MultimodalModel[]; total: number }>(
    '/models/multimodal',
  );
  return (resp.items ?? []).map((m: any) => ({
    modelId: m.modelId ?? m.id,
    provider: m.provider ?? '',
    modelCode: m.modelCode ?? m.id ?? '',
    displayName: m.displayName ?? m.name ?? m.id,
    type: m.type ?? m.modality ?? 'multimodal',
    inputPrice: m.inputPrice ?? 0,
    outputPrice: m.outputPrice ?? 0,
    contextLength: m.contextLength ?? 4096,
    capabilities: m.capabilities ?? [],
    enabled: m.enabled ?? (m.status === 'available'),
    description: m.description,
  }));
}
export async function multimodalUploadChat(params: {
  modelId: string;
  text: string;
  images: File[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  conversationId?: string;
}): Promise<MultimodalResponse> {
  const formData = new FormData();
  formData.append('modelId', params.modelId);
  formData.append('text', params.text);
  formData.append('temperature', String(params.temperature ?? 0.7));
  formData.append('maxTokens', String(params.maxTokens ?? 1024));
  if (params.systemPrompt) {
    formData.append('systemPrompt', params.systemPrompt);
  }
  if (params.conversationId) {
    formData.append('conversationId', params.conversationId);
  }
  for (const image of params.images) {
    formData.append('image', image);
  }
  const response = await apiClient.post('/chat/multimodal/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data as MultimodalResponse;
}
export async function streamChat(
  messages: StreamMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  options?: { model?: string; temperature?: number; maxTokens?: number; conversationId?: string },
): Promise<void> {
  const token = getToken();
  const user = getUser();
  let response: Response;
  try {
    response = await fetch('/api/v1/copilot/chat/completions/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: options?.model ?? 'doubao-pro-32k',
        messages,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 2048,
        user: user?.id,
        appId: 'app-superai',
        ...(options?.conversationId ? { conversationId: options.conversationId } : {}),
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      callbacks.onDone('', []);
      return;
    }
    callbacks.onError(error instanceof Error ? error.message : 'LLM 流式请求失败');
    return;
  }
  if (!response.ok || !response.body) {
    callbacks.onError(`LLM Gateway 不可用（${response.status}）`);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finished = false;
  let fullContent = '';
  const citations: Citation[] = [];
  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as unknown;
        if (isContentDelta(parsed)) {
          const delta = parsed.choices[0].delta.content ?? '';
          fullContent += delta;
          callbacks.onDelta(delta);
        } else if (isErrorEvent(parsed)) {
          callbacks.onError(parsed.errorMessage || 'LLM 流式失败');
          finished = true;
        } else if (isCompletionEvent(parsed)) {
          finished = true;
        } else if (isCitationEvent(parsed)) {
          citations.push(...(parsed.citations ?? []));
        }
      } catch {
        // 忽略无法解析的行
      }
    }
  }
  callbacks.onDone(fullContent, citations);
}

/**
 * SuperAI agent loop stream: LLM decides → orchestrator dispatches digital
 * employees → result fed back. Streams typed events alongside the final
 * answer so the UI can render the scheduling process in real time.
 */
export async function streamAgentChat(
  messages: StreamMessage[],
  callbacks: StreamAgentCallbacks,
  signal?: AbortSignal,
  options?: { model?: string; temperature?: number; maxTokens?: number; conversationId?: string },
): Promise<void> {
  const token = getToken();
  const user = getUser();
  let response: Response;
  try {
    response = await fetch('/api/v1/copilot/chat/agent/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: options?.model ?? 'doubao-pro-32k',
        messages,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 2048,
        user: user?.id,
        appId: 'app-superai',
        ...(options?.conversationId ? { conversationId: options.conversationId } : {}),
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      callbacks.onDone('', []);
      return;
    }
    callbacks.onError(error instanceof Error ? error.message : 'Agent 请求失败');
    return;
  }
  if (!response.ok || !response.body) {
    callbacks.onError(`Agent 端点不可用（${response.status}）`);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finished = false;
  let fullContent = '';
  const citations: Citation[] = [];
  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as unknown;
        const routingDecision = parseRoutingDecisionEvent(parsed);
        if (routingDecision) {
          callbacks.onRoutingDecision?.({ decision: routingDecision });
          continue;
        }
        if (!isObjectRecord(parsed)) continue;
        const type = parsed.type as string | undefined;
        if (type === 'reasoning') {
          callbacks.onReasoning?.(String(parsed.text ?? ''));
        } else if (type === 'tool_call') {
          callbacks.onToolCall?.({
            callId: String(parsed.callId ?? ''),
            tool: String(parsed.tool ?? ''),
            args: (parsed.args as Record<string, unknown>) ?? {},
          });
        } else if (type === 'tool_result') {
          callbacks.onToolResult?.({
            callId: String(parsed.callId ?? ''),
            status: parsed.status === 'error' ? 'error' : 'success',
            result: (parsed.result as Record<string, unknown>) ?? {},
          });
        } else if (isContentDelta(parsed)) {
          const delta = parsed.choices[0].delta.content ?? '';
          fullContent += delta;
          callbacks.onDelta(delta);
        } else if (typeof parsed.errorMessage === 'string') {
          callbacks.onError(parsed.errorMessage || 'Agent 流式失败');
          finished = true;
        } else if (Array.isArray(parsed.citations)) {
          citations.push(...(parsed.citations as Citation[]));
        }
      } catch {
        // 忽略无法解析的行
      }
    }
  }
  callbacks.onDone(fullContent, citations);
}
interface DeltaEvent {
  choices: Array<{
    delta: { content?: string };
    finishReason?: string | null;
  }>;
}
interface ErrorEvent {
  errorMessage?: string;
}
interface CompletionEvent {
  choices: Array<{ finishReason?: string | null }>;
}
interface CitationEvent {
  citations?: Citation[];
}
function isContentDelta(value: unknown): value is DeltaEvent {
  const event = value as DeltaEvent;
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(event.choices) &&
    event.choices[0]?.delta?.content !== undefined
  );
}
function isErrorEvent(value: unknown): value is ErrorEvent {
  return typeof value === 'object' && value !== null && 'errorMessage' in value;
}
function isCompletionEvent(value: unknown): value is CompletionEvent {
  const event = value as CompletionEvent;
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(event.choices) &&
    event.choices[0]?.finishReason !== undefined &&
    event.choices[0]?.finishReason !== null
  );
}
function isCitationEvent(value: unknown): value is CitationEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'citations' in value &&
    Array.isArray((value as CitationEvent).citations)
  );
}

export function parseRoutingDecisionEvent(value: unknown): RoutingDecision | null {
  if (!isObjectRecord(value) || value.type !== 'routing_decision') return null;

  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];
  const candidates: RoutingCandidate[] = rawCandidates
    .filter(isObjectRecord)
    .map((candidate) => ({
      role_slug: typeof candidate.role_slug === 'string' ? candidate.role_slug : '',
      role_rid: typeof candidate.role_rid === 'string' ? candidate.role_rid : undefined,
      display_name:
        typeof candidate.display_name === 'string'
          ? candidate.display_name
          : typeof candidate.role_slug === 'string'
            ? candidate.role_slug
            : '',
      capability_tags: Array.isArray(candidate.capability_tags)
        ? candidate.capability_tags.filter((tag): tag is string => typeof tag === 'string')
        : undefined,
      similarity: typeof candidate.similarity === 'number' ? candidate.similarity : 0,
      reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
    }));

  const selected = parseRoutingSelected(value.selected);
  const takenPath = parseTakenPath(value.taken_path);
  return {
    candidates,
    selected,
    taken_path: takenPath,
    reason:
      typeof value.reason === 'string'
        ? value.reason
        : selected?.reason ?? (candidates.length === 0 ? 'no candidates' : 'semantic_router pre-screen'),
    stage: value.stage === 'final' ? 'final' : 'pre_screen',
    outcome: value.outcome === 'selected' || value.outcome === 'denied' ? value.outcome : null,
    reason_code: typeof value.reason_code === 'string' ? value.reason_code : null,
    policy_version: typeof value.policy_version === 'string' ? value.policy_version : null,
    seq: typeof value.seq === 'number' ? value.seq : 0,
    ts: typeof value.ts === 'string' ? value.ts : new Date().toISOString(),
  };
}

function parseRoutingSelected(value: unknown): RoutingSelected | null {
  if (typeof value === 'string' && value.length > 0) return { role_slug: value };
  if (!isObjectRecord(value)) return null;
  const roleSlug = typeof value.role_slug === 'string' ? value.role_slug : '';
  return roleSlug
    ? { role_slug: roleSlug, reason: typeof value.reason === 'string' ? value.reason : undefined }
    : null;
}

function parseTakenPath(value: unknown): RoutingTakenPath | null {
  return value === 'llm_fc' || value === 'semantic_router' || value === 'dispatcher' || value === 'keyword_fallback'
    ? value
    : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
