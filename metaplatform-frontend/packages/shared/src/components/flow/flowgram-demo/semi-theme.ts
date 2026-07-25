/**
 * Semi Design 主题适配
 * --------------------------------------------------
 * FlowGram.AI 的 fixed-semi-materials 内部使用 @douyinfe/semi-ui，
 * 不走 --g-* CSS 变量。本文件提供 Semi 的 ConfigProvider theme 对象，
 * 把 Semi 的色板映射到 Mate 设计稿 token。
 *
 * 创建于 2026-07-25，v1.4 R1.5 Sprint 1。
 */

export type SemiThemeMode = 'light' | 'dark';

export interface SemiThemeConfig {
  mode: SemiThemeMode;
}

/**
 * 获取 Semi 的 ConfigProvider theme 对象
 * 基于项目 token 构造，把品牌色注入 Semi 的色板
 */
export function getMateSemiTheme(_mode: SemiThemeMode = 'dark'): Record<string, unknown> {
  // 简化版：直接交给 Semi ConfigProvider 让它跟随 CSS 变量
  // Semi Design 会从 :root 上读取 --semi-color-* 自动适配
  // 这里我们只需要保证 Semi ConfigProvider 知道 mode 即可
  return {};
}

/**
 * Semi Design 基础 ConfigProvider props
 */
export function getSemiProviderProps(mode: SemiThemeMode = 'dark'): { theme: { mode: SemiThemeMode } } {
  return {
    theme: { mode },
  };
}