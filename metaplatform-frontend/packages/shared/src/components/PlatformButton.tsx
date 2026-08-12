import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

/**
 * 平台统一按钮。封装 antd Button + 平台 `v-btn*` 样式类。
 *
 * 提供 `variant` 语义，内部映射到 global.css 的 `v-btn` 系列类；
 * 同时保留 antd Button 的原生 props（type/danger/size/icon 等）。
 * 新代码统一用 PlatformButton，替代裸 `v-btn-primary` / `v-btn` class 拼接。
 */
export interface PlatformButtonProps extends Omit<ButtonProps, 'type' | 'danger' | 'ghost' | 'size' | 'variant'> {
  /** 视觉变体：primary 主按钮 / default 次按钮 / danger 危险 / ghost 幽灵 */
  variant?: 'primary' | 'default' | 'danger' | 'ghost';
  /** 尺寸：small 复用 v-btn-sm，其余走 v-btn 基准 */
  size?: 'small' | 'middle' | 'large';
  danger?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<PlatformButtonProps['variant']>, string> = {
  primary: 'v-btn-primary',
  default: 'v-btn',
  danger: 'v-btn-danger',
  ghost: 'v-btn-ghost',
};

export default function PlatformButton({
  variant = 'default',
  size,
  danger,
  className,
  children,
  ...rest
}: PlatformButtonProps) {
  const base = VARIANT_CLASS[variant] || VARIANT_CLASS.default;
  const sizeClass = size === 'small' ? 'v-btn-sm' : '';
  return (
    <Button
      className={[base, sizeClass, className].filter(Boolean).join(' ')}
      danger={danger}
      size={size}
      {...rest}
    >
      {children}
    </Button>
  );
}
