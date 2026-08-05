import { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, Button, Empty, Tag, Typography, Space, Progress, Spin, message, Popconfirm, Input } from 'antd';
import type { UploadProps } from 'antd';
import {
  InboxOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  CloudUploadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleFilled,
  SyncOutlined,
  CloseCircleFilled,
  FileOutlined,
} from '@ant-design/icons';
import { uploadDocument, listDocuments, deleteDocument } from '@/api/dw/documents';
import type { DocumentItem, DocumentStatus } from '@/api/dw/types';

interface DocumentUploadProps {
  employeeId: string;
  onDocumentProcessed?: (doc: DocumentItem) => void;
}

// ---------------------------------------------------------------------------
// 设计 token — 与 packages/shared/src/theme.ts 保持一致
// ---------------------------------------------------------------------------
const TOKENS = {
  bgBody: '#0a0a0a',
  bgContainer: '#111111',
  bgElevated: '#1a1a1a',
  bgHover: '#1a1a1a',
  border: '#262626',
  borderStrong: '#525252',
  textPrimary: '#fafafa',
  textSecondary: '#a1a1a1',
  textTertiary: '#737373',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
};

// ---------------------------------------------------------------------------
// 文件类型 → 图标 + 配色 + 标签
// ---------------------------------------------------------------------------
const FILE_TYPE_META: Record<DocumentItem['fileType'], { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  pdf:  { icon: <FilePdfOutlined />,   color: '#f87171', bg: 'rgba(239, 68, 68, 0.12)',  label: 'PDF' },
  word: { icon: <FileWordOutlined />,  color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)', label: 'Word' },
  txt:  { icon: <FileTextOutlined />,  color: '#a3a3a3', bg: 'rgba(163, 163, 163, 0.10)', label: 'TXT' },
  md:   { icon: <FileTextOutlined />,  color: '#a3a3a3', bg: 'rgba(163, 163, 163, 0.10)', label: 'MD' },
  other:{ icon: <FileUnknownOutlined />, color: '#a3a3a3', bg: 'rgba(163, 163, 163, 0.10)', label: '文件' },
};

