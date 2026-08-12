import { Button } from '@douyinfe/semi-ui';
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

type SemiButtonProps = React.ComponentProps<typeof Button>;

/**
 * 平台统一按钮，基于 Semi Button。
 * variant 语义映射到 Semi 的 type/theme 组合。
 */
export interface PlatformButtonProps {
  /** 视觉变体：primary 主按钮 / default 次按钮 / danger 危险 / ghost 幽灵 */
  variant?: 'primary' | 'default' | 'danger' | 'ghost';
  size?: 'small' | 'default' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
  htmlType?: 'button' | 'submit' | 'reset';
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const VARIANT_STYLE: Record<
  NonNullable<PlatformButtonProps['variant']>,
  { theme: 'solid' | 'light' | 'borderless'; type: 'primary' | 'secondary' | 'tertiary' | 'danger' }
> = {
  primary: { theme: 'solid', type: 'primary' },
  default: { theme: 'light', type: 'secondary' },
  danger: { theme: 'light', type: 'danger' },
  ghost: { theme: 'borderless', type: 'tertiary' },
};

export default function PlatformButton({
  variant = 'default',
  size,
  htmlType,
  className,
  children,
  ...rest
}: PlatformButtonProps) {
  const v = VARIANT_STYLE[variant];
  const semiProps: SemiButtonProps = { theme: v.theme, type: v.type, size, className, htmlType, ...rest };
  return <Button {...semiProps}>{children}</Button>;
}
