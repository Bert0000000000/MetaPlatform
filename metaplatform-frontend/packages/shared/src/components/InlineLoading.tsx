import { Spin } from '@douyinfe/semi-ui';

interface InlineLoadingProps {
  size?: 'small' | 'middle' | 'large';
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
