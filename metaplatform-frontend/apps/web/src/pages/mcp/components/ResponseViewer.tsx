import { useMemo } from 'react';
import { Card, Tag, Typography, Empty } from '@douyinfe/semi-ui';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { JsonRpcResponse } from '@/api/mcphub/types';

interface ResponseViewerProps {
  response: JsonRpcResponse | null;
  loading?: boolean;
  durationMs?: number;
}

export default function ResponseViewer({ response, loading, durationMs }: ResponseViewerProps) {
  const formatted = useMemo(() => {
    if (!response) return '';
    return JSON.stringify(
      response.result !== undefined ? response.result : response.error,
      null,
      2,
    );
  }, [response]);

  if (loading) return <Card title="响应"><Empty description="调用中…" /></Card>;
  if (!response) return <Card title="响应"><Empty description="尚未调用" /></Card>;

  const isError = !!response.error;

  return (
    <Card
      title={
        <span>
          响应{' '}
          {isError ? (
            <Tag color="red">
              <CloseCircleOutlined /> Error {response.error?.code}
            </Tag>
          ) : (
            <Tag color="green">
              <CheckCircleOutlined /> Success
            </Tag>
          )}
          {durationMs !== undefined && (
            <Typography.Text type="tertiary" style={{ marginLeft: 12, fontSize: 12 }}>
              {durationMs} ms
            </Typography.Text>
          )}
        </span>
      }
    >
      {isError && (
        <Typography.Paragraph type="danger">
          {response.error?.message}
        </Typography.Paragraph>
      )}
      <pre
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          padding: 12,
          borderRadius: 4,
          maxHeight: 400,
          overflow: 'auto',
          margin: 0,
          fontFamily: 'Menlo, Consolas, monospace',
          fontSize: 12,
        }}
      >
        {formatted}
      </pre>
    </Card>
  );
}
