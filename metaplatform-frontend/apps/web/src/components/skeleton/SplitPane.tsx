import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const MIN_MAIN_WIDTH = 240;
const DIVIDER_WIDTH = 1;

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
  const paneRef = useRef<HTMLDivElement>(null);
  const foldRef = useRef<HTMLButtonElement>(null);
  const paneId = useId();
  const draggingRef = useRef(false);
  const [width, setWidth] = useState(defaultWidth);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const compact = containerWidth !== null && containerWidth < minWidth + MIN_MAIN_WIDTH + DIVIDER_WIDTH;
  const collapsed = containerWidth === null || (compact ? !compactOpen : desktopCollapsed);
  const widthLimit = containerWidth === null ? maxWidth : compact
    ? Math.min(maxWidth, containerWidth)
    : Math.min(maxWidth, containerWidth - MIN_MAIN_WIDTH - DIVIDER_WIDTH);
  const effectiveWidth = Math.max(0, Math.min(width, widthLimit));

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = (nextWidth: number) => {
      // A hidden route can report zero before its first usable measurement.
      if (nextWidth <= 0) return;
      const nextCompact = nextWidth < minWidth + MIN_MAIN_WIDTH + DIVIDER_WIDTH;
      if (nextCompact !== compact && (nextCompact || desktopCollapsed)
        && paneRef.current?.contains(document.activeElement)) {
        foldRef.current?.focus();
      }
      if (!nextCompact) setCompactOpen(false);
      setContainerWidth(nextWidth);
    };
    const measureRoot = () => measure(root.getBoundingClientRect().width);
    measureRoot();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureRoot);
      return () => window.removeEventListener('resize', measureRoot);
    }
    const observer = new ResizeObserver(entries => {
      const entry = entries.find(item => item.target === root);
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [minWidth, compact, desktopCollapsed]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (el) el.style.setProperty('--mp-split-w', collapsed ? '0px' : `${effectiveWidth}px`);
  }, [effectiveWidth, collapsed]);

  useLayoutEffect(() => {
    if (!compact || collapsed) return;
    const pane = paneRef.current;
    const firstControl = pane?.querySelector<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    );
    (firstControl ?? pane)?.focus();
  }, [compact, collapsed]);

  const togglePane = useCallback(() => {
    if (!collapsed && paneRef.current?.contains(document.activeElement)) foldRef.current?.focus();
    if (compact) setCompactOpen(open => !open);
    else setDesktopCollapsed(value => !value);
  }, [compact, collapsed]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const root = rootRef.current;
      if (!root) return;
      const left = root.getBoundingClientRect().left;
      const next = Math.min(widthLimit, Math.max(minWidth, e.clientX - left));
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
  }, [minWidth, widthLimit]);

  const startDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (collapsed || compact) return;
    draggingRef.current = true;
    e.preventDefault();
  }, [collapsed, compact]);

  return (
    <div
      ref={rootRef}
      className={`mp-split${collapsed ? ' is-collapsed' : ''}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      onKeyDown={event => {
        if (event.key === 'Escape' && compact && !collapsed) {
          event.preventDefault();
          event.stopPropagation();
          setCompactOpen(false);
          foldRef.current?.focus();
        }
      }}
    >
      <div ref={paneRef} id={paneId} className="mp-split-pane" tabIndex={-1}
        aria-hidden={collapsed} inert={collapsed}>
        {pane}
      </div>

      <div
        className="mp-split-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整面板宽度，双击折叠"
        hidden={compact || collapsed}
        onPointerDown={startDrag}
        onDoubleClick={togglePane}
      />

      <div className="mp-split-main">{children}</div>

      <button
        ref={foldRef}
        type="button"
        className="mp-split-fold"
        aria-label={collapsed ? '展开面板' : '折叠面板'}
        aria-controls={paneId}
        aria-expanded={!collapsed}
        disabled={containerWidth === null}
        title={collapsed ? '展开面板（双击分隔线亦可）' : '折叠面板（双击分隔线亦可）'}
        onClick={togglePane}
      >
        {collapsed ? <PanelLeftOpen size={14} strokeWidth={1.5} /> : <PanelLeftClose size={14} strokeWidth={1.5} />}
      </button>
    </div>
  );
}
