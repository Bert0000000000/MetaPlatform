import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { domainOfObjectType, getDatasourceSyncStatus, type SyncStatusRow } from '@/api/ont/kernel';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import { ridTail } from '../../rid';
import '../data-sections.css';
import '../../canvas.css';
import '../../ontology.css';

/**
 * 同步任务（IA2-3 从 DatacenterPage 的 ingest 分支独立成页）：
 * 正式路由 /ontology/data/sync。
 *
 * <p>每个对象类型的最近一轮同步健康快照（本体内核端点，不依赖数据平台接口）。
 * 同步健康此前藏在「数据接入」视图下半区，IA v2 升格为独立页面。
 */
export default function SyncJobsPage() {
  const [rows, setRows] = useState<SyncStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await getDatasourceSyncStatus());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const failures = rows.filter((r) => (r.consecutive_failures ?? 0) > 0).length;

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      `${r.class_rid} ${domainOfObjectType(r.class_rid)} ${r.last_error ?? ''}`
        .toLowerCase()
        .includes(kw),
    );
  }, [rows, keyword]);

  return (
    <>
      <PageHeader
        title="同步任务"
        desc={
          rows.length === 0
            ? '还没有同步记录 · 调度器未启动或尚未接数据源'
            : `${rows.length} 个类型的同步健康快照 · ${failures} 个异常`
        }
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

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '过滤类型、域或错误信息' }}
      />

      <DataTablePro<SyncStatusRow>
        columns={[
          {
            title: '对象类型',
            dataIndex: 'class_rid',
            width: 320,
            ellipsis: true,
            render: (_: unknown, row: SyncStatusRow) => (
              <span>
                <span className="mp-onto-strong">{ridTail(row.class_rid)}</span>{' '}
                <Tag size="small" type="light">{domainOfObjectType(row.class_rid)}</Tag>
              </span>
            ),
          },
          {
            title: '最近同步',
            dataIndex: 'last_run_at',
            width: 190,
            ellipsis: true,
            render: (v: string | undefined) => <span className="mp-onto-muted">{v ?? '从未'}</span>,
          },
          {
            title: '耗时',
            dataIndex: 'last_duration_ms',
            width: 110,
            render: (v: number | undefined) =>
              v === undefined || v === null ? <span className="mp-onto-faint">—</span> : `${v} ms`,
          },
          {
            title: '连续失败',
            dataIndex: 'consecutive_failures',
            width: 110,
            sorter: (a: SyncStatusRow, b: SyncStatusRow) =>
              (a.consecutive_failures ?? 0) - (b.consecutive_failures ?? 0),
            render: (v: number | undefined) => <span className="mp-onto-num">{v ?? 0}</span>,
          },
          {
            title: '最近错误',
            dataIndex: 'last_error',
            ellipsis: true,
            render: (v: string | undefined) => <span className="mp-onto-muted">{v || '—'}</span>,
          },
        ]}
        dataSource={filtered}
        rowKey="class_rid"
        loading={loading}
        empty={
          <EmptyState
            illustration="no-content"
            title="还没有同步记录"
            desc="先在对象映射页声明背挂数据源并触发同步，这里会出现健康快照。"
          />
        }
      />
    </>
  );
}
