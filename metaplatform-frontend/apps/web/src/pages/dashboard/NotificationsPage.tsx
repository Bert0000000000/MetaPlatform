import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, List, Radio, Skeleton, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw, Settings2 } from 'lucide-react';
import {
  getNotificationSettings,
  getNotifications,
  markAllAsRead,
  markAsRead,
  markAsUnread,
  updateNotificationSettings,
} from '@/api/notifications';
import type {
  NotificationItem,
  NotificationReadStatus,
  NotificationSettings,
  NotificationType,
} from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import { formatRelative } from '@/utils/datetime';
import './home.css';

const { Text } = Typography;

/** 通知类型 → 中文标签 + 语义色（DESIGN-SPEC §4.3：分类色只用于标签）。 */
const TYPE_LABEL: Record<NotificationType, { label: string; color: TagColor }> = {
  approval: { label: '审批', color: 'blue' },
  task: { label: '任务', color: 'green' },
  system: { label: '系统', color: 'grey' },
  mention: { label: '提及', color: 'purple' },
  alert: { label: '告警', color: 'red' },
};

const READ_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '未读', value: 'unread' },
  { label: '已读', value: 'read' },
];

/**
 * 工作台 · 待办（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + feed 列表）。
 *
 * 数据面沿用 src/api/notifications：
 *  - getNotifications(filter) 按 全部/未读/已读 服务端拉取
 *  - markAsRead / markAsUnread / markAllAsRead 维护已读态
 *  - getNotificationSettings / updateNotificationSettings 走右侧非模态设置浮层
 * 搜索是客户端对标题/正文的过滤，不改变既有接口语义。
 */
export default function NotificationsPage() {
  const { settings } = useSettings();
  const [form] = Form.useForm<NotificationSettings>();

  const [filter, setFilter] = useState<NotificationReadStatus>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await getNotifications(filter)) ?? []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRead = useCallback(
    async (item: NotificationItem) => {
      setActing(item.id);
      try {
        if (item.read) await markAsUnread(item.id);
        else await markAsRead(item.id);
        await load();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setActing(null);
      }
    },
    [load],
  );

  const markAll = useCallback(async () => {
    try {
      await markAllAsRead();
      await load();
      Toast.success('已全部标记为已读');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [load]);

  const openSettings = useCallback(async () => {
    try {
      form.setValues(await getNotificationSettings());
      setSettingsOpen(true);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [form]);

  const saveSettings = useCallback(async (values: NotificationSettings) => {
    setSaving(true);
    try {
      await updateNotificationSettings(values);
      setSettingsOpen(false);
      Toast.success('通知设置已保存');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <>
      <PageHeader
        title="待办"
        desc={`共 ${items.length} 条通知 · 未读 ${unreadCount} 条`}
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              icon={<Settings2 size={15} strokeWidth={1.5} />}
              onClick={() => void openSettings()}
            >
              通知设置
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: '搜索通知标题或内容…' }}
        filters={
          <Radio.Group
            type="button"
            options={READ_OPTIONS}
            value={filter}
            onChange={(e) => setFilter(e.target.value as NotificationReadStatus)}
          />
        }
        right={
          <Button disabled={unreadCount === 0} onClick={() => void markAll()}>
            全部已读
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="通知加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : (
        <Skeleton loading={loading} placeholder={<Skeleton.Paragraph rows={6} />}>
          {visible.length === 0 ? (
            <EmptyState
              illustration="no-content"
              title="暂无通知"
              desc={filter === 'unread' ? '当前没有未读通知。' : '新的通知会出现在这里。'}
            />
          ) : (
            <List
              dataSource={visible}
              split={false}
              renderItem={(item: NotificationItem) => (
                <List.Item
                  key={item.id}
                  main={
                    <span className="mp-home-feed-row">
                      <span className="mp-home-feed-main">
                        <span className="mp-home-feed-title">{item.title}</span>
                        <span className="mp-home-feed-meta">
                          {item.content} · {formatRelative(item.createdAt, settings)}
                        </span>
                      </span>
                      <span className="mp-home-todo-actions">
                        <Tag type="light" color={TYPE_LABEL[item.type].color}>
                          {TYPE_LABEL[item.type].label}
                        </Tag>
                        {!item.read ? (
                          <Tag type="light" color="blue">
                            未读
                          </Tag>
                        ) : null}
                        <Button
                          theme="borderless"
                          size="small"
                          loading={acting === item.id}
                          onClick={() => void toggleRead(item)}
                        >
                          {item.read ? '标为未读' : '标为已读'}
                        </Button>
                      </span>
                    </span>
                  }
                />
              )}
            />
          )}
        </Skeleton>
      )}

      <SheetDetail
        title="通知设置"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        footer={
          <>
            <Button onClick={() => setSettingsOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => form.submitForm()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={form} onSubmit={saveSettings}>
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
      </SheetDetail>
    </>
  );
}
