import { get, post, put } from './client';
import type { NotificationItem, NotificationSettings, NotificationType } from '@/types';
import { getUser } from '@/utils/auth';

function getUserId(): string | undefined {
  return getUser()?.id;
}

export async function getNotifications(filter: 'all' | 'unread' | 'read' = 'all'): Promise<NotificationItem[]> {
  const userId = getUserId();
  if (!userId) return [];
  const items = await get<NotificationItem[]>('/v1/obs/notifications', {
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
  const count = await get<number>('/v1/obs/notifications/unread-count', { userId });
  return typeof count === 'number' ? count : 0;
}

export async function markAsRead(id: string): Promise<void> {
  await put(`/v1/obs/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  await post(`/v1/obs/notifications/read-all?userId=${encodeURIComponent(userId)}`);
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
  return get<NotificationSettings>('/v1/obs/notifications/settings', { userId });
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  await put('/v1/obs/notifications/settings', { ...settings, userId });
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
