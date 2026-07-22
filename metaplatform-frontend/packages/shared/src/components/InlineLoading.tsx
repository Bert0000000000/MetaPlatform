import { Spin } from 'antd';

interface InlineLoadingProps {
  size?: 'small' | 'default' | 'large';
  tip?: string;
}

export default function InlineLoading({ size = 'small', tip }: InlineLoadingProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)' }}>
      <Spin size={size} />
      {tip}
    </span>
  );
}
