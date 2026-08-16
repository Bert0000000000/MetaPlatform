/**
 * KnowledgeKbDetailPage — 知识库详情
 * --------------------------------------------------
 * 路由: /knowledge/kb/:kbId
 * 从知识库列表「查看详情」进入。展示 KB 信息 + 文档列表,
 * 支持直接上传文档到当前 KB(真实入库 RAG),
 * 点击文档行展开该文档的切片(chunk)原文。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Card, Collapse, Descriptions, Empty, Input, Spin, Space, Toast,
  Table, Tag, Typography, Upload,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { ArrowLeft, FileText, RefreshCw, Search, Upload as UploadIcon } from 'lucide-react';
import { useApiErrorBoundary, useAsync } from '@mate/shared';
import {
  getKbDetail, listDocuments, getDocumentChunks, uploadDocumentToKb,
  type KbDocument, type KbEntity, type DocumentChunk,
} from '@/api/kb';

const STATUS_LABELS: Record<string, { label: string; color: TagColor }> = {
  indexed: { label: '已索引', color: 'green' },
  uploaded: { label: '已上传', color: 'blue' },
  indexing: { label: '索引中', color: 'blue' },
  failed: { label: '失败', color: 'red' },
  archived: { label: '已归档', color: 'grey' },
};

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
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadDocumentToKb(kbId, file);
      Toast.success(`「${result.filename}」已入库（${result.chunkCount} 个切片，已建立索引）`);
      setChunksByDoc({});
      await reload();
    } catch (e) {
      report(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const { data: kb, loading: loadingKb } = useAsync<KbEntity | null>(
    () => (kbId ? getKbDetail(kbId).catch(() => null) : Promise.resolve(null)),
    [kbId],
    { initialData: null },
  );

  const {
    data: documents = [],
    loading: loadingDocs,
    reload,
  } = useAsync<KbDocument[]>(
    () => (kbId ? listDocuments(kbId) : Promise.resolve([])),
    [kbId],
    { initialData: [] },
  );

  useEffect(() => {
    if (!activeDoc) return;
    if (chunksByDoc[activeDoc]) return;
    let alive = true;
    setLoadingChunks(true);
    getDocumentChunks(activeDoc)
      .then((chunks) => { if (alive) setChunksByDoc((p) => ({ ...p, [activeDoc]: chunks })); })
      .catch((e) => {
        if (alive) {
          setChunksByDoc((p) => ({ ...p, [activeDoc]: [] }));
          report(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .finally(() => { if (alive) setLoadingChunks(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc]);

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
    return <Empty description="缺少知识库 ID" />;
  }

  const expandedRowKeys = activeDoc ? [activeDoc] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <Card
          style={{ marginTop: 16 }}
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Button
                icon={<ArrowLeft size={14} />}
                theme="borderless"
                onClick={() => navigate('/knowledge')}
              />
              {kb?.displayName ?? kbId}
            </span>
          }
          headerExtraContent={
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
                  title={`上传文档到「${kb?.displayName ?? kbId}」`}
                >
                  上传文档
                </Button>
              </Upload>
              <Button icon={<RefreshCw size={14} />} onClick={reload} loading={loadingDocs}>
                刷新
              </Button>
            </Space>
          }
        >
          <Spin spinning={loadingKb}>
            <Descriptions
              row
              size="small"
              style={{ marginBottom: 4 }}
            >
              <Descriptions.Item itemKey="ID">{kbId}</Descriptions.Item>
              <Descriptions.Item itemKey="类型">
                <Tag>{kb?.kbKind ?? '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item itemKey="状态">
                <Tag color={kb?.enabled ? 'green' : 'red'}>{kb?.enabled ? '启用' : '禁用'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item itemKey="文档数">{documents.length}</Descriptions.Item>
              <Descriptions.Item itemKey="切片总数">{totalChunks}</Descriptions.Item>
            </Descriptions>
            {kb?.description && (
              <Typography.Text type="tertiary" size="small">{kb.description}</Typography.Text>
            )}
          </Spin>
        </Card>

        <Card title={`文档列表（${documents.length}）`} style={{ marginTop: 16 }}>
          <Input
            aria-label="搜索文档"
            placeholder="搜索文档名称"
            prefix={<Search size={14} />}
            value={keyword}
            onChange={setKeyword}
            showClear
            style={{ width: 320, marginBottom: 12 }}
          />
          <Table<KbDocument>
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
              if (loadingChunks && !chunks) {
                return <div style={{ padding: 12 }}><Spin /></div>;
              }
              if (!chunks || chunks.length === 0) {
                return <Empty description="暂无切片内容（文档可能未索引，或服务为内存模式重启后清空）" style={{ padding: 12 }} />;
              }
              return (
                <Collapse style={{ background: 'var(--semi-color-bg-1)' }} defaultActiveKey={chunks[0]?.chunkId}>
                  {chunks.map((c, i) => (
                    <Collapse.Panel
                      header={`切片 ${i + 1} · ${c.chunkId.slice(0, 8)}…`}
                      itemKey={c.chunkId}
                      key={c.chunkId}
                    >
                      <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                        {c.text}
                      </Typography.Paragraph>
                    </Collapse.Panel>
                  ))}
                </Collapse>
              );
            }}
            empty={keyword ? '没有匹配的文档' : '暂无文档，去「文档管理」上传'}
            columns={[
              {
                title: '文档',
                dataIndex: 'title',
                render: (t: string) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
                  const meta = STATUS_LABELS[v] ?? { label: v, color: 'grey' as TagColor };
                  return <Tag color={meta.color}>{meta.label}</Tag>;
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
          />
        </Card>
      </div>
    </div>
  );
}
