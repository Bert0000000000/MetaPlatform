import { get, post, del } from './client';
import type { Conversation, ConversationCreateRequest, ChatMode } from '@/types';

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
  const res = await get<PageResult<Conversation>>('/v1/copilot/conversations', params as Record<string, unknown> | undefined);
  return res?.items ?? [];
}

export async function createConversation(request: ConversationCreateRequest): Promise<Conversation> {
  return post<Conversation>('/v1/copilot/conversations', {
    agentId: 'default',
    title: request.title,
    mode: request.mode,
  });
}

export async function getConversation(id: string): Promise<Conversation> {
  return get<Conversation>(`/v1/copilot/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await del<void>(`/v1/copilot/conversations/${id}`);
}

export async function toggleFavorite(id: string): Promise<Conversation> {
  return post<Conversation>(`/v1/copilot/conversations/${id}/favorite`);
}

export async function getHistory(
  id: string,
  params?: { page?: number; pageSize?: number },
): Promise<ConversationMessage[]> {
  const res = await get<PageResult<ConversationMessage>>(
    `/v1/copilot/conversations/${id}/messages`,
    params as Record<string, unknown> | undefined,
  );
  return res?.items ?? [];
}

export async function searchConversations(keyword: string): Promise<Conversation[]> {
  return listConversations({ keyword });
}
