import { Spin } from 'antd';

interface PageLoadingProps {
  tip?: string;
}

export default function PageLoading({ tip = '加载中...' }: PageLoadingProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        color: 'var(--muted-foreground)',
      }}
    >
      <Spin size="large" tip={tip} />
    </div>
  );
}
