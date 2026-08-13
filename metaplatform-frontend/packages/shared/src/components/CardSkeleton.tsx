import { Card } from '@douyinfe/semi-ui';

interface CardSkeletonProps {
  rows?: number;
}

export default function CardSkeleton({ rows = 3 }: CardSkeletonProps) {
  return (
    <Card
      style={{ marginBottom: 16 }}
      bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: i === rows - 1 ? '60%' : '100%',
            borderRadius: 4,
            background: 'var(--muted)',
            animation: 'workbench-shimmer 1.5s infinite',
          }}
        />
      ))}
    </Card>
  );
}
