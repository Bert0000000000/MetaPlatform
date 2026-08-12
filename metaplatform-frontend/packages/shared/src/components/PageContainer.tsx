import { Typography, Space } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';

interface PageContainerProps {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

export default function PageContainer({ title, description, extra, children }: PageContainerProps) {
  return (
    <Space vertical spacing="loose" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space vertical spacing="tight">
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {description && (
            <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
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
