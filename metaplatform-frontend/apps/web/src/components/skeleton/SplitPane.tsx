import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export interface SplitPaneProps {
  /** 左侧面板内容 */
  pane: ReactNode;
  /** 右主区内容 */
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * 两栏浏览器骨架的可折叠 / 可拖宽分栏（DESIGN-SPEC §3「面板交互」）。
 * Semi 没有对应组件，因此自建；内部只用 Semi Button 语义的原生 button + 令牌排版。
 *
 * 宽度是用户拖拽的产物，走容器上的 CSS 变量 --mp-split-w 写入，
 * 样式规则仍全部在 CSS 里（本文件 0 处 JSX inline style）。
 * 折叠态保留边界按钮，避免「收起来就再也打不开」。
 */
export default function SplitPane({
  pane,
  children,
  defaultWidth = 240,
  minWidth = 180,
  maxWidth = 420,
  ariaLabel,
  className,
}: SplitPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [width, setWidth] = useState(defaultWidth);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (el) el.style.setProperty('--mp-split-w', collapsed ? '0px' : `${width}px`);
  }, [width, collapsed]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const root = rootRef.current;
      if (!root) return;
      const left = root.getBoundingClientRect().left;
      const next = Math.min(maxWidth, Math.max(minWidth, e.clientX - left));
      setWidth(next);
    };
    const onUp = () => {
      if (draggingRef.current) draggingRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [minWidth, maxWidth]);

  const startDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (collapsed) return;
    draggingRef.current = true;
    e.preventDefault();
  }, [collapsed]);

  return (
    <div
      ref={rootRef}
      className={`mp-split${collapsed ? ' is-collapsed' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
    >
      <div className="mp-split-pane">{pane}</div>

      <div
        className="mp-split-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整面板宽度，双击折叠"
        onPointerDown={startDrag}
        onDoubleClick={() => setCollapsed((c) => !c)}
      />

      <div className="mp-split-main">{children}</div>

      <button
        type="button"
        className="mp-split-fold"
        aria-label={collapsed ? '展开面板' : '折叠面板'}
        title={collapsed ? '展开面板（双击分隔线亦可）' : '折叠面板（双击分隔线亦可）'}
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? <PanelLeftOpen size={14} strokeWidth={1.5} /> : <PanelLeftClose size={14} strokeWidth={1.5} />}
      </button>
    </div>
  );
}
