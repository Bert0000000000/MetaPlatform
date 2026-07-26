import React, { useState } from 'react';
import { Button, Drawer, Typography, Space, Tag } from 'antd';
import { DownloadOutlined, EyeOutlined } from '../icons';

/**
 * Artifact 查看器（P4.1.4）。
 */
export interface Artifact {
  id: string;
  displayName: string;
  mimeType?: string;
  byteSize?: number;
  downloadUrl?: string;
  previewUrl?: string;
  metadata?: Record<string, unknown>;
}

export function ArtifactViewer({ artifact }: { artifact: Artifact }) {
  const [open, setOpen] = useState(false);
  const isText = artifact.mimeType?.startsWith('text/') || artifact.mimeType?.includes('markdown') || artifact.mimeType?.includes('json');
  return (
    <>
      <Space>
        <Button icon={<EyeOutlined />} onClick={() => setOpen(true)}>预览</Button>
        {artifact.downloadUrl && (
          <Button icon={<DownloadOutlined />} href={artifact.downloadUrl}>下载</Button>
        )}
        <Tag>{artifact.mimeType ?? 'unknown'}</Tag>
        {artifact.byteSize != null && <Tag>{(artifact.byteSize / 1024).toFixed(1)} KB</Tag>}
      </Space>
      <Drawer
        title={artifact.displayName}
        open={open}
        onClose={() => setOpen(false)}
        width={720}
      >
        {isText && artifact.previewUrl ? (
          <iframe src={artifact.previewUrl} style={{ width: '100%', height: '70vh', border: 0 }} />
        ) : artifact.previewUrl ? (
          <img src={artifact.previewUrl} style={{ maxWidth: '100%' }} alt={artifact.displayName} />
        ) : (
          <Typography.Paragraph type="secondary">无预览内容</Typography.Paragraph>
        )}
      </Drawer>
    </>
  );
}
