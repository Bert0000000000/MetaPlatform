import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export interface SubTabItem {
  label: string;
  path: string;
  /** 是否可关闭（用于应用 tab） */
  closable?: boolean;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 自定义 active 匹配 path（默认使用 path）；设为 '' 或 '__never' 可禁用 active 匹配 */
  activePath?: string;
}

interface SubTabsProps {
  items: SubTabItem[];
  activePath: string;
  /** true 时不应用负 margin 与外部 padding（用于嵌入到自定义 header 中） */
  embedded?: boolean;
  /** 关闭某项回调（仅 closable 项可触发） */
  onClose?: (item: SubTabItem) => void;
}

/**
 * 子页面顶部 Tab 栏
 *
 * 用法：
 * <SubTabs items={[
 *   { label: '工作台', path: '/dashboard' },
 *   { label: '我的应用', path: '/dashboard/my-apps' },
 * ]} activePath={location.pathname} />
 *
 * 设计：
 * - 高度 64px，与左侧 logo 区域一致
 * - 横向滚动（子项过多时）
 * - tab 之间用竖线分隔
 * - active 状态：底部 2px 白色指示条 + 字体加粗
 * - closable 项显示关闭按钮，hover 时高亮
 */
export default function SubTabs({ items, activePath, embedded = false, onClose }: SubTabsProps) {
  const navigate = useNavigate();

  // 找到当前最长前缀匹配的 active 索引
  // activePath: item.activePath ?? item.path；设为 '__never' 表示永不参与匹配
  let activeIdx = -1;
  let bestLen = -1;
  items.forEach((it, i) => {
    const target = it.activePath ?? it.path;
    if (target === '__never') return;
    if (activePath === target || activePath.startsWith(target + '/')) {
      if (target.length > bestLen) {
        bestLen = target.length;
        activeIdx = i;
      }
    }
  });

  return (
    <div
      style={{
        position: embedded ? 'static' : 'sticky',
        top: embedded ? 'auto' : 0,
        zIndex: embedded ? 'auto' : 50,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        height: 64,
        padding: embedded ? 0 : '0 24px',
        margin: 0,
        background: embedded ? 'transparent' : 'var(--background)',
        borderBottom: embedded ? 'none' : '1px solid var(--border)',
        overflowX: embedded ? 'visible' : 'auto',
        overflowY: 'hidden',
        flexShrink: 0,
      }}
    >
      {items.map((item, idx) => {
        const isActive = idx === activeIdx;
        return (
          <div
            key={item.path}
            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            <button
              onClick={() => navigate(item.path)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 64,
                padding: '0 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                fontFamily: 'var(--font-sans)',
                transition: 'color .15s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)';
              }}
            >
              {item.icon}
              {item.label}
              {item.closable && (
                <span
                  role="button"
                  aria-label="关闭"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose?.(item);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    marginLeft: 4,
                    borderRadius: 4,
                    color: 'var(--muted-foreground)',
                    transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--muted)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-foreground)';
                  }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </span>
              )}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 0,
                    height: 2,
                    background: 'var(--foreground)',
                    borderRadius: '2px 2px 0 0',
                  }}
                />
              )}
            </button>
            {idx < items.length - 1 && (
              <span
                aria-hidden="true"
                style={{
                  width: 1,
                  height: 18,
                  background: 'var(--border)',
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}