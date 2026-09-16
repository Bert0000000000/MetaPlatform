import { Card, Typography } from '@douyinfe/semi-ui';
import { useMemo } from 'react';
import type { McpResource } from '@/api/mcphub/types';
import { EmptyState } from '@/components/skeleton';
import '../mcp.css';

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
        <EmptyState title={`不支持直接预览 ${resource.mimeType} 类型，请下载查看`} />
      </Card>
    );
  }

  return (
    <Card title={`预览 (${resource.mimeType})`}>
      <Typography.Paragraph copyable={{ content }}>
        <pre
          className="mp-overflow-auto mp-border mp-p-3 mp-m-0 mp-text-sm mp-bg-1 mp-rounded-sm mp-mcp-max-h-400 mp-mono"
        >
          {content}
        </pre>
      </Typography.Paragraph>
    </Card>
  );
}
