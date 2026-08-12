import { Button, Typography } from '@douyinfe/semi-ui';
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 48,
        textAlign: 'center',
      }}
    >
      <AlertTriangle size={48} color="var(--destructive)" strokeWidth={1.5} />
      <Typography.Title heading={5} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
        {description}
      </Typography.Text>
      {onRetry ? (
        <Button theme="solid" type="primary" onClick={onRetry}>
          {retryText}
        </Button>
      ) : null}
    </div>
  );
}
