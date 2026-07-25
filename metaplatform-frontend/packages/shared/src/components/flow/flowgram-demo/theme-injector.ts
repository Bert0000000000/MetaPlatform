/**
 * Flowgram theme CSS injector
 * --------------------------------------------------
 * 把 flowgram-theme.css 的覆盖规则（内联字符串）注入到 <head>。
 * 用字符串内联避免 Vite `?inline` 解析在 monorepo 跨包消费时的边角问题。
 *
 * 创建于 2026-07-25，v1.4 R1.5 Sprint 1。
 */

const STYLE_ID = 'mate-flowgram-theme-v1';

const THEME_CSS = `
/* FlowGram.AI 主题色覆盖层：9 个 --g-* 变量映射到 Mate token */
.gedit-playground,
.gedit-playground-pipeline,
.gedit-playground-layer {
  --g-selection-background: var(--primary, #fafafa);
  --g-editor-background: var(--background, #0a0a0a);
  --g-playground-select: var(--primary, #fafafa);
  --g-playground-hover: var(--primary, #fafafa);
  --g-playground-line: var(--primary, #fafafa);
  --g-playground-blur: var(--muted-foreground, #a1a1a1);
  --g-playground-selectBox-outline: var(--primary, #fafafa);
  --g-playground-selectBox-background: rgba(250, 250, 250, 0.06);
  --g-playground-select-hover-background: rgba(250, 250, 250, 0.06);
  --g-playground-select-control-size: 12px;
}
.gedit-selector-bounds-background {
  background-color: rgba(250, 250, 250, 0.04) !important;
}
.gedit-grid-svg .gedit-grid-dot {
  fill: var(--border, #262626);
}
.gedit-playground-loading {
  color: var(--foreground, #fafafa);
}
.gedit-playground-scroll-right-block,
.gedit-playground-scroll-bottom-block {
  background: var(--muted-foreground, #a1a1a1) !important;
}
.gedit-toolbar,
.gedit-minimap-container {
  background: var(--card, #111111);
  border: 1px solid var(--border, #262626);
  color: var(--foreground, #fafafa);
}
[data-theme='light'] .gedit-playground,
[data-theme='light'] .gedit-playground-pipeline,
[data-theme='light'] .gedit-playground-layer {
  --g-selection-background: #18181b;
  --g-editor-background: #ffffff;
  --g-playground-select: #18181b;
  --g-playground-hover: #18181b;
  --g-playground-line: #18181b;
  --g-playground-blur: #71717a;
  --g-playground-selectBox-outline: #18181b;
  --g-playground-selectBox-background: rgba(24, 24, 27, 0.08);
  --g-playground-select-hover-background: rgba(24, 24, 27, 0.08);
}
[data-theme='light'] .gedit-grid-svg .gedit-grid-dot {
  fill: #d4d4d8;
}
[data-theme='light'] .gedit-selector-bounds-background {
  background-color: rgba(24, 24, 27, 0.04) !important;
}
`;

/**
 * 幂等注入 FlowGram 主题色 CSS 覆盖层
 */
export function ensureFlowgramThemeStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const node = document.createElement('style');
  node.id = STYLE_ID;
  node.textContent = THEME_CSS;
  document.head.appendChild(node);
}

/**
 * 移除注入（用于测试或主题重置场景）
 */
export function removeFlowgramThemeStyle(): void {
  if (typeof document === 'undefined') return;
  const node = document.getElementById(STYLE_ID);
  if (node) node.remove();
}