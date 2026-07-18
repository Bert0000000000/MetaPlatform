import { get, post, del } from './client';
import type { Conversation, ConversationCreateRequest, ChatMode } from '@/types';

export async function listConversations(params?: {
  keyword?: string;
  favorite?: boolean;
  mode?: ChatMode;
}): Promise<Conversation[]> {
  return get<Conversation[]>('/v1/conversations', params as Record<string, unknown> | undefined);
}

export async function createConversation(request: ConversationCreateRequest): Promise<Conversation> {
  return post<Conversation>('/v1/conversations', request);
}

export async function getConversation(id: string): Promise<Conversation> {
  return get<Conversation>(`/v1/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await del<void>(`/v1/conversations/${id}`);
}

export async function toggleFavorite(id: string): Promise<Conversation> {
  return post<Conversation>(`/v1/conversations/${id}/favorite`);
}

export async function searchConversations(keyword: string): Promise<Conversation[]> {
  return listConversations({ keyword });
}
