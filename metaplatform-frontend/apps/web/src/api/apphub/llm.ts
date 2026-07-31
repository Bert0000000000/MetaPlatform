import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('llmgw', '') });
const data = <T>(resp: { data: T }): T => resp.data;


import type { ChatMessage } from './types/ai-designer';

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  autoRoute?: boolean;
  stream?: boolean;
  temperature?: number;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
}

export async function chatCompletions(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const response = await client.post('/chat/completions', req);
  return response.data as ChatCompletionResponse;
}
