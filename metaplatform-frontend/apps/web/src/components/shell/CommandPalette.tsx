import { Input, List, Modal } from '@douyinfe/semi-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Command, CornerDownLeft, Search } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { buildNavigationIndex, type PaletteEntry } from './domains';
import { useShell } from './ShellContext';

const RECENT_KEY = 'mp_cmdk_recent';
const MAX_RECENT = 5;

/**
 * 命令面板条目 = 跳转索引条目（必有 path）或本地动作（必有 action）。
 */
type CommandEntry = Omit<PaletteEntry, 'path'> & {
  path?: string;
  action?: () => void;
};

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(keys: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(keys.slice(0, MAX_RECENT)));
  } catch {
    // 隐私模式 / 配额满：忽略
  }
}

/**
 * ⌘K 命令面板（DESIGN-SPEC §6.1）：导航的第二通道，不替代可见菜单。
 * Semi 没有命令面板组件，这里用 Modal + Input + List 组合，键盘导航自行实现
 * （映射表里明确允许的唯一组合件）。
 */
export default function CommandPalette() {
  const navigate = useNavigate();
  const { commandOpen, setCommandOpen, toggleNavMode, openCopilot, navMode } = useShell();
  const { resolvedTheme, setTheme } = useSettings();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentKeys, setRecentKeys] = useState<string[]>(() => readRecent());
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<CommandEntry[]>(() => {
    const nav = buildNavigationIndex();
    const byKey = new Map(nav.map((e) => [e.key, e]));
    const recent: CommandEntry[] = recentKeys
      .map((k) => byKey.get(k))
      .filter((e): e is PaletteEntry => Boolean(e))
      .map((e) => ({ ...e, group: '最近' }));

    const actions: CommandEntry[] = [
      {
        key: 'action:theme',
        label: `切换到${resolvedTheme === 'dark' ? '浅色' : '深色'}主题`,
        group: '动作',
        keywords: '主题 深色 浅色 dark light theme',
        action: () => {
          void setTheme(resolvedTheme === 'dark' ? 'light' : 'dark').catch(() => undefined);
        },
      },
      {
        key: 'action:nav',
        label: `切换为${navMode === 'side' ? '顶栏' : '侧栏'}导航`,
        group: '动作',
        keywords: '导航 布局 顶栏 侧栏 top side layout',
        action: toggleNavMode,
      },
      {
        key: 'action:copilot',
        label: '打开 SuperAI Copilot',
        group: '动作',
        keywords: 'copilot superai 助手 ai',
        action: openCopilot,
      },
    ];

    return [...recent, ...nav, ...actions];
  }, [recentKeys, resolvedTheme, navMode, setTheme, toggleNavMode, openCopilot]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.keywords.toLowerCase().includes(q) ||
        (e.meta ?? '').toLowerCase().includes(q),
    );
  }, [entries, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, commandOpen]);

  useEffect(() => {
    if (!commandOpen) return;
    const el = listRef.current?.querySelector('.is-active');
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, commandOpen]);

  const close = () => setCommandOpen(false);

  const run = (entry: CommandEntry) => {
    if (entry.path) {
      const target = entry.path;
      if (entry.group !== '最近') {
        const next = [entry.key, ...recentKeys.filter((k) => k !== entry.key)];
        setRecentKeys(next);
        writeRecent(next);
      }
      close();
      navigate(target);
      return;
    }
    entry.action?.();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = filtered[activeIndex];
      if (entry) run(entry);
    }
  };

  return (
    <Modal
      className="mp-cmdk"
      visible={commandOpen}
      header={null}
      footer={null}
      centered
      width={620}
      closeOnEsc
      maskClosable
      onCancel={close}
    >
      <div className="mp-cmdk-input">
        <Search size={17} strokeWidth={1.6} />
        <Input
          className="mp-cmdk-field"
          borderless
          value={query}
          placeholder="搜索对象、数字员工、应用，或输入命令…"
          onChange={setQuery}
          onKeyDown={onKeyDown}
          autoFocus
        />
        <span className="mp-kbd">Esc</span>
      </div>

      <div className="mp-cmdk-body" ref={listRef}>
        {filtered.length === 0 ? (
          <div className="mp-cmdk-empty">没有匹配的条目</div>
        ) : (
          <List
            dataSource={filtered}
            split={false}
            renderItem={(item: CommandEntry, index: number) => (
              <>
                {index === 0 || filtered[index - 1].group !== item.group ? (
                  <div className="mp-cmdk-group">{item.group}</div>
                ) : null}
                <List.Item
                  className={`mp-cmdk-item${index === activeIndex ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => run(item)}
                  main={
                    <span className="mp-cmdk-label">
                      {item.path ? (
                        <CornerDownLeft size={14} strokeWidth={1.5} />
                      ) : (
                        <Command size={14} strokeWidth={1.5} />
                      )}
                      {item.label}
                    </span>
                  }
                  extra={item.meta ? <span className="mp-cmdk-meta">{item.meta}</span> : undefined}
                />
              </>
            )}
          />
        )}
      </div>

      <div className="mp-cmdk-foot">
        <span>↑↓ 选择</span>
        <span>↵ 打开</span>
        <span>esc 关闭</span>
        <span className="mp-cmdk-foot-right">
          <Sparkles size={12} strokeWidth={1.5} />
          Mate Platform
        </span>
      </div>
    </Modal>
  );
}
