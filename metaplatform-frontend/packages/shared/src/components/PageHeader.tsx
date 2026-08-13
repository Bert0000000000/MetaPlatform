import { Typography, Space } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
}

export default function PageHeader({ title, subtitle, description, extra }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 16,
        minHeight: 40,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
          {typeof title === 'string' ? (
            <Typography.Title heading={5} style={{ margin: 0 }}>{title}</Typography.Title>
          ) : (
            title
          )}
          {subtitle}
        </div>
        {description && (
          <Typography.Text type="tertiary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
            {description}
          </Typography.Text>
        )}
      </div>
      {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
    </div>
  );
}
