import type { ReactNode } from 'react';
import PageLoading from './PageLoading';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

interface StateContainerProps {
  loading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyDescription?: ReactNode;
  children: ReactNode;
  onRetry?: () => void;
}

export default function StateContainer({
  loading,
  error,
  isEmpty,
  emptyDescription,
  children,
  onRetry,
}: StateContainerProps) {
  if (loading) return <PageLoading />;
  if (error) return <ErrorState description={error.message} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState description={emptyDescription} />;
  return <>{children}</>;
}
