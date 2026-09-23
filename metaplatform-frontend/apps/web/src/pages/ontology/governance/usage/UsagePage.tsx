import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { applyLifecycle, getUsageSummary, type UsageRow } from '@/api/ont/kernel';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import '../governance.css';
import '../../ontology.css';

/**
 * 使用量（IA2-6 自 GovernancePage 的 usage 区块拆出）：
 * 正式路由 /ontology/governance/usage。
 *
 * <p>类型读写量（近 30 天，GET /usage/types）+ 生命周期操作
 * （deprecate / delete，带使用量删除保护的 409 提示）。
 */
export default function UsagePage() {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsage(await getUsageSummary(30).catch(() => [] as UsageRow[]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doLifecycle = async (rid: string, action: 'deprecate' | 'delete') => {
    if (action === 'delete' && !window.confirm(
      `删除类型 ${rid}？（有近 30 天读量的类型会被拒绝）`)) return;
    setMsg('');
    try {
      await applyLifecycle(rid, action);
      setMsg(`${action} 成功：${rid}`);
      void load();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setMsg(detail ?? (e instanceof Error ? e.message : `${action} 失败`));
    }
  };

  return (
    <>
      <PageHeader
        title="使用量"
        desc={`${usage.length} 个类型（近 30 天）· 变更影响评估 · 退役决策`}
      />
      <div className="mp-gov-card">
        {msg && (
          <div className="mp-border mp-text-sm mp-text-1 mp-py-2 mp-px-3 mp-bg-1 mp-rounded">{msg}</div>
        )}
        <DataTablePro<UsageRow>
          columns={[
            {
              title: '类型',
              dataIndex: 'class_rid',
              render: (v: string) => <span className="mp-text-sm mp-mono">{v}</span>,
            },
            { title: '读（30d）', dataIndex: 'reads', width: 100 },
            { title: '写（30d）', dataIndex: 'writes', width: 100 },
            { title: '活跃天数', dataIndex: 'active_days', width: 90 },
            {
              title: '',
              dataIndex: '__ops',
              width: 170,
              render: (_: unknown, row: UsageRow) => (
                <div className="mp-flex mp-gap-1">
                  <button
                    type="button"
                    onClick={() => void doLifecycle(row.class_rid, 'deprecate')}
                    className="mp-clickable mp-border mp-text-sm mp-text-1 mp-py-1 mp-px-2 mp-bg-1 mp-rounded-sm"
                  >
                    废弃
                  </button>
                  <button
                    type="button"
                    onClick={() => void doLifecycle(row.class_rid, 'delete')}
                    className="mp-clickable mp-text-sm mp-text-danger mp-py-1 mp-px-2 mp-rounded-sm mp-onto-btn--danger"
                  >
                    删除
                  </button>
                </div>
              ),
            },
          ]}
          dataSource={usage}
          rowKey="class_rid"
          loading={loading}
          empty={
            <EmptyState
              illustration="no-content"
              title="暂无使用量数据"
              desc="使用量在读写时自动打点（GET /individuals 按类读、apply-edit-set 写）。"
            />
          }
        />
        {!loading && usage.length === 0 && (
          <div className="mp-text-sm mp-text-2 mp-flex-center mp-gap-1">
            <AlertTriangle className="mp-icon-12" />
            使用量在读写时自动打点（GET /individuals 按类读、apply-edit-set 写）
          </div>
        )}
      </div>
    </>
  );
}
