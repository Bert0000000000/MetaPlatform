import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { listCollaborations, type CollaborationTask, type SubTask } from '@/api/dw/collaborations';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 协作编排（DW 接口消费页）。
 * 数据面 src/api/dw/collaborations（listCollaborations）：多员工协作任务列表。
 */

type Meta = { label: string; color: TagColor };

const STATUS_META: Record<string, Meta> = {
  pending: { label: '待执行', color: 'grey' },
  running: { label: '进行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

const SPLIT_META: Record<string, Meta> = {
  sequential: { label: '串行', color: 'grey' },
  parallel: { label: '并行', color: 'blue' },
  hybrid: { label: '混合', color: 'purple' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

export default function CollaborationsPage() {
  const [items, setItems] = useState<CollaborationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res: CollaborationTask[] | { items?: CollaborationTask[] } = await listCollaborations();
      setItems(Array.isArray(res) ? res : (res?.items ?? []));
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

  const columns: DataTableProProps<CollaborationTask>['columns'] = [
    {
      title: '协作 ID',
      dataIndex: 'collaborationId',
      width: 220,
      ellipsis: true,
      render: (_: unknown, r: CollaborationTask) => r.collaborationId || '—',
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 240,
      ellipsis: true,
      render: (_: unknown, r: CollaborationTask) => r.title || '—',
    },
    {
      title: '拆分策略',
      dataIndex: 'splitStrategy',
      width: 110,
      render: (_: unknown, r: CollaborationTask) => {
        const meta = metaOf(SPLIT_META, r.splitStrategy);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '子任务',
      dataIndex: 'subtasks',
      width: 110,
      render: (_: unknown, r: CollaborationTask) => {
        const subs: SubTask[] = r.subtasks ?? [];
        const done = subs.filter((s) => s.status === 'completed').length;
        return `${done} / ${subs.length}`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_: unknown, r: CollaborationTask) => {
        const meta = metaOf(STATUS_META, r.status);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
  ];

  return (
    <>
      <PageHeader
        title="协作任务列表"
        desc={error ? undefined : loading ? '正在加载协作任务…' : `共 ${items.length} 个协作任务`}
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
          title="协作任务加载失败"
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
          <DataTablePro<CollaborationTask>
            columns={columns}
            dataSource={items}
            rowKey="collaborationId"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无协作任务"
                desc="发起多员工协作后，任务会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
