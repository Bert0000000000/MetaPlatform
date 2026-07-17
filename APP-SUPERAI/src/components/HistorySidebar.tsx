import { useState, useMemo, useCallback } from 'react';
import { Button, Input, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Conversations } from '@ant-design/x';
import type { ConversationItemType, ItemType } from '@ant-design/x/es/conversations/interface';
import {
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  SearchOutlined,
} from '@ant-design/icons';
import type { ChatSession } from '@/types';

interface HistorySidebarProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onToggleFavorite: (id: string) => void;
}

export default function HistorySidebar({
  sessions,
  activeId,
  onSelect,
  onDelete,
  onNew,
  onToggleFavorite,
}: HistorySidebarProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const filteredSessions = useMemo(() => {
    let result = [...sessions];
    if (showFavoritesOnly) {
      result = result.filter((s) => s.favorite);
    }
    if (searchKeyword.trim()) {
      const k = searchKeyword.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(k) ||
          s.messages.some((m) => m.content.toLowerCase().includes(k)),
      );
    }
    return result;
  }, [sessions, searchKeyword, showFavoritesOnly]);

  const conversationItems = useMemo<ItemType[]>(
    () =>
      filteredSessions.map<ItemType>((s) => ({
        key: s.id,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title}
            </span>
            {s.favorite && <StarFilled style={{ color: '#faad14', fontSize: 12 }} />}
          </div>
        ),
        icon: <MessageOutlined />,
      })),
    [filteredSessions],
  );

  const handleMenuClick = useCallback(
    (info: { key: string }, conversationKey: ConversationItemType['key']) => {
      const sessionId = String(conversationKey);
      if (info.key === 'delete') {
        onDelete(sessionId);
      } else if (info.key === 'favorite') {
        onToggleFavorite(sessionId);
      }
    },
    [onDelete, onToggleFavorite],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <Button type="primary" icon={<PlusOutlined />} block onClick={onNew}>
        新建会话
      </Button>

      <Input
        placeholder="搜索会话..."
        prefix={<SearchOutlined />}
        allowClear
        value={searchKeyword}
        onChange={(e) => setSearchKeyword(e.target.value)}
        size="small"
      />

      <Button
        size="small"
        type={showFavoritesOnly ? 'primary' : 'default'}
        icon={showFavoritesOnly ? <StarFilled /> : <StarOutlined />}
        onClick={() => setShowFavoritesOnly((v) => !v)}
        block
      >
        {showFavoritesOnly ? '显示全部' : '仅显示收藏'}
      </Button>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Conversations
          activeKey={activeId}
          onActiveChange={onSelect}
          items={conversationItems}
          menu={(conversation) => ({
            items: [
              {
                key: 'favorite',
                label: sessions.find((s) => s.id === conversation.key)?.favorite ? '取消收藏' : '收藏',
                icon: sessions.find((s) => s.id === conversation.key)?.favorite ? <StarFilled /> : <StarOutlined />,
              },
              {
                key: 'delete',
                label: '删除',
                icon: <DeleteOutlined />,
                danger: true,
              },
            ],
            onClick: (info) => handleMenuClick(info, conversation.key),
          } satisfies MenuProps)}
        />
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
        共 {sessions.length} 个会话
      </Typography.Text>
    </div>
  );
}