import { get, post, put } from './client';
import type { NotificationItem, NotificationSettings, NotificationType } from '@/types';

const SETTINGS_KEY = 'mate_platform_notification_settings';

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'ntf-001',
    type: 'system',
    title: '系统初始化完成',
    content: 'Mate Platform 本地开发环境已就绪。',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ntf-002',
    type: 'task',
    title: '销售助手完成了一项任务',
    content: '客户跟进任务已自动记录到 CRM。',
    read: true,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: 'ntf-003',
    type: 'approval',
    title: '请假审批待处理',
    content: '张三提交的请假申请需要您审批。',
    read: false,
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
];

export async function getNotifications(filter: 'all' | 'unread' | 'read' = 'all'): Promise<NotificationItem[]> {
  try {
    return await get<NotificationItem[]>('/v1/obs/notifications', { filter });
  } catch {
    // Backend not ready; fall back to local mock data.
    if (filter === 'unread') return MOCK_NOTIFICATIONS.filter((n) => !n.read);
    if (filter === 'read') return MOCK_NOTIFICATIONS.filter((n) => n.read);
    return MOCK_NOTIFICATIONS;
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    return await get<number>('/v1/obs/notifications/unread-count');
  } catch {
    return MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
  }
}

export async function markAsRead(id: string): Promise<void> {
  try {
    await post(`/v1/obs/notifications/${id}/read`);
  } catch {
    // Backend not ready: local-only update below.
  }
  updateLocalReadStatus(id, true);
}

export async function markAllAsRead(): Promise<void> {
  try {
    await post('/v1/obs/notifications/read-all');
  } catch {
    // Backend not ready: local-only update below.
  }
  MOCK_NOTIFICATIONS.forEach((n) => {
    n.read = true;
  });
}

export async function markAsUnread(id: string): Promise<void> {
  try {
    await post(`/v1/obs/notifications/${id}/unread`);
  } catch {
    // Backend not ready: local-only update below.
  }
  updateLocalReadStatus(id, false);
}

function updateLocalReadStatus(id: string, read: boolean): void {
  const item = MOCK_NOTIFICATIONS.find((n) => n.id === id);
  if (item) {
    item.read = read;
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    return await get<NotificationSettings>('/v1/obs/notifications/settings');
  } catch {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw) as NotificationSettings;
    } catch {
      // ignore
    }
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
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await put('/v1/obs/notifications/settings', settings);
  } catch {
    // Backend not ready: persist locally.
  }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
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
