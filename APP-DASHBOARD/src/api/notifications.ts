import { get, post, put } from './client';
import type { NotificationItem, NotificationSettings, NotificationType } from '@/types';

export async function getNotifications(filter: 'all' | 'unread' | 'read' = 'all'): Promise<NotificationItem[]> {
  return get<NotificationItem[]>('/v1/obs/notifications', { filter });
}

export async function getUnreadCount(): Promise<number> {
  return get<number>('/v1/obs/notifications/unread-count');
}

export async function markAsRead(id: string): Promise<void> {
  await post(`/v1/obs/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await post('/v1/obs/notifications/read-all');
}

export async function markAsUnread(id: string): Promise<void> {
  await post(`/v1/obs/notifications/${id}/unread`);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return get<NotificationSettings>('/v1/obs/notifications/settings');
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<void> {
  await put('/v1/obs/notifications/settings', settings);
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
