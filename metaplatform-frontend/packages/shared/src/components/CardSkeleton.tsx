import { Skeleton } from 'antd';

interface CardSkeletonProps {
  rows?: number;
}

export default function CardSkeleton({ rows = 3 }: CardSkeletonProps) {
  return (
    <div className="v-card" style={{ padding: 20, marginBottom: 16 }}>
      <Skeleton active paragraph={{ rows }} />
    </div>
  );
}
