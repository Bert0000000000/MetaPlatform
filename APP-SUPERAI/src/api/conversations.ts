import { get, post, del } from './client';
import type { Conversation, ConversationCreateRequest, ChatMode } from '@/types';

const STORAGE_KEY = 'app_superai_conversations';

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface StoredConversation extends Conversation {
  messages?: unknown[];
}

function loadConversations(): StoredConversation[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredConversation[];
  } catch {
    return [];
  }
}

function saveConversations(items: StoredConversation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function listConversations(params?: {
  keyword?: string;
  favorite?: boolean;
  mode?: ChatMode;
}): Promise<Conversation[]> {
  try {
    return await get<Conversation[]>('/v1/conversations', params as Record<string, unknown>);
  } catch {
    let items = loadConversations();
    if (params?.keyword) {
      const k = params.keyword.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(k) || c.preview.toLowerCase().includes(k));
    }
    if (params?.favorite) {
      items = items.filter((c) => c.favorite);
    }
    if (params?.mode) {
      items = items.filter((c) => c.mode === params.mode);
    }
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

export async function createConversation(request: ConversationCreateRequest): Promise<Conversation> {
  try {
    return await post<Conversation>('/v1/conversations', request);
  } catch {
    const items = loadConversations();
    const conv: StoredConversation = {
      id: generateId(),
      title: request.title,
      mode: request.mode,
      favorite: false,
      messageCount: 0,
      createdAt: now(),
      updatedAt: now(),
      preview: '',
    };
    saveConversations([conv, ...items]);
    return conv;
  }
}

export async function getConversation(id: string): Promise<Conversation> {
  try {
    return await get<Conversation>(`/v1/conversations/${id}`);
  } catch {
    const item = loadConversations().find((c) => c.id === id);
    if (!item) throw new Error('会话不存在');
    return item;
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await del<void>(`/v1/conversations/${id}`);
  } catch {
    const items = loadConversations().filter((c) => c.id !== id);
    saveConversations(items);
  }
}

export async function toggleFavorite(id: string): Promise<Conversation> {
  const items = loadConversations();
  const idx = items.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('会话不存在');
  items[idx].favorite = !items[idx].favorite;
  items[idx].updatedAt = now();
  saveConversations(items);
  return items[idx];
}

export async function searchConversations(keyword: string): Promise<Conversation[]> {
  return listConversations({ keyword });
}