// ---------------------------------------------------------------------------
// 状态 → 点 + 颜色 + 标签
// ---------------------------------------------------------------------------
const STATUS_META: Record<DocumentStatus, { color: string; label: string; dot: React.ReactNode }> = {
  uploaded:   { color: TOKENS.info,    label: '已上传',   dot: <CheckCircleFilled style={{ color: TOKENS.info }} /> },
  processing: { color: TOKENS.warning, label: '处理中',   dot: <SyncOutlined spin style={{ color: TOKENS.warning }} /> },
  ready:      { color: TOKENS.success, label: '已就绪',   dot: <CheckCircleFilled style={{ color: TOKENS.success }} /> },
  failed:     { color: TOKENS.error,   label: '失败',     dot: <CloseCircleFilled style={{ color: TOKENS.error }} /> },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export default function DocumentUpload({ employeeId, onDocumentProcessed }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await listDocuments(employeeId);
      setDocuments(docs);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载文档失败');
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
      message.success(`「${file.name}」上传成功`);
      setDocuments((prev) => [doc, ...prev]);
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

  // 过滤后文档
  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.trim().toLowerCase();
    return documents.filter((d) => d.filename.toLowerCase().includes(q));
  }, [documents, search]);

  // 状态汇总
  const counts = useMemo(() => {
    const c = { uploaded: 0, processing: 0, ready: 0, failed: 0 };
    for (const d of documents) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [documents]);

  // 单行菜单（保留扩展点，未来可加「下载」「分享」「重命名」等）
  // 当前直接用 Popconfirm 处理删除，不展示行内下拉

  return (
    <div>
      {/* 顶部：上传区（紧凑化） */}
      <Dragger
        {...uploadProps}
        style={{
          marginBottom: 20,
          background: TOKENS.bgContainer,
          border: `1px dashed ${TOKENS.border}`,
          borderRadius: 4,
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: TOKENS.bgElevated,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 4,
              color: TOKENS.textPrimary,
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            <CloudUploadOutlined />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: TOKENS.textPrimary, fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
              点击或拖拽文件到此处上传
            </div>
            <div style={{ color: TOKENS.textTertiary, fontSize: 12 }}>
              支持 PDF / Word / TXT / Markdown 格式，单个文件不超过 50MB
            </div>
          </div>
          <Button type="primary" icon={<InboxOutlined />} disabled={uploading}>
            选择文件
          </Button>
        </div>
      </Dragger>

      {uploading && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: TOKENS.bgContainer,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
          }}
        >
          <Progress percent={100} status="active" size="small" showInfo={false} />
        </div>
      )}

      {/* 标题栏：统计 + 搜索 + 刷新 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Typography.Text style={{ color: TOKENS.textPrimary, fontSize: 14, fontWeight: 500 }}>
          文档库
        </Typography.Text>
        <Space size={8} style={{ flex: 1 }}>
          {(['ready', 'processing', 'uploaded', 'failed'] as DocumentStatus[]).map((s) =>
            counts[s] > 0 ? (
              <Tag
                key={s}
                style={{
                  background: 'transparent',
                  border: `1px solid ${TOKENS.border}`,
                  color: TOKENS.textSecondary,
                  borderRadius: 4,
                  padding: '0 8px',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: STATUS_META[s].color,
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                {STATUS_META[s].label} {counts[s]}
              </Tag>
            ) : null,
          )}
        </Space>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: TOKENS.textTertiary }} />}
          placeholder="搜索文件名"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: 220,
            background: TOKENS.bgElevated,
            border: `1px solid ${TOKENS.border}`,
          }}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={loadDocs}
          loading={loading}
          style={{ background: TOKENS.bgContainer, border: `1px solid ${TOKENS.border}` }}
        >
          刷新
        </Button>
      </div>

      {/* 文档列表 */}
      <Spin spinning={loading && documents.length === 0}>
        {filtered.length === 0 ? (
          <div
            style={{
              background: TOKENS.bgContainer,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 4,
              padding: '64px 24px',
            }}
          >
            <Empty
              image={
                <FileOutlined style={{ fontSize: 40, color: TOKENS.textTertiary }} />
              }
              description={
                <span style={{ color: TOKENS.textSecondary }}>
                  {documents.length === 0 ? '暂无上传文档' : `没有匹配「${search}」的文档`}
                </span>
              }
            />
          </div>
        ) : (
          <div
            style={{
              background: TOKENS.bgContainer,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            {/* 表头 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 100px 120px 140px 56px',
                padding: '10px 16px',
                background: TOKENS.bgElevated,
                borderBottom: `1px solid ${TOKENS.border}`,
                color: TOKENS.textTertiary,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: 0.3,
              }}
            >
              <div></div>
              <div>文件名</div>
              <div>大小</div>
              <div>状态</div>
              <div>上传时间</div>
              <div style={{ textAlign: 'right' }}>操作</div>
            </div>

            {/* 行 */}
            {filtered.map((doc, idx) => {
              const typeMeta = FILE_TYPE_META[doc.fileType] ?? FILE_TYPE_META.other;
              const statusMeta = STATUS_META[doc.status] ?? STATUS_META.uploaded;
              return (
                <div
                  key={doc.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 100px 120px 140px 56px',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom:
                      idx === filtered.length - 1 ? 'none' : `1px solid ${TOKENS.border}`,
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = TOKENS.bgHover;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  {/* 文件类型图标 */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: typeMeta.bg,
                      color: typeMeta.color,
                      borderRadius: 4,
                      fontSize: 16,
                    }}
                    title={typeMeta.label}
                  >
                    {typeMeta.icon}
                  </div>

                  {/* 文件名 + 上传者 */}
                  <div style={{ minWidth: 0, paddingRight: 16 }}>
                    <div
                      style={{
                        color: TOKENS.textPrimary,
                        fontSize: 13,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={doc.filename}
                    >
                      {doc.filename}
                    </div>
                    {doc.uploader && (
                      <div
                        style={{
                          color: TOKENS.textTertiary,
                          fontSize: 11,
                          marginTop: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <UserOutlined style={{ fontSize: 10 }} />
                        {doc.uploader}
                        {doc.errorMessage && (
                          <span style={{ color: TOKENS.error, marginLeft: 8 }}>
                            · {doc.errorMessage}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 文件大小 */}
                  <div style={{ color: TOKENS.textSecondary, fontSize: 12 }}>
                    {formatFileSize(doc.fileSize)}
                  </div>

                  {/* 状态 */}
                  <div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: statusMeta.color,
                      }}
                    >
                      {statusMeta.dot}
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* 上传时间 */}
                  <div
                    style={{
                      color: TOKENS.textTertiary,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title={new Date(doc.uploadedAt).toLocaleString('zh-CN')}
                  >
                    <ClockCircleOutlined style={{ fontSize: 11 }} />
                    {formatRelativeTime(doc.uploadedAt)}
                  </div>

                  {/* 操作 */}
                  <div style={{ textAlign: 'right' }}>
                    <Popconfirm
                      title="确认删除文档"
                      description={
                        <span style={{ color: TOKENS.textSecondary }}>
                          将永久删除「{doc.filename}」，且无法恢复
                        </span>
                      }
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDelete(doc.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ color: TOKENS.textTertiary }}
                        title="删除"
                      />
                    </Popconfirm>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>

      {/* 列表底部统计 */}
      {!loading && filtered.length > 0 && (
        <div
          style={{
            marginTop: 8,
            color: TOKENS.textTertiary,
            fontSize: 12,
            textAlign: 'right',
          }}
        >
          共 {filtered.length} 个文档
          {search && documents.length !== filtered.length && `（已过滤 ${documents.length - filtered.length} 个）`}
        </div>
      )}
    </div>
  );
}
