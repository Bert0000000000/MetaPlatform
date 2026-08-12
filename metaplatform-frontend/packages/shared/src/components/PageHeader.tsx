import { Typography, Space } from '@douyinfe/semi-ui';
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
      <Space vertical spacing="tight">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
            {subtitle}
          </Typography.Text>
        )}
      </Space>
      {extra}
    </div>
  );
}
