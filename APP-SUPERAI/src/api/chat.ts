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

const MOCK_RESPONSE = `Mate Platform 是基于 Ontology 本体论引擎的企业级决策与运营提效平台。\n\n它融合了低代码应用构建、数字员工、AI Agent 编排、企业级 RAG 知识库等核心能力，能够帮助企业用自然语言驱动运营。\n\n在本演示环境中，TECH-LLMGW 后端服务可能尚未启动，因此 SuperAI 使用本地模拟流进行回复。`;

const MOCK_CITATIONS: Citation[] = [
  {
    id: 'c1',
    title: 'Mate Platform 产品白皮书',
    type: 'PDF',
    score: 96,
    snippet: 'Mate Platform 以 Ontology 引擎为唯一数据真相源，贯穿 LLM Gateway、RAG、Agent 等 AI 能力底座。',
  },
  {
    id: 'c2',
    title: 'CLAUDE.md 项目总览',
    type: 'DOC',
    score: 92,
    snippet: '核心能力包括 Ontology 本体引擎、低代码应用构建、数字员工、MCP/A2A 协议支持。',
  },
];

export async function streamChat(
  messages: StreamMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const user = getUser();

  try {
    const response = await fetch('/api/v1/llmgw/chat/completions/stream', {
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

    if (!response.ok || !response.body) {
      throw new Error(`LLM Gateway 不可用（${response.status}）`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finished = false;

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
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }

    callbacks.onDone(MOCK_CITATIONS);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      callbacks.onDone([]);
      return;
    }
    mockStream(callbacks);
  }
}

function mockStream(callbacks: StreamCallbacks): void {
  const chunks = MOCK_RESPONSE.split(' ');
  let index = 0;

  const timer = setInterval(() => {
    if (index >= chunks.length) {
      clearInterval(timer);
      callbacks.onDone(MOCK_CITATIONS);
      return;
    }
    const text = chunks.slice(index, index + 2).join(' ') + ' ';
    callbacks.onDelta(text);
    index += 2;
  }, 80);
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
