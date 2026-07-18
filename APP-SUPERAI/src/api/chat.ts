import { getToken, getUser } from '@/utils/auth';
import type { Citation } from '@/types';

export interface StreamMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: (citations: Citation[]) => void;
  onError: (message: string) => void;
}

export async function streamChat(
  messages: StreamMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const user = getUser();

  let response: Response;
  try {
    response = await fetch('/api/v1/llmgw/chat/completions/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: 'doubao-pro-32k',
        messages,
        temperature: 0.7,
        maxTokens: 2048,
        user: user?.id,
        appId: 'app-superai',
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      callbacks.onDone([]);
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
          callbacks.onDelta(parsed.choices[0].delta.content ?? '');
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

  callbacks.onDone(citations);
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
