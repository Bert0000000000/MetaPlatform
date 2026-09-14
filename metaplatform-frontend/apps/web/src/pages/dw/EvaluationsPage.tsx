import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { listReports, type EvaluationReport } from '@/api/dw/evaluations';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 能力评估（DW 接口消费页）。
 * 数据面 src/api/dw/evaluations（listReports）：按周期生成的员工效果评估报告。
 */

export default function EvaluationsPage() {
  const [items, setItems] = useState<EvaluationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listReports();
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

  const columns: DataTableProProps<EvaluationReport>['columns'] = [
    { title: '周期', dataIndex: 'period', width: 160 },
    {
      title: '平均评分',
      dataIndex: 'avgQualityScore',
      width: 120,
      render: (_: unknown, r: EvaluationReport) =>
        Number.isFinite(r.avgQualityScore) ? r.avgQualityScore.toFixed(1) : '—',
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      width: 110,
      render: (_: unknown, r: EvaluationReport) =>
        Number.isFinite(r.successRate) ? `${(r.successRate * 100).toFixed(0)}%` : '—',
    },
    { title: '任务数', dataIndex: 'totalTasks', width: 100 },
    { title: '生成时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '存在问题',
      dataIndex: 'issues',
      ellipsis: true,
      render: (_: unknown, r: EvaluationReport) =>
        r.issues && r.issues.length > 0 ? r.issues.join('；') : '—',
    },
  ];

  return (
    <>
      <PageHeader
        title="效果评估报告"
        desc={error ? undefined : loading ? '正在加载评估报告…' : `共 ${items.length} 份报告`}
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
          title="评估报告加载失败"
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
          <DataTablePro<EvaluationReport>
            columns={columns}
            dataSource={items}
            rowKey="reportId"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无评估报告"
                desc="生成一次评估后，报告会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
