import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('dashboard', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}



import type { NotificationItem, NotificationSettings, NotificationType } from './types';
import { getUser } from '@mate/shared';

function getUserId(): string | undefined {
  return getUser()?.id;
}

export async function getNotifications(filter: 'all' | 'unread' | 'read' = 'all'): Promise<NotificationItem[]> {
  const userId = getUserId();
  if (!userId) return [];
  const items = await get<NotificationItem[]>('/notifications', {
    userId,
    status: filter,
    limit: 50,
    offset: 0,
  });
  return Array.isArray(items) ? items : [];
}

export async function getUnreadCount(): Promise<number> {
  const userId = getUserId();
  if (!userId) return 0;
  const count = await get<number>('/notifications/unread-count', { userId });
  return typeof count === 'number' ? count : 0;
}

export async function markAsRead(id: string): Promise<void> {
  await put(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  await post(`/notifications/read-all?userId=${encodeURIComponent(userId)}`);
}

export async function markAsUnread(id: string): Promise<void> {
  // TODO: backend unread reset support
  console.warn('markAsUnread not supported yet', id);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const userId = getUserId();
  if (!userId) {
    return {
      approval: true,
      task: true,
      system: true,
      mention: true,
      alert: true,
      email: false,
      push: false,
    };
  }
  return get<NotificationSettings>('/notifications/settings', { userId });
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  await put('/notifications/settings', { ...settings, userId });
}

export function createLocalNotification(type: NotificationType, title: string, content: string): NotificationItem {
  return {
    id: `local_${Date.now()}`,
    type,
    title,
    content,
    read: false,
    createdAt: new Date().toISOString(),
  };
}
