import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Descriptions, List, Select, Skeleton, Tag, Typography } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { getMessages, type MessageItem } from '@/api/dashboard/workbench';
import { EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import './home.css';

/** avatar_class → 分类名，左栏分类过滤据此客户端筛选。 */
const CATEGORY_LABEL: Record<string, string> = {
  system: '系统通知',
  approval: '审批通知',
  task: '任务通知',
  collab: '协作通知',
};

/** 后端 priority → 中文 + 语义色（medium / normal 统一归为「中」）。 */
const PRIORITY_LABEL: Record<string, { label: string; color: 'red' | 'amber' | 'grey' }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'amber' },
  normal: { label: '中', color: 'amber' },
  low: { label: '低', color: 'grey' },
};

/**
 * 工作台 · 消息（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + feed 列表 + Preview Sheet）。
 *
 * 数据面沿用 src/api/dashboard/workbench#getMessages——后端只给单次列表，
 * 没有独立的已读/归档/删除接口，故不渲染那些点了没反应的假控件；
 * 分类与搜索是客户端过滤，点击消息行在右侧非模态浮层查看详情。
 */
export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState<MessageItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMessages((await getMessages()) ?? []);
    } catch (e) {
      setMessages([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => messages.filter((m) => m.unread).length, [messages]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (category && m.avatar_class !== category) return false;
      if (!q) return true;
      return (
        m.sender.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q)
      );
    });
  }, [messages, query, category]);

  /** 分类下拉只列出当前数据里真实出现过的分类，不凭空造选项。 */
  const categoryOptions = useMemo(() => {
    const seen = new Set(messages.map((m) => m.avatar_class));
    return Array.from(seen).map((k) => ({ value: k, label: CATEGORY_LABEL[k] ?? k }));
  }, [messages]);

  return (
    <>
      <PageHeader
        title="消息"
        desc={`共 ${messages.length} 条 · 未读 ${unreadCount} 条`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: '搜索发件人、标题或摘要…' }}
        filters={
          <Select
            value={category}
            onChange={(v) => setCategory(v ? String(v) : '')}
            placeholder="全部分类"
          >
            <Select.Option value="">全部分类</Select.Option>
            {categoryOptions.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="消息加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : (
        <Skeleton loading={loading} placeholder={<Skeleton.Paragraph rows={8} />}>
          {visible.length === 0 ? (
            <EmptyState
              illustration="no-content"
              title="暂无消息"
              desc={
                query || category
                  ? '没有匹配的消息，调整搜索或分类。'
                  : '新的系统通知与协作消息会出现在这里。'
              }
            />
          ) : (
            <List
              dataSource={visible}
              split={false}
              renderItem={(msg: MessageItem) => {
                const prio = PRIORITY_LABEL[msg.priority];
                return (
                  <List.Item
                    key={msg.msg_id}
                    onClick={() => setDetail(msg)}
                    main={
                      <span className="mp-home-feed-row">
                        <Avatar size="small" color="light-blue">
                          {msg.sender.slice(0, 1)}
                        </Avatar>
                        <span className="mp-home-feed-main">
                          <span className="mp-home-feed-title">{msg.title}</span>
                          <span className="mp-home-feed-meta">
                            {msg.sender} · {msg.summary} · {msg.time}
                          </span>
                        </span>
                        <span className="mp-home-todo-actions">
                          {prio ? (
                            <Tag type="light" color={prio.color}>
                              {prio.label}
                            </Tag>
                          ) : null}
                          {msg.unread ? (
                            <Tag type="light" color="blue">
                              未读
                            </Tag>
                          ) : null}
                          {msg.attachments > 0 ? (
                            <Tag type="light" color="grey">
                              {msg.attachments} 附件
                            </Tag>
                          ) : null}
                        </span>
                      </span>
                    }
                  />
                );
              }}
            />
          )}
        </Skeleton>
      )}

      <SheetDetail title="消息详情" open={detail !== null} onClose={() => setDetail(null)}>
        {detail ? (
          <>
            <Descriptions
              row
              data={[
                { key: '发件人', value: detail.sender },
                { key: '时间', value: detail.time },
                {
                  key: '分类',
                  value: CATEGORY_LABEL[detail.avatar_class] ?? detail.avatar_class,
                },
                {
                  key: '优先级',
                  value: PRIORITY_LABEL[detail.priority]?.label ?? detail.priority,
                },
                { key: '附件', value: `${detail.attachments} 个` },
                { key: '状态', value: detail.unread ? '未读' : '已读' },
              ]}
            />
            <div>
              <Typography.Title heading={5}>{detail.title}</Typography.Title>
              <Typography.Paragraph>{detail.summary}</Typography.Paragraph>
            </div>
          </>
        ) : null}
      </SheetDetail>
    </>
  );
}
