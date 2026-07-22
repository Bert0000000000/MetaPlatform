import { Typography, Space } from 'antd';
import type { ReactNode } from 'react';

interface PageContainerProps {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

export default function PageContainer({ title, description, extra, children }: PageContainerProps) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space direction="vertical" size="small">
          <Typography.Title level={4} style={{ margin: 0, color: 'var(--foreground)' }}>
            {title}
          </Typography.Title>
          {description && (
            <Typography.Text style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>
              {description}
            </Typography.Text>
          )}
        </Space>
        {extra}
      </div>
      {children}
    </Space>
  );
}
