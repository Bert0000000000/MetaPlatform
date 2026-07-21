/**
 * Mate Platform 统一设计 Tokens
 *
 * 这些常量作为 Ant Design theme token 的补充，用于自定义间距、布局密度、
 * 阴影层级等 AntD 未覆盖的维度。所有 APP 通过 @mate/shared 引用同一份 token。
 *
 * 颜色仍以 AntD theme token 为主（colorPrimary/colorBgContainer 等），
 * 通过 ConfigProvider 注入；此处只定义 AntD 之外的设计常量。
 */

/** 品牌主色（与 AntD colorPrimary 对齐） */
export const BRAND_COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1677ff',
} as const;

/** 语义化场景色 */
export const SCENE_COLORS = {
  /** 强调/品牌链接 */
  accent: '#1677ff',
  /** 数字员工/Agent 相关 */
  bot: '#722ed1',
  /** RAG/知识相关 */
  knowledge: '#13c2c2',
  /** 工作流/审批相关 */
  workflow: '#fa8c16',
  /** 数据/分析相关 */
  data: '#2f54eb',
} as const;

/** 间距（4px 栅格） */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  section: 48,
} as const;

/** 圆角（与 AntD borderRadius 对齐） */
export const RADIUS = {
  none: 0,
  sm: 4,
  base: 6,
  lg: 8,
  xl: 12,
  pill: 999,
} as const;

/** 阴影层级（用于卡片、弹层、悬浮等） */
export const SHADOWS = {
  card: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
  cardHover: '0 2px 8px 0 rgba(0,0,0,0.08), 0 2px 12px -2px rgba(0,0,0,0.06)',
  dropdown: '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)',
  modal: '0 12px 32px 0 rgba(0,0,0,0.12), 0 6px 12px -4px rgba(0,0,0,0.08)',
} as const;

/** 字体 */
export const FONTS = {
  family:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
  size: {
    xs: 12,
    sm: 13,
    base: 14,
    lg: 16,
    xl: 18,
    h3: 20,
    h2: 24,
    h1: 30,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  lineHeight: {
    tight: 1.2,
    base: 1.5715,
    relaxed: 1.8,
  },
} as const;

/** 内容区最大宽度 */
export const LAYOUT = {
  contentMaxWidth: 1440,
  siderWidth: 220,
  headerHeight: 64,
  contentPadding: SPACING.xl,
} as const;

/** 统一的 tokens 对象（方便整体引用） */
export const tokens = {
  brand: BRAND_COLORS,
  scene: SCENE_COLORS,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  fonts: FONTS,
  layout: LAYOUT,
} as const;
