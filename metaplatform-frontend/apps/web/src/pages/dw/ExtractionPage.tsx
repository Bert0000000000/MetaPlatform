import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { getExtractionsByEmployee } from '@/api/dw/extraction';
import type { ExtractionItem } from '@/api/dw/types';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 概念抽取（P2-DW-07/08 消费页）。
 * 数据面 src/api/dw/extraction（getExtractionsByEmployee）：文档抽取出的本体条目。
 */

type Meta = { label: string; color: TagColor };

const TYPE_META: Record<string, Meta> = {
  concept: { label: '概念', color: 'blue' },
  entity: { label: '实体', color: 'cyan' },
  rule: { label: '规则', color: 'purple' },
  action: { label: '动作', color: 'teal' },
};

const STATUS_META: Record<string, Meta> = {
  pending: { label: '待审核', color: 'amber' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  committed: { label: '已提交', color: 'blue' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

export default function ExtractionPage() {
  const [items, setItems] = useState<ExtractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getExtractionsByEmployee('');
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

  const columns: DataTableProProps<ExtractionItem>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 240,
      ellipsis: true,
      render: (_: unknown, r: ExtractionItem) => r.name || '—',
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (_: unknown, r: ExtractionItem) => {
        const meta = metaOf(TYPE_META, r.type);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_: unknown, r: ExtractionItem) => {
        const meta = metaOf(STATUS_META, r.status);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '置信度', dataIndex: 'confidence', width: 100, render: (_: unknown, r: ExtractionItem) => (typeof r.confidence === 'number' ? String(r.confidence) : '—') },
    { title: '抽取时间', dataIndex: 'extractedAt', width: 180, render: (_: unknown, r: ExtractionItem) => r.extractedAt || '—' },
    { title: '描述', dataIndex: 'description', ellipsis: true },
  ];

  return (
    <>
      <PageHeader
        title="概念抽取列表"
        desc={error ? undefined : loading ? '正在加载抽取记录…' : `共 ${items.length} 条抽取记录`}
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
          title="抽取记录加载失败"
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
          <DataTablePro<ExtractionItem>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无抽取记录"
                desc="对文档执行抽取后，条目会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
