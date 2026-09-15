import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { listDocuments } from '@/api/dw/documents';
import type { DocumentItem } from '@/api/dw/types';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 文档处理（P2-DW-06 消费页）。
 * 数据面 src/api/dw/documents（listDocuments）：上传给员工的待抽取文档。
 */

type Meta = { label: string; color: TagColor };

const STATUS_META: Record<string, Meta> = {
  uploaded: { label: '已上传', color: 'grey' },
  processing: { label: '处理中', color: 'blue' },
  ready: { label: '就绪', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // listDocuments 已在数据层解包 _paginate 并归一化字段，直接取数组即可。
      const res = await listDocuments('');
      setItems(res ?? []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableProProps<DocumentItem>['columns'] = [
    { title: '文件名', dataIndex: 'filename', width: 300, ellipsis: true },
    { title: '类型', dataIndex: 'fileType', width: 90 },
    {
      title: '大小',
      dataIndex: 'fileSize',
      width: 110,
      render: (_: unknown, r: DocumentItem) => formatSize(r.fileSize),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_: unknown, r: DocumentItem) => {
        const meta = metaOf(STATUS_META, r.status);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '上传时间', dataIndex: 'uploadedAt', width: 180, render: (_: unknown, r: DocumentItem) => r.uploadedAt || '—' },
    { title: '上传者', dataIndex: 'uploader', width: 140, render: (_: unknown, r: DocumentItem) => r.uploader ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title="知识文档列表"
        desc={error ? undefined : loading ? '正在加载文档…' : `共 ${items.length} 份文档`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="文档列表加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading && items.length === 0 ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : (
        <Card>
          <DataTablePro<DocumentItem>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无文档"
                desc="上传文档后，这里会列出它们。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
