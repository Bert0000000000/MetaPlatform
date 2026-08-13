import { useApiErrorBoundary } from '@mate/shared';
import type { NormalizedError } from '@mate/shared';
import { useState } from 'react';
import { Card, Tag, Typography, Space, Button, Radio, Modal, Form, Switch, Toast } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
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

const { Text } = Typography;

const TYPE_LABEL: Record<NotificationType, { label: string; color: TagColor }> = {
  approval: { label: '审批', color: 'blue' },
  task: { label: '任务', color: 'green' },
  system: { label: '系统', color: 'grey' },
  mention: { label: '提及', color: 'purple' },
  alert: { label: '告警', color: 'red' },
};

export default function NotificationsPage() {
  const { report } = useApiErrorBoundary();
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
      report(e);
    }
  };

  const handleMarkUnread = async (id: string) => {
    try {
      await markAsUnread(id);
      reload();
    } catch (e) {
      report(e);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      reload();
      Toast.success('已全部标记为已读');
    } catch (e) {
      report(e);
    }
  };

  const openSettings = async () => {
    try {
      const s = await getNotificationSettings();
      form.setValues(s);
      setSettingsOpen(true);
    } catch (e) {
      report(e);
    }
  };

  const handleSaveSettings = async (values: NotificationSettings) => {
    try {
      await updateNotificationSettings(values);
      setSettingsOpen(false);
      Toast.success('通知设置已保存');
    } catch (e) {
      report(e);
    }
  };

  const items = list ?? [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          {`共 ${items.length} 条 · 未读 ${items.filter((n: NotificationItem) => !n.read).length} 条`}
        </span>
        <Space>
          <Button onClick={handleMarkAll}>全部已读</Button>
          <Button onClick={openSettings}>通知设置</Button>
        </Space>
      </div>
      <Card>
        <Radio.Group
          type="button"
          options={[
            { label: '全部', value: 'all' },
            { label: '未读', value: 'unread' },
            { label: '已读', value: 'read' },
          ]}
          value={filter}
          onChange={(e) => setFilter(e.target.value as NotificationReadStatus)}
          style={{ marginBottom: 16 }}
        />
        <StateContainer
          loading={loading}
          error={error}
          isEmpty={!loading && !error && items.length === 0}
          emptyDescription="暂无通知"
          onRetry={reload}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ flexShrink: 0 }}>
                    <Tag color={TYPE_LABEL[item.type].color}>{TYPE_LABEL[item.type].label}</Tag>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <Space>
                        <Text strong={!item.read}>{item.title}</Text>
                        {!item.read && <Tag color="blue">未读</Tag>}
                      </Space>
                    </div>
                    <div style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                      <Text type="secondary">{item.content}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatRelative(item.createdAt, settings)}
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {item.read ? (
                    <Button theme="borderless" size="small" onClick={() => handleMarkUnread(item.id)}>
                      标为未读
                    </Button>
                  ) : (
                    <Button theme="borderless" size="small" onClick={() => handleMarkRead(item.id)}>
                      标为已读
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </StateContainer>
      </Card>

      <Modal
        title="通知设置"
        visible={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={() => form.submitForm()}
      >
        <Form form={form} onSubmit={handleSaveSettings}>
          <Text strong>通知类型</Text>
          <Form.Switch field="approval" label="审批通知" />
          <Form.Switch field="task" label="任务通知" />
          <Form.Switch field="system" label="系统通知" />
          <Form.Switch field="mention" label="提及通知" />
          <Form.Switch field="alert" label="告警通知" />
          <Text strong>推送方式</Text>
          <Form.Switch field="email" label="邮件推送" />
          <Form.Switch field="push" label="实时推送" />
        </Form>
      </Modal>
    </>
  );
}
