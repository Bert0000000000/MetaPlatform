/**
 * Knowledge document management.
 * Uses the TECH-KB API instead of the retired static mock table.
 *
 * 文档上传走 KB 域自己的 /api/v1/kb/upload —— 它同时写 KB 文档表(本页数据源)
 * 和真实 RAG 入库(豆包 embedding),所以上传后立即可见、可被检索。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { FileText, RefreshCw, Search, Upload as UploadIcon } from 'lucide-react';
import { useAsync, useApiErrorBoundary } from '@mate/shared';
import { listDocuments, listKb, uploadDocumentToKb, type KbDocument, type KbEntity } from '@/api/kb';


const STATUS_LABELS: Record<string, { label: string; color: TagColor }> = {
  PROCESSED: { label: '已处理', color: 'green' },
  PROCESSING: { label: '处理中', color: 'blue' },
  PENDING: { label: '待处理', color: 'grey' },
  FAILED: { label: '失败', color: 'red' },
};

function formatBytes(value?: number) {
  if (value == null) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

type SemiTableProps = React.ComponentProps<typeof Table>;
type SemiColumns<T> = NonNullable<SemiTableProps['columns']>;

export default function KnowledgeDocsPage() {
  const { report } = useApiErrorBoundary();
  const [kbId, setKbId] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [uploading, setUploading] = useState(false);

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

  const handleUpload = async (file: File) => {
    if (!kbId) {
      Toast.warning('请先选择知识库');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadDocumentToKb(kbId, file);
      Toast.success(`「${result.filename}」已入库（${result.chunkCount} 个切片，已建立索引）`);
      await reload();
    } catch (e) {
      report(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setUploading(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((f) => handleUpload(f));
    e.target.value = '';
  };

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

  const columns: SemiColumns<KbDocument> = [
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
        const status = STATUS_LABELS[value] ?? { label: value, color: 'grey' };
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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <Card
          style={{ marginTop: 16 }}
          title="文档管理"
          headerExtraContent={
            <Space>
              {/* 原生 input + ref:uploadTrigger="custom" 下 Semi 的 onFileChange
                  实测不触发,原生 change 完全可控。 */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                multiple
                hidden
                onChange={onFilesPicked}
              />
              <Button
                icon={<UploadIcon size={14} />}
                theme="solid"
                type="primary"
                loading={uploading}
                disabled={!kbId}
                title={kbId ? '上传文档到当前知识库' : '请先选择知识库'}
                onClick={() => fileInputRef.current?.click()}
              >
                上传文档
              </Button>
              <Button icon={<RefreshCw size={14} />} onClick={reload} loading={loadingDocuments} disabled={!kbId}>
                刷新
              </Button>
            </Space>
          }
        >
          <Space wrap spacing={12} style={{ marginBottom: 16 }}>
            <Select
              aria-label="知识库"
              placeholder="选择知识库"
              style={{ width: 240 }}
              value={kbId}
              onChange={(value) => setKbId(value as string | undefined)}
              loading={loadingKbs}
              optionList={kbs.map((kb) => ({ value: kb.id, label: kb.displayName }))}
            />
            <Input
              aria-label="搜索文档名称"
              placeholder="搜索文档名称"
              prefix={<Search size={14} />}
              value={keyword}
              onChange={(value: string) => setKeyword(value)}
              showClear
              style={{ width: 320 }}
            />
          </Space>

          {!kbId ? (
            <Empty description="请先在上方选择知识库，即可查看文档并上传新文档" />
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredDocuments}
              loading={loadingDocuments}
              pagination={{ pageSize: 20 }}
              empty={keyword ? '没有匹配的文档' : '暂无文档'}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
