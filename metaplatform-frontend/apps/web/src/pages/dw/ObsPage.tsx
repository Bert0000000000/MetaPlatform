import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { listTraces, type TraceRecord } from '@/api/dw/obs';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 调用链概览。GET /dw/traces 返回调用链摘要记录。
 */

type Meta = { label: string; color: TagColor };

const STATUS_META: Record<string, Meta> = {
  ok: { label: '正常', color: 'green' },
  error: { label: '错误', color: 'red' },
  timeout: { label: '超时', color: 'amber' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

export default function ObsPage() {
  const [items, setItems] = useState<TraceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listTraces();
      setItems(res.items);
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

  const columns: DataTableProProps<TraceRecord>['columns'] = [
    { title: 'Trace ID', dataIndex: 'traceId', width: 240, ellipsis: true },
    { title: '数字员工', dataIndex: 'employeeId', width: 220, ellipsis: true },
    { title: 'Span 数量', dataIndex: 'spanCount', width: 110 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_: unknown, r: TraceRecord) => {
        const meta = metaOf(STATUS_META, r.status);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '耗时 (ms)', dataIndex: 'durationMs', width: 110 },
    { title: '开始时间', dataIndex: 'startedAt', width: 180 },
  ];

  return (
    <>
      <PageHeader
        title="调用链概览"
        desc={error ? undefined : loading ? '正在加载调用链…' : `共 ${items.length} 条调用链`}
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
          title="调用链加载失败"
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
          <DataTablePro<TraceRecord>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无调用链记录"
                desc="数字员工产生调用链后，摘要记录会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
