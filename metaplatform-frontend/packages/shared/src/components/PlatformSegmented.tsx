/**
 * PlatformSegmented — 平台统一分段控件（SegmentControl 视觉）。
 * 基于 Semi 原生 RadioGroup type="button" + buttonSize="small" 实现按钮式分组选。
 * 这是 Semi 2.89.2 推荐的形态（官方未提供原生 SegmentControl）。
 */
import { RadioGroup } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';

export interface PlatformSegmentedOption<T extends string> {
  label: ReactNode;
  value: T;
  icon?: ReactNode;
  disabled?: boolean;
}

interface PlatformSegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: PlatformSegmentedOption<T>[];
  size?: 'small' | 'medium' | 'large';
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function PlatformSegmented<T extends string>({
  value,
  onChange,
  options,
  size = 'medium',
  style,
  disabled,
}: PlatformSegmentedProps<T>) {
  const semiSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'middle';
  return (
    <RadioGroup
      type="button"
      buttonSize={semiSize}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      options={options.map((o) => ({
        label: o.icon ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{o.icon}{o.label}</span>
        ) : (
          o.label
        ),
        value: o.value,
        disabled: o.disabled,
      }))}
      style={style}
    />
  );
}
