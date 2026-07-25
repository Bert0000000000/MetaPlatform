/**
 * Mate Platform 品牌图标（纯六边形）
 *
 * 六边形线框，可选填充。用于登录页 / 侧边栏顶部。
 *
 * 用法：
 *   <MateLogo size={28} />
 *   <MateLogo size={20} variant="light" />  // 反色版，用于主色背景徽章
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

// 平顶六边形顶点（中心 12,12，半径 10）
const HEX_POINTS = '6.5,2 17.5,2 23,12 17.5,22 6.5,22 1,12';

const PALETTE: Record<MateLogoVariant, { fill: string; stroke: string }> = {
  // 默认：透明填充 + 前景色边框（用于深色背景）
  color: {
    fill: 'transparent',
    stroke: 'var(--foreground, #fafafa)',
  },
  // 反色：半透明白色填充 + 白色边框（用于 primary 徽章背景）
  light: {
    fill: 'rgba(255,255,255,0.10)',
    stroke: 'rgba(255,255,255,0.95)',
  },
  // 单色：仅边框（用于 sidebar 折叠态等）
  mono: {
    fill: 'transparent',
    stroke: 'currentColor',
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
    filter: glow ? 'drop-shadow(0 0 6px rgba(96,165,250,0.4))' : undefined,
    ...style,
  };
  return (
    <span style={wrapperStyle} className={className} aria-label="Mate Platform logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <polygon
          points={HEX_POINTS}
          fill={palette.fill}
          stroke={palette.stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
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
