import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { Conversation, ConversationCreateRequest, ChatMode } from './types';
interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
export async function listConversations(params?: {
  keyword?: string;
  favorite?: boolean;
  mode?: ChatMode;
}): Promise<Conversation[]> {
  const res = await get<PageResult<Conversation>>('/conversations', params as Record<string, unknown> | undefined);
  return res?.items ?? [];
}
export async function createConversation(request: ConversationCreateRequest): Promise<Conversation> {
  return post<Conversation>('/conversations', {
    agentId: 'default',
    title: request.title,
    mode: request.mode,
  });
}
export async function getConversation(id: string): Promise<Conversation> {
  return get<Conversation>(`/conversations/${id}`);
}
export async function deleteConversation(id: string): Promise<void> {
  await del<void>(`/conversations/${id}`);
}
export async function toggleFavorite(id: string): Promise<Conversation> {
  return post<Conversation>(`/conversations/${id}/favorite`);
}
export async function getHistory(
  id: string,
  params?: { page?: number; pageSize?: number },
): Promise<ConversationMessage[]> {
  const res = await get<PageResult<ConversationMessage>>(
    `/conversations/${id}/messages`,
    params as Record<string, unknown> | undefined,
  );
  return res?.items ?? [];
}
export async function searchConversations(keyword: string): Promise<Conversation[]> {
  return listConversations({ keyword });
}
