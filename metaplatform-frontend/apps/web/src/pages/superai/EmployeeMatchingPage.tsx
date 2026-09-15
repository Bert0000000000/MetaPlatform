import { useCallback, useMemo, useState } from 'react';
import { Banner, Button, Card, Progress, Tag, TextArea, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Sparkles } from 'lucide-react';
import { matchEmployees, type MatchedEmployee } from '@/api/superai/schedule';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';

/**
 * SuperAI · 员工匹配。
 *
 * 数据面沿用 src/api/superai/schedule：matchEmployees → POST /scheduling/employees/match。
 * 原页的行动列「分配给此员工」没有落点（无 onClick），已删除；这里只呈现真实匹配结果。
 */
export default function EmployeeMatchingPage() {
  const [intent, setIntent] = useState('');
  const [results, setResults] = useState<MatchedEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleMatch = useCallback(async () => {
    const text = intent.trim();
    if (!text) {
      Toast.warning('先描述一下要做什么');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await matchEmployees(text);
      setResults(Array.isArray(r) ? r : []);
      setSearched(true);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : String(e));
      Toast.error('匹配失败');
    } finally {
      setLoading(false);
    }
  }, [intent]);

  const columns: ColumnProps<MatchedEmployee>[] = useMemo(
    () => [
      { title: '员工', dataIndex: 'name', width: 200, ellipsis: true },
      { title: '角色', dataIndex: 'role', width: 140, render: (v: string | undefined) => v || '—' },
      { title: '能力', dataIndex: 'capability', width: 160, render: (v: string | undefined) => v || '—' },
      { title: 'ID', dataIndex: 'employeeId', width: 180, ellipsis: true },
      {
        title: '置信度',
        dataIndex: 'confidence',
        width: 220,
        render: (v: number) => (
          <span className="mp-exec-step-head">
            <Progress percent={Math.round((v ?? 0) * 100)} size="small" showInfo={false} />
            <Tag size="small" type="light">{((v ?? 0) * 100).toFixed(1)}%</Tag>
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader title="员工匹配" desc="用一句话描述任务，匹配最合适的数字员工" />

      <Card title="任务意图">
        <div className="mp-exec-col">
          <TextArea
            rows={2}
            value={intent}
            onChange={(v) => setIntent(v)}
            placeholder="例如：汇总本月销售数据并发送邮件"
          />
          <div className="mp-exec-step-actions">
            <Button
              theme="solid"
              type="primary"
              icon={<Sparkles size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void handleMatch()}
            >
              匹配员工
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <Banner type="danger" closeIcon={null} description={error} />
      ) : results.length > 0 ? (
        <Card title={`匹配结果（${results.length} 个）`}>
          <DataTablePro<MatchedEmployee>
            columns={columns}
            dataSource={results}
            rowKey="employeeId"
            loading={loading}
            empty={<EmptyState illustration="no-result" title="没有匹配的员工" />}
          />
        </Card>
      ) : (
        <EmptyState
          illustration="idle"
          title={searched ? '没有匹配的员工' : '点击上方按钮匹配'}
          desc={searched ? '换个说法再试，或先在数字员工页招聘对应能力的员工。' : undefined}
        />
      )}
    </>
  );
}
