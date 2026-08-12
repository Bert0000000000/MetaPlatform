export type ResolvedTheme = 'light' | 'dark';

/**
 * 应用 Semi 官方主题：通过 body[theme-mode] 属性切换。
 * Semi 组件样式全部由 CSS 变量（--semi-color-*）驱动，
 * 设置属性后所有组件随变量自动切换深浅色。
 */
export function applySemiTheme(resolvedTheme: ResolvedTheme): void {
  if (typeof document !== 'undefined') {
    document.body.setAttribute('theme-mode', resolvedTheme);
  }
}

/** 读取当前已生效的 Semi 主题（默认为浅色） */
export function useThemeMode(): { resolvedTheme: ResolvedTheme } {
  const resolvedTheme: ResolvedTheme =
    typeof document !== 'undefined' && document.body.getAttribute('theme-mode') === 'dark'
      ? 'dark'
      : 'light';
  return { resolvedTheme };
}
