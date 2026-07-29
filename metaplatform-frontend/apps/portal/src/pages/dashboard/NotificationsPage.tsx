import { useState } from 'react';
import { Card, List, Tag, Typography, Space, Button, Segmented, Modal, Form, Switch, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  getNotificationSettings,
  updateNotificationSettings,
} from '@/api/notifications';
import type { NotificationItem, NotificationReadStatus, NotificationType, NotificationSettings } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { useAsync } from '@/hooks/useAsync';
import { StateContainer, PageHeader } from '@/components/common';
import { formatRelative } from '@/utils/datetime';

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
  const { settings } = useSettings();
  const [filter, setFilter] = useState<NotificationReadStatus>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form] = Form.useForm<NotificationSettings>();

  const { data: list, loading, error, reload } = useAsync<NotificationItem[]>(
    () => getNotifications(filter),
    [filter],
  );

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleMarkUnread = async (id: string) => {
    try {
      await markAsUnread(id);
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      reload();
      message.success('已全部标记为已读');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const openSettings = async () => {
    try {
      const s = await getNotificationSettings();
      form.setFieldsValue(s);
      setSettingsOpen(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载通知设置失败');
    }
  };

  const handleSaveSettings = async (values: NotificationSettings) => {
    try {
      await updateNotificationSettings(values);
      setSettingsOpen(false);
      message.success('通知设置已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const items = list ?? [];

  return (
    <>
      <PageHeader
        title="消息中心"
        subtitle={`共 ${items.length} 条 · 未读 ${items.filter((n: NotificationItem) => !n.read).length} 条`}
        extra={
          <Space>
            <Button onClick={handleMarkAll}>全部已读</Button>
            <Button onClick={openSettings}>通知设置</Button>
          </Space>
        }
      />
      <Card>
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
        <StateContainer
          loading={loading}
          error={error}
          isEmpty={!loading && !error && items.length === 0}
          emptyDescription="暂无通知"
          onRetry={reload}
        >
          <List<NotificationItem>
            dataSource={items}
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
                  avatar={<Tag color={TYPE_LABEL[item.type].color}>{TYPE_LABEL[item.type].label}</Tag>}
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
                          {formatRelative(item.createdAt, settings)}
                        </Typography.Text>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </StateContainer>
      </Card>

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
    </>
  );
}
