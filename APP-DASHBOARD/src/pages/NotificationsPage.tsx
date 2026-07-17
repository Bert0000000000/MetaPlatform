import { useEffect, useState } from 'react';
import { Card, List, Tag, Typography, Space, Button, Segmented, Empty, Modal, Form, Switch, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markAsRead, markAsUnread, markAllAsRead, getNotificationSettings, updateNotificationSettings } from '@/api/notifications';
import type { NotificationItem, NotificationReadStatus, NotificationType, NotificationSettings } from '@/types';

const TYPE_LABEL: Record<NotificationType, { label: string; color: string }> = {
  approval: { label: '审批', color: 'blue' },
  task: { label: '任务', color: 'green' },
  system: { label: '系统', color: 'default' },
  mention: { label: '提及', color: 'purple' },
  alert: { label: '告警', color: 'red' },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  void navigate;
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<NotificationReadStatus>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setSettings] = useState<NotificationSettings | null>(null);
  const [form] = Form.useForm<NotificationSettings>();

  const load = async () => {
    setLoading(true);
    try {
      const items = await getNotifications(filter);
      setList(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    load();
  };

  const handleMarkUnread = async (id: string) => {
    await markAsUnread(id);
    load();
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    load();
    message.success('已全部标记为已读');
  };

  const openSettings = async () => {
    const s = await getNotificationSettings();
    setSettings(s);
    form.setFieldsValue(s);
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (values: NotificationSettings) => {
    await updateNotificationSettings(values);
    setSettings(values);
    setSettingsOpen(false);
    message.success('通知设置已保存');
  };

  return (
    <Card
      title="消息中心"
      extra={
        <Space>
          <Button onClick={handleMarkAll}>全部已读</Button>
          <Button onClick={openSettings}>通知设置</Button>
        </Space>
      }
    >
      <Segmented
        options={[
          { label: '全部', value: 'all' },
          { label: '未读', value: 'unread' },
          { label: '已读', value: 'read' },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as NotificationReadStatus)}
        style={{ marginBottom: 16 }}
      />
      {list.length === 0 ? (
        <Empty description="暂无通知" />
      ) : (
        <List
          loading={loading}
          dataSource={list}
          renderItem={(item) => (
            <List.Item
              actions={[
                item.read ? (
                  <Button key="unread" type="link" size="small" onClick={() => handleMarkUnread(item.id)}>
                    标为未读
                  </Button>
                ) : (
                  <Button key="read" type="link" size="small" onClick={() => handleMarkRead(item.id)}>
                    标为已读
                  </Button>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={
                  <Tag color={TYPE_LABEL[item.type].color}>{TYPE_LABEL[item.type].label}</Tag>
                }
                title={
                  <Space>
                    <Typography.Text strong={!item.read}>{item.title}</Typography.Text>
                    {!item.read && <Tag color="processing">未读</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <Typography.Text type="secondary">{item.content}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
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

      <Modal
        title="通知设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
          <Typography.Text strong>通知类型</Typography.Text>
          <Form.Item name="approval" label="审批通知" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="task" label="任务通知" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="system" label="系统通知" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="mention" label="提及通知" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="alert" label="告警通知" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Typography.Text strong>推送方式</Typography.Text>
          <Form.Item name="email" label="邮件推送" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="push" label="实时推送" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
