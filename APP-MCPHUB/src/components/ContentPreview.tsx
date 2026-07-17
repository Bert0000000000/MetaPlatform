import { Card, Typography, Empty } from 'antd';
import { useMemo } from 'react';
import type { McpResource } from '@/types';

interface ContentPreviewProps {
  resource: McpResource;
}

export default function ContentPreview({ resource }: ContentPreviewProps) {
  const isText = ['text/plain', 'text/markdown', 'application/json'].includes(resource.mimeType);
  const content = useMemo(() => {
    if (!isText) return resource.content;
    if (resource.mimeType === 'application/json') {
      try {
        return JSON.stringify(JSON.parse(resource.content), null, 2);
      } catch {
        return resource.content;
      }
    }
    return resource.content;
  }, [isText, resource]);

  if (!isText) {
    return (
      <Card title="预览" size="small">
        <Empty description={`不支持直接预览 ${resource.mimeType} 类型，请下载查看`} />
      </Card>
    );
  }

  return (
    <Card title={`预览 (${resource.mimeType})`} size="small">
      <Typography.Paragraph copyable={{ text: content }}>
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
          {content}
        </pre>
      </Typography.Paragraph>
    </Card>
  );
}
