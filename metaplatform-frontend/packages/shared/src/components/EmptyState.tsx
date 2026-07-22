import { Empty } from 'antd';
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  description?: ReactNode;
}

export default function EmptyState({ description = '暂无数据' }: EmptyStateProps) {
  return (
    <Empty
      image={<Inbox size={48} color="var(--muted-foreground)" strokeWidth={1.5} />}
      description={<span style={{ color: 'var(--muted-foreground)' }}>{description}</span>}
      style={{ padding: 40 }}
    />
  );
}
