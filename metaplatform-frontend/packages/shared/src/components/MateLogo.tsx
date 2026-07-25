/**
 * Mate Platform 品牌图标
 *
 * 设计语义：
 *   - 六边形外框：象征"多边、聚合、生态" — 与平台多服务/多租户的形态契合
 *   - 内嵌三条升序条形图：象征"数据驱动 + AI 增长"
 *   - 右上角小节点：象征"连接、节点网络"
 *
 * 用于：登录页左上角、侧边栏顶部（与 sidebar-logo-badge 配合）。
 *
 * 用法：
 *   <MateLogo size={28} />
 *   <MateLogo size={20} variant="light" />  // 反色版，用于深色徽章背景
 */

import type { CSSProperties } from 'react';

export type MateLogoVariant = 'color' | 'light' | 'mono';

export interface MateLogoProps {
  /** 图标尺寸（正方形），默认 28 */
  size?: number;
  /** 配色版本 */
  variant?: MateLogoVariant;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 是否带细微辉光（登录页背景用） */
  glow?: boolean;
  className?: string;
}

// 六边形顶点（中心为 24x24，r=10）— 平顶六边形
const HEX_POINTS = [
  [6.5, 2],
  [17.5, 2],
  [23, 12],
  [17.5, 22],
  [6.5, 22],
  [1, 12],
];

const PALETTE: Record<MateLogoVariant, {
  fill: string;
  stroke: string;
  bar: string;
  node: string;
}> = {
  // 默认彩色：透明背景 + 白边 + 蓝色条形图（用于浅色背景）
  color: {
    fill: 'transparent',
    stroke: 'var(--foreground, #fafafa)',
    bar: '#60a5fa',
    node: '#62d178',
  },
  // 反色：填充深色 + 白色条形图（用于 primary 背景徽章）
  light: {
    fill: 'rgba(255,255,255,0.06)',
    stroke: 'rgba(255,255,255,0.95)',
    bar: '#ffffff',
    node: '#62d178',
  },
  // 单色：仅边框（用于 sidebar 折叠态等）
  mono: {
    fill: 'transparent',
    stroke: 'currentColor',
    bar: 'currentColor',
    node: 'currentColor',
  },
};

export default function MateLogo({
  size = 28,
  variant = 'color',
  style,
  glow = false,
  className,
}: MateLogoProps) {
  const palette = PALETTE[variant];
  const wrapperStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
    position: 'relative',
    filter: glow ? `drop-shadow(0 0 8px rgba(96,165,250,0.45))` : undefined,
    ...style,
  };
  const half = size / 2;
  return (
    <span style={wrapperStyle} className={className} aria-label="Mate Platform logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* 六边形外框 */}
        <polygon
          points={HEX_POINTS.map((p) => p.join(',')).join(' ')}
          fill={palette.fill}
          stroke={palette.stroke}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* 内嵌升序条形图 — 三条柱子，从低到高 */}
        <rect x="6.6"  y="13.5" width="2.2" height="3"   rx="0.4" fill={palette.bar} />
        <rect x="10.9" y="10.5" width="2.2" height="6"   rx="0.4" fill={palette.bar} />
        <rect x="15.2" y="7"    width="2.2" height="9.5" rx="0.4" fill={palette.bar} />
        {/* 右上角小节点 + 连接线 — 象征生态节点 */}
        <circle cx="18" cy="5" r="1.6" fill={palette.node} />
        <line x1="17.5" y1="7" x2="18" y2="5.8" stroke={palette.node} strokeWidth="0.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * 复合 Logo：图标 + Mate 文本徽章
 * 用于登录页、侧边栏展开态
 */
export interface MateBrandProps {
  /** 图标尺寸 */
  iconSize?: number;
  /** 徽章尺寸：'sm' = 小（默认）、'md' = 中 */
  badgeSize?: 'sm' | 'md';
  /** 徽章变体：'filled' = primary 背景（默认）、'ghost' = 透明描边 */
  variant?: 'filled' | 'ghost';
  /** 折叠态 — 只显示图标 */
  collapsed?: boolean;
  style?: CSSProperties;
}

export function MateBrand({
  iconSize = 24,
  badgeSize = 'sm',
  variant = 'filled',
  collapsed = false,
  style,
}: MateBrandProps) {
  const badgePad = badgeSize === 'md' ? '4px 12px' : '3px 10px';
  const badgeFont = badgeSize === 'md' ? 14 : 13;
  if (collapsed) {
    return <MateLogo size={iconSize} variant="light" style={style} />;
  }
  const logoVariant: MateLogoVariant = variant === 'filled' ? 'light' : 'color';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: badgeFont,
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <MateLogo size={iconSize} variant={logoVariant} />
      <span
        style={{
          background: variant === 'filled' ? 'var(--primary)' : 'transparent',
          color: variant === 'filled' ? 'var(--primary-foreground)' : 'var(--foreground)',
          padding: badgePad,
          borderRadius: 'var(--radius)',
          border: variant === 'ghost' ? '1px solid var(--border)' : '1px solid transparent',
          letterSpacing: '0.02em',
        }}
      >
        Mate
      </span>
    </span>
  );
}
