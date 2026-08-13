import { useState, useMemo, useCallback } from 'react';
import { Button, Input, Typography } from '@douyinfe/semi-ui';
import {
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  SearchOutlined,
} from '@ant-design/icons';
import type { ChatSession } from '@/api/superai/types';

interface HistorySidebarProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onToggleFavorite: (id: string) => void;
}

/** 会话行：hover 时显示收藏/删除操作（替代旧 antd Conversations 的右键菜单） */
function SessionRow({
  session,
  active,
  onSelect,
  onDelete,
  onToggleFavorite,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onSelect(session.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
        borderRadius: 4,
        cursor: 'pointer',
        marginBottom: 2,
        background: active ? 'var(--muted)' : 'transparent',
        transition: 'background .15s',
      }}
    >
      <MessageOutlined style={{ fontSize: 13, color: 'var(--muted-foreground)', flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
          color: 'var(--foreground)',
        }}
        title={session.title}
      >
        {session.title}
      </span>
      {session.favorite && (
        <StarFilled style={{ fontSize: 12, color: 'var(--warning)', flexShrink: 0 }} />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity .15s',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(session.id);
          }}
          title={session.favorite ? '取消收藏' : '收藏'}
          style={{
            background: 'transparent',
            border: 'none',
            color: session.favorite ? 'var(--warning)' : 'var(--muted-foreground)',
            cursor: 'pointer',
            padding: 2,
            display: 'inline-flex',
          }}
        >
          {session.favorite ? (
            <StarFilled style={{ fontSize: 12 }} />
          ) : (
            <StarOutlined style={{ fontSize: 12 }} />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(session.id);
          }}
          title="删除"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            padding: 2,
            display: 'inline-flex',
          }}
        >
          <DeleteOutlined style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
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
          s.messages.some((m) => (m.content ?? '').toLowerCase().includes(k)),
      );
    }
    return result;
  }, [sessions, searchKeyword, showFavoritesOnly]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
    },
    [onSelect],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onDelete(id);
    },
    [onDelete],
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      onToggleFavorite(id);
    },
    [onToggleFavorite],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <Button theme="solid" type="primary" icon={<PlusOutlined />} block onClick={onNew}>
        新建会话
      </Button>

      <Input
        placeholder="搜索会话..."
        prefix={<SearchOutlined />}
        showClear
        value={searchKeyword}
        onChange={(v) => setSearchKeyword(v)}
        size="small"
      />

      <Button
        size="small"
        theme={showFavoritesOnly ? 'solid' : 'light'}
        type="primary"
        icon={showFavoritesOnly ? <StarFilled /> : <StarOutlined />}
        onClick={() => setShowFavoritesOnly((v) => !v)}
        block
      >
        {showFavoritesOnly ? '显示全部' : '仅显示收藏'}
      </Button>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {filteredSessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            active={s.id === activeId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
        {filteredSessions.length === 0 && (
          <Typography.Text type="tertiary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: '16px 0' }}>
            暂无会话
          </Typography.Text>
        )}
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
        共 {sessions.length} 个会话
      </Typography.Text>
    </div>
  );
}
