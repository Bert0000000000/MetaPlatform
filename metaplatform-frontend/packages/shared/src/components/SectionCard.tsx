import { Card, Typography, Space } from '@douyinfe/semi-ui';
import type { CSSProperties, ReactNode } from 'react';

interface SectionCardProps {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  bodyPadding?: number | string;
  className?: string;
  style?: CSSProperties;
}

export default function SectionCard({
  title,
  extra,
  children,
  bodyPadding = 20,
  className,
  style,
}: SectionCardProps) {
  return (
    <Card
      className={className}
      style={style}
      headerLine
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            {title}
          </Typography.Text>
          {extra}
        </div>
      }
      bodyStyle={{ padding: bodyPadding }}
    >
      <Space vertical spacing="loose" style={{ width: '100%' }}>
        {children}
      </Space>
    </Card>
  );
}
