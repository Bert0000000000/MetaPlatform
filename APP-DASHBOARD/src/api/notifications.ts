import { get, post, put } from './client';
import type { NotificationItem, NotificationSettings, NotificationType } from '@/types';

const STORAGE_KEY = 'mate_dash_notifications';

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    type: 'approval',
    title: '新的审批待办',
    content: '张三提交了「采购审批 - 服务器采购申请」等待您审批',
    read: false,
    createdAt: '2026-07-17T09:05:00Z',
    link: '/dashboard',
  },
  {
    id: 'n2',
    type: 'task',
    title: '任务已完成',
    content: '数字员工「财务助手」已完成月度报销数据汇总任务',
    read: false,
    createdAt: '2026-07-17T08:30:00Z',
    link: '/dashboard',
  },
  {
    id: 'n3',
    type: 'system',
    title: '系统维护通知',
    content: '系统将于今晚 22:00 进行例行维护，预计 30 分钟',
    read: true,
    createdAt: '2026-07-16T16:00:00Z',
  },
  {
    id: 'n4',
    type: 'alert',
    title: 'API 错误率告警',
    content: 'API 错误率在过去 1 小时内超过阈值 1%',
    read: false,
    createdAt: '2026-07-17T10:00:00Z',
  },
];

function loadFromStorage(): NotificationItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as NotificationItem[];
  } catch {
    return [];
  }
}

function saveToStorage(items: NotificationItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function getNotifications(filter: 'all' | 'unread' | 'read' = 'all'): Promise<NotificationItem[]> {
  try {
    return await get<NotificationItem[]>('/v1/obs/notifications', { filter });
  } catch {
    const stored = loadFromStorage();
    const items = [...MOCK_NOTIFICATIONS, ...stored];
    if (filter === 'unread') return items.filter((n) => !n.read);
    if (filter === 'read') return items.filter((n) => n.read);
    return items;
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    return await get<number>('/v1/obs/notifications/unread-count');
  } catch {
    const items = [...MOCK_NOTIFICATIONS, ...loadFromStorage()];
    return items.filter((n) => !n.read).length;
  }
}

export async function markAsRead(id: string): Promise<void> {
  try {
    await post(`/v1/obs/notifications/${id}/read`);
  } catch {
    const stored = loadFromStorage();
    const mock = [...MOCK_NOTIFICATIONS];
    const item = mock.find((n) => n.id === id) || stored.find((n) => n.id === id);
    if (item) {
      item.read = true;
      saveToStorage(stored.filter((n) => n.id !== id).concat(item));
    }
  }
}

export async function markAllAsRead(): Promise<void> {
  try {
    await post('/v1/obs/notifications/read-all');
  } catch {
    const stored = loadFromStorage();
    const mock = MOCK_NOTIFICATIONS.map((n) => ({ ...n, read: true }));
    const merged: NotificationItem[] = [];
    for (const n of [...stored, ...mock]) {
      const existing = merged.find((m) => m.id === n.id);
      if (existing) {
        existing.read = true;
      } else {
        merged.push({ ...n, read: true });
      }
    }
    saveToStorage(merged);
  }
}

export async function markAsUnread(id: string): Promise<void> {
  try {
    await post(`/v1/obs/notifications/${id}/unread`);
  } catch {
    const stored = loadFromStorage();
    const mock = [...MOCK_NOTIFICATIONS];
    const item = mock.find((n) => n.id === id) || stored.find((n) => n.id === id);
    if (item) {
      item.read = false;
      saveToStorage(stored.filter((n) => n.id !== id).concat(item));
    }
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    return await get<NotificationSettings>('/v1/obs/notifications/settings');
  } catch {
    return {
      approval: true,
      task: true,
      system: true,
      mention: true,
      alert: true,
      email: false,
      push: true,
    };
  }
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await put('/v1/obs/notifications/settings', settings);
  } catch {
    localStorage.setItem('mate_dash_notif_settings', JSON.stringify(settings));
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
