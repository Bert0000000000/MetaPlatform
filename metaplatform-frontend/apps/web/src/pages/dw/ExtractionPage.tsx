import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { getExtractionsByEmployee, type ExtractionRecord } from '@/api/dw/extraction';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 抽取记录。GET /dw/extract 返回来源及抽取数量记录。
 */

type Meta = { label: string; color: TagColor };

const SOURCE_META: Record<string, Meta> = {
  kb: { label: '知识库', color: 'blue' },
  conversation: { label: '会话', color: 'cyan' },
  document: { label: '文档', color: 'purple' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

export default function ExtractionPage() {
  const [items, setItems] = useState<ExtractionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getExtractionsByEmployee('');
      setItems(res);
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

  const columns: DataTableProProps<ExtractionRecord>['columns'] = [
    {
      title: '来源记录',
      dataIndex: 'sourceId',
      width: 240,
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: (_: unknown, r: ExtractionRecord) => {
        const meta = metaOf(SOURCE_META, r.source);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '数字员工', dataIndex: 'employeeId', width: 220, ellipsis: true },
    { title: '抽取事实数', dataIndex: 'extractedFacts', width: 110 },
    { title: '抽取时间', dataIndex: 'extractedAt', width: 180 },
  ];

  return (
    <>
      <PageHeader
        title="抽取记录列表"
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
          <DataTablePro<ExtractionRecord>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无抽取记录"
                desc="完成抽取后，可在这里查看来源记录与抽取数量。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
