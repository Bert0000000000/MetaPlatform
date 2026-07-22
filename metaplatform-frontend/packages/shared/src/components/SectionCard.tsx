import { Card, Typography, Space } from 'antd';
import type { ReactNode } from 'react';

interface SectionCardProps {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  bodyPadding?: number | string;
  className?: string;
}

export default function SectionCard({
  title,
  extra,
  children,
  bodyPadding = 20,
  className,
}: SectionCardProps) {
  return (
    <Card
      className={`v-card ${className ?? ''}`}
      styles={{ body: { padding: bodyPadding } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Text strong style={{ fontSize: 14, color: 'var(--foreground)' }}>
            {title}
          </Typography.Text>
          {extra}
        </div>
        {children}
      </Space>
    </Card>
  );
}
