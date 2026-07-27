import { useEffect } from 'react';

/**
 * 全局滚动条自动隐藏控制器（macOS-like）。
 *
 * 行为：
 *   - 默认情况下全局所有滚动条完全透明（由 global.css 中的
 *     `::-webkit-scrollbar-thumb { background-color: transparent }` 控制）。
 *   - 当用户**鼠标滚轮 / 触屏滑动 / 键盘滚动 / 触发 scroll 事件**时，
 *     在 <html> 上加 `.mate-scrolling`，让所有滚动条浮现；停止 600ms 后移除。
 *   - CSS-only 的 hover 显示逻辑（`:hover::-webkit-scrollbar-thumb`）继续生效。
 *
 * 用法：在应用根组件中渲染一次即可，无需 props。
 *
 *   function App() {
 *     return (
 *       <>
 *         <ScrollbarAutoHide />
 *         <Routes />
 *       </>
 *     );
 *   }
 */
const SCROLLING_CLASS = 'mate-scrolling';
const IDLE_MS = 600;

export default function ScrollbarAutoHide() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timer: number | null = null;

    const activate = () => {
      document.documentElement.classList.add(SCROLLING_CLASS);
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        document.documentElement.classList.remove(SCROLLING_CLASS);
        timer = null;
      }, IDLE_MS);
    };

    const onWheel: EventListener = () => activate();
    const onScroll: EventListener = () => activate();
    const onTouchMove: EventListener = () => activate();
    const onKeydown = (e: KeyboardEvent) => {
      // 监听常用的滚动键：PageUp/PageDown、Home/End、方向键、空格
      const scrollKeys = new Set([
        'PageUp', 'PageDown', 'Home', 'End',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        ' ', 'Spacebar',
      ]);
      if (scrollKeys.has(e.key)) activate();
    };

    // capture: true 让任何嵌套滚动容器的事件都能触发（不依赖冒泡）
    window.addEventListener('wheel', onWheel, { passive: true, capture: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
    window.addEventListener('keydown', onKeydown);

    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions);
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('touchmove', onTouchMove, { capture: true } as EventListenerOptions);
      window.removeEventListener('keydown', onKeydown);
      if (timer != null) window.clearTimeout(timer);
      document.documentElement.classList.remove(SCROLLING_CLASS);
    };
  }, []);

  return null;
}
