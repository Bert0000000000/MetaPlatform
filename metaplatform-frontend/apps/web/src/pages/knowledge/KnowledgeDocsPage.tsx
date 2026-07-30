/**
 * Knowledge document management.
 * Uses the TECH-KB API instead of the retired static mock table.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { FileText, RefreshCw, Search } from 'lucide-react';
import { SubTabs, type SubTabItem, useAsync, useApiErrorBoundary } from '@mate/shared';
import { listDocuments, listKb, type KbDocument, type KbEntity } from '@/api/kb';

const KB_TABS: SubTabItem[] = [
  { label: '知识库列表', path: '/knowledge' },
  { label: '文档管理', path: '/knowledge/docs' },
  { label: '检索测试', path: '/knowledge/test' },
  { label: '检索配置', path: '/knowledge/config' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PROCESSED: { label: '已处理', color: 'success' },
  PROCESSING: { label: '处理中', color: 'processing' },
  PENDING: { label: '待处理', color: 'default' },
  FAILED: { label: '失败', color: 'error' },
};

function formatBytes(value?: number) {
  if (value == null) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function KnowledgeDocsPage() {
  const { report } = useApiErrorBoundary();
  const location = useLocation();
  const [kbId, setKbId] = useState<string>();
  const [keyword, setKeyword] = useState('');

  const {
    data: kbs = [],
    loading: loadingKbs,
    error: kbError,
  } = useAsync<KbEntity[]>(() => listKb(), [], { initialData: [] });

  const {
    data: documents = [],
    loading: loadingDocuments,
    error: documentError,
    reload,
  } = useAsync<KbDocument[]>(
    () => (kbId ? listDocuments(kbId) : Promise.resolve([])),
    [kbId],
    { initialData: [] },
  );

  const kbNameById = useMemo(
    () => new Map(kbs.map((kb) => [kb.id, kb.displayName])),
    [kbs],
  );
  const filteredDocuments = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase();
    if (!normalized) return documents;
    return documents.filter((document) =>
      document.title.toLocaleLowerCase().includes(normalized),
    );
  }, [documents, keyword]);

  const columns: TableColumnsType<KbDocument> = [
    {
      title: '文档',
      dataIndex: 'title',
      render: (title: string) => (
        <Space>
          <FileText size={16} />
          <Typography.Text>{title}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '知识库',
      dataIndex: 'kbId',
      width: 180,
      render: (value: string) => kbNameById.get(value) ?? value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const status = STATUS_LABELS[value] ?? { label: value, color: 'default' };
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    { title: '切片数', dataIndex: 'chunkCount', width: 100 },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      width: 120,
      render: (value?: number) => formatBytes(value),
    },
  ];

  const error = kbError ?? documentError;
  useEffect(() => {
    if (error) {
      report(error);
    }
  }, [error]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={KB_TABS} activePath={location.pathname} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <Card
          style={{ marginTop: 16 }}
          title="文档管理"
          extra={
            <Button icon={<RefreshCw size={14} />} onClick={reload} loading={loadingDocuments} disabled={!kbId}>
              刷新
            </Button>
          }
        >
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              aria-label="知识库"
              placeholder="选择知识库"
              style={{ width: 240 }}
              value={kbId}
              onChange={setKbId}
              loading={loadingKbs}
              options={kbs.map((kb) => ({ value: kb.id, label: kb.displayName }))}
            />
            <Input
              aria-label="搜索文档名称"
              placeholder="搜索文档名称"
              prefix={<Search size={14} />}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              allowClear
              style={{ width: 320 }}
            />
          </Space>

          {!kbId ? (
            <Empty description="请先选择知识库" />
          ) : (
            <Table<KbDocument>
              rowKey="id"
              columns={columns}
              dataSource={filteredDocuments}
              loading={loadingDocuments}
              pagination={{ pageSize: 20 }}
              locale={{ emptyText: keyword ? '没有匹配的文档' : '暂无文档' }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
