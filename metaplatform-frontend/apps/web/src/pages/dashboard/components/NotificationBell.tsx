import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Badge, Button, Dropdown, Typography, Space, Empty, Tabs, Popconfirm, Tooltip } from '@douyinfe/semi-ui';
import { BellOutlined, CheckOutlined, ClearOutlined } from '@ant-design/icons';
import { getNotifications, markAsRead, markAllAsRead, getUnreadCount } from '@/api/dashboard/notifications';
import { useWebSocket, type WsMessage } from '../hooks/useWebSocket';
import type { NotificationItem, NotificationType, NotificationCategory } from '@/api/dashboard/types';
import { categorizeNotification } from '@/api/dashboard/types';
import {
  IconList,
  IconTick,
  IconSetting,
  IconComment,
  IconAlertTriangle,
} from '@douyinfe/semi-icons';

const { Text } = Typography;

const TYPE_ICON: Record<NotificationType, ReactNode> = {
  approval: <IconList size="small" />,
  task: <IconTick size="small" />,
  system: <IconSetting size="small" />,
  mention: <IconComment size="small" />,
  alert: <IconAlertTriangle size="small" />,
};

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  all: '全部',
  system: '系统',
  workflow: '流程',
  alert: '告警',
};

const CATEGORY_ORDER: NotificationCategory[] = ['all', 'system', 'workflow', 'alert'];

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');

  const loadUnread = useCallback(async () => {
    const count = await getUnreadCount();
    setUnread(count);
  }, []);

  const loadList = useCallback(async () => {
    const items = await getNotifications('all');
    setList(items);
  }, []);

  useEffect(() => {
    loadUnread();
    loadList();
  }, [loadUnread, loadList]);

  const handleWsMessage = useCallback((msg: WsMessage) => {
    const item: NotificationItem = {
      id: `ws_${Date.now()}`,
      type: (msg.type as NotificationType) || 'system',
      title: msg.title,
      content: msg.content,
      read: false,
      createdAt: msg.timestamp || new Date().toISOString(),
    };
    setList((prev) => [item, ...prev]);
    setUnread((prev) => prev + 1);
  }, []);

  useWebSocket({ onMessage: handleWsMessage });

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  // 一键清空：本地清空列表并重置未读数。
  // 后端目前未提供 delete 接口，因此采用客户端清空 + 通知提示策略。
  const handleClearAll = () => {
    setList([]);
    setUnread(0);
  };

  // 按分类聚合的列表与未读计数，供 Tabs 徽标与列表渲染使用。
  const categoryStats = useMemo(() => {
    const stats: Record<NotificationCategory, { total: number; unread: number }> = {
      all: { total: 0, unread: 0 },
      system: { total: 0, unread: 0 },
      workflow: { total: 0, unread: 0 },
      alert: { total: 0, unread: 0 },
    };
    for (const item of list) {
      const cat = categorizeNotification(item.type);
      stats.all.total += 1;
      if (!item.read) stats.all.unread += 1;
      stats[cat].total += 1;
      if (!item.read) stats[cat].unread += 1;
    }
    return stats;
  }, [list]);

  const filteredList = useMemo(() => {
    if (activeCategory === 'all') return list;
    return list.filter((item) => categorizeNotification(item.type) === activeCategory);
  }, [list, activeCategory]);

  const dropdownContent = (
    <div
      style={{
        width: 380,
        background: 'var(--card)',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
        maxHeight: 520,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Text strong>通知</Text>
        <Space spacing="tight">
          <Tooltip content="将当前可见通知全部标记为已读">
            <Button
              theme="borderless"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleMarkAll}
              disabled={unread === 0}
            >
              全部已读
            </Button>
          </Tooltip>
          <Popconfirm
            title="确认清空通知列表？"
            content="将清空当前所有通知（含未读），不可恢复。"
            okText="清空"
            cancelText="取消"
            okType="danger"
            onConfirm={handleClearAll}
            disabled={list.length === 0}
          >
            <Tooltip content="清空所有通知">
              <Button theme="borderless" size="small" type="danger" icon={<ClearOutlined />} disabled={list.length === 0}>
                清空
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      </div>

      <Tabs
        activeKey={activeCategory}
        onChange={(key) => setActiveCategory(key as NotificationCategory)}
        size="small"
        style={{ padding: '0 16px', margin: 0 }}
      >
        {CATEGORY_ORDER.map((cat) => {
          const stat = categoryStats[cat];
          const label = (
            <Space spacing={4}>
              <span>{CATEGORY_LABELS[cat]}</span>
              {stat.unread > 0 ? (
                <Badge count={stat.unread} />
              ) : (
                stat.total > 0 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {stat.total}
                  </Text>
                )
              )}
            </Space>
          );
          return (
            <Tabs.TabPane key={cat} itemKey={cat} tab={label} />
          );
        })}
      </Tabs>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredList.length === 0 ? (
          <Empty
            description={activeCategory === 'all' ? '暂无通知' : `暂无${CATEGORY_LABELS[activeCategory]}通知`}
            style={{ padding: 32 }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredList.slice(0, 50).map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: item.read ? 'transparent' : 'var(--semi-color-primary-light-default)',
                  borderBottom: '1px solid var(--muted)',
                }}
                onClick={() => !item.read && handleMarkRead(item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: 20 }}>{TYPE_ICON[item.type]}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <Space spacing={8}>
                        <Text strong={!item.read}>{item.title}</Text>
                        {!item.read && <Badge dot type="primary" />}
                      </Space>
                    </div>
                    <div style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.content}
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dropdown render={dropdownContent} trigger="click" visible={open} onVisibleChange={setOpen} position="bottomRight">
      <Badge count={unread}>
        <Button theme="borderless" icon={<BellOutlined />} style={{ fontSize: 18 }} />
      </Badge>
    </Dropdown>
  );
}
