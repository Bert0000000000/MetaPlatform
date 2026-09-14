import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { listTasks } from '@/api/dw/tasks';
import type { EmployeeTask } from '@/api/dw/types';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 任务中心（DW 接口消费页）。
 * 数据面 src/api/dw/tasks（listTasks）；任务按员工维度返回，这里汇总展示全部。
 */

type Meta = { label: string; color: TagColor };

const STATUS_META: Record<string, Meta> = {
  pending: { label: '待执行', color: 'grey' },
  running: { label: '进行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  success: { label: '成功', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'grey' },
};

const PRIORITY_META: Record<string, Meta> = {
  low: { label: '低', color: 'grey' },
  medium: { label: '中', color: 'amber' },
  high: { label: '高', color: 'red' },
};

/** 取值 → 展示元数据；字段缺失或未知值都不产出 "undefined" 字样。 */
function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

export default function TasksPage() {
  const [items, setItems] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listTasks('');
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

  const columns: DataTableProProps<EmployeeTask>['columns'] = [
    { title: '任务', dataIndex: 'title', width: 280, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_: unknown, r: EmployeeTask) => {
        const meta = metaOf(STATUS_META, r.status);
        return (
          <Tag color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (_: unknown, r: EmployeeTask) => {
        const meta = metaOf(PRIORITY_META, r.priority);
        return (
          <Tag color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      width: 180,
      render: (_: unknown, r: EmployeeTask) => r.completedAt ?? '—',
    },
  ];

  return (
    <>
      <PageHeader
        title="任务列表"
        desc={error ? undefined : loading ? '正在加载任务数据…' : `共 ${items.length} 个任务`}
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
          title="任务列表加载失败"
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
          <DataTablePro<EmployeeTask>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无任务"
                desc="数字员工接活后，任务会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
