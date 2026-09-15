import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { getTraceSpans, type ObsSpan } from '@/api/dw/obs';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 可观测 Span（DW 接口消费页）。
 * 数据面 src/api/dw/obs（getTraceSpans('latest')）：最近一条 trace 的 span 列表。
 */

type Meta = { label: string; color: TagColor };

const STATUS_META: Record<string, Meta> = {
  OK: { label: 'OK', color: 'green' },
  UNSET: { label: '未设置', color: 'grey' },
  ERROR: { label: '错误', color: 'red' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

function formatDuration(us: number): string {
  if (!Number.isFinite(us) || us < 0) return '—';
  if (us < 1000) return `${us} µs`;
  return `${(us / 1000).toFixed(2)} ms`;
}

function formatStart(us: number): string {
  if (!Number.isFinite(us) || us <= 0) return '—';
  return new Date(us / 1000).toLocaleString('zh-CN');
}

export default function ObsPage() {
  const [items, setItems] = useState<ObsSpan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getTraceSpans('latest');
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

  const columns: DataTableProProps<ObsSpan>['columns'] = [
    { title: '服务', dataIndex: 'serviceName', width: 200, ellipsis: true },
    { title: '操作', dataIndex: 'operationName', width: 220, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_: unknown, r: ObsSpan) => {
        const meta = metaOf(STATUS_META, r.status);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '耗时',
      dataIndex: 'durationUs',
      width: 110,
      render: (_: unknown, r: ObsSpan) => formatDuration(r.durationUs),
    },
    {
      title: '开始时间',
      dataIndex: 'startTimeUs',
      width: 180,
      render: (_: unknown, r: ObsSpan) => formatStart(r.startTimeUs),
    },
    { title: 'Span ID', dataIndex: 'spanId', width: 200, ellipsis: true },
  ];

  return (
    <>
      <PageHeader
        title="可观测 Span"
        desc={error ? undefined : loading ? '正在加载 span 数据…' : `共 ${items.length} 个 span`}
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
          title="Span 数据加载失败"
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
          <DataTablePro<ObsSpan>
            columns={columns}
            dataSource={items}
            rowKey="spanId"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无 span 数据"
                desc="最近一条 trace 产生后，span 会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
