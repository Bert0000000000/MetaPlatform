import { useMemo } from 'react';
import { Card, Tag, Typography, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { JsonRpcResponse } from '@/types';

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
            <Tag icon={<CloseCircleOutlined />} color="error">
              Error {response.error?.code}
            </Tag>
          ) : (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Success
            </Tag>
          )}
          {durationMs !== undefined && (
            <Typography.Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
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
          background: '#fafafa',
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
