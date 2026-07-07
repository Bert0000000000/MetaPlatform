/**
 * LLM Gateway API client
 * Connects frontend to the /api/llm backend proxy
 */
const LLM_BASE = "/api/llm";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  finishReason?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface CompletionResponse {
  id: string;
  model: string;
  text: string;
  finishReason?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface EmbeddingResponse {
  model: string;
  embeddings: Array<{
    index: number;
    embedding: number[];
  }>;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

interface ModelInfo {
  id: string;
  provider: string;
  type: "chat" | "embedding";
}

interface UsageStats {
  totalTokens: number;
  requests: number;
  period: string;
  byModel: Array<{
    model: string;
    totalTokens: number;
    requests: number;
  }>;
  byType: Array<{
    request_type: string;
    totalTokens: number;
    requests: number;
  }>;
  daily: Array<{
    date: string;
    totalTokens: number;
    requests: number;
  }>;
}

export const llmApi = {
  /**
   * Send chat message to LLM
   */
  chat: async (
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<ChatResponse> => {
    // Don't hardcode a model — the backend /api/llm/chat falls back to
    // whatever the operator saved in [AI Gateway 配置]. Only pass `model`
    // when the caller explicitly asks for a different one (e.g. a model
    // picker in the UI). Falling back to "gpt-4o-mini" here used to win
    // over the configured qwen3.7-plus / deepseek-chat / etc. and broke
    // every AI Assistant call for non-OpenAI providers.
    const body: Record<string, unknown> = {
      messages,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens,
    };
    if (options?.model) body.model = options.model;
    const res = await fetch(`${LLM_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "LLM request failed");
    return json.data;
  },

  /**
   * Text completion
   */
  completion: async (
    prompt: string,
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<CompletionResponse> => {
    const res = await fetch(`${LLM_BASE}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Completion request failed");
    return json.data;
  },

  /**
   * Generate embeddings
   */
  embedding: async (
    input: string | string[],
    model?: string
  ): Promise<EmbeddingResponse> => {
    const res = await fetch(`${LLM_BASE}/embedding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, model }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Embedding request failed");
    return json.data;
  },

  /**
   * List available models
   */
  listModels: async (): Promise<ModelInfo[]> => {
    const res = await fetch(`${LLM_BASE}/models`);
    const json = await res.json();
    return json.data;
  },

  /**
   * Get token usage stats
   */
  getUsage: async (days?: number): Promise<UsageStats> => {
    const url = days ? `${LLM_BASE}/usage?days=${days}` : `${LLM_BASE}/usage`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data;
  },
};
