import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Dropdown, List, Typography, Space, Empty } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { getNotifications, markAsRead, markAllAsRead, getUnreadCount } from '@/api/notifications';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import type { NotificationItem, NotificationType } from '@/types';

const TYPE_ICON: Record<NotificationType, string> = {
  approval: '📋',
  task: '✅',
  system: '⚙️',
  mention: '💬',
  alert: '⚠️',
};

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

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

  const dropdownContent = (
    <div style={{ width: 360, background: '#fff', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.12)', maxHeight: 480, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Typography.Text strong>通知</Typography.Text>
        <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAll} disabled={unread === 0}>
          全部已读
        </Button>
      </div>
      {list.length === 0 ? (
        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
      ) : (
        <List
          dataSource={list.slice(0, 20)}
          renderItem={(item) => (
            <List.Item
              style={{ padding: '12px 16px', cursor: 'pointer', background: item.read ? 'transparent' : '#f0f5ff' }}
              onClick={() => !item.read && handleMarkRead(item.id)}
            >
              <List.Item.Meta
                avatar={<span style={{ fontSize: 20 }}>{TYPE_ICON[item.type]}</span>}
                title={
                  <Space>
                    <Typography.Text strong={!item.read}>{item.title}</Typography.Text>
                    {!item.read && <Badge status="processing" />}
                  </Space>
                }
                description={
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.content}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </Typography.Text>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown dropdownRender={() => dropdownContent} trigger={['click']} open={open} onOpenChange={setOpen} placement="bottomRight">
      <Badge count={unread} size="small">
        <Button type="text" icon={<BellOutlined />} style={{ fontSize: 18 }} />
      </Badge>
    </Dropdown>
  );
}
