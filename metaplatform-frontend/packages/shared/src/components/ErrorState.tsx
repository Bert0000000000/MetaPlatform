import { Button, Result } from 'antd';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryText?: string;
}

export default function ErrorState({
  title = '加载失败',
  description = '请检查网络或稍后重试',
  onRetry,
  retryText = '重试',
}: ErrorStateProps) {
  return (
    <Result
      icon={<AlertTriangle size={48} color="var(--destructive)" strokeWidth={1.5} />}
      title={<span style={{ color: 'var(--foreground)' }}>{title}</span>}
      subTitle={<span style={{ color: 'var(--muted-foreground)' }}>{description}</span>}
      extra={
        onRetry ? (
          <Button className="v-btn-primary" onClick={onRetry}>
            {retryText}
          </Button>
        ) : null
      }
    />
  );
}
