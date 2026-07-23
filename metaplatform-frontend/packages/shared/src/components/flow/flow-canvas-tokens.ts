/**
 * FlowCanvas 主题 Token
 * --------------------------------------------------
 * 双主题语义色板，深色默认、浅色可切换。
 *
 * 设计参考：
 * - Ant Design 6 Design Token（colorBgBase / colorTextBase / colorBorder）
 * - FlowGram.AI PlaygroundConfigEntityData（zoom / readonly / 适配屏幕）
 * - Mate Platform UI 设计稿（dashboard.html 等深色规范）
 *
 * 浅色 token 为占位草案，待 UI 规范补齐后由设计同学替换。
 */

export type FlowThemeMode = 'light' | 'dark';

export interface FlowSemanticTheme {
  /** 画布主背景 */
  bg: string;
  /** 面板/卡片背景 */
  bgElevated: string;
  /** 工具栏背景 */
  toolbarBg: string;
  /** 组件面板背景 */
  paletteBg: string;
  /** 属性面板背景 */
  panelBg: string;
  /** 画布点状网格颜色 */
  grid: string;
  /** 节点默认背景 */
  nodeBg: string;
  /** 节点 Hover 背景 */
  nodeBgHover: string;
  /** 节点默认边框 */
  nodeBorder: string;
  /** 节点 Hover 边框 */
  nodeBorderHover: string;
  /** 节点选中态边框 */
  nodeBorderSelected: string;
  /** 节点主文字 */
  nodeText: string;
  /** 节点副文字 */
  nodeSubtext: string;
  /** 普通连线 */
  edge: string;
  /** 选中/激活连线 */
  edgeActive: string;
  /** 连线文本背景 */
  edgeTextBg: string;
  /** 框选阴影 */
  selectionBox: string;
  /** 端口填充 */
  portFill: string;
  /** 端口描边 */
  portBorder: string;
  /** FlowGram useBaseColor().baseColor 通道 */
  baseColor: string;
  /** FlowGram useBaseColor().baseActivatedColor 通道 */
  baseActivatedColor: string;
}

// TODO(spec-pending): 浅色 token 待 UI 设计规范补齐后覆盖。占位采用 AntD6 default + Geist 风。
const DARK_THEME: FlowSemanticTheme = {
  bg: '#0a0a0a',
  bgElevated: '#111111',
  toolbarBg: '#111111',
  paletteBg: '#0f0f0f',
  panelBg: '#111111',
  grid: '#262626',
  nodeBg: '#111111',
  nodeBgHover: '#1a1a1a',
  nodeBorder: '#262626',
  nodeBorderHover: '#525252',
  nodeBorderSelected: '#fafafa',
  nodeText: '#fafafa',
  nodeSubtext: '#a1a1aa',
  edge: '#52525b',
  edgeActive: '#fafafa',
  edgeTextBg: '#0a0a0a',
  selectionBox: 'rgba(250, 250, 250, 0.08)',
  portFill: '#fafafa',
  portBorder: '#262626',
  baseColor: '#fafafa',
  baseActivatedColor: '#62d178',
};

// TODO(spec-pending): 浅色 token 草案，等设计同学确认后替换。
const LIGHT_THEME: FlowSemanticTheme = {
  bg: '#ffffff',
  bgElevated: '#ffffff',
  toolbarBg: '#ffffff',
  paletteBg: '#fafafa',
  panelBg: '#ffffff',
  grid: '#e4e4e7',
  nodeBg: '#ffffff',
  nodeBgHover: '#f4f4f5',
  nodeBorder: '#e4e4e7',
  nodeBorderHover: '#a1a1aa',
  nodeBorderSelected: '#18181b',
  nodeText: '#18181b',
  nodeSubtext: '#52525b',
  edge: '#a1a1aa',
  edgeActive: '#18181b',
  edgeTextBg: '#ffffff',
  selectionBox: 'rgba(24, 24, 27, 0.08)',
  portFill: '#18181b',
  portBorder: '#e4e4e7',
  baseColor: '#18181b',
  baseActivatedColor: '#16a34a',
};

export const FLOW_THEMES: Record<FlowThemeMode, FlowSemanticTheme> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

export function getFlowSemanticTheme(mode: FlowThemeMode): FlowSemanticTheme {
  return FLOW_THEMES[mode] ?? DARK_THEME;
}

/**
 * 将语义色板写入 :root 的 CSS 变量，
 * 便于通过 CSS attribute selector 在 dark/light 间切换。
 */
export function applyFlowThemeVars(
  target: HTMLElement,
  mode: FlowThemeMode,
): void {
  const t = getFlowSemanticTheme(mode);
  const style = target.style;
  style.setProperty('--flow-bg', t.bg);
  style.setProperty('--flow-bg-elevated', t.bgElevated);
  style.setProperty('--flow-toolbar-bg', t.toolbarBg);
  style.setProperty('--flow-palette-bg', t.paletteBg);
  style.setProperty('--flow-panel-bg', t.panelBg);
  style.setProperty('--flow-grid', t.grid);
  style.setProperty('--flow-node-bg', t.nodeBg);
  style.setProperty('--flow-node-bg-hover', t.nodeBgHover);
  style.setProperty('--flow-node-border', t.nodeBorder);
  style.setProperty('--flow-node-border-hover', t.nodeBorderHover);
  style.setProperty('--flow-node-border-selected', t.nodeBorderSelected);
  style.setProperty('--flow-node-text', t.nodeText);
  style.setProperty('--flow-node-subtext', t.nodeSubtext);
  style.setProperty('--flow-edge', t.edge);
  style.setProperty('--flow-edge-active', t.edgeActive);
  style.setProperty('--flow-edge-text-bg', t.edgeTextBg);
  style.setProperty('--flow-selection-box', t.selectionBox);
  style.setProperty('--flow-port-fill', t.portFill);
  style.setProperty('--flow-port-border', t.portBorder);
  style.setProperty('--flow-base-color', t.baseColor);
  style.setProperty('--flow-base-color-activated', t.baseActivatedColor);
  target.setAttribute('data-theme', mode);
}
