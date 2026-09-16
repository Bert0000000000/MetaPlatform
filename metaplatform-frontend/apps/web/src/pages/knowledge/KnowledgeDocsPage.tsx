/**
 * KnowledgeDocsPage —— 文档管理（DESIGN-SPEC §5 版式 E：表格页 + 详情浮层）。
 *
 * 文档上传走 KB 域自己的 /api/v1/kb/upload —— 它同时写 KB 文档表（本页数据源）
 * 和真实 RAG 入库（embedding），所以上传后立即可见、可被检索。
 * 数据面沿用 src/api/kb（本批不动）。
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Select, Tag, Toast, Upload } from '@douyinfe/semi-ui';
import { FileText, RefreshCw, Upload as UploadIcon } from 'lucide-react';
import { useAsync, useApiErrorBoundary } from '@mate/shared';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import { listDocuments, listKb, uploadDocumentToKb, type KbDocument, type KbEntity } from '@/api/kb';
import { kbStatusMeta } from './kbStatus';
import './kb.css';

const PAGE_SIZE = 20;

function formatBytes(value?: number) {
  if (value == null) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function KnowledgeDocsPage() {
  const { report } = useApiErrorBoundary();
  const [kbId, setKbId] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<KbDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const error = kbError ?? documentError;
  useEffect(() => {
    if (error) report(error);
  }, [error, report]);

  const handleUpload = async (file: File) => {
    if (!kbId) {
      Toast.warning('请先选择知识库');
      throw new Error('no kb selected');
    }
    setUploading(true);
    try {
      const result = await uploadDocumentToKb(kbId, file);
      Toast.success(`「${result.filename}」已入库（${result.chunkCount} 个切片，已建立索引）`);
      await reload();
    } catch (e) {
      report(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const kbNameById = useMemo(() => new Map(kbs.map((kb) => [kb.id, kb.displayName])), [kbs]);

  const filteredDocuments = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase();
    if (!normalized) return documents;
    return documents.filter((d) => d.title.toLocaleLowerCase().includes(normalized));
  }, [documents, keyword]);

  // 换知识库或改关键词都回到第 1 页。
  useEffect(() => {
    setCurrentPage(1);
  }, [kbId, keyword]);

  // 真·客户端分页：切片喂给表格，分页控件不再是空操作。
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const paged = useMemo(
    () => filteredDocuments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredDocuments, safePage],
  );

  const uploadButton = (
    <Upload
      accept=".pdf,.doc,.docx,.txt,.md"
      multiple
      showUploadList={false}
      draggable={false}
      disabled={!kbId}
      customRequest={({ fileInstance, onSuccess, onError }) => {
        handleUpload(fileInstance)
          .then((r) => onSuccess(r ?? null))
          .catch(() => onError({ status: 0 }));
      }}
    >
      <Button
        icon={<UploadIcon size={15} strokeWidth={1.5} />}
        theme="solid"
        type="primary"
        loading={uploading}
        disabled={!kbId}
        title={kbId ? '上传文档到当前知识库' : '请先选择知识库'}
      >
        上传文档
      </Button>
    </Upload>
  );

  return (
    <>
      <PageHeader
        title="文档管理"
        desc={`${documents.length} 个文档${kbId ? ` · ${kbNameById.get(kbId) ?? kbId}` : ''}`}
        actions={
          <>
            {uploadButton}
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              onClick={() => void reload()}
              loading={loadingDocuments}
              disabled={!kbId}
            >
              刷新
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索文档名称…' }}
        filters={
          <Select
            aria-label="知识库"
            placeholder="选择知识库"
            value={kbId}
            onChange={(value) => setKbId(value as string | undefined)}
            loading={loadingKbs}
            optionList={kbs.map((kb) => ({ value: kb.id, label: kb.displayName }))}
          />
        }
      />

      {!kbId ? (
        <EmptyState
          illustration="idle"
          title="还没有选择知识库"
          desc="在筛选栏选择一个知识库，即可查看文档并上传新文档。"
        />
      ) : filteredDocuments.length === 0 && !loadingDocuments ? (
        <EmptyState
          illustration={keyword ? 'no-result' : 'no-content'}
          title={keyword ? '没有匹配的文档' : '这个知识库还没有文档'}
          desc={keyword ? '换个关键词试试。' : '上传 PDF / Word / Markdown，平台会自动切片并建立索引。'}
          actions={uploadButton}
        />
      ) : (
        <DataTablePro<KbDocument>
          rowKey="id"
          loading={loadingDocuments}
          dataSource={paged}
          onRow={(record) => ({ onClick: () => setPreview(record as KbDocument) })}
          pagination={{
            currentPage: safePage,
            pageSize: PAGE_SIZE,
            total: filteredDocuments.length,
            onChange: setCurrentPage,
          }}
          columns={[
            {
              title: '文档',
              dataIndex: 'title',
              render: (title: string) => (
                <span className="mp-kb-name">
                  <FileText size={14} strokeWidth={1.5} />
                  {title}
                </span>
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
                const status = kbStatusMeta(value);
                return <Tag size="small" color={status.color}>{status.label}</Tag>;
              },
            },
            { title: '切片数', dataIndex: 'chunkCount', width: 100 },
            {
              title: '文件大小',
              dataIndex: 'fileSize',
              width: 120,
              render: (value?: number) => formatBytes(value),
            },
          ]}
        />
      )}

      <SheetDetail
        title={preview ? `文档 · ${preview.title}` : '文档详情'}
        open={preview !== null}
        onClose={() => setPreview(null)}
        footer={<Button onClick={() => setPreview(null)}>关闭</Button>}
      >
        {preview ? (
          <Descriptions
            row
            size="small"
            data={[
              { key: '名称', value: preview.title },
              { key: '知识库', value: kbNameById.get(preview.kbId) ?? preview.kbId },
              {
                key: '状态',
                value: (
                  <Tag color={kbStatusMeta(preview.status).color}>{kbStatusMeta(preview.status).label}</Tag>
                ),
              },
              { key: '切片数', value: String(preview.chunkCount ?? 0) },
              { key: '文件大小', value: formatBytes(preview.fileSize) },
              { key: '文档 ID', value: preview.id },
            ]}
          />
        ) : null}
      </SheetDetail>
    </>
  );
}
