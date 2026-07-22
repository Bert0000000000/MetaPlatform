import { useState, useCallback, useEffect } from 'react';
import { Upload, Button, List, Tag, Typography, Space, Progress, message, Popconfirm } from 'antd';
import {
  InboxOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileTextOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { uploadDocument, listDocuments, deleteDocument } from '@/api/documents';
import type { DocumentItem } from '@/types';

interface DocumentUploadProps {
  employeeId: string;
  onDocumentProcessed?: (doc: DocumentItem) => void;
}

function getFileIcon(fileType: DocumentItem['fileType']) {
  switch (fileType) {
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#f5222d' }} />;
    case 'word':
      return <FileWordOutlined style={{ color: '#1677ff' }} />;
    case 'txt':
    case 'md':
      return <FileTextOutlined style={{ color: '#52c41a' }} />;
    default:
      return <FileTextOutlined />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_TAGS: Record<DocumentItem['status'], { color: string; label: string }> = {
  uploaded: { color: 'blue', label: '已上传' },
  processing: { color: 'orange', label: '处理中' },
  ready: { color: 'green', label: '已就绪' },
  failed: { color: 'red', label: '失败' },
};

export default function DocumentUpload({ employeeId, onDocumentProcessed }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await listDocuments(employeeId);
      setDocuments(docs);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const doc = await uploadDocument(employeeId, file);
      message.success(`文件「${file.name}」上传成功`);
      setDocuments((prev) => [...prev, doc]);
      onDocumentProcessed?.(doc);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      message.success('文档已删除');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: '.pdf,.doc,.docx,.txt,.md',
    showUploadList: false,
    beforeUpload: (file) => {
      handleUpload(file);
      return false;
    },
  };

  const { Dragger } = Upload;

  return (
    <div>
      <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持 PDF、Word（.doc/.docx）、TXT、Markdown 文件，单个文件不超过 50MB
        </p>
      </Dragger>

      {uploading && (
        <Progress percent={100} status="active" style={{ marginBottom: 16 }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text strong>文档列表 ({documents.length})</Typography.Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={loadDocs} loading={loading}>
          刷新
        </Button>
      </div>

      <List
        loading={loading}
        dataSource={documents}
        locale={{ emptyText: '暂无上传文档' }}
        renderItem={(doc) => (
          <List.Item
            actions={[
              <Popconfirm
                key="delete"
                title="确认删除"
                description={`确定删除「${doc.filename}」吗？`}
                onConfirm={() => handleDelete(doc.id)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={getFileIcon(doc.fileType)}
              title={
                <Space>
                  <Typography.Text>{doc.filename}</Typography.Text>
                  <Tag color={STATUS_TAGS[doc.status].color}>{STATUS_TAGS[doc.status].label}</Tag>
                </Space>
              }
              description={
                <Space size="small">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {formatFileSize(doc.fileSize)}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(doc.uploadedAt).toLocaleString()}
                  </Typography.Text>
                  {doc.errorMessage && (
                    <Typography.Text type="danger" style={{ fontSize: 12 }}>
                      {doc.errorMessage}
                    </Typography.Text>
                  )}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
}
