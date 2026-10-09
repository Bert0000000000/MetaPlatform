/**
 * KnowledgeKbDetailPage — 知识库详情
 * --------------------------------------------------
 * 路由: /ki/kb/:kbId
 * 从知识库列表「查看详情」进入。展示 KB 信息 + 文档列表,
 * 支持直接上传文档到当前 KB(真实入库 RAG),
 * 点击文档行展开该文档的切片(chunk)原文。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Card, Collapse, Descriptions, Input, Spin, Space, Toast,
  Table, Tag, Typography, Upload,
} from '@douyinfe/semi-ui';
import { ArrowLeft, FileText, RefreshCw, Search, Upload as UploadIcon } from 'lucide-react';
import { useApiErrorBoundary, useAsync } from '@mate/shared';
import { EmptyState, PageHeader } from '@/components/skeleton';
import './kb.css';
import { kbStatusMeta } from './kbStatus';
import {
  getKbDetail, listDocuments, getDocumentChunks, uploadDocumentToKb,
  type KbDocument, type KbEntity, type DocumentChunk,
} from '@/api/kb';

function formatBytes(value?: number) {
  if (value == null) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function KnowledgeKbDetailPage() {
  const { kbId = '' } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { report } = useApiErrorBoundary();
  const [keyword, setKeyword] = useState('');
  const [activeDoc, setActiveDoc] = useState<string>();
  const [chunksByDoc, setChunksByDoc] = useState<Record<string, DocumentChunk[]>>({});
  const [chunkErrorsByDoc, setChunkErrorsByDoc] = useState<Record<string, string>>({});
  const [chunkRetry, setChunkRetry] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (!canUpload) throw new Error('知识库信息和文档列表读取成功后才可上传文档。');
    setUploading(true);
    try {
      const result = await uploadDocumentToKb(kbId, file);
      Toast.success(`「${result.filename}」已入库（${result.chunkCount} 个切片，已建立索引）`);
      setChunksByDoc({});
      setChunkErrorsByDoc({});
      await reload();
    } catch (e) {
      report(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const { data: kb, loading: loadingKb, error: kbError, reload: reloadKb } = useAsync<KbEntity | null>(
    () => (kbId ? getKbDetail(kbId) : Promise.resolve(null)),
    [kbId],
    { initialData: null },
  );

  const {
    data: loadedDocuments,
    loading: loadingDocs,
    error: documentsError,
    reload,
  } = useAsync<KbDocument[]>(
    () => (kbId ? listDocuments(kbId) : Promise.resolve([])),
    [kbId],
  );

  const documents = loadedDocuments ?? [];
  const kbReady = !loadingKb && !kbError && kb?.id === kbId;
  const documentsReady = !loadingDocs && !documentsError && loadedDocuments !== undefined;
  const kbMeta = kbReady ? kb : null;
  const canUpload = kbReady && documentsReady;
  const activeDocument = documentsReady ? documents.find((doc) => doc.id === activeDoc && doc.kbId === kbId) : undefined;

  useEffect(() => {
    setActiveDoc(undefined);
    setChunksByDoc({});
    setChunkErrorsByDoc({});
  }, [kbId]);

  useEffect(() => {
    if (!activeDoc || !activeDocument) return;
    if (chunksByDoc[activeDoc] !== undefined || chunkErrorsByDoc[activeDoc]) return;
    let alive = true;
    getDocumentChunks(activeDoc)
      .then((chunks) => { if (alive) setChunksByDoc((p) => ({ ...p, [activeDoc]: chunks })); })
      .catch((e) => {
        if (alive) {
          setChunkErrorsByDoc((p) => ({ ...p, [activeDoc]: e instanceof Error ? e.message : String(e) }));
          report(e instanceof Error ? e : new Error(String(e)));
        }
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc, activeDocument?.id, kbId, chunkRetry]);

  const filteredDocuments = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.title.toLocaleLowerCase().includes(q));
  }, [documents, keyword]);

  const totalChunks = useMemo(
    () => documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0),
    [documents],
  );

  if (!kbId) {
    return (
      <EmptyState
        illustration="failure"
        title="缺少知识库 ID"
        desc="请从知识库列表进入某个知识库的详情页。"
      />
    );
  }

  const expandedRowKeys = activeDoc ? [activeDoc] : [];

  return (
    <>
      <PageHeader
        title={
          <span className="mp-inline-flex mp-items-center mp-gap-2">
            <Button
              icon={<ArrowLeft size={14} />}
              theme="borderless"
              aria-label="返回知识库列表"
              onClick={() => navigate('/ki/kb')}
            />
            {kbMeta?.displayName ?? kbId}
          </span>
        }
        desc={kbMeta?.description || undefined}
        actions={
          <Space>
            {/* Semi Upload 官方接管姿势:customRequest 替换内置 xhr,
                fileInstance 是浏览器原生 File,成功/失败回调驱动 UI 状态。
                (uploadTrigger="custom" 是"等 ref.upload() 手动触发"的语义,
                不是"不发请求把文件交给我",此前误用。) action 为必填占位。 */}
            <Upload
              action="/api/v1/kb/upload"
              accept=".pdf,.doc,.docx,.txt,.md"
              multiple
              showUploadList={false}
              draggable={false}
              disabled={!canUpload}
              customRequest={({ fileInstance, onSuccess, onError }) => {
                handleUpload(fileInstance)
                  .then((r) => onSuccess(r ?? null))
                  .catch(() => onError({ status: 0 }));
              }}
            >
              <Button
                icon={<UploadIcon size={14} />}
                theme="solid"
                type="primary"
                loading={uploading}
                disabled={!canUpload}
                title={canUpload ? `上传文档到「${kbMeta?.displayName ?? kbId}」` : '知识库信息和文档列表读取成功后可上传'}
              >
                上传文档
              </Button>
            </Upload>
            <Button icon={<RefreshCw size={14} />} onClick={reload} loading={loadingDocs}>
              刷新
            </Button>
          </Space>
        }
      />

      <Card title="基本信息" className="mp-mt-4">
        {kbError && <div role="alert"><EmptyState illustration="failure" title="知识库信息读取失败" desc={kbError.message} actions={<Button onClick={reloadKb}>重试知识库</Button>} /></div>}
        <Spin spinning={loadingKb}>
          <Descriptions
            row
            size="small"
            className="mp-mb-1"
          >
            <Descriptions.Item itemKey="ID">{kbId}</Descriptions.Item>
            <Descriptions.Item itemKey="类型">
              <Tag>{kbMeta?.kbKind ?? '未提供'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item itemKey="状态">
              <Tag color={typeof kbMeta?.enabled === 'boolean' ? kbMeta.enabled ? 'green' : 'red' : 'grey'}>{typeof kbMeta?.enabled === 'boolean' ? kbMeta.enabled ? '启用' : '禁用' : '未提供'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item itemKey="文档数">{documentsReady ? documents.length : '未提供'}</Descriptions.Item>
            <Descriptions.Item itemKey="切片总数">{documentsReady ? totalChunks : '未提供'}</Descriptions.Item>
          </Descriptions>
        </Spin>
      </Card>

      <Card title={documentsReady ? `文档列表（${documents.length}）` : '文档列表'} className="mp-mt-4">
        <Input
          aria-label="搜索文档"
          placeholder="搜索文档名称"
          prefix={<Search size={14} />}
          value={keyword}
          onChange={setKeyword}
          showClear
          disabled={!documentsReady}
          className="mp-mb-3 mp-kb-detail-search"
        />
        {documentsError ? <div role="alert"><EmptyState illustration="failure" title="文档列表读取失败" desc={documentsError.message} actions={<Button onClick={reload}>重试文档列表</Button>} /></div> : !documentsReady ? <Spin tip="正在读取文档…" /> : <Table<KbDocument>
          rowKey="id"
          dataSource={filteredDocuments}
          loading={loadingDocs}
          pagination={{ pageSize: 20 }}
          expandedRowKeys={expandedRowKeys}
          onExpand={(expanded, record) => {
            const doc = record as KbDocument | undefined;
            setActiveDoc(expanded && doc ? doc.id : undefined);
          }}
          expandedRowRender={(record) => {
            const doc = record as KbDocument | undefined;
            if (!doc) return null;
            const chunks = chunksByDoc[doc.id];
            const chunkError = chunkErrorsByDoc[doc.id];
            if (chunkError) {
              return <div role="alert"><EmptyState illustration="failure" title="文档切片读取失败" desc={chunkError} actions={<Button onClick={() => {
                setChunkErrorsByDoc((previous) => { const next = { ...previous }; delete next[doc.id]; return next; });
                setChunkRetry((value) => value + 1);
              }}>重试文档切片</Button>} /></div>;
            }
            if (chunks === undefined) {
              return <div className="mp-p-3"><Spin tip="正在读取切片…" /></div>;
            }
            if (chunks.length === 0) {
              return (
                <EmptyState
                  illustration="no-content"
                  title="暂无切片内容"
                  desc="当前文档读取成功，尚未返回切片内容。"
                />
              );
            }
            return (
              <Collapse className="mp-bg-1" defaultActiveKey={chunks[0]?.chunkId}>
                {chunks.map((c, i) => (
                  <Collapse.Panel
                    header={`切片 ${i + 1} · ${c.chunkId.slice(0, 8)}…`}
                    itemKey={c.chunkId}
                    key={c.chunkId}
                  >
                    <Typography.Paragraph copyable className="mp-m-0 mp-kb-pre-wrap">
                      {c.text}
                    </Typography.Paragraph>
                  </Collapse.Panel>
                ))}
              </Collapse>
            );
          }}
          empty={
            <EmptyState
              illustration={keyword ? 'no-result' : 'no-content'}
              title={keyword ? '没有匹配的文档' : '暂无文档'}
              desc={keyword ? '换个关键词试试。' : '上传 PDF / Word / Markdown，平台会自动切片并建立索引。'}
            />
          }
          columns={[
            {
              title: '文档',
              dataIndex: 'title',
              render: (t: string) => (
                <span className="mp-inline-flex mp-items-center mp-gap-2">
                  <FileText size={14} />
                  {t}
                </span>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (v: string) => {
                const meta = kbStatusMeta(v);
                return <Tag size="small" color={meta.color}>{meta.label}</Tag>;
              },
            },
            { title: '切片数', dataIndex: 'chunkCount', width: 90 },
            {
              title: '大小',
              dataIndex: 'fileSize',
              width: 100,
              render: (v?: number) => formatBytes(v),
            },
            {
              title: '',
              width: 90,
              render: (_: unknown, record: KbDocument) => (
                <Button
                  size="small"
                  theme="borderless"
                  onClick={() => setActiveDoc(activeDoc === record.id ? undefined : record.id)}
                >
                  {activeDoc === record.id ? '收起切片' : '查看切片'}
                </Button>
              ),
            },
          ]}
        />}
      </Card>
    </>
  );
}
