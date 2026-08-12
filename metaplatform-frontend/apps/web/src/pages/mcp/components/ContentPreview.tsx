import { Card, Typography, Empty } from '@douyinfe/semi-ui';
import { useMemo } from 'react';
import type { McpResource } from '@/api/mcphub/types';

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
      <Card title="预览">
        <Empty description={`不支持直接预览 ${resource.mimeType} 类型，请下载查看`} />
      </Card>
    );
  }

  return (
    <Card title={`预览 (${resource.mimeType})`}>
      <Typography.Paragraph copyable={{ content }}>
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
          {content}
        </pre>
      </Typography.Paragraph>
    </Card>
  );
}
