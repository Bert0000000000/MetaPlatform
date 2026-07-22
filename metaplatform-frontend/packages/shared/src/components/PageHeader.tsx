import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}

export default function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}
    >
      <Space direction="vertical" size="small">
        <Typography.Title level={4} style={{ margin: 0, color: 'var(--foreground)' }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>
            {subtitle}
          </Typography.Text>
        )}
      </Space>
      {extra}
    </div>
  );
}
